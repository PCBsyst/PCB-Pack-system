"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FileArchive, FileText, PackageCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getCandidate, getJob } from "@/data/mock-data";
import { packageDocuments } from "@/data/workflow-data";

export default function PackagesPage() {
  const grouped = useMemo(() => [...new Set(packageDocuments.map((document) => document.jobId))], []);
  const [selected, setSelected] = useState<string[]>([]);
  const [generated, setGenerated] = useState<string[]>(() => grouped.filter((jobId) => packageDocuments.filter((document) => document.jobId === jobId).every((document) => document.status === "GENERATED")));
  const [notice, setNotice] = useState("");

  const toggle = (jobId: string) => setSelected((items) => items.includes(jobId) ? items.filter((id) => id !== jobId) : [...items, jobId]);
  const generate = (jobIds: string[]) => {
    if (!jobIds.length) { setNotice("먼저 패키지를 선택해 주세요."); return; }
    setGenerated((items) => [...new Set([...items, ...jobIds])]);
    setNotice(`${jobIds.length}개 Job의 패키지를 생성 준비 상태로 반영했습니다.`);
  };

  return <AppShell title="패키지" description="Job별 기록 문서를 확인하고 실제 양식 생성 화면으로 이동합니다." actions={<Button className="bg-blue-800 hover:bg-blue-900" onClick={() => generate(selected)}><PackageCheck/>선택 패키지 일괄 생성</Button>}>
    {notice && <div role="status" className="mb-5 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900"><CheckCircle2 className="h-4 w-4"/>{notice}</div>}
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><Stat label="생성 완료" value={generated.length}/><Stat label="전체 Job" value={grouped.length}/><Stat label="지원 형식" value="Word · PDF · ZIP"/></div>
    <section className="space-y-4">{grouped.map((jobId) => { const job = getJob(jobId); if (!job) return null; const candidate = getCandidate(job.candidateId); const documents = packageDocuments.filter((document) => document.jobId === jobId); const applicationHref = job.applicationId ? `/applications/${job.applicationId}?tab=package` : `/jobs/${job.id}`; const isGenerated = generated.includes(jobId); return <div key={jobId} className="rounded-lg border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center"><input type="checkbox" aria-label={`${job.jobNo} 패키지 선택`} checked={selected.includes(jobId)} onChange={() => toggle(jobId)} className="h-4 w-4"/><div className="flex-1"><Link href={`/jobs/${job.id}`} className="font-semibold text-blue-800">{job.jobNo}</Link><p className="mt-1 text-sm text-slate-500">{candidate?.name} · {job.standard} · {job.currentGrade}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isGenerated ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{isGenerated ? "패키지 완료" : "생성 준비"}</span></div><div className="grid gap-3 p-5 md:grid-cols-2">{documents.map((document) => <div key={document.id} className="flex items-center gap-3 rounded-md border p-3"><FileText className="h-5 w-5 text-slate-500"/><div className="flex-1"><p className="text-sm font-medium">{document.title}</p><p className="text-xs text-slate-400">{document.formats.join(" · ")} · {document.templateVersion}</p></div><Button size="sm" variant="outline" asChild><Link href={applicationHref}><ExternalLink className="h-3.5 w-3.5"/>생성 화면</Link></Button></div>)}</div><div className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-5 py-3"><Button variant="outline" asChild><Link href={applicationHref}><FileArchive/>Word·PDF·ZIP 열기</Link></Button><Button className="bg-blue-800 hover:bg-blue-900" onClick={() => generate([jobId])}><PackageCheck/>패키지 생성</Button></div></div>; })}</section>
  </AppShell>;
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>; }
