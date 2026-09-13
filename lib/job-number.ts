import type { Job } from "@/types/certification";

export const isoStandardCodes: Record<string, string> = {
  "ISO 9001": "QMS",
  "ISO 14001": "EMS",
  "ISO 45001": "OHS",
  "ISO/IEC 27001": "ISMS",
};

export function getIsoJobNumber(standard: string, receivedAt: string, existingJobs: Job[]) {
  const code = isoStandardCodes[standard];
  const year = receivedAt.slice(2, 4);
  if (!code || !/^\d{2}$/.test(year)) return "";
  const prefix = `${code}${year}`;
  const lastSequence = existingJobs
    .filter((job) => job.standard === standard)
    .map((job) => job.jobNo.replace(/-/g, ""))
    .filter((jobNo) => jobNo.startsWith(prefix))
    .map((jobNo) => Number(jobNo.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((maximum, sequence) => Math.max(maximum, sequence), 0);
  return `${prefix}${String(lastSequence + 1).padStart(4, "0")}`;
}
