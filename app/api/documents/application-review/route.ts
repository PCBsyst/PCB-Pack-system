import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import type { PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

type RequestBody = { context: PackageContext; job: Job };
function xml(value: unknown) { return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }

export async function POST(request: Request) {
  const { context, job } = await request.json() as RequestBody;
  const records = context.deliveryDocuments[job.id];
  const mark = (key: keyof typeof records) => records?.[key]?.applicability === "NOT_APPLICABLE" ? "해당 없음" : records?.[key]?.received ? "☒" : "☐";
  const values: Record<string, unknown> = {
    jobNo: job.jobNo, candidateName: context.candidate.name, candidateNameEn: context.candidate.nameEn,
    birthDate: context.candidate.birthDate, nationality: context.candidate.nationality, address: context.candidate.address,
    email: context.candidate.email, phone: context.candidate.phone, initialMark: context.application.applicationType === "최초" ? "☒" : "☐",
    renewalMark: context.application.applicationType === "갱신" ? "☒" : "☐", standard: job.standard, grade: job.currentGrade,
    specialRequirements: "없음", academicDocumentMark: mark("diploma"), careerDocumentMark: mark("career"), educationDocumentMark: mark("education"),
    auditLogDocumentMark: mark("auditLog"), otherDocumentMark: "☐", receivedAt: context.application.receivedAt,
    reviewResult: context.review.result, reviewComment: context.review.comment, reviewer: context.review.reviewer, reviewedAt: context.review.reviewedAt,
    verifier: context.review.verifier, verifiedAt: context.review.verifiedAt, verificationResult: context.review.verificationResult,
  };
  const template = await readFile(path.join(process.cwd(), "templates", "FGPC-008-01-application-review-kr.docx"));
  const zip = new PizZip(template);
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) { let content = zip.file(fileName)?.asText(); if (!content) continue; for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value)); zip.file(fileName, content); }
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" }); const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Application_Review_KR.docx"` } });
}
