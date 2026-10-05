"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {createClient} from "@/lib/supabase/client";
import {hasEnvVars} from "@/lib/utils";
import {isOperationMode,operationOptions,type OperationOption} from "@/lib/operation-mode";
import {useOperationMode} from "@/components/use-operation-mode";
export function OperationModeSettings(){
 const result=useOperationMode();const policy=result.mode==="ready"?result.policy:null;
 const [owner,setOwner]=useState(false),[busy,setBusy]=useState(false),[reason,setReason]=useState(""),[endsOn,setEndsOn]=useState(""),[paused,setPaused]=useState<OperationOption[]>(["NOTIFICATIONS","AUTOMATIC_DATES"]),[notice,setNotice]=useState("");
 useEffect(()=>{if(policy?.active){setPaused(policy.paused);setEndsOn(policy.endsOn??"");}},[policy?.updatedAt]);
 useEffect(()=>{let active=true;if(hasEnvVars)void(async()=>{try{const client=createClient();const {data:{user}}=await client.auth.getUser();if(!user)return;const {data}=await client.from("profiles").select("active,is_owner").eq("id",user.id).single();if(active)setOwner(data?.active===true&&data?.is_owner===true);}catch{if(active)setOwner(false);}})();return()=>{active=false;};},[]);
 async function save(active:boolean){
  if(!owner||!policy||busy||!reason.trim()||active&&!endsOn)return;
  if(!window.confirm(active?"선택한 기능을 일시 중지할까요? 기존 기록은 유지됩니다.":"정상 운영으로 복구할까요? 중지 기간의 문서·이메일은 일괄 실행하지 않습니다."))return;
  setBusy(true);setNotice("");
  try{const {data,error}=await createClient().rpc("update_operation_mode",{mode_active:active,paused_features:active?paused:[],ends_on:active?endsOn:null,reason:reason.trim(),expected_updated_at:policy.updatedAt});if(error||!isOperationMode(data)||data.active!==active)throw Error("결과 확인 실패");setReason("");window.dispatchEvent(new Event("operation-mode-changed"));setNotice(active?"이관·테스트 모드를 저장했습니다. 다른 열린 화면은 최대 30초 후 또는 다시 포커스할 때 반영됩니다.":"정상 운영으로 복구했습니다. 기존 기능별 OFF 설정은 그대로 유지하며 일괄 발송·재계산하지 않습니다.");}catch{setNotice("저장하지 못했습니다. 최고관리자 권한·DB 적용·종료일·동시 변경 여부를 확인해 주세요.");}finally{setBusy(false);}
 }
 return <section className="rounded-xl border bg-card p-6 text-card-foreground"><h3 className="font-semibold">이관·테스트 운영 모드 · 최고관리자 전용</h3><p className="mt-2 text-sm text-muted-foreground">로그인·계정 승인·권한·감사·저장 무결성·백업은 끄지 않습니다. 실제 개인정보 이관 시 MFA는 ON을 권장하며, 아래 MFA 설정에서 별도로 관리합니다.</p><p className="mt-3 text-sm font-semibold">현재: {policy?policy.active?`이관·테스트 중 · 종료 예정 ${policy.endsOn}`:"정상 운영":"설정 확인 대기"}</p>{policy?.active&&<p className="mt-2 text-xs text-muted-foreground">중지 항목: {policy.paused.map(id=>operationOptions.find(item=>item.id===id)?.label).join(" · ")||"없음"}. 종료 예정일은 자동 해제가 아닌 복구 점검 기준입니다.</p>}
 <div className="mt-4 space-y-3">{operationOptions.map(option=><label key={option.id} className="flex gap-3 text-sm"><input type="checkbox" checked={paused.includes(option.id)} disabled={!owner||!policy||busy} onChange={event=>setPaused(current=>event.target.checked?[...current,option.id]:current.filter(id=>id!==option.id))}/><span><span className="font-medium">OFF: {option.label}</span><span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span></span></label>)}</div>
 <label className="mt-4 block text-sm">종료 예정일(한국 날짜) · 활성화 시 필수<input type="date" className="mt-2 block rounded-md border bg-background p-2" disabled={!owner||!policy||busy} value={endsOn} onChange={event=>setEndsOn(event.target.value)}/></label><label className="mt-4 block text-sm">변경 사유(필수)<textarea className="mt-2 min-h-20 w-full rounded-md border bg-background p-3" disabled={!owner||!policy||busy} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label><div className="mt-4 flex flex-wrap gap-2"><Button disabled={!owner||!policy||busy||!reason.trim()||!endsOn} onClick={()=>void save(true)}>모드 적용·변경</Button><Button variant="outline" disabled={!owner||!policy?.active||busy||!reason.trim()} onClick={()=>void save(false)}>정상 운영 복구</Button></div>
 {result.mode!=="ready"&&<p className="mt-3 text-sm" role="status">{result.mode==="legacy"?"DB 설정 적용 대기(027). 기존 동작을 유지합니다.":"운영 설정을 확인하지 못했습니다. 변경은 비활성화됩니다."}</p>}{notice&&<p className="mt-3 text-sm" role="status">{notice}</p>}<p className="mt-3 text-xs text-muted-foreground">문서 자동 생성·고객 이메일 자동 발송은 아직 구현되지 않아 현재 중지 대상이 아닙니다. 복구는 이 모드의 제한만 해제하며 기존 부가 기능 설정은 바꾸지 않습니다.</p></section>;
}
