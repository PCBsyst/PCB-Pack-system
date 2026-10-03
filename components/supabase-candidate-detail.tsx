"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, controlClass, textareaClass } from "@/components/form-fields";
import { createClient } from "@/lib/supabase/client";
import { CandidateArchivePanel } from "@/components/candidate-archive-panel";
import { CandidateDeletePanel } from "@/components/candidate-delete-panel";
import { CandidateConflictNotice } from "@/components/candidate-conflict-notice";
import { candidateFormFromRow, changedCandidateFields, type CandidateForm } from "@/lib/candidate-form";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

type CandidateJob = { id: string; application_id: string; job_no: string; standard: string; grade: string; certification_state: string };
type AuditRow = { id: number; occurred_at: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null; correction_reason: string | null };
const emptyForm: CandidateForm = { name: "", nameEn: "", birthDate: "", nationality: "", email: "", phone: "", address: "" };

export function SupabaseCandidateDetail({ id }: { id: string }) {
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [savedForm, setSavedForm] = useState<CandidateForm>(emptyForm);
  const [savedAt, setSavedAt] = useState("");
  const [candidateLoaded, setCandidateLoaded] = useState(false);
  const [jobs, setJobs] = useState<CandidateJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [rowVersion, setRowVersion] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const [latestForm, setLatestForm] = useState<CandidateForm | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [archiveState, setArchiveState] = useState<{ available: boolean; date: string | null; reason: string | null }>({ available: false, date: null, reason: null });
  const dirty = changedCandidateFields(form, savedForm).length > 0 || Boolean(correctionReason.trim());
  useUnsavedChanges(dirty || saving);
  const refreshLogs = async () => {
    const { data } = await createClient().from("audit_logs").select("id, occurred_at, before_data, after_data, correction_reason").eq("table_name", "candidates").eq("record_id", id).eq("action", "UPDATE").order("occurred_at", { ascending: false });
    if (data) setAuditLogs(data as AuditRow[]);
  };

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.rpc("read_candidate_with_access_log", { target_id: id }),
      supabase.from("jobs").select("id, application_id, job_no, standard, grade, certification_state").eq("candidate_id", id).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("id, occurred_at, before_data, after_data, correction_reason").eq("table_name", "candidates").eq("record_id", id).eq("action", "UPDATE").order("occurred_at", { ascending: false }),
    ]).then(([candidateResult, jobsResult, auditResult]) => {
      if (candidateResult.error || !candidateResult.data) setNotice(candidateResult.error?.message ?? "후보자 정보를 찾지 못했습니다.");
      else {
        const candidate = candidateResult.data;
        setRowVersion(typeof candidate.row_version === "number" ? candidate.row_version : null);
        setArchiveState({ available: Object.hasOwn(candidate, "archived_at"), date: candidate.archived_at ?? null, reason: candidate.archive_reason ?? null });
        setForm(candidateFormFromRow(candidate));
        setSavedForm(candidateFormFromRow(candidate));
        setSavedAt(candidate.updated_at ?? "");
        setCandidateLoaded(true);
      }
      if (jobsResult.data) setJobs(jobsResult.data as CandidateJob[]);
      if (auditResult.data) setAuditLogs(auditResult.data as AuditRow[]);
      setLoading(false);
    });
  }, [id]);

  const update = (key: keyof CandidateForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function reloadLatest() {
    if (!window.confirm("미저장 입력과 수정 사유를 버리고 최신 정보를 불러올까요?")) return;
    setSaving(true);
    try {
      const { data, error } = await createClient().rpc("read_candidate_with_access_log", { target_id: id });
      if (error || !data) throw new Error("최신 후보자 정보를 조회하지 못했습니다.");
      setForm(candidateFormFromRow(data));
      setSavedForm(candidateFormFromRow(data));
      setSavedAt(data.updated_at ?? "");
      setRowVersion(typeof data.row_version === "number" ? data.row_version : null);
      setArchiveState({ available: Object.hasOwn(data, "archived_at"), date: data.archived_at ?? null, reason: data.archive_reason ?? null });
      setReloadKey((current) => current + 1);
      setCorrectionReason(""); setLatestForm(null); setConflict(false);
      setNotice("최신 정보를 불러왔습니다. 필요한 항목을 다시 수정하고 사유를 입력해 주세요.");
      await refreshLogs();
    } catch (error) { setNotice(error instanceof Error ? error.message : "조회에 실패했습니다. 내 입력은 유지합니다."); }
    finally { setSaving(false); }
  }
  async function save() {
    if (saving || conflict) return;
    if (!candidateLoaded) { setNotice("후보자 정보를 정상 조회한 뒤 수정해 주세요."); return; }
    if (!form.name.trim()) { setNotice("후보자명은 반드시 입력해야 합니다."); return; }
    if (!correctionReason.trim()) { setNotice("변경 사유를 입력해야 저장할 수 있습니다."); return; }
    setSaving(true); setNotice("");
    const supabase = createClient();
    try {
      const fields = { candidate_id: id, candidate_name: form.name, candidate_name_en: form.nameEn, candidate_birth_date: form.birthDate || null, candidate_nationality: form.nationality, candidate_email: form.email, candidate_phone: form.phone, candidate_address: form.address, correction_reason: correctionReason };
      const { data, error } = await supabase.rpc(rowVersion === null ? "update_candidate_with_reason" : "update_candidate_with_reason_v2", rowVersion === null ? fields : { ...fields, expected_version: rowVersion });
      if (error?.code === "40001") {
        setConflict(true); setNotice("다른 변경이 있어 저장하지 않았습니다. 내 입력은 유지됩니다.");
        const result = await supabase.rpc("read_candidate_with_access_log", { target_id: id });
        setLatestForm(result.error || !result.data ? null : candidateFormFromRow(result.data));
        return;
      }
      if (error) throw new Error(error.message);
      if (!data) throw new Error("저장 결과를 확인하지 못했습니다.");
      setForm(candidateFormFromRow(data));
      setSavedForm(candidateFormFromRow(data));
      setSavedAt(data.updated_at ?? "");
      setRowVersion(typeof data.row_version === "number" ? data.row_version : null);
      setCorrectionReason("");
      setNotice("후보자 기본정보를 저장했습니다. 변경 전·후 값과 사유가 처리이력에 기록되었습니다.");
      await refreshLogs();
    } catch (error) { setNotice(`저장 결과 확인 실패: ${error instanceof Error ? error.message : "연결 상태를 확인해 주세요."}`); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-slate-500">후보자 정보를 불러오는 중입니다.</p>;
  return <div className="space-y-5">
    <Link href="/candidates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4"/>후보자 목록</Link>
    <CandidateArchivePanel key={reloadKey} id={id} initialDate={archiveState.date} initialReason={archiveState.reason} available={archiveState.available} onChanged={() => { void refreshLogs(); }} />
    {rowVersion === null && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">동시 수정 충돌 보호는 DB 적용 대기입니다. 현재는 기존 저장 방식을 사용합니다.</p>}
    {conflict && <CandidateConflictNotice input={form} latest={latestForm} onReload={() => { if (!saving) void reloadLatest(); }} />}
    <div role="status" className={`rounded-lg border p-3 text-sm ${dirty || saving ? "border-amber-200 bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>{!candidateLoaded ? "후보자 기본정보 조회 완료를 확인하지 못했습니다." : saving ? "저장 또는 최신 정보 조회 중입니다. 완료될 때까지 기다려 주세요." : dirty ? "기본정보에 미저장 입력이 있습니다. 변경사항 저장 버튼을 눌러 주세요." : "기본정보는 조회된 DB 값과 일치합니다."}{savedAt && <span className="mt-1 block text-xs">DB 기록의 마지막 수정 시각: {new Date(savedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>}</div>
    <section className="rounded-lg border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">후보자 기본정보</h2><p className="mt-1 text-sm text-slate-500">수정한 정보는 이 후보자의 신청 상세와 문서 생성에 공통 적용됩니다.</p></div><Button type="button" disabled={saving || conflict} className="bg-blue-800 hover:bg-blue-900" onClick={save}><Save/>{saving ? "저장 중..." : "변경사항 저장"}</Button></div><fieldset disabled={saving} className="grid gap-5 p-6 sm:grid-cols-2"><Field label="후보자명" required><input className={controlClass} value={form.name} onChange={(event) => update("name", event.target.value)}/></Field><Field label="영문명"><input className={controlClass} value={form.nameEn} onChange={(event) => update("nameEn", event.target.value)} placeholder="예: HONG GIL DONG"/></Field><Field label="생년월일"><input type="date" className={controlClass} value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)}/></Field><Field label="국적"><input className={controlClass} value={form.nationality} onChange={(event) => update("nationality", event.target.value)}/></Field><Field label="이메일"><input type="email" className={controlClass} value={form.email} onChange={(event) => update("email", event.target.value)}/></Field><Field label="전화번호"><input type="tel" className={controlClass} value={form.phone} onChange={(event) => update("phone", event.target.value)}/></Field><Field label="주소" className="sm:col-span-2"><input className={controlClass} value={form.address} onChange={(event) => update("address", event.target.value)}/></Field><Field label="변경 사유" required className="sm:col-span-2"><textarea className={textareaClass} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="정보를 수정하는 사유를 입력해 주세요."/></Field></fieldset>{notice && <div role="status" className="border-t bg-blue-50 px-6 py-3 text-sm font-medium text-blue-900">{notice}</div>}<div className="flex justify-end border-t bg-slate-50 px-6 py-4"><Button type="button" disabled={saving || conflict} className="bg-blue-800 hover:bg-blue-900" onClick={save}><Save/>{saving ? "저장 중..." : "변경사항 저장"}</Button></div></section>
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">후보자 변경이력</h2><p className="mt-1 text-sm text-slate-500">변경 전·후 값과 수정 사유가 자동으로 보존됩니다.</p></div><div className="divide-y">{auditLogs.map((log) => <div key={log.id} className="p-5 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{log.before_data?.archived_at !== log.after_data?.archived_at ? (log.after_data?.archived_at ? "후보자 보관" : "후보자 복원") : "후보자 기본정보 수정"}</p><p className="text-xs text-slate-500">{new Date(log.occurred_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p></div><p className="mt-2 text-slate-700">사유: {log.correction_reason || "기존 기록(사유 미입력)"}</p><div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><p><span className="font-medium">변경 전:</span> {candidateSummary(log.before_data)}</p><p><span className="font-medium">변경 후:</span> {candidateSummary(log.after_data)}</p></div></div>)}{auditLogs.length === 0 && <p className="p-6 text-sm text-slate-500">기록된 변경이력이 없습니다.</p>}</div></section>
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">보유 Job</h2><p className="mt-1 text-sm text-slate-500">후보자에게 연결된 Job과 신청 작업화면입니다.</p></div><span className="text-sm font-medium text-slate-500">{jobs.length}건</span></div><div className="divide-y">{jobs.map((job) => <Link key={job.id} href={`/applications/${job.application_id}`} className="flex items-center gap-3 p-5 hover:bg-slate-50"><span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-800"><BriefcaseBusiness className="h-5 w-5"/></span><div className="flex-1"><p className="font-semibold text-blue-800">{job.job_no}</p><p className="mt-1 text-sm text-slate-600">{job.standard} · {job.grade}</p></div><span className="text-xs text-slate-500">신청 작업화면</span></Link>)}{jobs.length === 0 && <p className="p-6 text-sm text-slate-500">연결된 Job이 없습니다.</p>}</div></section>
    <CandidateDeletePanel id={id} />
  </div>;
}

function candidateSummary(data: Record<string, unknown> | null) { if (!data) return "-"; return [data.name, data.name_en, data.birth_date, data.nationality, data.email, data.phone, Object.hasOwn(data, "archived_at") ? (data.archived_at ? "보관 중" : "일반") : null, data.archive_reason].filter(Boolean).join(" · ") || "미입력"; }
