export type PaymentInvoice = { id: string; invoice_no: string; recipient_name: string; amount: number; paid_amount: number | null; issued_at: string; paid_at: string | null; payment_status: string; invoice_jobs: { job_id: string }[] };
export function paymentQueueItem(invoice: PaymentInvoice) {
  const billed = Number(invoice.amount);
  const paid = Number(invoice.paid_amount ?? 0);
  const outstanding = Math.max(0, billed - paid);
  const inconsistent = invoice.payment_status === "PAID" && (outstanding > 0 || !invoice.paid_at);
  const needsConfirmation = inconsistent || invoice.payment_status === "CHECK_REQUIRED" || (invoice.payment_status !== "PAID" && paid > 0);
  return { invoice, outstanding, needsConfirmation, pending: invoice.payment_status !== "PAID" || inconsistent };
}
