"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {aiPolicyInput,type AiPolicy,type AiPolicyView} from "@/lib/ai-marketing-policy";
import {requestAiPolicy} from "@/lib/ai-marketing-policy-request";
const initial:AiPolicy={enabled:false,retentionReviewed:false,privacyReviewed:false,reviewReference:"",revision:0};
export function AiMarketingPolicySettings() {
  const [view,setView]=useState<AiPolicyView|null>(null),[draft,setDraft]=useState<AiPolicy>(initial),[reason,setReason]=useState(""),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[notice,setNotice]=useState("");
  const mounted=useRef(true),serial=useRef(0),busy=useRef(false),controller=useRef<AbortController|null>(null),latest=useRef("");latest.current=JSON.stringify({draft,reason});
  const install=(value:AiPolicyView)=>{setView(value);setDraft(value.policy?{...value.policy,...(!value.configMatches?{enabled:false,retentionReviewed:false,privacyReviewed:false,reviewReference:""}:{})}:initial);setReason("");setUncertain(false);};
  async function load(force=false){
    if(busy.current&&!force)return;const turn=++serial.current;controller.current?.abort();controller.current=new AbortController();busy.current=true;setPending(true);setView(null);setNotice("AI 정책과 변경 이력을 확인하고 있습니다.");
    const timer=setTimeout(()=>controller.current?.abort(),30000);
    try{const value=await requestAiPolicy(controller.current.signal);if(mounted.current&&serial.current===turn){install(value);setNotice(value.mode==="PROTOTYPE"?"개발 가상 모드: 정책 저장은 비활성입니다. 실제 DB 적용 후 사용할 수 있습니다.":"정책을 조회했습니다. 실제 AI 전송은 별도 연결 전까지 비활성입니다.");}}
    catch(error){if(mounted.current&&serial.current===turn){setUncertain(true);setNotice(error instanceof Error?error.message:"정책 조회 실패. 변경하지 않습니다.");}}
    finally{clearTimeout(timer);if(serial.current===turn){busy.current=false;if(mounted.current)setPending(false);}}
  }
  useEffect(()=>{mounted.current=true;void load(true);return()=>{mounted.current=false;serial.current++;controller.current?.abort();};},[]);
  async function save(){
    if(busy.current||uncertain||!view?.policy||view.mode!=="APPLIED")return;
    let input;try{input=aiPolicyInput({enabled:draft.enabled,retentionReviewed:draft.retentionReviewed,privacyReviewed:draft.privacyReviewed,reviewReference:draft.reviewReference,reason,expectedRevision:view.policy.revision});}catch(error){setNotice(error instanceof Error?error.message:"입력을 확인해 주세요.");return;}
    const snapshot=latest.current,turn=++serial.current;busy.current=true;setPending(true);setNotice("정책 변경과 감사기록을 함께 저장하고 있습니다.");controller.current=new AbortController();const timer=setTimeout(()=>controller.current?.abort(),30000);
    try{const value=await requestAiPolicy(controller.current.signal,input);if(!mounted.current||serial.current!==turn)return;
      if(snapshot!==latest.current||!value.policy||value.policy.revision!==input.expectedRevision+1||value.policy.enabled!==input.enabled||value.policy.retentionReviewed!==input.retentionReviewed||value.policy.privacyReviewed!==input.privacyReviewed||value.policy.reviewReference!==input.reviewReference)throw Error("저장 중 입력 또는 응답이 바뀌었습니다. 입력을 유지하고 다시 조회해 주세요.");
      install(value);setNotice("AI 사용 정책과 감사기록을 저장했습니다. 정책 ON도 실제 AI 전송을 시작하지 않습니다.");
    }catch(error){if(mounted.current&&serial.current===turn){setUncertain(true);setNotice(`${error instanceof Error?error.message:"저장 결과 확인 실패"} 입력은 유지됩니다. 재저장 전에 현재 정책을 다시 조회하세요.`);}}
    finally{clearTimeout(timer);if(serial.current===turn){busy.current=false;if(mounted.current)setPending(false);}}
  }
  const editable=view?.mode==="APPLIED"&&Boolean(view.policy)&&!pending&&!uncertain;
  const changed=view?.policy&&JSON.stringify(draft)!==JSON.stringify(view.policy);
  const canSave=editable&&changed&&reason.trim().length>=5&&(!(draft.retentionReviewed||draft.privacyReviewed)||draft.reviewReference.trim().length>=10)&&(!draft.enabled||(draft.retentionReviewed&&draft.privacyReviewed&&draft.reviewReference.trim().length>=10&&view?.keyPresent&&view?.modelPresent));
  return <section className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground" aria-label="AI 마케팅 사용 정책"><div className="flex flex-wrap items-center gap-3"><h3 className="mr-auto font-semibold">AI 마케팅 사용 정책 · 최고관리자 전용</h3><Button type="button" variant="outline" disabled={pending} onClick={()=>void load()}>현재 정책 다시 조회</Button></div>
    <p className="text-sm">초기 정책은 OFF입니다. ON은 검토한 설정의 사용을 허용하는 정책이며 실제 AI 전송 기능과는 별개입니다. 현재 실제 전송은 항상 비활성입니다.</p>
    <p className="text-xs text-muted-foreground">DB 준비가 안 됐거나 권한·정책·감사 응답을 확인하지 못하면 변경을 허용하지 않습니다. SQL은 별도 적용 단계로 준비되어 있습니다.</p>
    {view&&<div className="rounded border p-3 text-sm"><p>저장 정책: {view.policy?(view.policy.enabled?"ON":"OFF"):"DB 적용 전"} / 실제 AI 전송: OFF</p><p className="mt-1 text-xs">서버 키: {view.keyPresent?"설정값 있음 (유효성 미검증)":"없음"} · 모델: {view.modelPresent?"설정값 있음 (사용 가능 여부 미검증)":"없음"} · 검토한 설정과 일치: {view.configMatches?"예":"아니오 / 초기 상태"}</p>{view.policy&&!view.configMatches&&<p className="mt-2 text-xs">키·모델·조직·프로젝트 설정이 바뀌었거나 아직 검토되지 않았습니다. 입력란의 ON·검토 확인을 해제했으며 새 근거로 다시 확인해야 합니다. 저장 전까지 기존 DB 정책은 바뀌지 않습니다.</p>}</div>}
    <fieldset disabled={!editable} className="space-y-3 disabled:opacity-60"><label className="flex items-center gap-2 text-sm"><input aria-label="AI 사용 허용 정책" type="checkbox" checked={draft.enabled} onChange={e=>setDraft(d=>({...d,enabled:e.target.checked}))}/> AI 사용 허용 정책 ON (실제 전송은 별도)</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={draft.retentionReviewed} onChange={e=>setDraft(d=>({...d,retentionReviewed:e.target.checked}))}/>해당 계정·모델의 학습 미사용·보관·파일 및 캐시 조건을 검토했습니다.</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={draft.privacyReviewed} onChange={e=>setDraft(d=>({...d,privacyReviewed:e.target.checked}))}/>집계 최소화·작은 집단·중첩 집단·반복 조회·고지 및 처리 근거를 검토했습니다.</label><label className="block text-sm">검토 근거 (ON은 10자 이상)<input aria-label="AI 검토 근거" maxLength={500} value={draft.reviewReference} onChange={e=>setDraft(d=>({...d,reviewReference:e.target.value}))} className="mt-1 w-full rounded border bg-background p-2" placeholder="검토 문서와 적용한 계정·모델의 근거 위치. 고객 개인정보는 입력하지 마세요."/></label><label className="block text-sm">변경 사유 (5자 이상 필수)<textarea aria-label="AI 정책 변경 사유" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 min-h-20 w-full rounded border bg-background p-2"/></label><Button type="button" disabled={!canSave} onClick={()=>void save()}>AI 정책·감사기록 저장</Button></fieldset>
    {notice&&<p role="status" className="text-sm">{notice}</p>}
    <p className="text-xs text-muted-foreground">보관·개인정보 검토는 최고관리자의 확인 기록이며 시스템이 법적 적합성이나 익명성을 자동 인증한 결과가 아닙니다. OFF는 새로운 전송 준비를 차단하는 기준이며 이미 진행 중인 외부 요청의 회수를 보장하지 않습니다. API 키는 이 화면에 입력하거나 표시하지 않습니다.</p>
    <div><h4 className="text-sm font-semibold">정책·전송 감사기록 (최근 20건)</h4>{!view?.events.length?<p className="mt-2 text-xs text-muted-foreground">확인된 감사기록이 없습니다. 실제 전송 기능은 아직 연결하지 않았습니다.</p>:<div className="mt-2 space-y-2">{view.events.map(e=><div key={e.id} className="rounded border p-3 text-xs"><p>{new Date(e.occurredAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} · 버전 {e.revision} · {{POLICY_UPDATED:"정책 변경",TRANSFER_PREPARED:"전송 준비 기록 (전달 완료 아님)",TRANSFER_RESPONSE:"외부 응답 기록 (보관·전달 보장 아님)",TRANSFER_FAILED:"전송 실패 기록"}[e.kind]}</p><p className="mt-1">담당 계정: {e.actorId}</p>{e.kind==="POLICY_UPDATED"&&<p className="mt-1">{e.enabledBefore?"ON":"OFF"} → {e.enabledAfter?"ON":"OFF"} / 보관 검토 {e.retentionReviewed?"확인":"미확인"} / 보호 검토 {e.privacyReviewed?"확인":"미확인"} / 설정 변경 {e.configChanged?"있음":"없음"}</p>}<p className="mt-1">사유: {e.reason||"해당 없음"}</p>{e.reviewReference&&<p className="mt-1">검토 근거: {e.reviewReference}</p>}</div>)}</div>}</div>
  </section>;
}
