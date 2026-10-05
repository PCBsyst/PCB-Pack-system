"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { documentErrorMessage } from "@/lib/document-errors";
import { isTemplateReadinessRows, readinessCount, type TemplateReadinessRow } from "@/lib/template-readiness";

export function PackageTemplateReadiness({ languages, jobCount }: { languages: Record<"KR" | "EN", boolean>; jobCount: number }) {
  const [rows, setRows] = useState<TemplateReadinessRow[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRows(null); setError("");
    void (async () => {
      try {
        const response = await fetch("/api/documents/template-readiness", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(await documentErrorMessage(response));
        const data = await response.json();
        if (!isTemplateReadinessRows(data?.templates)) throw new Error("양식 현황을 확인하지 못했습니다.");
        if (!controller.signal.aborted) setRows(data.templates);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "양식 현황을 확인하지 못했습니다.");
      }
    })();
    return () => controller.abort();
  }, [revision]);
  const counts = rows ? readinessCount(rows, languages, jobCount) : null;
  const labels = rows ? [...new Set(rows.map((row) => row.label))] : [];
  const sourceLabel = { DATABASE: "등록 양식", BUILT_IN: "내장 양식", MISSING: "미등록" };
  return <section className="mb-5 rounded-lg border bg-card p-4" aria-label="패키지 양식 준비 현황">
    <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">국문·영문 양식 준비 현황</h4><Button type="button" size="sm" variant="outline" onClick={() => setRevision((value) => value + 1)}>다시 확인</Button></div>
    <div aria-live="polite">
      {!rows && !error && <p className="mt-3 text-sm text-muted-foreground">양식 등록 상태와 실파일 필수 항목을 확인하고 있습니다.</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error} 등록 여부를 확인할 수 없는 상태입니다.</p>}
      {rows && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">문서</th><th>국문</th><th>영문</th></tr></thead><tbody>{labels.map((label) => <tr key={label} className="border-b last:border-0"><th className="py-2 font-medium">{label}</th>{(["KR", "EN"] as const).map((language) => { const row = rows.find((row) => row.label === label && row.language === language); return <td key={language} className={row?.source === "MISSING" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>{row ? sourceLabel[row.source] : "확인 필요"}</td>; })}</tr>)}</tbody></table></div>}
      {counts && <p className="mt-3 text-sm">선택한 {jobCount}개 Job·언어 기준: 총 {counts.expected}개 중 {counts.available}개 양식 준비. {counts.missing.length ? `누락: ${counts.missing.join(", ")}. 일부 생성은 전체 패키지 완료가 아닙니다.` : counts.expected ? "선택 언어의 3종 양식이 준비되어 있습니다." : "생성할 언어를 선택해 주세요."}</p>}
    </div>
    <p className="mt-2 text-xs text-muted-foreground">확인 시점의 실파일 구조·필수 입력 칸·초안 표시를 검사합니다. 실제 업무값과 다운로드 검사는 생성 시 다시 수행합니다. 페이지 배치의 시각 검증과 PDF 일괄 생성은 별도입니다.</p>
  </section>;
}
