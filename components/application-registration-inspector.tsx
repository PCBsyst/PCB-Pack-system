"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { inspectApplicationRegistration } from "@/lib/application-registration-inspection";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";
type Inspection = Awaited<ReturnType<typeof inspectApplicationRegistration>>;

export function ApplicationRegistrationInspector() {
  const [applicationNo, setApplicationNo] = useState(""), [result, setResult] = useState<Inspection>(null), [notice,setNotice] = useState(""), [loading,setLoading] = useState(false);
  const busy = useRef(false), mounted = useRef(true), revision = useRef(0);
  useEffect(() => { mounted.current = true; const value = new URLSearchParams(window.location.search).get("check"); if(value && value.length <= 100 && !/[\u0000-\u001f]/.test(value)) setApplicationNo(value); return () => { mounted.current = false; revision.current++; }; }, []);
  const inspect = async () => {
    if (busy.current) return;
    if (!hasEnvVars) { setNotice("공유 DB 연결 후 사용할 수 있습니다. 가상 기록으로 확인 결과를 대신하지 않습니다."); return; }
    const requested = applicationNo.trim();
    if (!requested || requested.length > 100 || /[\u0000-\u001f]/.test(requested)) { setNotice("확인할 신청번호를 입력해 주세요."); return; }
    busy.current = true; const version = ++revision.current; setLoading(true); setResult(null); setNotice("신청 연결 기록을 조회하고 있습니다.");
    const cancelled = () => !mounted.current || revision.current !== version;
    try { const value = await inspectApplicationRegistration(createClient(), requested, cancelled); if(cancelled() || !value) return; setResult(value); setNotice(value.found ? "조회된 연결 기록을 대조했습니다. 전체 저장 완료를 보증하는 결과는 아닙니다." : "해당 신청번호가 조회되지 않았습니다. 권한이나 번호를 확인하세요. 후보자·예약번호가 남아 있을 수 있어 곧바로 재등록하지 마세요."); }
    catch { if(!cancelled()) { setResult(null); setNotice("조회 결과를 확인하지 못했습니다. 연결·권한을 확인하고 다시 조회하세요. 조회 실패는 기록 없음이 아닙니다."); } }
    finally { busy.current = false; if(mounted.current) setLoading(false); }
  };
  return <div className="border-b bg-card p-4"><details open={Boolean(applicationNo)}><summary className="cursor-pointer text-sm font-semibold">신청 저장·연결 점검 (읽기 전용)</summary>
    <p className="mt-2 text-xs text-muted-foreground">부분 저장 경고의 신청번호로 후보자 연결·Job·초기 회차·담당자 지정 여부를 확인합니다. 자동 수정·삭제·재등록은 하지 않습니다.</p>
    <div className="mt-3 flex flex-wrap gap-2"><input aria-label="연결 점검 신청번호" className={controlClass} placeholder="신청번호 입력" value={applicationNo} maxLength={100} onChange={event => { revision.current++; setApplicationNo(event.target.value); setResult(null); setNotice(""); }}/><Button type="button" variant="outline" disabled={loading} onClick={inspect}>{loading ? "점검 중..." : "저장 연결 확인"}</Button></div>
    {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
    {result?.found && <div className="mt-3 space-y-3"><p className="text-sm">{result.applicationNo} · 관리번호 {result.managementFrom}~{result.managementTo} · 조회 Job {result.jobs.length}건 · 후보자 연결 {result.candidatePresent ? "확인" : "미조회"}</p>
      {result.issues.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">{result.issues.map((issue,index) => <li key={index}>{issue}</li>)}</ul> : <p className="text-sm">조회 범위에서 연결 불일치가 발견되지 않았습니다.</p>}
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Job 번호","표준·등급","관리번호","초기 회차","확인사항"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{result.jobs.map(job => <tr key={job.id} className="border-t"><td className="p-2"><Link className="underline" href={`/jobs/${job.id}`}>{job.jobNo}</Link></td><td className="p-2">{job.standard} · {job.grade}</td><td className="p-2">{job.managementNo}</td><td className="p-2">{job.initialCycles}건</td><td className="p-2">{job.notes.join(" · ") || "조회 연결 일치"}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">관리번호 범위 자체가 저장되지 않았거나 원래 신청한 분야가 누락된 경우에는 이 점검만으로 알 수 없습니다. 원 신청 내역과 대조하세요. 여러 조회 시점이 달라 동시에 변경된 자료는 다시 확인해야 합니다.</p><Link className="text-sm underline" href={`/applications/${result.applicationId}`}>신청 처리화면 열기</Link>
    </div>}
  </details></div>;
}
