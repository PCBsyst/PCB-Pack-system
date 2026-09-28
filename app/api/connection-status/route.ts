import { NextResponse } from "next/server";

export function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  let urlHost = "";
  try { urlHost = url ? new URL(url).host : ""; } catch {}
  return NextResponse.json({
    supabaseUrlPresent: Boolean(url),
    supabaseUrlValid: url.startsWith("https://") && urlHost.endsWith(".supabase.co"),
    supabaseUrlHost: urlHost,
    publishableKeyPresent: Boolean(key),
    publishableKeyValid: key.startsWith("sb_publishable_") || key.startsWith("eyJ"),
    authMode: url && key ? "supabase" : "prototype",
  });
}
