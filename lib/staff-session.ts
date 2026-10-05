export type StaffSessionStatus = "valid" | "invalid" | "legacy" | "unavailable";

/** SQL 031 미적용만 legacy로 구분합니다. 장애나 잘못된 응답은 허용하지 않습니다. */
export async function readStaffSession(client: { rpc: (name: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> }): Promise<StaffSessionStatus> {
  try {
    const { data, error } = await client.rpc("has_live_staff_session");
    if (error) return error.code === "PGRST202" && error.message?.includes("has_live_staff_session") ? "legacy" : "unavailable";
    return data === true ? "valid" : data === false ? "invalid" : "unavailable";
  } catch { return "unavailable"; }
}
