import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateServerMfa } from "@/lib/server-mfa-policy";

export async function checkServerMfa(client: SupabaseClient, userId: string, currentLevel: unknown, isOwner: boolean) {
  try {
    const { data, error } = await client.auth.getUser();
    const verifiedFactor = data.user?.factors?.some((factor) => factor.status === "verified") ?? false;
    return evaluateServerMfa(currentLevel, isOwner, verifiedFactor, Boolean(error) || data.user?.id !== userId);
  } catch {
    return "unavailable";
  }
}
