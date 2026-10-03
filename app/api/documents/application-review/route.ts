import PizZip from "pizzip";
import { loadDocumentTemplate } from "@/lib/server/document-template-loader";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import type { DocumentLanguage, PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

type RequestBody = { context: PackageContext; job: Job; language?: DocumentLanguage };
function xml(value: unknown) { return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }

export async function POST(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (authError) return authError;
  const { context, job, language = "KR" } = await request.json() as RequestBody;
  const records = context.deliveryDocuments[job.id];
  const mark = (key: keyof typeof records) => records?.[key]?.applicability === "NOT_APPLICABLE" ? "해당 없음" : records?.[key]?.received ? "■" : "□";
  const requirementSummary = Object.entries(context.reviewRequirements ?? {}).map(([item, result]) => `${item}: ${result}`).join(" / ");
  const reviewComment = [requirementSummary, context.review.comment, context.review.verificationComment ? `2차 검증: ${context.review.verificationComment}` : ""].filter(Boolean).join("\n");
  const values: Record<string, unknown> = {
    jobNo: job.jobNo, candidateName: context.candidate.name, candidateNameEn: context.candidate.nameEn,
    birthDate: context.candidate.birthDate, nationality: context.candidate.nationality, address: context.candidate.address,
    email: context.candidate.email, phone: context.candidate.phone, initialMark: context.application.applicationType === "최초" ? "☒" : "☐",
    renewalMark: context.application.applicationType === "갱신" ? "☒" : "☐", standard: job.standard, grade: job.currentGrade,
    specialRequirements: context.application.applicationType === "최초" || context.application.applicationType === "갱신" ? "없음" : `신청구분: ${context.application.applicationType}`,
    academicDocumentMark: mark("diploma"), careerDocumentMark: mark("career"), educationDocumentMark: mark("education"),
    auditLogDocumentMark: mark("auditLog"), otherDocumentMark: records ? mark("agreement") : "□", receivedAt: context.application.receivedAt,
    reviewResult: context.review.result, reviewComment, reviewer: context.review.reviewer, reviewedAt: context.review.reviewedAt,
    verifier: context.review.verifier, verifiedAt: context.review.verifiedAt, verificationResult: context.review.verificationResult,
  };
  const template = await loadDocumentTemplate("APPLICATION_REVIEW", language, language === "KR" ? "FGPC-008-01-application-review-kr.docx" : undefined);
  const zip = new PizZip(template.bytes);
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) { let content = zip.file(fileName)?.asText(); if (!content) continue; for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value)); zip.file(fileName, content); }
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" }); const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  const accessError = await recordDocumentResponse("job", job.id, `APPLICATION_REVIEW:${language}`);
  if (accessError) return accessError;
  return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Application_Review_${language}.docx"` } });
}
