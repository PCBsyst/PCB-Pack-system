import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:p=>load(p.replace('@/lib/','')),Date,Map,Set,JSON,Error});return exports;}
const {buildCertificationLifecycle:build,readCertificationLifecycle:read}=load('certification-lifecycle'),{certificationLifecycleSampleData:sample}=load('certification-lifecycle-sample');
const filters={area:'전체',standard:'전체',partner:'전체'},run=(s=sample(),f=filters)=>build(s.applications,s.jobs,s.cycles,s.certificates,s.actions,2026,f,'2026-11-20');
let s=sample(),r=run(s);assert.equal(r.months[0].current.recordedExpiries,1);assert.equal(r.months[0].current.renewalIssued,1);assert.equal(r.months[0].current.linkedRenewalIssued,1);assert.equal(r.months[1].current.gradeChangeIssued,1);assert.equal(r.months[2].current.renewalIssued,1);assert.equal(r.months[2].current.linkedRenewalIssued,0);assert.equal(r.issues.unlinkedRenewalCertificates,1);assert.equal(r.counts.activePastValidity,1);assert.equal(r.counts.futureActions,1);assert.equal(r.months[10].previous.suspensions,1);assert.equal(r.months[11].current,null);assert.ok(r.months.every(m=>m.retentionRate===null&&m.renewalRate===null));
assert.equal(run(s,{...filters,standard:'ISO 45001'}).months[0].current.renewalIssued,0);assert.equal(run(s,{...filters,standard:'ISO 45001'}).issues.unlinkedRenewalCertificates,1);
s=sample();s.certificates[1].replaced_record_id='missing';r=run(s);assert.equal(r.issues.replacementLinkErrors,1);assert.equal(r.months[0].current.linkedRenewalIssued,0);
s=sample();s.certificates[3].replaced_record_id='old';assert.ok(run(s).issues.replacementLinkErrors>0); // Different candidate and competing successor.
s=sample();s.jobs[0].previous_job_id='grade';assert.equal(run(s).issues.jobLoopNodes,3);
s=sample();s.applications[1].business_area='K_BEAUTY';assert.ok(run(s).issues.jobLinkErrors>0);assert.equal(run(s).months[0].current.linkedRenewalIssued,0);
s=sample();s.certificates[0].replaced_record_id='grade';assert.equal(run(s).issues.replacementLoopNodes,3);
s=sample();s.certificates[0].history_state='CURRENT';assert.equal(run(s).issues.replacementHistoryMismatch,1);
s=sample();s.certificates[1].cycle_id='old';assert.equal(run(s).issues.certificateCycleErrors,1);
s=sample();s.cycles.push({id:'orphan',job_id:'missing',application_type:'최초'});assert.equal(run(s).issues.cycleLinkErrors,1);
s=sample();s.actions[0].job_id='unlinked';assert.equal(run(s).issues.actionLinkErrors,1);
s=sample();s.actions[0].effective_date='2023-01-01';assert.equal(run(s).issues.actionLinkErrors,1);
for(const mutate of [s=>s.certificates[0].valid_until='2026-02-30',s=>s.certificates[0].valid_until='2023-01-01',s=>s.actions[0].action_type='RESTORED',s=>s.certificates.push(s.certificates[0]),s=>delete s.jobs[0].previous_job_id]){s=sample();mutate(s);assert.throws(()=>run(s));}
r=build([],[],[],[],[],2026,filters,'2026-11-20');assert.equal(r.counts.certificates,0);assert.equal(r.months[0].renewalRate,null);
r=run();assert.ok(read(r,2026,filters));
for(const mutate of [r=>r.months.pop(),r=>r.months[0].renewalRate=50,r=>delete r.counts.jobs,r=>r.issues={},r=>r.coverage='VERIFIED',r=>r.months[0].current.linkedRenewalIssued=999,r=>r.filters.standard='wrong']){const bad=JSON.parse(JSON.stringify(r));mutate(bad);assert.throws(()=>read(bad,2026,filters));}
const panel=readFileSync('components/certification-lifecycle-panel.tsx','utf8');assert.ok(panel.includes('report?.key===key'));assert.ok(panel.includes('latest.current===key'));assert.ok(panel.includes('controller.abort()'));assert.ok(!/localStorage|sessionStorage|dangerouslySetInnerHTML/.test(panel));
console.log('유지·갱신 이력: 명시적 이전인증·후보자/표준/회차/날짜 연결·순환·분기·대체상태·미래 적용·만료 후 ACTIVE 유지·미확인 비율 차단 검사 통과');
