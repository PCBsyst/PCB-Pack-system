"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type ReceiptRow = { id: string; actor_id: string; occurred_at: string; file_count: number; complete: boolean; sha256: string; byte_size: number; documents: Array<{ jobId: string; documentType: string; language: string; entryName: string }> };

export function PackageGenerationHistory({ applicationId }: { applicationId: string }) {
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("서버 생성기록 확인 중...");
  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    const load = async () => {
      const current = ++sequence;
      if (!hasEnvVars) { setNotice("로컬 미리보기: 서버 생성기록은 DB 연결 후 사용할 수 있습니다."); return; }
      const client = createClient();
      const { data, error } = await client.from("package_generation_receipts").select("id, actor_id, occurred_at, file_count, complete, sha256, byte_size, documents").eq("application_id", applicationId).order("occurred_at", { ascending: false }).limit(30);
      if (cancelled || current !== sequence) return;
      if (error) { setNotice("서버 생성기록 DB 적용 또는 연결 확인 대기입니다. 화면의 생성 표시를 서버 기록으로 간주하지 않습니다."); return; }
      setRows((data ?? []) as ReceiptRow[]); setNotice("");
      const ids = [...new Set((data ?? []).map((row) => row.actor_id))];
      if (ids.length) {
        const { data: profiles } = await client.from("profiles").select("id, display_name").in("id", ids);
        if (!cancelled && current === sequence) setNames(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.display_name])));
      }
    };
    const refresh = () => { void load().catch(() => { if (!cancelled) setNotice("서버 기록 조회에 실패했습니다."); }); };
    refresh(); window.addEventListener("package-generation-recorded", refresh);
    return () => { cancelled = true; window.removeEventListener("package-generation-recorded", refresh); };
  }, [applicationId]);
  return <section className="my-5 rounded-lg border bg-white p-4">
    <h3 className="text-sm font-semibold">서버 패키지 생성기록</h3>
    <p className="mt-1 text-xs text-slate-500">직원이 수정·삭제할 수 없는 생성기록입니다. 서버 생성 사실이며 이메일 전달 또는 PC 저장 완료를 의미하지 않습니다. 최근 30건을 표시합니다.</p>
    {notice ? <p role="status" className="mt-3 text-sm text-amber-800">{notice}</p> : rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">아직 서버에 보존된 생성기록이 없습니다.</p> : <div className="mt-3 divide-y">{rows.map((row) => <div key={row.id} className="py-3 text-sm"><p className="font-medium">{new Date(row.occurred_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {names[row.actor_id] ?? "직원"} · DOCX {row.file_count}개 · {row.complete ? "선택 양식 포함" : "일부 양식만 생성"}</p><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">포함 문서·검증값 보기</summary><p className="mt-2 break-all">기록 ID: {row.id} · 처리자 ID: {row.actor_id}<br/>ZIP: {row.byte_size.toLocaleString()} bytes · SHA-256: {row.sha256}</p><ul className="mt-2 space-y-1">{row.documents.map((item) => <li key={item.entryName} className="break-all">{item.entryName}</li>)}</ul></details></div>)}</div>}
  </section>;
}
