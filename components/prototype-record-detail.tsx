"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { findPrototypeByCandidateId, findPrototypeByJobId, readPrototypeApplications, prototypeCandidateId, prototypeJobId, type PrototypeApplicationRecord } from "@/lib/prototype-storage";

export function PrototypeRecordDetail({ id, kind }: { id: string; kind: "application" | "candidate" | "job" }) {
  const [record, setRecord] = useState<PrototypeApplicationRecord | null | undefined>(undefined);
  useEffect(() => {
    setRecord(kind === "application" ? readPrototypeApplications().find((item) => item.id === id) : kind === "candidate" ? findPrototypeByCandidateId(id) : findPrototypeByJobId(id));
  }, [id, kind]);
  if (record === undefined) return <p className="text-sm text-slate-500">브라우저에 저장된 신청을 확인하는 중입니다.</p>;
  if (!record) return <p className="rounded-lg border bg-white p-6 text-sm text-slate-600">이 브라우저에 해당 샘플 기록이 없습니다. <Link href="/applications" className="text-blue-800 underline">신청관리로 돌아가기</Link></p>;
  const title = kind === "candidate" ? record.candidateName : kind === "job" ? record.jobNo : record.applicationNo;
  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">브라우저에 저장된 신규 신청 · {record.receivedAt} 접수</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Link href={`/applications/${record.id}`} className="rounded-lg border bg-white p-4 text-sm hover:border-blue-300"><span className="block text-xs text-slate-500">신청관리</span><span className="mt-1 block font-semibold text-blue-800">{record.applicationNo}</span></Link>
      <Link href={`/candidates/${prototypeCandidateId(record)}`} className="rounded-lg border bg-white p-4 text-sm hover:border-blue-300"><span className="block text-xs text-slate-500">후보자</span><span className="mt-1 block font-semibold text-blue-800">{record.candidateName}</span></Link>
      <Link href={`/jobs/${prototypeJobId(record)}`} className="rounded-lg border bg-white p-4 text-sm hover:border-blue-300"><span className="block text-xs text-slate-500">Job</span><span className="mt-1 block font-semibold text-blue-800">{record.jobNo}</span></Link>
    </div>
    <section className="rounded-lg border bg-white p-5 shadow-sm"><h3 className="font-semibold">기본정보</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Info label="후보자" value={record.candidateName}/><Info label="신청구분" value={record.applicationType}/><Info label="인정기구" value={record.scheme ?? "기존 기록"}/><Info label="인정 구분" value={record.accreditationTrack === "ACCREDITED" ? "인정" : "비인정"}/><Info label="세부 분야" value={record.standard}/><Info label="등급" value={record.grade}/><Info label="파트너사" value={record.partnerCompany}/><Info label="관리 No." value={String(record.managementNo)}/></dl></section>
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><h3 className="font-semibold">업무기록·패키지</h3><p className="mt-2">이 건은 접수 기본정보만 등록되었습니다. 서류검토, 인증심의, 문서전달 기록과 문서 생성은 아직 연결되지 않았으므로 패키지는 생성할 수 없습니다.</p><Link href="/packages" className="mt-3 inline-block font-medium underline">패키지 현황 보기</Link></section>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>; }
