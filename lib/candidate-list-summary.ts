import type { PrototypeApplicationRecord } from "@/lib/prototype-storage";
export function candidateRecordSummary(records: PrototypeApplicationRecord[]) {
  const unique = [...new Map(records.map((record) => [record.jobId ?? `${record.id}:${record.jobNo}`, record])).values()];
  const active = unique.some((record) => record.certificationState === "ACTIVE");
  const unknown = unique.some((record) => !["ACTIVE", "SUSPENDED", "WITHDRAWN", "NONE"].includes(record.certificationState ?? ""));
  return { records: unique, applications: new Set(unique.map((record) => record.id)).size, jobs: unique.length,
    certification: active ? "ACTIVE" : unknown ? "UNKNOWN" : "NO_ACTIVE" };
}
