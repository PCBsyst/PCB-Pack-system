import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';import PizZip from 'pizzip';import {decisionReportSample} from './fixtures/decision-report.mjs';
const require=createRequire(import.meta.url),dir='../output/english-decision/qa';mkdirSync(dir,{recursive:true});
for(const kind of ['normal','long']){
 const {context,job}=decisionReportSample();
 if(kind==='long'){context.englishText.reviewComment=Array.from({length:35},(_,i)=>`${i+1}. Synthetic review note. The submitted records were checked against the requested certification scope and grade.`).join('\n');context.englishText.panelComments[context.panelMembers[0].name]+=' Additional synthetic panel review evidence was checked.'.repeat(40);}
 const cache={},overrides={
 '@/lib/server/api-auth':{requireApiStaff:async()=>null},'@/lib/server/privacy-access':{recordDocumentResponse:async()=>null},
 '@/lib/server/document-request-validation':{readValidatedDocumentRequest:async()=>({ok:true,input:{context,job,language:'EN'}})},
 '@/lib/server/document-template-loader':{loadDocumentTemplate:async(type,language,fallback)=>{assert.equal(language,'EN');assert.equal(fallback,'FGPC-012-01-decision-report-en.docx');return {bytes:readFileSync('templates/'+fallback),source:'BUILT_IN',version:'System English v1',sha256:'a'.repeat(64)};},templateLoadErrorResponse:()=>new Response(null,{status:503})}};
 function load(name){if(name==="server-only")return {};if(overrides[name])return overrides[name];if(!name.startsWith('@/'))return require(name);if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(name.slice(2)+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:load,Response,Request,Headers,TextEncoder,crypto:globalThis.crypto});return exports;}
 const response=await load('@/app/api/documents/decision-report/route').POST(new Request('http://localhost/test',{method:'POST'}));assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer()),xml=new PizZip(bytes).file('word/document.xml').asText();
 for(const text of ['Certification Decision Report','Knowledge examination','Final Approver','Sample Candidate','26130099','I confirm the decision of the two panel members'])assert.ok(xml.includes(text),text);
 assert.ok(!xml.includes('{{'));assert.ok(!xml.includes(context.review.comment));writeFileSync(`${dir}/${kind}.docx`,bytes);
 context.englishText.reviewComment='';const denied=await load('@/app/api/documents/decision-report/route').POST(new Request('http://localhost/test',{method:'POST'}));assert.equal(denied.status,422);
 console.log(kind+': actual route / English template / English comments verified');
}
