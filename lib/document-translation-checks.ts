import type { PackageContext } from "@/lib/prototype-package";
import type { CorporateDocumentType } from "@/lib/document-template-registry";

const nonblank = (value: unknown): boolean => typeof value === "string" && !!value.trim();

/** Only require counterparts for existing source comments in documents actually generated. */
export function documentTranslationIssues(context: PackageContext, jobIds: string[], types: CorporateDocumentType[]): string[] {
  const issues: string[] = [];
  if (types.includes("APPLICATION_REVIEW") || types.includes("CERTIFICATION_DECISION_REPORT")) {
    if (nonblank(context.review.comment) && !nonblank(context.englishText?.reviewComment)) issues.push("서류검토 의견 (영문)");
    if (nonblank(context.review.verificationComment) && !nonblank(context.englishText?.verificationComment)) issues.push("검증 의견 (영문)");
  }
  if (types.includes("CERTIFICATION_DECISION_REPORT")) {
    for (const member of context.panelMembers.filter((item) => item.selected)) {
      if (nonblank(member.comment) && !nonblank(context.englishText?.panelComments?.[member.name])) issues.push(`${member.name} 위원 의견 (영문)`);
    }
    for (const id of jobIds) {
      if (nonblank(context.decisions[id]?.comment) && !nonblank(context.englishText?.decisionComments?.[id])) {
        const job = context.jobs.find((item) => item.id === id);
        issues.push(`${job?.jobNo || id} 최종 승인 의견 (영문)`);
      }
    }
  }
  return [...new Set(issues)];
}

export function documentTranslationMessage(issues: string[]): string {
  return `영문 의견을 입력하고 저장한 뒤 다시 생성해 주세요: ${issues.join(" / ")}`;
}
