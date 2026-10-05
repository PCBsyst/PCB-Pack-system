import PizZip from "pizzip";
import { missingDocumentTemplateFields, documentTemplateFieldsError } from "@/lib/document-template-fields";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { documentTranslationIssues, documentTranslationMessage } from "@/lib/document-translation-checks";
import { documentChoice, documentLanguageValues } from "@/lib/document-language-values";
import { documentTrainingSummary } from "@/lib/document-training-summary";
import { docxOutputHeaders } from "@/lib/server/docx-response-headers";
import { validateGeneratedDocx, invalidDocxResponse } from "@/lib/docx-output-validation";
import { loadDocumentTemplate, templateLoadErrorResponse } from "@/lib/server/document-template-loader";
import { templateProvenanceHeaders } from "@/lib/template-provenance";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { readValidatedDocumentRequest } from "@/lib/server/document-request-validation";

function xml(value: unknown) { return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;").replace(/\r\n|\r|\n/g, '</w:t><w:br/><w:t xml:space="preserve">'); }

export async function POST(request: Request) {
  return privateDocumentResponse(await createDocumentResponse(request));
}

async function createDocumentResponse(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (authError) return authError;
  const parsed = await readValidatedDocumentRequest(request, "KR");
  if (!parsed.ok) return parsed.response;
  const { context, job, language } = parsed.input;
  if (language === "EN") {
    const issues = documentTranslationIssues(context, [job.id], ["APPLICATION_REVIEW"]);
    if (issues.length) return Response.json({ error: documentTranslationMessage(issues) }, { status: 422 });
  }
  const localized = documentLanguageValues(context, job.id, language);
  const records = context.deliveryDocuments[job.id];
  const mark = (key: keyof typeof records) => records?.[key]?.applicability === "NOT_APPLICABLE" ? "해당 없음" : records?.[key]?.received ? "■" : "□";
  const reviewComment = [localized.requirementSummary, documentTrainingSummary(context.examSchedules?.[job.id], language), localized.reviewComment, localized.verificationComment].filter(Boolean).join("\n");
  const values: Record<string, unknown> = {
    jobNo: job.jobNo, candidateName: localized.candidateName, candidateNameEn: context.candidate.nameEn,
    birthDate: context.candidate.birthDate, nationality: context.candidate.nationality, address: context.candidate.address,
    email: context.candidate.email, phone: context.candidate.phone, initialMark: context.application.applicationType === "최초" ? "☒" : "☐",
    renewalMark: context.application.applicationType === "갱신" ? "☒" : "☐", standard: job.standard, grade: documentChoice(job.currentGrade, language),
    specialRequirements: context.application.applicationType === "최초" || context.application.applicationType === "갱신" ? "없음" : `신청구분: ${context.application.applicationType}`,
    academicDocumentMark: mark("diploma"), careerDocumentMark: mark("career"), educationDocumentMark: mark("education"),
    auditLogDocumentMark: mark("auditLog"), otherDocumentMark: records ? mark("agreement") : "□", receivedAt: context.application.receivedAt,
    reviewResult: documentChoice(context.review.result, language), reviewComment, reviewer: context.review.reviewer, reviewedAt: context.review.reviewedAt,
    verifier: context.review.verifier, verifiedAt: context.review.verifiedAt, verificationResult: documentChoice(context.review.verificationResult, language),
  };
  let template;
  try { template = await loadDocumentTemplate("APPLICATION_REVIEW", language, language === "KR" ? "FGPC-008-01-application-review-kr.docx" : undefined); }
  catch { return templateLoadErrorResponse(); }
  let zip;
  try { zip = new PizZip(template.bytes); }
  catch { return invalidDocxResponse(); }
  const missingFields = missingDocumentTemplateFields(zip, "APPLICATION_REVIEW");
  if (missingFields.length) return documentTemplateFieldsError(missingFields);
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) { let content = zip.file(fileName)?.asText(); if (!content) continue; for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value)); zip.file(fileName, content); }
  if (!validateGeneratedDocx(zip)) return invalidDocxResponse();
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" }); const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  const accessError = await recordDocumentResponse("job", job.id, `APPLICATION_REVIEW:${language}`);
  if (accessError) return accessError;
  return new Response(body, { headers: { ...templateProvenanceHeaders(template), ...docxOutputHeaders(output), "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Application_Review_${language}.docx"` } });
}
