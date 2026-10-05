import PizZip from "pizzip";
import { missingDocumentTemplateFields, documentTemplateFieldsError } from "@/lib/document-template-fields";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { documentDeliveryValues } from "@/lib/document-delivery-values";
import { documentChoice, documentLanguageValues } from "@/lib/document-language-values";
import { documentTrainingSummary } from "@/lib/document-training-summary";
import { docxOutputHeaders } from "@/lib/server/docx-response-headers";
import { validateGeneratedDocx, invalidDocxResponse } from "@/lib/docx-output-validation";
import { loadDocumentTemplate, templateLoadErrorResponse } from "@/lib/server/document-template-loader";
import { templateProvenanceHeaders } from "@/lib/template-provenance";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { deliveryDocumentRows } from "@/lib/prototype-package";
import { readValidatedDocumentRequest } from "@/lib/server/document-request-validation";


function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;").replace(/\r\n|\r|\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
}

export async function POST(request: Request) {
  return privateDocumentResponse(await createDocumentResponse(request));
}

async function createDocumentResponse(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (authError) return authError;
  const parsed = await readValidatedDocumentRequest(request, "KR");
  if (!parsed.ok) return parsed.response;
  const { context, job, language } = parsed.input;
  const localized = documentLanguageValues(context, job.id, language);
  const certificate = context.certificates[job.id];
  const records = context.deliveryDocuments[job.id];
  const delivery = documentDeliveryValues(context, job.id, language);
  const note = [
    documentTrainingSummary(context.examSchedules?.[job.id], language),
    delivery.chronology,
    delivery.invoiceNote,
    delivery.dispatchNote,
    delivery.ownerNote,
  ].filter(Boolean).join(" | ");
  const values: Record<string, unknown> = {
    ...delivery,
    candidateName: localized.candidateName,
    standard: job.standard,
    grade: documentChoice(job.currentGrade, language),
    jobNo: job.jobNo,
    certificationNo: certificate?.certificationNo,
    note,
  };
  for (const row of deliveryDocumentRows) {
    const record = records?.[row.key];
    values[`${row.key}Mark`] = record?.applicability === "NOT_APPLICABLE" ? language === "KR" ? "해당 없음" : "N/A" : record?.received ? "■" : "□";
    values[`${row.key}Date`] = record?.date || "-";
    values[`${row.key}Comment`] = record?.comment || "";
  }

  let template;
  try { template = await loadDocumentTemplate("DELIVERY_CONFIRMATION", language, language === "EN" ? "FGPC-012-03-delivery-confirmation-en.docx" : undefined); }
  catch { return templateLoadErrorResponse(); }
  let zip;
  try { zip = new PizZip(template.bytes); }
  catch { return invalidDocxResponse(); }
  const missingFields = missingDocumentTemplateFields(zip, "DELIVERY_CONFIRMATION");
  if (missingFields.length) return documentTemplateFieldsError(missingFields);
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;
    for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value));
    zip.file(fileName, content);
  }
  if (!validateGeneratedDocx(zip)) return invalidDocxResponse();
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  const accessError = await recordDocumentResponse("job", job.id, `DELIVERY_CONFIRMATION:${language}`);
  if (accessError) return accessError;
  return new Response(body, { headers: { ...templateProvenanceHeaders(template), ...docxOutputHeaders(output), "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Document_Delivery_Confirmation_${language}.docx"` } });
}
