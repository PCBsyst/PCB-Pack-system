"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, controlClass } from "@/components/form-fields";
import { createClient } from "@/lib/supabase/client";

type CandidateForm = { name: string; nameEn: string; birthDate: string; nationality: string; email: string; phone: string; address: string };
type CandidateJob = { id: string; application_id: string; job_no: string; standard: string; grade: string; certification_state: string };
const emptyForm: CandidateForm = { name: "", nameEn: "", birthDate: "", nationality: "", email: "", phone: "", address: "" };

export function SupabaseCandidateDetail({ id }: { id: string }) {
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [jobs, setJobs] = useState<CandidateJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("candidates").select("*").eq("id", id).single(),
      supabase.from("jobs").select("id, application_id, job_no, standard, grade, certification_state").eq("candidate_id", id).order("created_at", { ascending: false }),
    ]).then(([candidateResult, jobsResult]) => {
      if (candidateResult.error || !candidateResult.data) setNotice(candidateResult.error?.message ?? "후보자 정보를 찾지 못했습니다.");
      else {
        const candidate = candidateResult.data;
        setForm({ name: candidate.name ?? "", nameEn: candidate.name_en ?? "", birthDate: candidate.birth_date ?? "", nationality: candidate.nationality ?? "", email: candidate.email ?? "", phone: candidate.phone ?? "", address: candidate.address ?? "" });
      }
      if (jobsResult.data) setJobs(jobsResult.data as CandidateJob[]);
      setLoading(false);
    });
  }, [id]);

  const update = (key: keyof CandidateForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    if (!form.name.trim()) { setNotice("후보자명은 반드시 입력해야 합니다."); return; }
    setSaving(true); setNotice("");
    const { error } = await createClient().from("candidates").update({ name: form.name.trim(), name_en: form.nameEn.trim() || null, birth_date: form.birthDate || null, nationality: form.nationality.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null }).eq("id", id);
    setSaving(false);
    setNotice(error ? `저장하지 못했습니다: ${error.message}` : "후보자 기본정보를 저장했습니다. 신청 상세와 생성 문서에도 변경값이 반영됩니다.");
  }

  if (loading) return <p className="text-sm text-slate-500">후보자 정보를 불러오는 중입니다.</p>;
  return <div className="space-y-5">
    <Link href="/candidates" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4"/>후보자 목록</Link>
    <section className="rounded-lg border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">후보자 기본정보</h2><p className="mt-1 text-sm text-slate-500">수정한 정보는 이 후보자의 신청 상세와 문서 생성에 공통 적용됩니다.</p></div><Button type="button" disabled={saving} className="bg-blue-800 hover:bg-blue-900" onClick={save}><Save/>{saving ? "저장 중..." : "변경사항 저장"}</Button></div><div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="후보자명" required><input className={controlClass} value={form.name} onChange={(event) => update("name", event.target.value)}/></Field><Field label="영문명"><input className={controlClass} value={form.nameEn} onChange={(event) => update("nameEn", event.target.value)} placeholder="예: HONG GIL DONG"/></Field><Field label="생년월일"><input type="date" className={controlClass} value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)}/></Field><Field label="국적"><input className={controlClass} value={form.nationality} onChange={(event) => update("nationality", event.target.value)}/></Field><Field label="이메일"><input type="email" className={controlClass} value={form.email} onChange={(event) => update("email", event.target.value)}/></Field><Field label="전화번호"><input type="tel" className={controlClass} value={form.phone} onChange={(event) => update("phone", event.target.value)}/></Field><Field label="주소" className="sm:col-span-2"><input className={controlClass} value={form.address} onChange={(event) => update("address", event.target.value)}/></Field></div>{notice && <div role="status" className="border-t bg-blue-50 px-6 py-3 text-sm font-medium text-blue-900">{notice}</div>}<div className="flex justify-end border-t bg-slate-50 px-6 py-4"><Button type="button" disabled={saving} className="bg-blue-800 hover:bg-blue-900" onClick={save}><Save/>{saving ? "저장 중..." : "변경사항 저장"}</Button></div></section>
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">보유 Job</h2><p className="mt-1 text-sm text-slate-500">후보자에게 연결된 Job과 신청 작업화면입니다.</p></div><span className="text-sm font-medium text-slate-500">{jobs.length}건</span></div><div className="divide-y">{jobs.map((job) => <Link key={job.id} href={`/applications/${job.application_id}`} className="flex items-center gap-3 p-5 hover:bg-slate-50"><span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-800"><BriefcaseBusiness className="h-5 w-5"/></span><div className="flex-1"><p className="font-semibold text-blue-800">{job.job_no}</p><p className="mt-1 text-sm text-slate-600">{job.standard} · {job.grade}</p></div><span className="text-xs text-slate-500">신청 작업화면</span></Link>)}{jobs.length === 0 && <p className="p-6 text-sm text-slate-500">연결된 Job이 없습니다.</p>}</div></section>
  </div>;
}
