import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:path=>load(path.replace('@/lib/',''))});return exports;}
const {koreaToday}=load('certification-expiry'),{getJobNumber}=load('job-number');
for(const [instant,date,job] of [['2026-12-31T14:59:59Z','2026-12-31','QMS260001'],['2026-12-31T15:00:00Z','2027-01-01','QMS270001'],['2026-10-31T15:00:00Z','2026-11-01','QMS260001']]){
 assert.equal(koreaToday(new Date(instant)),date);assert.equal(getJobNumber('ISO','IAS','ACCREDITED','ISO 9001',date,[]),job);
}
for(const date of ['','2026-02-30','2026-13-01','2026-1-01'])assert.equal(getJobNumber('ISO','IAS','ACCREDITED','ISO 9001',date,[]),'');
const source=readFileSync('components/new-application-form.tsx','utf8'),tree=ts.createSourceFile('form.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useEffect'&&node.arguments[0]?.getText(tree).includes('receiptDateEdited'))effect=node.arguments[0].getText(tree);ts.forEachChild(node,visit);}visit(tree);
let date='';const context={receiptDateEdited:{current:false},setReceivedAt:fn=>date=fn(date),koreaToday:()=> '2026-11-01'};
const run=vm.runInNewContext(ts.transpileModule(`(${effect})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);run();assert.equal(date,'2026-11-01');date='2025-10-01';run();assert.equal(date,'2025-10-01');context.receiptDateEdited.current=true;date='';run();assert.equal(date,'');
assert.match(source,/useState\(""\)/);assert.ok(!source.includes('useState("2026-09-02")'));assert.match(source,/receiptDateEdited.current = true; setReceivedAt\(event.target.value\)/);
console.log('접수일 기본값: 한국 자정/연말 경계·Job 접수연도·실재 날짜·초기화 시점·사용자 수정/공란 유지 검사 통과 (브라우저 시각 검증 별도)');
