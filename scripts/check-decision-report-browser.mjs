import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {openSync} from 'node:fs';
assert.ok(!process.env.NEXT_PUBLIC_SUPABASE_URL,'가상 데이터 전용 검사입니다.');
const serverLog=openSync('../output/decision-report/qa/browser-server.log','w');
const server=spawn(process.execPath,['--no-experimental-strip-types','node_modules/next/dist/bin/next','dev','--webpack','--port','3003'],{stdio:['ignore',serverLog,serverLog],windowsHide:true,env:{...process.env,NODE_OPTIONS:`${process.env.NODE_OPTIONS??''} --no-experimental-strip-types`.trim()}});
for(let attempt=0;attempt<60;attempt++){try{const r=await fetch('http://localhost:3003/');if(r.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/N2411-S05/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://localhost:3003/applications/app-003?tab=package',{waitUntil:'networkidle',timeout:120000});
 const button=page.getByRole('button',{name:'HTML 미리보기 생성'}).first();
 await button.waitFor({timeout:30000});
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/documents/decision-report-html'));
 await button.click();
 const response=await responsePromise;
 assert.equal(response.status(),200,await response.text());
 const frameLocator=page.locator('iframe[title*="인증결정보고서 디자인 검토본"]').first();
 await frameLocator.waitFor();
 assert.equal(await frameLocator.getAttribute('sandbox'),'allow-same-origin allow-modals');
 const frame=await frameLocator.contentFrame();
 await frame.getByRole('heading',{name:'인증결정보고서',exact:true}).waitFor();
 assert.equal(await frame.locator('script').count(),0);
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'HTML 다운로드',exact:true}).first().click();
 const download=await downloaded;
 assert.match(download.suggestedFilename(),/_Decision_Review_KR\.html$/);
 await page.getByRole('button',{name:'인쇄·PDF로 저장',exact:true}).first().waitFor({state:'visible'});
 assert.equal(await page.getByRole('button',{name:'인쇄·PDF로 저장',exact:true}).first().isEnabled(),true);
 await page.evaluate(()=>{window.reportPrinted=false;const target=document.querySelector('iframe[title*="인증결정보고서 디자인 검토본"]');target.contentWindow.print=()=>{window.reportPrinted=true;};});
 await page.getByRole('button',{name:'인쇄·PDF로 저장',exact:true}).first().click();
 await page.waitForFunction(()=>window.reportPrinted===true);
 await page.getByRole('button',{name:'미리보기 닫기',exact:true}).first().click();
 assert.equal(await page.locator('iframe[title*="인증결정보고서 디자인 검토본"]').count(),0);
 console.log('로컬 가상 데이터 브라우저: API 생성·격리 프레임·HTML 다운로드·인쇄 호출·닫기 통과 (실제 PDF 저장은 별도 렌더 검증)');
} finally {await browser.close();server.kill();}
