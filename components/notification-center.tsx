"use client";

import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Clock3, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { missingWorkflowItems } from "@/lib/workflow-completeness";
import type { PrototypeApplicationRecord, PrototypeWorkflowSnapshot } from "@/lib/prototype-storage";

type NotificationItem = {
  id: string;
  applicationId: string;
  applicationNo: string;
  candidateName: string;
  jobNo: string;
  stage: string;
  createdAt: string;
  completed: boolean;
  missing: string[];
};

const stageLabels: Record<string, string> = {
  DOCUMENT_REVIEW: "서류검토가 필요합니다",
  INVOICE_PENDING: "인보이스 발행이 필요합니다",
  PAYMENT_PENDING: "입금 확인을 기다리고 있습니다",
  DECISION_PENDING: "인증심의가 필요합니다",
  CERTIFICATE_DRAFT_PENDING: "인증서 초안 발행이 필요합니다",
  CERTIFICATION_INFO_PENDING: "인증서 전자본 발행이 필요합니다",
  ORIGINAL_DELIVERY_PENDING: "인증서 원본 송부 확인이 필요합니다",
  PACKAGE_READY: "최종 패키지 생성이 필요합니다",
  COMPLETED: "인증업무가 완료되었습니다",
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try { setDismissed(JSON.parse(window.localStorage.getItem("dismissed-notifications") ?? "[]")); } catch { setDismissed([]); }
    if (!hasEnvVars) return;
    const supabase = createClient();
    void supabase.from("applications").select("id, application_no, received_at, created_at, status, business_area, accreditation_scheme, accreditation_track, accreditation_hidden, application_type, management_no_from, partner_name_snapshot, candidates(name), jobs(id, job_no, management_no, standard, grade), application_workspaces(state)").order("created_at", { ascending: false }).limit(30).then(({ data }) => {
      if (!data) return;
      setItems(data.flatMap((row) => {
        const candidate = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
        const workspace = Array.isArray(row.application_workspaces) ? row.application_workspaces[0] : row.application_workspaces;
        const state = (workspace?.state ?? {}) as PrototypeWorkflowSnapshot;
        const stage = state?.stage ?? (row.status === "COMPLETED" ? "COMPLETED" : "DOCUMENT_REVIEW");
        const jobRows = Array.isArray(row.jobs) ? row.jobs : [];
        return jobRows.map((job) => {
          const record: PrototypeApplicationRecord = { id: row.id, candidateId: undefined, jobId: job.id, applicationNo: row.application_no, receivedAt: row.received_at, candidateName: candidate?.name ?? "후보자 미입력", businessArea: row.business_area, scheme: row.accreditation_scheme === "PJLA" ? "PJLA" : "IAS", accreditationTrack: row.accreditation_track, accreditationHidden: row.accreditation_hidden, applicationType: row.application_type, managementNo: job.management_no, jobNo: job.job_no, standard: job.standard, grade: job.grade, partnerCompany: row.partner_name_snapshot, primaryOwner: "로그인 사용자", status: "INTAKE_REVIEW", createdAt: row.created_at, workflow: state };
          const missing = missingWorkflowItems(record, state);
          return { id: `${row.id}:${job.id}:${stage}`, applicationId: row.id, applicationNo: row.application_no, candidateName: candidate?.name ?? "후보자 미입력", jobNo: job.job_no, stage, createdAt: row.created_at, completed: stage === "COMPLETED" && missing.length === 0, missing };
        });
      }));
    });
  }, []);

  const visible = useMemo(() => items.filter((item) => !item.completed || !dismissed.includes(item.id)), [dismissed, items]);
  const activeCount = items.filter((item) => !item.completed).length;
  const dismiss = (id: string) => {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    window.localStorage.setItem("dismissed-notifications", JSON.stringify(next));
  };

  return <div className="relative">
    <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={`알림 ${activeCount}건`} onClick={() => setOpen((value) => !value)}>
      <Bell className="h-5 w-5" />
      {activeCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-white">{activeCount > 99 ? "99+" : activeCount}</span>}
    </button>
    {open && <>
      <button className="fixed inset-0 z-30 cursor-default" aria-label="알림 닫기" onClick={() => setOpen(false)}/>
      <div className="absolute right-0 top-11 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3"><div><p className="font-semibold text-slate-950">업무 알림</p><p className="mt-0.5 text-xs text-slate-500">진행 중 {activeCount}건 · 모든 실무자 공통</p></div></div>
        <div className="max-h-[26rem] overflow-y-auto">
          {visible.map((item) => <div key={item.id} className={`relative border-b p-4 last:border-b-0 ${item.completed ? "bg-slate-50" : "bg-white"}`}>
            <Link href={`/applications/${item.applicationId}`} onClick={() => setOpen(false)} className="block pr-7">
              <div className="flex items-center gap-2">{item.completed ? <CheckCircle2 className="h-4 w-4 text-emerald-600"/> : item.missing.length ? <AlertTriangle className="h-4 w-4 text-amber-600"/> : <Clock3 className="h-4 w-4 text-blue-600"/>}<p className="text-sm font-semibold text-slate-900">{item.candidateName} · {item.jobNo}</p></div>
              <p className="mt-1.5 text-sm text-slate-600">{item.missing.length ? `입력 확인: ${item.missing.join(" · ")}` : stageLabels[item.stage] ?? "진행 상태를 확인해 주세요"}</p>
              {!item.completed && <p className="mt-1 text-xs text-slate-400">업무가 완료되면 자동으로 종료됩니다.</p>}
            </Link>
            {item.completed && <button className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="경미한 알림 닫기" onClick={() => dismiss(item.id)}><X className="h-4 w-4"/></button>}
          </div>)}
          {visible.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">확인할 알림이 없습니다.</div>}
        </div>
      </div>
    </>}
  </div>;
}
