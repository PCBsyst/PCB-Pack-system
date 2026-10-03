export const optionalFeatures = [
  { id: "DOCUMENT_GENERATION", label: "서버 문서 생성", description: "서류검토서·인증결정보고서·문서전달확인서·정지/철회 문서의 서버 생성" },
  { id: "PACKAGE_DOWNLOAD", label: "서버 패키지 ZIP 다운로드", description: "여러 Job 문서를 묶어서 다운로드합니다. 문서 생성도 ON이어야 합니다." },
] as const;
export type OptionalFeature = typeof optionalFeatures[number]["id"];
export type FeatureControl = { id: OptionalFeature; enabled: boolean; updated_at: string };
export type FeatureQueryError = { code?: string; message?: string } | null;

export function evaluateFeatureControls(required: OptionalFeature[], rows: FeatureControl[] | null, error: FeatureQueryError): "allowed" | "disabled" | "unavailable" | "legacy" {
  // Only the explicitly absent new table retains pre-migration behavior. Authentication never bypassed.
  if (error) return ["42P01", "PGRST205"].includes(error.code ?? "") && error.message?.includes("feature_controls") ? "legacy" : "unavailable";
  if (!rows || required.some((id) => !rows.some((row) => row.id === id))) return "unavailable";
  return required.every((id) => rows.find((row) => row.id === id)?.enabled === true) ? "allowed" : "disabled";
}
