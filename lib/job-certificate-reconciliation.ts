export type RegistryCertificate = { id: string; job_id: string; certification_no: string; issue_date: string; valid_until: string };
export type WorkflowCertificate = { certificationNo?: string; issueDate?: string; expiryDate?: string };
export type ReconciliationStatus = "MATCH" | "MISMATCH" | "REGISTRY_ONLY" | "WORKFLOW_ONLY" | "EMPTY" | "UNVERIFIED" | "AMBIGUOUS";
export const reconciliationLabels: Record<ReconciliationStatus, string> = { MATCH: "원장·입력 일치", MISMATCH: "원장·입력 불일치", REGISTRY_ONLY: "원장만 기록", WORKFLOW_ONLY: "업무 입력만 기록", EMPTY: "발행 기록 없음", UNVERIFIED: "원장 조회 미확인", AMBIGUOUS: "현재 원장 복수 · 확인 필요" };
export function reconcileJobCertificate(jobId: string, workflow: WorkflowCertificate | undefined, rows: RegistryCertificate[], loaded: boolean) {
  const current = rows.filter((row) => row.job_id === jobId);
  const fields = ["certificationNo", "issueDate", "expiryDate"] as const;
  const input = (key: typeof fields[number]) => typeof workflow?.[key] === "string" ? workflow[key].trim() : "";
  const hasInput = fields.some((key) => Boolean(input(key)));
  if (!loaded) return { status: "UNVERIFIED" as ReconciliationStatus, certificate: undefined, differences: [] as string[] };
  if (current.length > 1) return { status: "AMBIGUOUS" as ReconciliationStatus, certificate: undefined, differences: [] as string[] };
  if (!current.length) return { status: (hasInput ? "WORKFLOW_ONLY" : "EMPTY") as ReconciliationStatus, certificate: undefined, differences: [] as string[] };
  const certificate = { certificationNo: current[0].certification_no, issueDate: current[0].issue_date, expiryDate: current[0].valid_until };
  const labels = { certificationNo: "인증번호", issueDate: "발행일", expiryDate: "만료일" };
  const differences = hasInput ? fields.filter((key) => input(key) !== certificate[key]).map((key) => labels[key]) : [];
  return { status: (!hasInput ? "REGISTRY_ONLY" : differences.length ? "MISMATCH" : "MATCH") as ReconciliationStatus, certificate, differences };
}
