import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {newStaffTestReport,isStaffTestReport,cleanStaffTestReport,staffTestReportIssues,mergeStaffTestReports,summarizeStaffTests,staffTestCases,staffTestStorageKey}=await import(`data:text/javascript;base64,${Buffer.from(compile(read('lib/staff-test-checklist.ts'))).toString('base64')}`);
const original=newStaffTestReport('12345678-1234-1234-1234-123456789abc','SHARED','2026-10-05T00:00:00Z');
assert.equal(isStaffTestReport(original),true);assert.equal(original.results.length,16);assert.ok(original.results.every(item=>item.status==='NOT_RUN'));
assert.deepEqual(summarizeStaffTests([original]),{NOT_RUN:16,PASS:0,FAIL:0,BLOCKED:0});
for(const invalid of [null,{}, {...original,schemaVersion:2},{...original,runId:'bad'},{...original,environment:'private'}, {...original,reviewer:'a'.repeat(81)},{...original,updatedAt:'invalid'},{...original,results:original.results.slice(1)},{...original,results:original.results.map(()=>original.results[0])},{...original,results:original.results.map(item=>({...item,status:'__proto__'}))},{...original,results:original.results.map(item=>({...item,note:'a'.repeat(1501)}))}])assert.equal(isStaffTestReport(invalid),false);
const failing=structuredClone(original);failing.results[0].status='FAIL';assert.equal(staffTestReportIssues(failing).length,1);failing.results[0].note='샘플 T-01: 새로고침 후 결과가 사라짐';assert.equal(staffTestReportIssues(failing).length,0);
assert.deepEqual(cleanStaffTestReport({...original,privateKey:'never export',results:original.results.map(item=>({...item,hidden:'remove'}))}),original);
const newer={...failing,updatedAt:'2026-10-05T01:00:00Z'};
assert.deepEqual(mergeStaffTestReports([newer],[original]),[newer]);assert.deepEqual(mergeStaffTestReports([original],[newer]),[newer]);assert.deepEqual(mergeStaffTestReports([original],[original]),[original]);
assert.equal(original.results[0].status,'NOT_RUN');
// Execute actual UI save/import handlers. Browser storage/file IO are mocked.
const source=read('components/staff-test-checklist.tsx');
const ast=ts.createSourceFile('ui.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const handlers={};
function visit(node){if(ts.isVariableDeclaration(node)&&['save','collect','download'].includes(node.name.getText(ast)))handlers[node.name.getText(ast)]=node.initializer.getText(ast);ts.forEachChild(node,visit);}visit(ast);
function run(options={}){
 const report=options.report??original;const current=JSON.stringify({report,collected:[]});const state={notice:'',saved:'',writes:0,collected:[],downloads:0};
 const deps={report,blocked:false,current,staffTestReportIssues,staffTestStorageKey,rawRef:{current:null},importBusy:{current:false},mounted:{current:options.mounted??true},isStaffTestReport,cleanStaffTestReport,mergeStaffTestReports,
 setNotice:value=>state.notice=value,setSaved:value=>state.saved=value,setCollected:fn=>state.collected=fn(state.collected),
 window:{localStorage:{getItem:()=>options.conflict?'other record':null,setItem:()=>{state.writes++;if(options.quota)throw Error('quota');}},confirm:()=>!options.cancel,setTimeout:fn=>fn()},
 Blob:globalThis.Blob,URL:{createObjectURL:()=> 'blob:sample',revokeObjectURL:()=>{}},document:{createElement:()=>({click:()=>state.downloads++,remove:()=>{}}),body:{appendChild:()=>{}}}};
 const functions=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps; ${compile(Object.entries(handlers).map(([name,value])=>`const ${name}=${value};`).join('\n'))} return {save,collect,download};`)(deps);
 return {state,...functions};
}
const success=run();success.save();assert.equal(success.state.writes,1);assert.ok(success.state.saved);assert.match(success.state.notice,/자동 공유되지는/);
const quota=run({quota:true});quota.save();assert.equal(quota.state.saved,'');assert.match(quota.state.notice,/저장하지 못/);
const conflict=run({conflict:true});conflict.save();assert.equal(conflict.state.writes,0);assert.match(conflict.state.notice,/다른 탭/);
const missingReason=structuredClone(original);missingReason.results[0].status='BLOCKED';const invalid=run({report:missingReason});invalid.save();invalid.download();assert.equal(invalid.state.writes,0);assert.equal(invalid.state.downloads,0);
const download=run();download.download();assert.equal(download.state.downloads,1);assert.match(download.state.notice,/실제 파일 저장/);
const canceled=run({cancel:true});canceled.download();assert.equal(canceled.state.downloads,0);
const file=value=>({size:100,text:async()=>JSON.stringify(value)});
const imported=run();await imported.collect([file(original),file(newer)]);assert.equal(imported.state.collected.length,1);assert.deepEqual(imported.state.collected[0],newer);
const badBatch=run();await badBatch.collect([file(original),file({bad:true})]);assert.equal(badBatch.state.collected.length,0);assert.match(badBatch.state.notice,/입력 전체/);
const oversized=run();await oversized.collect([{size:100001,text:async()=>JSON.stringify(original)}]);assert.equal(oversized.state.collected.length,0);
const unmounted=run({mounted:false});await unmounted.collect([file(original)]);assert.equal(unmounted.state.collected.length,0);
assert.match(source,/shouldConfirmLink/);assert.match(source,/beforeunload/);assert.match(read('lib/app-navigation.ts'),/href: "\/testing"/);
assert.ok(staffTestCases.every(item=>item.href.startsWith('/')));
assert.doesNotMatch(read('lib/staff-test-checklist.ts')+source,/[\u3040-\u30ff]/);
console.log('실무 점검표: 16개 미실행 기본값·문제 사유·JSON 검증/정제·최신 결과 병합·저장 실패/다른 탭 보호·파일 전체 거절·화면 종료·수동 내보내기 검사 통과 (브라우저 IO 모의)');
