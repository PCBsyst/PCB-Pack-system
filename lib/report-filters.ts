export type ReportFilters = { area: string; standard: string; partner: string; grade: string; applicationType: string };
export function matchesReportMonth(row: { receivedAt: string; issueDate?: string }, month: string, basis: "RECEIVED" | "ISSUED") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const date = basis === "RECEIVED" ? row.receivedAt : row.issueDate;
  return typeof date === "string" && date.startsWith(`${month}-`);
}
export function matchesReportFilters(row: { businessArea: string; standard: string; partner: string; grade: string; applicationType: string }, filters: ReportFilters) {
  return (filters.area === "전체" || row.businessArea === filters.area)
    && (filters.standard === "전체" || row.standard === filters.standard)
    && (filters.partner === "전체" || row.partner === filters.partner)
    && (filters.grade === "전체" || row.grade === filters.grade)
    && (filters.applicationType === "전체" || row.applicationType === filters.applicationType);
}
