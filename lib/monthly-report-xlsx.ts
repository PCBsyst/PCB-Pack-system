import { createReportXlsx, type ReportSheet } from "@/lib/report-xlsx";
import { reportApplicationTypeLabel, reportGroupLabel } from "@/lib/report-export";

type SummaryRow = { businessArea: string; standard: string; grade: string; applicationType: string; certificationNo: string; certificationState: string };
export function buildMonthlySummaryXlsx(metadata: string[][], rows: SummaryRow[]): Blob {
  if (!rows.length || rows.length > 5000) throw new Error("Excel 집계 대상은 1~5,000개 Job이어야 합니다. 조회 조건을 좁혀 주세요.");
  const header = ["분야", "구분", "대상 Job", "인증번호 보유 Job", "현재 유지", "현재 정지", "현재 철회", "기타 상태"];
  const group = (dimension: "standard" | "grade" | "applicationType"): (string | number)[][] => {
    const result = new Map<string, { area: string; label: string; counts: number[] }>();
    for (const row of rows) {
      const key = JSON.stringify([row.businessArea, row[dimension]]);
      const value = result.get(key) ?? { area: reportGroupLabel(row.businessArea, "businessArea"), label: dimension === "applicationType" ? reportApplicationTypeLabel(row[dimension]) : row[dimension], counts: [0, 0, 0, 0, 0, 0] };
      value.counts[0]++;
      if (row.certificationNo) value.counts[1]++;
      const index = ({ ACTIVE: 2, SUSPENDED: 3, WITHDRAWN: 4 } as Record<string, number>)[row.certificationState] ?? 5;
      value.counts[index]++;
      result.set(key, value);
    }
    return [header, ...[...result.values()].sort((a, b) => a.area.localeCompare(b.area) || a.label.localeCompare(b.label)).map(value => [value.area, value.label, ...value.counts])];
  };
  const count = (state: string) => rows.filter(row => row.certificationState === state).length;
  const sheets: ReportSheet[] = [
    { name: "조회 조건", widths: [28, 90], rows: [["항목", "내용"], ...metadata, ["대상 단위", "후보자 수가 아닌 Job 수. 한 후보자가 여러 Job에 포함될 수 있음"], ["상태 기준", "조회 시점 현재 상태이며 과거 월말 상태의 복원이 아님"], ["인증번호 보유", "선택된 Job의 현재 인증번호 보유 여부. 해당 월 신규 발행 건수와 다를 수 있음"], ["포함 범위", "후보자명·연락처·Job 번호·인증번호 원문 제외. 파트너사 등 조회 조건은 포함"], ["자료 기준", "현재 화면에 조회된 자료의 고정 집계. 새로고침 시 자동 갱신되지 않음"], ["수익", "이 파일에는 수익 집계를 포함하지 않음"]] },
    { name: "전체 요약", widths: [32, 24], rows: [["지표", "Job 수"], ["대상 Job", rows.length], ["인증번호 보유 Job", rows.filter(row => row.certificationNo).length], ["현재 유지", count("ACTIVE")], ["현재 정지", count("SUSPENDED")], ["현재 철회", count("WITHDRAWN")], ["기타 상태", rows.length - count("ACTIVE") - count("SUSPENDED") - count("WITHDRAWN")]] },
    ...([ ["standard", "표준별 현황"], ["grade", "등급별 현황"], ["applicationType", "유형별 현황"] ] as const).map(([dimension, name]) => ({ name, widths: [20, 35, 17, 24, 17, 17, 17, 17], rows: group(dimension), filter: true })),
  ];
  return createReportXlsx(sheets);
}
