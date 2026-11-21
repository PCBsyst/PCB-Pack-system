import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const require=createRequire(import.meta.url),runtime='C:/Users/N2411-S05/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const {chromium}=require(runtime+'/node/node_modules/playwright');
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>load(name.replace('@/lib/',''))});return exports;}
const {buildDeliveryConfirmationHtml:build}=load('delivery-confirmation-html'),dir='../output/delivery-confirmation-html/qa';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const name of ['normal','long','missing']){
  const {context,job,metadata}=decisionReportSample({long:name==='long'});
  const keys=['application','career','education','diploma','auditLog','agreement','examNotice','examAnswers','decisionReport','certificate','survey','deliveryConfirmation'];
  context.deliveryDocuments[job.id]=Object.fromEntries(keys.map(key=>[key,{applicability:'REQUIRED',received:true,date:'2026-11-20',comment:'가상 '+key+' 기록'}]));
  context.deliveryDocuments[job.id].auditLog.applicability='NOT_APPLICABLE';
  context.certificates[job.id].originalSentAt='2026-11-23';context.certificates[job.id].trackingNumber='SYNTHETIC-TRACK-001';
  if(name==='long')context.deliveryDocuments[job.id].education.comment=Array.from({length:32},(_,i)=>`${i+1}. 장문 비고 검증입니다. 기록된 자료와 날짜를 대조했습니다.`).join('\n');
  if(name==='missing'){context.reviewRequirements={};context.review={};context.candidate={};context.deliveryDocuments={};context.examSchedules={};context.certificates={};}
  metadata.generatedAt='2026-11-21T03:00:00.000Z';
  const html=build(context,job,metadata);writeFileSync(`${dir}/${name}.html`,html);
  const page=await browser.newPage({viewport:{width:1100,height:1200}}),external=[];
  page.on('request',request=>external.push(request.url()));await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'가로 넘침 없음');
  await page.pdf({path:`${dir}/${name}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
  assert.equal(external.length,0);await page.screenshot({path:`${dir}/${name}-screen.png`,fullPage:true});await page.close();console.log(`${name}: PDF 출력 / 외부 요청 0`);
 }
}finally{await browser.close();}
