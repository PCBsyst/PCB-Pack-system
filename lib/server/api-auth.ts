import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { evaluateFeatureControls, type FeatureControl, type OptionalFeature } from "@/lib/feature-controls";

/** API routes remain usable in prototype mode, but require an active staff session in Supabase mode. */
export async function requireApiStaff(requiredFeatures: OptionalFeature[] = []) {
  const environment = currentAuthEnvironment();
  if (environment.blocked) return NextResponse.json({ error: "인증 서버 설정이 필요합니다." }, { status: 503 });
  if (environment.localPrototype) return null;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("active").eq("id", userId).maybeSingle();
  if (!profile?.active) return NextResponse.json({ error: "활성화된 내부 직원만 사용할 수 있습니다." }, { status: 403 });
  if (requiredFeatures.length) {
    const { data, error } = await supabase.from("feature_controls").select("id, enabled, updated_at").in("id", requiredFeatures);
    const policy = evaluateFeatureControls(requiredFeatures, data as FeatureControl[] | null, error);
    if (policy === "unavailable") return NextResponse.json({ error: "기능 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    if (policy === "disabled") return NextResponse.json({ error: "최고관리자가 이 기능을 일시 중지했습니다. 기존 업무기록은 유지됩니다." }, { status: 403 });
  }
  return null;
}
