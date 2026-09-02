import Link from "next/link";
import { FolderOpen, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { Button } from "@/components/ui/button";
import { getCandidate, jobs } from "@/data/mock-data";
import { accreditationLabels, applications, businessAreaLabels } from "@/data/workflow-data";

export default function ApplicationsPage() {
  return <AppShell title="신청 관리" description="대표메일 접수부터 복수 Job, 청구, 심의와 패키지까지 신청 단위로 관리합니다." actions={<Button asChild className="bg-blue-800 hover:bg-blue-900"><Link href="/applications/new"><Plus />신규 신청 등록</Link></Button>}>
    <div className="mb-5 grid gap-4 md:grid-cols-2">
      <Link href="/applications?area=ISO" className="rounded-lg border border-blue-100 bg-blue-50 p-5"><p className="text-xs font-semibold text-blue-700">ISO</p><p className="mt-2 text-lg font-semibold text-slate-950">ISO 경영시스템 심사원</p><p className="mt-1 text-sm text-slate-600">신청 {applications.filter((item) => item.businessArea === "ISO").length}건</p></Link>
      <Link href="/applications?area=K_BEAUTY" className="rounded-lg border border-rose-100 bg-rose-50 p-5"><p className="text-xs font-semibold text-rose-700">K-BEAUTY</p><p className="mt-2 text-lg font-semibold text-slate-950">K-Beauty 전문가 자격</p><p className="mt-1 text-sm text-slate-600">신청 {applications.filter((item) => item.businessArea === "K_BEAUTY").length}건</p></Link>
    </div>
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className="h-9 w-full rounded-md border pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-200" placeholder="신청번호, 후보자, 파트너사, Job No. 검색"/></label><select className="h-9 rounded-md border bg-white px-3 text-sm"><option>전체 분야</option><option>ISO 경영시스템 심사원</option><option>K-Beauty 전문가 자격</option></select><select className="h-9 rounded-md border bg-white px-3 text-sm"><option>전체 인정구분</option><option>인정</option><option>비인정</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr>{["신청번호","공식 접수일","후보자","분야 / 체계","신청구분","관리 No.","포함 Job","Dropbox 폴더","현재상태","담당자"].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{applications.map((application) => {
        const candidate = getCandidate(application.candidateId)!;
        const linkedJobs = jobs.filter((job) => application.jobIds.includes(job.id));
        return <tr key={application.id} className="hover:bg-blue-50/40"><td className="px-5 py-4 font-semibold text-blue-800"><Link href={`/applications/${application.id}`}>{application.applicationNo}</Link></td><td className="px-5 py-4 text-slate-600">{application.receivedAt}</td><td className="px-5 py-4 font-medium">{candidate.name}</td><td className="px-5 py-4 text-slate-600">{businessAreaLabels[application.businessArea]}<br/><span className="text-xs text-slate-400">{accreditationLabels[application.accreditationTrack]}</span></td><td className="px-5 py-4">{application.applicationType}</td><td className="px-5 py-4 font-medium">{application.managementNoFrom === application.managementNoTo ? application.managementNoFrom : `${application.managementNoFrom}~${application.managementNoTo}`}</td><td className="px-5 py-4 text-slate-600">{linkedJobs.map((job) => job.standard).join(", ")}</td><td className="max-w-[260px] px-5 py-4"><div className="flex items-start gap-2"><FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"/><span className="truncate text-xs text-slate-600">{application.dropboxFolderName}</span></div></td><td className="px-5 py-4"><ApplicationStatusBadge status={application.status}/></td><td className="px-5 py-4 text-slate-600">{application.primaryOwner}</td></tr>;
      })}</tbody></table></div><div className="border-t px-5 py-3 text-xs text-slate-500">총 {applications.length}건</div>
    </section>
  </AppShell>;
}
