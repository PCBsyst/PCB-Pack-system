import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/combined-html-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const build=exports.combineReviewHtml,names=['Application_Review_KR.html','Decision_Review_KR.html','Delivery_Confirmation_KR.html'];
const docs=names.map((name,i)=>({name,html:`<!doctype html><html><head><style>h1{color:black}</style></head><body><main><h1>문서 ${i}</h1><p>가상 내용 ${i}</p></main></body></html>`}));
const html=build([...docs].reverse());assert.ok(html.indexOf('문서 0')<html.indexOf('문서 1'));assert.ok(html.indexOf('문서 1')<html.indexOf('문서 2'));assert.match(html,/break-before:page/);assert.match(html,/counter\(pages\)/);assert.equal((html.match(/class="bundle-document"/g)||[]).length,3);
assert.throws(()=>build(docs.slice(1)));assert.throws(()=>build([docs[0],docs[0],docs[2]]));for(const bad of ['<script>alert(1)</script>','<iframe></iframe>','<form></form>','<img onerror="alert(1)">'])assert.throws(()=>build([{...docs[0],html:docs[0].html.replace('</main>',bad+'</main>')},...docs.slice(1)]));
console.log('통합 HTML: 3종 순서·문서별 페이지 나눔·전체 쪽수·누락/중복/능동 콘텐츠 차단 통과');
