import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { deliveryDocumentRows, type PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

type RequestBody = { context: PackageContext; job: Job };

function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function POST(request: Request) {
  const { context, job } = await request.json() as RequestBody;
  const certificate = context.certificates[job.id];
  const records = context.deliveryDocuments[job.id];
  const values: Record<string, unknown> = {
    candidateName: context.candidate.nameEn || context.candidate.name,
    standard: job.standard,
    grade: job.currentGrade,
    jobNo: job.jobNo,
    certificationNo: certificate?.certificationNo,
    note: "Prototype record generated from the FGPC-012-03 structure.",
  };
  for (const row of deliveryDocumentRows) {
    const record = records?.[row.key];
    values[`${row.key}Mark`] = record?.applicability === "NOT_APPLICABLE" ? "N/A" : record?.received ? "☒" : "☐";
    values[`${row.key}Date`] = record?.date || "-";
    values[`${row.key}Comment`] = record?.comment || "";
  }

  const template = await readFile(path.join(process.cwd(), "templates", "FGPC-012-03-delivery-confirmation-en.docx"));
  const zip = new PizZip(template);
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;
    for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value));
    zip.file(fileName, content);
  }
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Document_Delivery_Confirmation_EN.docx"` } });
}
