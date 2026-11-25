import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {decisionReportSample} from './fixtures/decision-report.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/N2411-S05/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
function loader(old=false){const cache={};return function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const source=old&&name==='application-review-html'?execFileSync('git',['show','58219d6:lib/application-review-html.ts'],{encoding:'utf8'}):readFileSync('lib/'+name+'.ts','utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:p=>load(p.replace('@/lib/',''))});return exports;};}
const build=loader()('application-review-html').buildApplicationReviewHtml;
const oldBuild=loader(true)('application-review-html').buildApplicationReviewHtml;
const directory='../output/application-review-html-en/qa';mkdirSync(directory,{recursive:true});
const baseline=decisionReportSample();assert.equal(build(baseline.context,baseline.job,baseline.metadata),oldBuild(baseline.context,baseline.job,baseline.metadata));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const kind of (process.argv.length>2?process.argv.slice(2):['normal','long','missing'])){
 const {context,job,metadata}=decisionReportSample();metadata.generatedAt='2026-11-25T03:00:00.000Z';
 context.deliveryDocuments[job.id]={education:{applicability:'REQUIRED',received:true,date:'2026-11-02',comment:'국문 비고',commentEn:kind==='long'?'Synthetic source note. '.repeat(70):'Training certificate checked.'}};
 context.evidenceReview={version:1,documents:[{id:'d1',kind:'교육수료증',fileName:'synthetic-evidence.pdf',sha256:'',reference:'1쪽',fields:{name:context.candidate.name}}],careers:[],audits:[],links:[{requirement:'교육요건',documentIds:['d1'],reference:'수료일 위치',note:'국문 대조 메모',result:'충족',confirmed:true,english:{reference:'Page 1 completion date',note:'The source was checked against the requirements.',confirmed:true,result:'충족'}}]};
 if(kind==='long'){context.englishText.reviewComment=Array.from({length:35},(_,i)=>`${i+1}. Synthetic review finding. The evidence and requested certification requirements were checked.`).join('\n');}
 if(kind==='missing'){context.reviewRequirements={};context.review={};context.englishText={};context.candidate={};context.deliveryDocuments={};context.examSchedules={};delete context.evidenceReview;}
 const html=build(context,job,metadata,'EN');writeFileSync(`${directory}/${kind}.html`,html);
 const page=await browser.newPage({viewport:{width:1100,height:1200}}),external=[];page.on('request',r=>external.push(r.url()));await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(external.length,0);
 await page.pdf({path:`${directory}/${kind}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});await page.screenshot({path:`${directory}/${kind}-screen.png`,fullPage:true});await page.close();console.log(`${kind}: English PDF / external requests 0`);
}}finally{await browser.close();}
console.log('국문 HTML은 이전 커밋과 문자열 동일');
