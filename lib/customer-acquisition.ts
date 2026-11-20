import { isRegistrationDate } from "@/lib/allocated-number-validation";
import {buildMarketingSignals,readMarketingSignals} from "@/lib/marketing-signals";

export const acquisitionVersion="ACQ-02";
export type AcquisitionApplication={id:string;candidateId:string;receivedAt:string;area:string;partner:string;status:string};
export type AcquisitionJob={id:string;applicationId:string;candidateId:string;standard:string;grade:string};
export type AcquisitionFilters={area:string;standard:string;partner:string};
export const allAcquisitionFilters:AcquisitionFilters={area:"전체",standard:"전체",partner:"전체"};
const text=(value:unknown):value is string=>typeof value==="string"&&value.trim().length>0&&value.length<=500;
const statuses=new Set(["INTAKE_REVIEW","DOCUMENT_REVIEW","SUPPLEMENT_PENDING","INVOICE_PENDING","PAYMENT_PENDING","DECISION_PENDING","PARTIALLY_COMPLETED","COMPLETED","CANCELLED"]);
export function normalizeAcquisitionRecords(apps:unknown,jobs:unknown) {
  if(!Array.isArray(apps)||!Array.isArray(jobs))throw Error("신청·Job 자료 구성을 확인하지 못했습니다.");
  const applications:AcquisitionApplication[]=apps.map(row=>{
    if(!row||![row.id,row.candidate_id,row.business_area,row.status].every(text)||!isRegistrationDate(row.received_at)||!["ISO","K_BEAUTY"].includes(row.business_area)||typeof row.partner_name_snapshot!=="string"||row.partner_name_snapshot.length>500||!statuses.has(row.status))throw Error("신청 필수값·접수일을 확인하지 못했습니다.");
    return {id:row.id,candidateId:row.candidate_id,receivedAt:row.received_at,area:row.business_area,partner:row.partner_name_snapshot,status:row.status};
  });
  const byId=new Map(applications.map(row=>[row.id,row]));
  if(byId.size!==applications.length)throw Error("신청 중복을 확인해 주세요.");
  const normalizedJobs:AcquisitionJob[]=jobs.map(row=>{
    if(!row||![row.id,row.application_id,row.candidate_id,row.standard,row.grade].every(text)||byId.get(row.application_id)?.candidateId!==row.candidate_id)throw Error("신청·후보자·Job 연결을 확인하지 못했습니다.");
    return {id:row.id,applicationId:row.application_id,candidateId:row.candidate_id,standard:row.standard,grade:row.grade};
  });
  if(new Set(normalizedJobs.map(row=>row.id)).size!==normalizedJobs.length)throw Error("Job 중복을 확인해 주세요.");
  return {applications,jobs:normalizedJobs};
}
function monthEnd(year:number,month:number,day?:number) {
  const last=new Date(Date.UTC(year,month,0)).getUTCDate();
  return `${year}-${String(month).padStart(2,"0")}-${String(Math.min(day??last,last)).padStart(2,"0")}`;
}
export function acquisitionWindows(year:number,asOf:string) {
  if(!Number.isInteger(year)||year<1901||year>9998||!isRegistrationDate(asOf)||year>Number(asOf.slice(0,4)))throw Error("비교 연도와 한국 기준일을 확인해 주세요.");
  const currentYear=Number(asOf.slice(0,4)),month=Number(asOf.slice(5,7)),day=Number(asOf.slice(8,10));
  return Array.from({length:12},(_,index)=>{
    const m=index+1,future=year===currentYear&&m>month,partial=year===currentYear&&m===month;
    return {month:m,status:future?"NOT_ARRIVED" as const:partial?"PROVISIONAL" as const:"CLOSED" as const,
      currentStart:`${year}-${String(m).padStart(2,"0")}-01`,currentEnd:monthEnd(year,m,partial?day:undefined),
      previousStart:`${year-1}-${String(m).padStart(2,"0")}-01`,previousEnd:monthEnd(year-1,m,partial?day:undefined)};
  });
}
/** Full-history approval is deliberately NOT accepted from a browser or inferred from a successful query. */
export function buildCustomerAcquisition(applications:AcquisitionApplication[],jobs:AcquisitionJob[],year:number,filters:AcquisitionFilters,asOf:string) {
  const windows=acquisitionWindows(year,asOf);
  if(!Object.values(filters).every(value=>typeof value==="string"&&value.length>0&&value.length<=300)||!["전체","ISO","K_BEAUTY"].includes(filters.area))throw Error("비교 조회 조건을 확인해 주세요.");
  const active=applications.filter(row=>row.status!=="CANCELLED"&&row.receivedAt<=asOf);
  const first=new Map<string,string>(),firstStandard=new Map<string,string>(),byApplication=new Map<string,AcquisitionJob[]>();
  for(const job of jobs)byApplication.set(job.applicationId,[...(byApplication.get(job.applicationId)??[]),job]);
  const pair=(app:AcquisitionApplication,standard:string)=>JSON.stringify([app.candidateId,app.area,standard]);
  for(const app of active){if(!first.has(app.candidateId)||app.receivedAt<first.get(app.candidateId)!)first.set(app.candidateId,app.receivedAt);
    for(const job of byApplication.get(app.id)??[]){const key=pair(app,job.standard);if(!firstStandard.has(key)||app.receivedAt<firstStandard.get(key)!)firstStandard.set(key,app.receivedAt);}}
  // Determine first dates across all areas/partners/standards BEFORE selecting a scope.
  const selected=active.filter(app=>(filters.area==="전체"||app.area===filters.area)&&(filters.partner==="전체"||app.partner===filters.partner));
  const observed=(start:string,end:string)=>{
    const candidates=new Set<string>(),standards=new Set<string>(),additions=new Set<string>();
    for(const app of selected){if(app.receivedAt<start||app.receivedAt>end)continue;
      const related=(byApplication.get(app.id)??[]).filter(job=>filters.standard==="전체"||job.standard===filters.standard);
      if((filters.standard==="전체"||related.length)&&first.get(app.candidateId)===app.receivedAt)candidates.add(app.candidateId);
      for(const job of related){const key=pair(app,job.standard);if(firstStandard.get(key)!==app.receivedAt)continue;standards.add(key);if(first.get(app.candidateId)!<app.receivedAt)additions.add(key);}}
    return {firstObservedCandidates:candidates.size,firstObservedStandardPairs:standards.size,observedExistingStandardAdditions:additions.size};
  };
  const eligibleDates=active.map(app=>app.receivedAt).sort();
  return {version:acquisitionVersion,year,asOf,filters,historyStatus:"UNVERIFIED" as const,marketSignals:buildMarketingSignals(active,jobs,windows,filters),
    readiness:{applicationCount:applications.length,jobCount:jobs.length,eligibleApplications:active.length,joblessApplications:active.filter(app=>!(byApplication.get(app.id)?.length)).length,
      cancelledApplications:applications.filter(app=>app.status==="CANCELLED").length,futureApplications:applications.filter(app=>app.receivedAt>asOf).length,
      observedFrom:eligibleDates[0]??null,observedThrough:eligibleDates.at(-1)??null,firstHistory:"UNVERIFIED" as const,historicalState:"NOT_VALIDATED" as const,renewalLinks:"NOT_VALIDATED" as const},
    months:windows.map(window=>({...window,current:window.status==="NOT_ARRIVED"?null:observed(window.currentStart,window.currentEnd),previous:window.status==="NOT_ARRIVED"?null:observed(window.previousStart,window.previousEnd),
      newCustomers:null,newStandardCustomers:null,newCustomerYoY:null,retentionRate:null,renewalRate:null}))};
}
export type CustomerAcquisitionReport=ReturnType<typeof buildCustomerAcquisition>;

export function readCustomerAcquisitionReport(value:unknown,year:number,filters:AcquisitionFilters):CustomerAcquisitionReport {
  if(!value||typeof value!=="object")throw Error("비교 보고서 응답을 확인하지 못했습니다.");
  const report=value as CustomerAcquisitionReport;
  const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
  if(report.version!==acquisitionVersion||report.year!==year||report.historyStatus!=="UNVERIFIED"||!report.filters||Object.keys(allAcquisitionFilters).some(key=>report.filters[key as keyof AcquisitionFilters]!==filters[key as keyof AcquisitionFilters])||!isRegistrationDate(report.asOf)||!report.readiness)throw Error("비교 보고서 기준이 일치하지 않습니다.");
  const readiness=report.readiness;
  if(![readiness.applicationCount,readiness.jobCount,readiness.eligibleApplications,readiness.joblessApplications,readiness.cancelledApplications,readiness.futureApplications].every(integer)||readiness.firstHistory!=="UNVERIFIED"||readiness.historicalState!=="NOT_VALIDATED"||readiness.renewalLinks!=="NOT_VALIDATED"||[readiness.observedFrom,readiness.observedThrough].some(date=>date!==null&&!isRegistrationDate(date))||readiness.eligibleApplications>readiness.applicationCount||readiness.joblessApplications>readiness.eligibleApplications)throw Error("자료 준비 상태를 확인하지 못했습니다.");
  const windows=acquisitionWindows(year,report.asOf);
  if(!Array.isArray(report.months)||report.months.length!==12)throw Error("월별 자료가 일부만 반환되었습니다.");
  report.months.forEach((row,index)=>{
    if(!row||Object.entries(windows[index]).some(([key,v])=>row[key as keyof typeof row]!==v)||[row.newCustomers,row.newStandardCustomers,row.newCustomerYoY,row.retentionRate,row.renewalRate].some(v=>v!==null))throw Error("미확인 지표가 확정값으로 반환되었습니다.");
    for(const summary of [row.current,row.previous]){if(row.status==="NOT_ARRIVED"){if(summary!==null)throw Error("미도래 월 응답 오류");}else if(!summary||![summary.firstObservedCandidates,summary.firstObservedStandardPairs,summary.observedExistingStandardAdditions].every(integer)||summary.observedExistingStandardAdditions>summary.firstObservedStandardPairs)throw Error("월별 집계값을 확인하지 못했습니다.");}
  });
  readMarketingSignals(report.marketSignals,windows);
  return report;
}
