export function koreaToday(now = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
function dayValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getTime();
}
export function expiryDays(validUntil: string, today: string): number | null {
  const end = dayValue(validUntil), start = dayValue(today);
  return end === null || start === null ? null : Math.round((end - start) / 86400000);
}
export function expiryBucket(days: number | null): "unknown" | "past" | "today" | "upcoming" {
  return days === null ? "unknown" : days < 0 ? "past" : days === 0 ? "today" : "upcoming";
}
