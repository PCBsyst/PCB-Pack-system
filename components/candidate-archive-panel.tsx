"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function CandidateArchivePanel({ id, initialDate, initialReason, available, onChanged }: {
  id: string; initialDate: string | null; initialReason: string | null; available: boolean; onChanged: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [savedReason, setSavedReason] = useState(initialReason);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit() {
    if (!reason.trim()) { setNotice("보관 또는 복원 사유를 입력해 주세요."); return; }
    if (!window.confirm(date ? "후보자를 일반 목록으로 복원할까요?" : "후보자를 보관 목록으로 이동할까요? 인증상태와 업무이력은 변경되지 않습니다.")) return;
    setBusy(true); setNotice("");
    try {
      const { data, error } = await createClient().rpc("set_candidate_archive_status", {
        target_id: id, archive: !date, reason: reason.trim(), expected_archived_at: date,
      });
      if (error) throw error;
      if (!data || !("archived_at" in data)) throw new Error("저장 결과를 확인하지 못했습니다.");
      setDate(data.archived_at); setSavedReason(data.archive_reason); setReason("");
      setNotice(data.archived_at ? "보관했습니다. 업무이력과 인증상태는 유지됩니다." : "일반 목록으로 복원했습니다.");
      onChanged();
    } catch (error) {
      setNotice(`저장하지 못했습니다: ${error instanceof Error ? error.message : "DB 설정 또는 권한을 확인해 주세요."}`);
    } finally { setBusy(false); }
  }
  return <section className="rounded-lg border bg-white p-6 shadow-sm">
    <h2 className="font-semibold">후보자 보관 관리 · {date ? "보관 중" : "일반"}</h2>
    <p className="mt-2 text-sm text-slate-600">보관은 삭제가 아닙니다. 일반 후보자 목록에서만 제외하며 신청·Job·인증·패키지 이력은 그대로 유지합니다.</p>
    {!available ? <p className="mt-3 text-sm text-amber-800">DB 적용 대기: 보관 기능 준비가 완료되면 사용할 수 있습니다. 현재 기록은 변경되지 않습니다.</p> : <>
      {date && <p className="mt-3 text-sm text-slate-600">보관일: {new Date(date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · 사유: {savedReason}</p>}
      <label className="mt-4 block text-sm font-medium">{date ? "복원" : "보관"} 사유 (필수)<textarea disabled={busy} className="mt-2 min-h-20 w-full rounded-md border p-3" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <Button className="mt-3" variant="outline" disabled={busy || !reason.trim()} onClick={submit}>{busy ? "저장 중..." : date ? "후보자 복원" : "후보자 보관"}</Button>
    </>}
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
  </section>;
}
