import type { DocumentLanguage, PackageContext } from "@/lib/prototype-package";

const english: Record<string, string> = {
  "충족": "Met", "미충족": "Not met", "해당없음": "Not applicable", "해당 없음": "Not applicable",
  "적합": "Conforming", "부적합": "Nonconforming", "보완필요": "Supplement required",
  "확인": "Confirmed", "재검토요청": "Re-review requested", "승인": "Approved", "불승인": "Not approved", "재승인": "Reapproved",
  "교육요건": "Education requirements", "학력요건": "Academic requirements", "업무경력요건": "Work experience requirements", "심사·실무경력요건": "Audit and practical experience requirements",
  "심사원보": "Provisional auditor", "내부심사원": "Internal auditor", "심사원": "Auditor", "선임심사원": "Lead auditor", "검증심사원": "Verification auditor",
  "최초": "Initial", "갱신": "Renewal", "전환": "Transfer", "없음": "None",
};

/** Translate known fixed choices only; never machine-translate names or free text. */
export function documentChoice(value: string | undefined, language: DocumentLanguage): string {
  return value ? language === "EN" ? english[value] ?? value : value : "-";
}

export function documentLanguageValues(context: PackageContext, jobId: string, language: DocumentLanguage) {
  const isEnglish = language === "EN";
  const reviewComment = isEnglish ? context.englishText?.reviewComment ?? "" : context.review.comment;
  const verificationComment = isEnglish ? context.englishText?.verificationComment ?? "" : context.review.verificationComment;
  const panel = context.panelMembers.filter((member) => member.selected);
  return {
    candidateName: isEnglish ? context.candidate.nameEn || context.candidate.name : context.candidate.name,
    requirementSummary: Object.entries(context.reviewRequirements ?? {}).map(([item, result]) => `${documentChoice(item, language)}: ${documentChoice(result, language)}`).join(" / "),
    reviewComment,
    verificationComment: verificationComment ? `${isEnglish ? "Secondary verification" : "2차 검증"}: ${verificationComment}` : "",
    panelMembers: panel.map((member) => `${member.name} (${documentChoice(member.decision, language)})`).join(", "),
    panelComments: panel.map((member) => `${member.name}: ${(isEnglish ? context.englishText?.panelComments?.[member.name] : member.comment) || "-"}`).join(" / "),
    finalApprovalComment: (isEnglish ? context.englishText?.decisionComments?.[jobId] : context.decisions[jobId]?.comment) || "-",
  };
}
