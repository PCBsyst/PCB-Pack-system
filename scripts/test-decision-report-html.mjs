import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const {buildDecisionReportHtml:build}=load('decision-report-html');let {context,job,metadata}=decisionReportSample();
let html=build(context,job,'KR',metadata);for(const text of ['인증결정보고서','통합테스트 후보자','ISO 9001','심사원','가상 심의위원 A','가상 심의위원 B','대표자 최종 승인','26130099','2026-11-18','2026-11-19','2029-11-18','지식 시험','인성 시험','교육 요구사항','학력 요구사항','심사이력','가상 데이터로 생성된'])assert.ok(html.includes(text),text);
assert.ok(!html.includes('미선택 위원 숨김'));assert.ok(!html.includes('출력 금지 의견'));assert.ok(!html.includes('not-rendered'));assert.ok(!/<script|<iframe|<form/i.test(html));assert.match(html,/default-src &#39;none&#39;/);
context.review.comment='& <script>alert(1)</script> "\' </style><img src=https://external.invalid/x>';html=build(context,job,'KR',metadata);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
context.application.accreditationHidden=true;context.application.scheme='PJLA';html=build(context,job,'KR',metadata);assert.ok(!html.includes('PJLA'));assert.ok(html.includes('표시 생략'));
({context,job,metadata}=decisionReportSample());html=build(context,job,'EN',metadata);assert.ok(html.includes('Certification Decision Report'));assert.ok(html.includes('Sample Candidate'));assert.ok(html.includes(context.englishText.reviewComment));assert.ok(!html.includes(context.review.comment));
context.panelMembers[1].selected=false;html=build(context,job,'KR',metadata);assert.ok(html.includes('2명 이상이 선택되지'));context.assessment[job.id]={};context.certificates[job.id]=undefined;html=build(context,job,'KR',metadata);assert.ok(html.includes('미입력'));assert.ok(!html.includes('undefined'));
assert.throws(()=>build(context,job,'KR',{...metadata,recordHash:'bad'}));
({context,job,metadata}=decisionReportSample({long:true}));html=build(context,job,'KR',metadata);assert.ok(html.includes('35. 장문'));assert.ok(html.includes('break-inside:auto'));assert.match(html,/thead\{display:table-header-group\}/);
console.log('인증결정보고서 HTML: 국영문·5개 평가·선택 위원·대표자 승인·날짜·개인정보 최소화·숨김·삽입 방지·장문 보존 검사 통과');
