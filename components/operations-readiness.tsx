"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { classifyReadinessError, databaseReadinessChecks, manualReadinessChecks, readinessSummary, type ReadinessResult, type ReadinessStatus } from "@/lib/operations-readiness";

const labels: Record<ReadinessStatus, string> = { READABLE: "DB 조회 가능", PENDING: "DB 적용 확인 필요", ERROR: "연결·권한 확인 필요", UNTESTED: "미검증" };

export function OperationsReadiness() {
  const [results, setResults] = useState<ReadinessResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [notice, setNotice] = useState("");
  async function check() {
    setBusy(true); setNotice("");
    try {
      if (!hasEnvVars) {
        setResults(databaseReadinessChecks.map((item) => ({ id: item.id, status: "UNTESTED", detail: "로컬 가상데이터 모드: DB 조회를 실행하지 않았습니다." })));
      } else {
        const client = createClient();
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) throw new Error("로그인 상태 확인이 필요합니다.");
        const { data: profile } = await client.from("profiles").select("active,is_owner").eq("id", user.id).single();
        if (!profile?.active || !profile.is_owner) throw new Error("최고관리자만 운영 점검을 실행할 수 있습니다.");
        const checks = await Promise.all(databaseReadinessChecks.map(async (item): Promise<ReadinessResult> => {
          // Only zero-row schema/access probes: no customer data fetched, no writes or RPC side effects.
          const { error: queryError } = await client.from(item.table).select(item.columns).limit(0);
          const status = classifyReadinessError(queryError);
          return { id: item.id, status, detail: status === "READABLE" ? "필요한 테이블·열의 조회 요청이 성공했습니다. 저장·RLS·RPC 동작 검증은 별도입니다." : status === "PENDING" ? `SQL ${item.migration} 적용 또는 DB 스키마 상태를 확인해야 합니다.` : "조회 실패: 네트워크·권한·서비스 상태를 확인해야 합니다." };
        }));
        setResults(checks);
      }
      setCheckedAt(new Date().toISOString());
    } catch (error) {
      setResults([]); setCheckedAt("");
      setNotice(error instanceof Error ? error.message : "운영 점검에 실패했습니다.");
    } finally { setBusy(false); }
  }
  useEffect(() => { void check(); }, []);
  const summary = readinessSummary(results);
  return <section className="rounded-xl border bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">운영 전 점검</h3><Button variant="outline" disabled={busy} onClick={() => void check()}>{busy ? "확인 중..." : "읽기 전용 재점검"}</Button></div>
    <p className="mt-2 text-sm text-slate-600">코드 구현과 운영 적용은 다릅니다. 이 점검은 DB 조회 가능 여부만 확인하며 실제 개인정보 이관을 승인하지 않습니다.</p>
    {notice && <p role="alert" className="mt-3 text-sm text-red-800">{notice}</p>}
    {checkedAt && <p className="mt-3 text-xs text-slate-500">마지막 확인: {new Date(checkedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · 조회 가능 {summary.readable} / 적용 확인 {summary.pending} / 오류 {summary.error}</p>}
    <div className="mt-4 divide-y">{databaseReadinessChecks.map((item) => {
      const result = results.find((row) => row.id === item.id);
      return <div key={item.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{item.label}</p><span className={`rounded-full px-2 py-1 text-xs ${result?.status === "READABLE" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-900"}`}>{busy ? "확인 중" : labels[result?.status ?? "UNTESTED"]}</span></div><p className="mt-2 text-xs text-slate-500">{result?.detail ?? "아직 확인하지 않았습니다."}</p></div>;
    })}</div>
    <h4 className="mt-5 border-t pt-4 text-sm font-semibold">별도 구축·실행 검증이 남은 항목</h4>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{manualReadinessChecks.map((item) => <div key={item.label} className="rounded-lg border bg-slate-50 p-3"><p className="text-sm font-medium">{item.label} · 미검증</p><p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p></div>)}</div>
    <p className="mt-4 text-xs text-slate-500">SQL 019~024 및 외부 설정 작업은 적용 대기 목록으로 모아두었습니다. 이 화면에서 SQL 실행·고객 정보 수정·자동백업은 수행하지 않습니다.</p>
  </section>;
}
