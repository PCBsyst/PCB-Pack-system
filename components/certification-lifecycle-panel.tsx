"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {hasEnvVars} from "@/lib/utils";
import type {AcquisitionFilters} from "@/lib/customer-acquisition";
import type {CertificationLifecycleReport} from "@/lib/certification-lifecycle";
import {certificationLifecycleSample} from "@/lib/certification-lifecycle-sample";
import {fetchCertificationLifecycle} from "@/lib/certification-lifecycle-request";
import {serializeReportCsv} from "@/lib/report-export";
const issueLabels={jobLinkErrors:"이전 Job 연결 오류",jobLoopNodes:"Job 순환 연결 노드",cycleLinkErrors:"회차·Job 연결 오류",certificateCycleErrors:"인증·회차 연결 오류",replacementLinkErrors:"이전 인증 연결 오류",replacementHistoryMismatch:"이전 인증의 대체 상태 불일치",replacementLoopNodes:"인증 순환 연결 노드",multipleSuccessors:"여러 후행 인증이 연결된 원본",multipleCurrentRecords:"현재 인증이 여러 개인 Job",unlinkedRenewalCertificates:"이전 인증 연결 미확인 갱신 발행",unlinkedGradeChangeCertificates:"이전 인증 연결 미확인 등급변경",actionLinkErrors:"상태변경·인증 연결 오류"} as const;
export function CertificationLifecyclePanel({year,filters,example,parentRevision}:{year:number;filters:AcquisitionFilters;example:boolean;parentRevision:number}) {
  const [report,setReport]=useState<{key:string;data:CertificationLifecycleReport}|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
  const key=JSON.stringify({year,filters,example,parentRevision,revision}),latest=useRef(key);latest.current=key;
  useEffect(()=>{
    let active=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);setReport(null);setError("");setLoading(true);
    void (async()=>{try{let data:CertificationLifecycleReport;
      if(example)data=certificationLifecycleSample(year,filters);else {if(!hasEnvVars)throw Error("공유 DB 미연결: 상단 가상 비교 예제로 인증 이력 점검도 확인할 수 있습니다.");data=await fetchCertificationLifecycle(year,filters,controller.signal);}
      if(active&&latest.current===key)setReport({key,data});
    }catch(cause){if(active&&latest.current===key)setError(cause instanceof Error&&cause.name!=="AbortError"?cause.message:"이력 조회 시간이 초과됐습니다. 다시 조회해 주세요.");}finally{clearTimeout(timer);if(active&&latest.current===key)setLoading(false);}})();
    return()=>{active=false;controller.abort();clearTimeout(timer);};
  },[key,year,example]);
  const data=report?.key===key?report.data:null;
  const exportCsv=()=>{
    if(!data||latest.current!==key)return;
    const rows=[["보고서","유지·갱신 이력 준비 상태"],["자료",example?"가상 예제":"서버 인증 이력 재조회"],["기준일",data.asOf],["유지율·갱신율","전체 이력·갱신 기준 미확인으로 산출 보류"],["분야",filters.area],["표준",filters.standard],["파트너",filters.partner],[],["전체 조회 범위 연결 진단","건수"],...Object.entries(issueLabels).map(([key,label])=>[label,data.issues[key as keyof typeof issueLabels]]),[],
      ["월","상태","전년도 기록된 유효기간 종료(건)","올해 기록된 유효기간 종료(건)","전년도 갱신 발행기록(건)","올해 갱신 발행기록(건)","올해 이전인증 연결 확인(건)","올해 등급변경 발행(건)","올해 정지 적용(건)","올해 철회 적용(건)","유지율·갱신율"],
      ...data.months.map(row=>[row.month,row.status==="NOT_ARRIVED"?"미도래":row.status==="PROVISIONAL"?"진행 중 · 동일 일자":"마감 월",row.previous?.recordedExpiries??"미도래",row.current?.recordedExpiries??"미도래",row.previous?.renewalIssued??"미도래",row.current?.renewalIssued??"미도래",row.current?.linkedRenewalIssued??"미도래",row.current?.gradeChangeIssued??"미도래",row.current?.suspensions??"미도래",row.current?.withdrawals??"미도래","산출 보류"])];
    const url=URL.createObjectURL(new Blob(["\ufeff",serializeReportCsv(rows)],{type:"text/csv;charset=utf-8"})),anchor=document.createElement("a");anchor.href=url;anchor.download=`인증이력점검_${year}${example?"_가상예제":""}.csv`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  return <section className="space-y-4 rounded-lg border p-4" aria-label="유지·갱신 이력 준비 상태"><div className="flex flex-wrap items-center gap-3"><h3 className="mr-auto font-semibold">유지·갱신 이력 준비 상태</h3><Button type="button" variant="outline" disabled={loading} onClick={()=>setRevision(v=>v+1)}>인증 이력 다시 조회</Button><Button type="button" variant="outline" disabled={!data||loading} onClick={exportCsv}>인증 이력 점검 CSV</Button></div>
    <p className="text-xs text-muted-foreground">신청·Job·처리 회차·인증서·정지/철회 기록을 별도로 점검합니다. 조회 조건과 가상 예제 선택은 위 신규 고객 비교와 같습니다. 원본과 인증상태는 변경하지 않습니다.</p>
    {example&&<p className="rounded border p-3 text-xs">인증 연결 검증용 별도 가상 시나리오입니다. 상단 고객 유입 예제와 모수는 다르며 실제 고객 자료가 아닙니다.</p>}
    {loading&&<p role="status" className="text-sm">인증과 갱신 연결을 확인하고 있습니다.</p>}{!loading&&error&&<p role="alert" className="rounded border p-3 text-sm">{error} 조회 실패는 0건이나 연결 정상으로 표시하지 않습니다.</p>}
    {data&&<><div className="rounded border p-3 text-sm"><p>전체 조회: 신청 {data.counts.applications}건 / Job {data.counts.jobs}건 / 회차 {data.counts.cycles}건 / 인증 기록 {data.counts.certificates}건 / 상태변경 {data.counts.actions}건</p><p className="mt-2">미래 인증발행 {data.counts.futureIssues}건·미래 상태변경 {data.counts.futureActions}건은 적용일 전 실적에서 제외합니다.</p><p className="mt-2">선택 범위의 현재 ACTIVE이면서 유효기간이 지난 기록: {data.counts.activePastValidity}건. 공식 인증상태를 자동 정지·철회하지 않습니다.</p></div>
      <div className="grid gap-3 lg:grid-cols-2"><div className="rounded border p-3"><h4 className="text-sm font-semibold">전체 조회 범위의 연결 진단</h4><dl className="mt-3 space-y-2 text-xs">{Object.entries(issueLabels).map(([key,label])=><div key={key} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold">{data.issues[key as keyof typeof issueLabels]}건</dd></div>)}</dl><p className="mt-3 text-xs text-muted-foreground">문제 유형은 중복될 수 있어 합산해 오류 기록 수로 해석하지 않습니다. 관련 오류 기록은 확인된 연결 집계에서 제외합니다. 문제 0건도 과거 이력 완전성을 보장하지 않습니다.</p></div>
      <div className="rounded border p-3"><h4 className="text-sm font-semibold">비율 계산 전에 추가 확인할 항목</h4><ul className="mt-3 list-disc space-y-3 pl-4 text-xs"><li>시작 인증상태와 정지 후 복구를 포함한 전체 전환 이력: 미검증. 현재 정지·철회 기록만으로 과거 월말 유지율을 복원하지 않습니다.</li><li>인증 당시 등급 스냅샷: 미검증. 현재 등급을 과거 등급으로 사용하지 않습니다.</li><li>갱신 대상 제외·대체 기준, 완료 인정 기간·유예 규칙: 미확정. 기록된 만료 건수를 곧바로 갱신 대상 분모로 사용하지 않습니다.</li></ul><p className="mt-4 text-sm font-semibold">고객 유지율·갱신율: 산출 보류</p></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-xs"><thead><tr className="border-b">{["월","전년 기간종료 기록","올해 기간종료 기록","전년 갱신 발행","올해 갱신 발행","이전인증 연결 확인","올해 등급변경 발행","정지 적용","철회 적용"].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.months.map(row=><tr key={row.month} className="border-b"><td className="p-2">{row.month}월{row.status==="PROVISIONAL"?" (진행 중)":""}</td>{[row.previous?.recordedExpiries,row.current?.recordedExpiries,row.previous?.renewalIssued,row.current?.renewalIssued,row.current?.linkedRenewalIssued,row.current?.gradeChangeIssued,row.current?.suspensions,row.current?.withdrawals].map((value,index)=><td key={index} className="p-2">{value??"미도래"}</td>)}</tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">건수는 고객 수가 아닌 연결된 기록 수입니다. 기간종료 기록에는 대체된 과거 인증도 포함됩니다. 갱신 발행은 발행일, 기간종료는 기록된 종료일, 정지·철회는 적용일 기준입니다. 이전인증 연결 확인은 같은 후보자·표준과 발행 순서·회차 연결 점검이며 갱신 기한 충족 판정이 아닙니다.</p>
    </>}
  </section>;
}
