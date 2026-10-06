import { createReportXlsx } from "@/lib/report-xlsx";
import { reportGroupLabel } from "@/lib/report-export";

type Group = { name: string; total: number; jobs: number; active: number; suspended: number; withdrawn: number; billed: number; received: number };
type Trend = { period: string; total: number; active: number; suspended: number; withdrawn: number };
export function buildBusinessReportXlsx(input: { metadata: string[][]; dimension: string; groups: Group[]; trends: Trend[]; financeReady: boolean }): Blob {
  if (!input.financeReady) throw new Error("수익 자료를 확인한 뒤 Excel을 생성해 주세요. 미확인 금액은 0원으로 내보내지 않습니다.");
  if (!input.groups.length || input.groups.length > 5000 || input.trends.length > 60) throw new Error("분석 Excel의 집계 범위를 확인해 주세요.");
  for (const row of [...input.groups, ...input.trends]) {
    for (const [key, value] of Object.entries(row)) if (typeof value === "number" && (!Number.isFinite(value) || value < 0 || (!["billed", "received"].includes(key) && !Number.isSafeInteger(value)))) throw new Error("분석 Excel의 숫자를 확인하지 못했습니다.");
  }
  return createReportXlsx([
    { name: "조회 조건", widths: [30, 90], rows: [["항목", "내용"], ...input.metadata,
      ["금액 기준", "청구는 인보이스 발행월, 입금은 실제 입금월. 고객 접수·발행 기간과 별개"],
      ["배분 기준", "통합 인보이스 금액을 전체 연결 Job에 균등 배분한 참고값. 회계상 확정 수익 아님"],
      ["표시 단위", "금액은 KRW. 화면과 동일하게 각 집계 행을 원 단위로 반올림하므로 행 합계는 원본 금액과 다를 수 있음"],
      ["고객 수", "후보자 ID별 중복 제거. 같은 후보자가 여러 행에 포함되므로 행 합계는 고유 고객 수와 다를 수 있음"],
      ["추이 기준", "접수 기간별 고객의 현재 인증상태. 과거 월말·연말 상태 또는 정지·철회 발생 건수가 아님"],
      ["포함 범위", "고객명·연락처·인증번호·인보이스 번호 제외. 파트너 등 조회 조건은 포함"],
      ["자료 기준", "현재 조회 자료의 고정 집계. 서버 접근이력 및 PC 저장 완료 기록이 아님"]] },
    { name: "고객 및 수익", widths: [35, 20, 18, 18, 18, 18, 26, 26], filter: true,
      rows: [["구분", "고객 수", "Job 수", "현재 유지", "현재 정지", "현재 철회", "청구액(KRW, 참고)", "입금액(KRW, 참고)"],
        ...input.groups.map(row => [reportGroupLabel(row.name, input.dimension), row.total, row.jobs, row.active, row.suspended, row.withdrawn, Math.round(row.billed), Math.round(row.received)])] },
    { name: "고객 추이", widths: [22, 20, 20, 20, 20], filter: true,
      rows: [["접수 기간", "고객 수", "현재 유지", "현재 정지", "현재 철회"], ...input.trends.map(row => [row.period, row.total, row.active, row.suspended, row.withdrawn])] },
  ]);
}
