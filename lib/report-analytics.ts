export type AnalyticsJob = { jobId: string; candidateId: string; businessArea: string; standard: string; grade: string; applicationType: string; receivedAt: string; issueDate?: string; certificationState: string };
export type RevenueInvoice = { id: string; amount: number; paid_amount: number | null; issued_at: string; paid_at: string | null; invoice_jobs: { job_id: string }[] };
export type CertificationEvent = { id: string; job_id: string; action_type: string; effective_date: string };
export function isCertificationEventRecord(value: unknown): value is CertificationEvent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.trim() || typeof row.job_id !== "string" || !row.job_id.trim()
    || !["SUSPENDED", "WITHDRAWN"].includes(String(row.action_type))
    || typeof row.effective_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.effective_date)) return false;
  const date = new Date(`${row.effective_date}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === row.effective_date;
}
export function isReportPeriod(period: string) {
  return /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(period);
}
export function matchesReportPeriod(date: string | null | undefined, period: string) {
  return isReportPeriod(period) && typeof date === "string"
    && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:$|T)/.test(date)
    && date.startsWith(`${period}-`);
}
export function certificationEventCounts(events: CertificationEvent[], jobs: AnalyticsJob[], period: string) {
  const candidates = new Map(jobs.map((job) => [job.jobId, job.candidateId]));
  const unique = [...new Map(events.map((event) => [event.id, event])).values()];
  const selected = unique.filter((event) => candidates.has(event.job_id) && matchesReportPeriod(event.effective_date, period));
  const count = (state: string) => {
    const matching = selected.filter((event) => event.action_type === state);
    return { events: matching.length, customers: new Set(matching.map((event) => candidates.get(event.job_id))).size };
  };
  return { suspended: count("SUSPENDED"), withdrawn: count("WITHDRAWN") };
}
export function revenueForJobs(invoices: RevenueInvoice[], ids: Set<string>, period: string) {
  let billed = 0, received = 0;
  for (const invoice of invoices) {
    const all = [...new Set(invoice.invoice_jobs.map((item) => item.job_id))];
    if (!all.length) continue;
    const share = all.filter((id) => ids.has(id)).length / all.length;
    if (matchesReportPeriod(invoice.issued_at, period)) billed += Number(invoice.amount) * share;
    if (matchesReportPeriod(invoice.paid_at, period)) received += Number(invoice.paid_amount ?? 0) * share;
  }
  return { billed, received };
}
export function customerCounts(jobs: AnalyticsJob[]) {
  const count = (state?: string) => new Set(jobs.filter((job) => !state || job.certificationState === state).map((job) => job.candidateId)).size;
  return { total: count(), active: count("ACTIVE"), suspended: count("SUSPENDED"), withdrawn: count("WITHDRAWN") };
}
