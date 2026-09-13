"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, FolderOpen, RotateCcw, Search } from "lucide-react";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { Button } from "@/components/ui/button";
import { getCandidate, jobs } from "@/data/mock-data";
import { accreditationLabels, applicationStatusLabels, applications, businessAreaLabels } from "@/data/workflow-data";

const controlClass = "h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200";
type SortKey = "received-desc" | "received-asc" | "candidate" | "standard" | "partner" | "status";

export function ApplicationsTable() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("ALL");
  const [standard, setStandard] = useState("ALL");
  const [grade, setGrade] = useState("ALL");
  const [partner, setPartner] = useState("ALL");
  const [track, setTrack] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("received-desc");

  const standards = useMemo(() => [...new Set(jobs.map((job) => job.standard))].sort(), []);
  const grades = useMemo(() => [...new Set(jobs.map((job) => job.currentGrade))].sort(), []);
  const partners = useMemo(() => [...new Set(applications.map((item) => item.partnerCompany))].sort(), []);

  const rows = useMemo(() => applications.map((application) => {
    const candidate = getCandidate(application.candidateId)!;
    const linkedJobs = jobs.filter((job) => application.jobIds.includes(job.id));
    return { application, candidate, linkedJobs };
  }).filter(({ application, candidate, linkedJobs }) => {
    const haystack = `${application.applicationNo} ${candidate.name} ${application.partnerCompany} ${linkedJobs.map((job) => `${job.jobNo} ${job.standard} ${job.currentGrade}`).join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase())
      && (area === "ALL" || application.businessArea === area)
      && (standard === "ALL" || linkedJobs.some((job) => job.standard === standard))
      && (grade === "ALL" || linkedJobs.some((job) => job.currentGrade === grade))
      && (partner === "ALL" || application.partnerCompany === partner)
      && (track === "ALL" || application.accreditationTrack === track)
      && (status === "ALL" || application.status === status);
  }).sort((a, b) => {
    if (sort === "received-desc") return b.application.receivedAt.localeCompare(a.application.receivedAt);
    if (sort === "received-asc") return a.application.receivedAt.localeCompare(b.application.receivedAt);
    if (sort === "candidate") return a.candidate.name.localeCompare(b.candidate.name, "ko");
    if (sort === "partner") return a.application.partnerCompany.localeCompare(b.application.partnerCompany, "ko");
    if (sort === "standard") return (a.linkedJobs[0]?.standard ?? "").localeCompare(b.linkedJobs[0]?.standard ?? "");
    return applicationStatusLabels[a.application.status].localeCompare(applicationStatusLabels[b.application.status], "ko");
  }), [area, grade, partner, query, sort, standard, status, track]);

  const reset = () => { setQuery(""); setArea("ALL"); setStandard("ALL"); setGrade("ALL"); setPartner("ALL"); setTrack("ALL"); setStatus("ALL"); setSort("received-desc"); };

  return <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
    <div className="border-b bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="신청번호, 후보자, 파트너사, Job No. 검색"/></label><label className="flex items-center gap-2 text-xs font-medium text-slate-500"><ArrowUpDown className="h-4 w-4"/><select className={controlClass} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="received-desc">접수일 최신순</option><option value="received-asc">접수일 오래된순</option><option value="candidate">후보자명순</option><option value="standard">표준명순</option><option value="partner">파트너사순</option><option value="status">상태명순</option></select></label><Button type="button" variant="outline" onClick={reset}><RotateCcw/>초기화</Button></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <Filter value={area} onChange={setArea} allLabel="전체 분야" options={[["ISO","ISO"],["K_BEAUTY","K-Beauty"]]}/>
        <Filter value={standard} onChange={setStandard} allLabel="전체 표준" options={standards.map((value) => [value,value])}/>
        <Filter value={grade} onChange={setGrade} allLabel="전체 등급" options={grades.map((value) => [value,value])}/>
        <Filter value={partner} onChange={setPartner} allLabel="전체 파트너사" options={partners.map((value) => [value,value])}/>
        <Filter value={track} onChange={setTrack} allLabel="전체 인정구분" options={[["ACCREDITED","인정"],["NON_ACCREDITED","비인정"]]}/>
        <Filter value={status} onChange={setStatus} allLabel="전체 상태" options={Object.entries(applicationStatusLabels)}/>
      </div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr>{["신청번호","공식 접수일","후보자","분야 / 인정","신청구분","관리 No.","표준 / 등급 / Job No.","파트너사","Dropbox 폴더","현재상태","담당자"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{rows.map(({ application, candidate, linkedJobs }) => <tr key={application.id} className="hover:bg-blue-50/40"><td className="px-4 py-4 font-semibold text-blue-800"><Link href={`/applications/${application.id}`}>{application.applicationNo}</Link></td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{application.receivedAt}</td><td className="whitespace-nowrap px-4 py-4 font-medium">{candidate.name}</td><td className="px-4 py-4 text-slate-600">{businessAreaLabels[application.businessArea]}<br/><span className="text-xs text-slate-400">{accreditationLabels[application.accreditationTrack]}</span></td><td className="px-4 py-4">{application.applicationType}</td><td className="px-4 py-4 font-medium">{application.managementNoFrom === application.managementNoTo ? application.managementNoFrom : `${application.managementNoFrom}~${application.managementNoTo}`}</td><td className="min-w-64 px-4 py-4">{linkedJobs.map((job) => <div key={job.id} className="mb-1 last:mb-0"><span className="font-medium">{job.standard}</span><span className="text-slate-500"> · {job.currentGrade} · {job.jobNo}</span></div>)}</td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{application.partnerCompany}</td><td className="max-w-56 px-4 py-4"><div className="flex items-start gap-2"><FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"/><span className="truncate text-xs text-slate-600">{application.dropboxFolderName}</span></div></td><td className="px-4 py-4"><ApplicationStatusBadge status={application.status}/></td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{application.primaryOwner}</td></tr>)}</tbody></table></div>
    <div className="border-t px-5 py-3 text-xs text-slate-500">조회 결과 {rows.length}건 / 전체 {applications.length}건</div>
  </section>;
}

function Filter({ value, onChange, allLabel, options }: { value: string; onChange: (value: string) => void; allLabel: string; options: Array<[string, string]> }) { return <select className={controlClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="ALL">{allLabel}</option>{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>; }
