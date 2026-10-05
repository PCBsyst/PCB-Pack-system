import PizZip from "pizzip";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { prepareKoreanDeliveryTemplateDraft } from "@/lib/korean-delivery-template-draft";
import { missingDocumentTemplateFields, documentTemplateFieldsError } from "@/lib/document-template-fields";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { documentDeliveryValues } from "@/lib/document-delivery-values";
import { documentChoice, documentLanguageValues } from "@/lib/document-language-values";
import { documentTrainingSummary } from "@/lib/document-training-summary";
import { docxOutputHeaders } from "@/lib/server/docx-response-headers";
import { validateGeneratedDocx, invalidDocxResponse } from "@/lib/docx-output-validation";
import { templateProvenanceHeaders } from "@/lib/template-provenance";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { deliveryDocumentRows } from "@/lib/prototype-package";
import { readValidatedDocumentRequest } from "@/lib/server/document-request-validation";

function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;").replace(/\r\n|\r|\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
}

export async function POST(request: Request) {
  return privateDocumentResponse(await createDraftResponse(request));
}

async function createDraftResponse(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (authError) return authError;
  const parsed = await readValidatedDocumentRequest(request, "KR");
  if (!parsed.ok) return parsed.response;
  const { context, job, language } = parsed.input;
  if (language !== "KR") return Response.json({ error: "검토용 문서전달확인서는 국문만 지원합니다." }, { status: 400 });

  let zip;
  try {
    const source = await readFile(path.join(process.cwd(), "templates", "FGPC-012-03-delivery-confirmation-en.docx"));
    zip = new PizZip(source);
    prepareKoreanDeliveryTemplateDraft(zip);
  } catch { return invalidDocxResponse(); }
  const missing = missingDocumentTemplateFields(zip, "DELIVERY_CONFIRMATION");
  if (missing.length) return documentTemplateFieldsError(missing);
  const templateBytes = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const template = { source: "BUILT_IN" as const, version: "국문 검토용 초안 v1 출력 미검증", sha256: createHash("sha256").update(templateBytes).digest("hex") };
  const delivery = documentDeliveryValues(context, job.id, "KR");
  const certificate = context.certificates[job.id];
  const records = context.deliveryDocuments[job.id];
  const values: Record<string, unknown> = {
    ...delivery,
    candidateName: documentLanguageValues(context, job.id, "KR").candidateName,
    standard: job.standard, grade: documentChoice(job.currentGrade, "KR"), jobNo: job.jobNo,
    certificationNo: certificate?.certificationNo,
    note: [documentTrainingSummary(context.examSchedules?.[job.id], "KR"), delivery.chronology, delivery.invoiceNote, delivery.dispatchNote, delivery.ownerNote].filter(Boolean).join(" | "),
  };
  for (const row of deliveryDocumentRows) {
    const record = records?.[row.key];
    values[`${row.key}Mark`] = record?.applicability === "NOT_APPLICABLE" ? "해당 없음" : record?.received ? "■" : "□";
    values[`${row.key}Date`] = record?.date || "-";
    values[`${row.key}Comment`] = record?.comment || "";
  }
  for (const name of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(name)?.asText();
    if (!content) continue;
    for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value));
    zip.file(name, content);
  }
  if (!validateGeneratedDocx(zip)) return invalidDocxResponse();
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const accessError = await recordDocumentResponse("job", job.id, "DELIVERY_CONFIRMATION_DRAFT:KR");
  if (accessError) return accessError;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer, { headers: {
    ...templateProvenanceHeaders(template), ...docxOutputHeaders(output), "X-Document-Status": "DRAFT",
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${safeJobNo}_Document_Delivery_Confirmation_DRAFT_KR.docx"`,
  } });
}
