import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const require=createRequire(import.meta.url),runtime='C:/Users/N2411-S05/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const {chromium}=require(runtime+'/node/node_modules/playwright');
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>load(name.replace('@/lib/',''))});return exports;}
const {buildApplicationReviewHtml:build}=load('application-review-html'),dir='../output/application-review-html/qa';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const name of ['normal','long','missing']){
  const {context,job,metadata}=decisionReportSample({long:name==='long'});
  if(name==='missing'){context.reviewRequirements={};context.review={};context.candidate={};context.deliveryDocuments={};context.examSchedules={};}
  metadata.generatedAt='2026-11-21T03:00:00.000Z';
  const html=build(context,job,metadata);writeFileSync(`${dir}/${name}.html`,html);
  const page=await browser.newPage({viewport:{width:1100,height:1200}}),external=[];
  page.on('request',request=>external.push(request.url()));await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'가로 넘침 없음');
  await page.pdf({path:`${dir}/${name}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
  assert.equal(external.length,0);await page.screenshot({path:`${dir}/${name}-screen.png`,fullPage:true});await page.close();console.log(`${name}: PDF 출력 / 외부 요청 0`);
 }
}finally{await browser.close();}
