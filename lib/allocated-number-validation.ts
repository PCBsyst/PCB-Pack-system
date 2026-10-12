// Validate authoritative allocation responses before writing them into business records.
export function isAllocatedNumber(value: unknown, prefix: string): value is string {
  return typeof value === "string" && Boolean(prefix) && value.startsWith(prefix)
    && /^\d{4}$/.test(value.slice(prefix.length));
}

export function isRegistrationDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

// Match allocate_application_number: area, receipt year, and sequence 001..999.
export function isAllocatedApplicationNumber(value: unknown, area: string, receivedAt: string): value is string {
  if (!isRegistrationDate(receivedAt) || !["ISO", "K_BEAUTY"].includes(area) || typeof value !== "string") return false;
  const prefix = `APP-${area === "ISO" ? "ISO" : "KB"}-${receivedAt.slice(0, 4)}-`;
  return value.startsWith(prefix) && /^\d{3}$/.test(value.slice(prefix.length)) && Number(value.slice(prefix.length)) > 0;
}
