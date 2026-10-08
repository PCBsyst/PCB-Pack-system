// Validate authoritative allocation responses before writing them into business records.
export function isAllocatedNumber(value: unknown, prefix: string): value is string {
  return typeof value === "string" && Boolean(prefix) && value.startsWith(prefix)
    && /^\d{4}$/.test(value.slice(prefix.length));
}
