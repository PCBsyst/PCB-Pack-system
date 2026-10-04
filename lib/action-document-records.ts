export type ActionDocumentInput = { kind: "REPORT" | "LETTER"; jobId: string; actionId: string };
export type ActionDocumentValues = { kind: "REPORT" | "LETTER"; jobNo: string; managementNo: number; candidateName: string; candidateContact: string; certificationNo: string; certificationIssueDate: string; actionType: "SUSPENDED" | "WITHDRAWN"; standardReason: string; detailReason: string; effectiveDate: string; actor: string; recordedAt: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value.length <= 10000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);

export function validateActionDocumentInput(value: unknown): value is ActionDocumentInput {
  return record(value) && (value.kind === "REPORT" || value.kind === "LETTER") && uuid(value.jobId) && uuid(value.actionId);
}

/** Uses the certificate referenced by the action, not the Job's latest certificate. */
export function actionDocumentFromRecords(input: ActionDocumentInput, action: unknown, job: unknown, certificate: unknown, candidate: unknown): ActionDocumentValues | null {
  if (!record(action) || !record(job) || !record(certificate) || !record(candidate)
    || action.id !== input.actionId || action.job_id !== input.jobId || job.id !== input.jobId
    || certificate.id !== action.certification_record_id || certificate.job_id !== job.id || candidate.id !== job.candidate_id
    || (action.action_type !== "SUSPENDED" && action.action_type !== "WITHDRAWN")
    || !text(job.job_no) || !Number.isSafeInteger(job.management_no) || Number(job.management_no) < 0
    || !text(candidate.name) || !text(certificate.certification_no) || !text(certificate.issue_date)
    || !text(action.standard_reason) || !text(action.detail_reason) || !text(action.effective_date)
    || !text(action.recorded_by_name) || !text(action.created_at)) return null;
  return { kind: input.kind, jobNo: job.job_no, managementNo: Number(job.management_no), candidateName: candidate.name,
    candidateContact: "후보자 상세정보 참조", certificationNo: certificate.certification_no, certificationIssueDate: certificate.issue_date,
    actionType: action.action_type, standardReason: action.standard_reason, detailReason: action.detail_reason,
    effectiveDate: action.effective_date, actor: action.recorded_by_name, recordedAt: action.created_at };
}
