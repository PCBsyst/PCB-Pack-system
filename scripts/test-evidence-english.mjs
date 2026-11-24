import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const cache={};
function load(name){
 if(cache[name])return cache[name];const exports={};cache[name]=exports;
 vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,require:p=>load(p.replace('@/lib/','')),Date,JSON,Error,Object,Set,Map});return exports;
}
const {readEvidenceReview:read,evidenceEnglishIssues:issues,reviseEvidenceLink:revise}=load('evidence-review');
const {documentTranslationIssues:preflight}=load('document-translation-checks');
const {documentEvidenceSummary:summary}=load('document-evidence-summary');
const {matchesPackageWorkspace:match}=load('package-workspace-matching');
const {context}=decisionReportSample();
const row={requirement:'교육요건',documentIds:['d1'],reference:'수료일 1쪽',note:'가상 국문 확인 메모',confirmed:true,result:'충족',
 english:{reference:'Page 1 completion date',note:'Training evidence was compared with the requirements.',confirmed:true,result:'충족'}};
context.evidenceReview={version:1,documents:[{id:'d1',kind:'교육수료증',fileName:'가상수료증.pdf',sha256:'',reference:'1쪽',fields:{name:context.candidate.name,email:'not-in-appendix@example.test'}},
 {id:'unlinked',kind:'신청서',fileName:'UNLINKED-DO-NOT-OUTPUT',sha256:'',reference:'',fields:{}}],careers:[],audits:[],links:[row]};
assert.ok(read(context.evidenceReview));assert.ok(read(JSON.parse(JSON.stringify(context.evidenceReview))));
assert.equal(preflight(context,[],['APPLICATION_REVIEW']).length,0);
const en=summary(context,'EN');for(const text of ['Requirement Evidence Appendix','Page 1 completion date','Training evidence was compared','Training certificate · 가상수료증.pdf','Evidence comparison: Confirmed','Academic requirements','Evidence link not recorded'])assert.ok(en.includes(text),text);
for(const text of ['가상 국문 확인 메모','수료일 1쪽','not-in-appendix@example.test','UNLINKED-DO-NOT-OUTPUT'])assert.ok(!en.includes(text),text);
assert.ok(summary(context).includes(row.note));
for(const patch of [{reference:'다른 쪽'},{note:'변경된 원문 메모'},{documentIds:[]},{result:'미충족'}]){
 const changed=revise(row,patch);assert.equal(changed.english.confirmed,false);assert.equal(changed.english.note,row.english.note);
 assert.ok(issues(changed,'충족').length>0);assert.equal(row.english.confirmed,true);
}
for(const english of [{...row.english,note:''},{...row.english,reference:''},{...row.english,confirmed:false},{...row.english,result:'미충족'}]){
 context.evidenceReview.links=[{...row,english}];assert.ok(preflight(context,[],['APPLICATION_REVIEW']).length>0);assert.throws(()=>summary(context,'EN'));
}
context.evidenceReview.links=[row];context.reviewRequirements.교육요건='미충족';assert.ok(issues(row,'미충족').length);context.reviewRequirements.교육요건='충족';
const state=structuredClone(context);state.evidenceReview.links[0].english.note='Changed counterpart';assert.equal(match(context,context.jobs.map(j=>j.id),state),false);
for(const english of [{...row.english,note:'x'.repeat(501)},{...row.english,reference:'bad\nvalue'},{...row.english,confirmed:'true'},{...row.english,rawText:'forbidden'}])assert.equal(read({...context.evidenceReview,links:[{...row,english}]}),null);
const legacy={...context.evidenceReview,links:[{...row}]};delete legacy.links[0].english;assert.ok(read(legacy));
console.log('영문 증빙 근거: 이전 기록 호환·엄격 수신·누락/확인/결과 변경 차단·원문 수정 시 확인 해제·번역 유지·국영문 분리·개인정보 최소화·저장 대조 통과');
