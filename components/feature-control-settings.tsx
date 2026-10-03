"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { optionalFeatures, type FeatureControl } from "@/lib/feature-controls";

export function FeatureControlSettings() {
  const [rows, setRows] = useState<FeatureControl[]>([]);
  const [owner, setOwner] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("설정 확인 중...");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!hasEnvVars) { setNotice("DB 적용 대기: 현재는 기능 제어 화면 미리보기입니다."); return; }
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) { if (!cancelled) setNotice("로그인이 필요합니다."); return; }
      const { data: profile } = await client.from("profiles").select("is_owner, active").eq("id", user.id).single();
      const { data, error } = await client.from("feature_controls").select("id, enabled, updated_at");
      if (cancelled) return;
      setOwner(Boolean(profile?.is_owner && profile.active));
      if (error || !data || optionalFeatures.some((feature) => !data.some((row) => row.id === feature.id))) {
        setNotice("DB 적용 또는 연결 확인 대기: ON/OFF 변경은 아직 사용할 수 없습니다."); return;
      }
      setRows(data as FeatureControl[]); setNotice("");
    };
    void load().catch(() => { if (!cancelled) setNotice("설정을 불러오지 못했습니다. 변경은 비활성화됩니다."); });
    return () => { cancelled = true; };
  }, []);
  async function toggle(row: FeatureControl) {
    if (!owner || !reason.trim() || busy) return;
    if (!window.confirm(`${optionalFeatures.find((item) => item.id === row.id)?.label} 기능을 ${row.enabled ? "OFF" : "ON"}로 변경할까요?`)) return;
    setBusy(true); setNotice("");
    try {
      const { data, error } = await createClient().rpc("update_feature_control", { feature_id: row.id, feature_enabled: !row.enabled, reason: reason.trim(), expected_updated_at: row.updated_at });
      if (error) throw error;
      if (!data || data.id !== row.id || data.enabled !== !row.enabled) throw new Error("저장 결과 확인 실패");
      setRows((current) => current.map((item) => item.id === row.id ? data as FeatureControl : item));
      setReason(""); setNotice("변경했습니다. 다음 서버 문서 요청부터 적용되며 기존 기록은 유지됩니다.");
    } catch (error) { setNotice(`변경하지 못했습니다: ${error instanceof Error ? error.message : "권한·상태를 확인하고 새로고침해 주세요."}`); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border bg-white p-6">
    <h3 className="font-semibold">부가 기능 제어</h3>
    <p className="mt-2 text-sm text-slate-600">최고관리자만 사유를 입력하여 변경합니다. OFF는 신규 서버 생성을 중단하며 기존 문서·기록은 삭제하지 않습니다.</p>
    <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm"><p className="font-medium">항상 ON · 변경 불가</p><p className="mt-1 text-slate-600">로그인·직원 권한 검사·연결된 접근 및 변경 추적·필수 사유·이력 보호</p></div>
    <div className="mt-4 divide-y">{optionalFeatures.map((feature) => {
      const row = rows.find((item) => item.id === feature.id);
      return <div key={feature.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h4 className="text-sm font-semibold">{feature.label}</h4><p className="mt-1 text-xs text-slate-500">{feature.description}</p></div><Button variant="outline" disabled={!owner || !row || busy || !reason.trim()} onClick={() => row && void toggle(row)}>{row ? `${row.enabled ? "ON → OFF" : "OFF → ON"}` : "적용 대기"}</Button></div>;
    })}</div>
    <label className="mt-3 block text-sm font-medium">변경 사유 (필수)<textarea disabled={!owner || !rows.length || busy} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-md border p-3" /></label>
    {notice && <p role="status" className="mt-3 text-sm text-amber-800">{notice}</p>}
    <p className="mt-3 text-xs text-slate-500">브라우저 직접 생성 문서와 이관·알림·Dropbox 제어는 아직 이 설정 범위에 포함하지 않습니다.</p>
  </section>;
}
