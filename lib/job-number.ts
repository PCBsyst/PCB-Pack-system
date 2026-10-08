import type { Job } from "@/types/certification";
import type { AccreditationTrack, BusinessArea } from "@/types/certification";
import { getNumberingRule, numberingRules, type NumberingScheme, type NumberingRule } from "@/lib/numbering-rules";

export const isoStandardCodes: Record<string, string> = Object.fromEntries(numberingRules.filter((rule) => rule.businessArea === "ISO" && rule.scheme === "IAS").map((rule) => [rule.field, rule.jobPrefix]));

export function getJobNumber(area: BusinessArea, scheme: NumberingScheme, track: AccreditationTrack, field: string, receivedAt: string, existingJobs: Pick<Job, "jobNo">[], catalog: NumberingRule[] = numberingRules) {
  const rule = getNumberingRule(area, scheme, track, field, catalog);
  const year = receivedAt.slice(2, 4);
  if (!rule?.verified || !/^\d{2}$/.test(year)) return "";
  const prefix = `${rule.jobPrefix}${year}`;
  const lastSequence = existingJobs
    .map((job) => job.jobNo.replace(/-/g, ""))
    .map((jobNo) => ({ raw: jobNo, comparablePrefix: prefix.replace(/-/g, "") }))
    .filter(({ raw, comparablePrefix }) => raw.startsWith(comparablePrefix))
    .map(({ raw, comparablePrefix }) => raw.slice(comparablePrefix.length))
    .filter(sequence => /^\d{4,}$/.test(sequence))
    .map(Number)
    .filter(Number.isFinite)
    .reduce((maximum, sequence) => Math.max(maximum, sequence), 0);
  return lastSequence >= 9999 ? "" : `${rule.jobPrefix}${year}${String(lastSequence + 1).padStart(4, "0")}`;
}

export function getIsoJobNumber(standard: string, receivedAt: string, existingJobs: Job[]) {
  return getJobNumber("ISO", "IAS", "ACCREDITED", standard, receivedAt, existingJobs);
}
