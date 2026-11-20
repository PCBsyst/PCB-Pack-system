import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:p=>load(p.replace('@/lib/','')),Date,Map,Set,JSON,Error});return exports;}
const {buildCustomerAcquisition:build,normalizeAcquisitionRecords:normalize,readCustomerAcquisitionReport:read,acquisitionWindows:windows,allAcquisitionFilters:filters}=load('customer-acquisition');
const {customerAcquisitionSample:sample}=load('customer-acquisition-sample');
const data=sample();let result=build(data.applications,data.jobs,2026,filters,'2026-11-20');
assert.equal(result.months[0].previous.firstObservedCandidates,2); // Job-less candidate preserved.
assert.equal(result.months[0].current.firstObservedCandidates,1); // Two Jobs do not mean two customers.
assert.equal(result.months[0].current.firstObservedStandardPairs,3);assert.equal(result.months[0].current.observedExistingStandardAdditions,1);
assert.equal(result.readiness.cancelledApplications,1);assert.equal(result.readiness.futureApplications,1);assert.equal(result.readiness.joblessApplications,1);
assert.equal(result.months[10].current.firstObservedCandidates,1);assert.equal(result.months[10].previousEnd,'2025-11-20');assert.equal(result.months[10].status,'PROVISIONAL');assert.equal(result.months[11].current,null);assert.equal(result.months[11].status,'NOT_ARRIVED');
assert.ok(result.months.every(row=>row.newCustomers===null&&row.newCustomerYoY===null&&row.retentionRate===null));assert.equal(result.historyStatus,'UNVERIFIED');
assert.equal(build(data.applications,data.jobs,2026,{...filters,standard:'ISO 14001'},'2026-11-20').months[0].current.firstObservedCandidates,1);
assert.equal(build(data.applications,data.jobs,2026,{...filters,standard:'ISO 14001'},'2026-11-20').months[0].current.observedExistingStandardAdditions,1);
const apps=data.applications.map(a=>a.id==='extra'?{...a,partner:'다른 파트너'}:a);
assert.equal(build(apps,data.jobs,2026,{...filters,partner:'다른 파트너'},'2026-11-20').months[0].current.firstObservedCandidates,0); // Filter must not create a new customer.
assert.equal(windows(2024,'2024-02-29')[1].previousEnd,'2023-02-28');assert.equal(windows(2025,'2026-11-20')[11].status,'CLOSED');
assert.throws(()=>windows(2027,'2026-11-20'));assert.throws(()=>windows(2026,'2026-02-30'));
const empty=build([],[],2026,filters,'2026-11-20');assert.equal(empty.months[0].previous.firstObservedCandidates,0);assert.equal(empty.months[0].newCustomerYoY,null);assert.equal(empty.readiness.observedFrom,null);
const rawApps=[{id:'app',candidate_id:'candidate',received_at:'2026-01-01',business_area:'ISO',partner_name_snapshot:'',status:'DOCUMENT_REVIEW'}];
const rawJobs=[{id:'job',application_id:'app',candidate_id:'candidate',standard:'ISO 9001',grade:'Auditor'}];
assert.ok(normalize(rawApps,rawJobs));
for(const [a,j] of [[rawApps,[{...rawJobs[0],candidate_id:'wrong'}]],[rawApps,[{...rawJobs[0],application_id:'wrong'}]],[[...rawApps,rawApps[0]],rawJobs],[rawApps,[...rawJobs,rawJobs[0]]],[[{...rawApps[0],received_at:'2026-02-30'}],rawJobs],[[{...rawApps[0],status:'UNKNOWN'}],rawJobs]])assert.throws(()=>normalize(a,j));
assert.ok(read(result,2026,filters));
for(const mutate of [r=>r.months.pop(),r=>r.months[0].current.firstObservedCandidates=-1,r=>r.months[0].newCustomerYoY=10,r=>r.historyStatus='VERIFIED',r=>r.filters.area='K_BEAUTY',r=>r.readiness.joblessApplications=99999,r=>r.months[11].current={firstObservedCandidates:0},r=>r.months[10].previousEnd='2025-11-30']){const bad=JSON.parse(JSON.stringify(result));mutate(bad);assert.throws(()=>read(bad,2026,filters));}
const panel=readFileSync('components/customer-acquisition-report.tsx','utf8');assert.ok(panel.includes('latest.current===key'));assert.ok(panel.includes('report?.key===key'));assert.ok(panel.includes('controller.abort()'));assert.ok(!/localStorage|sessionStorage|dangerouslySetInnerHTML/.test(panel));
assert.ok(readFileSync('components/monthly-operations-report.tsx','utf8').includes('<CustomerAcquisitionReport'));
console.log('신규 비교: Job 없는 최초 접수·복수 Job 중복 제외·필터 전 전체 최초일·표준추가·취소/미래·윤년/진행월·0명/미확인·손상 응답/지연 응답 방지 연결 통과');
