"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, controlClass, textareaClass } from "@/components/form-fields";
import { createClient } from "@/lib/supabase/client";

type CandidateForm = { name: string; nameEn: string; birthDate: string; nationality: string; email: string; phone: string; address: string };
type CandidateJob = { id: string; application_id: string; job_no: string; standard: string; grade: string; certification_state: string };
type AuditRow = { id: number; occurred_at: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null; correction_reason: string | null };
const emptyForm: CandidateForm = { name: "", nameEn: "", birthDate: "", nationality: "", email: "", phone: "", address: "" };

export function SupabaseCandidateDetail({ id }: { id: string }) {
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [jobs, setJobs] = useState<CandidateJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("candidates").select("*").eq("id", id).single(),
      supabase.from("jobs").select("id, application_id, job_no, standard, grade, certification_state").eq("candidate_id", id).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("id, occurred_at, before_data, after_data, correction_reason").eq("table_name", "candidates").eq("record_id", id).eq("action", "UPDATE").order("occurred_at", { ascending: false }),
    ]).then(([candidateResult, jobsResult, auditResult]) => {
      if (candidateResult.error || !candidateResult.data) setNotice(candidateResult.error?.message ?? "후보자 정보를 찾지 못했습니다.");
      else {
        const candidate = candidateResult.data;
        setForm({ name: candidate.name ?? "", nameEn: candidate.name_en ?? "", birthDate: candidate.birth_date ?? "", nationality: candidate.nationality ?? "", email: candidate.email ?? "", phone: candidate.phone ?? "", address: candidate.address ?? "" });
      }
      if (jobsResult.data) setJobs(jobsResult.data as CandidateJob[]);
      if (auditResult.data) setAuditLogs(auditResult.data as AuditRow[]);
      setLoading(false);
    });
  }, [id]);

  const update = (key: keyof CandidateForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    if (!form.name.trim()) { setNotice("후보자명은 반드시 입력해야 합니다."); return; }
    if (!correctionReason.trim()) { setNotice("변경 사유를 입력해야 저장할 수 있습니다."); return; }
    setSaving(true); setNotice("");
    const supabase = createClient();
    const { error } = await supabase.rpc("update_candidate_with_reason", { candidate_id: id, candidate_name: form.name, candidate_name_en: form.nameEn, candidate_birth_date: form.birthDate || null, candidate_nationality: form.nationality, candidate_email: form.email, candidate_phone: form.phone, candidate_address: form.address, correction_reason: correctionReason });
    setSaving(false);
    if (error) { setNotice(`저장하지 못했습니다: ${error.message}`); return; }
    setCorrectionReason("");
    setNotice("후보자 기본정보를 저장했습니다. 변경 전·후 값과 사유가 처리이력에 기록되었습니다.");
    const { data: logs } = await supabase.from("audit_logs").select("id, occurred_at, before_data, after_data, correction_reason").eq("table_name", "candidates").eq("record_id", id).eq("action", "UPDATE").order("occurred_at", { ascending: false });
    if (logs) setAuditLogs(logs as AuditRow[]);
  }

  if (loading) return <p className="text-sm text-slate-500">후보자 정보를 불러오는 중입니다.</p>;
  return <div className="space-y-5">
    <Link href="/candidates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4"/>후보자 목록</Link>
    <section className="rounded-lg border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">후보자 기본정보</h2><p className="mt-1 text-sm text-slate-500">수정한 정보는 이 후보자의 신청 상세와 문서 생성에 공통 적용됩니다.</p></div><Button type="button" disabled={saving} className="bg-blue-800 hover:bg-blue-900" onClick={save}><Save/>{saving ? "저장 중..." : "변경사항 저장"}</Button></div><div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="후보자명" required><input className={controlClass} value={form.name} onChange={(event) => update("name", event.target.value)}/></Field><Field label="영문명"><input className={controlClass} value={form.nameEn} onChange={(event) => update("nameEn", event.target.value)} placeholder="예: HONG GIL DONG"/></Field><Field label="생년월일"><input type="date" className={controlClass} value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)}/></Field><Field label="국적"><input className={controlClass} value={form.nationality} onChange={(event) => update("nationality", event.target.value)}/></Field><Field label="이메일"><input type="email" className={controlClass} value={form.email} onChange={(event) => update("email", event.target.value)}/></Field><Field label="전화번호"><input type="tel" className={controlClass} value={form.phone} onChange={(event) => update("phone", event.target.value)}/></Field><Field label="주소" className="sm:col-span-2"><input className={controlClass} value={form.address} onChange={(event) => update("address", event.target.value)}/></Field><Field label="변경 사유" required className="sm:col-span-2"><textarea className={textareaClass} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="정보를 수정하는 사유를 입력해 주세요."/></Field></div>{notice && <div role="status" className="border-t bg-blue-50 px-6 py-3 text-sm font-medium text-blue-900">{notice}</div>}<div className="flex justify-end border-t bg-slate-50 px-6 py-4"><Button type="button" disabled={saving} className="bg-blue-800 hover:bg-blue-900" onClick={save}><Save/>{saving ? "저장 중..." : "변경사항 저장"}</Button></div></section>
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">기본정보 변경이력</h2><p className="mt-1 text-sm text-slate-500">변경 전·후 값과 수정 사유가 자동으로 보존됩니다.</p></div><div className="divide-y">{auditLogs.map((log) => <div key={log.id} className="p-5 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">후보자 기본정보 수정</p><p className="text-xs text-slate-500">{new Date(log.occurred_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p></div><p className="mt-2 text-slate-700">사유: {log.correction_reason || "기존 기록(사유 미입력)"}</p><div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><p><span className="font-medium">변경 전:</span> {candidateSummary(log.before_data)}</p><p><span className="font-medium">변경 후:</span> {candidateSummary(log.after_data)}</p></div></div>)}{auditLogs.length === 0 && <p className="p-6 text-sm text-slate-500">기록된 변경이력이 없습니다.</p>}</div></section>
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">보유 Job</h2><p className="mt-1 text-sm text-slate-500">후보자에게 연결된 Job과 신청 작업화면입니다.</p></div><span className="text-sm font-medium text-slate-500">{jobs.length}건</span></div><div className="divide-y">{jobs.map((job) => <Link key={job.id} href={`/applications/${job.application_id}`} className="flex items-center gap-3 p-5 hover:bg-slate-50"><span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-800"><BriefcaseBusiness className="h-5 w-5"/></span><div className="flex-1"><p className="font-semibold text-blue-800">{job.job_no}</p><p className="mt-1 text-sm text-slate-600">{job.standard} · {job.grade}</p></div><span className="text-xs text-slate-500">신청 작업화면</span></Link>)}{jobs.length === 0 && <p className="p-6 text-sm text-slate-500">연결된 Job이 없습니다.</p>}</div></section>
  </div>;
}

function candidateSummary(data: Record<string, unknown> | null) { if (!data) return "-"; return [data.name, data.name_en, data.birth_date, data.nationality, data.email, data.phone].filter(Boolean).join(" · ") || "미입력"; }
