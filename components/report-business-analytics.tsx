"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { ReportCertificationEvents } from "@/components/report-certification-events";
import { customerCounts, revenueForJobs, isReportPeriod, matchesReportPeriod, type AnalyticsJob, type RevenueInvoice } from "@/lib/report-analytics";
import { matchesReportMonth } from "@/lib/report-filters";
import type { ReportFilters } from "@/lib/report-filters";
import { reportExportMetadata, reportGroupLabel, serializeReportCsv } from "@/lib/report-export";

const money = (value: number) => Math.round(value).toLocaleString("ko-KR");
const areaLabel = (value: string) => value === "K_BEAUTY" ? "K-Beauty" : value;
const typeLabel = (value: string) => ({ INITIAL: "최초", RENEWAL: "갱신", GRADE_CHANGE: "등급 변경", TRANSFER: "전환" } as Record<string,string>)[value] ?? value;
export function ReportBusinessAnalytics({ jobs, period, dateBasis = "RECEIVED", filters }: { jobs: AnalyticsJob[]; period: string; dateBasis?: "RECEIVED" | "ISSUED"; filters?: ReportFilters }) {
  const customerBasisLabel = dateBasis === "ISSUED" ? "발행" : "접수";
  const validMonth = period.length === 7 && isReportPeriod(period);
  const [invoices, setInvoices] = useState<RevenueInvoice[]>([]);
  const [financeState, setFinanceState] = useState("loading");
  const [financeRevision, setFinanceRevision] = useState(0);
  const [dimension, setDimension] = useState<"businessArea" | "standard" | "grade" | "applicationType">("businessArea");
  const [trendUnit, setTrendUnit] = useState<"month" | "year">("month");
  useEffect(() => {
    setInvoices([]); setFinanceState("loading");
    if (!hasEnvVars) { setFinanceState("prototype"); return; }
    let active = true;
    void (async () => {
      const client = createClient();
      const result: RevenueInvoice[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from("invoices").select("id, amount, paid_amount, issued_at, paid_at, invoice_jobs(job_id)").order("id").range(offset, offset + 499);
        if (!active) return;
        if (error) { setFinanceState("error"); return; }
        if (!Array.isArray(data) || data.some((row) => !row || typeof row.id !== "string" || !Array.isArray(row.invoice_jobs)
          || row.amount === null || row.amount === undefined || String(row.amount).trim() === ""
          || !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0
          || (row.paid_amount !== null && (!Number.isFinite(Number(row.paid_amount)) || Number(row.paid_amount) < 0)))) {
          setFinanceState("error"); return;
        }
        result.push(...(data as unknown as RevenueInvoice[]));
        if ((data?.length ?? 0) < 500) break;
      }
      if (active) { setInvoices([...new Map(result.map((invoice) => [invoice.id, invoice])).values()]); setFinanceState("ready"); }
    })().catch(() => { if (active) setFinanceState("error"); });
    return () => { active = false; };
  }, [financeRevision]);
  const groups = useMemo(() => {
    const names = [...new Set(jobs.map((job) => job[dimension]))].sort();
    return names.map((name) => {
      const all = jobs.filter((job) => job[dimension] === name);
      const selected = all.filter((job) => matchesReportMonth(job, period, dateBasis));
      return { name, ...customerCounts(selected), jobs: selected.length, ...revenueForJobs(invoices, new Set(all.map((job) => job.jobId)), period) };
    });
  }, [jobs, invoices, dimension, period, dateBasis]);
  const trends = useMemo(() => {
    const year = Number(period.slice(0, 4));
    if (!validMonth || !Number.isInteger(year) || year < 1900) return [];
    const periods = trendUnit === "month" ? Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`) : Array.from({ length: 5 }, (_, index) => String(year - 4 + index));
    return periods.map((key) => ({ period: key, ...customerCounts(jobs.filter((job) => matchesReportPeriod(job.receivedAt, key))) }));
  }, [jobs, period, trendUnit, validMonth]);
  function exportSummary() {
    if (!validMonth) return;
    const metadata = reportExportMetadata("고객·수익 분석", period, `${customerBasisLabel}일`, filters);
    const rows = [...metadata, ["고객 집계 기준", customerBasisLabel], ["집계 구분", ({ businessArea: "분야", standard: "표준·세부 분야", grade: "등급", applicationType: "신청 유형" })[dimension]],
      ["수익 기준", "청구·입금 발생월, 통합 인보이스는 전체 연결 Job에 균등 배분한 참고값"],
      ["추이 기준", "접수 기간별 고객의 현재 인증상태 (과거 월말 상태 아님)"], [],
      ["구분", `${customerBasisLabel} 고객 수`, `${customerBasisLabel} Job`, "유지", "정지", "철회", "청구액(KRW, 균등배분)", "입금액(KRW, 균등배분)"],
      ...groups.map((group) => [reportGroupLabel(group.name, dimension), group.total, group.jobs, group.active, group.suspended, group.withdrawn, financeState === "ready" ? group.billed : "미확인", financeState === "ready" ? group.received : "미확인"]), [],
      ["접수 기간", "고객 수", "현재 유지", "현재 정지", "현재 철회"], ...trends.map((row) => [row.period, row.total, row.active, row.suspended, row.withdrawn])];
    const url = URL.createObjectURL(new Blob(["\ufeff", serializeReportCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `고객수익추이_${period}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!validMonth) return <section role="status" className="rounded-xl border bg-card p-5 text-sm">보고서를 조회할 월을 선택해 주세요. 기간을 선택하기 전에는 수익 집계와 다운로드를 제공하지 않습니다.</section>;
  return <section className="space-y-4 rounded-xl border bg-white p-5">
    <p className="text-sm font-medium">고객 집계: {period || "기간 미선택"} · {customerBasisLabel}일 기준. 수익은 청구·입금 발생월, 아래 고객 추이는 접수 기간 기준입니다.</p>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">고객·수익 분석</h2><button className="rounded border px-3 py-2 text-sm" onClick={exportSummary}>분석 CSV 다운로드</button></div>
    <p className="text-xs leading-6 text-slate-500">고객 수는 후보자 ID별 중복을 제거합니다. 같은 고객이 여러 분야·등급·상태에 포함되면 각 행에 집계되므로 합계는 전체 고유 고객 수와 다를 수 있습니다. 고객은 선택한 날짜 기준, 청구액은 인보이스 발행월, 입금액은 실제 입금월 기준입니다. 통합 청구액은 연결된 전체 Job에 균등 배분한 참고값이며 회계상 확정 수익이 아닙니다.</p>
    <div className="flex flex-wrap items-center gap-3"><label className="block text-sm">집계 구분 <select className="ml-2 rounded border bg-white p-2" value={dimension} onChange={(e) => setDimension(e.target.value as typeof dimension)}><option value="businessArea">분야</option><option value="standard">표준·세부 분야</option><option value="grade">등급</option><option value="applicationType">신청 유형</option></select></label><button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={financeState === "loading" || !hasEnvVars} onClick={() => setFinanceRevision((value) => value + 1)}>수익 자료 다시 조회</button></div>
    {financeState !== "ready" && <p role="status" className="text-sm text-amber-700">{financeState === "loading" ? "수익 자료 조회 중" : financeState === "prototype" ? "가상데이터 모드: 수익 DB 미연결" : "수익 자료를 조회하지 못했습니다. 금액을 0원으로 간주하지 않습니다."}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50"><tr>{["구분", `${customerBasisLabel} 고객`, `${customerBasisLabel} Job`, "유지", "정지", "철회", "청구액(원)", "입금액(원)"].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{groups.map((group) => <tr className="border-b" key={group.name}><td className="p-3">{dimension === "businessArea" ? areaLabel(group.name) : dimension === "applicationType" ? typeLabel(group.name) : group.name}</td>{[group.total, group.jobs, group.active, group.suspended, group.withdrawn].map((value, index) => <td className="p-3" key={index}>{value}</td>)}<td className="p-3">{financeState === "ready" ? money(group.billed) : "미확인"}</td><td className="p-3">{financeState === "ready" ? money(group.received) : "미확인"}</td></tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">월·연간 고객 추이</h3><select className="rounded border bg-white p-2 text-sm" value={trendUnit} onChange={(e) => setTrendUnit(e.target.value as typeof trendUnit)}><option value="month">선택 연도 월별</option><option value="year">최근 5년 연별</option></select></div>
    <p className="text-xs text-slate-500">각 기간에 접수한 고객의 현재 인증상태를 비교합니다. 해당 월말·연말 당시 상태나 정지·철회 발생 건수는 아닙니다. 과거 상태 추이는 상태변경 이력 모델을 보강한 뒤 제공해야 합니다.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50"><tr>{["접수 기간", "고객 수", "현재 유지", "현재 정지", "현재 철회"].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{trends.map((row) => <tr className="border-b" key={row.period}><td className="p-3">{row.period}</td>{[row.total, row.active, row.suspended, row.withdrawn].map((value, index) => <td className="p-3" key={index}>{value}</td>)}</tr>)}</tbody></table></div>
    <ReportCertificationEvents jobs={jobs} periods={trends.map((row) => row.period)} filters={filters}/>
  </section>;
}
