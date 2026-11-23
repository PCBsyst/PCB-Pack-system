"use client";
import { useEffect, useRef, useState } from "react";
import type { PackageContext, DocumentLanguage } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";
import { fetchDecisionReportHtml, fetchApplicationReviewHtml, fetchDeliveryConfirmationHtml, fetchCombinedReviewHtml } from "@/lib/decision-report-download";
import { fetchHtmlPackage } from "@/lib/html-package-download";
import { Button } from "@/components/ui/button";

type Report = Awaited<ReturnType<typeof fetchDecisionReportHtml>> & {snapshot:string};
export function DecisionReportPreview({context,job,language,setNotice,documentKind="DECISION"}:{context:PackageContext;job:Job;language:DocumentLanguage;setNotice:(value:string)=>void;documentKind?:"DECISION"|"APPLICATION_REVIEW"|"DELIVERY_CONFIRMATION"|"BUNDLE"}) {
  const reportLabel=documentKind==="BUNDLE"?"3종 통합 검토":documentKind==="DELIVERY_CONFIRMATION"?"문서전달확인서":documentKind==="APPLICATION_REVIEW"?"신청서류 검토서":"인증결정보고서";
  const snapshot = JSON.stringify({context,job,language,documentKind}), current = useRef(snapshot); current.current = snapshot;
  const busy = useRef(false), mounted = useRef(true), controller = useRef<AbortController|null>(null), frame = useRef<HTMLIFrameElement>(null);
  const [pending,setPending] = useState(false), [report,setReport] = useState<Report|null>(null), [readyHash,setReadyHash] = useState("");
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  useEffect(()=>{setReport(null);setReadyHash("");if(busy.current)setNotice("입력이 변경되어 미리보기 생성을 중단했습니다. 현재 입력 저장 후 다시 생성해 주세요.");controller.current?.abort();},[snapshot,setNotice]);
  const generate = async () => {
    if (busy.current) return;
    busy.current=true;setPending(true);setReport(null);setReadyHash("");
    const requested=snapshot;controller.current=new AbortController();setNotice(`${reportLabel} HTML을 저장 기록과 대조해 생성하고 있습니다.`);
    try {
      const value=await (documentKind==="BUNDLE"?fetchCombinedReviewHtml:documentKind==="DELIVERY_CONFIRMATION"?fetchDeliveryConfirmationHtml:documentKind==="APPLICATION_REVIEW"?fetchApplicationReviewHtml:fetchDecisionReportHtml)(context,job,language,controller.current.signal);
      if(!mounted.current || current.current!==requested) return;
      setReport({...value,snapshot:requested});setNotice("HTML 디자인 검토본을 생성했습니다. 기존 정식 DOCX와 패키지 완료 기록은 변경하지 않았습니다.");
    } catch(error) { if(mounted.current && current.current===requested) setNotice(error instanceof Error && error.name!=="AbortError"?error.message:"문서 생성을 중단했습니다. 현재 입력을 저장한 후 다시 시도해 주세요."); }
    finally {busy.current=false;if(mounted.current)setPending(false);}
  };
  const downloadBundle=async()=>{
    if(busy.current)return;
    busy.current=true;setPending(true);const requested=snapshot;controller.current=new AbortController();
    try{
      const result=await fetchHtmlPackage(context,job,controller.current.signal);
      if(!mounted.current||current.current!==requested)return;
      const url=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=url;a.download=result.fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      setNotice('국문 HTML 3종 묶음 다운로드를 요청했습니다. 디자인 검토본이며 정식 패키지 완료로 기록하지 않습니다.');
    }catch(error){if(mounted.current&&current.current===requested)setNotice(error instanceof Error?error.message:'HTML 묶음 생성 실패');}
    finally{busy.current=false;if(mounted.current)setPending(false);}
  };
  const active = report?.snapshot===snapshot ? report : null;
  const saveHtml = () => {
    if(!active || current.current!==active.snapshot) return;
    const url=URL.createObjectURL(active.blob), anchor=document.createElement("a");anchor.href=url;anchor.download=active.fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    setNotice("HTML 사본 다운로드를 요청했습니다. 파일은 편집 가능하며 시스템 원본을 대체하지 않습니다.");
  };
  const printPdf = async () => {
    if(!active || readyHash!==active.hash) return;
    try {
      const target=frame.current?.contentWindow;if(!target)throw Error();
      await target.document.fonts.ready;
      if(!mounted.current || current.current!==active.snapshot) return;
      target.focus();target.print();setNotice("브라우저 인쇄창에서 A4·PDF로 저장을 선택하세요. 이 출력은 디자인 검토본이며 실제 저장 완료나 정식 패키지 완료를 기록하지 않습니다.");
    } catch {setNotice("인쇄창을 열지 못했습니다. 미리보기를 다시 생성하거나 내려받은 HTML을 브라우저에서 열어 인쇄해 주세요.");}
  };
  return <section className="rounded-lg border bg-card p-4 text-card-foreground"><div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm font-semibold">{job.jobNo} · {language==="KR"?"국문":"영문"} {reportLabel}</p><Button type="button" variant="outline" size="sm" disabled={pending} aria-busy={pending} onClick={()=>void generate()}>{pending?"생성·검증 중...":"HTML 미리보기 생성"}</Button>{documentKind==="DELIVERY_CONFIRMATION"&&language==="KR"&&<Button type="button" variant="outline" size="sm" disabled={pending} onClick={()=>void downloadBundle()}>국문 HTML 3종 ZIP</Button>}{active&&<><Button type="button" variant="outline" size="sm" onClick={saveHtml}>HTML 다운로드</Button><Button type="button" variant="outline" size="sm" disabled={readyHash!==active.hash} onClick={()=>void printPdf()}>인쇄·PDF로 저장</Button><Button type="button" variant="ghost" size="sm" onClick={()=>{setReport(null);setReadyHash("");}}>미리보기 닫기</Button></>}</div><p className="mt-2 text-xs text-muted-foreground">디자인 검토본 · 현재 입력을 먼저 저장하세요. PDF는 브라우저 인쇄 방식이며 정식 DOCX·패키지 완료에는 포함되지 않습니다. 입력이 바뀌면 미리보기를 폐기합니다.</p>{active&&<iframe ref={frame} key={active.hash} title={`${job.jobNo} ${language} ${reportLabel} 디자인 검토본`} sandbox="allow-same-origin allow-modals" referrerPolicy="no-referrer" srcDoc={active.html} onLoad={()=>setReadyHash(active.hash)} className="mt-4 h-[850px] w-full rounded-md border bg-white"/>}</section>;
}
