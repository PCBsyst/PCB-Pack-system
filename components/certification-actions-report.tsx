"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type CandidateRelation = { name: string };
type ApplicationRelation = { partner_name_snapshot: string };
type CertificationRelation = { certification_no: string; issue_date: string };
type JobRelation = {
  id: string;
  job_no: string;
  management_no: number;
  standard: string;
  grade: string;
  candidates: CandidateRelation | CandidateRelation[] | null;
  applications: ApplicationRelation | ApplicationRelation[] | null;
};
type ActionQueryRow = {
  id: string;
  action_type: "SUSPENDED" | "WITHDRAWN";
  standard_reason: string;
  detail_reason: string;
  effective_date: string;
  recorded_by_name: string;
  created_at: string;
  jobs: JobRelation | JobRelation[] | null;
  certification_records: CertificationRelation | CertificationRelation[] | null;
};
type ReportRow = {
  id: string;
  jobId: string;
  jobNo: string;
  managementNo: number | null;
  candidateName: string;
  partnerName: string;
  certificationNo: string;
  certificationIssueDate: string;
  standard: string;
  grade: string;
  actionType: "SUSPENDED" | "WITHDRAWN";
  standardReason: string;
  detailReason: string;
  effectiveDate: string;
  recordedByName: string;
  createdAt: string;
};

const inputClass = "h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200";

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export function CertificationActionsReport() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(Boolean(hasEnvVars));
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [actionType, setActionType] = useState("전체");
  const [standard, setStandard] = useState("전체");
  const [reason, setReason] = useState("전체");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!hasEnvVars) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("certification_actions")
      .select("id, action_type, standard_reason, detail_reason, effective_date, recorded_by_name, created_at, jobs(id, job_no, management_no, standard, grade, candidates(name), applications(partner_name_snapshot)), certification_records(certification_no, issue_date)")
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(loadError.message);
          setLoading(false);
          return;
        }
        const result = ((data ?? []) as unknown as ActionQueryRow[]).map((item) => {
          const job = first(item.jobs);
          const candidate = first(job?.candidates);
          const application = first(job?.applications);
          const certification = first(item.certification_records);
          return {
            id: item.id,
            jobId: job?.id ?? "",
            jobNo: job?.job_no ?? "-",
            managementNo: job?.management_no ?? null,
            candidateName: candidate?.name ?? "후보자 미확인",
            partnerName: application?.partner_name_snapshot ?? "-",
            certificationNo: certification?.certification_no ?? "-",
            certificationIssueDate: certification?.issue_date ?? "",
            standard: job?.standard ?? "-",
            grade: job?.grade ?? "-",
            actionType: item.action_type,
            standardReason: item.standard_reason,
            detailReason: item.detail_reason,
            effectiveDate: item.effective_date,
            recordedByName: item.recorded_by_name,
            createdAt: item.created_at,
          } satisfies ReportRow;
        });
        setRows(result);
        setLoading(false);
      });
  }, []);

  const options = useMemo(() => ({
    standards: [...new Set(rows.map((row) => row.standard))].sort(),
    reasons: [...new Set(rows.map((row) => row.standardReason))].sort(),
  }), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const searchTarget = `${row.candidateName} ${row.jobNo} ${row.certificationNo} ${row.partnerName} ${row.standardReason} ${row.detailReason}`.toLowerCase();
    return searchTarget.includes(query.trim().toLowerCase())
      && (actionType === "전체" || row.actionType === actionType)
      && (standard === "전체" || row.standard === standard)
      && (reason === "전체" || row.standardReason === reason)
      && (!dateFrom || row.effectiveDate >= dateFrom)
      && (!dateTo || row.effectiveDate <= dateTo);
  }), [actionType, dateFrom, dateTo, query, reason, rows, standard]);

  const resetFilters = () => {
    setQuery("");
    setActionType("전체");
    setStandard("전체");
    setReason("전체");
    setDateFrom("");
    setDateTo("");
  };

  const exportCsv = () => {
    const headers = ["효력일", "처분구분", "관리 No.", "후보자", "파트너사", "Job No.", "인증번호", "인증발행일", "표준", "등급", "표준사유", "상세사유", "처리자", "기록일시"];
    const values = filtered.map((row) => [row.effectiveDate, actionLabel(row.actionType), row.managementNo ?? "", row.candidateName, row.partnerName, row.jobNo, row.certificationNo, row.certificationIssueDate, row.standard, row.grade, row.standardReason, row.detailReason, row.recordedByName, formatDateTime(row.createdAt)]);
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...values].map((line) => line.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `인증_정지철회_현황_${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const suspendedCount = filtered.filter((row) => row.actionType === "SUSPENDED").length;
  const withdrawnCount = filtered.filter((row) => row.actionType === "WITHDRAWN").length;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="조회 결과" value={filtered.length} tone="slate" />
      <SummaryCard label="인증 정지" value={suspendedCount} tone="amber" />
      <SummaryCard label="인증 철회" value={withdrawnCount} tone="red" />
    </div>

    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_130px_160px_180px_145px_145px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="후보자, Job No., 인증번호, 사유 검색" />
        </label>
        <select className={inputClass} value={actionType} onChange={(event) => setActionType(event.target.value)}>
          <option value="전체">전체 처분</option>
          <option value="SUSPENDED">인증 정지</option>
          <option value="WITHDRAWN">인증 철회</option>
        </select>
        <select className={inputClass} value={standard} onChange={(event) => setStandard(event.target.value)}>
          <option value="전체">전체 표준</option>
          {options.standards.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="전체">전체 표준사유</option>
          {options.reasons.map((value) => <option key={value}>{value}</option>)}
        </select>
        <input type="date" aria-label="효력 시작일" className={inputClass} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" aria-label="효력 종료일" className={inputClass} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <Button type="button" variant="outline" onClick={resetFilters}><RotateCcw />초기화</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">현재 검색·필터 결과만 CSV에 포함됩니다.</p>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download />Excel용 CSV</Button>
      </div>

      {loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />현황을 불러오는 중입니다.</div>
        : error ? <div className="m-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">자료를 불러오지 못했습니다. 인증 정지·철회 SQL 적용 여부를 확인해 주세요.<p className="mt-1 text-xs">{error}</p></div>
        : !filtered.length ? <div className="min-h-56 p-12 text-center"><p className="font-semibold text-slate-700">조회되는 정지·철회 기록이 없습니다.</p><p className="mt-2 text-sm text-slate-500">Job 상세 화면에서 정지 또는 철회를 기록하면 이 화면에 자동 반영됩니다.</p></div>
        : <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1550px] text-left text-xs">
            <thead className="bg-slate-100 text-slate-600"><tr>{["효력일", "처분구분", "후보자", "파트너사", "Job No.", "인증번호", "표준", "등급", "표준사유", "상세사유", "처리자", "기록일시"].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>)}</tr></thead>
            <tbody className="divide-y">{filtered.map((row) => <tr key={row.id} className="hover:bg-blue-50/40">
              <td className="whitespace-nowrap px-3 py-3 font-medium">{row.effectiveDate}</td>
              <td className="whitespace-nowrap px-3 py-3"><ActionBadge type={row.actionType} /></td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold">{row.candidateName}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.partnerName}</td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-800">{row.jobId ? <Link href={`/jobs/${row.jobId}`}>{row.jobNo}</Link> : row.jobNo}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.certificationNo}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.standard}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.grade}</td>
              <td className="min-w-48 px-3 py-3">{row.standardReason}</td>
              <td className="min-w-72 whitespace-pre-wrap px-3 py-3 text-slate-600">{row.detailReason}</td>
              <td className="whitespace-nowrap px-3 py-3">{row.recordedByName}</td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDateTime(row.createdAt)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      <div className="border-t px-4 py-3 text-xs text-slate-500">조회 결과 {filtered.length}건</div>
    </section>
  </div>;
}

function actionLabel(type: ReportRow["actionType"]) {
  return type === "SUSPENDED" ? "인증 정지" : "인증 철회";
}

function ActionBadge({ type }: { type: ReportRow["actionType"] }) {
  return <span className={`rounded-full px-2.5 py-1 font-semibold ${type === "SUSPENDED" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900"}`}>{actionLabel(type)}</span>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "amber" | "red" }) {
  const tones = { slate: "border-slate-200 bg-white text-slate-950", amber: "border-amber-200 bg-amber-50 text-amber-950", red: "border-red-200 bg-red-50 text-red-950" };
  return <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-1 text-2xl font-bold">{value}<span className="ml-1 text-sm font-medium">건</span></p></div>;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
