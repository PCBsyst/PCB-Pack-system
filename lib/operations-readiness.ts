export type ReadinessStatus = "READABLE" | "PENDING" | "ERROR" | "UNTESTED";
export type ReadinessResult = { id: string; status: ReadinessStatus; detail: string };
export const databaseReadinessChecks = [
  { id: "accounts", label: "최고관리자·계정 승인", table: "profiles", columns: "id,active,is_owner", migration: "016" },
  { id: "privacy", label: "개인정보 접근이력", table: "privacy_access_logs", columns: "id,actor_id,occurred_at", migration: "018" },
  { id: "archive", label: "후보자 보관 상태", table: "candidates", columns: "id,archived_at,archived_by,archive_reason", migration: "019" },
  { id: "concurrency", label: "후보자 동시 저장 버전", table: "candidates", columns: "id,row_version", migration: "024" },
  { id: "features", label: "부가 기능 설정", table: "feature_controls", columns: "id,enabled,updated_at", migration: "021" },
  { id: "receipts", label: "서버 패키지 생성기록", table: "package_generation_receipts", columns: "id,actor_id,occurred_at,sha256,documents", migration: "022" },
] as const;

export const manualReadinessChecks = [
  { label: "실제 업무 흐름", detail: "신규 샘플 → 서류검토 → 입금 → 심의 → 발행 → 패키지 → 새로고침 유지 시험" },
  { label: "권한·삭제·동시 편집", detail: "최고관리자/서브 관리자/실무자별 RPC 및 직접 DB 요청 거절 시험. SQL 020 삭제 제한 포함" },
  { label: "MFA·서버 세션 만료", detail: "브라우저 타이머와 별개로 서버 강제 만료·MFA·신뢰 기기·복구 절차 구축/검증 필요" },
  { label: "백업·복원·실패 알림", detail: "실제 자동백업 실행·외부 보관·메일 알림·복원 시험 필요. 설정 문서만으로 백업 중이라고 판단하지 않음" },
  { label: "공식 양식·PDF", detail: "국문/영문 양식과 내용 대조, PDF 실제 저장 검증. 인쇄창 열기는 저장 완료가 아님" },
  { label: "배포·기존 기록 이관", detail: "최신 코드 배포 확인, 원본 대비 누락/중복/번호 규칙 검증 후 이관 승인" },
] as const;

export function classifyReadinessError(error: { code?: string; message?: string } | null): ReadinessStatus {
  if (!error) return "READABLE";
  return ["42P01", "42703", "PGRST205", "PGRST204"].includes(error.code ?? "") ? "PENDING" : "ERROR";
}

export function readinessSummary(results: ReadinessResult[]) {
  return { readable: results.filter((item) => item.status === "READABLE").length, pending: results.filter((item) => item.status === "PENDING").length, error: results.filter((item) => item.status === "ERROR").length };
}
