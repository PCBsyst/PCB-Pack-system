import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash,webcrypto} from 'node:crypto';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const require=createRequire(import.meta.url);
function loader(overrides={}){const modules={};return function load(path){if(overrides[path])return overrides[path];if(!path.startsWith('@/'))return require(path);if(modules[path])return modules[path];const exports={};modules[path]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(path.slice(2)+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:load,Response,Request,Headers,TextEncoder,crypto:webcrypto});return exports;};}
function route(options={}){
 const calls=[];const load=loader({'@/lib/server/api-auth':{requireApiStaff:async(features)=>{calls.push('auth');assert.deepEqual(Array.from(features),['DOCUMENT_GENERATION','PACKAGE_DOWNLOAD']);return options.denied?Response.json({error:'로그인 필요'},{status:401}):null;}},'@/lib/server/document-request-validation':{readValidatedDocumentRequest:async(request)=>{calls.push('records');if(options.stale)return {ok:false,response:Response.json({error:'저장 기록 불일치'},{status:409})};const value=await request.json();return {ok:true,input:{...value,language:value.language??'KR'}};}},'@/lib/server/privacy-access':{recordDocumentResponse:async(type,id,detail)=>{calls.push('audit');assert.equal(type,'job');assert.ok(!detail.includes('통합테스트'));if(options.throw)throw Error('private');return options.auditFail?Response.json({error:'접근이력 실패'},{status:503}):null;}},'@/lib/supabase/auth-environment':{currentAuthEnvironment:()=>({localPrototype:true})}});
 return {calls,post:load('@/app/api/documents/html-package/route').POST};
}

const sample=decisionReportSample(),request=(language='KR')=>new Request('https://example.test/api/documents/html-package',{method:'POST',body:JSON.stringify({...sample,language})});
let r=route(),response=await r.post(request());assert.equal(response.status,200);assert.equal(r.calls.join(','),'auth,records,audit');const bytes=await response.arrayBuffer();
const PizZip=require('pizzip'),zip=new PizZip(bytes);assert.equal(Object.keys(zip.files).length,4);assert.equal(JSON.parse(zip.file('manifest.json').asText()).documents.length,3);assert.match(response.headers.get('Cache-Control'),/no-store/);
for(const [options,status]of [[{denied:true},401],[{stale:true},409],[{auditFail:true},503],[{throw:true},503]]){r=route(options);assert.equal((await r.post(request())).status,status);}
r=route();assert.equal((await r.post(request('EN'))).status,422);
let nextResponse;const cache={};function loadDownload(path){if(!path.startsWith('@/'))return require(path);if(cache[path])return cache[path];const exports={};cache[path]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(path.slice(2)+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:loadDownload,crypto:webcrypto,Blob,fetch:async()=>nextResponse});return exports;}
const fetchZip=loadDownload('@/lib/html-package-download').fetchHtmlPackage;r=route();nextResponse=await r.post(request());assert.ok((await fetchZip(sample.context,sample.job)).fileName.endsWith('.zip'));
r=route();response=await r.post(request());const headers=Object.fromEntries(response.headers);headers['x-html-package-sha256']='a'.repeat(64);nextResponse=new Response(await response.arrayBuffer(),{headers});await assert.rejects(()=>fetchZip(sample.context,sample.job));
console.log('HTML 3종 ZIP: 권한·저장 대조·감사 실패 차단·구성/해시·국문 한정·변조 응답 차단 통과 (DB/인증 모의)');
