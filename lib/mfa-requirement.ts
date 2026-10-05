export type MfaPolicy = { required: boolean; updatedAt: string };
export type MfaPolicyResult = { mode: "ready"; policy: MfaPolicy } | { mode: "legacy" | "unavailable" };
export function isMfaPolicy(value: unknown): value is MfaPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.required === "boolean" && typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt));
}
export async function readMfaPolicy(client: { rpc: (name: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }): Promise<MfaPolicyResult> {
  try {
    const { data, error } = await client.rpc("get_mfa_policy");
    // Only the absent migration keeps the old MFA behavior. Errors never turn MFA off.
    if (error) return error.code === "PGRST202" && error.message?.includes("get_mfa_policy") ? { mode: "legacy" } : { mode: "unavailable" };
    return isMfaPolicy(data) ? { mode: "ready", policy: data } : { mode: "unavailable" };
  } catch { return { mode: "unavailable" }; }
}
