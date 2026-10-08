export type BasicDirectoryItem = { id: string; name: string; active: boolean; updatedAt?: string };
export function parseBasicDirectoryItem(value: unknown): BasicDirectoryItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("명단 구성 오류");
  const row = value as Record<string, unknown>;
  const text = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim()) && value.length <= 500 && !/[\u0000-\u001f]/.test(value);
  if (!text(row.id) || !text(row.name) || typeof row.active !== "boolean") throw new Error("명단 항목 오류");
  if (row.updated_at !== undefined && (!text(row.updated_at) || !/^\d{4}-\d{2}-\d{2}T/.test(row.updated_at) || !Number.isFinite(Date.parse(row.updated_at)))) throw new Error("변경 시각 오류");
  return { id: row.id, name: row.name, active: row.active, ...(typeof row.updated_at === "string" ? { updatedAt: row.updated_at } : {}) };
}
