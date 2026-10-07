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
