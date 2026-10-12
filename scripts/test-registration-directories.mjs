import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const {readRegistrationDirectories:read}=load('registration-directories');
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
function fixture(options={}){const calls=[];return {calls,auth:{getUser:async()=>({data:{user:options.noAuth?null:{id:id(1)}},error:options.authError?{}:null})},from(table){let filters=[];return {select(){return this;},eq(key,value){filters.push([key,value]);return this;},order(){return this;},async range(from,to){calls.push([table,from,to]);if(options.fail===table)throw Error('private');if(table!=='candidates')assert.ok(filters.some(([key,value])=>key==='active'&&value===true));const count=options.many?501:1;const rows=Array.from({length:count},(_,index)=>table==='candidates'?{id:id(index+10),name:'가상 후보자',name_en:null,birth_date:null,nationality:null,email:null,phone:null}:table==='partners'?{id:id(index+10),name:'가상 파트너',active:true}:{id:id(index+1),display_name:'가상 담당자',role:'STAFF',active:true});if(options.bad===table)rows[0].id='invalid';if(options.inactive===table)rows[0].active=false;if(options.missingOwner&&table==='profiles')rows[0].id=id(9999);return {data:rows.slice(from,options.truncated===table?from:to+1),count,error:null};}};}};}
let client=fixture({many:true}),result=await read(client,()=>false);assert.equal(result.candidates.length,501);assert.equal(result.partners.length,501);assert.equal(result.staff.length,501);assert.equal(result.ownerId,id(1));assert.equal(client.calls.length,6);
for(const table of ['candidates','partners','profiles'])for(const option of ['fail','bad','truncated'])await assert.rejects(()=>read(fixture({[option]:table}),()=>false));
for(const table of ['partners','profiles'])await assert.rejects(()=>read(fixture({inactive:table}),()=>false));
for(const options of [{noAuth:true},{authError:true},{missingOwner:true}])await assert.rejects(()=>read(fixture(options),()=>false));
client=fixture();assert.equal(await read(client,()=>true),null);assert.equal(client.calls.length,0);
const form=readFileSync('components/new-application-form.tsx','utf8');assert.match(form,/directoriesLoading \|\| directoriesError/);assert.match(form,/return \(\) => \{ cancelled = true; \}/);assert.match(form,/if \(!hasEnvVars\) \{ setPartnerOptions\(readStoredPartners/);
console.log('신청 선택 목록: 501건씩 분할·세 목록 전체 확인·부분/실패/손상/비활성/담당자 미조회 차단·취소·로컬 대체 금지 통과 (DB 모의)');
