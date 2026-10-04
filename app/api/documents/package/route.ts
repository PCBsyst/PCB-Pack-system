import PizZip from "pizzip";
import { validateGeneratedDocx } from "@/lib/docx-output-validation";
import { readTemplateProvenance } from "@/lib/template-provenance";
import { packageSafePath, validatePackageRequest } from "@/lib/package-request-validation";
import { validateStoredPackageRecords } from "@/lib/server/package-record-validation";
import type { PackageContext, DocumentLanguage } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";
import { corporateTemplateRegistry, type CorporateDocumentType } from "@/lib/document-template-registry";
import { getActiveDocumentTemplateKeys, templateLoadErrorResponse } from "@/lib/server/document-template-loader";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { recordPackageGeneration, type GeneratedPackageDocument } from "@/lib/server/package-receipts";
import { POST as createApplicationReview } from "@/app/api/documents/application-review/route";
import { POST as createDecisionReport } from "@/app/api/documents/decision-report/route";
import { POST as createDeliveryConfirmation } from "@/app/api/documents/delivery-confirmation/route";

type RequestBody = {
  context: PackageContext;
  jobs: Job[];
  languages: DocumentLanguage[];
};

const generators: Record<CorporateDocumentType, (request: Request) => Promise<Response>> = {
  APPLICATION_REVIEW: createApplicationReview,
  CERTIFICATION_DECISION_REPORT: createDecisionReport,
  DELIVERY_CONFIRMATION: createDeliveryConfirmation,
};

export async function POST(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION", "PACKAGE_DOWNLOAD"]);
  if (authError) return authError;
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  const validationError = validatePackageRequest(input);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });
  const { context, jobs, languages } = input as RequestBody;
  const recordError = await validateStoredPackageRecords(context, jobs);
  if (recordError) return recordError;

  const selectedLanguages = new Set(languages);
  let activeTemplateKeys;
  try { activeTemplateKeys = await getActiveDocumentTemplateKeys(); }
  catch { return templateLoadErrorResponse(); }
  const templates = corporateTemplateRegistry.filter((template) => template.available || activeTemplateKeys.has(`${template.documentType}:${template.language}`));
  const zip = new PizZip();
  let fileCount = 0;
  const generatedDocuments: GeneratedPackageDocument[] = [];
  const generatedAt = new Date().toISOString();
  const manifestLines = [
    `신청번호: ${context.application.applicationNo}`,
    `후보자: ${context.candidate.name}`,
    `생성일시: ${new Date().toISOString()}`,
    "",
    "포함된 기업 양식",
  ];

  for (const job of jobs) {
    const safeJobNo = packageSafePath(job.jobNo);
    for (const template of templates) {
      if (!selectedLanguages.has(template.language)) continue;
      const documentRequest = new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, job, language: template.language }),
      });
      const response = await generators[template.documentType](documentRequest);
      if (!response.ok) {
        return Response.json({ error: `${job.jobNo} ${template.outputName} 생성에 실패했습니다.` }, { status: 500 });
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      try {
        const documentZip = new PizZip(bytes);
        if (!validateGeneratedDocx(documentZip)) throw new Error("Invalid DOCX");
      } catch {
        return Response.json({ error: "생성된 Word 파일을 확인하지 못해 패키지를 중단했습니다." }, { status: 503 });
      }
      const entryName = `${safeJobNo}/${template.language}/${safeJobNo}_${template.outputName}`;
      zip.file(entryName, bytes);
      fileCount += 1;
      let provenance;
      try { provenance = readTemplateProvenance(response.headers); }
      catch { return Response.json({ error: "양식 생성 근거를 확인하지 못해 패키지 생성을 중단했습니다." }, { status: 503 }); }
      generatedDocuments.push({ jobId: job.id, documentType: template.documentType, language: template.language, entryName, template: provenance });
      manifestLines.push(`- ${entryName}`);
      manifestLines.push(`  양식 개정: ${provenance.version} / 출처: ${provenance.source === "DATABASE" ? "등록 양식" : "기본 내장 양식"} / SHA-256: ${provenance.sha256}`);
    }
  }

  if (!fileCount) return Response.json({ error: "선택한 언어에 생성 가능한 양식이 없습니다." }, { status: 422 });
  const complete = fileCount === jobs.length * selectedLanguages.size * 3;
  manifestLines.push(`실제 생성 문서: ${fileCount}개 DOCX`, complete ? "선택한 언어의 3종 양식 포함" : "일부 양식 미등록: 전체 패키지 완료가 아닙니다.");
  manifestLines.push(
    "",
    "안내",
    "- 현재 등록된 실제 기업 템플릿만 포함합니다.",
    "- 국문 문서전달확인서와 영문 서류검토서·인증결정보고서는 해당 템플릿 등록 후 추가됩니다.",
    "- PDF 일괄 생성은 다음 단계에서 연결합니다.",
  );
  zip.file("package_manifest.txt", `\ufeff${manifestLines.join("\r\n")}`);

  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeApplicationNo = packageSafePath(context.application.applicationNo);
  const accessError = await recordDocumentResponse("application", context.application.id, "CORPORATE_PACKAGE:ZIP");
  if (accessError) return accessError;
  const receipt = await recordPackageGeneration(context.application.id, generatedDocuments, complete, output);
  if (receipt.error) return receipt.error;
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Cache-Control": "private, no-store",
      "X-Package-File-Count": String(fileCount),
      "X-Package-Generated-At": generatedAt,
      "X-Package-Complete": String(complete),
      "X-Package-Receipt-Status": receipt.status,
      "X-Package-Receipt-Id": receipt.id ?? "",
      "X-Package-SHA256": receipt.sha256,
      "Content-Disposition": `attachment; filename="${safeApplicationNo}_Corporate_Documents.zip"`,
    },
  });
}
