"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Save, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { prototypeWorkflowLabels, type PrototypeWorkflowSnapshot } from "@/lib/prototype-storage";
import { Button } from "@/components/ui/button";
import { Field, controlClass, textareaClass } from "@/components/form-fields";

type AftercareRecord = { id: string; type: "SUSPENDED" | "WITHDRAWN"; reason: string; detail: string; effectiveDate: string; actor: string; recordedAt: string };

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
  previousJobId?: string;
  workflow: PrototypeWorkflowSnapshot;
  aftercareRecords: AftercareRecord[];
};

export function SupabaseJobDetail({ id }: { id: string }) {
  const [view, setView] = useState<JobView | null>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState<AftercareRecord["type"]>("SUSPENDED");
  const [reason, setReason] = useState("자격유지 요구사항 미충족");
  const [detail, setDetail] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reasonOptions, setReasonOptions] = useState({ SUSPENDED: ["자격유지 요구사항 미충족", "인증서 오용", "시정조치 미이행", "기타"], WITHDRAWN: ["중대한 인증서 오용", "정지 후 시정조치 미이행", "본인 요청", "기타"] });
  useEffect(() => {
    const supabase = createClient();
    void supabase.from("jobs").select("*, candidates(id, name, name_en), applications(id, application_no, application_type, received_at, partner_name_snapshot, application_workspaces(state))").eq("id", id).single().then(({ data, error: loadError }) => {
      if (loadError || !data) { setError(loadError?.message ?? "Job을 찾지 못했습니다."); setView(null); return; }
      const candidate = Array.isArray(data.candidates) ? data.candidates[0] : data.candidates;
      const application = Array.isArray(data.applications) ? data.applications[0] : data.applications;
      const workspace = Array.isArray(application?.application_workspaces) ? application.application_workspaces[0] : application?.application_workspaces;
      const workflow = (workspace?.state ?? {}) as PrototypeWorkflowSnapshot & { aftercareRecords?: Record<string, AftercareRecord[]> };
      setView({ id: data.id, jobNo: data.job_no, managementNo: data.management_no, businessArea: data.business_area, accreditationTrack: data.accreditation_track, standard: data.standard, grade: data.grade, certificationState: data.certification_state, applicationId: application?.id ?? data.application_id, applicationNo: application?.application_no ?? "-", applicationType: application?.application_type ?? "-", receivedAt: application?.received_at ?? "-", partner: application?.partner_name_snapshot ?? "-", candidateId: candidate?.id ?? data.candidate_id, candidateName: candidate?.name ?? "이름 미입력", candidateNameEn: candidate?.name_en ?? "미입력", previousJobId: data.previous_job_id ?? undefined, workflow, aftercareRecords: workflow.aftercareRecords?.[data.id] ?? [] });
    });
    void supabase.from("system_settings").select("value").eq("key", "workflow_rules").maybeSingle().then(({ data }) => {
      const value = data?.value as { suspensionReasons?: string; withdrawalReasons?: string } | undefined;
      if (!value) return;
      setReasonOptions({ SUSPENDED: value.suspensionReasons?.split("\n").filter(Boolean) ?? reasonOptions.SUSPENDED, WITHDRAWN: value.withdrawalReasons?.split("\n").filter(Boolean) ?? reasonOptions.WITHDRAWN });
    });
  }, [id]);

  if (view === undefined) return <p className="text-sm text-slate-500">Job 정보를 불러오는 중입니다.</p>;
  if (!view) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error || "Job 정보를 불러오지 못했습니다."}</div>;
  const certificate = view.workflow.certificates?.[view.id];
  const stage = view.workflow.stage ? prototypeWorkflowLabels[view.workflow.stage] : "기본정보 확인 중";
  const stateLabel = view.certificationState === "SUSPENDED" ? "인증 정지" : view.certificationState === "WITHDRAWN" ? "인증 철회" : certificate?.issueDate ? "인증 완료" : "미인증";
  const saveAftercare = async () => {
    if (!certificate?.certificationNo || !certificate.issueDate) { setNotice("인증서 발행이 완료된 Job만 정지·철회 처리할 수 있습니다."); return; }
    if (!reason || !detail.trim() || !effectiveDate) { setNotice("표준 사유, 상세 사유, 효력 발생일을 모두 입력해 주세요."); return; }
    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = userData.user ? await supabase.from("profiles").select("display_name").eq("id", userData.user.id).maybeSingle() : { data: null };
    const record: AftercareRecord = { id: crypto.randomUUID(), type: actionType, reason, detail: detail.trim(), effectiveDate, actor: profile?.display_name ?? "담당자", recordedAt: new Date().toISOString() };
    const existing = view.workflow as PrototypeWorkflowSnapshot & { aftercareRecords?: Record<string, AftercareRecord[]> };
    const state = { ...existing, aftercareRecords: { ...existing.aftercareRecords, [view.id]: [...view.aftercareRecords, record] } };
    const { error: workspaceError } = await supabase.from("application_workspaces").upsert({ application_id: view.applicationId, state }, { onConflict: "application_id" });
    const { error: jobError } = workspaceError ? { error: null } : await supabase.from("jobs").update({ certification_state: actionType }).eq("id", view.id);
    setSaving(false);
    if (workspaceError || jobError) { setNotice(`사후관리 기록을 저장하지 못했습니다: ${(workspaceError ?? jobError)?.message}`); return; }
    setView({ ...view, certificationState: actionType, workflow: state, aftercareRecords: [...view.aftercareRecords, record] });
    setDetail("");
    setNotice(`${actionType === "SUSPENDED" ? "인증 정지" : "인증 철회"} 기록과 상태 변경을 저장했습니다.`);
  };

  return <div className="space-y-5">
    <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4"/>Job 목록</Link>
    <section className="rounded-lg border bg-white p-5 shadow-sm"><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5"><Summary label="Job No." value={view.jobNo}/><Summary label="관리 No." value={String(view.managementNo)}/><Summary label="인증규격" value={view.standard}/><Summary label="현재등급" value={view.grade}/><Summary label="현재 업무단계" value={stage}/></div></section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">후보자 및 신청 연결정보</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="후보자명" value={view.candidateName}/><Info label="영문명" value={view.candidateNameEn}/><Info label="신청번호" value={view.applicationNo}/><Info label="신청구분" value={view.applicationType}/><Info label="공식 접수일" value={view.receivedAt}/><Info label="파트너사" value={view.partner}/><Info label="발행 분야" value={view.businessArea === "ISO" ? "ISO 경영시스템 심사원" : "K-Beauty 전문가 자격"}/><Info label="인정 구분" value={view.accreditationTrack === "ACCREDITED" ? "인정" : "비인정"}/></dl><div className="mt-5 flex flex-wrap gap-3"><Link href={`/candidates/${view.candidateId}`} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium text-blue-800"><UserRound className="h-4 w-4"/>후보자 상세</Link>{view.previousJobId && <Link href={`/jobs/${view.previousJobId}`} className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"><ExternalLink className="h-4 w-4"/>이전 인증 Job</Link>}<Link href={`/applications/${view.applicationId}`} className="inline-flex items-center gap-1 rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white"><ExternalLink className="h-4 w-4"/>신청 작업화면</Link></div></section>
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">인증 및 발행정보</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="인증상태" value={stateLabel}/><Info label="인증번호" value={certificate?.certificationNo || "미발행"}/><Info label="초안 발행일" value={certificate?.draftIssuedAt || "미입력"}/><Info label="인증서 발행일" value={certificate?.issueDate || "미입력"}/><Info label="만료일" value={certificate?.expiryDate || "미입력"}/><Info label="원본 송부일" value={certificate?.originalSentAt || "미입력"}/><Info label="운송장 번호" value={certificate?.trackingNumber || "미입력"}/></dl><p className="mt-5 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">업무 기록과 인증정보 수정은 신청 작업화면에서 처리하며, 저장값은 이 Job 상세에 자동 반영됩니다.</p></section>
    </div>
    <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">인증 정지·철회 관리</h2><p className="mt-1 text-sm text-slate-500">인증번호 단위로 표준 사유와 상세 사유를 기록하며 변경 전후 상태는 감사이력에 보존됩니다.</p></div><div className="p-5">
      {notice && <div role="status" className="mb-5 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice.includes("저장했습니다") ? <CheckCircle2 className="h-4 w-4"/> : <AlertTriangle className="h-4 w-4"/>}{notice}</div>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="처리구분"><select className={controlClass} value={actionType} onChange={(event) => { const value = event.target.value as AftercareRecord["type"]; setActionType(value); setReason(reasonOptions[value][0] ?? "기타"); }}><option value="SUSPENDED">인증 정지</option><option value="WITHDRAWN">인증 철회</option></select></Field><Field label="대상 인증번호"><input className={`${controlClass} bg-slate-50`} value={certificate?.certificationNo || "미발행"} readOnly/></Field><Field label="표준 사유"><select className={controlClass} value={reason} onChange={(event) => setReason(event.target.value)}>{reasonOptions[actionType].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="효력 발생일"><input type="date" className={controlClass} value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)}/></Field><Field label="상세 사유" className="sm:col-span-2"><textarea className={textareaClass} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="정지·철회 보고서에 반영할 구체적인 사유를 입력합니다."/></Field></div>
      <div className="mt-5 flex justify-end"><Button disabled={saving || !certificate?.issueDate} onClick={() => void saveAftercare()}><Save/>{saving ? "저장 중..." : "사후관리 기록 저장"}</Button></div>
      <div className="mt-6 border-t pt-5"><h3 className="text-sm font-semibold">정지·철회 이력</h3>{view.aftercareRecords.length === 0 ? <p className="mt-3 text-sm text-slate-500">기록된 사후관리 이력이 없습니다.</p> : <div className="mt-3 space-y-3">{view.aftercareRecords.slice().reverse().map((record) => <div key={record.id} className="rounded-md border p-4"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.type === "SUSPENDED" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}>{record.type === "SUSPENDED" ? "인증 정지" : "인증 철회"}</span><strong className="text-sm">{record.reason}</strong><span className="ml-auto text-xs text-slate-500">효력일 {record.effectiveDate}</span></div><p className="mt-2 text-sm text-slate-700">{record.detail}</p><p className="mt-2 text-xs text-slate-400">{record.actor} · {new Date(record.recordedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p></div>)}</div>}</div>
    </div></section>
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1.5 font-semibold text-slate-900">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-medium text-slate-900">{value}</dd></div>; }
