import PizZip from "pizzip";
import { validateGeneratedDocx, invalidDocxResponse } from "@/lib/docx-output-validation";
import { loadDocumentTemplate, templateLoadErrorResponse } from "@/lib/server/document-template-loader";
import { templateProvenanceHeaders } from "@/lib/template-provenance";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { deliveryDocumentRows } from "@/lib/prototype-package";
import { readValidatedDocumentRequest } from "@/lib/server/document-request-validation";


function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function POST(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (authError) return authError;
  const parsed = await readValidatedDocumentRequest(request, "EN");
  if (!parsed.ok) return parsed.response;
  const { context, job, language } = parsed.input;
  const certificate = context.certificates[job.id];
  const records = context.deliveryDocuments[job.id];
  const note = [
    context.invoiceNo ? `Invoice: ${context.invoiceNo} / Issued: ${context.invoiceIssuedAt || "-"} / Paid: ${context.paymentConfirmedAt || "-"}` : "",
    certificate?.originalSentAt ? `Original dispatched: ${certificate.originalSentAt} / Tracking No.: ${certificate.trackingNumber || "-"}` : "",
    `Person in charge: ${context.application.primaryOwner}`,
  ].filter(Boolean).join(" | ");
  const values: Record<string, unknown> = {
    candidateName: context.candidate.nameEn || context.candidate.name,
    standard: job.standard,
    grade: job.currentGrade,
    jobNo: job.jobNo,
    certificationNo: certificate?.certificationNo,
    note,
  };
  for (const row of deliveryDocumentRows) {
    const record = records?.[row.key];
    values[`${row.key}Mark`] = record?.applicability === "NOT_APPLICABLE" ? "N/A" : record?.received ? "■" : "□";
    values[`${row.key}Date`] = record?.date || "-";
    values[`${row.key}Comment`] = record?.comment || "";
  }

  let template;
  try { template = await loadDocumentTemplate("DELIVERY_CONFIRMATION", language, language === "EN" ? "FGPC-012-03-delivery-confirmation-en.docx" : undefined); }
  catch { return templateLoadErrorResponse(); }
  let zip;
  try { zip = new PizZip(template.bytes); }
  catch { return invalidDocxResponse(); }
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
  return new Response(body, { headers: { ...templateProvenanceHeaders(template), "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Document_Delivery_Confirmation_${language}.docx"` } });
}
