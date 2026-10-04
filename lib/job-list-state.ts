import type { CertificationState } from "@/types/certification";
export type JobListCertificationState = CertificationState | "UNKNOWN";
export function recordedJobCertificationState(value: unknown): JobListCertificationState {
  return typeof value === "string" && ["ACTIVE", "SUSPENDED", "WITHDRAWN", "NONE"].includes(value) ? value as CertificationState : "UNKNOWN";
}
