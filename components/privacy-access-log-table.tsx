"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";

type AccessLog = { id: number; actor_id: string; occurred_at: string; action: string; resource_type: string; resource_id: string; detail: string };
export function PrivacyAccessLogTable() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setBusy(true); setError("");
    void (async () => {
      let query = supabase.from("privacy_access_logs").select("*").order("occurred_at", { ascending: false }).order("id", { ascending: false }).range(page * 50, page * 50 + 49);
      if (action) query = query.eq("action", action);
      if (actor) query = query.eq("actor_id", actor);
      if (from) query = query.gte("occurred_at", `${from}T00:00:00+09:00`);
      if (until) query = query.lte("occurred_at", `${until}T23:59:59.999999+09:00`);
      const [result, profiles] = await Promise.all([query, supabase.from("profiles").select("id,display_name")]);
      if (cancelled) return;
      setLogs(result.data ?? []);
      if (result.error) setError("이력을 불러오지 못했습니다. 접근이력 SQL 적용 여부와 권한을 확인해주세요.");
      setNames(Object.fromEntries((profiles.data ?? []).map((profile) => [profile.id, profile.display_name])));
      setBusy(false);
    })().catch(() => { if (!cancelled) { setError("서버 연결에 실패했습니다."); setBusy(false); } });
    return () => { cancelled = true; };
  }, [action, actor, from, until, page, revision]);
  return <section className="space-y-4 rounded-lg border bg-white p-5">
    <p className="text-sm text-slate-600">후보자 상세 조회 및 문서 생성 응답 이력입니다. 개인정보 원문은 이 표에 복제하지 않습니다. 파일 응답 기록은 수신자의 실제 저장 완료를 보장하지 않습니다.</p>
    <div className="flex flex-wrap gap-3">
      <select aria-label="작업 종류" className={controlClass} value={action} onChange={(event) => { setAction(event.target.value); setPage(0); }}><option value="">전체 작업</option><option value="CANDIDATE_VIEW">후보자 상세 조회</option><option value="DOCUMENT_RESPONSE">문서 생성 응답</option></select>
      <select aria-label="직원" className={controlClass} value={actor} onChange={(event) => { setActor(event.target.value); setPage(0); }}><option value="">전체 직원</option>{Object.entries(names).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <input aria-label="시작일" type="date" className={controlClass} value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }}/>
      <input aria-label="종료일" type="date" className={controlClass} value={until} onChange={(event) => { setUntil(event.target.value); setPage(0); }}/>
      <Button variant="outline" disabled={busy} onClick={() => setRevision((value) => value + 1)}>새로고침</Button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50"><tr>{["시각 (한국)", "직원", "작업", "대상", "문서"].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{!busy && logs.map((log) => <tr className="border-t" key={log.id}><td className="p-3">{new Date(log.occurred_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td><td className="p-3">{names[log.actor_id] ?? log.actor_id}</td><td className="p-3">{log.action === "CANDIDATE_VIEW" ? "후보자 상세 조회" : "문서 생성 응답"}</td><td className="p-3">{log.resource_type} · {log.resource_id}</td><td className="p-3">{log.detail || "—"}</td></tr>)}</tbody></table></div>
    {busy ? <p role="status">불러오는 중…</p> : !error && logs.length === 0 && <p className="text-sm text-slate-500">해당 조건의 이력이 없습니다.</p>}
    <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>이전</Button><span>{page + 1}페이지 · 최대 50건</span><Button variant="outline" disabled={busy || logs.length < 50} onClick={() => setPage(page + 1)}>다음</Button></div>
  </section>;
}
