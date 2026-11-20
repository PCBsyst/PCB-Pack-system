"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {readApplicationDocx} from "@/lib/application-docx-text";
import {extractApplicationSuggestions,intakeFields,type IntakeSuggestion} from "@/lib/application-intake";
import {approvedIntakePatch,type IntakeApproval} from "@/lib/application-intake-apply";
import type {RegistrationCandidate} from "@/lib/registration-candidate-validation";
import {ApplicationIntakeJobPanel,type IntakeJobContext} from "@/components/application-intake-job-panel";
export function ApplicationIntakePanel({current,receivedAt,disabled,onApply,jobContext,onJobAdd}:{current:RegistrationCandidate;receivedAt:string;disabled:boolean;onApply:(baseline:RegistrationCandidate,rows:IntakeApproval[])=>void;jobContext?:IntakeJobContext;onJobAdd?:(key:string,standard:string,grade:string)=>void}){
 const [sourceContext,setSourceContext]=useState<IntakeJobContext|undefined>();
 const [source,setSource]=useState(""),[rows,setRows]=useState<Array<IntakeSuggestion&IntakeApproval>>([]),[baseline,setBaseline]=useState(current),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const turn=useRef(0),reading=useRef(false),live=useRef(true),blocked=useRef(disabled);blocked.current=disabled;
 useEffect(()=>{live.current=true;return()=>{live.current=false;turn.current++;};},[]);
 // No persistence or network: the original and source text exist only in this mounted panel.
 const clear=()=>{turn.current++;reading.current=false;setBusy(false);setSource("");setRows([]);setMessage("");};
 async function read(file:File){
  if(reading.current||blocked.current)return;reading.current=true;const id=++turn.current;setBusy(true);setRows([]);setSource("");setSourceContext(jobContext);setMessage("Word 본문을 기기에서 읽고 있습니다.");const snapshot={...current};
  try{const text=await readApplicationDocx(file);if(!live.current||turn.current!==id||blocked.current)return;const suggestions=extractApplicationSuggestions(text);setBaseline(snapshot);setRows(suggestions.map(r=>({...r,approved:false,overwrite:false})));setSource(text);setMessage(suggestions.length?"원문과 값을 대조한 뒤 항목별로 확인해 주세요. 아직 신청정보에 반영하거나 저장하지 않았습니다.":"명시된 기본정보 항목을 찾지 못했습니다. 신청정보를 직접 입력해 주세요.");}
  catch(error){if(live.current&&turn.current===id)setMessage(error instanceof Error?error.message:"문서를 읽지 못했습니다.");}
  finally{if(live.current&&turn.current===id){reading.current=false;setBusy(false);}}
 }
 function apply(){try{approvedIntakePatch(current,baseline,rows,receivedAt);onApply(baseline,rows);setSource("");setRows([]);setMessage("확인한 항목을 신청 입력란에 반영했습니다. DB 저장은 아래 신청 등록 버튼으로 별도 진행하세요.");}catch(error){setMessage(error instanceof Error?error.message:"반영하지 못했습니다.");}}
 return <section aria-label="신청서 읽기와 입력 확인" className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground"><h2 className="font-semibold">신청서 읽기 → 원문 대조 → 선택 반영</h2>
 <p className="text-sm text-muted-foreground">DOCX의 명시된 기본정보와 신청표준·등급을 기기에서 읽고 직원 확인 후 반영합니다. AI/OCR·외부 전송·원본 업로드는 수행하지 않습니다. PDF·이미지·스캔은 아직 지원하지 않습니다.</p>
 <p className="text-xs text-muted-foreground">본문과 미승인 값은 이 화면에서만 보관합니다. 반영 후에도 자동 등록하지 않습니다. 개발 가상 모드에서는 실제 개인정보를 사용하지 마세요.</p>
 <label className="block text-sm">신청서 Word 파일<input aria-label="신청서 Word 파일" type="file" accept=".docx" disabled={disabled||busy} className="mt-2 block w-full" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void read(file);}}/></label>
 <Button type="button" variant="outline" onClick={()=>{clear();setMessage("읽은 본문과 미반영 값을 폐기했습니다. 이미 반영한 신청 입력값은 유지됩니다.");}}>읽은 자료 폐기</Button>
 {message&&<p role="status" className="text-sm">{message}</p>}
 {source&&onJobAdd&&<p className="text-xs text-muted-foreground">필요한 Job을 먼저 확인해 추가한 뒤 기본정보를 반영하세요. 기본정보 반영 또는 자료 폐기 시 읽은 본문을 폐기합니다.</p>}
 {source&&jobContext&&sourceContext&&onJobAdd&&<ApplicationIntakeJobPanel source={source} context={jobContext} sourceContext={sourceContext} disabled={disabled} onAdd={onJobAdd}/>}
 {source&&<div className="grid gap-4 lg:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">읽은 Word 본문 (머릿글·이미지 제외)</h3><pre aria-label="읽은 신청서 본문" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border p-3 text-xs">{source}</pre></div><div className="space-y-3">{rows.map(row=><div key={row.field} className="space-y-2 rounded border p-3 text-sm"><p>{intakeFields[row.field]}{row.conflict?" · 복수 값 발견: 직접 정정 필요":""}</p><p className="break-words text-xs text-muted-foreground">근거: {row.evidence}</p><p className="break-words text-xs">현재 값: {current[row.field]||"미입력"}</p><input aria-label={`추출 ${intakeFields[row.field]}`} value={row.value} maxLength={500} disabled={disabled} className="w-full rounded border bg-background p-2" onChange={e=>setRows(rs=>rs.map(r=>r.field===row.field?{...r,value:e.target.value,approved:false,overwrite:false}:r))}/><label className="flex gap-2"><input type="checkbox" aria-label={`${intakeFields[row.field]} 원문 확인`} disabled={disabled||!row.value.trim()} checked={row.approved} onChange={e=>setRows(rs=>rs.map(r=>r.field===row.field?{...r,approved:e.target.checked}:r))}/>원문을 대조했고 이 값을 반영합니다.</label>{current[row.field].trim()&&current[row.field].trim()!==row.value.trim()&&<label className="flex gap-2"><input type="checkbox" aria-label={`${intakeFields[row.field]} 기존 값 변경 확인`} disabled={disabled} checked={row.overwrite} onChange={e=>setRows(rs=>rs.map(r=>r.field===row.field?{...r,overwrite:e.target.checked}:r))}/>기존 입력값 변경을 확인했습니다.</label>}</div>)}<Button type="button" disabled={disabled||busy||!rows.some(r=>r.approved)} onClick={apply}>확인한 항목만 신청 입력에 반영</Button></div></div>}
 </section>;
}
