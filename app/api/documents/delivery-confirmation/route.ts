import PizZip from "pizzip";
import { loadDocumentTemplate } from "@/lib/server/document-template-loader";
import { deliveryDocumentRows, type DocumentLanguage, type PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

type RequestBody = { context: PackageContext; job: Job; language?: DocumentLanguage };

function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function POST(request: Request) {
  const { context, job, language = "EN" } = await request.json() as RequestBody;
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

  const template = await loadDocumentTemplate("DELIVERY_CONFIRMATION", language, language === "EN" ? "FGPC-012-03-delivery-confirmation-en.docx" : undefined);
  const zip = new PizZip(template.bytes);
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;
    for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value));
    zip.file(fileName, content);
  }
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Document_Delivery_Confirmation_${language}.docx"` } });
}
