import type { DemoDeliveryDocuments, DeliveryDocumentKey } from "@/lib/prototype-package";

export type PackageDocumentIssue = { jobId: string; key: DeliveryDocumentKey; label: string; reason: string };
export function packageDocumentIssues(jobs: { id: string }[], records: DemoDeliveryDocuments, rows: { key: DeliveryDocumentKey; document: string }[]): PackageDocumentIssue[] {
  return jobs.flatMap((job) => rows.flatMap((row) => {
    const record = records[job.id]?.[row.key];
    if (!record || !["REQUIRED", "CONDITIONAL", "NOT_APPLICABLE"].includes(record.applicability)) return [{ jobId: job.id, key: row.key, label: row.document, reason: "적용 기준 확인 필요" }];
    if (record.applicability === "NOT_APPLICABLE" || (record.applicability === "CONDITIONAL" && !record.received)) return [];
    const missing = [!record.received && "확인 여부", !record.date?.trim() && "날짜"].filter(Boolean);
    return missing.length ? [{ jobId: job.id, key: row.key, label: row.document, reason: `${missing.join("·")} 누락` }] : [];
  }));
}
