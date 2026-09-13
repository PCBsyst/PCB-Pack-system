import type { Job } from "@/types/certification";

export const certificationStandardCodes: Record<string, string> = {
  "ISO 9001": "1",
  "ISO 13485": "2",
  "ISO 14001": "3",
  "ISO 45001": "4",
  "ISO 22000": "5",
  "ISO 22301": "6",
  "ISO/IEC 27001": "7",
};

export const certificationGradeCodes: Record<string, string> = {
  "심사원보": "1",
  "Provisional Auditor": "1",
  "내부심사원": "2",
  "Internal Auditor": "2",
  "심사원": "3",
  "Auditor": "3",
  "선임심사원": "4",
  "Lead Auditor": "4",
  "검증심사원": "5",
  "Verification Auditor": "5",
};

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
