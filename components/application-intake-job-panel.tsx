"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import type {BusinessArea} from "@/types/certification";
import {extractJobSource,intakeGrades,matchIntakeGrade,matchIntakeStandard} from "@/lib/application-intake-job";
export type IntakeJobContext={key:string;label:string;area:BusinessArea;standards:string[]};
export function ApplicationIntakeJobPanel({source,context,sourceContext,disabled,onAdd}:{source:string;context:IntakeJobContext;sourceContext:IntakeJobContext;disabled:boolean;onAdd:(key:string,standard:string,grade:string)=>void}){
 const [initial]=useState(()=>({context:sourceContext,values:extractJobSource(source)}));
 const [standard,setStandard]=useState(()=>matchIntakeStandard(initial.values.standard.value,initial.context.standards)),[grade,setGrade]=useState(()=>matchIntakeGrade(initial.values.grade.value,initial.context.area)),[approved,setApproved]=useState(false),[notice,setNotice]=useState("");
 const stale=initial.context.key!==context.key,blocked=disabled||stale;
 function add(){try{if(blocked||!approved)throw Error("현재 설정과 원문 확인 상태를 확인해 주세요.");onAdd(initial.context.key,standard,grade);setApproved(false);setNotice("확인한 표준·등급을 신청 Job 목록에 추가했습니다. 아직 등록 저장은 하지 않았습니다.");}catch(e){setNotice(e instanceof Error?e.message:"Job을 추가하지 못했습니다.");}}
 return <section aria-label="신청표준과 등급 확인" className="space-y-3 rounded border p-3"><h3 className="font-semibold">신청표준·등급 → Job 추가</h3><p className="text-xs text-muted-foreground">대조 기준: {initial.context.label}. 분야·인정기구·인정구분은 문서에서 자동 변경하지 않습니다. 복수 표준은 Job별로 확인해 추가하세요.</p>
 {stale&&<p role="alert">인증분야 설정이 변경됐습니다. 신청서를 다시 읽어 대조해 주세요.</p>}
 {(["standard","grade"] as const).map(field=><p key={field} className="break-words text-xs">{field==="standard"?"표준":"등급"} 원문: {initial.values[field].evidence||"명시된 항목 없음"}{initial.values[field].conflict?" · 복수 값 발견: 자동 선택 안 함":""}</p>)}
 <p className="text-xs text-muted-foreground">일치하지 않는 값은 추정하지 않습니다. 원문을 확인해 목록에서 직접 선택하세요.</p>
 <label className="block text-sm">신청표준 확인<select aria-label="읽은 신청표준 확인" value={standard} disabled={blocked} className="mt-1 w-full rounded border bg-background p-2" onChange={e=>{setStandard(e.target.value);setApproved(false);setNotice("");}}><option value="">표준 선택 필요</option>{initial.context.standards.map(s=><option key={s}>{s}</option>)}</select></label>
 <label className="block text-sm">신청등급 확인<select aria-label="읽은 신청등급 확인" value={grade} disabled={blocked} className="mt-1 w-full rounded border bg-background p-2" onChange={e=>{setGrade(e.target.value);setApproved(false);setNotice("");}}><option value="">등급 선택 필요</option>{intakeGrades(initial.context.area).map(g=><option key={g}>{g}</option>)}</select></label>
 <label className="flex gap-2 text-sm"><input type="checkbox" aria-label="표준과 등급 원문 확인" checked={approved} disabled={blocked||!standard||!grade} onChange={e=>setApproved(e.target.checked)}/>표준과 등급을 원문과 대조했습니다.</label><Button type="button" disabled={blocked||!approved||!standard||!grade} onClick={add}>확인한 표준·등급 Job 추가</Button>{notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>;
}
