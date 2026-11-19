import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const require=createRequire(import.meta.url),runtime='C:/Users/N2411-S05/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const {chromium}=require(runtime+'/node/node_modules/playwright');
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:name=>load(name.replace('@/lib/',''))});return exports;}
const {buildDecisionReportHtml:build}=load('decision-report-html');
const output=path.resolve('../output/decision-report'),qa=path.join(output,'qa');mkdirSync(qa,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const results=[];
 for(const [name,language,long] of [['decision-report-sample-KR','KR',false],['decision-report-sample-EN','EN',false],['decision-report-long-KR','KR',true]]){
  const fixture=decisionReportSample({long}),html=build(fixture.context,fixture.job,language,fixture.metadata);const folder=long?qa:output;
  writeFileSync(path.join(folder,name+'.html'),html);
  const page=await browser.newPage({viewport:{width:1100,height:1200}});const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.pdf({path:path.join(folder,name+'.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  assert.equal(requests.length,0);
  const raster=path.join(qa,name);execFileSync(runtime+'/native/poppler/Library/bin/pdftoppm.exe',['-r','100','-png',path.join(folder,name+'.pdf'),raster]);
  const info=execFileSync(runtime+'/native/poppler/Library/bin/pdfinfo.exe',[path.join(folder,name+'.pdf')],{encoding:'utf8'});results.push({name,pages:Number(info.match(/Pages:\s+(\d+)/)?.[1]),externalRequests:requests.length});await page.close();
 }
 writeFileSync(path.join(qa,'render-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
