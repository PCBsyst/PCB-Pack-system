import type {AcquisitionApplication,AcquisitionJob,AcquisitionFilters,acquisitionWindows} from "@/lib/customer-acquisition";
type Windows=ReturnType<typeof acquisitionWindows>;
export const marketingSignalsVersion="MKT-01";
export function receiptChange(current:number,previous:number) {return previous===0?null:(current-previous)/previous*100;}
export function buildMarketingSignals(applications:AcquisitionApplication[],jobs:AcquisitionJob[],windows:Windows,filters:AcquisitionFilters) {
  const elapsed=windows.filter(window=>window.status!=="NOT_ARRIVED"),last=elapsed.at(-1)!;
  const period={previousStart:windows[0].previousStart,previousEnd:last.previousEnd,currentStart:windows[0].currentStart,currentEnd:last.currentEnd};
  const appById=new Map(applications.filter(app=>app.status!=="CANCELLED").map(app=>[app.id,app]));
  const groups=new Map<string,{area:string;standard:string;entries:Array<{job:AcquisitionJob;app:AcquisitionApplication}>}>();
  for(const job of jobs){const app=appById.get(job.applicationId);if(!app||(filters.area!=="전체"&&app.area!==filters.area)||(filters.partner!=="전체"&&app.partner!==filters.partner)||(filters.standard!=="전체"&&job.standard!==filters.standard))continue;
    if(!((app.receivedAt>=period.previousStart&&app.receivedAt<=period.previousEnd)||(app.receivedAt>=period.currentStart&&app.receivedAt<=period.currentEnd)))continue;
    const key=JSON.stringify([app.area,job.standard]),group=groups.get(key)??{area:app.area,standard:job.standard,entries:[]};group.entries.push({job,app});groups.set(key,group);}
  if(groups.size>100)throw Error("표준 그룹이 많습니다. 분야·표준 조건을 줄여 주세요.");
  const grades=new Map<string,{area:string;standard:string;grade:string;customers:Set<string>;jobs:Set<string>}>();
  const standards=[...groups.values()].sort((a,b)=>a.area.localeCompare(b.area)||a.standard.localeCompare(b.standard)).map((group,index)=>{
    const customers=(start:string,end:string)=>new Set(group.entries.filter(e=>e.app.receivedAt>=start&&e.app.receivedAt<=end).map(e=>e.app.candidateId)).size;
    const previousCustomers=customers(period.previousStart,period.previousEnd),currentCustomers=customers(period.currentStart,period.currentEnd);
    for(const {job,app} of group.entries){if(app.receivedAt<period.currentStart||app.receivedAt>period.currentEnd)continue;const key=JSON.stringify([group.area,group.standard,job.grade]),grade=grades.get(key)??{area:group.area,standard:group.standard,grade:job.grade,customers:new Set<string>(),jobs:new Set<string>()};grade.customers.add(app.candidateId);grade.jobs.add(job.id);grades.set(key,grade);}
    return {metricId:`STD-${index+1}`,area:group.area,standard:group.standard,previousCustomers,currentCustomers,change:currentCustomers-previousCustomers,changePercent:receiptChange(currentCustomers,previousCustomers),smallSample:Math.min(previousCustomers,currentCustomers)<5,
      months:windows.map(window=>({month:window.month,status:window.status,previousCustomers:window.status==="NOT_ARRIVED"?null:customers(window.previousStart,window.previousEnd),currentCustomers:window.status==="NOT_ARRIVED"?null:customers(window.currentStart,window.currentEnd)}))};
  });
  if(grades.size>300)throw Error("등급 그룹이 많습니다. 분야·표준 조건을 줄여 주세요.");
  const currentGrades=[...grades.values()].map(g=>({area:g.area,standard:g.standard,grade:g.grade,customers:g.customers.size,jobs:g.jobs.size})).sort((a,b)=>b.jobs-a.jobs||a.area.localeCompare(b.area)||a.standard.localeCompare(b.standard)||a.grade.localeCompare(b.grade));
  const insights=marketingInsights(standards);
  return {version:marketingSignalsVersion,mode:"RULE_BASED" as const,period,historicalGradeStatus:"UNVERIFIED" as const,standards,currentGrades,insights};
}
export type MarketingSignals=ReturnType<typeof buildMarketingSignals>;
export function readMarketingSignals(value:unknown,windows:Windows):MarketingSignals {
  const s=value as MarketingSignals,n=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0,text=(v:unknown)=>typeof v==="string"&&v.length>0&&v.length<=1000;
  const last=windows.filter(w=>w.status!=="NOT_ARRIVED").at(-1)!;
  if(!s||s.version!==marketingSignalsVersion||s.mode!=="RULE_BASED"||s.historicalGradeStatus!=="UNVERIFIED"||!s.period||s.period.previousStart!==windows[0].previousStart||s.period.currentStart!==windows[0].currentStart||s.period.previousEnd!==last.previousEnd||s.period.currentEnd!==last.currentEnd||!Array.isArray(s.standards)||s.standards.length>100||!Array.isArray(s.currentGrades)||s.currentGrades.length>300||!Array.isArray(s.insights)||s.insights.length<1||s.insights.length>2)throw Error("표준·등급 분석 응답 기준을 확인하지 못했습니다.");
  const ids=new Set<string>();
  s.standards.forEach(row=>{if(!row||!text(row.metricId)||ids.has(row.metricId)||!text(row.area)||!text(row.standard)||![row.previousCustomers,row.currentCustomers].every(n)||row.change!==row.currentCustomers-row.previousCustomers||row.smallSample!==(Math.min(row.previousCustomers,row.currentCustomers)<5)||row.changePercent!==receiptChange(row.currentCustomers,row.previousCustomers)||!Array.isArray(row.months)||row.months.length!==12)throw Error("표준별 집계값을 확인하지 못했습니다.");ids.add(row.metricId);
    row.months.forEach((month,i)=>{if(!month||month.month!==i+1||month.status!==windows[i].status||[month.previousCustomers,month.currentCustomers].some(v=>month.status==="NOT_ARRIVED"?v!==null:!n(v)))throw Error("표준별 월별 응답 오류");});});
  const gradeKeys=new Set<string>();for(const row of s.currentGrades){if(!row||![row.area,row.standard,row.grade].every(text)||!n(row.customers)||!n(row.jobs)||row.customers>row.jobs)throw Error("현재 등급 분포 응답 오류");const key=JSON.stringify([row.area,row.standard,row.grade]);if(gradeKeys.has(key))throw Error("현재 등급 분포 중복");gradeKeys.add(key);}
  for(const insight of s.insights)if(!insight||!["VOLUME_DROP","VOLUME_RISE","LIMITED_SAMPLE","NO_CHANGE","NO_ROWS"].includes(insight.rule)||![insight.observation,insight.check,insight.action].every(text)||insight.metricId!==null&&!ids.has(insight.metricId))throw Error("검토 요약 근거를 확인하지 못했습니다.");
  if(JSON.stringify(s.insights)!==JSON.stringify(marketingInsights(s.standards)))throw Error("집계 근거와 검토 요약이 일치하지 않습니다.");
  return s;
}

function marketingInsights(standards:Array<{metricId:string;standard:string;previousCustomers:number;currentCustomers:number;change:number}>){
  type Insight={rule:"VOLUME_DROP"|"VOLUME_RISE"|"LIMITED_SAMPLE"|"NO_CHANGE"|"NO_ROWS";metricId:string|null;observation:string;check:string;action:string};
  const insights:Insight[]=[];
  const material=standards.filter(row=>Math.max(row.previousCustomers,row.currentCustomers)>=5);
  const declining=material.filter(row=>row.change<0).sort((a,b)=>a.change-b.change||a.metricId.localeCompare(b.metricId))[0];
  const rising=material.filter(row=>row.change>0).sort((a,b)=>b.change-a.change||a.metricId.localeCompare(b.metricId))[0];
  for(const [row,rule] of [[declining,"VOLUME_DROP"],[rising,"VOLUME_RISE"]] as const){if(!row)continue;insights.push({rule,metricId:row.metricId,
    observation:`${row.standard}의 비교기간 접수 고객은 ${row.previousCustomers}명에서 ${row.currentCustomers}명으로 ${Math.abs(row.change)}명 ${row.change<0?"감소":"증가"}했습니다.`,
    check:"접수 규모의 변화이며 확정 신규·유지 고객 변화나 마케팅의 인과 효과를 뜻하지 않습니다. 교육 일정·접수 경로와 자료 누락 여부를 대조하세요.",
    action:row.change<0?"해당 표준의 최근 월별 모집 일정과 파트너별 접수 현황을 우선 확인하세요.":"해당 표준에서 유입이 발생한 경로를 확인한 뒤 소규모 모집 활동의 검토 대상으로 삼으세요."});}
  if(!insights.length)insights.push(!standards.length?{rule:"NO_ROWS",metricId:null,observation:"비교기간과 선택 조건에 해당하는 표준별 접수 기록이 없습니다.",check:"조회 성공으로 확인된 범위의 결과이며 시장 수요가 없다는 뜻은 아닙니다.",action:"기간과 필터, 이관 자료의 포함 범위를 확인하세요."}:!material.length?{rule:"LIMITED_SAMPLE",metricId:null,observation:"표준별 비교 표본이 작아 마케팅 우선순위를 자동으로 정하지 않았습니다.",check:"규칙의 최소 규모는 두 기간 중 큰 쪽 5명이며 통계적 유의성 기준은 아닙니다.",action:"자료를 더 축적하고 모집 일정·접수 경로를 함께 기록하세요."}:{rule:"NO_CHANGE",metricId:null,observation:"최소 규모를 충족한 표준에서 비교기간 접수 고객 수의 순변화가 없습니다.",check:"구성원이나 유입 경로까지 동일하다는 뜻은 아닙니다.",action:"월별 분포와 표준별 고객 구성을 확인하세요."});
  return insights;
}
