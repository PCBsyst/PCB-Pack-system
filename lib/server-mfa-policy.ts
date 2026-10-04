export type ServerMfaDecision = "allow" | "enroll" | "challenge" | "unavailable";

/** Only verified server claims and a freshly fetched factor list may be passed. */
export function evaluateServerMfa(currentLevel: unknown, isOwner: boolean, verifiedFactor: boolean, lookupFailed = false): ServerMfaDecision {
  if (lookupFailed || (currentLevel !== "aal1" && currentLevel !== "aal2")) return "unavailable";
  if (isOwner && !verifiedFactor) return "enroll";
  if (verifiedFactor && currentLevel !== "aal2") return "challenge";
  return "allow";
}
