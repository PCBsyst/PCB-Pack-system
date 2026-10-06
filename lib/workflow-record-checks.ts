export function workflowAmount(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= Number.MAX_SAFE_INTEGER ? amount : null;
}
export function hasExactAffectedIds(rows: unknown, expected: string[]): boolean {
  if (!expected.length || new Set(expected).size !== expected.length || !Array.isArray(rows) || rows.length !== expected.length) return false;
  const ids = rows.map(row => row && typeof row === "object" ? row.id : undefined);
  return new Set(ids).size === expected.length && expected.every(id => ids.includes(id));
}
