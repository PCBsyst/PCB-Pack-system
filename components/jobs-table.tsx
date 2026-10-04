"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordedJobCertificationState } from "@/lib/job-list-state";
import { useLinkedRecordsState } from "@/components/prototype-linked-rows";
import { certificationStateLabels, getCandidate, getCurrentCycle, jobs, statusLabels } from "@/data/mock-data";
import { prototypeJobId, prototypeWorkflowLabels, readPrototypeWorkflow } from "@/lib/prototype-storage";

const controlClass = "h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200";

export function JobsTable() {
  const [revision, setRevision] = useState(0);
  const { records, notice } = useLinkedRecordsState(revision);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState("ALL");
  const [certification, setCertification] = useState("ALL");
  const [standard, setStandard] = useState("ALL");
  const [grade, setGrade] = useState("ALL");
  const [partner, setPartner] = useState("ALL");
  const [owner, setOwner] = useState("ALL");
  const options = useMemo(() => ({
    standards: [...new Set([...records.map((record) => record.standard), ...jobs.map((job) => job.standard)])].sort(),
    grades: [...new Set([...records.map((record) => record.grade), ...jobs.map((job) => job.currentGrade)])].sort(),
    partners: [...new Set([...records.map((record) => record.partnerCompany), ...jobs.map((job) => job.partnerCompany)])].sort(),
    owners: [...new Set([...records.map((record) => record.primaryOwner), ...jobs.map((job) => job.primaryOwner)])].sort(),
  }), [records]);
  const databaseRows = useMemo(() => records.map((record) => {
    const workflow = readPrototypeWorkflow(record);
    const certificate = workflow.certificates?.[record.jobId ?? prototypeJobId(record)];
    const certificationState = recordedJobCertificationState(record.certificationState);
    return { record, workflow, certificate, certificationState };
  }).filter(({ record, workflow, certificate, certificationState }) => {
    const text = `${record.jobNo} ${record.candidateName} ${record.partnerCompany} ${record.standard} ${record.grade} ${certificate?.certificationNo ?? ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase())
      && (progress === "ALL" || (workflow.stage ?? "UNKNOWN") === progress)
      && (certification === "ALL" || certificationState === certification)
      && (standard === "ALL" || record.standard === standard)
      && (grade === "ALL" || record.grade === grade)
      && (partner === "ALL" || record.partnerCompany === partner)
      && (owner === "ALL" || record.primaryOwner === owner);
  }), [certification, grade, owner, partner, progress, query, records, standard]);
  const mockRows = useMemo(() => jobs.map((job) => ({ job, candidate: getCandidate(job.candidateId)!, cycle: getCurrentCycle(job) })).filter(({ job, candidate, cycle }) => {
    const text = `${job.jobNo} ${candidate.name} ${job.partnerCompany} ${job.standard} ${job.currentGrade} ${job.certificationNo ?? ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase())
      && (progress === "ALL" || cycle?.status === progress)
      && (certification === "ALL" || job.certificationState === certification)
      && (standard === "ALL" || job.standard === standard)
      && (grade === "ALL" || job.currentGrade === grade)
      && (partner === "ALL" || job.partnerCompany === partner)
      && (owner === "ALL" || job.primaryOwner === owner);
  }), [certification, grade, owner, partner, progress, query, standard]);
  const reset = () => { setQuery(""); setProgress("ALL"); setCertification("ALL"); setStandard("ALL"); setGrade("ALL"); setPartner("ALL"); setOwner("ALL"); };
  return <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card p-4"><p role="status" className="text-sm text-muted-foreground">{notice || "인증상태는 저장된 유지·정지·철회 값을 표시합니다. 발행일·만료일로 자동 변경하지 않습니다."}</p><Button type="button" variant="outline" onClick={() => setRevision((value) => value + 1)}><RotateCcw/>서버 기록 다시 조회</Button></div><div className="border-b bg-slate-50/70 p-4"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job No., 후보자명, 파트너사, 인증번호 검색"/></label><Button type="button" variant="outline" onClick={reset}><RotateCcw/>초기화</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6"><Filter value={progress} onChange={setProgress} label="전체 진행상태" options={[...Object.entries(prototypeWorkflowLabels), ["UNKNOWN", "진행상태 미확인"]]}/><Filter value={certification} onChange={setCertification} label="전체 인증상태" options={[...Object.entries(certificationStateLabels), ["UNKNOWN", "인증상태 미확인"]]}/><Filter value={standard} onChange={setStandard} label="전체 표준" options={options.standards.map((value) => [value, value])}/><Filter value={grade} onChange={setGrade} label="전체 등급" options={options.grades.map((value) => [value, value])}/><Filter value={partner} onChange={setPartner} label="전체 파트너사" options={options.partners.map((value) => [value, value])}/><Filter value={owner} onChange={setOwner} label="전체 담당자" options={options.owners.map((value) => [value, value])}/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr>{["Job No.","후보자","파트너사","인증규격 / 등급","진행상태","인증번호","인증발행일","만료일","인증상태","주 담당자"].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{databaseRows.map(({ record, workflow, certificate, certificationState }) => <tr key={record.jobId ?? `${record.id}-${record.jobNo}`} className="bg-blue-50/30 hover:bg-blue-50"><CellLink href={`/jobs/${prototypeJobId(record)}`} value={record.jobNo}/><td className="px-5 py-4 font-medium">{record.candidateName}</td><td className="px-5 py-4 text-slate-600">{record.partnerCompany}</td><td className="px-5 py-4">{record.standard}<br/><span className="text-xs text-slate-500">{record.grade}</span></td><td className="px-5 py-4"><Badge value={workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "기본정보 확인 중"}/></td><td className="px-5 py-4 font-medium">{certificate?.certificationNo || "미발행"}</td><td className="px-5 py-4 text-slate-600">{certificate?.issueDate || "-"}</td><td className="px-5 py-4 text-slate-600">{certificate?.expiryDate || "-"}</td><td className="px-5 py-4"><Badge value={certificationState === "UNKNOWN" ? "인증상태 미확인" : certificationStateLabels[certificationState]}/></td><td className="px-5 py-4 text-slate-600">{record.primaryOwner}</td></tr>)}{mockRows.map(({ job, candidate, cycle }) => <tr key={job.id} className="hover:bg-slate-50"><CellLink href={`/jobs/${job.id}`} value={job.jobNo}/><td className="px-5 py-4">{candidate.name}</td><td className="px-5 py-4 text-slate-600">{job.partnerCompany}</td><td className="px-5 py-4">{job.standard}<br/><span className="text-xs text-slate-500">{job.currentGrade}</span></td><td className="px-5 py-4"><Badge value={cycle ? statusLabels[cycle.status] : "진행 회차 없음"}/></td><td className="px-5 py-4 font-medium">{job.certificationNo ?? "미발행"}</td><td className="px-5 py-4 text-slate-600">{job.certificationIssueDate ?? "-"}</td><td className="px-5 py-4 text-slate-600">{job.certificationExpiryDate ?? "-"}</td><td className="px-5 py-4"><Badge value={certificationStateLabels[job.certificationState]}/></td><td className="px-5 py-4 text-slate-600">{job.primaryOwner}</td></tr>)}{!notice && databaseRows.length + mockRows.length === 0 && <tr><td colSpan={10} className="px-5 py-14 text-center text-slate-500">조건에 맞는 Job이 없습니다.</td></tr>}</tbody></table></div><div className="border-t px-5 py-3 text-xs text-slate-500">등록 Job {databaseRows.length}건 · 기본 샘플 {mockRows.length}건{notice ? " · 서버 조회 미확인: 수량은 확정값이 아닙니다." : ""} · 발행정보는 저장된 신청 업무 입력 기준이며 인증원장과 별도 대조가 필요합니다.</div></section>;
}

function Filter({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<[string, string]> }) { return <select className={controlClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="ALL">{label}</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>; }
function CellLink({ href, value }: { href: string; value: string }) { return <td className="px-5 py-4 font-semibold text-blue-800"><Link href={href}>{value}</Link></td>; }
function Badge({ value }: { value: string }) { return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{value}</span>; }
