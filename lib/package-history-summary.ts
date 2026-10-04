export type HistoryDocument = { jobId: string; documentType: string; language: string; entryName: string; template?: { source: string; version: string; sha256: string } };
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
