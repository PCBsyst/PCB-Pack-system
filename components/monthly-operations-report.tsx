"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { ReportBusinessAnalytics } from "@/components/report-business-analytics";
import { matchesReportFilters } from "@/lib/report-filters";

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
  const [loading, setLoading] = useState(Boolean(hasEnvVars));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasEnvVars) { setLoading(false); return; }
    let active = true;
    void (async () => {
      const client = createClient();
      const data: ApplicationQueryRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await client.from("applications").select("id, application_no, received_at, business_area, partner_name_snapshot, application_type, status, jobs(id, job_no, standard, grade, certification_state, candidates(id, name), certification_records(certification_no, issue_date, state, history_state))").order("id").range(offset, offset + 499);
        if (!active) return;
        if (page.error) { setError("업무보고 자료를 조회하지 못했습니다."); setLoading(false); return; }
        data.push(...(page.data as unknown as ApplicationQueryRow[]));
        if ((page.data?.length ?? 0) < 500) break;
      }
      const result = ((data ?? []) as unknown as ApplicationQueryRow[]).flatMap((application) => arrayOf(application.jobs).map((job) => {
        const candidate = first(job.candidates);
        const currentCertification = arrayOf(job.certification_records).filter((record) => record.history_state === "CURRENT").sort((a, b) => b.issue_date.localeCompare(a.issue_date))[0];
        return { applicationId: application.id, applicationNo: application.application_no, receivedAt: application.received_at, businessArea: application.business_area, partner: application.partner_name_snapshot, applicationType: application.application_type, applicationStatus: application.status, jobId: job.id, jobNo: job.job_no, candidateId: candidate?.id ?? job.id, candidateName: candidate?.name ?? "후보자 미확인", standard: job.standard, grade: job.grade, certificationState: currentCertification?.state ?? job.certification_state, certificationNo: currentCertification?.certification_no ?? "", issueDate: currentCertification?.issue_date ?? "" } satisfies ReportRow;
      }));
      setRows(result); setLoading(false);
    })().catch(() => { if (active) { setError("업무보고 자료를 조회하지 못했습니다."); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const options = useMemo(() => ({ standards: [...new Set(rows.map((row) => row.standard))].sort(), partners: [...new Set(rows.map((row) => row.partner))].sort(), grades: [...new Set(rows.map((row) => row.grade))].sort(), types: [...new Set(rows.map((row) => row.applicationType))].sort() }), [rows]);
  const dimensionRows = useMemo(() => rows.filter((row) => matchesReportFilters(row, { area, standard, partner, grade, applicationType })), [rows, area, standard, partner, grade, applicationType]);
  const filtered = useMemo(() => dimensionRows.filter((row) => {
    const basisDate = dateBasis === "RECEIVED" ? row.receivedAt : row.issueDate;
    return basisDate.startsWith(month);
  }), [dateBasis, month, dimensionRows]);
  const summary = useMemo(() => ({ total: filtered.length, issued: filtered.filter((row) => row.certificationNo).length, active: filtered.filter((row) => row.certificationState === "ACTIVE").length, suspended: filtered.filter((row) => row.certificationState === "SUSPENDED").length, withdrawn: filtered.filter((row) => row.certificationState === "WITHDRAWN").length }), [filtered]);
  const grouped = useMemo(() => {
    const groups = new Map<string, { area: string; standard: string; received: number; issued: number; active: number; suspended: number; withdrawn: number }>();
    filtered.forEach((row) => { const key = `${row.businessArea}|${row.standard}`; const item = groups.get(key) ?? { area: row.businessArea, standard: row.standard, received: 0, issued: 0, active: 0, suspended: 0, withdrawn: 0 }; item.received += 1; if (row.certificationNo) item.issued += 1; if (row.certificationState === "ACTIVE") item.active += 1; if (row.certificationState === "SUSPENDED") item.suspended += 1; if (row.certificationState === "WITHDRAWN") item.withdrawn += 1; groups.set(key, item); });
    return [...groups.values()].sort((a, b) => a.area.localeCompare(b.area) || a.standard.localeCompare(b.standard));
  }, [filtered]);

  const reset = () => { setMonth(currentMonth); setDateBasis("RECEIVED"); setArea("전체"); setStandard("전체"); setPartner("전체"); setGrade("전체"); setApplicationType("전체"); };
  const exportCsv = () => { const header = ["접수일", "인증발행일", "분야", "후보자", "파트너사", "신청구분", "Job No.", "표준", "등급", "인증번호", "인증상태"]; const body = filtered.map((row) => [row.receivedAt, row.issueDate, areaLabel(row.businessArea), row.candidateName, row.partner, row.applicationType, row.jobNo, row.standard, row.grade, row.certificationNo, certificationLabel(row.certificationState)]); downloadCsv([header, ...body], `월간업무보고_${month}_${dateBasis === "RECEIVED" ? "접수" : "발행"}.csv`); };
  const printReport = () => { const popup = window.open("", "_blank"); if (!popup) return; const escape = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월간 업무보고</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:"Malgun Gothic",sans-serif;color:#172033}h1{font-size:20px}p{font-size:11px}.cards{display:flex;gap:8px;margin:14px 0}.card{border:1px solid #aaa;padding:10px;min-width:110px}.card b{font-size:18px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #777;padding:6px;text-align:left}th{background:#eee}</style></head><body><h1>${escape(month)} 월간 업무보고</h1><p>기준: ${dateBasis === "RECEIVED" ? "접수일" : "인증발행일"} · 출력일 ${escape(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }))}</p><div class="cards"><div class="card">전체<br><b>${summary.total}</b>건</div><div class="card">인증발행<br><b>${summary.issued}</b>건</div><div class="card">인증유효<br><b>${summary.active}</b>건</div><div class="card">정지<br><b>${summary.suspended}</b>건</div><div class="card">철회<br><b>${summary.withdrawn}</b>건</div></div><table><thead><tr><th>분야</th><th>표준</th><th>대상</th><th>인증발행</th><th>유효</th><th>정지</th><th>철회</th></tr></thead><tbody>${grouped.map((item) => `<tr><td>${escape(areaLabel(item.area))}</td><td>${escape(item.standard)}</td><td>${item.received}</td><td>${item.issued}</td><td>${item.active}</td><td>${item.suspended}</td><td>${item.withdrawn}</td></tr>`).join("")}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`); popup.document.close(); };

  return <div className="space-y-4">
    <section className="rounded-lg border bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-semibold">보고서 조회 조건</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <input type="month" className={inputClass} value={month} onChange={(event) => setMonth(event.target.value)} />
      <select className={inputClass} value={dateBasis} onChange={(event) => setDateBasis(event.target.value as "RECEIVED" | "ISSUED")}><option value="RECEIVED">접수일 기준</option><option value="ISSUED">인증발행일 기준</option></select>
      <select className={inputClass} value={area} onChange={(event) => setArea(event.target.value)}><option>전체</option><option value="ISO">ISO</option><option value="K_BEAUTY">K-Beauty</option></select>
      <select className={inputClass} value={standard} onChange={(event) => setStandard(event.target.value)}><option>전체</option>{options.standards.map((value) => <option key={value}>{value}</option>)}</select>
      <select className={inputClass} value={partner} onChange={(event) => setPartner(event.target.value)}><option>전체</option>{options.partners.map((value) => <option key={value}>{value}</option>)}</select>
      <label className="text-xs text-slate-500">등급<select className={inputClass} value={grade} onChange={(event) => setGrade(event.target.value)}><option>전체</option>{options.grades.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs text-slate-500">신청유형<select className={inputClass} value={applicationType} onChange={(event) => setApplicationType(event.target.value)}><option>전체</option>{options.types.map((value) => <option key={value} value={value}>{({ INITIAL: "최초", RENEWAL: "갱신", GRADE_CHANGE: "등급 변경", TRANSFER: "전환" } as Record<string, string>)[value] ?? value}</option>)}</select></label>
      <Button variant="outline" onClick={reset}><RotateCcw />초기화</Button>
    </div></section>
    {loading ? <p role="status" className="rounded-lg border bg-white p-5 text-sm text-slate-500">분석 대상 자료를 조회하고 있습니다.</p> : error ? <p role="alert" className="rounded-lg border bg-red-50 p-5 text-sm text-red-800">분석 자료 조회에 실패했습니다. 고객 수·수익·상태변동을 0으로 간주하지 않습니다.</p> : <ReportBusinessAnalytics period={month} jobs={dimensionRows}/>}
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
function downloadCsv(rows: unknown[][], fileName: string) { const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
