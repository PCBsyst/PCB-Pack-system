export type AnalyticsJob = { jobId: string; candidateId: string; businessArea: string; standard: string; grade: string; applicationType: string; receivedAt: string; certificationState: string };
export type RevenueInvoice = { id: string; amount: number; paid_amount: number | null; issued_at: string; paid_at: string | null; invoice_jobs: { job_id: string }[] };
export function revenueForJobs(invoices: RevenueInvoice[], ids: Set<string>, period: string) {
  let billed = 0, received = 0;
  for (const invoice of invoices) {
    const all = [...new Set(invoice.invoice_jobs.map((item) => item.job_id))];
    if (!all.length) continue;
    const share = all.filter((id) => ids.has(id)).length / all.length;
    if (invoice.issued_at?.startsWith(period)) billed += Number(invoice.amount) * share;
    if (invoice.paid_at?.startsWith(period)) received += Number(invoice.paid_amount ?? 0) * share;
  }
  return { billed, received };
}
export function customerCounts(jobs: AnalyticsJob[]) {
  const count = (state?: string) => new Set(jobs.filter((job) => !state || job.certificationState === state).map((job) => job.candidateId)).size;
  return { total: count(), active: count("ACTIVE"), suspended: count("SUSPENDED"), withdrawn: count("WITHDRAWN") };
}
