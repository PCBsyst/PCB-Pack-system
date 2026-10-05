import type { ReportFilters } from "@/lib/report-filters";

export function reportApplicationTypeLabel(value: string) {
  return ({ INITIAL: "최초", RENEWAL: "갱신", GRADE_CHANGE: "등급 변경", TRANSFER: "전환" } as Record<string, string>)[value] ?? value;
}
export function reportStateLabel(value: string) {
  return ({ ACTIVE: "인증 완료", SUSPENDED: "인증 정지", WITHDRAWN: "인증 철회", NONE: "미발행" } as Record<string, string>)[value] ?? value;
}
export function reportGroupLabel(value: string, dimension: string) {
  return dimension === "businessArea" && value === "K_BEAUTY" ? "K-Beauty"
    : dimension === "applicationType" ? reportApplicationTypeLabel(value) : value;
}
export function reportExportMetadata(title: string, period: string, dateBasis: string, filters?: ReportFilters, generatedAt = new Date()): string[][] {
  const rows = [["보고서", title], ["대상 기간", period], ["집계 기준", dateBasis],
    ["생성 시각(한국)", generatedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })]];
  if (filters) rows.push(["분야 필터", reportGroupLabel(filters.area, "businessArea")], ["표준·세부 분야 필터", filters.standard],
    ["파트너사 필터", filters.partner], ["등급 필터", filters.grade], ["신청 유형 필터", reportApplicationTypeLabel(filters.applicationType)],
    ["현재 인증상태 필터", reportStateLabel(filters.certificationState ?? "전체")]);
  return rows;
}
export function serializeReportCsv(rows: unknown[][]): string {
  const quote = (value: unknown) => {
    const text = String(value ?? "");
    const protectedText = /^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${protectedText.replaceAll('"', '""')}"`;
  };
  return rows.map((row) => row.map(quote).join(",")).join("\r\n");
}
