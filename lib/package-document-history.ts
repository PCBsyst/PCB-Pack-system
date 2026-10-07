export type PackageDocumentHistoryRow = { job_id: string; document_type: string; language: "KR" | "EN"; format: "WORD" | "PDF" | "ZIP"; generated_at: string | null };

/** Historical rows are not proof that the underlying file is available. */
export function parsePackageDocumentHistory(value: unknown, jobIds: string[]): PackageDocumentHistoryRow[] | null {
  if (!Array.isArray(value)) return null;
  const allowed = new Set(jobIds);
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)
      || typeof row.job_id !== "string" || !allowed.has(row.job_id)
      || typeof row.document_type !== "string" || !row.document_type.trim() || row.document_type.length > 500 || /[\x00-\x1f]/.test(row.document_type)
      || !["KR", "EN"].includes(row.language) || !["WORD", "PDF", "ZIP"].includes(row.format)) return null;
    if (row.generated_at !== null) {
      if (typeof row.generated_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(row.generated_at)
        || !Number.isFinite(Date.parse(row.generated_at))
        || new Date(`${row.generated_at.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== row.generated_at.slice(0, 10)) return null;
    }
  }
  return value as PackageDocumentHistoryRow[];
}

export function packageDocumentLanguageSummary(rows: PackageDocumentHistoryRow[], verified: boolean) {
  if (!verified) return "기존 이력 조회 미확인";
  const languages = [...new Set(rows.map(row => row.language))];
  return languages.length ? languages.map(language => language === "KR" ? "국문" : "영문").join(" · ") : "확인된 기존 언어 이력 없음";
}

type HistoryPage = { data: unknown; count: number | null; error: unknown };
/** Bounded paging detects truncation and common drift, not a transactional snapshot. */
export async function readPackageDocumentHistory(
  jobIds: string[],
  fetchPage: (ids: string[], from: number, to: number) => PromiseLike<HistoryPage>,
  cancelled: () => boolean,
): Promise<PackageDocumentHistoryRow[] | null> {
  const uniqueJobs = [...new Set(jobIds)];
  if (uniqueJobs.length > 10000 || uniqueJobs.some(id => typeof id !== "string" || !id.trim())) throw new Error("문서 이력 Job 범위 확인 실패");
  const all: PackageDocumentHistoryRow[] = [];
  const seen = new Set<string>();
  for (let start = 0; start < uniqueJobs.length; start += 100) {
    const ids = uniqueJobs.slice(start, start + 100);
    const previousCount = all.length;
    let expected: number | undefined;
    for (let from = 0; ; from += 500) {
      if (cancelled()) return null;
      const page = await fetchPage(ids, from, from + 499);
      if (cancelled()) return null;
      if (page.error || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count! < 0
        || page.count! > 10000 - previousCount || expected !== undefined && page.count !== expected) throw new Error("문서 이력 조회 범위 확인 실패");
      expected = page.count!;
      if (page.data.length !== Math.min(500, expected - from)) throw new Error("문서 이력이 일부만 조회되었습니다.");
      const verified = parsePackageDocumentHistory(page.data, ids);
      if (!verified) throw new Error("문서 이력 응답 확인 실패");
      for (const row of page.data) {
        if (typeof row.id !== "string" || !row.id.trim() || seen.has(row.id)) throw new Error("문서 이력 식별값 중복 또는 누락");
        seen.add(row.id);
      }
      all.push(...verified);
      if (from + page.data.length === expected) break;
    }
  }
  return all;
}
