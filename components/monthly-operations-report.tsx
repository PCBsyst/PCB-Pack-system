"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { ReportBusinessAnalytics } from "@/components/report-business-analytics";
import { matchesReportFilters, matchesReportMonth } from "@/lib/report-filters";
import { reportApplicationTypeLabel, reportExportMetadata, serializeReportCsv } from "@/lib/report-export";
import { buildMonthlyReportPrintHtml } from "@/lib/monthly-report-print";
import { verifiedReportCsv } from "@/lib/report-download";
import { verifyReportPage, verifyReportTotal } from "@/lib/report-query-completeness";

type CandidateRelation = { id: string; name: string };
type CertificationRelation = { certification_no: string; issue_date: string; state: string; history_state: string };
type JobRelation = { id: string; job_no: string; standard: string; grade: string; certification_state: string; candidates: CandidateRelation | CandidateRelation[] | null; certification_records: CertificationRelation[] | CertificationRelation | null };
type ApplicationQueryRow = { id: string; application_no: string; received_at: string; business_area: string; partner_name_snapshot: string; application_type: string; status: string; jobs: JobRelation[] | JobRelation | null };
type ReportRow = { applicationId: string; applicationNo: string; receivedAt: string; businessArea: string; partner: string; applicationType: string; applicationStatus: string; jobId: string; jobNo: string; candidateName: string; candidateId: string; standard: string; grade: string; certificationState: string; certificationNo: string; issueDate: string };

const inputClass = "h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200";
const currentMonth = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 7);

function arrayOf<T>(value: T | T[] | null | undefined): T[] { return Array.isArray(value) ? value : value ? [value] : []; }
function first<T>(value: T | T[] | null | undefined) { return arrayOf(value)[0]; }

export function MonthlyOperationsReport() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [dateBasis, setDateBasis] = useState<"RECEIVED" | "ISSUED">("RECEIVED");
  const [area, setArea] = useState("전체");
  const [standard, setStandard] = useState("전체");
  const [partner, setPartner] = useState("전체");
  const [grade, setGrade] = useState("전체");
  const [applicationType, setApplicationType] = useState("전체");
  const [certificationState, setCertificationState] = useState("전체");
  const [loading, setLoading] = useState(Boolean(hasEnvVars));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [includePrintDetails, setIncludePrintDetails] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const exporting = useRef(false);
  const mounted = useRef(true);
  const exportSnapshot = useRef("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    setRows([]); setError(""); setLoading(Boolean(hasEnvVars));
    if (!hasEnvVars) { setLoading(false); return; }
    let active = true;
    void (async () => {
      const client = createClient();
      const data: ApplicationQueryRow[] = [];
      let expected: number | undefined;
      for (let offset = 0; ; offset += 500) {
        const page = await client.from("applications").select("id, application_no, received_at, business_area, partner_name_snapshot, application_type, status, jobs(id, job_no, standard, grade, certification_state, candidates(id, name), certification_records(certification_no, issue_date, state, history_state))", { count: "exact" }).order("id").range(offset, offset + 499);
        if (!active) return;
        if (page.error || !Array.isArray(page.data)) { setError("업무보고 자료를 조회하지 못했습니다."); setLoading(false); return; }
        expected = verifyReportPage(page, expected);
        data.push(...(page.data as unknown as ApplicationQueryRow[]));
        if ((page.data?.length ?? 0) < 500) break;
        if (offset >= 10000) throw new Error("보고서 조회 한도 초과");
      }
      verifyReportTotal(data, expected!);
      const result = ((data ?? []) as unknown as ApplicationQueryRow[]).flatMap((application) => arrayOf(application.jobs).map((job) => {
        const candidate = first(job.candidates);
        const currentCertification = arrayOf(job.certification_records).filter((record) => record.history_state === "CURRENT").sort((a, b) => b.issue_date.localeCompare(a.issue_date))[0];
        return { applicationId: application.id, applicationNo: application.application_no, receivedAt: application.received_at, businessArea: application.business_area, partner: application.partner_name_snapshot, applicationType: application.application_type, applicationStatus: application.status, jobId: job.id, jobNo: job.job_no, candidateId: candidate?.id ?? job.id, candidateName: candidate?.name ?? "후보자 미확인", standard: job.standard, grade: job.grade, certificationState: currentCertification?.state ?? job.certification_state, certificationNo: currentCertification?.certification_no ?? "", issueDate: currentCertification?.issue_date ?? "" } satisfies ReportRow;
      }));
      if (active) { setRows([...new Map(result.map((row) => [row.jobId, row])).values()]); setLoading(false); }
    })().catch(() => { if (active) { setError("업무보고 자료를 조회하지 못했습니다."); setLoading(false); } });
    return () => { active = false; };
  }, [revision]);

  const options = useMemo(() => ({ standards: [...new Set(rows.map((row) => row.standard))].sort(), partners: [...new Set(rows.map((row) => row.partner))].sort(), grades: [...new Set(rows.map((row) => row.grade))].sort(), types: [...new Set(rows.map((row) => row.applicationType))].sort() }), [rows]);
  const reportFilters = { area, standard, partner, grade, applicationType, certificationState };
  exportSnapshot.current = JSON.stringify({ month, dateBasis, filters: reportFilters, revision });
  const dimensionRows = useMemo(() => rows.filter((row) => matchesReportFilters(row, { area, standard, partner, grade, applicationType, certificationState })), [rows, area, standard, partner, grade, applicationType, certificationState]);
  const filtered = useMemo(() => dimensionRows.filter((row) => matchesReportMonth(row, month, dateBasis)), [dateBasis, month, dimensionRows]);
  const summary = useMemo(() => ({ total: filtered.length, issued: filtered.filter((row) => row.certificationNo).length, active: filtered.filter((row) => row.certificationState === "ACTIVE").length, suspended: filtered.filter((row) => row.certificationState === "SUSPENDED").length, withdrawn: filtered.filter((row) => row.certificationState === "WITHDRAWN").length }), [filtered]);
  const grouped = useMemo(() => {
    const groups = new Map<string, { area: string; standard: string; received: number; issued: number; active: number; suspended: number; withdrawn: number }>();
    filtered.forEach((row) => { const key = `${row.businessArea}|${row.standard}`; const item = groups.get(key) ?? { area: row.businessArea, standard: row.standard, received: 0, issued: 0, active: 0, suspended: 0, withdrawn: 0 }; item.received += 1; if (row.certificationNo) item.issued += 1; if (row.certificationState === "ACTIVE") item.active += 1; if (row.certificationState === "SUSPENDED") item.suspended += 1; if (row.certificationState === "WITHDRAWN") item.withdrawn += 1; groups.set(key, item); });
    return [...groups.values()].sort((a, b) => a.area.localeCompare(b.area) || a.standard.localeCompare(b.standard));
  }, [filtered]);

  const reset = () => { setMonth(currentMonth); setDateBasis("RECEIVED"); setArea("전체"); setStandard("전체"); setPartner("전체"); setGrade("전체"); setApplicationType("전체"); setCertificationState("전체"); };
  const exportCsv = async () => {
    if (exporting.current || loading || error || !filtered.length) return;
    if (!window.confirm(`후보자명·파트너사·인증번호 등이 포함된 ${filtered.length}개 Job의 상세 CSV를 내려받습니다. 파일을 안전하게 보관하고 권한 없는 사람에게 공유하지 마세요. 계속하시겠습니까?`)) return;
    exporting.current = true; setExportBusy(true); setExportNotice("");
    const snapshot = exportSnapshot.current;
    try {
      const response = await fetch("/api/reports/monthly-csv", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ month, dateBasis, filters: reportFilters }) });
      const blob = await verifiedReportCsv(response);
      if (!mounted.current) return;
      if (snapshot !== exportSnapshot.current) throw new Error("생성 중 조회 조건이 바뀌어 저장을 중단했습니다. 현재 조건으로 다시 요청해 주세요.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `월간업무보고_${month}_${dateBasis === "RECEIVED" ? "접수" : "발행"}.csv`;
      try { anchor.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setExportNotice("서버 자료와 파일 무결성을 확인해 다운로드를 요청했습니다. 신청별 접근이력이 기록되며 PC 저장 완료를 뜻하지는 않습니다.");
    } catch (cause) {
      if (mounted.current) setExportNotice(cause instanceof Error ? cause.message : "보고서를 내려받지 못했습니다.");
    } finally { exporting.current = false; if (mounted.current) setExportBusy(false); }
  };
  const exportGroupedCsv = () => {
    if (loading || error || !filtered.length) return;
    const metadata = reportExportMetadata("월간 업무보고 표준별 집계", month, dateBasis === "RECEIVED" ? "접수일" : "인증발행일", reportFilters);
    const body = grouped.map((row) => [areaLabel(row.area), row.standard, row.received, row.issued, row.active, row.suspended, row.withdrawn]);
    downloadCsv([...metadata, ["포함 범위", "개별 후보자명·Job 번호·인증번호 제외 (파트너 필터 등 조회 조건은 포함)"], [], ["분야", "표준", "대상 Job", "인증발행", "유지", "정지", "철회"], ...body], `월간업무집계_${month}.csv`);
  };
  const exportSummaryXlsx = async () => {
    if (exporting.current || loading || error || !filtered.length) return;
    exporting.current = true; setExportBusy(true); setExportNotice("");
    const snapshot = exportSnapshot.current;
    try {
      const metadata = reportExportMetadata("월간 업무보고 집계", month, dateBasis === "RECEIVED" ? "접수일" : "인증발행일", reportFilters);
      const { buildMonthlySummaryXlsx } = await import("@/lib/monthly-report-xlsx");
      if (!mounted.current || snapshot !== exportSnapshot.current) throw new Error("생성 중 화면 또는 조회 조건이 바뀌었습니다. 현재 조건으로 다시 요청해 주세요.");
      const blob = buildMonthlySummaryXlsx(metadata, filtered);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `월간업무집계_${month}.xlsx`;
      try { anchor.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setExportNotice("Excel 집계 다운로드를 요청했습니다. 고객 상세 원문은 제외되며 조회 조건은 포함됩니다. 서버 접근이력에 기록되지 않고 PC 저장 완료를 뜻하지는 않습니다.");
    } catch (cause) {
      if (mounted.current) setExportNotice(cause instanceof Error ? cause.message : "Excel 집계를 생성하지 못했습니다.");
    } finally { exporting.current = false; if (mounted.current) setExportBusy(false); }
  };
  const printReport = () => {
    setExportNotice("");
    if (loading || error || !filtered.length) return;
    if (includePrintDetails && !window.confirm("후보자명·파트너사·인증번호를 포함해 출력합니다. 출력물을 안전하게 보관하시겠습니까?")) return;
    const html = buildMonthlyReportPrintHtml({ month, metadata: reportExportMetadata("월간 업무보고", month, dateBasis === "RECEIVED" ? "접수일" : "인증발행일", reportFilters), summary, groups: grouped, details: includePrintDetails ? filtered : undefined });
    const popup = window.open("", "_blank");
    if (!popup) { setExportNotice("인쇄 창이 차단됐습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요."); return; }
    try { popup.document.write(html); popup.document.close(); }
    catch { popup.close(); setExportNotice("인쇄 화면을 열지 못했습니다. 다시 시도해 주세요."); }
  };

  return <div className="space-y-4">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"><div><h2 className="font-semibold">Excel 집계 보고서</h2><p className="mt-1 text-xs text-muted-foreground">조회 조건·전체 요약·표준별·등급별·유형별 현황을 5개 시트로 저장합니다. Job 수와 현재 상태 기준이며 고객 상세 및 수익은 제외합니다.</p></div><Button type="button" variant="outline" disabled={exportBusy || loading || Boolean(error) || !filtered.length} onClick={exportSummaryXlsx}><Download />집계 Excel (.xlsx)</Button></section>
    <section className="rounded-lg border bg-card p-4 text-sm"><p>상세 CSV와 상세 출력에는 고객정보가 포함됩니다. 상세 CSV는 서버 자료로 생성하고 신청별 응답 준비 이력을 기록합니다. 집계 CSV·인쇄는 서버 접근이력에 기록되지 않습니다. 고객 목록이 필요하지 않으면 집계 CSV 또는 기본 집계 인쇄를 이용하세요.</p><div className="mt-3 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={loading || Boolean(error) || !filtered.length} onClick={exportGroupedCsv}><Download />표준별 집계 CSV</Button><label className="flex items-center gap-2"><input type="checkbox" checked={includePrintDetails} onChange={(event) => setIncludePrintDetails(event.target.checked)}/>인쇄에 고객 상세 포함 (기본 제외)</label></div>{exportBusy && <p role="status" className="mt-2">서버 보고서 생성·접근이력·파일 무결성을 확인 중입니다.</p>}{exportNotice && <p role="status" className="mt-2 text-amber-700">{exportNotice}</p>}</section>
    <div className="flex justify-end"><Button type="button" variant="outline" disabled={loading || !hasEnvVars} onClick={() => { setRows([]); setError(""); setLoading(true); setRevision((value) => value + 1); }}><RotateCcw />업무보고 자료 다시 조회</Button></div>
    <section className="rounded-lg border bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-semibold">보고서 조회 조건</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <input type="month" className={inputClass} value={month} onChange={(event) => setMonth(event.target.value)} />
      <select className={inputClass} value={dateBasis} onChange={(event) => setDateBasis(event.target.value as "RECEIVED" | "ISSUED")}><option value="RECEIVED">접수일 기준</option><option value="ISSUED">인증발행일 기준</option></select>
      <select className={inputClass} value={area} onChange={(event) => setArea(event.target.value)}><option>전체</option><option value="ISO">ISO</option><option value="K_BEAUTY">K-Beauty</option></select>
      <select className={inputClass} value={standard} onChange={(event) => setStandard(event.target.value)}><option>전체</option>{options.standards.map((value) => <option key={value}>{value}</option>)}</select>
      <select className={inputClass} value={partner} onChange={(event) => setPartner(event.target.value)}><option>전체</option>{options.partners.map((value) => <option key={value}>{value}</option>)}</select>
      <label className="text-xs text-slate-500">등급<select className={inputClass} value={grade} onChange={(event) => setGrade(event.target.value)}><option>전체</option>{options.grades.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs text-slate-500">신청유형<select className={inputClass} value={applicationType} onChange={(event) => setApplicationType(event.target.value)}><option>전체</option>{options.types.map((value) => <option key={value} value={value}>{({ INITIAL: "최초", RENEWAL: "갱신", GRADE_CHANGE: "등급 변경", TRANSFER: "전환" } as Record<string, string>)[value] ?? value}</option>)}</select></label>
      <Button variant="outline" onClick={reset}><RotateCcw />초기화</Button>
      <label className="text-xs text-slate-500">현재 인증상태<select className={inputClass} value={certificationState} onChange={(event) => setCertificationState(event.target.value)}><option>전체</option>{[...new Set(rows.map((row) => row.certificationState))].sort().map((value) => <option key={value} value={value}>{certificationLabel(value)}</option>)}</select></label>
    </div></section>
    <p className="text-xs text-muted-foreground">인증상태 필터는 현재 상태를 기준으로 합니다. 선택한 Job의 과거 상태변동도 함께 조회되며, 과거 월말 상태를 의미하지는 않습니다.</p>
    {loading ? <p role="status" className="rounded-lg border bg-white p-5 text-sm text-slate-500">분석 대상 자료를 조회하고 있습니다.</p> : error ? <p role="alert" className="rounded-lg border bg-red-50 p-5 text-sm text-red-800">분석 자료 조회에 실패했습니다. 고객 수·수익·상태변동을 0으로 간주하지 않습니다.</p> : <ReportBusinessAnalytics period={month} jobs={dimensionRows} dateBasis={dateBasis} filters={reportFilters}/>}
    {!loading && !error && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="대상 Job" value={summary.total} /><Metric label="인증발행" value={summary.issued} tone="blue" /><Metric label="인증유효" value={summary.active} tone="green" /><Metric label="인증정지" value={summary.suspended} tone="amber" /><Metric label="인증철회" value={summary.withdrawn} tone="red" /></div></>}
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><h2 className="font-semibold">표준별 집계</h2><p className="mt-1 text-xs text-slate-500">{month} · {dateBasis === "RECEIVED" ? "접수일" : "인증발행일"} 기준</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download />Excel용 CSV</Button><Button size="sm" variant="outline" onClick={printReport} disabled={!filtered.length}><Printer />인쇄·PDF</Button></div></div>
      {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />자료를 집계하는 중입니다.</div> : error ? <div className="m-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : !grouped.length ? <div className="min-h-48 p-12 text-center text-sm text-slate-500">선택한 조건에 해당하는 자료가 없습니다.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{["분야", "표준", "대상 Job", "인증발행", "인증유효", "인증정지", "인증철회"].map((heading) => <th key={heading} className="border-b px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y">{grouped.map((item) => <tr key={`${item.area}-${item.standard}`}><td className="px-4 py-3">{areaLabel(item.area)}</td><td className="px-4 py-3 font-semibold">{item.standard}</td><td className="px-4 py-3">{item.received}</td><td className="px-4 py-3">{item.issued}</td><td className="px-4 py-3 text-emerald-700">{item.active}</td><td className="px-4 py-3 text-amber-700">{item.suspended}</td><td className="px-4 py-3 text-red-700">{item.withdrawn}</td></tr>)}</tbody></table></div>}
    </section>
    {filtered.length > 0 && <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="border-b px-4 py-3"><h2 className="font-semibold">대상 상세</h2></div><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr>{["접수일", "발행일", "후보자", "파트너사", "Job No.", "표준", "등급", "인증번호", "인증상태"].map((heading) => <th key={heading} className="border-b px-3 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y">{filtered.map((row) => <tr key={row.jobId}><td className="px-3 py-3">{row.receivedAt}</td><td className="px-3 py-3">{row.issueDate || "-"}</td><td className="px-3 py-3 font-semibold">{row.candidateName}</td><td className="px-3 py-3">{row.partner}</td><td className="px-3 py-3"><Link href={`/jobs/${row.jobId}`} className="font-semibold text-blue-800">{row.jobNo}</Link></td><td className="px-3 py-3">{row.standard}</td><td className="px-3 py-3">{row.grade}</td><td className="px-3 py-3">{row.certificationNo || "-"}</td><td className="px-3 py-3">{certificationLabel(row.certificationState)}</td></tr>)}</tbody></table></div></section>}
  </div>;
}

function areaLabel(value: string) { return value === "K_BEAUTY" ? "K-Beauty" : "ISO"; }
function certificationLabel(value: string) { return ({ ACTIVE: "인증 완료", SUSPENDED: "인증 정지", WITHDRAWN: "인증 철회", NONE: "미발행" } as Record<string, string>)[value] ?? value; }
function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "blue" | "green" | "amber" | "red" }) { const tones = { slate: "border-slate-200 bg-white", blue: "border-blue-200 bg-blue-50", green: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50", red: "border-red-200 bg-red-50" }; return <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}><p className="text-xs font-medium text-slate-600">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}<span className="ml-1 text-sm font-medium">건</span></p></div>; }
function downloadCsv(rows: unknown[][], fileName: string) { const csv = serializeReportCsv(rows); const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
