export type ServerIdleStatus = { mode: "ready"; serverNow: string; expiresAt: string } | { mode: "invalid" | "legacy" | "unavailable" };
export function parseServerIdleStatus(data: unknown): ServerIdleStatus {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { mode: "unavailable" };
  const value = data as Record<string, unknown>;
  if (value.valid === false) return { mode: "invalid" };
  if (value.valid !== true || typeof value.serverNow !== "string" || typeof value.expiresAt !== "string") return { mode: "unavailable" };
  const remaining = Date.parse(value.expiresAt) - Date.parse(value.serverNow);
  return Number.isFinite(remaining) && remaining > 0 && remaining <= 3600000 ? { mode: "ready", serverNow: value.serverNow, expiresAt: value.expiresAt } : { mode: "unavailable" };
}
export async function readServerIdleSession(client: { rpc: (name: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }, activity = false): Promise<ServerIdleStatus> {
  const name = activity ? "touch_staff_session_activity" : "get_staff_idle_status";
  try {
    const { data, error } = await client.rpc(name);
    if (error) return { mode: error.code === "PGRST202" && error.message?.includes(name) ? "legacy" : "unavailable" };
    return parseServerIdleStatus(data);
  } catch { return { mode: "unavailable" }; }
}
