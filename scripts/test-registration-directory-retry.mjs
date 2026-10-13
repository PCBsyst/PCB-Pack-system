import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('components/new-application-form.tsx','utf8'),tree=ts.createSourceFile('form.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect,retry;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useEffect'&&node.arguments[0]?.getText(tree).includes('readRegistrationDirectories'))effect=node.arguments[0].getText(tree);if(ts.isFunctionDeclaration(node)&&node.name?.text==='retryDirectories')retry=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
const directories={candidates:[{id:'candidate'}],partners:[{id:'partner'}],staff:[{id:'owner'}],ownerId:'owner'};
function fixture(options={}){
 const state={owner:'selected-owner',loading:false,error:'조회 실패',revision:0,name:'입력한 후보자',fields:['ISO 9001'],writes:0};
 const context={hasEnvVars:true,directoriesLoading:false,registrationBusy:{current:false},readPrototypeApplications:()=>[],setStoredApplications:()=>{},setStoredCount:()=>{},createClient:()=>({}),readRegistrationDirectories:async()=>{if(options.gate)await options.gate;if(options.fail)throw Error('private');return directories;},setDirectoriesLoading:value=>state.loading=value,setDirectoriesError:value=>state.error=value,setDirectoryRevision:fn=>state.revision=fn(state.revision),setCandidateOptions:value=>state.candidates=value,setPartnerOptions:value=>state.partners=value,setStaffOptions:value=>state.staff=value,setPrimaryOwnerId:fn=>state.owner=fn(state.owner)};
 const run=vm.runInNewContext(ts.transpileModule(`const effect=${effect}; ${retry}; ({effect,retryDirectories})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);return {state,context,...run};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
let f=fixture({fail:true});f.effect();await flush();assert.match(f.state.error,/입력은 유지됩니다/);assert.equal(f.state.name,'입력한 후보자');assert.equal(f.state.owner,'selected-owner');assert.equal(f.state.loading,false);
f=fixture();f.retryDirectories();assert.equal(f.state.revision,1);assert.equal(f.state.loading,true);assert.equal(f.state.name,'입력한 후보자');assert.equal(f.state.fields[0],'ISO 9001');f.effect();await flush();assert.equal(f.state.candidates[0].id,'candidate');assert.equal(f.state.owner,'selected-owner');assert.equal(f.state.error,'');
f=fixture();f.state.owner='';f.effect();await flush();assert.equal(f.state.owner,'owner');
for(const patch of [{directoriesLoading:true},{registrationBusy:{current:true}}]){f=fixture();Object.assign(f.context,patch);f.retryDirectories();assert.equal(f.state.revision,0);}
let release;const gate=new Promise(resolve=>release=resolve);f=fixture({gate});const cleanup=f.effect();cleanup();release();await flush();assert.equal(f.state.candidates.length,0);assert.equal(f.state.owner,'selected-owner');
assert.doesNotMatch(source,/window.location.reload/);assert.match(source,/\[directoryRevision\]/);assert.match(source,/onClick=\{retryDirectories\}/);
console.log('신청 목록 복구: 입력·선택 담당자 유지·재조회·초기 기본 담당자·중복/저장 중 차단·종료 응답 무시 통과 (화면 처리 함수 모의)');
