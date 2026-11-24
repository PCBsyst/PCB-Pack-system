import { isRegistrationDate } from "@/lib/allocated-number-validation";

export const evidenceFields = { name:"이름", nameEn:"영문명", birthDate:"생년월일", nationality:"국적", phone:"전화번호", email:"이메일", address:"집주소", trainingProvider:"교육기관", trainingCompletedAt:"교육 수료일", school:"학교", qualification:"학위·학력" } as const;
export type EvidenceField = keyof typeof evidenceFields;
export type EvidenceDocument = {id:string;kind:string;fileName:string;sha256:string;reference:string;fields:Partial<Record<EvidenceField,string>>};
export type CareerEvidence = {id:string;documentId:string;organization:string;role:string;start:string;end:string;ongoing:boolean;reference:string;confirmed:boolean};
export type AuditEvidence = {id:string;documentId:string;client:string;standard:string;role:string;start:string;end:string;days:string;reference:string;confirmed:boolean};
export const evidenceRequirements=["교육요건","학력요건","업무경력요건","심사·실무경력요건"] as const;
export type RequirementEvidenceLink={requirement:typeof evidenceRequirements[number];documentIds:string[];reference:string;note:string;confirmed:boolean;result:string;english?:{reference:string;note:string;confirmed:boolean;result:string}};
export type EvidenceReviewState = {version:1;documents:EvidenceDocument[];careers:CareerEvidence[];audits:AuditEvidence[];links?:RequirementEvidenceLink[]};
export const emptyEvidenceReview = ():EvidenceReviewState=>({version:1,documents:[],careers:[],audits:[]});
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const str=(value:unknown,max=500):value is string=>typeof value==="string"&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const keys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
export function readEvidenceReview(value:unknown):EvidenceReviewState|null {
  if(value===undefined)return emptyEvidenceReview();
  if(!object(value)||value.version!==1||!keys(value,["version","documents","careers","audits","links"]))return null;
  const {documents,careers,audits}=value;
  if(!Array.isArray(documents)||!Array.isArray(careers)||!Array.isArray(audits)||documents.length>100||careers.length>500||audits.length>500)return null;
  for(const list of [documents,careers,audits])if(list.some(row=>!object(row)||!str(row.id,100)||!row.id)||new Set(list.map(row=>row.id)).size!==list.length)return null;
  if(documents.some(d=>!keys(d,["id","kind","fileName","sha256","reference","fields"])||!["kind","fileName","sha256","reference"].every(key=>str(d[key]))||!object(d.fields)||Object.entries(d.fields).some(([key,v])=>!Object.hasOwn(evidenceFields,key)||!str(v))||d.sha256!==""&&!/^[a-f0-9]{64}$/.test(d.sha256)))return null;
  if(careers.some(r=>!keys(r,["id","documentId","organization","role","start","end","reference","ongoing","confirmed"])||!["documentId","organization","role","start","end","reference"].every(key=>str(r[key]))||typeof r.ongoing!=="boolean"||typeof r.confirmed!=="boolean"))return null;
  if(audits.some(r=>!keys(r,["id","documentId","client","standard","role","start","end","days","reference","confirmed"])||!["documentId","client","standard","role","start","end","days","reference"].every(key=>str(r[key]))||typeof r.confirmed!=="boolean"))return null;
  if(value.links!==undefined){
    if(!Array.isArray(value.links)||value.links.length>4||new Set(value.links.map(r=>object(r)?r.requirement:null)).size!==value.links.length)return null;
    if(value.links.some(r=>!object(r)||!keys(r,["requirement","documentIds","reference","note","confirmed","result","english"])||!evidenceRequirements.includes(r.requirement as typeof evidenceRequirements[number])||!Array.isArray(r.documentIds)||r.documentIds.length>100||new Set(r.documentIds).size!==r.documentIds.length||r.documentIds.some(id=>!str(id,100)||!id)||!str(r.reference)||!str(r.note)||typeof r.confirmed!=="boolean"||!["","충족","미충족","해당없음"].includes(r.result as string)||r.english!==undefined&&(!object(r.english)||!keys(r.english,["reference","note","confirmed","result"])||!str(r.english.reference)||!str(r.english.note)||typeof r.english.confirmed!=="boolean"||!["","충족","미충족","해당없음"].includes(r.english.result as string))))return null;
  }
  return value as EvidenceReviewState;
}
/** Fixed labels stay local. Free-text counterparts require explicit staff review. */
export function evidenceEnglishIssues(link:RequirementEvidenceLink,result:string){
 const issues:string[]=[];
 if(link.reference.trim()&&!link.english?.reference.trim())issues.push("확인 위치 (영문)");
 if(link.note.trim()&&!link.english?.note.trim())issues.push("검토 메모 (영문)");
 if(!link.english?.confirmed||link.english.result!==result)issues.push("영문 근거 확인");
 return issues;
}
export function reviseEvidenceLink(row:RequirementEvidenceLink,patch:Partial<RequirementEvidenceLink>):RequirementEvidenceLink{
 const next={...row,...patch};
 if(row.english&&["documentIds","reference","note","result"].some(key=>Object.hasOwn(patch,key)))next.english={...row.english,confirmed:false};
 return next;
}
export function requirementEvidenceIssues(link:RequirementEvidenceLink,documents:EvidenceDocument[],expectedName:string,result:string,birthDate?:string){
 const issues:string[]=[];
 if(!["충족","미충족","해당없음"].includes(result))issues.push("검토 결과 미확인");
 if(link.note.trim().length<5)issues.push("검토 메모 5자 이상 필요");
 if(result!=="해당없음"&&!link.documentIds.length)issues.push("근거 문서 미연결");
 if(link.documentIds.length&&!link.reference.trim())issues.push("확인 위치 미입력");
 for(const id of link.documentIds){const d=documents.find(d=>d.id===id);if(!d){issues.push("연결 문서 없음");continue;}
  if(!d.fileName.trim())issues.push("문서명 미입력");
  if(!expectedName.trim()||!d.fields.name?.trim())issues.push("후보자 이름 대조 필요");
  else if(d.fields.name.normalize("NFKC").trim()!==expectedName.normalize("NFKC").trim())issues.push("후보자 이름 불일치");
  if(d.fields.birthDate&&(!isRegistrationDate(d.fields.birthDate)||birthDate&&d.fields.birthDate!==birthDate))issues.push("생년월일 오류·불일치");
 }
 if(link.confirmed&&link.result!==result)issues.push("검토 결과 변경: 다시 확인 필요");
 return [...new Set(issues)];
}
const norm=(value:string)=>value.normalize("NFKC").trim().replace(/\s+/g," ");
function comparable(field:EvidenceField,value:string) {
  const text=norm(value);
  if(field==="phone")return text.replace(/[\s()\-]/g,"");
  if(field==="email")return text.replace(/@(.+)$/,(_,domain:string)=>`@${domain.toLowerCase()}`);
  return text;
}
const dateDay=(date:string)=>isRegistrationDate(date)?Date.parse(date)/86400000:null;
type Interval={start:number;end:number};
function interval(start:string,end:string,asOf:string):Interval|null {
  const a=dateDay(start),b=dateDay(end),cutoff=dateDay(asOf);
  return a===null||b===null||cutoff===null||a>b||b>cutoff?null:{start:a,end:b};
}
export function unionEvidenceDays(rows:Interval[]) {
  const sorted=rows.map(row=>({...row})).sort((a,b)=>a.start-b.start||a.end-b.end);
  let total=0,current:Interval|undefined;
  for(const row of sorted){if(!current)current=row;else if(row.start<=current.end+1)current.end=Math.max(current.end,row.end);else{total+=current.end-current.start+1;current=row;}}
  return total+(current?current.end-current.start+1:0);
}
const overlaps=(a:Interval,b:Interval)=>a.start<=b.end&&b.start<=a.end;

export function analyzeEvidence(state:EvidenceReviewState,expected:Partial<Record<EvidenceField,string>>,asOf:string) {
  const comparisons=(Object.keys(evidenceFields) as EvidenceField[]).map(field=>{
    const values=state.documents.flatMap(document=>document.fields[field]?.trim()?[{documentId:document.id,fileName:document.fileName,value:document.fields[field]!,reference:document.reference}]:[]);
    const expectedValue=expected[field]?.trim()??"";
    const distinct=new Set([...values.map(item=>comparable(field,item.value)),...(expectedValue?[comparable(field,expectedValue)]:[])]);
    const invalid=(field==="birthDate"||field==="trainingCompletedAt")&&[...values.map(item=>item.value),...(expectedValue?[expectedValue]:[])].some(value=>dateDay(value)===null);
    const status=invalid?"INVALID":distinct.size>1?"MISMATCH":values.length+(expectedValue?1:0)>=2?"MATCH":"UNKNOWN";
    return {field,label:evidenceFields[field],expectedValue,values,status};
  });
  const foreign=new Set(state.documents.filter(document=>(["name","birthDate"] as const).some(field=>document.fields[field]?.trim()&&expected[field]?.trim()&&comparable(field,document.fields[field]!)!==comparable(field,expected[field]!))).map(d=>d.id));
  const sourceIssues=(documentId:string,reference:string)=>{
    const source=state.documents.find(document=>document.id===documentId);
    const issues:string[]=[];
    if(!source)issues.push("근거 문서 미연결");
    if(source&&!source.fileName.trim())issues.push("근거 문서명 미입력");
    if(source&&!source.fields.name?.trim())issues.push("근거 문서 후보자명 미입력");
    if(!expected.name?.trim())issues.push("등록된 후보자명 미확인");
    if(!reference.trim())issues.push("근거 위치 미입력");
    if(foreign.has(documentId))issues.push("후보자 식별정보 불일치");
    if(source?.fields.birthDate&&dateDay(source.fields.birthDate)===null)issues.push("근거 생년월일 형식 확인 필요");
    return issues;
  };
  const careers=state.careers.map(row=>{
    const issues=sourceIssues(row.documentId,row.reference),range=interval(row.start,row.ongoing?asOf:row.end,asOf);
    if(!row.organization.trim()||!row.role.trim())issues.push("기관·회사 또는 직무 미입력");
    if(!range)issues.push("기간 미입력·역전·기준일 이후 날짜 확인 필요");
    return {...row,issues,range,calendarDays:range?range.end-range.start+1:0};
  });
  const careerOverlaps=careers.flatMap((a,index)=>careers.slice(index+1).filter(b=>a.range&&b.range&&overlaps(a.range,b.range)).map(b=>({first:a.id,second:b.id})));
  const countable=careers.filter(row=>row.range&&!row.issues.length);
  const audits=state.audits.map(row=>{
    const issues=sourceIssues(row.documentId,row.reference),range=interval(row.start,row.end,asOf);
    const days=Number(row.days);
    if(!row.client.trim()||!row.standard.trim()||!row.role.trim())issues.push("심사 대상·표준 또는 역할 미입력");
    if(!range)issues.push("기간 미입력·역전·기준일 이후 날짜 확인 필요");
    if(!row.days.trim()||!Number.isFinite(days)||days<=0||range&&days>range.end-range.start+1)issues.push("심사일수는 기간 내 0 초과 일수로 입력");
    return {...row,issues,range,reportedDays:Number.isFinite(days)?days:0};
  });
  const groups=new Map<string,typeof audits>();
  for(const row of audits){if(row.issues.length)continue;const key=JSON.stringify([norm(row.client),norm(row.standard),row.start,row.end]);groups.set(key,[...(groups.get(key)??[]),row]);}
  const events=[...groups.values()].map(rows=>({rows,representative:rows[0],conflictingDays:new Set(rows.map(row=>row.reportedDays)).size>1}));
  const auditOverlaps=events.flatMap((a,index)=>events.slice(index+1).filter(b=>a.representative.range&&b.representative.range&&overlaps(a.representative.range,b.representative.range)).map(b=>({first:a.representative.id,second:b.representative.id})));
  const overlapping=new Set(auditOverlaps.flatMap(pair=>[pair.first,pair.second]));
  const confirmedEvents=events.filter(event=>!event.conflictingDays&&!overlapping.has(event.representative.id)&&event.rows.some(row=>row.confirmed));
  return {comparisons,foreignDocumentIds:[...foreign],careers,careerOverlaps,
    careerDays:unionEvidenceDays(countable.map(row=>row.range!)),
    confirmedCareerDays:unionEvidenceDays(countable.filter(row=>row.confirmed).map(row=>row.range!)),
    audits,duplicateAuditGroups:events.filter(event=>event.rows.length>1).map(event=>({ids:event.rows.map(row=>row.id),conflictingDays:event.conflictingDays})),auditOverlaps,
    overlappingAuditIds:events.filter(event=>overlapping.has(event.representative.id)).flatMap(event=>event.rows.map(row=>row.id)),
    auditUniqueCount:events.length,confirmedAuditCount:confirmedEvents.length,
    confirmedAuditDays:confirmedEvents.reduce((sum,event)=>sum+event.representative.reportedDays,0),
    byStandard:[...new Set(audits.map(row=>norm(row.standard)).filter(Boolean))].map(standard=>({standard,count:confirmedEvents.filter(e=>norm(e.representative.standard)===standard).length,days:confirmedEvents.filter(e=>norm(e.representative.standard)===standard).reduce((sum,e)=>sum+e.representative.reportedDays,0)}))};
}
