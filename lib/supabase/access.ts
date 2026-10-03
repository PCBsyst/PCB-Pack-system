import "server-only";

import { redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export type StaffContext = { id: string; email: string; displayName: string; role: "STAFF" | "ADMIN"; active: boolean; prototype: boolean };

export async function getCurrentStaff(): Promise<StaffContext> {
  if (!hasEnvVars) return { id: "prototype-admin", email: "", displayName: "김담당", role: "ADMIN", active: true, prototype: true };
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/auth/login");
  const { data: profile } = await supabase.from("profiles").select("email, display_name, role, active").eq("id", userId).single();
  if (!profile?.active) redirect("/auth/error?error=inactive");
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
