import { corporateTemplateRegistry } from "@/lib/document-template-registry";

export type TemplateReadinessRow = { id: string; label: string; language: "KR" | "EN"; source: "DATABASE" | "BUILT_IN" | "MISSING" };
export function isTemplateReadinessRows(value: unknown): value is TemplateReadinessRow[] {
  if (!Array.isArray(value) || value.length !== corporateTemplateRegistry.length) return false;
  const ids = new Set<string>();
  return value.every((row) => {
    if (!row || typeof row !== "object") return false;
    const template = corporateTemplateRegistry.find((template) => template.id === row.id);
    if (!template || ids.has(row.id) || row.label !== template.label || row.language !== template.language
      || !["DATABASE", "BUILT_IN", "MISSING"].includes(row.source)) return false;
    ids.add(row.id); return true;
  });
}
export function templateReadiness(activeKeys: Set<string>): TemplateReadinessRow[] {
  return corporateTemplateRegistry.map((template) => ({ id: template.id, label: template.label, language: template.language,
    source: activeKeys.has(`${template.documentType}:${template.language}`) ? "DATABASE" : template.available ? "BUILT_IN" : "MISSING" }));
}
export function readinessCount(rows: TemplateReadinessRow[], languages: Record<"KR" | "EN", boolean>, jobs: number) {
  const selected = rows.filter((row) => languages[row.language]);
  return { expected: selected.length * jobs, available: selected.filter((row) => row.source !== "MISSING").length * jobs,
    missing: selected.filter((row) => row.source === "MISSING").map((row) => `${row.label} ${row.language === "KR" ? "국문" : "영문"}`) };
}

export function confirmPackageReadiness(rows: TemplateReadinessRow[], languages: Record<"KR" | "EN", boolean>, jobs: number, confirm: (message: string) => boolean): "GENERATE" | "CANCEL" | "EMPTY" {
  const count = readinessCount(rows, languages, jobs);
  if (count.available === 0) return "EMPTY";
  if (!count.missing.length) return "GENERATE";
  return confirm(`선택한 양식 ${count.expected}개 중 ${count.available}개만 준비되어 있습니다.\n\n누락 양식:\n${count.missing.join("\n")}\n\n부분 패키지는 전체 완료로 처리되지 않습니다. 준비된 양식만 생성하시겠습니까?`) ? "GENERATE" : "CANCEL";
}
