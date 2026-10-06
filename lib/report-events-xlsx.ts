import { createReportXlsx } from "@/lib/report-xlsx";
import { isReportPeriod } from "@/lib/report-analytics";

type EventSummary = { period: string; suspended: { customers: number; events: number }; withdrawn: { customers: number; events: number } };
export function buildEventReportXlsx(metadata: string[][], rows: EventSummary[], ready: boolean): Blob {
  if (!ready || !rows.length || rows.length > 60 || new Set(rows.map(row => row.period)).size !== rows.length) throw new Error("상태변동 자료와 기간을 확인한 뒤 Excel을 생성해 주세요.");
  for (const row of rows) {
    if (!isReportPeriod(row.period)) throw new Error("상태변동 기간이 올바르지 않습니다.");
    for (const count of [row.suspended, row.withdrawn]) {
      if (!count || !Number.isSafeInteger(count.customers) || !Number.isSafeInteger(count.events) || count.customers < 0 || count.events < count.customers) throw new Error("상태변동 고객 수와 처리 건수가 올바르지 않습니다.");
    }
  }
  return createReportXlsx([
    { name: "조회 조건", widths: [30, 90], rows: [["항목", "내용"], ...metadata,
      ["기간 기준", "상태 적용일. 접수일·인증발행일과 별개이며 미래 적용일 기록도 해당 기간에 포함"],
      ["고객 수", "기간·상태별 후보자 ID 중복 제거. 여러 기간이나 상태의 고객 수를 더하면 중복될 수 있음"],
      ["처리 건수", "기록된 정지·철회 처리 수. 같은 고객의 여러 Job 또는 반복 처리도 각각 집계"],
      ["자료 범위", "현재 필터에 해당하는 Job. 과거 월말 유지 고객 수 또는 전체 상태변동 이력의 복원이 아님"],
      ["포함 범위", "고객명·연락처·Job/인증번호 원문 제외. 파트너사 등 조회 조건은 포함"],
      ["자료 기준", "현재 조회 자료의 고정 집계. 서버 접근이력 및 PC 저장 완료 기록은 남기지 않음"]] },
    { name: "정지 및 철회", widths: [24, 22, 22, 22, 22], filter: true, rows: [["상태 적용 기간", "정지 고객 수", "정지 처리 건수", "철회 고객 수", "철회 처리 건수"], ...rows.map(row => [row.period, row.suspended.customers, row.suspended.events, row.withdrawn.customers, row.withdrawn.events])] },
  ]);
}
