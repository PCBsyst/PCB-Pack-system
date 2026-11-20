import {buildCertificationLifecycle} from "@/lib/certification-lifecycle";
import type {AcquisitionFilters} from "@/lib/customer-acquisition";
export function certificationLifecycleSampleData() {
  const applications=["old","renewal","grade","unlinked"].map((id,index)=>({id,candidate_id:index===3?"sample-b":"sample-a",received_at:["2024-01-01","2026-01-10","2026-02-02","2026-03-01"][index],business_area:"ISO",partner_name_snapshot:"직접접수",status:"COMPLETED"}));
  const jobs=applications.map((app,index)=>({id:app.id,application_id:app.id,candidate_id:app.candidate_id,standard:"ISO 9001",grade:index===2?"Lead Auditor":"Auditor",previous_job_id:[null,"old","renewal",null][index]}));
  const cycles=applications.map(app=>({id:app.id,job_id:app.id,application_type:app.id==="old"?"최초":app.id==="grade"?"등급변경":"갱신"}));
  const certificates=applications.map((app,index)=>({id:app.id,job_id:app.id,cycle_id:app.id,issue_date:app.received_at,valid_from:app.received_at,valid_until:["2026-01-31","2029-01-09","2029-02-01","2026-09-30"][index],state:"ACTIVE",history_state:["REPLACED_BY_RENEWAL","REPLACED_BY_GRADE_CHANGE","CURRENT","CURRENT"][index],replaced_record_id:[null,"old","renewal",null][index]}));
  const actions=[{id:"suspended",job_id:"old",certification_record_id:"old",action_type:"SUSPENDED",effective_date:"2025-11-01"},{id:"future",job_id:"unlinked",certification_record_id:"unlinked",action_type:"WITHDRAWN",effective_date:"2026-12-01"}];
  return {applications,jobs,cycles,certificates,actions};
}
export function certificationLifecycleSample(year:number,filters:AcquisitionFilters) {const s=certificationLifecycleSampleData();return buildCertificationLifecycle(s.applications,s.jobs,s.cycles,s.certificates,s.actions,year,filters,"2026-11-20");}
