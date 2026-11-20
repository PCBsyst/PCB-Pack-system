import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>load(p.replace('@/lib/','')),Date,JSON,Error,Object,Set});return exports;}
const {approvedIntakePatch:apply}=load('application-intake-apply'),{extractApplicationSuggestions:extract}=load('application-intake');
const empty={name:'',nameEn:'',birthDate:'',nationality:'대한민국',email:'',phone:''},row=(field,value,overwrite=false)=>({field,value,approved:true,overwrite});
assert.equal(apply(empty,empty,[row('name','가상후보')],'2026-11-20').name,'가상후보');
assert.equal(Object.keys(apply(empty,empty,[row('email','sample@example.test'),{...row('name','가상후보'),approved:false}],'2026-11-20')).join(), 'email');
for(const rows of [[],[row('name','')],[row('email','invalid')],[row('birthDate','2030-01-01')],[row('birthDate','2026-02-30')],[row('name','가상\u0000후보')],[row('name','가상'),row('name','중복')],[row('address','미지원')],[row('nationality','다른국가')]])assert.throws(()=>apply(empty,empty,rows,'2026-11-20'));
assert.equal(apply(empty,empty,[row('nationality','가상국가',true)],'2026-11-20').nationality,'가상국가');
assert.throws(()=>apply({...empty,name:'수동변경'},empty,[row('name','가상후보')],'2026-11-20'));
assert.equal(extract('성명: 가상후보\n성명: 다른가상후보')[0].conflict,true);
assert.equal(extract('성명: 가상후보\n성명: 다른가상후보')[0].value,'');
const ui=readFileSync('components/application-intake-panel.tsx','utf8');assert.doesNotMatch(ui,/localStorage|sessionStorage|fetch\(|dangerouslySetInnerHTML/);assert.match(ui,/approved:false,overwrite:false/);assert.match(ui,/approved:false,overwrite:false}:r/);assert.match(ui,/turn.current!==id/);
console.log('신청서 선택 반영: 미승인 제외·개별 변경 확인·상충 값·입력 변경 감지·날짜/이메일/제어문자 검증·화면 메모리 한정 통과 (운영 DB 별도)');
