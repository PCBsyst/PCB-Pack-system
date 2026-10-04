import { readFile } from "node:fs/promises";
import { requireApiStaff } from "@/lib/server/api-auth";
import { validateActionDocumentInput } from "@/lib/action-document-records";
import { loadStoredActionDocument } from "@/lib/server/action-document-records";
import { validateGeneratedDocx, invalidDocxResponse } from "@/lib/docx-output-validation";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import path from "node:path";
import PizZip from "pizzip";
import { privateDocumentResponse } from "@/lib/private-document-response";


function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function replaceAllXml(zip: PizZip, values: Array<[string, string]>) {
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;
    for (const [before, after] of values) content = content.replaceAll(before, xml(after));
    zip.file(fileName, content);
  }
}

function replaceParagraphXml(zip: PizZip, values: Array<[string, string]>) {
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;
    content = content.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
      const visibleText = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join("");
      const replacement = values.find(([before]) => visibleText === before)?.[1];
      if (replacement === undefined) return paragraph;
      let first = true;
      return paragraph.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/g, (_match, open: string, close: string) => {
        const value = first ? xml(replacement) : "";
        first = false;
        return `${open}${value}${close}`;
      });
    });
    zip.file(fileName, content);
  }
}

export async function POST(request: Request) {
  return privateDocumentResponse(await createDocumentResponse(request));
}

async function createDocumentResponse(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (authError) return authError;
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (!validateActionDocumentInput(input)) return Response.json({ error: "Job과 정지·철회 기록을 다시 선택해 주세요." }, { status: 400 });
  const stored = await loadStoredActionDocument(input);
  if (!stored.ok) return stored.response;
  const body = stored.values;
  const actionLabel = body.actionType === "SUSPENDED" ? "정지" : "철회";
  const templateName = body.kind === "REPORT" ? "FGPC-015-02-certification-action-report-kr.docx" : "FGPC-015-03-certification-action-letter-kr.docx";
  let zip: PizZip;
  try { zip = new PizZip(await readFile(path.join(process.cwd(), "templates", templateName))); }
  catch { return invalidDocxResponse(); }

  if (body.kind === "REPORT") {
    replaceAllXml(zip, [
      ["고객명:", `고객명: ${body.candidateName}`],
      ["GPC-mmddyyyy-001", `GPC-${body.managementNo}`],
      ["Mmm dth yyyy", body.recordedAt.slice(0, 10)],
      ["XX-X-XXXX", body.certificationNo],
      ["발행인: ", `발행인: ${body.actor}`],
      ["보고서 발행 사유", `보고서 발행 사유: ${body.standardReason} / ${body.detailReason}`],
      [" 정지", body.actionType === "SUSPENDED" ? "■ 정지" : "□ 정지"],
      [" 철회", body.actionType === "WITHDRAWN" ? "■ 철회" : "□ 철회"],
    ]);
  } else {
    replaceParagraphXml(zip, [
      ["인증  통보", `인증 ${actionLabel} 통보`],
      ["제목: 인증번호 XX-X-XXXX의 인증  안내", `제목: 인증번호 ${body.certificationNo}의 인증 ${actionLabel} 안내`],
      ["GPC는  일 발행된 인증번호 XX-X-XXXX에 대해 일, 인증의  결정하였습니다.", `GPC는 ${body.certificationIssueDate} 발행된 인증번호 ${body.certificationNo}에 대해 ${body.effectiveDate}, 인증 ${actionLabel}을 결정하였습니다.`],
      ["사유는 다음과 같습니다.", `사유는 다음과 같습니다. ${body.standardReason} / ${body.detailReason}`],
    ]);
    replaceAllXml(zip, [
      ["고객명:", `고객명: ${body.candidateName}`],
      ["주소:", "주소: 별도 고객정보 참조"],
      ["연락처:", `연락처: ${body.candidateContact || "-"}`],
      ["GPC--001", `GPC-${body.managementNo}`],
      ["날짜:", `날짜: ${body.recordedAt.slice(0, 10)}`],
    ]);
  }

  if (!validateGeneratedDocx(zip)) return invalidDocxResponse();
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const result = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = body.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  const suffix = body.kind === "REPORT" ? "Certification_Action_Report" : "Certification_Action_Letter";
  const accessError = await recordDocumentResponse("certification_action", input.actionId, `${suffix}:KR`);
  if (accessError) return accessError;
  return new Response(result, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_${suffix}_KR.docx"` } });
}
