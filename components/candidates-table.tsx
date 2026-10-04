"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { candidateRecordSummary } from "@/lib/candidate-list-summary";
import { useLinkedRecordsState } from "@/components/prototype-linked-rows";
import { candidates, certificationStateLabels, jobs } from "@/data/mock-data";
import { prototypeCandidateId, prototypeJobId, type PrototypeApplicationRecord } from "@/lib/prototype-storage";

const controlClass = "h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200";
type CandidateGroup = { id: string; name: string; nameEn: string; phone: string; email: string; nationality: string; records: PrototypeApplicationRecord[] };

export function CandidatesTable() {
  const [revision, setRevision] = useState(0);
  const { records, notice: recordsNotice } = useLinkedRecordsState(revision);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("ALL");
  const [standard, setStandard] = useState("ALL");
  const [certification, setCertification] = useState("ALL");
  const [storage, setStorage] = useState("GENERAL");
  const [archiveIds, setArchiveIds] = useState<string[]>([]);
  const [archiveNotice, setArchiveNotice] = useState("보관 상태 확인 중...");
  const [directory, setDirectory] = useState<CandidateGroup[]>([]);
  const [directoryNotice, setDirectoryNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    setDirectory([]); setDirectoryNotice("");
    if (!hasEnvVars) return;
    setDirectoryNotice("전체 후보자 조회 중...");
    const load = async () => {
      try {
        const { data, error } = await createClient().from("candidates").select("id, name, name_en, phone, email, nationality").order("name");
        if (cancelled) return;
        if (error) throw new Error("후보자 조회 실패");
        setDirectory((data ?? []).map((item) => ({ id: item.id, name: item.name, nameEn: item.name_en ?? "", phone: item.phone ?? "", email: item.email ?? "", nationality: item.nationality ?? "", records: [] })));
        setDirectoryNotice("");
      } catch { if (!cancelled) { setDirectory([]); setDirectoryNotice("전체 후보자 조회에 실패했습니다. 연결 업무에서 확인된 후보자만 표시하므로 수량은 확정값이 아닙니다."); } }
    };
    void load();
    return () => { cancelled = true; };
  }, [revision]);
  useEffect(() => {
    let cancelled = false;
    setArchiveIds([]);
    if (!hasEnvVars) { setArchiveNotice("보관 관리: DB 연결 후 사용 가능합니다."); return; }
    setArchiveNotice("보관 상태 확인 중...");
    const load = async () => {
      try {
        const { data, error } = await createClient().from("candidates").select("id, archived_at");
        if (cancelled) return;
        if (error) throw new Error("보관 상태 조회 실패");
        setArchiveIds((data ?? []).filter((item) => item.archived_at).map((item) => item.id));
        setArchiveNotice("");
      } catch { if (!cancelled) { setArchiveIds([]); setArchiveNotice("보관 상태를 확인하지 못했습니다. 일반·보관 분류는 미확인이며 전체 후보자로 표시합니다."); } }
    };
    void load();
    return () => { cancelled = true; };
  }, [revision]);
  const databaseGroups = useMemo(() => {
    const groups = new Map<string, CandidateGroup>(directory.map((item) => [item.id, { ...item, records: [] }]));
    for (const record of records) {
      const id = record.candidateId ?? prototypeCandidateId(record);
      const current = groups.get(id) ?? { id, name: record.candidateName, nameEn: record.candidateNameEn ?? "", phone: record.candidatePhone ?? "", email: record.candidateEmail ?? "", nationality: record.candidateNationality ?? "", records: [] };
      current.records.push(record); groups.set(id, current);
    }
    return [...groups.values()];
  }, [records, directory]);
  const standards = useMemo(() => [...new Set([...records.map((record) => record.standard), ...jobs.map((job) => job.standard)])].sort(), [records]);
  const filteredDatabase = useMemo(() => databaseGroups.filter((group) => {
    if (!archiveNotice && storage !== "ALL" && archiveIds.includes(group.id) !== (storage === "ARCHIVED")) return false;
    const summary = candidateRecordSummary(group.records);
    const text = `${group.name} ${group.nameEn} ${group.phone} ${group.email} ${group.records.map((record) => record.jobNo).join(" ")}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (area === "ALL" || group.records.some((record) => record.businessArea === area)) && (standard === "ALL" || group.records.some((record) => record.standard === standard)) && (certification === "ALL" || (!recordsNotice && summary.certification === certification));
  }), [area, certification, databaseGroups, query, standard, storage, archiveIds, archiveNotice, recordsNotice]);
  const filteredMock = useMemo(() => candidates.map((candidate) => ({ candidate, owned: jobs.filter((job) => job.candidateId === candidate.id) })).filter(({ candidate, owned }) => {
    if (storage === "ARCHIVED") return false;
    const text = `${candidate.name} ${candidate.nameEn} ${candidate.phone} ${candidate.email} ${owned.map((job) => job.jobNo).join(" ")}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (area === "ALL" || owned.some((job) => job.businessArea === area)) && (standard === "ALL" || owned.some((job) => job.standard === standard)) && (certification === "ALL" || (certification === "ACTIVE" ? owned.some((job) => job.certificationState === "ACTIVE") : certification === "NO_ACTIVE" && !owned.some((job) => job.certificationState === "ACTIVE")));
  }), [area, certification, query, standard, storage]);
  const reset = () => { setQuery(""); setArea("ALL"); setStandard("ALL"); setCertification("ALL"); setStorage("GENERAL"); };
  return <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">고객 ID로 통합 표시하며 동명이인은 합치지 않습니다. 인증상태는 저장값을 사용하고 만료일만으로 자동 변경하지 않습니다.</p><Button type="button" variant="outline" onClick={() => setRevision((value) => value + 1)}><RotateCcw/>서버 기록 다시 조회</Button></div>{recordsNotice && <p role="status" className="mb-3 text-sm text-amber-700 dark:text-amber-300">{recordsNotice}</p>}<div className="mb-4 flex flex-wrap items-center gap-3"><label className="text-sm font-medium">보관 상태 <select className={controlClass} value={storage} onChange={(event) => setStorage(event.target.value)} disabled={Boolean(archiveNotice)}><option value="GENERAL">일반 후보자</option><option value="ARCHIVED">보관 후보자</option><option value="ALL">전체 후보자</option></select></label>{directoryNotice && <p role="status" className="text-sm text-amber-800">{directoryNotice}</p>}{archiveNotice && <p role="status" className="text-sm text-amber-800">{archiveNotice}</p>}</div><section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="border-b bg-slate-50/70 p-4"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="후보자명, 영문명, 연락처, 이메일, Job No. 검색"/></label><Button type="button" variant="outline" onClick={reset}><RotateCcw/>초기화</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><Filter value={area} onChange={setArea} label="전체 분야" options={[["ISO", "ISO"], ["K_BEAUTY", "K-Beauty"]]}/><Filter value={standard} onChange={setStandard} label="전체 표준" options={standards.map((value) => [value, value])}/><Filter value={certification} onChange={setCertification} label="전체 인증상태" options={[["ACTIVE", "유지 인증 보유"], ["NO_ACTIVE", "유지 인증 미보유"], ["UNKNOWN", "상태 미확인"]]}/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr>{["후보자명","영문명","연락처","이메일","국적","신청 수 / Job 수","연결 Job","인증상태"].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{filteredDatabase.map((group) => { const summary = candidateRecordSummary(group.records); return <tr key={group.id} className="bg-blue-50/30 hover:bg-blue-50"><NameCell id={group.id} name={group.name}/><td className="px-5 py-4 text-slate-600">{group.nameEn || "미입력"}</td><td className="px-5 py-4 text-slate-600">{group.phone || "미입력"}</td><td className="px-5 py-4 text-slate-600">{group.email || "미입력"}</td><td className="px-5 py-4 text-slate-600">{group.nationality || "미입력"}</td><td className="px-5 py-4 font-medium">{recordsNotice ? "조회 미확인" : `신청 ${summary.applications}건 / Job ${summary.jobs}건`}</td><td className="px-5 py-4"><div className="flex max-w-sm flex-wrap gap-1.5">{summary.records.map((record) => <Link key={record.jobId ?? `${record.id}:${record.jobNo}`} href={`/jobs/${prototypeJobId(record)}`} className="rounded bg-white px-2 py-1 text-xs font-medium text-blue-800 ring-1 ring-slate-200">{record.jobNo}</Link>)}</div></td><td className="px-5 py-4"><Badge value={recordsNotice || summary.certification === "UNKNOWN" ? "인증상태 미확인" : summary.certification === "ACTIVE" ? "유지 인증 보유" : "유지 인증 미보유"} active={!recordsNotice && summary.certification === "ACTIVE"}/></td></tr>; })}{filteredMock.map(({ candidate, owned }) => { const active = owned.some((job) => job.certificationState === "ACTIVE"); return <tr key={candidate.id} className="hover:bg-slate-50"><NameCell id={candidate.id} name={candidate.name}/><td className="px-5 py-4 text-slate-600">{candidate.nameEn}</td><td className="px-5 py-4 text-slate-600">{candidate.phone}</td><td className="px-5 py-4 text-slate-600">{candidate.email}</td><td className="px-5 py-4 text-slate-600">{candidate.nationality}</td><td className="px-5 py-4 font-medium">{new Set(owned.map((job) => job.applicationId)).size}건 / {owned.length}건</td><td className="px-5 py-4"><div className="flex max-w-sm flex-wrap gap-1.5">{owned.map((job) => <Link key={job.id} href={`/jobs/${job.id}`} className="rounded bg-slate-50 px-2 py-1 text-xs text-blue-800">{job.jobNo}</Link>)}</div></td><td className="px-5 py-4"><Badge value={active ? certificationStateLabels.ACTIVE : "유지 인증 미보유"} active={active}/></td></tr>; })}{!recordsNotice && !directoryNotice && filteredDatabase.length + filteredMock.length === 0 && <tr><td colSpan={8} className="px-5 py-14 text-center text-slate-500">조건에 맞는 후보자가 없습니다.</td></tr>}</tbody></table></div><div className="border-t px-5 py-3 text-xs text-slate-500">등록 후보자 {filteredDatabase.length}명 · 기본 샘플 {filteredMock.length}명 · 동일 후보자의 Job은 한 행에 통합 표시됩니다.{(recordsNotice || directoryNotice || (hasEnvVars && archiveNotice)) ? " 조회 미확인 항목이 있어 수량·상태는 확정값이 아닙니다." : ""}</div></section></>;
}

function Filter({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<[string, string]> }) { return <select className={controlClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="ALL">{label}</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>; }
function NameCell({ id, name }: { id: string; name: string }) { return <td className="px-5 py-4 font-semibold text-blue-800"><Link href={`/candidates/${id}`}>{name}</Link></td>; }
function Badge({ value, active }: { value: string; active: boolean }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{value}</span>; }
