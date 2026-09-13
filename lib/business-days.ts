import Holidays from "date-holidays";

const koreanHolidays = new Holidays("KR");

function parseDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day, 12); }
function formatDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function isKoreanBusinessDay(value: string) {
  if (!value) return false;
  const date = parseDate(value); const weekday = date.getDay();
  return weekday !== 0 && weekday !== 6 && !koreanHolidays.isHoliday(date);
}
export function nextKoreanBusinessDay(value: string) {
  if (!value) return value;
  const date = parseDate(value);
  while (!isKoreanBusinessDay(formatDate(date))) date.setDate(date.getDate() + 1);
  return formatDate(date);
}
export function addKoreanBusinessDays(value: string, amount: number) {
  if (!value) return value;
  const date = parseDate(nextKoreanBusinessDay(value)); const direction = amount < 0 ? -1 : 1; let remaining = Math.abs(amount);
  while (remaining > 0) { date.setDate(date.getDate() + direction); if (isKoreanBusinessDay(formatDate(date))) remaining -= 1; }
  return formatDate(date);
}
