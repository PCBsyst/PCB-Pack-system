"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Eligibility = { allowed: boolean; name: string; updated_at: string };

export function CandidateDeletePanel({ id }: { id: string }) {
  const router = useRouter();
  const [owner, setOwner] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await client.from("profiles").select("is_owner, active").eq("id", user.id).single();
      if (!profile?.is_owner || !profile.active || cancelled) return;
      setOwner(true);
      const { data, error } = await client.rpc("candidate_deletion_eligibility", { target_id: id });
      if (cancelled) return;
      if (error || !data) { setNotice("삭제 조건 확인 불가: DB 적용 또는 연결 확인이 필요합니다. 삭제는 비활성화됩니다."); return; }
      setEligibility(data as Eligibility);
    };
    void load().catch(() => { if (!cancelled) setNotice("삭제 조건 확인 중 오류가 발생했습니다."); });
    return () => { cancelled = true; };
  }, [id]);
  async function remove() {
    if (!eligibility?.allowed || !reason.trim() || confirmation !== eligibility.name) return;
    if (!window.confirm("오등록 후보자를 실제 삭제합니다. 화면에서 복원할 수 없습니다. 계속할까요?")) return;
    setBusy(true); setNotice("");
    try {
      const { data, error } = await createClient().rpc("delete_mistaken_candidate", {
        target_id: id, confirmation_name: confirmation, reason: reason.trim(), expected_updated_at: eligibility.updated_at,
      });
      if (error) throw error;
      if (data !== id) throw new Error("삭제 결과를 확인하지 못했습니다.");
      router.replace("/candidates"); router.refresh();
    } catch (error) {
      setNotice(`삭제하지 못했습니다: ${error instanceof Error ? error.message : "상태 또는 권한이 변경됐을 수 있습니다. 새로고침해 주세요."}`);
      setBusy(false);
    }
  }
  if (!owner) return null;
  return <section className="rounded-lg border border-red-200 bg-white p-6">
    <h2 className="font-semibold text-red-900">오등록 후보자 삭제 · 최고관리자 전용</h2>
    <p className="mt-2 text-sm text-slate-600">신청·Job 등 업무이력이 없는 단순 오등록만 삭제할 수 있습니다. 업무이력이 있으면 보관을 이용해 주세요. 삭제 사유와 처리이력은 유지됩니다.</p>
    {eligibility && !eligibility.allowed && <p className="mt-3 text-sm font-medium text-amber-800">업무이력이 있어 삭제할 수 없습니다.</p>}
    {eligibility?.allowed && <div className="mt-4 space-y-3">
      <label className="block text-sm font-medium">삭제 사유 (필수)<textarea className="mt-2 min-h-20 w-full rounded-md border p-3" disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label className="block text-sm font-medium">확인을 위해 후보자명 “{eligibility.name}” 입력<input className="mt-2 w-full rounded-md border p-3" disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
      <Button variant="outline" className="border-red-300 text-red-800" disabled={busy || !reason.trim() || confirmation !== eligibility.name} onClick={remove}>{busy ? "삭제 중..." : "오등록 후보자 실제 삭제"}</Button>
    </div>}
    {notice && <p role="status" className="mt-3 text-sm text-red-800">{notice}</p>}
  </section>;
}
