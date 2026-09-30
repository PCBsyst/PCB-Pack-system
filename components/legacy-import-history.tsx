"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type Batch = { id: string; file_name: string; total_rows: number; success_count: number; failed_count: number; status: string; created_by_name: string; created_at: string; completed_at: string | null };
type Entry = { id: string; source_row: number; job_no: string | null; certification_no: string | null; status: string; error_message: string | null };

export function LegacyImportHistory() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [expanded, setExpanded] = useState("");
  const [loading, setLoading] = useState(Boolean(hasEnvVars));
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!hasEnvVars) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await createClient().from("legacy_import_batches").select("id, file_name, total_rows, success_count, failed_count, status, created_by_name, created_at, completed_at").order("created_at", { ascending: false }).limit(20);
    setUnavailable(Boolean(error)); setBatches((data ?? []) as Batch[]); setLoading(false);
  }, []);

  useEffect(() => { void load(); const listener = () => void load(); window.addEventListener("legacy-import-updated", listener); return () => window.removeEventListener("legacy-import-updated", listener); }, [load]);

  const toggle = async (batchId: string) => {
    if (expanded === batchId) { setExpanded(""); return; }
    setExpanded(batchId);
    if (entries[batchId]) return;
    const { data } = await createClient().from("legacy_import_entries").select("id, source_row, job_no, certification_no, status, error_message").eq("batch_id", batchId).order("source_row");
    setEntries((current) => ({ ...current, [batchId]: (data ?? []) as Entry[] }));
  };

  return <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
    <div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><History className="h-4 w-4" />최근 가져오기 이력</h2><p className="mt-1 text-xs text-slate-500">최근 20개 실행의 담당자와 성공·실패 내역을 보존합니다.</p></div><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}새로고침</Button></div>
    {unavailable ? <div className="p-5 text-sm text-amber-800">가져오기 이력 SQL을 적용하면 이 영역이 활성화됩니다.</div> : loading ? <div className="p-8 text-center text-sm text-slate-500">이력을 불러오는 중입니다.</div> : !batches.length ? <div className="p-8 text-center text-sm text-slate-500">아직 실행된 가져오기가 없습니다.</div> : <div className="divide-y">{batches.map((batch) => <div key={batch.id}><button type="button" className="grid w-full grid-cols-[1fr_auto] gap-3 p-4 text-left hover:bg-slate-50" onClick={() => void toggle(batch.id)}><div><p className="font-medium text-slate-900">{batch.file_name}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(batch.created_at)} · {batch.created_by_name} · 대상 {batch.total_rows}건</p></div><div className="flex items-center gap-3"><span className="text-xs font-semibold text-emerald-700">성공 {batch.success_count}</span><span className={batch.failed_count ? "text-xs font-semibold text-red-700" : "text-xs text-slate-400"}>실패 {batch.failed_count}</span>{expanded === batch.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></button>{expanded === batch.id && <div className="border-t bg-slate-50 px-4 py-3">{(entries[batch.id] ?? []).length ? <div className="space-y-2">{entries[batch.id].map((entry) => <div key={entry.id} className="grid gap-1 rounded border bg-white px-3 py-2 text-xs sm:grid-cols-[70px_100px_130px_1fr]"><span>{entry.source_row}행</span><span className={entry.status === "SUCCESS" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{entry.status === "SUCCESS" ? "성공" : "실패"}</span><span>{entry.job_no ?? "-"}</span><span>{entry.error_message ?? entry.certification_no ?? "-"}</span></div>)}</div> : <p className="text-xs text-slate-500">상세 이력을 불러오는 중이거나 기록이 없습니다.</p>}</div>}</div>)}</div>}
  </section>;
}

function formatDateTime(value: string) { return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
