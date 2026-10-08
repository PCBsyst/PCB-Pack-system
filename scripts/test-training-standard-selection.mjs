import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/training-standard-selection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports});
const {trainingStandardOptions:options,appendTrainingStandard:append}=exports;
const catalog=[{field:'ISO 9001'},{field:'ISO 50001'},{field:'ISO 50001'},{field:'SMP'},{field:'복합,분야'}];
assert.deepEqual(Array.from(options(catalog,' 50001 ')),['ISO 50001']);
assert.equal(options(catalog).length,3);
assert.equal(append('','ISO 50001',catalog),'ISO 50001');
assert.equal(append('과거 표준, ISO 9001','ISO 50001',catalog),'과거 표준, ISO 9001, ISO 50001');
assert.equal(append(' ISO 50001 ','ISO 50001',catalog),' ISO 50001 ');
assert.equal(append('과거 표준, ','SMP',catalog),'과거 표준,  SMP');
for(const field of ['미등록 표준','복합,분야',''])assert.throws(()=>append('과거 표준',field,catalog));
const picker=readFileSync('components/training-standard-picker.tsx','utf8');
const tree=ts.createSourceFile('picker.tsx',picker,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let selectSource;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='select')selectSource=node.initializer.getText(tree);ts.forEachChild(node,visit);}
visit(tree);
for(const state of [{loading:false,error:''},{loading:true,error:''},{loading:false,error:'조회 실패'}]) {
 const writes=[];const notices=[];
 const context={store:{...state,catalog},value:'과거 표준',appendTrainingStandard:append,onChange:value=>writes.push(value),setNotice:value=>notices.push(value)};
 const select=vm.runInNewContext(ts.transpileModule(`(${selectSource})`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 select('ISO 50001');
 assert.equal(writes.length,state.loading||state.error?0:1);
 if(writes.length)assert.equal(writes[0],'과거 표준, ISO 50001');
}
assert.match(picker,/if \(store.loading \|\| store.error\) return/);
assert.match(picker,/!store.loading && !store.error/);
assert.match(readFileSync('components/training-institutions-manager.tsx','utf8'),/<TrainingStandardPicker value=\{draft.standards\}/);
console.log('연수기관 표준 선택: 신규 분야·중복 방지·과거 입력 보존·미등록 거절·조회 실패 차단 검사 통과');
