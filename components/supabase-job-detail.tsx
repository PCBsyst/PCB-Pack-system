"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { prototypeWorkflowLabels, type PrototypeWorkflowSnapshot } from "@/lib/prototype-storage";

type JobView = {
  id: string;
  jobNo: string;
  managementNo: number;
  businessArea: string;
  accreditationTrack: string;
  standard: string;
  grade: string;
  certificationState: string;
  applicationId: string;
  applicationNo: string;
  applicationType: string;
  receivedAt: string;
  partner: string;
  candidateId: string;
  candidateName: string;
  candidateNameEn: string;
  workflow: PrototypeWorkflowSnapshot;
};

export function SupabaseJobDetail({ id }: { id: string }) {
  const [view, setView] = useState<JobView | null>();
  const [error, setError] = useState("");
  useEffect(() => {
    const supabase = createClient();
    void supabase.from("jobs").select("*, candidates(id, name, name_en), applications(id, application_no, application_type, received_at, partner_name_snapshot, application_workspaces(state))").eq("id", id).single().then(({ data, error: loadError }) => {
      if (loadError || !data) { setError(loadError?.message ?? "Job을 찾지 못했습니다."); setView(null); return; }
      const candidate = Array.isArray(data.candidates) ? data.candidates[0] : data.candidates;
      const application = Array.isArray(data.applications) ? data.applications[0] : data.applications;
      const workspace = Array.isArray(application?.application_workspaces) ? application.application_workspaces[0] : application?.application_workspaces;
      setView({ id: data.id, jobNo: data.job_no, managementNo: data.management_no, businessArea: data.business_area, accreditationTrack: data.accreditation_track, standard: data.standard, grade: data.grade, certificationState: data.certification_state, applicationId: application?.id ?? data.application_id, applicationNo: application?.application_no ?? "-", applicationType: application?.application_type ?? "-", receivedAt: application?.received_at ?? "-", partner: application?.partner_name_snapshot ?? "-", candidateId: candidate?.id ?? data.candidate_id, candidateName: candidate?.name ?? "이름 미입력", candidateNameEn: candidate?.name_en ?? "미입력", workflow: (workspace?.state ?? {}) as PrototypeWorkflowSnapshot });
    });
  }, [id]);

  if (view === undefined) return <p className="text-sm text-slate-500">Job 정보를 불러오는 중입니다.</p>;
  if (!view) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error || "Job 정보를 불러오지 못했습니다."}</div>;
  const certificate = view.workflow.certificates?.[view.id];
  const stage = view.workflow.stage ? prototypeWorkflowLabels[view.workflow.stage] : "기본정보 확인 중";

  return <div className="space-y-5">
    <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4"/>Job 목록</Link>
    <section className="rounded-lg border bg-white p-5 shadow-sm"><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5"><Summary label="Job No." value={view.jobNo}/><Summary label="관리 No." value={String(view.managementNo)}/><Summary label="인증규격" value={view.standard}/><Summary label="현재등급" value={view.grade}/><Summary label="현재 업무단계" value={stage}/></div></section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">후보자 및 신청 연결정보</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="후보자명" value={view.candidateName}/><Info label="영문명" value={view.candidateNameEn}/><Info label="신청번호" value={view.applicationNo}/><Info label="신청구분" value={view.applicationType}/><Info label="공식 접수일" value={view.receivedAt}/><Info label="파트너사" value={view.partner}/><Info label="발행 분야" value={view.businessArea === "ISO" ? "ISO 경영시스템 심사원" : "K-Beauty 전문가 자격"}/><Info label="인정 구분" value={view.accreditationTrack === "ACCREDITED" ? "인정" : "비인정"}/></dl><div className="mt-5 flex flex-wrap gap-3"><Link href={`/candidates/${view.candidateId}`} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium text-blue-800"><UserRound className="h-4 w-4"/>후보자 상세</Link><Link href={`/applications/${view.applicationId}`} className="inline-flex items-center gap-1 rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white"><ExternalLink className="h-4 w-4"/>신청 작업화면</Link></div></section>
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">인증 및 발행정보</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="인증상태" value={certificate?.issueDate ? "인증 완료" : view.certificationState === "NONE" ? "미인증" : view.certificationState}/><Info label="인증번호" value={certificate?.certificationNo || "미발행"}/><Info label="초안 발행일" value={certificate?.draftIssuedAt || "미입력"}/><Info label="인증서 발행일" value={certificate?.issueDate || "미입력"}/><Info label="만료일" value={certificate?.expiryDate || "미입력"}/><Info label="원본 송부일" value={certificate?.originalSentAt || "미입력"}/><Info label="운송장 번호" value={certificate?.trackingNumber || "미입력"}/></dl><p className="mt-5 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">업무 기록과 인증정보 수정은 신청 작업화면에서 처리하며, 저장값은 이 Job 상세에 자동 반영됩니다.</p></section>
    </div>
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1.5 font-semibold text-slate-900">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-medium text-slate-900">{value}</dd></div>; }
