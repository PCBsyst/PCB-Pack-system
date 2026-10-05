export const operationOptions = [
  { id: "NOTIFICATIONS", label: "업무 알림 표시", detail: "업무 알림만 숨깁니다. 업무기록·보안 안내는 유지됩니다." },
  { id: "AUTOMATIC_DATES", label: "업무 날짜 자동 적용", detail: "신청 상세의 시험 일정·인증 발행에 따른 관련 날짜 계산을 중지합니다." },
  { id: "DOCUMENT_GENERATION", label: "서버 문서 생성", detail: "수동 Word 생성도 중지합니다. 문서 테스트가 필요하면 유지하세요." },
  { id: "PACKAGE_DOWNLOAD", label: "패키지 ZIP 다운로드", detail: "수동 ZIP 다운로드도 중지합니다. 기존 파일은 삭제하지 않습니다." },
  { id: "INVITATION_EMAIL", label: "직원 초대 이메일", detail: "초대 발송만 중지합니다. 계정 생성 테스트 중에는 유지하세요. 비밀번호 재설정 메일은 별도입니다." },
] as const;
export type OperationOption = typeof operationOptions[number]["id"];
export type OperationMode = { active: boolean; paused: OperationOption[]; endsOn: string | null; updatedAt: string };
export type OperationModeResult = { mode: "ready"; policy: OperationMode } | { mode: "legacy" | "unavailable" };
export function isOperationMode(value: unknown): value is OperationMode {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const validDate = typeof row.endsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.endsOn) && Number.isFinite(Date.parse(`${row.endsOn}T00:00:00Z`)) && new Date(`${row.endsOn}T00:00:00Z`).toISOString().slice(0,10) === row.endsOn;
  return typeof row.active === "boolean" && Array.isArray(row.paused) && row.paused.every(id => operationOptions.some(option => option.id === id))
    && new Set(row.paused).size === row.paused.length && (row.active ? validDate : row.endsOn === null && row.paused.length === 0)
    && typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt));
}
export async function readOperationMode(client: { rpc: (name: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }): Promise<OperationModeResult> {
  try {
    const {data,error}=await client.rpc("get_operation_mode");
    if(error) return error.code === "PGRST202" && error.message?.includes("get_operation_mode") ? {mode:"legacy"} : {mode:"unavailable"};
    return isOperationMode(data) ? {mode:"ready",policy:data} : {mode:"unavailable"};
  } catch { return {mode:"unavailable"}; }
}
export function isOperationPaused(result: OperationModeResult, key: OperationOption): boolean {
  // Unavailable configuration cannot authorize side effects. Missing migration keeps legacy behavior.
  return result.mode === "unavailable" || result.mode === "ready" && result.policy.active && result.policy.paused.includes(key);
}
