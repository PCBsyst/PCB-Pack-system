import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import {mkdirSync,openSync,writeFileSync,readFileSync} from 'node:fs';import assert from 'node:assert/strict';import PizZip from 'pizzip';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/N2411-S05/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
assert.ok(!process.env.NEXT_PUBLIC_SUPABASE_URL,'가상 전용 검사');const dir='../output/full-workflow/qa';mkdirSync(dir,{recursive:true});const log=openSync(`${dir}/server.log`,'w'),base='http://localhost:3007';
const server=spawn(process.execPath,['--no-experimental-strip-types','node_modules/next/dist/bin/next','dev','--webpack','--port','3007'],{stdio:['ignore',log,log],windowsHide:true,env:{...process.env,NODE_OPTIONS:`${process.env.NODE_OPTIONS??''} --no-experimental-strip-types`.trim()}});let browser,page,record,key,jobId;const steps=[],external=[];
const lines=['성명: 통합검증가상후보','영문명: SYNTHETIC WORKFLOW','생년월일: 1990-01-02','이메일: workflow@example.test','전화번호: 010-0000-0000','신청표준: ISO 45001','신청등급: 선임심사원','가상 종합 증빙 자료 / 실제 고객 자료 아님'];
const zip=new PizZip();zip.file('[Content_Types].xml','<Types/>');zip.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(t=>`<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);const file={name:'가상종합증빙.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:zip.generate({type:'nodebuffer',compression:'DEFLATE'})};
const fill=(name,value)=>page.getByLabel(name,{exact:true}).fill(value);
function savePackageSamples(archive,names){mkdirSync(`${dir}/documents`,{recursive:true});for(const name of names)writeFileSync(`${dir}/documents/${name.split('/').at(-1)}`,archive.file(name).asNodeBuffer());}
async function state(){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);}
async function stage(value){await page.waitForFunction(({key,value})=>JSON.parse(localStorage.getItem(key)||'null')?.stage===value,{key,value});steps.push(value);console.log(`통과: ${value}`);}
async function save(){await page.getByRole('button',{name:'현재 입력 저장',exact:true}).first().click();}
async function checkReviewPreview(){
 const card=page.locator('section').filter({has:page.getByText(/· 국문 신청서류 검토서$/)}).last();
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/documents/application-review-html'));
 await card.getByRole('button',{name:'HTML 미리보기 생성',exact:true}).click();
 const response=await responsePromise;assert.equal(response.status(),200);
 const handle=await card.locator('iframe').elementHandle(),reportFrame=await handle.contentFrame();
 await reportFrame.waitForSelector('h1');assert.ok((await reportFrame.locator('body').innerText()).includes('통합검증가상후보'));
 assert.equal(await card.locator('iframe').getAttribute('sandbox'),'allow-same-origin allow-modals');
 const downloadPromise=page.waitForEvent('download');await card.getByRole('button',{name:'HTML 다운로드',exact:true}).click();
 const download=await downloadPromise;await download.saveAs(`${dir}/review-preview.html`);
 assert.ok(readFileSync(`${dir}/review-preview.html`,'utf8').includes('가상검증자'));
 await reportFrame.evaluate(()=>{window.print=()=>{document.documentElement.dataset.printRequested='yes';};});
 await card.getByRole('button',{name:'인쇄·PDF로 저장',exact:true}).click();
 await reportFrame.waitForFunction(()=>document.documentElement.dataset.printRequested==='yes');
 assert.equal((await state()).stage,'PACKAGE_READY','HTML 검토·인쇄는 정식 패키지 완료를 변경하지 않음');
 await card.screenshot({path:`${dir}/review-preview.png`});
 await card.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
 assert.equal(await card.locator('iframe').count(),0);
 console.log('통과: 서류검토 HTML 미리보기·실제 다운로드·인쇄 호출·완료 상태 유지');
}
async function checkEnglishReviewPreview(){
 await page.getByRole('checkbox',{name:/^영문/}).first().check();
 await fill('서류검토 의견 (영문)','The synthetic application and evidence were reviewed.');
 await fill('검증 의견 (영문)','The synthetic review was verified.');
 const row=page.locator(`tr[id="delivery-${jobId}-education"]`);
 await row.locator('td').last().locator('input').first().fill('가상 수료증 비고');await save();
 const card=page.locator('section').filter({has:page.getByText(/· 영문 신청서류 검토서$/)}).last();
 let responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/documents/application-review-html'));
 await card.getByRole('button',{name:'HTML 미리보기 생성',exact:true}).click();assert.equal((await responsePromise).status(),422);
 await row.locator('summary').click();await row.getByLabel(/교육\s*수료증 비고 \(영문\)$/).fill('Synthetic training certificate checked.');await save();
 responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/documents/application-review-html'));
 await card.getByRole('button',{name:'HTML 미리보기 생성',exact:true}).click();assert.equal((await responsePromise).status(),200);
 const frame=await (await card.locator('iframe').elementHandle()).contentFrame();await frame.waitForSelector('h1');
 const body=await frame.locator('body').innerText();for(const text of ['Application Document Review','Requirement Evidence Appendix','Synthetic training certificate checked.'])assert.ok(body.includes(text));
 const downloadPromise=page.waitForEvent('download');await card.getByRole('button',{name:'HTML 다운로드',exact:true}).click();await (await downloadPromise).saveAs(`${dir}/review-preview-en.html`);
 await frame.evaluate(()=>{window.print=()=>document.documentElement.dataset.printRequested='yes';});await card.getByRole('button',{name:'인쇄·PDF로 저장',exact:true}).click();await frame.waitForFunction(()=>document.documentElement.dataset.printRequested==='yes');
 assert.equal((await state()).stage,'PACKAGE_READY');await card.screenshot({path:`${dir}/review-preview-en.png`});
 await row.getByLabel(/교육\s*수료증 비고 \(영문\)$/).fill('Updated synthetic note.');await card.locator('iframe').waitFor({state:'detached'});
 await save();await page.reload({waitUntil:'networkidle'});assert.equal((await state()).deliveryDocuments[jobId].education.commentEn,'Updated synthetic note.');
 await page.getByRole('checkbox',{name:/^영문/}).first().uncheck();
 console.log('통과: 영문 검토 HTML·비고 누락 차단·입력/저장·다운로드/인쇄 호출·변경 시 프레임 폐기·새로고침 유지');
}
async function checkCombinedPreview(){
 await page.getByText(/출력 전 기록 점검 · 확인 권장/).first().waitFor();
 const card=page.locator('section').filter({has:page.getByText(/· 국문 3종 통합 검토$/)}).last();
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/documents/html-package'));
 await card.getByRole('button',{name:'HTML 미리보기 생성',exact:true}).click();
 const response=await responsePromise;assert.equal(response.status(),200);
 const handle=await card.locator('iframe').elementHandle(),reportFrame=await handle.contentFrame();
 await reportFrame.waitForSelector('h1');assert.equal(await reportFrame.locator('article.bundle-document').count(),3);assert.ok((await reportFrame.locator('body').innerText()).includes('통합검증가상후보'));
 assert.equal(await card.locator('iframe').getAttribute('sandbox'),'allow-same-origin allow-modals');
 const downloadPromise=page.waitForEvent('download');await card.getByRole('button',{name:'HTML 다운로드',exact:true}).click();
 const download=await downloadPromise;await download.saveAs(`${dir}/combined-preview.html`);
 assert.ok(readFileSync(`${dir}/combined-preview.html`,'utf8').includes('가상검증자'));
 await reportFrame.evaluate(()=>{window.print=()=>{document.documentElement.dataset.printRequested='yes';};});
 await card.getByRole('button',{name:'인쇄·PDF로 저장',exact:true}).click();
 await reportFrame.waitForFunction(()=>document.documentElement.dataset.printRequested==='yes');
 assert.equal((await state()).stage,'PACKAGE_READY','HTML 검토·인쇄는 정식 패키지 완료를 변경하지 않음');
 await card.screenshot({path:`${dir}/combined-preview.png`});
 await card.getByRole('checkbox',{name:'인증결정보고서',exact:true}).uncheck();
 await page.waitForFunction(()=>!document.querySelector('iframe[title*="3종 통합 검토"]'));
 await card.getByRole('button',{name:'HTML 미리보기 생성',exact:true}).click();
 const selectedHandle=await card.locator('iframe').elementHandle(),selectedFrame=await selectedHandle.contentFrame();
 await selectedFrame.waitForSelector('article.bundle-document');assert.equal(await selectedFrame.locator('article.bundle-document').count(),2);
 const titles=await selectedFrame.locator('h1').allTextContents();assert.ok(!titles.includes('인증결정보고서'));assert.ok(titles.includes('신청서류 검토서'));assert.ok(titles.includes('문서전달확인서'));
 await card.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
 assert.equal(await card.locator('iframe').count(),0);
 console.log('통과: 통합 HTML 미리보기·실제 다운로드·인쇄 호출·완료 상태 유지');
}
async function checkDeliveryPreview(){
 const card=page.locator('section').filter({has:page.getByText(/· 국문 문서전달확인서$/)}).last();
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/documents/delivery-confirmation-html'));
 await card.getByRole('button',{name:'HTML 미리보기 생성',exact:true}).click();
 const response=await responsePromise;assert.equal(response.status(),200);
 const handle=await card.locator('iframe').elementHandle(),reportFrame=await handle.contentFrame();
 await reportFrame.waitForSelector('h1');assert.ok((await reportFrame.locator('body').innerText()).includes('통합검증가상후보'));
 assert.equal(await card.locator('iframe').getAttribute('sandbox'),'allow-same-origin allow-modals');
 const downloadPromise=page.waitForEvent('download');await card.getByRole('button',{name:'HTML 다운로드',exact:true}).click();
 const download=await downloadPromise;await download.saveAs(`${dir}/delivery-preview.html`);
 assert.ok(readFileSync(`${dir}/delivery-preview.html`,'utf8').includes('SYNTHETIC-TRACK-001'));
 await reportFrame.evaluate(()=>{window.print=()=>{document.documentElement.dataset.printRequested='yes';};});
 await card.getByRole('button',{name:'인쇄·PDF로 저장',exact:true}).click();
 await reportFrame.waitForFunction(()=>document.documentElement.dataset.printRequested==='yes');
 assert.equal((await state()).stage,'PACKAGE_READY','HTML 검토·인쇄는 정식 패키지 완료를 변경하지 않음');
 await card.screenshot({path:`${dir}/delivery-preview.png`});
 await card.getByRole('button',{name:'미리보기 닫기',exact:true}).click();
 assert.equal(await card.locator('iframe').count(),0);
 const bundleEvent=page.waitForEvent('download');await card.getByRole('button',{name:'국문 HTML 3종 ZIP',exact:true}).click();const bundle=await bundleEvent;await bundle.saveAs(`${dir}/html-bundle.zip`);const bundleZip=new PizZip(readFileSync(`${dir}/html-bundle.zip`));assert.equal(Object.keys(bundleZip.files).length,4);assert.equal((await state()).stage,'PACKAGE_READY');
 console.log('통과: 문서전달 HTML 미리보기·실제 다운로드·인쇄 호출·완료 상태 유지');
}
try{
 for(let i=0;i<60;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(3000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('dialog',async dialog=>{assert.match(dialog.message(),/양식|미등록|생성/);await dialog.accept();});page.on('request',r=>{if(!/^(localhost|127\.0\.0\.1)$/.test(new URL(r.url()).hostname))external.push(r.url());});
 await page.goto(`${base}/applications/new`,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>document.querySelector('input[aria-label="신청서 Word 파일"]')?.disabled===false);
 await page.getByLabel('공식 접수일',{exact:false}).fill('2026-11-02');const intake=page.getByRole('region',{name:'신청서 읽기와 입력 확인',exact:true});await intake.getByLabel('신청서 Word 파일',{exact:true}).setInputFiles(file);await intake.getByLabel('읽은 신청표준 확인',{exact:true}).waitFor();await intake.getByRole('checkbox',{name:'표준과 등급 원문 확인',exact:true}).check();await intake.getByRole('button',{name:'확인한 표준·등급 Job 추가',exact:true}).click();for(const name of ['후보자명','영문명','생년월일','이메일','전화번호'])await intake.getByRole('checkbox',{name:`${name} 원문 확인`,exact:true}).check();await intake.getByRole('button',{name:'확인한 항목만 신청 입력에 반영',exact:true}).click();await page.getByRole('button',{name:'번호 확정 및 신청 등록',exact:true}).click();await page.getByText(/신청과 Job 1건이 브라우저에 등록되었습니다/).waitFor();record=await page.evaluate(()=>JSON.parse(localStorage.getItem('certification-prototype-applications'))[0]);
 await page.goto(`${base}/applications/${record.id}?tab=review`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'증빙 대조·경력·심사이력 분석',exact:true}).waitFor();key=await page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('certification-demo:v4:')));assert.ok(key);jobId=Object.keys((await state()).certificates)[0];await stage('DOCUMENT_REVIEW');
 const evidence=page.locator('section').filter({has:page.getByRole('heading',{name:'증빙 대조·경력·심사이력 분석',exact:true})}).last();await evidence.getByLabel('증빙 Word 파일',{exact:true}).setInputFiles(file);await evidence.getByText('문서를 연결했습니다.',{exact:false}).waitFor();
 for(const requirement of ['교육요건','학력요건','업무경력요건','심사·실무경력요건']){const group=evidence.getByRole('group',{name:requirement,exact:true});await group.getByRole('checkbox',{name:`${requirement} 근거 가상종합증빙.docx`,exact:true}).check();await group.getByLabel(`${requirement} 확인 위치`,{exact:true}).fill('가상 종합 증빙 1쪽');await group.getByLabel(`${requirement} 검토 메모`,{exact:true}).fill(`${requirement} 가상 근거 대조 완료`);await group.getByRole('checkbox',{name:`${requirement} 근거 대조 완료`,exact:true}).check();
 await group.locator('summary').filter({hasText:'영문 근거 입력'}).click();
 await group.getByLabel(`${requirement} 확인 위치 (영문)`,{exact:true}).fill('Page 1 synthetic evidence');
 await group.getByLabel(`${requirement} 검토 메모 (영문)`,{exact:true}).fill('The synthetic evidence was compared with the requirements.');
 const englishCheck=group.getByRole('checkbox',{name:`${requirement} 영문 근거 확인`,exact:true});await englishCheck.check();
 await group.getByLabel(`${requirement} 검토 메모`,{exact:true}).fill(`${requirement} 가상 근거 수정 완료`);assert.equal(await englishCheck.isChecked(),false);
 await group.getByRole('checkbox',{name:`${requirement} 근거 대조 완료`,exact:true}).check();await englishCheck.check();}
 await save();await page.reload({waitUntil:'networkidle'});assert.equal((await state()).evidenceReview.links.filter(link=>link.english?.confirmed).length,4);console.log('통과: 영문 근거 입력·원문 변경 확인 해제·저장/새로고침 유지');
 await page.getByRole('link',{name:'신청 개요',exact:true}).click();await fill('교육기관명','완전가상 교육기관');await fill('교육 종료일','2026-10-16');await page.getByRole('link',{name:'서류검토',exact:true}).click();await fill('검토자','가상검토자');await fill('검토일','2026-11-03');await fill('검증인','가상검증자');await fill('검증일','2026-11-04');await fill('검토의견','완전 가상 증빙과 기본정보 대조');await fill('검증의견','가상 2차 검증 완료');await page.getByRole('button',{name:'검토·검증 완료',exact:true}).click();await stage('INVOICE_PENDING');
 await fill('인보이스 번호','SYNTHETIC-INV-001');await fill('수신자','통합검증가상후보');await fill('청구금액','100000');await fill('인보이스 발행일','2026-11-05');await page.getByRole('button',{name:'인보이스 발행 기록',exact:true}).click();await stage('PAYMENT_PENDING');await fill('입금액','50000');await fill('입금자','가상입금자');await fill('실제 입금일','2026-11-06');await fill('입금 확인 담당자','가상담당자');await page.getByRole('button',{name:'전액 입금 확인',exact:true}).click();assert.equal((await state()).stage,'PAYMENT_PENDING');await fill('입금액','100000');await page.getByRole('button',{name:'전액 입금 확인',exact:true}).click();await stage('DECISION_PENDING');
 for(const radio of await page.getByRole('radio',{name:'적합',exact:true}).all())await radio.check();await fill('패널 심의일','2026-11-12');await fill('최종 승인자','가상대표자');await fill('최종 승인일','2026-11-17');await page.getByRole('checkbox',{name:'박심의',exact:true}).check();await page.getByLabel('개별 결정',{exact:true}).nth(0).selectOption('승인');const approval=page.locator('section').filter({has:page.getByRole('heading',{name:'3. 대표자 최종 승인',exact:true})}).last();await approval.locator('tbody select').selectOption('승인');await approval.locator('tbody input').fill('가상 최종 승인 확인');await page.getByRole('button',{name:'최종 승인 및 보고서 준비',exact:true}).click();await page.getByText('활성 심의위원 중 최소 2명을 선택해 주세요.',{exact:true}).waitFor();assert.equal((await state()).stage,'DECISION_PENDING');await page.getByRole('checkbox',{name:'이위원',exact:true}).check();await page.getByLabel('개별 결정',{exact:true}).nth(1).selectOption('승인');await page.getByLabel('위원 의견',{exact:true}).nth(0).fill('가상 위원 A 승인');await page.getByLabel('위원 의견',{exact:true}).nth(1).fill('가상 위원 B 승인');await fill('최종 승인자','');await page.getByRole('button',{name:'최종 승인 및 보고서 준비',exact:true}).click();await page.getByText('대표자, 최종 승인일과 모든 Job의 최종 승인 결과를 입력해 주세요.',{exact:true}).waitFor();await fill('최종 승인자','가상대표자');await page.getByRole('button',{name:'최종 승인 및 보고서 준비',exact:true}).click();await stage('CERTIFICATE_DRAFT_PENDING');
 await fill('초안 발행일','2026-11-18');await page.getByRole('button',{name:'초안 발행 기록',exact:true}).click();await stage('CERTIFICATION_INFO_PENDING');await fill('전자본 발행일','2026-11-19');await fill('인증번호','26440001');await fill('만료일','2029-11-19');await page.getByRole('button',{name:'전자본 PDF 발행 확정',exact:true}).click();await stage('ORIGINAL_DELIVERY_PENDING');await fill('원본 송부일','2026-11-20');await fill('운송장 번호','SYNTHETIC-TRACK-001');await page.getByRole('button',{name:'원본 송부 확인',exact:true}).click();await stage('PACKAGE_READY');
 const s=await state();assert.equal(s.certificates[jobId].issueDate,'2026-11-19');assert.equal(s.decisionDate,'2026-11-12');assert.equal(s.deliveryDocuments[jobId].deliveryConfirmation.date,'2026-11-20');
 for(const [name,label] of [['국문','KR'],['영문','EN']]){const control=page.getByRole('checkbox',{name:new RegExp(`^${name}`)});if(await control.count())await control.first().setChecked(label==='KR');}
 const decisionRow=page.locator(`tr[id="delivery-${jobId}-decisionReport"]`);await decisionRow.locator('input[type=checkbox]').check();await decisionRow.locator('input[type=date]').fill('2026-11-12');
 await save();await page.reload({waitUntil:'networkidle'});await page.getByRole('checkbox',{name:/^영문/}).first().uncheck();assert.equal((await state()).stage,'PACKAGE_READY');await checkReviewPreview();await checkDeliveryPreview();await checkCombinedPreview();await checkEnglishReviewPreview();const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/documents/package'));await page.getByRole('button',{name:'실제 DOCX ZIP 생성',exact:true}).click();const response=await responsePromise;assert.equal(response.status(),200);assert.equal(response.headers()['x-package-complete'],'true');assert.equal(response.headers()['x-package-file-count'],'3');const archive=new PizZip(await response.body());const names=Object.keys(archive.files).filter(n=>n.endsWith('.docx'));assert.equal(names.length,3);savePackageSamples(archive,names);const deliveryEntry=names.find(n=>n.endsWith('_Document_Delivery_Confirmation_KR.docx'));assert.ok(deliveryEntry);const deliveryBytes=archive.file(deliveryEntry).asUint8Array();const deliveryXml=new PizZip(deliveryBytes).file('word/document.xml').asText();for(const text of ['시험통보서','시험답안지','2026-10-19','2026-10-26','SYNTHETIC-TRACK-001','2026-11-20','검토 및 인증 처리 일정'])assert.ok(deliveryXml.includes(text),text);assert.ok(!deliveryXml.includes('{{'));writeFileSync('../output/delivery-confirmation/qa/delivery-packet.docx',Buffer.from(deliveryBytes));const xmls=names.map(n=>new PizZip(archive.file(n).asUint8Array()).file('word/document.xml').asText()).join('\n');for(const text of ['통합검증가상후보','ISO 45001','요건별 검토 근거','가상대표자','가상 위원 A 승인','가상 위원 B 승인','26440001'])assert.ok(xmls.includes(text),text);await page.waitForFunction(k=>Boolean(JSON.parse(localStorage.getItem(k)||'null')?.packageGeneration),key);await stage('COMPLETED');assert.equal((await state()).packageGeneration.complete,true);assert.equal(external.length,0);assert.doesNotMatch(readFileSync(dir+'/server.log','utf8'),/CLIENT_HOOK_DYNAMIC|Next[.]js encountered runtime data/);await page.screenshot({path:`${dir}/package-result.png`,fullPage:true});writeFileSync(`${dir}/result.json`,JSON.stringify({passed:true,steps,files:names,complete:true,limitations:['운영 DB·MFA·권한 검증 별도','검토서·심의보고서 Word/PDF 페이지 배치 별도'],externalRequests:external.length},null,2));console.log('통합 검증 통과: 신규 신청→근거 검토→청구/입금→2명 심의/대표자 승인→초안/발행/송부→국문 패키지 3종 및 완료 상태 확인');
}catch(e){if(page){await page.screenshot({path:`${dir}/failure.png`,fullPage:true}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-6500));}throw e;}finally{await browser?.close();server.kill();}
