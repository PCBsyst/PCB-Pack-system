/** Exact counts detect common truncation/drift, not a transactional snapshot. */
export function verifyReportPage(page: { data: unknown; count?: number | null; error: unknown }, expected?: number): number {
  if (page.error || !Array.isArray(page.data) || page.data.length > 500 || !Number.isSafeInteger(page.count) || page.count! < 0 || page.count! > 10000 || (expected !== undefined && page.count !== expected)) throw new Error("보고서 조회 범위·행 수가 일치하지 않습니다. 부분 자료로 집계하지 않습니다.");
  return page.count!;
}
export function verifyReportTotal(rows: Array<{ id: string }>, expected: number): void {
  if (rows.some(row => !row || typeof row.id !== "string" || !row.id.trim()) || new Set(rows.map(row => row.id)).size !== expected) throw new Error("보고서 자료가 누락되거나 조회 중 변경되었습니다. 다시 조회해 주세요.");
}
