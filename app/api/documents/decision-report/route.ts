import PizZip from "pizzip";
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


function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function removeGradePlaceholder(content: string) {
  const start = content.indexOf("<w:t>항목을</w:t>");
  if (start < 0) return content;
  const end = content.indexOf("</w:p>", start);
  if (end < 0) return content;
  const segment = content.slice(start, end)
    .replace("<w:t>항목을</w:t>", "<w:t></w:t>")
    .replace('<w:t xml:space="preserve"> </w:t>', "<w:t></w:t>")
    .replace("<w:t>선택하세요</w:t>", "<w:t></w:t>")
    .replace("<w:t>.</w:t>", "<w:t></w:t>");
  return `${content.slice(0, start)}${segment}${content.slice(end)}`;
}

export async function POST(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (authError) return authError;
  const parsed = await readValidatedDocumentRequest(request, "KR");
  if (!parsed.ok) return parsed.response;
  const { context, job, language } = parsed.input;
  if (language === "EN") {
    const issues = documentTranslationIssues(context, [job.id], ["CERTIFICATION_DECISION_REPORT"]);
    if (issues.length) return Response.json({ error: documentTranslationMessage(issues) }, { status: 422 });
  }
  const localized = documentLanguageValues(context, job.id, language);
  const decision = context.decisions[job.id];
  const certificate = context.certificates[job.id];
  const assessment = context.assessment[job.id] ?? {};
  const values: Record<string, unknown> = {
    candidateName: localized.candidateName,
    jobNo: job.jobNo,
    standard: job.standard,
    grade: documentChoice(job.currentGrade, language),
    knowledge: documentChoice(assessment["지식 시험"], language),
    personality: documentChoice(assessment["인성 시험"], language),
    education: documentChoice(assessment["교육 요구사항"], language),
    academic: documentChoice(assessment["학력 요구사항"], language),
    auditExperience: documentChoice(assessment["심사이력"], language),
    assessmentComment: [localized.requirementSummary, documentTrainingSummary(context.examSchedules?.[job.id], language), localized.reviewComment, localized.verificationComment].filter(Boolean).join("\n"),
    approveMark: decision?.result === "승인" ? "■" : "□",
    rejectMark: decision?.result === "불승인" ? "■" : "□",
    reapproveMark: decision?.result === "재승인" ? "■" : "□",
    panelMembers: localized.panelMembers,
    decisionDate: context.decisionDate,
    decisionComment: localized.panelComments,
    finalApprovalComment: localized.finalApprovalComment,
    certificationNo: certificate?.certificationNo,
    validityPeriod: certificate ? `${certificate.issueDate} ~ ${certificate.expiryDate}` : "-",
    finalApprover: context.finalApprover,
    finalApprovalDate: context.finalApprovalDate,
  };

  let template;
  try { template = await loadDocumentTemplate("CERTIFICATION_DECISION_REPORT", language, language === "KR" ? "FGPC-012-01-decision-report-kr.docx" : undefined); }
  catch { return templateLoadErrorResponse(); }
  let zip;
  try { zip = new PizZip(template.bytes); }
  catch { return invalidDocxResponse(); }
  // 기존 양식은 승인 의견 칸이 없으므로 의견 영역에 역할을 구분하여 함께 기록합니다.
  // 전용 칸을 가진 신규 양식에서는 중복 출력하지 않습니다.
  const hasApprovalCommentField = Object.keys(zip.files).filter((name) => name.endsWith(".xml"))
    .some((name) => /\{\{finalApprovalComment\}\}/.test((zip.file(name)?.asText() ?? "").replace(/<[^>]*>/g, "")));
  if (!hasApprovalCommentField && localized.finalApprovalComment !== "-") {
    values.decisionComment = `${localized.panelComments}\n${language === "KR" ? "대표자 최종 승인 의견" : "Final approval comment"}: ${localized.finalApprovalComment}`;
  }
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;
    for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value));
    content = removeGradePlaceholder(content);
    zip.file(fileName, content);
  }
  if (!validateGeneratedDocx(zip)) return invalidDocxResponse();
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  const accessError = await recordDocumentResponse("job", job.id, `CERTIFICATION_DECISION_REPORT:${language}`);
  if (accessError) return accessError;
  return new Response(body, { headers: { ...templateProvenanceHeaders(template), ...docxOutputHeaders(output), "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Certification_Decision_Report_${language}.docx"` } });
}
