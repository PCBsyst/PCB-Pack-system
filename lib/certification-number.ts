import type { Job } from "@/types/certification";
import { getNumberingRule, gradeCodes, numberingRules, type NumberingScheme, type NumberingRule } from "@/lib/numbering-rules";
import type { AccreditationTrack, BusinessArea } from "@/types/certification";

export const certificationStandardCodes: Record<string, string> = Object.fromEntries(numberingRules.filter((rule) => rule.businessArea === "ISO" && rule.scheme === "IAS").map((rule) => [rule.field, rule.certificateCode]));

export const certificationGradeCodes = gradeCodes;

export function getCertificationNumberPrefix(area: BusinessArea, scheme: NumberingScheme, track: AccreditationTrack, standard: string, grade: string, issueDate: string, catalog: NumberingRule[] = numberingRules) {
  const year = issueDate.slice(2, 4);
  const rule = getNumberingRule(area, scheme, track, standard, catalog);
  const gradeCode = certificationGradeCodes[grade];
  if (!/^\d{2}$/.test(year) || !rule?.verified || !rule.certificateCode || !gradeCode) return "";
  if (area === "K_BEAUTY") return scheme === "PJLA" ? `KB-${year}-${rule.certificateCode}${gradeCode}` : `KB-${year}${rule.certificateCode}${gradeCode}`;
  return scheme === "PJLA" ? `${year}-${rule.certificateCode}${gradeCode}` : `${year}${rule.certificateCode}${gradeCode}`;
}

export function getCertificationNumber(standard: string, grade: string, issueDate: string, existingJobs: Job[]) {
  const year = issueDate.slice(2, 4);
  const standardCode = certificationStandardCodes[standard];
  const gradeCode = certificationGradeCodes[grade];
  if (!/^\d{2}$/.test(year) || !standardCode || !gradeCode) return "";

  const lastSequence = existingJobs
    .filter((job) => job.standard === standard && certificationGradeCodes[job.currentGrade] === gradeCode)
    .map((job) => (job.certificationNo ?? "").replace(/\D/g, ""))
    .filter((number) => number.length === 8 && number[2] === standardCode && number[3] === gradeCode)
    .map((number) => Number(number.slice(4)))
    .filter(Number.isFinite)
    .reduce((maximum, sequence) => Math.max(maximum, sequence), 0);

  return lastSequence >= 9999 ? "" : `${year}${standardCode}${gradeCode}${String(lastSequence + 1).padStart(4, "0")}`;
}
