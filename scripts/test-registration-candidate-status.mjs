import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>name==='@/components/ui/button'?{Button:({children,...props})=>React.createElement('button',props,children)}:require(name)});return exports;}
const {candidateProfileReady:profile,candidatePreviousJobsReady:jobs}=load('lib/registration-candidate-state.ts');
for(const status of ['IDLE','PROFILE_LOADING','JOBS_LOADING','READY','PROFILE_ERROR','JOBS_ERROR']){
 const state={id:'selected',status};assert.equal(profile(state,'selected'),['JOBS_LOADING','READY','JOBS_ERROR'].includes(status));assert.equal(jobs(state,'selected'),status==='READY');assert.equal(profile(state,'other'),false);assert.equal(jobs(state,''),false);
}
const Status=load('components/registration-candidate-status.tsx').RegistrationCandidateStatus;
for(const status of ['PROFILE_LOADING','JOBS_LOADING','READY','PROFILE_ERROR','JOBS_ERROR']){
 const html=renderToStaticMarkup(React.createElement(Status,{state:{id:'selected',status},onRetry:()=>{},saving:false}));assert.match(html,/role="status"/);assert.equal(html.includes('선택한 후보자 다시 조회'),status.endsWith('ERROR'));assert.ok(!html.includes('selected'));
}
let retried=0;const element=Status({state:{id:'selected',status:'PROFILE_ERROR'},onRetry:()=>retried++,saving:false});let button;
function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node?.props)return;if(node.props.onClick)button=node;walk(node.props.children);}walk(element);button.props.onClick();assert.equal(retried,1);
assert.equal(renderToStaticMarkup(React.createElement(Status,{state:{id:'',status:'IDLE'},onRetry:()=>{},saving:false})), '');
const parent=readFileSync('components/new-application-form.tsx','utf8');assert.match(parent,/void chooseExistingCandidate\(existingCandidateId\)/);
console.log('후보자 조회 상태: 상세/Job 분리·선택 ID 대조·상세 미확인/갱신 차단·재시도 버튼·개인 원문 미표시 검사 통과 (화면/DB 모의)');
