"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { prototypeCandidateId, prototypeJobId, prototypeWorkflowLabels, readPrototypeApplications, readPrototypeWorkflow, type PrototypeApplicationRecord } from "@/lib/prototype-storage";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { readBoundedRows } from "@/lib/bounded-row-reader";
type LinkedJobRow = { id: string; job_no: string; management_no: number; standard: string; grade: string; certification_state: PrototypeApplicationRecord["certificationState"]; primary_owner_id: string | null };

export function useLinkedRecordsState(revision = 0) {
  const [records, setRecords] = useState<PrototypeApplicationRecord[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!hasEnvVars) { setRecords(readPrototypeApplications()); setNotice(""); return; }
    setRecords([]); setNotice("신청·Job 업무기록을 조회하고 있습니다.");
    const load = async () => {
      try {
      const supabase = createClient();
      const data = await readBoundedRows((from, to) => supabase.from("applications").select("*, candidates(id, name, name_en, birth_date, nationality, email, phone), jobs(id, job_no, management_no, standard, grade, certification_state, primary_owner_id)", { count: "exact" }).order("received_at", { ascending: false }).order("id", { ascending: true }).range(from, to), row => row?.id, () => cancelled);
      if (cancelled) return;
      if (!data) throw new Error("신청 조회 실패");
      const applicationIds = data.map((item) => item.id);
      const workspaces = new Map<string, PrototypeApplicationRecord["workflow"]>();
      for (let start = 0; start < applicationIds.length; start += 100) {
        const ids = applicationIds.slice(start, start + 100);
        const workspaceRows = await readBoundedRows((from, to) => supabase.from("application_workspaces").select("application_id, state", { count: "exact" }).in("application_id", ids).order("application_id", { ascending: true }).range(from, to), row => ids.includes(row?.application_id) ? row.application_id : undefined, () => cancelled, ids.length);
        if (cancelled) return;
        if (!workspaceRows) throw new Error("업무기록 조회 실패");
        workspaceRows.forEach(workspace => {
          if (!workspace.state || typeof workspace.state !== "object" || Array.isArray(workspace.state)) throw new Error("업무기록 구성 확인 실패");
          workspaces.set(workspace.application_id, workspace.state as PrototypeApplicationRecord["workflow"]);
        });
      }
      const ownerIds = [...new Set(data.flatMap((item) => ((Array.isArray(item.jobs) ? item.jobs : []) as LinkedJobRow[]).map((job) => job.primary_owner_id).filter((ownerId): ownerId is string => Boolean(ownerId))))];
      const ownerNames = new Map<string, string>();
      for (let start = 0; start < ownerIds.length; start += 100) {
        const ids = ownerIds.slice(start, start + 100);
        const profiles = await readBoundedRows((from, to) => supabase.from("profiles").select("id, display_name", { count: "exact" }).in("id", ids).order("id", { ascending: true }).range(from, to), row => ids.includes(row?.id) ? row.id : undefined, () => cancelled, ids.length);
        if (cancelled) return;
        if (!profiles) throw new Error("담당자 조회 실패");
        profiles.forEach(profile => ownerNames.set(profile.id, profile.display_name));
      }
      const mapped: PrototypeApplicationRecord[] = data.flatMap((item) => {
        const candidate = Array.isArray(item.candidates) ? item.candidates[0] : item.candidates;
        const jobRows = (Array.isArray(item.jobs) ? item.jobs : []) as LinkedJobRow[];
        return jobRows.map((job) => ({ id: item.id, candidateId: candidate?.id, jobId: job.id, certificationState: job.certification_state, applicationNo: item.application_no, receivedAt: item.received_at, candidateName: candidate?.name ?? "이름 미입력", candidateNameEn: candidate?.name_en ?? undefined, candidateBirthDate: candidate?.birth_date ?? undefined, candidateNationality: candidate?.nationality ?? undefined, candidateEmail: candidate?.email ?? undefined, candidatePhone: candidate?.phone ?? undefined, businessArea: item.business_area, scheme: item.accreditation_scheme === "PJLA" ? "PJLA" : "IAS", accreditationTrack: item.accreditation_track, accreditationHidden: item.accreditation_hidden, applicationType: item.application_type, managementNo: job.management_no, jobNo: job.job_no, standard: job.standard, grade: job.grade, partnerCompany: item.partner_name_snapshot, primaryOwner: job.primary_owner_id ? ownerNames.get(job.primary_owner_id) ?? "담당자 미확인" : "담당자 미지정", status: "INTAKE_REVIEW", createdAt: item.created_at, workflow: workspaces.get(item.id) ?? undefined }));
      });
      if (!cancelled) { setRecords(mapped); setNotice(""); }
      } catch { if (!cancelled) { setRecords([]); setNotice("신청·Job 업무기록을 조회하지 못했습니다. 연결 또는 접근권한을 확인한 뒤 다시 조회해 주세요. 조회 실패는 기록 없음이 아닙니다."); } }
    };
    void load();
    return () => { cancelled = true; };
  }, [revision]);
  return { records, notice };
}

export function useLinkedRecords() { return useLinkedRecordsState().records; }

function candidateLink(record: PrototypeApplicationRecord) { return record.candidateId ? `/candidates/${record.candidateId}` : `/candidates/${prototypeCandidateId(record)}`; }
function jobLink(record: PrototypeApplicationRecord) { return `/jobs/${prototypeJobId(record)}`; }

export function PrototypeTotal({ base, unit }: { base: number; unit: string }) { const records = useLinkedRecords(); return <>{base + records.length}{unit}</>; }

export function PrototypeCandidateRows() {
  const records = useLinkedRecords();
  return <>{records.map((record) => <tr key={`${record.id}-${record.jobNo}`} className="bg-blue-50/30 hover:bg-blue-50"><td className="px-5 py-4 font-semibold text-blue-800"><Link href={candidateLink(record)}>{record.candidateName}</Link><span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px]">DB</span></td><td className="px-5 py-4 text-slate-600">{record.candidateNameEn || "미입력"}</td><td className="px-5 py-4 text-slate-600">{record.candidatePhone || "미입력"}</td><td className="px-5 py-4 text-slate-600">{record.candidateEmail || "미입력"}</td><td className="px-5 py-4 text-slate-600">{record.candidateNationality || "미입력"}</td><td className="px-5 py-4">1건</td><td className="px-5 py-4"><Link href={jobLink(record)}>{record.jobNo}</Link></td></tr>)}</>;
}

export function PrototypeJobRows() {
  const records = useLinkedRecords();
  return <>{records.map((record) => { const workflow = readPrototypeWorkflow(record); const certificate = workflow.certificates?.[record.jobId ?? prototypeJobId(record)]; return <tr key={`${record.id}-${record.jobNo}`} className="bg-blue-50/30 hover:bg-blue-50"><td className="px-5 py-4 font-semibold text-blue-800"><Link href={jobLink(record)}>{record.jobNo}</Link></td><td className="px-5 py-4"><Link href={candidateLink(record)}>{record.candidateName}</Link></td><td className="px-5 py-4">{record.partnerCompany}</td><td className="px-5 py-4">{record.standard}<br/><span className="text-xs text-slate-500">{record.grade}</span></td><td className="px-5 py-4">{workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "기본정보 확인 중"}</td><td className="px-5 py-4 font-medium text-slate-700">{certificate?.certificationNo || "미발행"}</td><td className="px-5 py-4 text-slate-600">{certificate?.issueDate || "-"}</td><td className="px-5 py-4 text-slate-600">{certificate?.expiryDate || "-"}</td><td className="px-5 py-4">{certificate?.issueDate ? "인증 완료" : "미인증"}</td><td className="px-5 py-4">{record.primaryOwner}</td></tr>; })}</>;
}

export function PrototypePackageCards() {
  const records = useLinkedRecords();
  return <>{records.map((record) => { const workflow = readPrototypeWorkflow(record); const completed = workflow.stage === "COMPLETED" || workflow.generated; return <div key={`${record.id}-${record.jobNo}`} className="rounded-lg border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><Link href={jobLink(record)} className="font-semibold text-blue-800">{record.jobNo}</Link><p className="mt-1 text-sm text-slate-500">{record.candidateName} · {record.standard} · {record.grade}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${completed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{completed ? "패키지 완료" : workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "업무기록 대기"}</span></div><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-slate-600"><p>{completed ? "패키지 문서를 생성하고 다운로드할 수 있습니다." : "신청 처리화면에서 서류검토·심의·발행 기록을 계속 입력할 수 있습니다."}</p><Link href={`/applications/${record.id}?tab=package`} className="font-medium text-blue-800 underline">패키지 처리화면</Link></div></div>; })}</>;
}
