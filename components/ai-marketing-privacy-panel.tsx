"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {aiMarketingPrivacySample} from "@/lib/ai-marketing-preview-sample";
import {fetchAiMarketingPreview} from "@/lib/ai-marketing-preview-request";
import {readAiMarketingPrivacyPreview,type AiMarketingPrivacyPreview} from "@/lib/ai-marketing-privacy";
import {readAiMarketingReadiness,type AiMarketingReadiness} from "@/lib/ai-marketing-readiness";
import {boundedDownloadBlob} from "@/lib/bounded-download";
import {documentErrorMessage} from "@/lib/document-errors";
export function AiMarketingPrivacyPanel({contextKey,example}:{contextKey:string;example:boolean}) {
  const [preview,setPreview]=useState<{key:string;data:AiMarketingPrivacyPreview}|null>(null),[readiness,setReadiness]=useState<AiMarketingReadiness|null>(null),[message,setMessage]=useState(""),[pending,setPending]=useState(false);
  const mounted=useRef(true),latest=useRef(contextKey),busy=useRef(false),controller=useRef<AbortController|null>(null);latest.current=contextKey;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  useEffect(()=>{setPreview(null);setReadiness(null);setMessage("");controller.current?.abort();},[contextKey]);
  const run=async(action:"sample"|"preview"|"readiness")=>{
    if(busy.current)return;busy.current=true;setPending(true);setMessage("");const started=contextKey;controller.current=new AbortController();const timer=setTimeout(()=>controller.current?.abort(),30000);
    if(action==="readiness")setReadiness(null);else setPreview(null);
    try {
      if(action==="readiness"){
        const response=await fetch("/api/reports/ai-marketing-readiness",{cache:"no-store",credentials:"same-origin",signal:controller.current.signal});if(!response.ok)throw Error(await documentErrorMessage(response));if(!response.headers.get("Content-Type")?.startsWith("application/json"))throw Error("준비 상태 응답 형식 오류");
        const blob=await boundedDownloadBlob(response,Number(response.headers.get("X-Report-Bytes")),16*1024),value=readAiMarketingReadiness(JSON.parse(await blob.text()));
        if(mounted.current&&latest.current===started)setReadiness(value);
      }else{
        const value=action==="sample"?readAiMarketingPrivacyPreview(aiMarketingPrivacySample()):await fetchAiMarketingPreview(controller.current.signal);
        if(mounted.current&&latest.current===started){setPreview({key:started,data:value});setMessage("보호 미리보기를 만들었습니다. AI 서비스로 전송하지 않았습니다.");}
      }
    }catch(error){if(mounted.current&&latest.current===started)setMessage(error instanceof Error&&error.name!=="AbortError"?error.message:"조회가 중단되거나 시간이 초과됐습니다. 다시 시도해 주세요.");}
    finally{clearTimeout(timer);busy.current=false;if(mounted.current)setPending(false);}
  };
  const active=preview?.key===contextKey?preview.data:null;
  const download=()=>{
    if(!active?.payload||latest.current!==contextKey)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(active.payload,null,2)],{type:"application/json;charset=utf-8"})),anchor=document.createElement("a");anchor.href=url;anchor.download=`AI집계보호_검토용_${active.year}${active.source==="SYNTHETIC"?"_가상예제":""}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  return <section className="space-y-3 rounded-lg border p-4" aria-label="AI 집계 보호 미리보기"><h4 className="text-sm font-semibold">AI 집계 보호 미리보기 · 실제 전송 비활성</h4><p className="text-xs text-muted-foreground">직전 마감 연도와 그 전년의 전체 조건만 사용합니다. 상단의 연도·세부 필터는 전달하지 않습니다. 작은 집단은 두 기간 모두 제외하고 허용된 표준 코드와 5명 단위 구간만 구성합니다. 합계·월별 값·등급·증감률·파트너명·개인정보·검토 문장은 후보 데이터에 넣지 않습니다.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending} onClick={()=>void run("sample")}>가상 집계 보호 예제</Button><Button type="button" variant="outline" disabled={pending||example} onClick={()=>void run("preview")}>서버 집계 보호 미리보기</Button><Button type="button" variant="outline" disabled={pending} onClick={()=>void run("readiness")}>최고관리자 연결 준비 확인</Button><Button type="button" variant="outline" disabled={!active?.payload||pending} onClick={download}>후보 JSON 다운로드 (검토용)</Button></div>
    {example&&<p className="text-xs text-muted-foreground">상단 가상 모드에서는 실제 서버 집계 미리보기를 제한합니다. 보호 예제와 관리자 준비 상태 확인은 별도 동작입니다.</p>}
    {pending&&<p role="status" className="text-sm">보호 구성과 준비 상태를 확인하고 있습니다.</p>}{message&&<p role="status" className="text-sm">{message}</p>}
    {active&&<div className="space-y-3 rounded border p-3"><p className="text-sm font-semibold">{active.source==="SYNTHETIC"?"완전 가상 집계 예제":"서버 집계 검토본"} · {active.year-1}년 / {active.year}년</p><p className="text-xs">제외: 작은 집단 {active.excluded.smallGroups}개 / 승인된 코드에 없는 표준 {active.excluded.unapprovedCodes}개. 제외 건수는 내부 진단이며 후보 JSON에는 포함하지 않습니다.</p>{active.payload?<><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">허용 표준 코드</th><th className="p-2">전년 고객 구간</th><th className="p-2">마감 연도 고객 구간</th></tr></thead><tbody>{active.payload.records.map(row=><tr key={row.standardCode} className="border-b"><td className="p-2">{row.standardCode}</td><td className="p-2">{row.previousBand.min}~{row.previousBand.max}명</td><td className="p-2">{row.currentBand.min}~{row.currentBand.max}명</td></tr>)}</tbody></table></div><details><summary className="cursor-pointer text-xs">허용 속성만 남긴 후보 JSON 확인</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(active.payload,null,2)}</pre></details></>:<p className="text-sm">보호 조건을 통과한 표준 집계가 없어 후보 JSON을 만들지 않았습니다.</p>}</div>}
    {readiness&&<div className="rounded border p-3 text-xs"><p className="font-semibold">외부 전송: 강제 비활성 · API 호출 없음</p><ul className="mt-2 list-disc space-y-2 pl-4"><li>서버 API 키 설정값: {readiness.apiKeyPresent?"존재 (유효성 미검증)":"없음"}</li><li>서버 모델 설정값: {readiness.modelPresent?"존재 (사용 가능 여부 미검증)":"없음"}</li><li>최고관리자 ON/OFF·사유·감사 절차: 미연결</li><li>계정별 외부 보관 조건 확인: 대기</li><li>AI 전송 감사 기록: 미연결</li><li>반복 조회·중첩 집단의 차분 노출 검토: 대기</li></ul><p className="mt-3">설정값이 있어도 전송이 활성화되지 않습니다. API 키나 모델 설정값 원문은 이 화면에 반환하지 않습니다.</p></div>}
    <p className="text-xs text-muted-foreground">미리보기 통과는 전송 승인이나 완전 익명 보장이 아닙니다. 중첩 집단·외부 정보 결합·반복 조회에 따른 재식별 위험을 검토하고 최고관리자 제어·감사·보관 조건을 갖춘 후에만 별도 전송 기능을 연결합니다.</p>
  </section>;
}
