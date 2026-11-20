import type {BusinessArea} from "@/types/certification";
export type JobSourceValue={value:string;evidence:string;conflict:boolean};
function readLabel(text:string,labels:string[]):JobSourceValue {
 if(text.length>1_000_000)throw Error("신청서 본문이 너무 큽니다.");
 const found=new Map<string,string>();
 for(const line of text.replace(/\r\n?/g,"\n").split("\n")){
  const cells=line.split("\t").map(c=>c.trim()).filter(Boolean);
  for(let i=0;i<cells.length;i++)for(const label of labels){
   const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
   const match=cells[i].match(new RegExp(`^${escaped}\\s*[:：]\\s*(.+)$`,"i"));
   const value=(match?.[1]??(cells[i].toLowerCase()===label.toLowerCase()?cells[i+1]:""))?.trim();
   if(value&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value))found.set(value,`${cells[i]}${match?"":` → ${value}`}`.slice(0,400));
  }
 }
 return {value:found.size===1?[...found.keys()][0]:"",evidence:[...found.values()].join(" / ").slice(0,1200),conflict:found.size>1};
}
export function extractJobSource(text:string){return {standard:readLabel(text,["신청표준","신청 표준","인증표준","신청분야","신청 분야","Standard","Certification standard"]),grade:readLabel(text,["신청등급","신청 등급","등급","Grade","Certification grade"])};}
export const intakeGrades=(area:BusinessArea)=>area==="ISO"?["Provisional Auditor","Internal Auditor","Auditor","Lead Auditor","Verification Auditor"]:["Pre-master","Master","Global Master"];
const normalize=(s:string)=>s.trim().toUpperCase().replace(/\s+/g,"");
export function matchIntakeStandard(raw:string,standards:string[]){const matches=standards.filter(s=>normalize(s)===normalize(raw));return raw&&matches.length===1?matches[0]:"";}
export function matchIntakeGrade(raw:string,area:BusinessArea){
 const aliases:Record<string,string>={심사원보:"Provisional Auditor",내부심사원:"Internal Auditor",심사원:"Auditor",선임심사원:"Lead Auditor",검증심사원:"Verification Auditor"};
 const value=aliases[raw.trim()]??raw;return intakeGrades(area).find(g=>normalize(g)===normalize(value))??"";
}
export function validateIntakeJob(standard:string,grade:string,area:BusinessArea,verified:string[],existing:string[],approved:boolean){
 if(!approved)throw Error("표준과 등급을 원문과 대조해 확인해 주세요.");
 if(!verified.includes(standard)||!intakeGrades(area).includes(grade))throw Error("현재 분야·인정기구·인정구분에 등록된 표준과 등급을 선택해 주세요.");
 if(existing.includes(standard))throw Error("같은 표준의 Job이 이미 신청 목록에 있습니다.");
 return {standard,grade};
}
