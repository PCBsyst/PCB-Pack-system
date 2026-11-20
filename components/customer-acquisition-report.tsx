"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {hasEnvVars} from "@/lib/utils";
import {buildCustomerAcquisition,type CustomerAcquisitionReport,type AcquisitionFilters} from "@/lib/customer-acquisition";
import {customerAcquisitionSample} from "@/lib/customer-acquisition-sample";
import {fetchCustomerAcquisition} from "@/lib/customer-acquisition-request";
import {serializeReportCsv} from "@/lib/report-export";

export function CustomerAcquisitionReport({year,filters,parentRevision}:{year:number;filters:AcquisitionFilters;parentRevision:number}) {
  const [example,setExample]=useState(false),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [report,setReport]=useState<{key:string;data:CustomerAcquisitionReport}|null>(null);
  const key=JSON.stringify({year,filters,example,revision,parentRevision}),latest=useRef(key);latest.current=key;
  useEffect(()=>{
    let active=true;const controller=new AbortController();
    setReport(null);setError("");setLoading(true);
    const timer=setTimeout(()=>controller.abort(),30000);
    void (async()=>{
      try {
        if(!Number.isInteger(year)||year<1901)throw Error("비교할 연도를 선택해 주세요.");
        let data:CustomerAcquisitionReport;
        if(example){const sample=customerAcquisitionSample();data=buildCustomerAcquisition(sample.applications,sample.jobs,year,filters,"2026-11-20");}
        else {if(!hasEnvVars)throw Error("공유 DB가 연결되지 않았습니다. 가상 예제로 먼저 확인할 수 있습니다.");data=await fetchCustomerAcquisition(year,filters,controller.signal);}
        if(active&&latest.current===key)setReport({key,data});
      }catch(cause){if(active&&latest.current===key)setError(cause instanceof Error&&cause.name!=="AbortError"?cause.message:"조회 시간이 초과됐습니다. 다시 조회해 주세요.");}
      finally{clearTimeout(timer);if(active&&latest.current===key)setLoading(false);}
    })();
    return()=>{active=false;controller.abort();clearTimeout(timer);};
  },[key,year,example]); // key contains filters and refresh revisions; stale reports never render.
  const data=report?.key===key?report.data:null;
  const maximum=data?Math.max(1,...data.months.flatMap(row=>[row.current?.firstObservedCandidates??0,row.previous?.firstObservedCandidates??0])):1;
  const sum=(side:"current"|"previous")=>data?.months.reduce((total,row)=>total+(row[side]?.firstObservedCandidates??0),0)??0;
  const exportCsv=()=>{
    if(!data||latest.current!==key)return;
    const rows=[ ["보고서","월별 관측 첫접수 비교"],["자료",example?"가상 예제 · 실제 고객 자료 아님":"서버 신청·Job 전체 범위 재조회"],["확정 신규 고객·증가율","과거 전체 이력 미확인으로 산출 보류"],["한국 기준일",data.asOf],["분야",filters.area],["표준",filters.standard],["파트너",filters.partner],["관측 시작",data.readiness.observedFrom??"자료 없음"],["관측 마지막 접수",data.readiness.observedThrough??"자료 없음"],[],
      ["월","상태","전년도 비교 종료일","올해 비교 종료일","전년도 관측 첫접수 고객","올해 관측 첫접수 고객","전년도 관측 첫 표준(조합 건)","올해 관측 첫 표준(조합 건)","올해 관측 기존고객 표준추가(조합 건)","확정 신규 고객","신규 증감률"],
      ...data.months.map(row=>[String(row.month),row.status==="NOT_ARRIVED"?"미도래":row.status==="PROVISIONAL"?"진행 월 · 동일 일자 비교":"마감 월",row.previousEnd,row.currentEnd,row.previous?.firstObservedCandidates??"미도래",row.current?.firstObservedCandidates??"미도래",row.previous?.firstObservedStandardPairs??"미도래",row.current?.firstObservedStandardPairs??"미도래",row.current?.observedExistingStandardAdditions??"미도래","산출 보류","산출 보류"] )];
    const url=URL.createObjectURL(new Blob(["\ufeff",serializeReportCsv(rows)],{type:"text/csv;charset=utf-8"})),anchor=document.createElement("a");anchor.href=url;anchor.download=`관측첫접수비교_${data.year}${example?"_가상예제":""}.csv`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  return <section className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground" aria-label="신규 고객 비교와 자료 준비 상태">
    <div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><h2 className="font-semibold">신규 고객 비교와 자료 준비 상태</h2><p className="mt-1 text-xs text-muted-foreground">{year-1}년·{year}년 월별 비교 · 신규 접수 기준 · 외부 AI 전송 없음</p></div><Button type="button" variant="outline" disabled={loading} onClick={()=>setExample(v=>!v)}>{example?"실제 DB 비교로 돌아가기":"가상 비교 예제 보기"}</Button><Button type="button" variant="outline" disabled={loading} onClick={()=>setRevision(v=>v+1)}>비교 자료 다시 조회</Button><Button type="button" variant="outline" disabled={!data||loading} onClick={exportCsv}>비교 집계 CSV</Button></div>
    <p className="text-xs text-muted-foreground">상단의 연도·분야·표준·파트너 조건을 사용합니다. 선택 월은 비교 연도 선택용입니다. 인증발행일·등급·신청유형·현재 인증상태 필터는 이 비교에 적용하지 않습니다. 현재 등급·상태로 과거 신규 고객을 다시 분류하지 않습니다.</p>
    {example&&<p role="status" className="rounded border p-3 text-sm">가상 자료입니다. 실제 고객이나 DB를 변경하지 않습니다. 기준일은 2026-11-20이며 선택한 분야·표준·파트너 조건을 적용합니다.</p>}
    {loading&&<p role="status" className="text-sm">신청 이력과 Job 연결을 서버에서 확인하고 있습니다.</p>}
    {!loading&&error&&<p role="alert" className="rounded border p-3 text-sm">{error} 조회 실패를 고객 0명으로 표시하지 않습니다.</p>}
    {data&&<>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="확정 신규 고객·증감률" value="이력 확인 전 산출 보류"/><Metric label={`${data.year-1}년 관측 첫접수 (비교기간 누계)`} value={`${sum("previous")}명`}/><Metric label={`${data.year}년 관측 첫접수 (비교기간 누계)`} value={`${sum("current")}명`}/><Metric label="과거 유지율·갱신율" value="상태·갱신 이력 검증 필요"/></div>
      <div className="rounded border p-3 text-sm"><h3 className="font-semibold">자료 준비 상태</h3><p className="mt-2">신청 {data.readiness.applicationCount}건 · Job {data.readiness.jobCount}건 조회·연결 확인 / 유효 접수 {data.readiness.eligibleApplications}건 / Job 없는 신청 {data.readiness.joblessApplications}건</p><p className="mt-1">취소 제외 {data.readiness.cancelledApplications}건 · 미래 접수 {data.readiness.futureApplications}건 / 관측 접수 범위 {data.readiness.observedFrom??"자료 없음"} ~ {data.readiness.observedThrough??"자료 없음"}</p><p className="mt-2 text-xs text-muted-foreground">전체 DB 조회 성공은 이관 이전의 모든 이력이 존재한다는 뜻이 아닙니다. 아래 값은 DB에서 처음 관측된 접수이며 실제 신규 고객 수를 확정하지 않습니다. 과거 전체 이력, 상태 복구·등급 이동, 갱신 대상 연결은 아직 검증되지 않았습니다.</p></div>
      <div className="flex flex-wrap gap-4 text-xs"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-slate-400"/>{data.year-1}년 관측 첫접수</span><span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-blue-500"/>{data.year}년 관측 첫접수</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.months.map(row=><div key={row.month} className="rounded border p-3"><div className="mb-2 flex justify-between gap-2 text-xs"><strong>{row.month}월</strong><span>{row.status==="NOT_ARRIVED"?"미도래":row.status==="PROVISIONAL"?"진행 중 · 동일 일자 비교":"마감 월"}</span></div>{row.current&&row.previous?<><Bar label={`${data.year-1}년`} value={row.previous.firstObservedCandidates} max={maximum} previous/><Bar label={`${data.year}년`} value={row.current.firstObservedCandidates} max={maximum}/><p className="mt-2 text-[11px] text-muted-foreground">비교 종료 {row.previousEnd} / {row.currentEnd}</p></>:<p className="py-3 text-xs text-muted-foreground">아직 비교 시점이 도래하지 않았습니다.</p>}</div>)}</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b">{["월","전년도 관측 첫접수(명)","올해 관측 첫접수(명)","올해 관측 첫 표준(건)","기존고객 표준추가(건)","확정 신규·증감률"].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.months.map(row=><tr key={row.month} className="border-b"><td className="p-2">{row.month}월</td><td className="p-2">{row.previous?.firstObservedCandidates??"미도래"}</td><td className="p-2">{row.current?.firstObservedCandidates??"미도래"}</td><td className="p-2">{row.current?.firstObservedStandardPairs??"미도래"}</td><td className="p-2">{row.current?.observedExistingStandardAdditions??"미도래"}</td><td className="p-2">{row.status==="NOT_ARRIVED"?"미도래":"산출 보류"}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">전체 고객은 후보자별로 한 번만 집계합니다. 표준 건수는 후보자·분야·표준 조합 기준입니다. 동일 날짜의 여러 표준 신청은 초기 동시 신청으로 보고 기존 고객 추가로 세지 않습니다. 취소 신청은 제외하며 보완·심사 중 접수도 포함합니다. 소규모 내부 집계이며 외부 AI용 익명 자료로 간주하지 않습니다.</p>
    </>}
  </section>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>;}
function Bar({label,value,max,previous=false}:{label:string;value:number;max:number;previous?:boolean}){return <div className="mt-2 flex items-center gap-2 text-xs"><span className="w-12 shrink-0">{label}</span><div className="h-3 flex-1 rounded bg-muted"><div className={`h-full rounded ${previous?"bg-slate-400":"bg-blue-500"}`} style={{width:`${value/max*100}%`}}/></div><span className="w-10 shrink-0 text-right">{value}명</span></div>;}
