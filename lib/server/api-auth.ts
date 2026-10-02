import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

/** API routes remain usable in prototype mode, but require an active staff session in Supabase mode. */
export async function requireApiStaff() {
  if (!hasEnvVars) return null;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("active").eq("id", userId).maybeSingle();
  if (!profile?.active) return NextResponse.json({ error: "활성화된 내부 직원만 사용할 수 있습니다." }, { status: 403 });
  return null;
}

