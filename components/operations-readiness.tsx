"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { databaseReadinessChecks, policyReadinessChecks, probeOperationsReadiness, manualReadinessChecks, readinessSummary, type ReadinessResult, type ReadinessStatus } from "@/lib/operations-readiness";

const labels: Record<ReadinessStatus, string> = { READABLE: "구조·정책 조회 가능", PENDING: "DB 적용 확인 필요", ERROR: "연결·권한 확인 필요", UNTESTED: "미검증" };

export function OperationsReadiness() {
  const [results, setResults] = useState<ReadinessResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [notice, setNotice] = useState("");
  const checking = useRef(false);
  const scope = useRef(0);
  async function check() {
    if (checking.current) return;
    checking.current = true;
    const token = ++scope.current;
    setBusy(true); setNotice(""); setResults([]); setCheckedAt("");
    try {
      if (!hasEnvVars) {
        if (token !== scope.current) return;
        setResults([...databaseReadinessChecks, ...policyReadinessChecks].map((item) => ({ id: item.id, status: "UNTESTED", detail: "로컬 가상데이터 모드: DB 조회를 실행하지 않았습니다." })));
      } else {
        const client = createClient();
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) throw new Error("로그인 상태 확인이 필요합니다.");
        const { data: profile, error: profileError } = await client.from("profiles").select("active,is_owner").eq("id", user.id).single();
        if (profileError || !profile?.active || !profile.is_owner) throw new Error("최고관리자 권한을 확인하지 못했습니다.");
        if (token !== scope.current) return;
        const checks = await probeOperationsReadiness(client);
        if (token !== scope.current) return;
        setResults(checks);
      }
      if (token === scope.current) setCheckedAt(new Date().toISOString());
    } catch (error) {
      if (token !== scope.current) return;
      setResults([]); setCheckedAt("");
      setNotice(error instanceof Error ? error.message : "운영 점검에 실패했습니다.");
    } finally { if (token === scope.current) { checking.current = false; setBusy(false); } }
  }
  useEffect(() => { void check(); return () => { scope.current++; checking.current = false; }; }, []);
  const summary = readinessSummary(results);
  return <section className="rounded-xl border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">운영 전 점검</h3><Button variant="outline" disabled={busy} onClick={() => void check()}>{busy ? "확인 중..." : "읽기 전용 재점검"}</Button></div>
    <p className="mt-2 text-sm text-slate-600">코드 구현과 운영 적용은 다릅니다. 이 점검은 DB 조회 가능 여부만 확인하며 실제 개인정보 이관을 승인하지 않습니다.</p>
    {notice && <p role="alert" className="mt-3 text-sm text-red-800">{notice}</p>}
    {checkedAt && <p className="mt-3 text-xs text-slate-500">마지막 확인: {new Date(checkedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · 조회 가능 {summary.readable} / 적용 확인 {summary.pending} / 오류 {summary.error}</p>}
    <div className="mt-4 divide-y">{[...databaseReadinessChecks, ...policyReadinessChecks].map((item) => {
      const result = results.find((row) => row.id === item.id);
      return <div key={item.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{item.label}</p><span className={`rounded-full px-2 py-1 text-xs ${result?.status === "READABLE" ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-900"}`}>{busy ? "확인 중" : labels[result?.status ?? "UNTESTED"]}</span></div><p className="mt-2 text-xs text-slate-500">{result?.detail ?? "아직 확인하지 않았습니다."}</p></div>;
    })}</div>
    <h4 className="mt-5 border-t pt-4 text-sm font-semibold">별도 구축·실행 검증이 남은 항목</h4>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{manualReadinessChecks.map((item) => <div key={item.label} className="rounded-lg border bg-slate-50 p-3"><p className="text-sm font-medium">{item.label} · 미검증</p><p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p></div>)}</div>
    <p className="mt-4 text-xs text-slate-500">SQL 019~032 적용 여부는 별도 확인이 필요합니다. 이 화면은 구조·MFA·운영 모드·현재 세션·미사용 기한 읽기만 수행합니다. 번호 분리 제약·이관 함수 내용·RLS 정책은 이 결과만으로 확인되지 않습니다. SQL 실행·고객 정보 수정·자동백업은 수행하지 않습니다.</p>
  </section>;
}
