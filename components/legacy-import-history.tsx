"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, Download, History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type Batch = { id: string; file_name: string; total_rows: number; success_count: number; failed_count: number; status: string; created_by_name: string; created_at: string; completed_at: string | null; verification_status: string; verified_by_name: string | null; verified_at: string | null };
type Entry = { id: string; source_row: number; job_no: string | null; certification_no: string | null; status: string; error_message: string | null; candidate_id: string | null; application_id: string | null; job_id: string | null };

export function LegacyImportHistory() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [expanded, setExpanded] = useState("");
  const [loading, setLoading] = useState(Boolean(hasEnvVars));
  const [unavailable, setUnavailable] = useState(false);
  const [verifying, setVerifying] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!hasEnvVars) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await createClient().from("legacy_import_batches").select("id, file_name, total_rows, success_count, failed_count, status, created_by_name, created_at, completed_at, verification_status, verified_by_name, verified_at").order("created_at", { ascending: false }).limit(20);
    setUnavailable(Boolean(error)); setBatches((data ?? []) as Batch[]); setLoading(false);
  }, []);

  useEffect(() => { void load(); const listener = () => void load(); window.addEventListener("legacy-import-updated", listener); return () => window.removeEventListener("legacy-import-updated", listener); }, [load]);

  const toggle = async (batchId: string) => {
    if (expanded === batchId) { setExpanded(""); return; }
    setExpanded(batchId);
    if (entries[batchId]) return;
    const { data } = await createClient().from("legacy_import_entries").select("id, source_row, job_no, certification_no, status, error_message, candidate_id, application_id, job_id").eq("batch_id", batchId).order("source_row");
    setEntries((current) => ({ ...current, [batchId]: (data ?? []) as Entry[] }));
  };

  const ensureEntries = async (batchId: string) => {
    if (entries[batchId]) return entries[batchId];
    const { data } = await createClient().from("legacy_import_entries").select("id, source_row, job_no, certification_no, status, error_message, candidate_id, application_id, job_id").eq("batch_id", batchId).order("source_row");
    const result = (data ?? []) as Entry[];
    setEntries((current) => ({ ...current, [batchId]: result }));
    return result;
  };

  const exportBatch = async (batch: Batch) => {
    const result = await ensureEntries(batch.id);
    const rows = [["원본 행", "처리결과", "Job No.", "인증번호", "오류", "후보자 ID", "신청 ID", "Job ID"], ...result.map((entry) => [entry.source_row, entry.status === "SUCCESS" ? "성공" : "실패", entry.job_no ?? "", entry.certification_no ?? "", entry.error_message ?? "", entry.candidate_id ?? "", entry.application_id ?? "", entry.job_id ?? ""])];
    downloadCsv(rows, `과거자료_대조결과_${batch.file_name.replace(/\.[^.]+$/, "")}.csv`);
  };

  const verifyBatch = async (batch: Batch) => {
    if (!window.confirm(`${batch.file_name}의 ${batch.total_rows}건을 원본과 대조했으며 이상이 없습니까?`)) return;
    setVerifying(batch.id); setMessage("");
    const { error } = await createClient().rpc("verify_legacy_import_batch", { p_batch_id: batch.id });
    setVerifying("");
    if (error) setMessage(error.message); else { setMessage("대조 검증을 완료했습니다."); await load(); }
  };

  return <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
    <div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><History className="h-4 w-4" />최근 가져오기 이력</h2><p className="mt-1 text-xs text-slate-500">최근 20개 실행의 담당자와 성공·실패 내역을 보존합니다.</p></div><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}새로고침</Button></div>
    {message && <div className="border-b bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</div>}
    {unavailable ? <div className="p-5 text-sm text-amber-800">가져오기 이력 SQL을 적용하면 이 영역이 활성화됩니다.</div> : loading ? <div className="p-8 text-center text-sm text-slate-500">이력을 불러오는 중입니다.</div> : !batches.length ? <div className="p-8 text-center text-sm text-slate-500">아직 실행된 가져오기가 없습니다.</div> : <div className="divide-y">{batches.map((batch) => <div key={batch.id}><div className="grid grid-cols-[1fr_auto] gap-3 p-4 hover:bg-slate-50"><button type="button" className="min-w-0 text-left" onClick={() => void toggle(batch.id)}><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{batch.file_name}</p>{batch.verification_status === "VERIFIED" ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800"><ShieldCheck className="h-3 w-3" />검증 완료</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">대조 대기</span>}</div><p className="mt-1 text-xs text-slate-500">{formatDateTime(batch.created_at)} · {batch.created_by_name} · 대상 {batch.total_rows}건{batch.verified_at ? ` · ${formatDateTime(batch.verified_at)} ${batch.verified_by_name ?? "관리자"} 검증` : ""}</p></button><div className="flex flex-wrap items-center justify-end gap-2"><span className="text-xs font-semibold text-emerald-700">성공 {batch.success_count}</span><span className={batch.failed_count ? "text-xs font-semibold text-red-700" : "text-xs text-slate-400"}>실패 {batch.failed_count}</span><Button size="sm" variant="outline" onClick={() => void exportBatch(batch)}><Download />대조 CSV</Button>{batch.verification_status !== "VERIFIED" && batch.status === "COMPLETED" && batch.failed_count === 0 && batch.success_count === batch.total_rows && <Button size="sm" onClick={() => void verifyBatch(batch)} disabled={verifying === batch.id}>{verifying === batch.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}검증 확정</Button>}<button type="button" className="rounded p-1 hover:bg-slate-200" onClick={() => void toggle(batch.id)} aria-label="상세 이력 열기">{expanded === batch.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div></div>{expanded === batch.id && <div className="border-t bg-slate-50 px-4 py-3">{(entries[batch.id] ?? []).length ? <div className="space-y-2">{entries[batch.id].map((entry) => <div key={entry.id} className="grid gap-1 rounded border bg-white px-3 py-2 text-xs sm:grid-cols-[70px_100px_150px_130px_1fr]"><span>{entry.source_row}행</span><span className={entry.status === "SUCCESS" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{entry.status === "SUCCESS" ? "성공" : "실패"}</span><span>{entry.job_id ? <Link href={`/jobs/${entry.job_id}`} className="font-semibold text-blue-800">{entry.job_no ?? "Job 보기"}</Link> : entry.job_no ?? "-"}</span><span>{entry.certification_no ?? "-"}</span><span>{entry.error_message ?? "정상 등록"}</span></div>)}</div> : <p className="text-xs text-slate-500">상세 이력을 불러오는 중이거나 기록이 없습니다.</p>}</div>}</div>)}</div>}
  </section>;
}

function formatDateTime(value: string) { return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function downloadCsv(rows: unknown[][], fileName: string) { const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
