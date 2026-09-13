import type { Job } from "@/types/certification";
import { gradeCodes, numberingRules } from "@/lib/numbering-rules";

export const certificationStandardCodes: Record<string, string> = Object.fromEntries(numberingRules.filter((rule) => rule.businessArea === "ISO" && rule.scheme === "GPC").map((rule) => [rule.field, rule.certificateCode]));

export const certificationGradeCodes = gradeCodes;

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

  return `${year}${standardCode}${gradeCode}${String(lastSequence + 1).padStart(4, "0")}`;
}
