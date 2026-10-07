type RowPage<T> = { data: T[] | null; count: number | null; error: unknown };

/** Read ordered pages; stable counts and unique keys do not provide snapshot isolation. */
export async function readBoundedRows<T>(fetchPage: (from: number, to: number) => PromiseLike<RowPage<T>>, key: (row: T) => unknown, cancelled: () => boolean, maxRows = 10000): Promise<T[] | null> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let expected: number | undefined;
  for (let from = 0; ; from += 500) {
    if (cancelled()) return null;
    const page = await fetchPage(from, from + 499);
    if (cancelled()) return null;
    if (page.error || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count! < 0 || page.count! > maxRows
      || expected !== undefined && expected !== page.count) throw new Error("조회 건수 또는 범위를 확인하지 못했습니다.");
    expected = page.count!;
    if (page.data.length !== Math.min(500, expected - from)) throw new Error("조회 자료가 일부만 반환되었습니다.");
    for (const row of page.data) {
      const id = key(row);
      if (typeof id !== "string" || !id.trim() || seen.has(id)) throw new Error("조회 식별값이 누락되거나 중복되었습니다.");
      seen.add(id); rows.push(row);
    }
    if (rows.length === expected) return rows;
  }
}
