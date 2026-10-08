import type { NumberingRule } from "@/lib/numbering-rules";

export function trainingStandardOptions(catalog: NumberingRule[], query = "") {
  const search = query.trim().toLocaleLowerCase();
  return [...new Set(catalog.map(rule => rule.field))]
    .filter(field => field && !field.includes(",") && field.toLocaleLowerCase().includes(search))
    .sort((left, right) => left.localeCompare(right, "ko"));
}

export function appendTrainingStandard(current: string, field: string, catalog: NumberingRule[]) {
  if (!field || field.includes(",") || !catalog.some(rule => rule.field === field)) throw new Error("등록된 신청표준을 선택해 주세요.");
  if (current.split(",").some(value => value.trim() === field)) return current;
  // Do not rewrite historical or manually entered standards when adding a new one.
  return current.trim() ? `${current}${current.trimEnd().endsWith(",") ? " " : ", "}${field}` : field;
}
