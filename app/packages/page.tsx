import Link from "next/link";
import { Download, FileArchive, FileText, PackageCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getCandidate, getJob } from "@/data/mock-data";
import { packageDocuments } from "@/data/workflow-data";

export default function PackagesPage() {
  const grouped = [...new Set(packageDocuments.map((document) => document.jobId))];
  return <AppShell title="패키지" description="Job별 문서 패키지를 생성하고 Word·PDF 개별 또는 ZIP으로 내려받습니다." actions={<Button className="bg-blue-800 hover:bg-blue-900"><PackageCheck/>선택 패키지 일괄 생성</Button>}>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><Stat label="생성 완료" value={grouped.filter((jobId) => packageDocuments.some((document) => document.jobId === jobId && document.status === "GENERATED")).length}/><Stat label="생성 준비" value={grouped.filter((jobId) => packageDocuments.some((document) => document.jobId === jobId && document.status === "READY")).length}/><Stat label="지원 형식" value="Word · PDF · ZIP"/></div>
    <section className="space-y-4">{grouped.map((jobId) => { const job = getJob(jobId); if (!job) return null; const candidate = getCandidate(job.candidateId); const documents = packageDocuments.filter((document) => document.jobId === jobId); return <div key={jobId} className="rounded-lg border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center"><input type="checkbox" className="h-4 w-4"/><div className="flex-1"><Link href={`/jobs/${job.id}`} className="font-semibold text-blue-800">{job.jobNo}</Link><p className="mt-1 text-sm text-slate-500">{candidate?.name} · {job.standard} · {job.currentGrade}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{documents.every((document) => document.status === "GENERATED") ? "패키지 완료" : "생성 준비"}</span></div><div className="grid gap-3 p-5 md:grid-cols-2">{documents.map((document) => <div key={document.id} className="flex items-center gap-3 rounded-md border p-3"><FileText className="h-5 w-5 text-slate-500"/><div className="flex-1"><p className="text-sm font-medium">{document.title}</p><p className="text-xs text-slate-400">{document.formats.join(" · ")} · {document.templateVersion}</p></div><Button size="sm" variant="outline"><Download className="h-3.5 w-3.5"/>다운로드</Button></div>)}</div><div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3"><Button variant="outline"><FileArchive/>ZIP 다운로드</Button><Button className="bg-blue-800 hover:bg-blue-900"><PackageCheck/>패키지 생성</Button></div></div>; })}</section>
  </AppShell>;
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>; }
