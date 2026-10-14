import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/bounded-row-reader.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const source=readFileSync('components/new-application-form.tsx','utf8');
const tree=ts.createSourceFile('form.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),handlers={};
function visit(node){if(ts.isFunctionDeclaration(node)&&['chooseExistingCandidate','changeCandidateMode'].includes(node.name?.text))handlers[node.name.text]=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
function fixture(options={}){
 const state={jobs:[],drafts:[{standard:'ISO 9001',previousJobId:'old'}],notice:'',name:'old',email:'old',calls:[]};
 const row=(candidate,index)=>({id:`${candidate}-${index}`,candidate_id:candidate,job_no:`QMS26${index}`,standard:'ISO 9001',grade:'Auditor',certification_records:[{certification_no:'sample',issue_date:'2026-10-12',history_state:'CURRENT'}],processing_cycles:[{status:'COMPLETED'}]});
 const context={registrationBusy:{current:false},setCandidateReadState:value=>state.readState=value,candidateLookupVersion:{current:0},hasEnvVars:!options.local,candidateOptions:[{id:'a',name:'후보자 A',email:'a@example.test'},{id:'b',name:'후보자 B',email:'b@example.test'}],readBoundedRows:exports.readBoundedRows,readRegistrationCandidate:async(_client,id,cancelled)=>{if(id==='a'&&options.profileGate)await options.profileGate;if(options.profileFail)throw Error('private');return cancelled()?null:{id,name:id==='a'?'후보자 A':'후보자 B',name_en:null,birth_date:null,nationality:null,email:id+'@example.test',phone:null};},
 createClient:()=>({from(){let candidate;return {select(){return this;},eq(key,value){candidate=value;return this;},order(){return this;},async range(from,to){state.calls.push([candidate,from,to]);if(candidate==='a'&&options.gate)await options.gate;if(options.fail)throw Error('private');const count=options.many?501:1;return {data:Array.from({length:count},(_,index)=>row(options.wrongCandidate?'other':candidate,index)).slice(from,options.truncated?from:to+1),count,error:null};}};}}),
 setExistingCandidateId:value=>state.selected=value,setPreviousJobs:value=>state.jobs=value,setJobDrafts:fn=>state.drafts=fn(state.drafts),setNotice:value=>state.notice=value,setCandidateName:value=>state.name=value,setCandidateEmail:value=>state.email=value,setCandidateNameEn:()=>{},setCandidateBirthDate:()=>{},setCandidateNationality:()=>{},setCandidatePhone:()=>{},setCandidateMode:value=>state.mode=value};
 const methods=vm.runInNewContext(ts.transpileModule(`${Object.values(handlers).join('\n')}; ({chooseExistingCandidate,changeCandidateMode})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);return {state,context,...methods};
}
let release;const gate=new Promise(resolve=>release=resolve);let f=fixture({gate});const first=f.chooseExistingCandidate('a');await f.chooseExistingCandidate('b');release();await first;assert.equal(f.state.name,'후보자 B');assert.equal(f.state.jobs[0].id,'b-0');assert.equal(f.state.drafts[0].previousJobId,'');
f=fixture({many:true});await f.chooseExistingCandidate('a');assert.equal(f.state.jobs.length,501);assert.equal(f.state.calls.length,2);
for(const options of [{fail:true},{truncated:true},{wrongCandidate:true}]){f=fixture(options);await f.chooseExistingCandidate('a');assert.equal(f.state.jobs.length,0);assert.match(f.state.notice,/조회 실패는 이전 인증 없음이 아닙니다/);assert.ok(!f.state.notice.includes('private'));}
f=fixture();await f.chooseExistingCandidate('missing');assert.equal(f.state.name,'');assert.equal(f.state.email,'');assert.equal(f.state.calls.length,0);
let finish;const pending=new Promise(resolve=>finish=resolve);f=fixture({gate:pending});const loading=f.chooseExistingCandidate('a');f.changeCandidateMode('NEW');finish();await loading;assert.equal(f.state.name,'');assert.equal(f.state.jobs.length,0);assert.equal(f.state.drafts[0].previousJobId,'');
f=fixture({local:true});await f.chooseExistingCandidate('a');assert.equal(f.state.calls.length,0);
f=fixture({profileFail:true});await f.chooseExistingCandidate('a');assert.equal(f.state.readState.status,'PROFILE_ERROR');
f=fixture({fail:true});await f.chooseExistingCandidate('a');assert.equal(f.state.readState.status,'JOBS_ERROR');
f=fixture();await f.chooseExistingCandidate('a');assert.equal(f.state.readState.status,'READY');await f.chooseExistingCandidate('a');assert.equal(f.state.readState.status,'READY');assert.equal(f.state.calls.length,2);
f=fixture();f.context.registrationBusy.current=true;await f.chooseExistingCandidate('a');assert.equal(f.state.calls.length,0);assert.equal(f.state.name,'old');
f=fixture({profileFail:true});await f.chooseExistingCandidate('a');assert.equal(f.state.name,'');assert.equal(f.state.email,'');assert.equal(f.state.calls.length,0);assert.match(f.state.notice,/조회 이력을 확인하지 못했습니다/);assert.ok(!f.state.notice.includes('private'));
let resolveProfile;const profileGate=new Promise(resolve=>resolveProfile=resolve);f=fixture({profileGate});const earlier=f.chooseExistingCandidate('a');await f.chooseExistingCandidate('b');resolveProfile();await earlier;assert.equal(f.state.name,'후보자 B');assert.equal(f.state.email,'b@example.test');assert.ok(f.state.calls.every(([candidate])=>candidate==='b'));
assert.match(source,/useEffect\(\(\) => \(\) => \{ candidateLookupVersion.current\+\+; \}, \[\]\)/);
console.log('기등록 후보자 선택: 늦은 응답 무시·모드 전환·이전 Job 초기화·501건 분할·부분/실패/다른 후보자 응답 차단 통과 (DB 모의)');
