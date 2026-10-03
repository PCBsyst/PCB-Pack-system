"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BellRing, BriefcaseBusiness, ClipboardList, CreditCard, PackageCheck, ShieldAlert, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { accreditationLabels, businessAreaLabels } from "@/data/workflow-data";
import { prototypeApplicationStatus, prototypeWorkflowLabels, readPrototypeApplications, readPrototypeWorkflow, type PrototypeApplicationRecord } from "@/lib/prototype-storage";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { missingWorkflowItems } from "@/lib/workflow-completeness";
import { DashboardPaymentQueue } from "@/components/dashboard-payment-queue";
import { dashboardMetrics } from "@/lib/dashboard-metrics";
import { DashboardExpiryQueue } from "@/components/dashboard-expiry-queue";

type DashboardJobRow = { id: string; job_no: string; management_no: number; standard: string; grade: string; primary_owner_id: string | null };

export default function DashboardPage() {
  const [records, setRecords] = useState<PrototypeApplicationRecord[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [refresh, setRefresh] = useState(0);
  const [checkedAt, setCheckedAt] = useState("");
  useEffect(() => {
    let active = true;
    setLoadState("loading");
    setRecords([]);
    if (!hasEnvVars) { setRecords(readPrototypeApplications()); setLoadState("ready"); return; }
    const supabase = createClient();
    void Promise.resolve(supabase.from("applications").select("*, candidates(id, name), jobs(id, job_no, management_no, standard, grade, primary_owner_id), application_workspaces(state)").order("received_at", { ascending: false }).order("id").range(0, 499)).then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data) { setLoadState("error"); return; }
      let allData = data;
      if (data.length === 500) {
        for (let offset = 500; ; offset += 500) {
          const next = await supabase.from("applications").select("*, candidates(id, name), jobs(id, job_no, management_no, standard, grade, primary_owner_id), application_workspaces(state)").order("received_at", { ascending: false }).order("id").range(offset, offset + 499);
          if (!active) return;
          if (next.error) { setLoadState("error"); return; }
          allData = allData.concat(next.data ?? []);
          if ((next.data?.length ?? 0) < 500) break;
        }
      }
      if (!data) return;
      const ownerIds = [...new Set(allData.flatMap((item) => ((Array.isArray(item.jobs) ? item.jobs : []) as DashboardJobRow[]).map((job) => job.primary_owner_id).filter((ownerId): ownerId is string => Boolean(ownerId))))];
      const { data: profiles } = ownerIds.length ? await supabase.from("profiles").select("id, display_name").in("id", ownerIds) : { data: [] };
      const ownerNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
      const mapped: PrototypeApplicationRecord[] = allData.flatMap((item) => {
        const candidate = Array.isArray(item.candidates) ? item.candidates[0] : item.candidates;
        const workspace = Array.isArray(item.application_workspaces) ? item.application_workspaces[0] : item.application_workspaces;
        const jobRows = (Array.isArray(item.jobs) ? item.jobs : []) as DashboardJobRow[];
        // Job 미부여 접수 건도 신청 현황에 포함하되 실제 Job을 생성하지 않습니다.
        if (!jobRows.length) jobRows.push({ id: "", job_no: "Job 미부여", management_no: 0, standard: "분야 확인 중", grade: "미확정", primary_owner_id: null });
        return jobRows.map((job) => ({ id: item.id, candidateId: candidate?.id, jobId: job.id, applicationNo: item.application_no, receivedAt: item.received_at, candidateName: candidate?.name ?? "이름 미입력", businessArea: item.business_area, scheme: item.accreditation_scheme === "PJLA" ? "PJLA" : "IAS", accreditationTrack: item.accreditation_track, accreditationHidden: item.accreditation_hidden, applicationType: item.application_type, managementNo: job.management_no, jobNo: job.job_no, standard: job.standard, grade: job.grade, partnerCompany: item.partner_name_snapshot, primaryOwner: job.primary_owner_id ? ownerNames.get(job.primary_owner_id) ?? "담당자 미확인" : "담당자 미지정", status: "INTAKE_REVIEW", createdAt: item.created_at, workflow: workspace?.state ?? {} }));
      });
      if (!active) return;
      setRecords(mapped); setLoadState("ready"); setCheckedAt(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }));
    }).catch(() => { if (active) setLoadState("error"); });
    return () => { active = false; };
  }, [refresh]);

  const metrics = useMemo(() => dashboardMetrics(records.map((record) => ({ applicationId: record.id, jobId: hasEnvVars ? record.jobId ?? "" : record.jobId ?? record.jobNo, businessArea: record.businessArea, workflow: readPrototypeWorkflow(record) }))), [records]);

  const cards = [
    { label: "진행 중 신청", value: metrics.active, icon: ClipboardList, href: "/applications" },
    { label: "전체 Job", value: metrics.jobs, icon: BriefcaseBusiness, href: "/jobs" },
    { label: "보완 대기 신청", value: metrics.supplement, icon: ShieldAlert, href: "/status" },
    { label: "입금 대기 신청", value: metrics.payment, icon: CreditCard, href: "/status" },
    { label: "패키지 준비 신청", value: metrics.packageReady, icon: PackageCheck, href: "/packages" },
  ];
  const attentionItems = useMemo(() => records.map((record) => {
    const workflow = readPrototypeWorkflow(record);
    return { record, workflow, missing: missingWorkflowItems(record, workflow) };
  }).filter(({ workflow, missing }) => workflow.stage !== "COMPLETED" || missing.length > 0).sort((a, b) => Number(b.missing.length > 0) - Number(a.missing.length > 0)).slice(0, 6), [records]);

  return <AppShell title="Dashboard" description="Supabase 공유 데이터를 기준으로 현재 인증업무 현황을 표시합니다.">
    <DashboardPaymentQueue/>
    <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 text-sm"><p role="status">{loadState === "loading" ? "업무 현황을 조회하고 있습니다." : loadState === "error" ? "업무 현황 조회에 실패했습니다. 로컬 데이터를 대신 표시하지 않습니다." : hasEnvVars ? `공유 DB 조회 완료 · ${checkedAt}` : "로컬 가상데이터 현황"}</p><button disabled={loadState === "loading"} className="rounded border px-3 py-2 disabled:opacity-50" onClick={() => setRefresh((value) => value + 1)}>업무 현황 새로고침</button></div>
    {loadState === "ready" && <>
    {metrics.intake > 0 && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-amber-50 p-4 text-sm"><p>Job 부여 전 접수 {metrics.intake}건 · 기본정보와 신청 분야를 먼저 확인하세요.</p><Link href="/applications" className="font-semibold text-blue-700 underline">신청관리로 이동</Link></div>}
    <p className="mb-3 text-xs text-slate-500">신청 지표는 신청 ID로 중복 제거합니다. 전체 Job과 분야별 Job은 Job 기준이며, 위 인보이스 대기 건수와는 집계 단위가 다릅니다.</p>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, icon: Icon, href }) => <Link href={href} key={label} className="group rounded-lg border bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-600">{label}</span><span className="rounded-md bg-slate-100 p-2 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-800"><Icon className="h-4 w-4"/></span></div><p className="mt-4 text-3xl font-semibold text-slate-950">{value}<span className="ml-1 text-sm font-normal text-slate-500">건</span></p></Link>)}</section>
    <section className="mt-6 grid gap-4 md:grid-cols-2"><Link href="/applications?area=ISO" className="rounded-lg border border-blue-100 bg-blue-50 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-blue-700">ISO</p><p className="mt-2 text-lg font-semibold">ISO 경영시스템 심사원</p><p className="mt-1 text-sm text-slate-600">현재 Job {metrics.iso}건</p></div><ArrowRight className="h-5 w-5 text-blue-800"/></div></Link><Link href="/applications?area=K_BEAUTY" className="rounded-lg border border-rose-100 bg-rose-50 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-rose-700">K-BEAUTY</p><p className="mt-2 text-lg font-semibold">K-Beauty 전문가 자격</p><p className="mt-1 text-sm text-slate-600">현재 Job {metrics.beauty}건</p></div><ArrowRight className="h-5 w-5 text-rose-800"/></div></Link></section>
    <section className="mt-6 overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><div className="flex items-start gap-3"><span className="rounded-md bg-amber-50 p-2 text-amber-700"><BellRing className="h-4 w-4"/></span><div><h2 className="font-semibold">우선 확인 업무</h2><p className="mt-1 text-sm text-slate-500">모든 실무자가 함께 확인할 진행 업무와 입력 누락 항목입니다.</p></div></div><Link href="/status" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700">통합현황 <ArrowRight className="h-4 w-4"/></Link></div><div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">{attentionItems.map(({ record, workflow, missing }) => <Link key={`${record.id}-${record.jobNo}`} href={`/applications/${record.id}`} className="flex items-center justify-between gap-4 border-b p-4 hover:bg-slate-50 md:[&:nth-last-child(-n+2)]:border-b-0"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{record.candidateName} · {record.jobNo}</p>{missing.length > 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600"/>}</div><p className="mt-1 truncate text-xs text-slate-500">{missing.length ? `입력 확인: ${missing.join(" · ")}` : `${workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "신규 접수"} 처리가 필요합니다.`}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400"/></Link>)}{attentionItems.length === 0 && <p className="col-span-2 p-8 text-center text-sm text-slate-500">현재 확인할 진행 업무가 없습니다.</p>}</div></section>
    <section className="mt-6 overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">최근 신청 및 처리 현황</h2><p className="mt-1 text-sm text-slate-500">최근 신청·Job 행 10건을 표시합니다. Job 미부여 접수도 포함됩니다.</p></div><Link href="/applications" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700">전체 보기 <ArrowRight className="h-4 w-4"/></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr>{["신청번호", "접수일", "후보자", "분야 / 체계", "관리 No.", "Job", "상태", "담당자"].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{records.slice(0, 10).map((record) => { const workflow = readPrototypeWorkflow(record); return <tr key={`${record.id}-${record.jobNo}`} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-blue-800"><Link href={`/applications/${record.id}`}>{record.applicationNo}</Link></td><td className="px-5 py-4 text-slate-600">{record.receivedAt}</td><td className="px-5 py-4"><Link href={record.candidateId ? `/candidates/${record.candidateId}` : `/applications/${record.id}`}>{record.candidateName}</Link></td><td className="px-5 py-4 text-slate-600">{businessAreaLabels[record.businessArea]}<br/><span className="text-xs text-slate-400">{accreditationLabels[record.accreditationTrack]}</span></td><td className="px-5 py-4">{record.jobId || !hasEnvVars ? record.managementNo : "-"}</td><td className="px-5 py-4 text-slate-600"><Link href={record.jobId ? `/jobs/${record.jobId}` : `/applications/${record.id}`}>{record.jobNo} · {record.standard}</Link></td><td className="px-5 py-4"><ApplicationStatusBadge status={prototypeApplicationStatus(workflow)}/><p className="mt-1 text-[11px] text-slate-400">{workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "신규 접수"}</p></td><td className="px-5 py-4 text-slate-600">{record.primaryOwner}</td></tr>; })}{records.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">등록된 공유 데이터가 없습니다.</td></tr>}</tbody></table></div></section>
    <section className="mt-6 rounded-lg border bg-slate-900 p-5 text-white"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-blue-300"/><div><p className="font-semibold">공통 후보자, 독립된 신청과 Job</p><p className="mt-1 text-sm text-slate-300">동일 후보자의 여러 세부 분야도 후보자 화면에서 연결해 추적할 수 있습니다.</p></div></div></section>
    </>}
    <DashboardExpiryQueue/>
  </AppShell>;
}
