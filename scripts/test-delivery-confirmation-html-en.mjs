import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>load(p.replace('@/lib/',''))});return exports;}
const {buildDeliveryConfirmationHtml:build}=load('delivery-confirmation-html');
const {deliveryConfirmationDocumentRows:rows,deliveryConfirmationHtmlIssues:issues}=load('delivery-confirmation-localization');
const {context,job,metadata}=decisionReportSample();
context.deliveryDocuments[job.id]=Object.fromEntries(rows.map(([key])=>[key,{applicability:'REQUIRED',received:true,date:'2026-11-20',comment:`국문 ${key} 기록`,commentEn:`Synthetic ${key} note & <checked>`}]));
context.deliveryDocuments[job.id].auditLog.applicability='NOT_APPLICABLE';context.deliveryDocuments[job.id].career.applicability='CONDITIONAL';
context.deliveryDocuments.other={survey:{comment:'다른 Job의 비공개 기록'}};
context.englishText={}; // Unprinted review and panel opinions are irrelevant here.
let html=build(context,job,metadata,'EN');
for(const [key,,label] of rows){assert.ok(html.includes(label));assert.ok(html.includes(`Synthetic ${key} note &amp; &lt;checked&gt;`));assert.ok(!html.includes(`국문 ${key} 기록`));}
for(const text of ['lang="en"','Sample Candidate','Not applicable','Conditional','2026-11-02','2026-11-06','2026-11-19','2029-11-18','26130099'])assert.ok(html.includes(text),text);
for(const text of ['not-rendered@example.test','가상 심의위원 A','다른 Job의 비공개 기록'])assert.ok(!html.includes(text),text);
assert.equal(issues(context,job.id).length,0);
assert.ok(!html.split('05 Billing and Original Dispatch Records')[1].includes('2026-11-19'));
for(const [key] of rows){const input=structuredClone(context);input.deliveryDocuments[job.id][key].commentEn='';assert.equal(issues(input,job.id).length,1);assert.throws(()=>build(input,job,metadata,'EN'));}
context.certificates[job.id].originalSentAt='2026-11-23';context.certificates[job.id].trackingNumber='TRACK-SYNTHETIC';
context.deliveryDocuments[job.id].education.commentEn='Long synthetic note. '.repeat(70);html=build(context,job,metadata,'EN');assert.ok(html.includes('See note 1'));assert.ok(html.includes('Note 1 Training certificate'));assert.ok(html.includes('TRACK-SYNTHETIC'));
context.deliveryDocuments[job.id].application.commentEn='<script>alert(1)</script>';html=build(context,job,metadata,'EN');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!/<script|<img|<iframe|<form/i.test(html));
context.examSchedules[job.id].providerType='NON_PARTNER';context.examSchedules[job.id].providerDesignationNo='STALE-DESIGNATION';assert.ok(!build(context,job,metadata,'EN').includes('STALE-DESIGNATION'));
console.log('영문 문서전달 HTML: 12종 비고·해당없음/조건부·실제 날짜·발행/송부/수령 구분·Job/개인정보 범위·미번역 차단·불필요 번역 제외·삽입 방지 통과');
