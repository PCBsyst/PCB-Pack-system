import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};
function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const checks=load('application-registration-checks');
const ids={application:'11111111-1111-4111-8111-111111111111',candidate:'22222222-2222-4222-8222-222222222222',first:'33333333-3333-4333-8333-333333333333',extra:'44444444-4444-4444-8444-444444444444',cycle:'55555555-5555-4555-8555-555555555555'};
const bundle={application_id:ids.application,candidate_id:ids.candidate,job_id:ids.first};
for(const value of [null,[],{}, {...bundle,job_id:'local-job'}, {...bundle,candidate_id:null}])assert.throws(()=>checks.readApplicationBundle(value));
assert.throws(()=>checks.readApplicationBundle(bundle,ids.first));
assert.equal(checks.readApplicationBundle(bundle,ids.candidate).job_id,ids.first);
assert.equal(checks.hasUniqueRegistrationIds([{id:ids.extra},{id:ids.extra}]),false);
const source=readFileSync('components/new-application-form.tsx','utf8'),tree=ts.createSourceFile('form.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='registerApplication')handler=node.getText(tree);ts.forEachChild(node,visit);}
visit(tree);
function fixture(options={}){
 const state={requests:[],stored:[],count:0,notice:'',saving:false,needsReview:false,localWrites:0};
 const client={auth:{getUser:async()=>{state.requests.push(['auth']);if(options.gate)await options.gate;return {data:{user:options.authFail?null:{id:'staff'}},error:null};}},rpc:async(name,args)=>{
 state.requests.push([name,args]);
 if(name==='allocate_application_number')return {data:'APP-ISO-2026-0001',error:null};
 if(name==='allocate_job_number')return {data:options.badNumber?'wrong':`${args.p_job_prefix}260001`,error:null};
 if(name==='create_application_bundle_v2')return {data:options.badBundle?null:bundle,error:null};
 throw Error('unexpected RPC');},from(table){
 const chain={payload:null,operation:null,filters:[],update(payload){this.payload=payload;this.operation='update';return this;},insert(payload){this.payload=payload;this.operation='insert';return this;},eq(key,value){this.filters.push([key,value]);return this;},select(){return this;},result(){
 state.requests.push([table,this.operation,this.payload]);
 if(options.throwTable===table)throw Error('private details');
 let data;
 if(table==='applications')data={id:ids.application,...this.payload};
 if(table==='jobs')data=this.operation==='update'?{id:ids.first,...this.payload}:this.payload.map(row=>({id:ids.extra,...row}));
 if(table==='processing_cycles')data=this.payload.map(row=>({id:ids.cycle,...row}));
 if(options.fail===table+':'+this.operation)data=this.operation==='update'?null:[];
 if(options.wrongJob&&table==='jobs'&&this.operation==='insert')data[0].standard='OTHER';
 if(options.wrongCycle&&table==='processing_cycles')data[0].job_id=ids.first;
 if(options.badExtraId&&table==='jobs'&&this.operation==='insert')data[0].id=ids.first;
 if(options.badRange&&table==='applications'&&this.payload.management_no_to)data.management_no_to=999;
 return {data,error:null};},single:async function(){return this.result();},then(resolve,reject){return Promise.resolve().then(()=>this.result()).then(resolve,reject);}};return chain;
 }};
 const catalog=[...load('numbering-rules').numberingRules,load('certification-fields').createCertificationField({businessArea:'ISO',scheme:'IAS',accreditationTrack:'NON_ACCREDITED',field:'ISO 50001',jobPrefix:'ENMS',certificateCode:'8'})];
 const context={registrationBusy:{current:false},registrationUncertain:{current:false},fieldsLoading:false,fieldsError:'',candidateName:'가상 후보자',candidateNameEn:'Sample',candidateBirthDate:'',candidateNationality:'KR',candidateEmail:'',candidatePhone:'',candidateMode:'NEW',existingCandidateId:'',applicationType:'최초',receivedAt:'2026-10-08',businessArea:'ISO',scheme:'IAS',accreditationTrack:'NON_ACCREDITED',accreditationHidden:false,applicationNo:'PREVIEW',partnerCompany:'직접접수',primaryOwnerId:'staff',staffOptions:[{id:'staff',display_name:'담당자'}],catalog,
 jobEntries:[{standard:'ISO 50001',grade:'Auditor',previousJobId:'',managementNo:1,jobNo:'ENMS260001'},{standard:'ISO 9001',grade:'Auditor',previousJobId:'',managementNo:2,jobNo:'QMS260001'}],hasEnvVars:!options.local,createClient:()=>client,allocateAreaManagementNumbers:async()=>({data:1,error:null,legacy:false}),...checks,...load('workflow-record-checks'),...load('allocated-number-validation'),...load('numbering-rules'),
 setSaving:value=>state.saving=value,setNotice:value=>state.notice=value,setRegistrationNeedsReview:value=>state.needsReview=value,setStoredApplications:update=>state.stored=update(state.stored),setStoredCount:update=>state.count=update(state.count),savePrototypeApplication:()=>{state.localWrites++;if(options.localFail)throw Error('storage');}};
 const register=vm.runInNewContext(ts.transpileModule(`${handler}; registerApplication`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 return {register,state,context};
}
let f=fixture();await f.register();assert.equal(f.state.stored.length,2);assert.equal(f.state.stored[1].jobId,ids.extra);assert.equal(f.state.count,1);assert.equal(f.state.saving,false);assert.match(f.state.notice,/등록되었습니다/);
for(const options of [{badBundle:true},{fail:'applications:update'},{fail:'jobs:update'},{fail:'jobs:insert'},{fail:'processing_cycles:insert'},{wrongJob:true},{wrongCycle:true},{badExtraId:true},{badRange:true},{throwTable:'jobs'}]){
 f=fixture(options);await f.register();assert.equal(f.state.stored.length,0);assert.equal(f.state.count,0);assert.equal(f.state.needsReview,true);assert.match(f.state.notice,/일부 자료가 저장/);assert.ok(!f.state.notice.includes('private details'));const count=f.state.requests.length;await f.register();assert.equal(f.state.requests.length,count);assert.equal(f.context.registrationBusy.current,false);
}
for(const options of [{authFail:true},{badNumber:true}]){f=fixture(options);await f.register();assert.equal(f.state.stored.length,0);assert.equal(f.state.needsReview,false);assert.ok(!f.state.requests.some(([name])=>name==='create_application_bundle_v2'));}
f=fixture({local:true});await f.register();assert.equal(f.state.stored.length,2);assert.equal(f.state.localWrites,2);
f=fixture({local:true,localFail:true});await f.register();assert.equal(f.state.stored.length,0);assert.equal(f.state.needsReview,true);assert.equal(f.context.registrationBusy.current,false);
let release;const gate=new Promise(resolve=>release=resolve);f=fixture({gate});const first=f.register();await f.register();assert.equal(f.state.requests.filter(([name])=>name==='auth').length,1);release();await first;assert.equal(f.state.count,1);
assert.match(source,/disabled=\{saving \|\| registrationNeedsReview\}/);
console.log('신청 실제 저장 처리: 신규 분야·복수 Job·연결 ID·빈/불일치 응답·인증 실패·중복 클릭·부분 저장 재등록 차단·로컬 실패 검사 통과 (DB 모의)');
