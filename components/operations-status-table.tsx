"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { applications, invoices } from "@/data/workflow-data";
import { getCandidate, getCurrentCycle, jobs, statusLabels } from "@/data/mock-data";

const inputClass = "h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200";

export function OperationsStatusTable() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("전체");
  const [progress, setProgress] = useState("전체");

  const rows = useMemo(() => jobs.map((job) => {
    const candidate = getCandidate(job.candidateId)!;
    const application = applications.find((item) => item.id === job.applicationId);
    const cycle = getCurrentCycle(job);
    const invoice = invoices.find((item) => item.jobIds.includes(job.id));
    const completed = cycle?.status === "COMPLETED";
    return {
      job, candidate, application, cycle, invoice,
      review: cycle?.status === "DOCUMENT_REVIEW" ? "검토 대기" : cycle?.status === "SUPPLEMENT_PENDING" ? "보완 대기" : cycle ? "검토 완료" : "미등록",
      draftDate: cycle?.certificateDraftStatus === "확인완료" ? cycle.decisionDate : completed ? cycle.decisionDate : "",
      draftChecked: cycle?.certificateDraftStatus === "확인완료",
      electronicDate: job.certificationIssueDate ?? (completed ? cycle?.plannedIssueDate : ""),
      originalDate: job.trackingNumber ? cycle?.deliveryDate : "",
    };
  }).filter((row) => {
    const haystack = `${row.job.jobNo} ${row.candidate.name} ${row.job.partnerCompany} ${row.job.standard} ${row.job.currentGrade}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesArea = area === "전체" || row.job.businessArea === area;
    const matchesProgress = progress === "전체" || (progress === "완료" ? row.cycle?.status === "COMPLETED" : row.cycle?.status !== "COMPLETED");
    return matchesQuery && matchesArea && matchesProgress;
  }), [area, progress, query]);

  return <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
      <label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={`${inputClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="후보자, Job No., 파트너사, 규격 검색"/></label>
      <select className={inputClass} value={area} onChange={(event) => setArea(event.target.value)}><option value="전체">전체 분야</option><option value="ISO">ISO</option><option value="K_BEAUTY">K-Beauty</option></select>
      <select className={inputClass} value={progress} onChange={(event) => setProgress(event.target.value)}><option>전체</option><option>진행 중</option><option>완료</option></select>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[2050px] text-left text-xs">
        <thead className="sticky top-16 z-10 bg-slate-100 text-slate-600"><tr>{["관리 No.","후보자","파트너사","Job No.","Standard","Grade","검토사항","INVOICE","비용","인보이스 발행일","입금일","초안 발행일","초안 확인","전자본 발행일","원본 송부일","운송장번호","현재상태"].map((heading) => <th key={heading} className="whitespace-nowrap border-b border-r px-3 py-3 font-semibold last:border-r-0">{heading}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map(({ job, candidate, application, cycle, invoice, review, draftDate, draftChecked, electronicDate, originalDate }) => <tr key={job.id} className="hover:bg-blue-50/40">
          <td className="whitespace-nowrap border-r px-3 py-3">{job.managementNo ?? "-"}</td>
          <td className="whitespace-nowrap border-r px-3 py-3 font-semibold">{candidate.name}</td>
          <td className="whitespace-nowrap border-r px-3 py-3">{application?.partnerCompany ?? job.partnerCompany}</td>
          <td className="whitespace-nowrap border-r px-3 py-3 font-semibold text-blue-800"><Link href={`/jobs/${job.id}`}>{job.jobNo}</Link></td>
          <td className="whitespace-nowrap border-r px-3 py-3">{job.standard}</td>
          <td className="whitespace-nowrap border-r px-3 py-3">{job.currentGrade}</td>
          <StatusCell value={review}/>
          <td className="whitespace-nowrap border-r px-3 py-3">{invoice?.invoiceNo ?? cycle?.invoiceNo ?? "-"}</td>
          <td className="whitespace-nowrap border-r px-3 py-3 text-right">{(invoice?.amount ?? cycle?.invoiceAmount)?.toLocaleString() ?? "-"}</td>
          <DateCell value={invoice?.issuedAt ?? cycle?.invoiceIssuedAt}/>
          <DateCell value={invoice?.paidAt ?? cycle?.paymentConfirmedAt}/>
          <DateCell value={draftDate}/>
          <MarkCell checked={draftChecked}/>
          <DateCell value={electronicDate}/>
          <DateCell value={originalDate}/>
          <td className="whitespace-nowrap border-r px-3 py-3">{job.trackingNumber ?? "-"}</td>
          <td className="whitespace-nowrap px-3 py-3"><span className={`rounded-full px-2 py-1 font-semibold ${cycle?.status === "COMPLETED" ? "bg-emerald-50 text-emerald-800" : cycle?.status === "SUPPLEMENT_PENDING" ? "bg-orange-50 text-orange-800" : "bg-blue-50 text-blue-800"}`}>{cycle ? statusLabels[cycle.status] : "신규 접수"}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="border-t px-4 py-3 text-xs text-slate-500">조회 결과 {rows.length}건 · 가로 스크롤로 전체 발행 현황을 확인할 수 있습니다.</div>
  </section>;
}

function DateCell({ value }: { value?: string }) { return <td className={`whitespace-nowrap border-r px-3 py-3 ${value ? "text-slate-700" : "bg-amber-50 text-amber-700"}`}>{value || "대기"}</td>; }
function MarkCell({ checked }: { checked: boolean }) { return <td className={`border-r px-3 py-3 text-center font-bold ${checked ? "text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{checked ? "○" : "대기"}</td>; }
function StatusCell({ value }: { value: string }) { const warning = value.includes("보완") || value.includes("대기"); return <td className={`min-w-32 border-r px-3 py-3 ${warning ? "bg-amber-50 font-semibold text-amber-800" : "text-slate-700"}`}>{value}</td>; }
