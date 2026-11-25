"use client";

import {documentOutputReadiness} from "@/lib/document-output-readiness";
import type {PackageContext} from "@/lib/prototype-package";
import type {Job} from "@/types/certification";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { documentErrorMessage } from "@/lib/document-errors";
import { isTemplateReadinessRows, readinessCount, type TemplateReadinessRow } from "@/lib/template-readiness";

export function PackageTemplateReadiness({ languages, jobCount, context, jobs }: { languages: Record<"KR" | "EN", boolean>; jobCount: number; context:PackageContext; jobs:Job[] }) {
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
  const outputs=documentOutputReadiness(rows,context,jobs,languages);
  const counts = rows ? readinessCount(rows, languages, jobCount) : null;
  const labels = rows ? [...new Set(rows.map((row) => row.label))] : [];
  const sourceLabel = { DATABASE: "등록 양식", BUILT_IN: "내장 양식", MISSING: "미등록" };
  return <section className="mb-5 rounded-lg border bg-card p-4" aria-label="패키지 양식 준비 현황">
    <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">국문·영문 양식 준비 현황</h4><Button type="button" size="sm" variant="outline" onClick={() => setRevision((value) => value + 1)}>다시 확인</Button></div>
    <div aria-live="polite">
      {!rows && !error && <p className="mt-3 text-sm text-muted-foreground">양식 등록 상태와 실파일 필수 항목을 확인하고 있습니다.</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error} 등록 여부를 확인할 수 없는 상태입니다.</p>}
      {rows && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">문서</th><th>국문</th><th>영문</th></tr></thead><tbody>{labels.map((label) => <tr key={label} className="border-b last:border-0"><th className="py-2 font-medium">{label}</th>{(["KR", "EN"] as const).map((language) => { const row = rows.find((row) => row.label === label && row.language === language); return <td key={language} className={row?.source === "MISSING" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>{row ? sourceLabel[row.source] : "확인 필요"}</td>; })}</tr>)}</tbody></table></div>}
      {counts && <p className="mt-3 text-sm">선택한 {jobCount}개 Job·언어 기준: 총 {counts.expected}개 중 {counts.available}개 양식 준비. {counts.missing.length ? `누락: ${counts.missing.join(", ")}. 일부 생성은 전체 패키지 완료가 아닙니다.` : counts.expected ? "선택 언어의 3종 양식이 준비되어 있습니다." : !jobCount ? "연결된 Job을 확인해 주세요." : "생성할 언어를 선택해 주세요."}</p>}
    </div>
    <div className="mt-4 overflow-x-auto"><h4 className="mb-2 text-sm font-semibold">문서별 출력 준비 점검</h4>{!outputs.length?<p className="text-xs text-muted-foreground">생성 언어와 연결된 Job을 확인해 주세요.</p>:<table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b"><th className="py-2">Job / 문서</th><th>언어</th><th>정식 DOCX · 번역 입력</th><th>HTML 지원 범위</th></tr></thead><tbody>{outputs.map(output=><tr key={`${output.jobId}-${output.id}`} className="border-b"><th className="py-2 font-medium">{output.jobNo}<br/>{output.label}</th><td>{output.language==="KR"?"국문":"영문"}</td><td className="py-2">{output.issues.length?<ul className="list-inside list-disc">{output.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul>:"양식·번역 입력 확인 · 생성 시 서버 재대조"}{output.translationIssues.some(issue=>issue.includes("근거")||issue.includes("확인 위치"))&&<Link className="mt-1 block underline" href="?tab=review">서류검토 근거 입력</Link>}{output.translationIssues.some(issue=>!issue.includes("준비 중"))&&<a className="mt-1 block underline" href="#english-document-input">영문 입력 확인 위치</a>}</td><td>{output.htmlSupported?(output.htmlIssues.length?`번역 확인 필요: ${output.htmlIssues.join(" / ")}`:"디자인 검토본 지원"):"현재 국문만 지원"}</td></tr>)}</tbody></table>}</div>
    <p className="mt-2 text-xs text-muted-foreground">확인 시점의 실파일 구조·필수 입력 칸·초안 표시를 검사합니다. 실제 업무값과 다운로드 검사는 생성 시 다시 수행합니다. 페이지 배치의 시각 검증과 PDF 일괄 생성은 별도입니다.</p>
  </section>;
}
