"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { isMfaPolicy, readMfaPolicy, type MfaPolicy } from "@/lib/mfa-requirement";

export function MfaPolicySettings() {
  const [policy, setPolicy] = useState<MfaPolicy | null>(null);
  const [owner, setOwner] = useState(false), [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""), [notice, setNotice] = useState("MFA 설정 확인 중입니다.");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!hasEnvVars) { if (active) setNotice("공유 DB 연결 후 사용할 수 있습니다. 브라우저 설정으로 MFA를 해제하지 않습니다."); return; }
        const client = createClient();
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) throw new Error("로그인 확인 실패");
        const { data: profile } = await client.from("profiles").select("active,is_owner").eq("id", user.id).single();
        const result = await readMfaPolicy(client);
        if (!active) return;
        setOwner(profile?.active === true && profile?.is_owner === true);
        if (result.mode !== "ready") { setNotice(result.mode === "legacy" ? "DB 설정 적용 대기(026): 현재 MFA는 기존 정책대로 유지됩니다." : "MFA 설정을 확인하지 못했습니다. 변경은 비활성화됩니다."); return; }
        setPolicy(result.policy); setNotice("");
      } catch { if (active) setNotice("MFA 설정 조회에 실패했습니다. 새로고침해 주세요."); }
    })();
    return () => { active = false; };
  }, []);
  const toggle = async () => {
    if (!owner || !policy || busy || !reason.trim()) return;
    const required = !policy.required;
    if (!window.confirm(required ? "MFA를 켜면 모든 활성 직원에게 2단계 인증이 필요합니다. 적용할까요?" : "샘플 테스트용으로 MFA를 끌까요? 로그인·계정 승인·권한·추적은 계속 적용됩니다.")) return;
    setBusy(true); setNotice("");
    try {
      const { data, error } = await createClient().rpc("update_mfa_policy", { mfa_required: required, reason: reason.trim(), expected_updated_at: policy.updatedAt });
      if (error || !isMfaPolicy(data) || data.required !== required) throw new Error("저장 결과 확인 실패");
      setPolicy(data); setReason("");
      setNotice(required ? "MFA를 켰습니다. 다음 로그인·업무 요청부터 적용됩니다. 인증 앱이 없는 직원은 등록 화면으로 이동합니다." : "MFA를 껐습니다. 다음 로그인·업무 요청부터 적용됩니다. 실제 데이터 투입 전 다시 켜 주세요.");
    } catch { setNotice("변경하지 못했습니다. 최고관리자 권한·MFA 인증·DB 적용 여부를 확인하고 새로고침해 주세요."); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border bg-card p-6 text-card-foreground">
    <h3 className="font-semibold">로그인 2단계 인증(MFA) · 최고관리자 전용</h3>
    <p className="mt-2 text-sm text-muted-foreground">샘플 데이터 테스트 중에는 OFF로 운영할 수 있습니다. 로그인·계정 활성화 승인·권한 검사·접근 및 변경 이력은 해제되지 않습니다. 인증 앱 등록 정보도 삭제하지 않습니다.</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">현재 상태: {policy ? policy.required ? "ON · MFA 필요" : "OFF · 테스트용 임시 해제" : "확인 대기"}</p><Button variant="outline" disabled={!owner || !policy || busy || !reason.trim()} onClick={() => void toggle()}>{busy ? "저장 중…" : policy?.required ? "MFA 끄기" : "MFA 켜기"}</Button></div>
    {policy && !policy.required && <p className="mt-3 rounded-md border border-amber-300 p-3 text-sm">실제 고객 데이터 입력 전에 MFA를 다시 켜 주세요.</p>}
    <label className="mt-4 block text-sm font-medium">변경 사유(필수)<textarea className="mt-2 min-h-20 w-full rounded-md border bg-background p-3" maxLength={1000} value={reason} disabled={!owner || !policy || busy} onChange={event => setReason(event.target.value)}/></label>
    {notice && <p className="mt-3 text-sm" role="status">{notice}</p>}
  </section>;
}
