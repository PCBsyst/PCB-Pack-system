import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};
function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const {isAllocatedNumber:valid}=load('allocated-number-validation');
for(const prefix of ['ENMS26','2685','KB-26-SMP3','PL-Q26']){
 for(const suffix of ['0000','0001','9999'])assert.equal(valid(prefix+suffix,prefix),true);
 for(const value of [null,1234,{},prefix,prefix+'001',prefix+'10000',prefix+'0001 ',prefix+'1e03',' '+prefix+'0001','OTHER0001'])assert.equal(valid(value,prefix),false);
}
assert.equal(valid('0001',''),false);
const {getJobNumber:job}=load('job-number');
assert.equal(job('ISO','IAS','ACCREDITED','ISO 9001','2026-10-08',[{jobNo:'QMS269998'}]),'QMS269999');
assert.equal(job('ISO','IAS','ACCREDITED','ISO 9001','2026-10-08',[{jobNo:'QMS269999'}]),'');
assert.equal(job('ISO','IAS','ACCREDITED','ISO 9001','2026-10-08',[{jobNo:'QMS2610000'}]),'');
assert.equal(job('ISO','IAS','ACCREDITED','ISO 9001','2026-10-08',[{jobNo:'QMS261e03'}]),'QMS260001');
assert.equal(load('certification-number').getCertificationNumber('ISO 9001','Auditor','2026-10-08',[{standard:'ISO 9001',currentGrade:'Auditor',certificationNo:'26139999'}]),'');
const source=readFileSync('components/application-detail.tsx','utf8'),tree=ts.createSourceFile('detail.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='allocateCertificationNo')handler=node.initializer.getText(tree);ts.forEachChild(node,visit);}
visit(tree);
async function run(data,options={}){
 const writes=[],notices=[],calls=[];
 const context={fieldsLoading:!!options.loading,fieldsError:options.loadError?'설정 조회 실패':'',demo:{certificates:{j:{issueDate:'2026-10-08'}}},usesSupabaseWorkspace:!options.local,application:{scheme:'IAS',businessArea:'ISO',accreditationTrack:'NON_ACCREDITED'},catalog:[],getCertificationNumberPrefix:()=> '2685',isAllocatedNumber:valid,createClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data,error:options.error?{message:'private-error'}:null};}}),changeCertificate:(...args)=>writes.push(args),setNotice:value=>notices.push(value),dateRules:{},setDemo:()=>{}};
 const fn=vm.runInNewContext(ts.transpileModule(`(${handler})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 await fn({id:'j',jobNo:'ENMS260001',standard:'ISO 50001',currentGrade:'Verification Auditor'});return {writes,notices,calls};
}
let result=await run('26850001');assert.equal(result.writes[0][2],'26850001');assert.equal(result.calls[0][1].p_number_prefix,'2685');
for(const value of [null,26850001,'2685001','268510000','26750001',{},'26850001 ']){result=await run(value);assert.equal(result.writes.length,0);assert.match(result.notices.at(-1),/일치하지 않아/);}
for(const options of [{loading:true},{loadError:true},{local:true},{error:true}]){result=await run('26850001',options);assert.equal(result.writes.length,0);assert.equal(result.calls.length,options.error?1:0);assert.ok(!result.notices.join('').includes('private-error'));}
const form=readFileSync('components/new-application-form.tsx','utf8');const guard=form.indexOf('isAllocatedNumber(allocatedJobNo'),write=form.indexOf('rpc("create_application_bundle_v2"');assert.ok(guard>=0&&write>guard);
console.log('번호 응답 무결성: 신규 분야·접두어/순번·잘못된 응답 미적용·9999 한도·조회 실패 차단 검사 통과');
