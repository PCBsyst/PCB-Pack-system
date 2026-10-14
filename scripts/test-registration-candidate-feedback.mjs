import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),modules={};
const focused=[];let missing=false;const document={getElementById:id=>missing?null:{focus:()=>focused.push(id)}};
function load(path){if(modules[path])return modules[path];const exports={};modules[path]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,document,require:name=>name.startsWith('@/lib/')?load(`lib/${name.slice(6)}.ts`):require(name)});return exports;}
const Feedback=load('components/registration-candidate-feedback.tsx').RegistrationCandidateFeedback;
const input={name:'가상 후보자',nameEn:'',birthDate:'',nationality:'',email:'',phone:''};
const render=(value,existing=false)=>renderToStaticMarkup(React.createElement(Feedback,{input:value,receivedAt:'2026-10-14',existing}));
assert.equal(render(input),'');
const bad={...input,birthDate:'2026-02-30',email:'private@@example.test',phone:'x'.repeat(101)};
let html=render(bad);assert.match(html,/입력 확인 · 3건/);assert.match(html,/생년월일/);assert.match(html,/이메일/);assert.match(html,/전화번호/);assert.match(html,/aria-live="polite"/);assert.ok(!html.includes('private@@example.test'));assert.ok(!html.includes('가상 후보자'));
const {registrationCandidateIssues:issues,registrationCandidateFieldProps:props}=load('lib/registration-candidate-validation.ts');
for(const field of ['name','nameEn','birthDate','nationality','email','phone']){
 const attributes=props(field,issues(bad,'2026-10-14'));assert.equal(attributes.id,`registration-candidate-${field}`);
 if(['birthDate','email','phone'].includes(field)){assert.equal(attributes['aria-invalid'],true);assert.ok(html.includes(`href="#${attributes.id}"`));for(const description of attributes['aria-describedby'].split(' '))assert.ok(html.includes(`id="${description}"`));}
 else {assert.equal(attributes['aria-invalid'],false);assert.equal(attributes['aria-describedby'],undefined);}
 assert.equal(props(field,[])['aria-invalid'],false);
}
const links=[];function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node?.props)return;if(node.type==='a')links.push(node);walk(node.props.children);}walk(Feedback({input:bad,receivedAt:'2026-10-14',existing:false}));assert.equal(links.length,3);
let prevented=0;for(const link of links){link.props.onClick({preventDefault:()=>prevented++});assert.equal(focused.at(-1),link.props.href.slice(1));}assert.equal(prevented,3);missing=true;assert.doesNotThrow(()=>links[0].props.onClick({preventDefault:()=>{}}));
html=render({...bad,email:'valid@example.test'});assert.match(html,/입력 확인 · 2건/);assert.ok(!html.includes('이메일 주소 형식'));
assert.equal(render(bad,true),'');
html=render({...input,name:''});assert.match(html,/후보자 이름을 입력/);assert.ok(!html.includes('이메일 주소 형식'));
const parent=readFileSync('components/new-application-form.tsx','utf8');assert.match(parent,/<RegistrationCandidateFeedback input=/);assert.match(parent,/existing=\{candidateMode === "EXISTING"\}/);
for(const field of ['name','nameEn','birthDate','nationality','email','phone'])assert.ok(parent.includes(`{...candidateField("${field}")}`));
console.log('후보자 입력 안내: 복수 오류 동시 표시·수정 후 감소·선택 공란·기등록 제외·개인 원문 미표시·접근성 상태 HTML 검사 통과 (브라우저 시각 검증 별도)');
