"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuditRow = { id: number; table_name: string; record_id: string; action: "INSERT" | "UPDATE" | "DELETE"; actor_id: string | null; occurred_at: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null; correction_reason: string | null };

const tableLabels: Record<string, string> = {
  candidates: "후보자 기본정보", applications: "신청정보", jobs: "Job", processing_cycles: "처리 회차",
  document_reviews: "서류검토", invoices: "인보이스·입금", certification_decisions: "인증심의",
  decision_panel_entries: "심의위원 결정", certification_records: "인증정보", document_deliveries: "문서전달",
  package_documents: "패키지 문서",
};
const actionLabels = { INSERT: "등록", UPDATE: "변경", DELETE: "삭제" } as const;
const ignoredFields = new Set(["id", "created_at", "updated_at"]);

function summarize(row: AuditRow) {
  if (row.action === "INSERT") return "신규 기록이 등록되었습니다.";
  if (row.action === "DELETE") return "기록이 삭제되었습니다.";
  const before = row.before_data ?? {};
  const after = row.after_data ?? {};
  const changed = Object.keys(after).filter((key) => !ignoredFields.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  if (!changed.length) return "기록이 갱신되었습니다.";
  return `변경 항목: ${changed.slice(0, 5).join(", ")}${changed.length > 5 ? ` 외 ${changed.length - 5}개` : ""}`;
}

export function SupabaseAuditTrail({ applicationId, candidateId, jobIds, cycleIds }: { applicationId: string; candidateId: string; jobIds: string[]; cycleIds: string[] }) {
  const [rows, setRows] = useState<Array<AuditRow & { actor: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const [reviews, invoices, decisions, records, deliveries, packages] = await Promise.all([
        cycleIds.length ? supabase.from("document_reviews").select("id").in("cycle_id", cycleIds) : Promise.resolve({ data: [] }),
        jobIds.length ? supabase.from("invoice_jobs").select("invoice_id").in("job_id", jobIds) : Promise.resolve({ data: [] }),
        cycleIds.length ? supabase.from("certification_decisions").select("id").in("cycle_id", cycleIds) : Promise.resolve({ data: [] }),
        jobIds.length ? supabase.from("certification_records").select("id").in("job_id", jobIds) : Promise.resolve({ data: [] }),
        cycleIds.length ? supabase.from("document_deliveries").select("id").in("cycle_id", cycleIds) : Promise.resolve({ data: [] }),
        jobIds.length ? supabase.from("package_documents").select("id").in("job_id", jobIds) : Promise.resolve({ data: [] }),
      ]);
      const decisionIds = (decisions.data ?? []).map((item) => item.id);
      const { data: panelEntries } = decisionIds.length ? await supabase.from("decision_panel_entries").select("id").in("decision_id", decisionIds) : { data: [] };
      const recordIds = [...new Set([applicationId, candidateId, ...jobIds, ...cycleIds, ...(reviews.data ?? []).map((item) => item.id), ...(invoices.data ?? []).map((item) => item.invoice_id), ...decisionIds, ...(panelEntries ?? []).map((item) => item.id), ...(records.data ?? []).map((item) => item.id), ...(deliveries.data ?? []).map((item) => item.id), ...(packages.data ?? []).map((item) => item.id)])];
      if (!recordIds.length) { if (active) { setRows([]); setLoading(false); } return; }
      const { data, error } = await supabase.from("audit_logs").select("id, table_name, record_id, action, actor_id, occurred_at, before_data, after_data, correction_reason").in("record_id", recordIds).order("occurred_at", { ascending: false }).limit(200);
      if (error) { if (active) { setNotice("감사이력을 조회하지 못했습니다. 기록이 없는 것으로 판단하지 마세요."); setLoading(false); } return; }
      const logs = (data ?? []) as AuditRow[];
      const actorIds = [...new Set(logs.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
      const { data: profiles } = actorIds.length ? await supabase.from("profiles").select("id, display_name").in("id", actorIds) : { data: [] };
      const actors = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
      if (active) { setRows(logs.map((row) => ({ ...row, actor: row.actor_id ? actors.get(row.actor_id) ?? "직원" : "시스템" }))); setLoading(false); }
    };
    void load().catch(() => { if (active) { setNotice("감사이력 조회에 실패했습니다. 연결 상태를 확인해 주세요."); setLoading(false); } });
    return () => { active = false; };
  }, [applicationId, candidateId, cycleIds, jobIds]);

  if (loading) return <div className="py-8 text-center text-sm text-slate-500">시스템 감사이력을 불러오는 중입니다.</div>;
  if (notice) return <p role="alert" className="py-6 text-sm text-amber-800">{notice}</p>;
  if (!rows.length) return <div className="py-8 text-center text-sm text-slate-500">아직 DB에 기록된 감사이력이 없습니다.</div>;
  return <div className="relative ml-2 border-l border-slate-200 pl-6">{rows.map((row) => <div key={row.id} className="relative pb-6 last:pb-0"><span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${row.correction_reason ? "bg-amber-500" : row.action === "INSERT" ? "bg-emerald-600" : "bg-blue-700"}`}/><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{actionLabels[row.action]}</span><p className="font-semibold">{tableLabels[row.table_name] ?? row.table_name}</p></div><p className="mt-2 text-sm text-slate-700">{summarize(row)}</p>{row.correction_reason && <p className="mt-1 text-sm font-medium text-amber-800">정정 사유: {row.correction_reason}</p>}<p className="mt-1 text-xs text-slate-500">{row.actor} · {new Date(row.occurred_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p><details className="mt-3 rounded-md border bg-slate-50 p-3 text-xs text-slate-600"><summary className="cursor-pointer font-medium">변경 전·후 값 및 추적 ID 보기</summary><p className="mt-2 break-all">기록: {row.id} · 대상: {row.record_id} · 처리자: {row.actor_id ?? "시스템"}</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="font-semibold">변경 전</p><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(row.before_data, null, 2)}</pre></div><div><p className="font-semibold">변경 후</p><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(row.after_data, null, 2)}</pre></div></div></details></div>)}</div>;
}
