import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const {buildApplicationReviewHtml:build}=load('application-review-html');
let {context,job,metadata}=decisionReportSample();
context.deliveryDocuments[job.id]={diploma:{applicability:'REQUIRED',received:true,date:'2026-11-02',comment:'가상 학력 확인'},auditLog:{applicability:'NOT_APPLICABLE',received:false,date:'',comment:'가상 제외 사유'}};
let html=build(context,job,metadata);
for(const value of ['신청서류 검토서','통합테스트 후보자','ISO 9001','심사원','not-rendered@example.test','가상 검토자','가상 검증자','1차 서류검토','2차 검증','가상 학력 확인','해당 없음','가상 제외 사유','확인됨'])assert.ok(html.includes(value),value);
assert.ok(!html.includes('가상 심의위원 A'),'미리보기 목적에 없는 심의자 개인정보 제외');assert.ok(!html.includes('26130099'),'검토 단계에 불필요한 인증번호 제외');
context.candidate.name='<script>alert(1)</script>';context.review.comment='악성 <img src="https://example.test/leak"> & 내용';html=build(context,job,metadata);
assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(!/<script|<img|<iframe|<form/i.test(html));assert.match(html,/default-src &#39;none&#39;/);
context.reviewRequirements={};context.review.comment='';context.review.verificationComment='';html=build(context,job,metadata);assert.ok(html.includes('요건 검토 기록 미입력'));assert.ok(!html.includes('undefined'));
assert.throws(()=>build(context,job,{...metadata,recordHash:'bad'}));
({context,job,metadata}=decisionReportSample({long:true}));html=build(context,job,metadata);assert.ok(html.includes('35. 장문'));assert.match(html,/thead\{display:table-header-group\}/);
console.log('서류검토 HTML: 신청/연락처·제출서류·적용 제외·1/2차 검토·장문·삽입 차단·불필요한 인증/심의 정보 제외 통과');
