export function workflowAmount(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= Number.MAX_SAFE_INTEGER ? amount : null;
}
export function hasExactAffectedIds(rows: unknown, expected: string[]): boolean {
  if (!expected.length || new Set(expected).size !== expected.length || !Array.isArray(rows) || rows.length !== expected.length) return false;
  const ids = rows.map(row => row && typeof row === "object" ? row.id : undefined);
  return new Set(ids).size === expected.length && expected.every(id => ids.includes(id));
}
export function isConfirmedInvoice(value: unknown): value is { id: string; amount: number | string; paid_amount: number | string; paid_at: string; issued_at: string; payer_name: string; confirmed_by: string; recipient_type: "INDIVIDUAL" | "PARTNER"; recipient_name: string; payment_status: "PAID" } {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  const text = (v: unknown) => typeof v === "string" && !!v.trim();
  const amount = workflowAmount(String(row.amount)), paid = workflowAmount(String(row.paid_amount));
  return row.payment_status === "PAID" && text(row.id) && amount !== null && paid !== null && paid >= amount && date(row.paid_at) && date(row.issued_at) && text(row.payer_name) && text(row.confirmed_by) && text(row.recipient_name) && (row.recipient_type === "INDIVIDUAL" || row.recipient_type === "PARTNER");
}
