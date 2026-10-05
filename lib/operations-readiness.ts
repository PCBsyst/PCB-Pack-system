export type ReadinessStatus = "READABLE" | "PENDING" | "ERROR" | "UNTESTED";
export type ReadinessResult = { id: string; status: ReadinessStatus; detail: string };
export const databaseReadinessChecks = [
  { id: "accounts", label: "최고관리자·계정 승인", table: "profiles", columns: "id,active,is_owner", migration: "016" },
  { id: "privacy", label: "개인정보 접근이력", table: "privacy_access_logs", columns: "id,actor_id,occurred_at", migration: "018" },
  { id: "archive", label: "후보자 보관 상태", table: "candidates", columns: "id,archived_at,archived_by,archive_reason", migration: "019" },
  { id: "concurrency", label: "후보자 동시 저장 버전", table: "candidates", columns: "id,row_version", migration: "024" },
  { id: "features", label: "부가 기능 설정", table: "feature_controls", columns: "id,enabled,updated_at", migration: "021" },
  { id: "receipts", label: "서버 패키지 생성기록", table: "package_generation_receipts", columns: "id,actor_id,occurred_at,sha256,documents", migration: "022" },
  { id: "workspaces", label: "신청 업무값 저장", table: "application_workspaces", columns: "application_id,updated_at", migration: "003" },
  { id: "certificates", label: "인증서 원장·갱신 이력", table: "certification_records", columns: "id,job_id,history_state,issue_date", migration: "001·009" },
  { id: "templates", label: "문서 양식 등록", table: "document_templates", columns: "id", migration: "015" },
  { id: "imports", label: "이관 배치 검증 기록", table: "legacy_import_batches", columns: "id,verification_status,verified_at", migration: "013·014" },
] as const;

export const policyReadinessChecks = [
  { id: "mfaPolicy", label: "서버 MFA 정책", migration: "026" },
  { id: "operationMode", label: "이관·테스트 운영 모드", migration: "027" },
] as const;

type ProbeClient = {
  from: (table: string) => { select: (columns: string) => { limit: (count: number) => PromiseLike<{ error: { code?: string; message?: string } | null }> } };
  rpc: (name: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

/** 고객 행을 읽거나 설정을 변경하지 않는 구조·정책 확인. 운영 합격 판정은 아닙니다. */
export async function probeOperationsReadiness(client: ProbeClient): Promise<ReadinessResult[]> {
  const tables = await Promise.all(databaseReadinessChecks.map(async (item): Promise<ReadinessResult> => {
    try {
      const { error } = await client.from(item.table).select(item.columns).limit(0);
      const status = classifyReadinessError(error);
      return { id: item.id, status, detail: status === "READABLE" ? "테이블·열 조회 요청 성공. 실제 행 접근·저장·RLS·RPC 동작은 별도 검증입니다." : status === "PENDING" ? `SQL ${item.migration}와 실제 DB 구조를 확인하세요.` : "연결·권한·서비스 상태를 확인하세요." };
    } catch { return { id: item.id, status: "ERROR", detail: "조회 중 통신 오류가 발생했습니다. 재점검하세요." }; }
  }));
  const [mfa, mode] = await Promise.all([readMfaPolicy(client), readOperationMode(client)]);
  const policy = (id: string, state: "ready" | "legacy" | "unavailable", detail: string): ReadinessResult => ({ id, status: state === "ready" ? "READABLE" : state === "legacy" ? "PENDING" : "ERROR", detail: state === "ready" ? detail : state === "legacy" ? "정책 조회 함수가 없습니다. 해당 SQL 적용 상태를 확인하세요." : "정책을 확인하지 못했습니다. 정상 운영으로 간주하지 않습니다." });
  return [...tables,
    policy("mfaPolicy", mfa.mode, mfa.mode === "ready" ? `MFA ${mfa.policy.required ? "ON" : "OFF"}. 설정 조회만 확인했으며 실제 인증 차단 시험은 별도입니다.` : ""),
    policy("operationMode", mode.mode, mode.mode === "ready" ? mode.policy.active ? `테스트·이관 모드 ON · 일시 중지 ${mode.policy.paused.length}개 · 종료 예정 ${mode.policy.endsOn}. 자동 복구 보장은 아닙니다.` : "테스트·이관 모드 OFF. 기능별 개별 OFF 설정은 별도입니다." : ""),
  ];
}

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
import { readMfaPolicy } from "@/lib/mfa-requirement";
import { readOperationMode } from "@/lib/operation-mode";
