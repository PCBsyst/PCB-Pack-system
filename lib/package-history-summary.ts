export type HistoryDocument = { jobId: string; documentType: string; language: string; entryName: string; template?: { source: string; version: string; sha256: string } };
export type PackageHistoryRow = { id: string; actor_id: string; occurred_at: string; file_count: number; complete: boolean; sha256: string; byte_size: number; documents: HistoryDocument[] };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value.length <= 500 && !/[\x00-\x1f]/.test(value);
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Validate displayed metadata only; this does not verify stored ZIP bytes. */
export function parsePackageHistoryRows(value: unknown): PackageHistoryRow[] | null {
  if (!Array.isArray(value) || value.length > 30) return null;
  const ids = new Set<string>();
  for (const row of value) {
    if (!object(row) || !text(row.id) || ids.has(row.id) || !text(row.actor_id)
      || !text(row.occurred_at) || !/^\d{4}-\d{2}-\d{2}T/.test(row.occurred_at) || !Number.isFinite(Date.parse(row.occurred_at))
      || new Date(`${row.occurred_at.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== row.occurred_at.slice(0, 10)
      || !Number.isSafeInteger(row.file_count) || Number(row.file_count) <= 0
      || !Number.isSafeInteger(row.byte_size) || Number(row.byte_size) <= 0
      || typeof row.complete !== "boolean" || !hash(row.sha256)
      || !Array.isArray(row.documents) || row.documents.length !== row.file_count || row.documents.length > 600) return null;
    ids.add(row.id);
    const entries = new Set<string>();
    const scopes = new Set<string>();
    const jobs = new Set<string>();
    const languages = new Set<string>();
    for (const document of row.documents) {
      if (!object(document) || !text(document.jobId) || !text(document.entryName)
        || !text(document.documentType) || !text(document.language)
        || !["APPLICATION_REVIEW", "CERTIFICATION_DECISION_REPORT", "DELIVERY_CONFIRMATION"].includes(String(document.documentType))
        || !["KR", "EN"].includes(String(document.language))) return null;
      const scope = JSON.stringify([document.jobId, document.documentType, document.language]);
      if (entries.has(document.entryName) || scopes.has(scope)) return null;
      entries.add(document.entryName); scopes.add(scope); jobs.add(document.jobId); languages.add(String(document.language));
      if (document.template !== undefined && (!object(document.template) || !text(document.template.version)
        || !text(document.template.source)
        || !["DATABASE", "BUILT_IN"].includes(String(document.template.source)) || !hash(document.template.sha256))) return null;
    }
    if (row.complete && row.documents.length !== jobs.size * languages.size * 3) return null;
  }
  return value as PackageHistoryRow[];
}
const labels: Record<string, string> = { APPLICATION_REVIEW: "서류검토서", CERTIFICATION_DECISION_REPORT: "인증결정보고서", DELIVERY_CONFIRMATION: "문서전달확인서" };
export function documentHistoryLabel(document: HistoryDocument) {
  return `${labels[document.documentType] ?? document.documentType} · ${document.language === "KR" ? "국문" : document.language === "EN" ? "영문" : document.language}`;
}
export function summarizeHistoryDocuments(documents: HistoryDocument[]) {
  return { jobs: new Set(documents.map((document) => document.jobId)).size,
    korean: documents.filter((document) => document.language === "KR").length,
    english: documents.filter((document) => document.language === "EN").length };
}
export function filterPackageHistory<T extends { complete: boolean; documents: HistoryDocument[] }>(rows: T[], status: "ALL" | "COMPLETE" | "PARTIAL", language: "ALL" | "KR" | "EN") {
  return rows.filter((row) => (status === "ALL" || row.complete === (status === "COMPLETE"))
    && (language === "ALL" || row.documents.some((document) => document.language === language)));
}
