import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};
function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Error,require:path=>load(path.replace('@/lib/',''))});return exports;}
const {summarizeRegistration:summarize,inspectApplicationRegistration:inspect}=load('application-registration-inspection');
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const application={id:id(1),application_no:'APP-ISO-2026-0001',candidate_id:id(2),received_at:'2026-10-08',application_type:'최초',management_no_from:1,management_no_to:2,primary_owner_id:id(3)};
const jobs=[1,2].map((no)=>({id:id(10+no),candidate_id:id(2),application_id:id(1),job_no:`TEST26000${no}`,management_no:no,standard:'ISO 50001',grade:'Auditor',primary_owner_id:id(3)}));
const cycles=jobs.map((job,index)=>({id:id(30+index),job_id:job.id,sequence:1,application_type:'최초',application_date:'2026-10-08',status:'DOCUMENT_REVIEW'}));
assert.equal(summarize(application,true,jobs,cycles).issues.length,0);
assert.match(summarize(application,false,jobs,cycles).issues[0],/후보자/);
assert.match(summarize(application,true,jobs.slice(0,1),cycles.slice(0,1)).issues[0],/Job 수/);
assert.match(summarize(application,true,jobs,[]).jobs[0].notes[0],/초기 회차 미조회/);
assert.match(summarize(application,true,jobs,[...cycles,{...cycles[0],id:id(90)}]).jobs[0].notes[0],/중복/);
assert.match(summarize(application,true,[{...jobs[0],candidate_id:id(99)},jobs[1]],cycles).jobs[0].notes[0],/후보자 연결/);
assert.match(summarize(application,true,[{...jobs[0],primary_owner_id:null},jobs[1]],cycles).jobs[0].notes[0],/담당자/);
assert.match(summarize(application,true,jobs,[{...cycles[0],application_date:'2026-10-07'},cycles[1]]).jobs[0].notes[0],/접수일/);
assert.throws(()=>summarize({...application,received_at:'2026-02-30'},true,jobs,cycles));
assert.throws(()=>summarize(application,true,[{...jobs[0],application_id:id(99)},jobs[1]],cycles));
const duplicatedJobs=[jobs[0],{...jobs[1],job_no:` ${jobs[0].job_no.toLowerCase()} `}];
const duplicateResult=summarize(application,true,duplicatedJobs,cycles);
assert.equal(duplicateResult.jobs.filter(job=>job.notes.includes('현재 신청 내 Job 번호 중복')).length,2);
assert.equal(duplicatedJobs[1].job_no,` ${jobs[0].job_no.toLowerCase()} `);
const followup={...cycles[0],id:id(91),sequence:2};
assert.ok(summarize(application,true,jobs,[...cycles,followup,{...followup,id:id(92)}]).jobs[0].notes.includes('후속 회차 번호 중복'));
assert.equal(summarize(application,true,jobs,[...cycles,followup,{...followup,id:id(92),job_id:jobs[1].id}]).issues.length,0);
assert.equal(summarize(application,true,jobs,[...cycles,followup,{...followup,id:id(92),sequence:3}]).issues.length,0);
function client(options={}){
 const calls=[];
 return {calls,from(table){const chain={filters:[],select(columns){calls.push([table,columns]);assert.ok(!/\b(name|email|phone|birth_date)\b/.test(columns));return this;},eq(key,value){this.filters.push([key,value]);return this;},in(key,value){this.filters.push([key,value]);return this;},order(){return this;},async maybeSingle(){if(options.fail===table)return {data:null,error:{message:'private'}};return {data:table==='applications'?(options.missing?null:application):(options.candidateMissing?null:{id:id(2)}),error:null};},async range(from,to){if(options.fail===table)throw Error('network');const rows=table==='jobs'?(options.many?Array.from({length:501},(_,i)=>({...jobs[0],id:id(100+i),job_no:`T${i}`,management_no:i+1})):jobs):cycles.filter(cycle=>this.filters.find(([key])=>key==='job_id')?.[1].includes(cycle.job_id));return {data:rows.slice(from,to+1),count:options.truncated?rows.length+1:rows.length,error:null};}};return chain;}};
}
let c=client();let result=await inspect(c,application.application_no);assert.equal(result.found,true);assert.equal(result.issues.length,0);
c=client({missing:true});assert.equal((await inspect(c,application.application_no)).found,false);assert.equal(c.calls.length,1);
for(const fail of ['applications','candidates','jobs','processing_cycles'])await assert.rejects(()=>inspect(client({fail}),application.application_no));
await assert.rejects(()=>inspect(client({truncated:true}),application.application_no));
assert.equal(await inspect(client(),application.application_no,()=>true),null);
await assert.rejects(()=>inspect(client(),'x\u0000'));
result=await inspect(client({candidateMissing:true}),application.application_no);assert.match(result.issues[0],/후보자/);
result=await inspect(client({many:true}),application.application_no);assert.equal(result.jobs.length,501);assert.match(result.issues[0],/관리번호/);
const source=readFileSync('components/application-registration-inspector.tsx','utf8'),tree=ts.createSourceFile('component.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='inspect')handler=node.initializer.getText(tree);ts.forEachChild(node,visit);}
visit(tree);
function harness(options={}){const state={calls:0,result:null,notice:'',loading:false};const context={Error,busy:{current:false},mounted:{current:true},revision:{current:0},hasEnvVars:!options.local,applicationNo:application.application_no,expectedCount:options.expectedCount??"",expectedStandards:options.expectedStandards??"",...load("registration-expectation"),createClient:()=>({}),inspectApplicationRegistration:async()=>{state.calls++;if(options.gate)await options.gate;if(options.fail)throw Error('private');return options.found ? {found:true,jobs:[{standard:"ISO 9001"}]} : {found:false};},setNotice:value=>state.notice=value,setLoading:value=>state.loading=value,setResult:value=>state.result=value,setComparison:value=>state.comparison=value};const run=vm.runInNewContext(ts.transpileModule(`(${handler})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);return {run,state,context};}
let h=harness({fail:true});await h.run();assert.equal(h.state.result,null);assert.match(h.state.notice,/조회 실패는 기록 없음/);assert.ok(!h.state.notice.includes('private'));
h=harness({local:true});await h.run();assert.equal(h.state.calls,0);
h=harness({found:true,expectedCount:'2',expectedStandards:'ISO 9001\nISO 50001'});await h.run();assert.equal(h.state.comparison.countMismatch,true);assert.deepEqual(Array.from(h.state.comparison.missingStandards),['ISO 50001']);
h=harness({expectedCount:'3',expectedStandards:'ISO 9001\nISO 50001'});await h.run();assert.equal(h.state.calls,0);assert.match(h.state.notice,/줄 수가 다릅니다/);
let release;const gate=new Promise(resolve=>release=resolve);h=harness({gate});const first=h.run();await h.run();assert.equal(h.state.calls,1);h.context.revision.current++;release();await first;assert.equal(h.state.result,null);assert.equal(h.state.loading,false);
assert.ok(!/\.(insert|update|delete|upsert|rpc)\(/.test(readFileSync('lib/application-registration-inspection.ts','utf8')));
console.log('신청 연결 점검: 읽기 전용·필요 최소 필드·501건·후보자/범위/회차·부분 조회 거절·중복/취소/조회 실패·로컬 대체 금지 검사 통과 (DB 모의)');
