export type MonthlyReportRow = { applicationId: string; receivedAt: string; businessArea: string; partner: string; applicationType: string; jobId: string; jobNo: string; candidateName: string; standard: string; grade: string; certificationState: string; certificationNo: string; issueDate: string };
const relation = (value: unknown): Record<string, unknown>[] => value == null ? [] : (Array.isArray(value) ? value : [value]).map((row) => {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Invalid report relation");
  return row as Record<string, unknown>;
});
const text = (row: Record<string, unknown>, key: string, optional = false): string => {
  if (optional && row[key] == null) return "";
  if (typeof row[key] !== "string" || (!optional && !row[key].trim())) throw new Error("Invalid report field");
  return row[key];
};
export function selectCurrentReportCertification<T extends { history_state: unknown }>(value: T | T[] | null | undefined): T | undefined {
  const records = value == null ? [] : Array.isArray(value) ? value : [value];
  if (records.some(row => !row || typeof row !== "object" || Array.isArray(row) || typeof row.history_state !== "string")) throw new Error("인증기록 구성을 확인하지 못했습니다.");
  const current = records.filter(row => row.history_state === "CURRENT");
  if (current.length > 1) throw new Error("현재 인증기록이 여러 개입니다. 원장을 확인해 주세요.");
  return current[0];
}
export function normalizeMonthlyReportRecords(data: unknown): MonthlyReportRow[] {
  if (!Array.isArray(data)) throw new Error("Invalid report records");
  const rows = relation(data).flatMap((application) => relation(application.jobs).map((job) => {
    const candidate = relation(job.candidates)[0];
    if (!candidate) throw new Error("Candidate missing from report");
    const current = selectCurrentReportCertification(relation(job.certification_records).map(record => ({ ...record, history_state: record.history_state })));
    return { applicationId: text(application, "id"), receivedAt: text(application, "received_at"), businessArea: text(application, "business_area"),
      partner: text(application, "partner_name_snapshot", true), applicationType: text(application, "application_type"),
      jobId: text(job, "id"), jobNo: text(job, "job_no"), candidateName: text(candidate, "name"), standard: text(job, "standard"), grade: text(job, "grade"),
      certificationState: text(current ?? job, current ? "state" : "certification_state"),
      certificationNo: current ? text(current, "certification_no") : "", issueDate: current ? text(current, "issue_date") : "" };
  }));
  return [...new Map(rows.map((row) => [row.jobId, row])).values()];
}
