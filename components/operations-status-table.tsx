"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applications, invoices } from "@/data/workflow-data";
import { getCandidate, getCurrentCycle, jobs, statusLabels } from "@/data/mock-data";
import { prototypeJobId, prototypeWorkflowLabels, readPrototypeApplications, readPrototypeWorkflow, type PrototypeApplicationRecord } from "@/lib/prototype-storage";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

const inputClass = "h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200";
type StatusJobRow = { id: string; job_no: string; management_no: number; standard: string; grade: string };

export function OperationsStatusTable() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("전체");
  const [progress, setProgress] = useState("전체");
  const [standard, setStandard] = useState("전체");
  const [grade, setGrade] = useState("전체");
  const [partner, setPartner] = useState("전체");
  const [prototypeRecords, setPrototypeRecords] = useState<PrototypeApplicationRecord[]>([]);

  useEffect(() => {
    setPrototypeRecords(readPrototypeApplications());
    if (!hasEnvVars) return;
    const supabase = createClient();
    void supabase.from("applications").select("*, candidates(id, name), jobs(id, job_no, management_no, standard, grade), application_workspaces(state)").order("received_at", { ascending: false }).then(({ data }) => {
      if (!data) return;
      const mapped: PrototypeApplicationRecord[] = data.flatMap((item) => {
        const candidate = Array.isArray(item.candidates) ? item.candidates[0] : item.candidates;
        const workspace = Array.isArray(item.application_workspaces) ? item.application_workspaces[0] : item.application_workspaces;
        const jobRows = (Array.isArray(item.jobs) ? item.jobs : []) as StatusJobRow[];
        return jobRows.map((job) => ({ id: item.id, candidateId: candidate?.id, jobId: job.id, applicationNo: item.application_no, receivedAt: item.received_at, candidateName: candidate?.name ?? "이름 미입력", businessArea: item.business_area, scheme: item.accreditation_scheme === "PJLA" ? "PJLA" : "IAS", accreditationTrack: item.accreditation_track, accreditationHidden: item.accreditation_hidden, applicationType: item.application_type, managementNo: job.management_no, jobNo: job.job_no, standard: job.standard, grade: job.grade, partnerCompany: item.partner_name_snapshot, primaryOwner: "로그인 사용자", status: "INTAKE_REVIEW", createdAt: item.created_at, workflow: workspace?.state ?? undefined }));
      });
      setPrototypeRecords(mapped);
    });
  }, []);

  const prototypeRows = useMemo(() => prototypeRecords.map((record) => {
    const workflow = readPrototypeWorkflow(record);
    const certificate = workflow.certificates?.[prototypeJobId(record)];
    return { record, workflow, certificate };
  }).filter(({ record, workflow }) => {
    const haystack = `${record.jobNo} ${record.candidateName} ${record.partnerCompany} ${record.standard} ${record.grade}`.toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (area === "전체" || record.businessArea === area)
      && (standard === "전체" || record.standard === standard)
      && (grade === "전체" || record.grade === grade)
      && (partner === "전체" || record.partnerCompany === partner)
      && (progress === "전체" || (progress === "완료" ? workflow.stage === "COMPLETED" : workflow.stage !== "COMPLETED"));
  }), [area, grade, partner, progress, prototypeRecords, query, standard]);

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
    const matchesStandard = standard === "전체" || row.job.standard === standard;
    const matchesGrade = grade === "전체" || row.job.currentGrade === grade;
    const matchesPartner = partner === "전체" || (row.application?.partnerCompany ?? row.job.partnerCompany) === partner;
    const matchesProgress = progress === "전체" || (progress === "완료" ? row.cycle?.status === "COMPLETED" : row.cycle?.status !== "COMPLETED");
    return matchesQuery && matchesArea && matchesStandard && matchesGrade && matchesPartner && matchesProgress;
  }), [area, grade, partner, progress, query, standard]);

  const filterOptions = useMemo(() => ({ standards: [...new Set([...prototypeRecords.map((record) => record.standard), ...jobs.map((job) => job.standard)])].sort(), grades: [...new Set([...prototypeRecords.map((record) => record.grade), ...jobs.map((job) => job.currentGrade)])].sort(), partners: [...new Set([...prototypeRecords.map((record) => record.partnerCompany), ...jobs.map((job) => job.partnerCompany)])].sort() }), [prototypeRecords]);
  const exportRows = useMemo(() => [
    ...prototypeRows.map(({ record, workflow, certificate }) => [record.managementNo, record.candidateName, record.partnerCompany, record.jobNo, record.standard, record.grade, workflow.invoiceNo ?? "", workflow.invoiceAmount ?? "", workflow.invoiceIssuedAt ?? "", workflow.paymentConfirmedAt ?? "", certificate?.draftIssuedAt ?? "", certificate?.issueDate ?? "", certificate?.originalSentAt ?? "", certificate?.trackingNumber ?? "", workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "신규 접수"]),
    ...rows.map(({ job, candidate, application, cycle, invoice, draftDate, electronicDate, originalDate }) => [job.managementNo ?? "", candidate.name, application?.partnerCompany ?? job.partnerCompany, job.jobNo, job.standard, job.currentGrade, invoice?.invoiceNo ?? cycle?.invoiceNo ?? "", invoice?.amount ?? cycle?.invoiceAmount ?? "", invoice?.issuedAt ?? cycle?.invoiceIssuedAt ?? "", invoice?.paidAt ?? cycle?.paymentConfirmedAt ?? "", draftDate, electronicDate ?? "", originalDate ?? "", job.trackingNumber ?? "", cycle ? statusLabels[cycle.status] : "신규 접수"]),
  ], [prototypeRows, rows]);
  const headers = ["관리 No.", "후보자", "파트너사", "Job No.", "Standard", "Grade", "INVOICE", "비용", "인보이스 발행일", "입금일", "초안 발행일", "전자본 발행일", "원본 송부일", "운송장번호", "현재상태"];
  const exportCsv = () => { const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = [headers, ...exportRows].map((row) => row.map(quote).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `통합업무현황_${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const printReport = () => { const popup = window.open("", "_blank"); if (!popup) return; const escape = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); popup.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>통합 업무현황</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:"Malgun Gothic",sans-serif;font-size:9px}h1{font-size:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:5px;text-align:left}th{background:#eee}</style></head><body><h1>통합 업무현황</h1><p>출력일 ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · ${exportRows.length}건</p><table><thead><tr>${headers.map((item) => `<th>${escape(item)}</th>`).join("")}</tr></thead><tbody>${exportRows.map((row) => `<tr>${row.map((item) => `<td>${escape(item)}</td>`).join("")}</tr>`).join("")}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`); popup.document.close(); };

  return <section className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-white shadow-sm">
    <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_130px_150px_150px_160px_130px]">
      <label className="relative min-w-0"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={`${inputClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="후보자, Job No., 파트너사, 규격 검색"/></label>
      <select className={`${inputClass} w-full`} value={area} onChange={(event) => setArea(event.target.value)}><option value="전체">전체 분야</option><option value="ISO">ISO</option><option value="K_BEAUTY">K-Beauty</option></select>
      <select className={`${inputClass} w-full`} value={progress} onChange={(event) => setProgress(event.target.value)}><option>전체</option><option>진행 중</option><option>완료</option></select>
      <select className={`${inputClass} w-full`} value={standard} onChange={(event) => setStandard(event.target.value)}><option>전체</option>{filterOptions.standards.map((value) => <option key={value}>{value}</option>)}</select>
      <select className={`${inputClass} w-full`} value={grade} onChange={(event) => setGrade(event.target.value)}><option>전체</option>{filterOptions.grades.map((value) => <option key={value}>{value}</option>)}</select>
      <select className={`${inputClass} w-full`} value={partner} onChange={(event) => setPartner(event.target.value)}><option>전체</option>{filterOptions.partners.map((value) => <option key={value}>{value}</option>)}</select>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">현재 필터 결과만 보고서에 포함됩니다.</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={exportCsv}><Download/>Excel용 CSV</Button><Button size="sm" variant="outline" onClick={printReport}><Printer/>인쇄·PDF</Button></div></div>
    <div className="max-w-full overflow-x-auto overscroll-x-contain" aria-label="통합 업무현황 표">
      <table className="w-full min-w-[2050px] table-auto text-left text-xs">
        <thead className="bg-slate-100 text-slate-600"><tr>{["관리 No.","후보자","파트너사","Job No.","Standard","Grade","검토사항","INVOICE","비용","인보이스 발행일","입금일","초안 발행일","초안 확인","전자본 발행일","원본 송부일","운송장번호","현재상태"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap border-b border-r bg-slate-100 px-3 py-3 font-semibold last:border-r-0">{heading}</th>)}</tr></thead>
        <tbody className="divide-y">{prototypeRows.map(({ record, workflow, certificate }) => <tr key={record.id} className="bg-blue-50/30 hover:bg-blue-50">
          <td className="whitespace-nowrap border-r px-3 py-3">{record.managementNo}</td>
          <td className="whitespace-nowrap border-r px-3 py-3 font-semibold">{record.candidateName}</td>
          <td className="whitespace-nowrap border-r px-3 py-3">{record.partnerCompany}</td>
          <td className="whitespace-nowrap border-r px-3 py-3 font-semibold text-blue-800"><Link href={`/jobs/${prototypeJobId(record)}`}>{record.jobNo}</Link></td>
          <td className="whitespace-nowrap border-r px-3 py-3">{record.standard}</td>
          <td className="whitespace-nowrap border-r px-3 py-3">{record.grade}</td>
          <StatusCell value={workflow.stage && workflow.stage !== "DOCUMENT_REVIEW" ? "검토 완료" : "검토 대기"}/>
          <td className="whitespace-nowrap border-r px-3 py-3">{workflow.invoiceNo || "-"}</td>
          <td className="whitespace-nowrap border-r px-3 py-3 text-right">{workflow.invoiceAmount ? Number(workflow.invoiceAmount).toLocaleString() : "-"}</td>
          <DateCell value={workflow.invoiceIssuedAt}/><DateCell value={workflow.paymentConfirmedAt}/><DateCell value={certificate?.draftIssuedAt}/><MarkCell checked={Boolean(certificate?.draftIssuedAt)}/><DateCell value={certificate?.issueDate}/><DateCell value={certificate?.originalSentAt}/>
          <td className="whitespace-nowrap border-r px-3 py-3">{certificate?.trackingNumber || "-"}</td>
          <td className="whitespace-nowrap px-3 py-3"><span className={`rounded-full px-2 py-1 font-semibold ${workflow.stage === "COMPLETED" ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"}`}>{workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "신규 접수"}</span></td>
        </tr>)}{rows.map(({ job, candidate, application, cycle, invoice, review, draftDate, draftChecked, electronicDate, originalDate }) => <tr key={job.id} className="hover:bg-blue-50/40">
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
    <div className="border-t px-4 py-3 text-xs text-slate-500">조회 결과 {rows.length + prototypeRows.length}건 · 가로 스크롤로 전체 발행 현황을 확인할 수 있습니다.</div>
  </section>;
}

function DateCell({ value }: { value?: string }) { return <td className={`whitespace-nowrap border-r px-3 py-3 ${value ? "text-slate-700" : "bg-amber-50 text-amber-700"}`}>{value || "대기"}</td>; }
function MarkCell({ checked }: { checked: boolean }) { return <td className={`border-r px-3 py-3 text-center font-bold ${checked ? "text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{checked ? "○" : "대기"}</td>; }
function StatusCell({ value }: { value: string }) { const warning = value.includes("보완") || value.includes("대기"); return <td className={`min-w-32 border-r px-3 py-3 ${warning ? "bg-amber-50 font-semibold text-amber-800" : "text-slate-700"}`}>{value}</td>; }
