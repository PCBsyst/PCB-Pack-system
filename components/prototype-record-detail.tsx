"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { findPrototypeByCandidateId, findPrototypeByJobId, prototypeCandidateId, prototypeJobId, prototypeWorkflowLabels, readPrototypeApplications, readPrototypeWorkflow, type PrototypeApplicationRecord } from "@/lib/prototype-storage";

export function PrototypeRecordDetail({ id, kind }: { id: string; kind: "application" | "candidate" | "job" }) {
  const [record, setRecord] = useState<PrototypeApplicationRecord | null | undefined>(undefined);
  useEffect(() => {
    setRecord(kind === "application" ? readPrototypeApplications().find((item) => item.id === id) : kind === "candidate" ? findPrototypeByCandidateId(id) : findPrototypeByJobId(id));
  }, [id, kind]);
  if (record === undefined) return <p className="text-sm text-slate-500">브라우저에 저장된 신청을 확인하는 중입니다.</p>;
  if (!record) return <p className="rounded-lg border bg-white p-6 text-sm text-slate-600">이 브라우저에 해당 샘플 기록이 없습니다. <Link href="/applications" className="text-blue-800 underline">신청관리로 돌아가기</Link></p>;
  const title = kind === "candidate" ? record.candidateName : kind === "job" ? record.jobNo : record.applicationNo;
  const workflow = readPrototypeWorkflow(record);
  const certificate = workflow.certificates?.[prototypeJobId(record)];
  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">브라우저에 저장된 신규 신청 · {record.receivedAt} 접수</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Link href={`/applications/${record.id}`} className="rounded-lg border bg-white p-4 text-sm hover:border-blue-300"><span className="block text-xs text-slate-500">신청관리</span><span className="mt-1 block font-semibold text-blue-800">{record.applicationNo}</span></Link>
      <Link href={`/candidates/${prototypeCandidateId(record)}`} className="rounded-lg border bg-white p-4 text-sm hover:border-blue-300"><span className="block text-xs text-slate-500">후보자</span><span className="mt-1 block font-semibold text-blue-800">{record.candidateName}</span></Link>
      <Link href={`/jobs/${prototypeJobId(record)}`} className="rounded-lg border bg-white p-4 text-sm hover:border-blue-300"><span className="block text-xs text-slate-500">Job</span><span className="mt-1 block font-semibold text-blue-800">{record.jobNo}</span></Link>
    </div>
    <section className="rounded-lg border bg-white p-5 shadow-sm"><h3 className="font-semibold">기본정보</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Info label="후보자" value={record.candidateName}/><Info label="신청구분" value={record.applicationType}/><Info label="인정기구" value={record.scheme ?? "기존 기록"}/><Info label="인정 구분" value={record.accreditationTrack === "ACCREDITED" ? "인정" : "비인정"}/><Info label="세부 분야" value={record.standard}/><Info label="등급" value={record.grade}/><Info label="파트너사" value={record.partnerCompany}/><Info label="관리 No." value={String(record.managementNo)}/></dl></section>
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">업무기록·패키지</h3><p className="mt-2">현재 단계: <strong>{workflow.stage ? prototypeWorkflowLabels[workflow.stage] : "신규 접수"}</strong></p></div><Link href={`/applications/${record.id}`} className="rounded-md bg-blue-800 px-3 py-2 font-medium text-white">업무 처리화면 열기</Link></div><dl className="mt-4 grid gap-3 sm:grid-cols-3"><Info label="인보이스" value={workflow.invoiceNo || "미발행"}/><Info label="인증번호" value={certificate?.certificationNo || "미발행"}/><Info label="패키지" value={workflow.generated ? "생성 완료" : "생성 대기"}/></dl></section>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>; }
