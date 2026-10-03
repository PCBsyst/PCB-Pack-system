"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { expiryBucket, expiryDays, koreaToday } from "@/lib/certification-expiry";

type ExpiryRow = { id: string; job_id: string; certification_no: string; valid_until: string; state: string; jobs: { job_no: string; standard: string; grade: string; candidates: { name: string } | { name: string }[] | null } | null };
export function DashboardExpiryQueue() {
  const [rows, setRows] = useState<ExpiryRow[]>([]);
  const [state, setState] = useState("loading");
  const [refresh, setRefresh] = useState(0);
  const [today, setToday] = useState("");
  const [windowDays, setWindowDays] = useState(30);
  const [scope, setScope] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!hasEnvVars) { setState("prototype"); return; }
    let active = true;
    setState("loading");
    const basis = koreaToday();
    void (async () => {
      const client = createClient();
      const result: ExpiryRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from("certification_records").select("id, job_id, certification_no, valid_until, state, jobs(job_no, standard, grade, candidates(name))").eq("history_state", "CURRENT").in("state", ["ACTIVE", "SUSPENDED"]).lte("issue_date", basis).order("id").range(offset, offset + 499);
        if (!active) return;
        if (error) { setState("error"); return; }
        result.push(...(data as unknown as ExpiryRow[]));
        if ((data?.length ?? 0) < 500) break;
      }
      setRows(result); setToday(basis); setPage(0); setState("ready");
    })().catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [refresh]);
  const named = rows.map((row) => ({ ...row, days: expiryDays(row.valid_until, today), candidate: Array.isArray(row.jobs?.candidates) ? row.jobs.candidates[0]?.name : row.jobs?.candidates?.name }));
  const visible = named.filter((row) => row.days !== null && (scope === "past" ? row.days < 0 : row.days >= 0 && row.days <= windowDays) && `${row.candidate ?? ""} ${row.certification_no} ${row.jobs?.standard ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => a.valid_until.localeCompare(b.valid_until));
  const lastPage = Math.max(0, Math.ceil(visible.length / 10) - 1), currentPage = Math.min(page, lastPage);
  return <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">인증 만료일 확인</h2><p className="mt-1 text-xs text-slate-500">현재 인증 중 인증 완료·정지 상태만 표시합니다. 철회 및 갱신으로 대체된 이력은 제외합니다.</p></div><button className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={state === "loading"} onClick={() => setRefresh((value) => value + 1)}>새로고침</button></div>
    {state !== "ready" ? <p role="status" className="p-5 text-sm text-slate-500">{state === "loading" ? "인증 만료일을 조회하고 있습니다." : state === "prototype" ? "가상데이터 모드: 인증 DB 미연결" : "만료일 자료 조회에 실패했습니다. 대상 0건으로 간주하지 않습니다."}</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm">한국 기준 {today} · 조회 {visible.length}건{named.some((row) => row.days === null) && " · 날짜 확인 필요 기록 있음"}</p><div className="flex flex-wrap gap-2"><select aria-label="만료일 구분" value={scope} onChange={(e) => { setScope(e.target.value); setPage(0); }} className="rounded border bg-white px-3 py-2 text-sm"><option value="upcoming">만료 예정·오늘</option><option value="past">만료일 경과</option></select><select aria-label="만료 예정 기간" disabled={scope === "past"} value={windowDays} onChange={(e) => { setWindowDays(Number(e.target.value)); setPage(0); }} className="rounded border bg-white px-3 py-2 text-sm">{[30, 60, 90].map((days) => <option key={days} value={days}>{days}일 이내</option>)}</select><input aria-label="후보자 인증번호 표준 검색" placeholder="후보자 / 인증번호 / 표준" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="rounded border bg-white px-3 py-2 text-sm"/></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50"><tr>{["후보자", "Job", "표준", "등급", "인증번호", "만료일", "일자 안내", "인증상태"].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{visible.slice(currentPage * 10, (currentPage + 1) * 10).map((row) => <tr className="border-b" key={row.id}><td className="p-3">{row.candidate ?? "후보자 미확인"}</td><td className="p-3"><Link className="text-blue-700 underline" href={`/jobs/${row.job_id}`}>{row.jobs?.job_no ?? "Job 보기"}</Link></td><td className="p-3">{row.jobs?.standard ?? "-"}</td><td className="p-3">{row.jobs?.grade ?? "-"}</td><td className="p-3">{row.certification_no}</td><td className="p-3">{row.valid_until}</td><td className="p-3 text-amber-700">{expiryBucket(row.days) === "past" ? `${Math.abs(row.days!)}일 경과` : row.days === 0 ? "오늘 만료일" : `${row.days}일 남음`}</td><td className="p-3">{row.state === "SUSPENDED" ? "인증 정지" : "인증 완료"}</td></tr>)}{!visible.length && <tr><td colSpan={8} className="p-8 text-center text-slate-500">조건에 맞는 인증이 없습니다.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-end gap-3 p-4 text-sm"><button className="rounded border px-3 py-1 disabled:opacity-50" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage + 1} / {lastPage + 1}</span><button className="rounded border px-3 py-1 disabled:opacity-50" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>다음</button></div>
      <p className="px-5 pb-4 text-xs text-slate-500">달력일 기준 안내입니다. 만료일·인증상태를 자동 변경하거나 갱신 신청을 생성하지 않습니다. 기준일은 새로고침할 때 갱신됩니다.</p>
    </>}
  </section>;
}
