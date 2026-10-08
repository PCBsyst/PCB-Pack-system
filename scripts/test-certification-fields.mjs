import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const exports = {}; cache[name] = exports;
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: path => load(path.replace('@/lib/', '')) });
  return exports;
}
const { createCertificationField: create, parseAdditionalCertificationFields: parse } = load('certification-fields');
const { numberingRules, getNumberingRules } = load('numbering-rules');
const input = { businessArea: 'ISO', scheme: 'IAS', accreditationTrack: 'NON_ACCREDITED', field: 'ISO 50001', jobPrefix: 'ENMS', certificateCode: '8' };
const rule = create(input), catalog = [...numberingRules, ...parse([rule])];
assert.equal(rule.jobPattern, 'ENMSYYNNNN');
assert.equal(rule.certificatePattern, 'YY8GNNNN');
assert.equal(getNumberingRules('ISO','IAS','NON_ACCREDITED',catalog).some(item => item.field === input.field), true);
assert.equal(getNumberingRules('ISO','IAS','ACCREDITED',catalog).some(item => item.field === input.field), false);
assert.equal(load('job-number').getJobNumber('ISO','IAS','NON_ACCREDITED',input.field,'2026-10-08',[{jobNo:'ENMS260002'}],catalog),'ENMS260003');
assert.equal(load('certification-number').getCertificationNumberPrefix('ISO','IAS','NON_ACCREDITED',input.field,'Verification Auditor','2026-10-08',catalog),'2685');
assert.equal(load('job-number').getJobNumber('ISO','IAS','ACCREDITED','ISO 9001','2026-10-08',[]),'QMS260001');
for (const change of [{certificateCode:'88'}, {jobPrefix:'QMS'}, {jobPrefix:'Q-MS'}, {certificateCode:'7'}, {field:'ISO 9001'}, {field:'x\u0000'}, {scheme:'OTHER'}]) assert.throws(() => parse([create({...input,...change})]));
assert.throws(() => parse([rule,rule]));
assert.throws(() => parse({}));
assert.equal(parse([{...rule,jobPattern:'bad',verified:false}])[0].verified,true);
const hook = readFileSync('components/use-certification-fields.ts','utf8');
const ast = ts.createSourceFile('hook.ts',hook,ts.ScriptTarget.Latest,true);
let addSource, loadEffect;
function visit(node) { if(ts.isVariableDeclaration(node) && node.name.getText(ast)==='add') addSource=node.initializer.getText(ast); if(ts.isCallExpression(node) && node.expression.getText(ast)==='useEffect' && node.arguments[0].getText(ast).includes('maybeSingle')) loadEffect=node.arguments[0].getText(ast); ts.forEachChild(node,visit); }
visit(ast);
function harness(options={}) {
 const state={writes:0,filters:[],saved:null,error:'',saving:false};
 const baseline={current:{exists:!options.insert,updatedAt:'2026-10-08T00:00:00Z'}};
 const chain={update(payload){state.writes++;state.payload=payload;return this;},insert(payload){state.writes++;state.payload=payload;return this;},eq(key,value){state.filters.push([key,value]);return this;},select(){return this;},async single(){return options.fail ? {error:{message:'conflict'},data:null} : {error:null,data:{value:state.payload.value,updated_at:state.payload.updated_at.replace('Z','+00:00')}};}};
 const context={additional:[],loading:!!options.loading,error:'',baseline,busy:{current:false},mounted:{current:true},hasEnvVars:true,CERTIFICATION_FIELDS_KEY:'certification_fields_v1',parseAdditionalCertificationFields:parse,
 createClient:()=>({auth:{getUser:async()=>({data:{user:options.authFail?null:{id:'admin'}},error:null})},from:()=>chain}),setSaving:v=>state.saving=v,setAdditional:v=>state.saved=v,setNotice:v=>state.notice=v,setError:v=>state.error=v};
 const add=vm.runInNewContext(ts.transpileModule(`(${addSource})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 return {add,state,context};
}
for(const insert of [true,false]) { const h=harness({insert}); assert.equal(await h.add(rule),true);assert.equal(h.state.saved[0].field,input.field);assert.equal(h.state.saving,false);if(!insert)assert.deepEqual(h.state.filters.find(([key])=>key==='updated_at'),['updated_at','2026-10-08T00:00:00Z']); }
for(const options of [{fail:true},{authFail:true},{loading:true}]) {const h=harness(options);assert.equal(await h.add(rule),false);assert.equal(h.state.saved,null);assert.equal(h.state.saving,false);}
const h=harness();assert.equal(await h.add(create({...input,jobPrefix:'QMS'})),false);assert.equal(h.state.writes,0);
for(const mode of ['empty','loaded','error','malformed','cancelled']) {
 const state={loading:null,error:'',additional:null}, baseline={current:null};let release;
 const chain={select(){return this;},eq(){return this;},maybeSingle:()=>new Promise(resolve=>release=resolve)};
 const context={hasEnvVars:true,baseline,CERTIFICATION_FIELDS_KEY:'certification_fields_v1',parseAdditionalCertificationFields:parse,createClient:()=>({from:()=>chain}),setAdditional:v=>state.additional=v,setLoading:v=>state.loading=v,setError:v=>state.error=v};
 const cleanup=vm.runInNewContext(ts.transpileModule(`(${loadEffect})()`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 if(mode==='cancelled')cleanup();
 release(mode==='error'?{error:{message:'secret'},data:null}:{error:null,data:mode==='empty'?null:{value:mode==='malformed'?{}:[rule],updated_at:'2026-10-08T00:00:00Z'}});
 await new Promise(resolve=>setImmediate(resolve));
 if(mode==='cancelled'){assert.equal(baseline.current,null);assert.equal(state.loading,true);}
 else if(['error','malformed'].includes(mode)){assert.match(state.error,/인증분야/);assert.equal(baseline.current,null);}
 else {assert.equal(state.error,'');assert.equal(state.loading,false);assert.equal(state.additional.length,mode==='empty'?0:1);assert.equal(baseline.current.exists,mode!=='empty');}
}
for(const file of ['components/new-application-form.tsx','components/application-detail.tsx']) {const source=readFileSync(file,'utf8');assert.match(source,/useCertificationFields/);assert.match(source,/fieldsLoading \|\| fieldsError/);assert.match(source,/get(?:JobNumber|CertificationNumberPrefix)\([^;]+catalog\)/);}
console.log('인증분야 추가·번호 연결·중복·저장 실패·동시 변경 검사 통과');
