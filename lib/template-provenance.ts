export type TemplateProvenance = {
  source: "DATABASE" | "BUILT_IN";
  version: string;
  sha256: string;
};

export function templateProvenanceHeaders(template: TemplateProvenance) {
  return {
    "X-Template-Source": template.source,
    "X-Template-Version": encodeURIComponent(template.version),
    "X-Template-SHA256": template.sha256,
    "Cache-Control": "private, no-store",
  };
}

export function readTemplateProvenance(headers: Headers): TemplateProvenance {
  const source = headers.get("X-Template-Source");
  const sha256 = headers.get("X-Template-SHA256") ?? "";
  let version: string;
  try { version = decodeURIComponent(headers.get("X-Template-Version") ?? ""); }
  catch { throw new Error("양식 개정정보를 확인하지 못했습니다."); }
  if ((source !== "DATABASE" && source !== "BUILT_IN") || !/^[a-f0-9]{64}$/.test(sha256)
    || !version.trim() || version.length > 500 || /[\r\n\x00-\x1f]/.test(version)) {
    throw new Error("양식 생성 근거를 확인하지 못했습니다.");
  }
  return { source, version, sha256 };
}
