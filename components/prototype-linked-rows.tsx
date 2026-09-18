"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { prototypeCandidateId, prototypeJobId, readPrototypeApplications, type PrototypeApplicationRecord } from "@/lib/prototype-storage";

function usePrototypeRecords() {
  const [records, setRecords] = useState<PrototypeApplicationRecord[]>([]);
  useEffect(() => setRecords(readPrototypeApplications()), []);
  return records;
}

export function PrototypeCandidateRows() {
  const records = usePrototypeRecords();
  return <>{records.map((record) => <tr key={record.id} className="bg-blue-50/30 hover:bg-blue-50"><td className="px-5 py-4 font-semibold text-blue-800"><Link href={`/candidates/${prototypeCandidateId(record)}`}>{record.candidateName}</Link><span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px]">신규</span></td><td className="px-5 py-4 text-slate-400">미입력</td><td className="px-5 py-4 text-slate-400">미입력</td><td className="px-5 py-4 text-slate-400">미입력</td><td className="px-5 py-4 text-slate-400">미입력</td><td className="px-5 py-4">1건</td><td className="px-5 py-4"><Link href={`/jobs/${prototypeJobId(record)}`}>{record.jobNo}</Link></td></tr>)}</>;
}

export function PrototypeJobRows() {
  const records = usePrototypeRecords();
  return <>{records.map((record) => <tr key={record.id} className="bg-blue-50/30 hover:bg-blue-50"><td className="px-5 py-4 font-semibold text-blue-800"><Link href={`/jobs/${prototypeJobId(record)}`}>{record.jobNo}</Link></td><td className="px-5 py-4"><Link href={`/candidates/${prototypeCandidateId(record)}`}>{record.candidateName}</Link></td><td className="px-5 py-4">{record.partnerCompany}</td><td className="px-5 py-4">{record.standard}<br/><span className="text-xs text-slate-500">{record.grade}</span></td><td className="px-5 py-4">기본정보 확인 중</td><td className="px-5 py-4 text-slate-400">미발행</td><td className="px-5 py-4 text-slate-400">-</td><td className="px-5 py-4 text-slate-400">-</td><td className="px-5 py-4">미인증</td><td className="px-5 py-4">{record.primaryOwner}</td></tr>)}</>;
}

export function PrototypePackageCards() {
  const records = usePrototypeRecords();
  return <>{records.map((record) => <div key={record.id} className="rounded-lg border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><Link href={`/jobs/${prototypeJobId(record)}`} className="font-semibold text-blue-800">{record.jobNo}</Link><p className="mt-1 text-sm text-slate-500">{record.candidateName} · {record.standard} · {record.grade}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">업무기록 대기</span></div><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-slate-600"><p>신규 신청이 연결되었습니다. 서류검토·심의·전달 기록 완료 후 패키지를 생성할 수 있습니다.</p><Link href={`/applications/${record.id}`} className="font-medium text-blue-800 underline">신청 보기</Link></div></div>)}</>;
}
