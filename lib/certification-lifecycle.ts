import {acquisitionWindows,normalizeAcquisitionRecords,type AcquisitionFilters} from "@/lib/customer-acquisition";
import {isRegistrationDate} from "@/lib/allocated-number-validation";
export const lifecycleVersion="LIFE-01";
type Raw=Record<string,unknown>;
const string=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=500;
function rows(value:unknown,fields:string[]) {
  if(!Array.isArray(value)||value.some(row=>!row||typeof row!=="object"||Array.isArray(row)||!fields.every(field=>string(row[field])))||new Set(value.map(row=>row.id)).size!==value.length)throw Error("인증 이력 필수값 또는 중복을 확인하지 못했습니다.");
  return value as Raw[];
}
/** Count all nodes inside directed loops without recursive traversal or quadratic scans. */
function loopNodes(entries:Array<{id:string;previous:string|null}>) {
  const links=new Map(entries.map(row=>[row.id,row.previous])),done=new Set<string>(),loops=new Set<string>();
  for(const entry of entries){const path:string[]=[],position=new Map<string,number>();let id:string|null=entry.id;
    while(id&&links.has(id)&&!done.has(id)){if(position.has(id)){for(const node of path.slice(position.get(id)!))loops.add(node);break;}position.set(id,path.length);path.push(id);id=links.get(id)??null;}
    for(const node of path)done.add(node);
  }return loops;
}
export function buildCertificationLifecycle(rawApps:unknown,rawJobs:unknown,rawCycles:unknown,rawCertificates:unknown,rawActions:unknown,year:number,filters:AcquisitionFilters,asOf:string) {
  const normalized=normalizeAcquisitionRecords(rawApps,rawJobs),windows=acquisitionWindows(year,asOf);
  if(!["전체","ISO","K_BEAUTY"].includes(filters.area)||Object.values(filters).some(v=>!string(v)||v.length>300))throw Error("이력 조회 조건을 확인해 주세요.");
  const applications=new Map(normalized.applications.map(app=>[app.id,app]));
  const jobs=rows(rawJobs,["id","application_id","candidate_id","standard","grade"]).map(row=>{
    if(row.previous_job_id!==null&&!string(row.previous_job_id))throw Error("이전 Job 필드를 확인하지 못했습니다.");
    return {id:row.id as string,applicationId:row.application_id as string,candidateId:row.candidate_id as string,standard:row.standard as string,previous:row.previous_job_id as string|null};
  });const jobById=new Map(jobs.map(job=>[job.id,job]));
  const sameScope=(a:typeof jobs[number],b:typeof jobs[number])=>a.candidateId===b.candidateId&&a.standard===b.standard&&applications.get(a.applicationId)?.area===applications.get(b.applicationId)?.area;
  const cycleTypes=["최초","갱신","등급변경","전환","기타","INITIAL","RENEWAL","GRADE_CHANGE","TRANSFER","OTHER"];
  const cycles=rows(rawCycles,["id","job_id","application_type"]).map(row=>{if(!cycleTypes.includes(row.application_type as string))throw Error("처리 회차 유형을 확인하지 못했습니다.");return {id:row.id as string,jobId:row.job_id as string,type:row.application_type as string};});
  const cycleById=new Map(cycles.map(cycle=>[cycle.id,cycle]));
  const certificates=rows(rawCertificates,["id","job_id","cycle_id","issue_date","valid_until","state","history_state"]).map(row=>{
    if(!isRegistrationDate(row.issue_date as string)||!isRegistrationDate(row.valid_until as string)||!isRegistrationDate(row.valid_from as string)||String(row.valid_until)<String(row.valid_from)||!["ACTIVE","SUSPENDED","WITHDRAWN","NONE"].includes(row.state as string)||!["CURRENT","REPLACED_BY_RENEWAL","REPLACED_BY_GRADE_CHANGE","EXPIRED","SUSPENDED","WITHDRAWN"].includes(row.history_state as string)||row.replaced_record_id!==null&&!string(row.replaced_record_id))throw Error("인증 날짜·상태·대체 연결을 확인하지 못했습니다.");
    return {id:row.id as string,jobId:row.job_id as string,cycleId:row.cycle_id as string,issueDate:row.issue_date as string,until:row.valid_until as string,state:row.state as string,history:row.history_state as string,previous:row.replaced_record_id as string|null};
  });const certificateById=new Map(certificates.map(certificate=>[certificate.id,certificate]));
  const actions=rows(rawActions,["id","job_id","certification_record_id","action_type","effective_date"]).map(row=>{
    if(!["SUSPENDED","WITHDRAWN"].includes(row.action_type as string)||!isRegistrationDate(row.effective_date as string))throw Error("상태변경 유형·날짜를 확인하지 못했습니다.");
    return {jobId:row.job_id as string,certificateId:row.certification_record_id as string,type:row.action_type as string,date:row.effective_date as string};
  });
  const issues={jobLinkErrors:0,jobLoopNodes:0,cycleLinkErrors:0,certificateCycleErrors:0,replacementLinkErrors:0,replacementHistoryMismatch:0,replacementLoopNodes:0,multipleSuccessors:0,multipleCurrentRecords:0,unlinkedRenewalCertificates:0,unlinkedGradeChangeCertificates:0,actionLinkErrors:0};
  const badJobs=new Set<string>(),badCertificates=new Set<string>();
  const jobLoops=loopNodes(jobs);issues.jobLoopNodes=jobLoops.size;
  for(const job of jobs){const previous=job.previous?jobById.get(job.previous):null;if(jobLoops.has(job.id)||job.previous&&(!previous||previous.id===job.id||!sameScope(previous,job))){badJobs.add(job.id);issues.jobLinkErrors++;}}
  for(const cycle of cycles)if(!jobById.has(cycle.jobId))issues.cycleLinkErrors++;
  const certificateLoops=loopNodes(certificates);issues.replacementLoopNodes=certificateLoops.size;
  const successors=new Map<string,number>(),currentCounts=new Map<string,number>();
  for(const c of certificates){if(c.previous)successors.set(c.previous,(successors.get(c.previous)??0)+1);if(c.history==="CURRENT")currentCounts.set(c.jobId,(currentCounts.get(c.jobId)??0)+1);}
  issues.multipleSuccessors=[...successors.values()].filter(count=>count>1).length;issues.multipleCurrentRecords=[...currentCounts.values()].filter(count=>count>1).length;
  for(const c of certificates){const job=jobById.get(c.jobId),cycle=cycleById.get(c.cycleId);if(!job||!cycle||cycle.jobId!==c.jobId){badCertificates.add(c.id);issues.certificateCycleErrors++;}
    if(certificateLoops.has(c.id)||badJobs.has(c.jobId)||(currentCounts.get(c.jobId)??0)>1)badCertificates.add(c.id);
    if(c.previous){const p=certificateById.get(c.previous),previousJob=p?jobById.get(p.jobId):null;
      if(!p||!job||!previousJob||p.id===c.id||!sameScope(previousJob,job)||p.issueDate>c.issueDate||job.previous&&job.previous!==p.jobId||(successors.get(c.previous)??0)>1){badCertificates.add(c.id);issues.replacementLinkErrors++;}
      const expectedHistory=["갱신","RENEWAL"].includes(cycle?.type??"")?"REPLACED_BY_RENEWAL":["등급변경","GRADE_CHANGE"].includes(cycle?.type??"")?"REPLACED_BY_GRADE_CHANGE":null;
      if(p&&expectedHistory&&p.history!==expectedHistory){badCertificates.add(c.id);issues.replacementHistoryMismatch++;}}
  }
  const validLink=(c:typeof certificates[number])=>Boolean(c.previous)&&!badCertificates.has(c.id)&&!badCertificates.has(c.previous!)&&certificateById.has(c.previous!);
  const renewal=(c:typeof certificates[number])=>["갱신","RENEWAL"].includes(cycleById.get(c.cycleId)?.type??"");
  const gradeChange=(c:typeof certificates[number])=>["등급변경","GRADE_CHANGE"].includes(cycleById.get(c.cycleId)?.type??"");
  for(const c of certificates){if(c.issueDate>asOf)continue;if(renewal(c)&&!validLink(c))issues.unlinkedRenewalCertificates++;if(gradeChange(c)&&!validLink(c))issues.unlinkedGradeChangeCertificates++;}
  const validActions=actions.filter(action=>{const certificate=certificateById.get(action.certificateId);const ok=jobById.has(action.jobId)&&certificate?.jobId===action.jobId&&certificate.issueDate<=action.date&&!badCertificates.has(certificate.id);if(!ok)issues.actionLinkErrors++;return ok;});
  const inScope=(jobId:string)=>{const job=jobById.get(jobId),app=job?applications.get(job.applicationId):null;return Boolean(job&&app&&(filters.area==="전체"||app.area===filters.area)&&(filters.standard==="전체"||job.standard===filters.standard)&&(filters.partner==="전체"||app.partner===filters.partner));};
  const selected=certificates.filter(c=>inScope(c.jobId)&&!badCertificates.has(c.id)&&c.issueDate<=asOf);
  const counts=(start:string,end:string)=>{
    const issued=selected.filter(c=>c.issueDate>=start&&c.issueDate<=end),expiries=selected.filter(c=>c.until>=start&&c.until<=end);
    const events=validActions.filter(action=>inScope(action.jobId)&&action.date>=start&&action.date<=end&&action.date<=asOf);
    return {recordedExpiries:expiries.length,renewalIssued:issued.filter(renewal).length,linkedRenewalIssued:issued.filter(c=>renewal(c)&&validLink(c)).length,gradeChangeIssued:issued.filter(gradeChange).length,suspensions:events.filter(e=>e.type==="SUSPENDED").length,withdrawals:events.filter(e=>e.type==="WITHDRAWN").length};
  };
  return {version:lifecycleVersion,year,asOf,filters,coverage:"UNVERIFIED" as const,
    counts:{applications:normalized.applications.length,jobs:jobs.length,cycles:cycles.length,certificates:certificates.length,actions:actions.length,futureIssues:certificates.filter(c=>c.issueDate>asOf).length,futureActions:actions.filter(a=>a.date>asOf).length,activePastValidity:selected.filter(c=>c.history==="CURRENT"&&c.state==="ACTIVE"&&c.until<asOf).length},
    issues,missing:["INITIAL_STATE_AND_RESTORATION_HISTORY","HISTORICAL_GRADE_SNAPSHOT","APPROVED_RENEWAL_WINDOW_AND_EXCLUSIONS"] as const,
    months:windows.map(window=>({...window,current:window.status==="NOT_ARRIVED"?null:counts(window.currentStart,window.currentEnd),previous:window.status==="NOT_ARRIVED"?null:counts(window.previousStart,window.previousEnd),retentionRate:null,renewalRate:null}))};
}
export type CertificationLifecycleReport=ReturnType<typeof buildCertificationLifecycle>;
export function readCertificationLifecycle(value:unknown,year:number,filters:AcquisitionFilters):CertificationLifecycleReport {
  const r=value as CertificationLifecycleReport,integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
  const countKeys=["applications","jobs","cycles","certificates","actions","futureIssues","futureActions","activePastValidity"] as const,issueKeys=["jobLinkErrors","jobLoopNodes","cycleLinkErrors","certificateCycleErrors","replacementLinkErrors","replacementHistoryMismatch","replacementLoopNodes","multipleSuccessors","multipleCurrentRecords","unlinkedRenewalCertificates","unlinkedGradeChangeCertificates","actionLinkErrors"] as const;
  if(!r||r.version!==lifecycleVersion||r.year!==year||!isRegistrationDate(r.asOf)||r.coverage!=="UNVERIFIED"||!r.filters||Object.entries(filters).some(([key,v])=>r.filters[key as keyof AcquisitionFilters]!==v)||!r.counts||!r.issues||!countKeys.every(key=>integer(r.counts[key]))||!issueKeys.every(key=>integer(r.issues[key]))||JSON.stringify(r.missing)!==JSON.stringify(["INITIAL_STATE_AND_RESTORATION_HISTORY","HISTORICAL_GRADE_SNAPSHOT","APPROVED_RENEWAL_WINDOW_AND_EXCLUSIONS"]))throw Error("인증 이력 점검 기준을 확인하지 못했습니다.");
  const windows=acquisitionWindows(year,r.asOf);if(!Array.isArray(r.months)||r.months.length!==12)throw Error("월별 인증 이력이 일부만 반환되었습니다.");
  r.months.forEach((row,i)=>{if(!row||Object.entries(windows[i]).some(([key,v])=>row[key as keyof typeof row]!==v)||row.retentionRate!==null||row.renewalRate!==null)throw Error("이력 미확인 지표가 확정값으로 반환되었습니다.");for(const counts of [row.current,row.previous]){if(row.status==="NOT_ARRIVED"){if(counts!==null)throw Error("미도래 월 집계 오류");}else if(!counts||![counts.recordedExpiries,counts.renewalIssued,counts.linkedRenewalIssued,counts.gradeChangeIssued,counts.suspensions,counts.withdrawals].every(integer)||counts.linkedRenewalIssued>counts.renewalIssued)throw Error("인증 이력 집계 응답 오류");}});
  return r;
}
