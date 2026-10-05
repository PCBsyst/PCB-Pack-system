import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { evaluateFeatureControls, type FeatureControl, type OptionalFeature } from "@/lib/feature-controls";
import { checkServerMfa } from "@/lib/server/mfa-access";
import { readStaffSession } from "@/lib/staff-session";
import { readOperationMode, isOperationPaused, type OperationOption } from "@/lib/operation-mode";

/** API routes remain usable in prototype mode, but require an active staff session in Supabase mode. */
export async function requireApiStaff(requiredFeatures: OptionalFeature[] = [], operationFeature?: OperationOption) {
  const environment = currentAuthEnvironment();
  if (environment.blocked) return NextResponse.json({ error: "인증 서버 설정이 필요합니다." }, { status: 503 });
  if (environment.localPrototype) return null;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles").select("active,is_owner").eq("id", userId).maybeSingle();
  if (profileError) return NextResponse.json({ error: "직원 권한을 확인하지 못했습니다." }, { status: 503 });
  if (!profile?.active) return NextResponse.json({ error: "활성화된 내부 직원만 사용할 수 있습니다." }, { status: 403 });
  const session = await readStaffSession(supabase);
  if (session === "unavailable") return NextResponse.json({ error: "서버 세션 상태를 확인하지 못했습니다.", code: "SESSION_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (session === "invalid") return NextResponse.json({ error: "종료된 세션입니다. 다시 로그인해 주세요.", code: "SESSION_ENDED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const mfa = await checkServerMfa(supabase, userId, claimsData?.claims?.aal, profile.is_owner === true);
  if (mfa !== "allow") return NextResponse.json({ error: mfa === "unavailable" ? "2단계 인증 상태를 확인하지 못했습니다." : "내 계정 보안에서 2단계 인증을 완료해 주세요.", code: mfa === "unavailable" ? "MFA_UNAVAILABLE" : "MFA_REQUIRED" }, { status: mfa === "unavailable" ? 503 : 403, headers: { "Cache-Control": "no-store" } });
  if (requiredFeatures.length) {
    const { data, error } = await supabase.from("feature_controls").select("id, enabled, updated_at").in("id", requiredFeatures);
    const policy = evaluateFeatureControls(requiredFeatures, data as FeatureControl[] | null, error);
    if (policy === "unavailable") return NextResponse.json({ error: "기능 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    if (policy === "disabled") return NextResponse.json({ error: "최고관리자가 이 기능을 일시 중지했습니다. 기존 업무기록은 유지됩니다." }, { status: 403 });
  }
  if (requiredFeatures.length || operationFeature) {
    const mode = await readOperationMode(supabase);
    if (mode.mode === "unavailable") return NextResponse.json({ error: "운영 모드 설정을 확인하지 못했습니다. 다시 시도해 주세요." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if ([...requiredFeatures, ...(operationFeature ? [operationFeature] : [])].some(key => isOperationPaused(mode, key))) return NextResponse.json({ error: "이관·테스트 운영 모드에서 이 기능을 일시 중지했습니다. 최고관리자에게 문의해 주세요." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}
