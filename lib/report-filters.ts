export type ReportFilters = { area: string; standard: string; partner: string; grade: string; applicationType: string };
export function matchesReportFilters(row: { businessArea: string; standard: string; partner: string; grade: string; applicationType: string }, filters: ReportFilters) {
  return (filters.area === "전체" || row.businessArea === filters.area)
    && (filters.standard === "전체" || row.standard === filters.standard)
    && (filters.partner === "전체" || row.partner === filters.partner)
    && (filters.grade === "전체" || row.grade === filters.grade)
    && (filters.applicationType === "전체" || row.applicationType === filters.applicationType);
}
