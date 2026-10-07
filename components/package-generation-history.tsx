"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { documentHistoryLabel, filterPackageHistory, summarizeHistoryDocuments, parsePackageHistoryRows, type PackageHistoryRow } from "@/lib/package-history-summary";

type ReceiptRow = PackageHistoryRow;

export function PackageGenerationHistory({ applicationId }: { applicationId: string }) {
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("서버 생성기록 확인 중...");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<"ALL" | "COMPLETE" | "PARTIAL">("ALL");
  const [language, setLanguage] = useState<"ALL" | "KR" | "EN">("ALL");
  const visible = filterPackageHistory(rows, status, language);
  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    setRows([]); setNames({}); setNotice("서버 생성기록 확인 중...");
    const load = async () => {
      const current = ++sequence;
      setRows([]); setNames({});
      setNotice("서버 생성기록 확인 중...");
      try {
      if (!hasEnvVars) { setNotice("로컬 미리보기: 서버 생성기록은 DB 연결 후 사용할 수 있습니다."); return; }
      const client = createClient();
      const { data, error } = await client.from("package_generation_receipts").select("id, actor_id, occurred_at, file_count, complete, sha256, byte_size, documents").eq("application_id", applicationId).order("occurred_at", { ascending: false }).limit(30);
      if (cancelled || current !== sequence) return;
      if (error) { setRows([]); setNotice("서버 생성기록 DB 적용 또는 연결 확인 대기입니다. 화면의 생성 표시를 서버 기록으로 간주하지 않습니다."); return; }
      const verified = parsePackageHistoryRows(data);
      if (!verified) { setNotice("생성기록의 문서 구성·파일 수·검증값을 확인하지 못했습니다. 정상 생성기록으로 표시하지 않습니다. 다시 확인하거나 관리자에게 문의해 주세요."); return; }
      setRows(verified); setNotice("");
      const ids = [...new Set(verified.map((row) => row.actor_id))];
      if (ids.length) {
        const { data: profiles, error: profileError } = await client.from("profiles").select("id, display_name").in("id", ids);
        if (!cancelled && current === sequence && !profileError) setNames(Object.fromEntries((profiles ?? []).filter((profile) => ids.includes(profile.id) && typeof profile.display_name === "string").map((profile) => [profile.id, profile.display_name])));
      }
      } catch { if (!cancelled && current === sequence) { setRows([]); setNotice("서버 기록 조회에 실패했습니다. 다시 확인해 주세요."); } }
    };
    const refresh = () => { void load(); };
    refresh(); window.addEventListener("package-generation-recorded", refresh);
    return () => { cancelled = true; window.removeEventListener("package-generation-recorded", refresh); };
  }, [applicationId, revision]);
  return <section className="my-5 rounded-lg border bg-card p-4 text-card-foreground">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">서버 패키지 생성기록</h3><button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => setRevision((value) => value + 1)}>다시 확인</button></div>
    <p className="mt-1 text-xs text-muted-foreground">최근 30건 안에서 필터링합니다. 과거 생성 당시의 기록이며 현재 입력과의 일치, 이메일 전달 또는 PC 저장 완료를 보장하지 않습니다. 파일 자체는 이 목록에 보관되지 않습니다.</p>
    <div className="mt-3 flex flex-wrap gap-3 text-xs"><label>생성 범위 <select className="rounded border bg-background p-1" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="ALL">전체 기록</option><option value="COMPLETE">선택 범위 전체 생성</option><option value="PARTIAL">부분 생성</option></select></label><label>포함 언어 <select className="rounded border bg-background p-1" value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}><option value="ALL">모든 언어</option><option value="KR">국문 포함</option><option value="EN">영문 포함</option></select></label></div>
    {notice ? <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-300">{notice}</p> : visible.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{rows.length ? "선택 조건에 맞는 기록이 없습니다." : "아직 서버에 보존된 생성기록이 없습니다."}</p> : <div className="mt-3 divide-y">{visible.map((row) => { const summary = summarizeHistoryDocuments(row.documents); return <div key={row.id} className="py-3 text-sm"><p className="font-medium">{new Date(row.occurred_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {names[row.actor_id] ?? "직원"} · {row.complete ? "선택 범위 전체 생성" : "부분 생성"}</p><p className="mt-1 text-xs text-muted-foreground">{summary.jobs}개 Job · DOCX {row.file_count}개 · 국문 {summary.korean}개 / 영문 {summary.english}개</p><details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">포함 문서·양식 개정·검증값 보기</summary><p className="mt-2 break-all">기록 ID: {row.id} · 처리자 ID: {row.actor_id}<br/>ZIP: {row.byte_size.toLocaleString()} bytes · SHA-256: {row.sha256}</p><ul className="mt-2 space-y-2">{row.documents.map((item, index) => <li key={`${item.entryName}-${index}`} className="break-all"><p className="font-medium text-foreground">{documentHistoryLabel(item)}</p><p>{item.entryName}</p><p>{item.template ? `양식 ${item.template.version} · ${item.template.source === "DATABASE" ? "등록 양식" : item.template.source === "BUILT_IN" ? "내장 양식" : item.template.source} · SHA-256: ${item.template.sha256}` : "양식 개정정보가 없는 이전 기록"}</p></li>)}</ul></details></div>; })}</div>}
  </section>;
}
