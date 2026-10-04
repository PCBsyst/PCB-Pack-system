import "server-only";

import { redirect } from "next/navigation";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { createClient } from "@/lib/supabase/server";
import { checkServerMfa } from "@/lib/server/mfa-access";

export type StaffContext = { id: string; email: string; displayName: string; role: "STAFF" | "ADMIN"; active: boolean; prototype: boolean };

export async function getCurrentStaff(): Promise<StaffContext> {
  return readStaff(false);
}

/** Enrollment/challenge page only; never use this to authorize business data. */
export async function getMfaSetupStaff(): Promise<StaffContext> {
  return readStaff(true);
}

async function readStaff(mfaSetupOnly: boolean): Promise<StaffContext> {
  const environment = currentAuthEnvironment();
  if (environment.blocked) redirect("/auth/error?error=configuration-required");
  if (environment.localPrototype) return { id: "prototype-admin", email: "", displayName: "김담당", role: "ADMIN", active: true, prototype: true };
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/auth/login");
  const { data: profile, error } = await supabase.from("profiles").select("email, display_name, role, active,is_owner").eq("id", userId).single();
  if (error) redirect("/auth/error?error=verification-unavailable");
  if (!profile?.active) redirect("/auth/error?error=inactive");
  if (!mfaSetupOnly) {
    const mfa = await checkServerMfa(supabase, userId, claimsData?.claims?.aal, profile.is_owner === true);
    if (mfa === "unavailable") redirect("/auth/error?error=verification-unavailable");
    if (mfa !== "allow") redirect("/auth/mfa");
  }
  return { id: userId, email: profile.email, displayName: profile.display_name, role: profile.role, active: profile.active, prototype: false };
}

export async function requireAdmin() {
  const staff = await getCurrentStaff();
  if (staff.role !== "ADMIN") redirect("/?access=admin-required");
  if (!staff.prototype) {
    const supabase = await createClient();
    const { data: owner } = await supabase.rpc("is_admin");
    if (!owner) redirect("/?access=owner-required");
  }
  return staff;
}
