export const IDLE_LIMIT_MS = 60 * 60 * 1000;
export const IDLE_WARNING_MS = 5 * 60 * 1000;

export function idleState(lastActivity: number, now: number) {
  if (!Number.isFinite(lastActivity) || lastActivity <= 0 || lastActivity > now) return "expired";
  const remaining = IDLE_LIMIT_MS - (now - lastActivity);
  return remaining <= 0 ? "expired" : remaining <= IDLE_WARNING_MS ? "warning" : "active";
}

// JWT payload is used ONLY to namespace browser activity; never for authorization.
// Do not persist access/refresh tokens or customer data in this activity entry.
export function idleStorageKey(userId: string, accessToken: string) {
  let sessionId = "session";
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.session_id === "string") sessionId = payload.session_id;
  } catch { /* fallback namespace still scoped to this authenticated user */ }
  return `certification-idle:${userId}:${sessionId}`;
}
