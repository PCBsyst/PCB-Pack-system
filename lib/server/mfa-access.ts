import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateServerMfa } from "@/lib/server-mfa-policy";
import { readMfaPolicy } from "@/lib/mfa-requirement";

export async function checkServerMfa(client: SupabaseClient, userId: string, currentLevel: unknown, isOwner: boolean) {
  try {
    const { data, error } = await client.auth.getUser();
    if (error || data.user?.id !== userId) return "unavailable";
    const policy = await readMfaPolicy(client);
    if (policy.mode === "unavailable") return "unavailable";
    const verifiedFactor = data.user?.factors?.some((factor) => factor.status === "verified") ?? false;
    return evaluateServerMfa(currentLevel, isOwner, verifiedFactor, false, policy.mode === "ready" ? policy.policy.required : undefined);
  } catch {
    return "unavailable";
  }
}
