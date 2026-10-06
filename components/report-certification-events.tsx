"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { certificationEventCounts, isCertificationEventRecord, type AnalyticsJob, type CertificationEvent } from "@/lib/report-analytics";
import type { ReportFilters } from "@/lib/report-filters";
import { reportExportMetadata, serializeReportCsv } from "@/lib/report-export";
import { verifyReportPage, verifyReportTotal } from "@/lib/report-query-completeness";

export function ReportCertificationEvents({ jobs, periods, filters }: { jobs: AnalyticsJob[]; periods: string[]; filters?: ReportFilters }) {
  const [events, setEvents] = useState<CertificationEvent[]>([]);
  const [state, setState] = useState("loading");
  const [revision, setRevision] = useState(0);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [xlsxNotice, setXlsxNotice] = useState("");
  const exporting = useRef(false), mounted = useRef(true), exportSnapshot = useRef("");
  useEffect(() => {
    setEvents([]); setState("loading");
    if (!hasEnvVars) { setState("prototype"); return; }
    let active = true;
    void (async () => {
      const result: CertificationEvent[] = [];
      let expected: number | undefined;
      const client = createClient();
      for (let offset = 0; ; offset += 500) {
        const { data, error, count } = await client.from("certification_actions").select("id, job_id, action_type, effective_date", { count: "exact" }).order("id").range(offset, offset + 499);
        if (!active) return;
        if (error || !Array.isArray(data) || !data.every(isCertificationEventRecord)) { setState("error"); return; }
        expected = verifyReportPage({ data, error, count }, expected);
        result.push(...data);
        if ((data?.length ?? 0) < 500) break;
        if (offset >= 10000) throw new Error("보고서 조회 한도 초과");
      }
      verifyReportTotal(result, expected!);
      if (active) { setEvents([...new Map(result.map((event) => [event.id, event])).values()]); setState("ready"); }
    })().catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [revision]);
  const rows = periods.map((period) => ({ period, ...certificationEventCounts(events, jobs, period) }));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  exportSnapshot.current = JSON.stringify({ state, revision, periods, filters, rows });
  async function downloadExcel() {
    if (exporting.current || state !== "ready" || !periods.length) return;
    exporting.current = true; setXlsxBusy(true); setXlsxNotice("");
    const snapshot = exportSnapshot.current;
    try {
      const { buildEventReportXlsx } = await import("@/lib/report-events-xlsx");
      if (!mounted.current || snapshot !== exportSnapshot.current) throw new Error("생성 중 화면 또는 조회 조건이 바뀌었습니다. 현재 조건으로 다시 요청해 주세요.");
      const metadata = reportExportMetadata("인증상태 변동", `${periods[0]} ~ ${periods.at(-1)}`, "상태 적용일", filters);
      const blob = buildEventReportXlsx(metadata, rows, state === "ready");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `인증상태변동_${periods[0]}.xlsx`;
      try { anchor.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setXlsxNotice("상태변동 Excel 다운로드를 요청했습니다. 고객 수와 처리 건수는 구분되며 PC 저장 완료를 뜻하지 않습니다.");
    } catch (cause) { if (mounted.current) setXlsxNotice(cause instanceof Error ? cause.message : "상태변동 Excel을 생성하지 못했습니다."); }
    finally { exporting.current = false; if (mounted.current) setXlsxBusy(false); }
  }
  function download() {
    if (state !== "ready" || !periods.length) return;
    const metadata = reportExportMetadata("인증상태 변동", `${periods[0]} ~ ${periods.at(-1)}`, "상태 적용일", filters);
    const data = [...metadata, ["해석", "현재 필터에 해당하는 Job의 적용일별 변동, 과거 월말 유지 고객 수 아님"], [], ["상태 적용 기간", "정지 고객 수", "정지 처리 건수", "철회 고객 수", "철회 처리 건수"], ...rows.map((row) => [row.period, row.suspended.customers, row.suspended.events, row.withdrawn.customers, row.withdrawn.events])];
    const csv = serializeReportCsv(data);
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `인증상태변동_${periods[0] ?? "현황"}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-3 border-t pt-5">
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={xlsxBusy || state !== "ready" || !periods.length} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={downloadExcel}>상태변동 Excel (.xlsx)</button><span className="text-xs text-muted-foreground">조회 조건과 정지·철회 집계 2개 시트. 고객 상세는 제외합니다.</span></div>
    {xlsxNotice && <p role="status" className="text-sm text-amber-700">{xlsxNotice}</p>}
    <button type="button" disabled={state === "loading" || !hasEnvVars} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={() => { setEvents([]); setState("loading"); setRevision((value) => value + 1); }}>상태변동 기록 다시 조회</button>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">실제 정지·철회 변동</h3><button disabled={state !== "ready" || !periods.length} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={download}>상태변동 CSV</button></div>
    <p className="text-xs leading-6 text-slate-500">기록된 상태 적용일 기준입니다. 같은 고객의 여러 Job이나 반복 처리는 고객 수와 처리 건수를 구분합니다. 상단 표준·분야·파트너 필터를 적용하며 접수월과 관계없이 집계합니다. 미래 적용일 기록도 해당 기간에 포함됩니다. 복구·갱신 대체 등 전체 변동 이력이 없어 과거 월말 유지 고객 수를 복원하지는 않습니다.</p>
    {state !== "ready" ? <p role="status" className="text-sm text-amber-700">{state === "loading" ? "상태변동 기록 조회 중입니다." : state === "prototype" ? "가상데이터 모드: 상태변동 DB 미연결" : "상태변동 기록을 조회하지 못했습니다. 0건으로 간주하지 않습니다."}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50"><tr>{["적용 기간", "정지 고객", "정지 처리", "철회 고객", "철회 처리"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-b" key={row.period}><td className="p-3">{row.period}</td>{[row.suspended.customers, row.suspended.events, row.withdrawn.customers, row.withdrawn.events].map((value, index) => <td key={index} className="p-3">{value}</td>)}</tr>)}</tbody></table></div>}
  </div>;
}
