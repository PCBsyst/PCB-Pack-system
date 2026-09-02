import type { ApplicationStatus } from "@/types/certification";
import { applicationStatusLabels } from "@/data/workflow-data";

const styles: Record<ApplicationStatus, string> = {
  INTAKE_REVIEW: "bg-slate-100 text-slate-700",
  DOCUMENT_REVIEW: "bg-blue-50 text-blue-800",
  SUPPLEMENT_PENDING: "bg-orange-50 text-orange-800",
  INVOICE_PENDING: "bg-cyan-50 text-cyan-800",
  PAYMENT_PENDING: "bg-yellow-50 text-yellow-800",
  DECISION_PENDING: "bg-amber-50 text-amber-800",
  PARTIALLY_COMPLETED: "bg-violet-50 text-violet-800",
  COMPLETED: "bg-emerald-50 text-emerald-800",
  CANCELLED: "bg-rose-50 text-rose-800",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{applicationStatusLabels[status]}</span>;
}
