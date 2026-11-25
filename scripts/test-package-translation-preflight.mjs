import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {decisionReportSample} from './fixtures/decision-report.mjs';
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const build=load('document-output-readiness').documentOutputReadiness,rows=load('template-readiness').templateReadiness(new Set()),{context,job}=decisionReportSample();
let matrix=build(rows,context,[job],{KR:true,EN:true});assert.equal(matrix.length,6);let en=matrix.find(r=>r.id==='decision-report-en');assert.ok(!en.issues.includes('정식 DOCX 양식 미등록'));assert.equal(en.htmlSupported,true);assert.equal(matrix.find(r=>r.id==='delivery-confirmation-en').htmlSupported,false);
assert.ok(!matrix.find(r=>r.id==='application-review-en').issues.includes('정식 DOCX 양식 미등록'));
assert.equal(matrix.find(r=>r.id==='application-review-en').htmlSupported,true);
const missingRows=rows.map(row=>row.id==='application-review-en'?{...row,source:'MISSING'}:row);
assert.ok(build(missingRows,context,[job],{KR:false,EN:true}).find(r=>r.id==='application-review-en').issues.includes('정식 DOCX 양식 미등록'));
context.englishText.reviewComment='';matrix=build(rows,context,[job],{KR:false,EN:true});assert.ok(matrix.find(r=>r.id==='decision-report-en').translationIssues.includes('서류검토 의견 (영문)'));assert.equal(matrix.length,3);
assert.ok(build(null,context,[job],{KR:true,EN:false}).every(r=>r.issues.includes('양식 조회 미확인')));assert.equal(build(rows,context,[],{KR:true,EN:true}).length,0);assert.equal(build(rows,context,[job],{KR:false,EN:false}).length,0);
const active=load('template-readiness').templateReadiness(new Set(['CERTIFICATION_DECISION_REPORT:EN']));assert.equal(build(active,context,[job],{KR:false,EN:true}).find(r=>r.id==='decision-report-en').source,'DATABASE');
const source=readFileSync('components/application-detail.tsx','utf8');assert.ok(source.indexOf('<PackageTemplateReadiness languages=')<source.indexOf('label={`${job.jobNo} · 국문 초안 DOCX`}'));assert.ok(!source.includes('<PackageTranslationPreflight '));
console.log('통합 출력 준비표: 실파일 조회 미확인·DB 우선·양식 미등록/번역 누락 분리·HTML 독립 지원·언어/Job 범위 통과');
