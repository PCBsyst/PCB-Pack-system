import type { PackageContext } from "@/lib/prototype-package";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  if (!record(left) || !record(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

/** Compare document inputs only, not stage/UI flags or unselected Job records. */
export function matchesPackageWorkspace(context: PackageContext, jobIds: string[], state: unknown): boolean {
  if (!record(state)) return false;
  const globalKeys = ["reviewRequirements", "review", "invoiceNo", "invoiceAmount", "invoiceIssuedAt", "paidAmount",
    "paymentConfirmedAt", "panelMembers", "decisionDate", "finalApprover", "finalApprovalDate", "englishText"] as const;
  if (globalKeys.some((key) => !Object.hasOwn(state, key) || !equal(context[key], state[key]))) return false;
  for (const key of ["assessment", "decisions", "certificates", "deliveryDocuments"] as const) {
    const saved = state[key];
    if (!record(saved) || !record(context[key])) return false;
    if (jobIds.some((id) => !Object.hasOwn(saved, id) || !Object.hasOwn(context[key], id) || !equal(context[key][id], saved[id]))) return false;
  }
  if (context.examSchedules !== undefined || state.examSchedules !== undefined) {
    const saved = state.examSchedules;
    const requested = context.examSchedules;
    if (!record(saved) || !record(requested)) return false;
    if (jobIds.some((id) => !Object.hasOwn(saved, id) || !Object.hasOwn(requested, id) || !equal(requested[id], saved[id]))) return false;
  }
  return true;
}
