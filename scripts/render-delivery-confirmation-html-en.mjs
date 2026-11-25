import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/N2411-S05/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
function loader(old=false){const cache={};return function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const source=old&&name==='delivery-confirmation-html'?execFileSync('git',['show','44648a1:lib/delivery-confirmation-html.ts'],{encoding:'utf8'}):readFileSync('lib/'+name+'.ts','utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>load(p.replace('@/lib/',''))});return exports;};}
const load=loader(),build=load('delivery-confirmation-html').buildDeliveryConfirmationHtml,oldBuild=loader(true)('delivery-confirmation-html').buildDeliveryConfirmationHtml;
const rows=load('delivery-confirmation-localization').deliveryConfirmationDocumentRows;
const directory='../output/delivery-confirmation-html-en/qa';mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const kind of ['normal','long','missing']){
 const {context,job,metadata}=decisionReportSample();metadata.generatedAt='2026-11-25T03:00:00.000Z';
 context.deliveryDocuments[job.id]=Object.fromEntries(rows.map(([key])=>[key,{applicability:'REQUIRED',received:true,date:'2026-11-20',comment:`가상 ${key} 기록`,commentEn:`Synthetic ${key} record`}]));
 context.deliveryDocuments[job.id].auditLog.applicability='NOT_APPLICABLE';context.deliveryDocuments[job.id].career.applicability='CONDITIONAL';
 context.certificates[job.id].originalSentAt='2026-11-23';context.certificates[job.id].trackingNumber='SYNTHETIC-TRACK-001';
 if(kind==='long'){context.deliveryDocuments[job.id].education.commentEn=Array.from({length:24},(_,i)=>`${i+1}. Synthetic dispatch note. The stored document and date were checked.`).join('\n');assert.ok(context.deliveryDocuments[job.id].education.commentEn.length<=2000);}
 if(kind==='missing'){context.review={};context.candidate={};context.deliveryDocuments={};context.examSchedules={};context.certificates={};}
 assert.equal(build(context,job,metadata),oldBuild(context,job,metadata),'국문 HTML 문자열 보존');
 const html=build(context,job,metadata,'EN');writeFileSync(`${directory}/${kind}.html`,html);
 const page=await browser.newPage({viewport:{width:1100,height:1200}}),external=[];page.on('request',r=>external.push(r.url()));await page.setContent(html);await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(external.length,0);
 await page.pdf({path:`${directory}/${kind}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});await page.screenshot({path:`${directory}/${kind}-screen.png`,fullPage:true});await page.close();console.log(`${kind}: English delivery PDF / external requests 0`);
}}finally{await browser.close();}
console.log('국문 일반·장문·미입력 HTML은 이전 커밋과 문자열 동일');
