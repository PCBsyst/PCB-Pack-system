import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => deps[name] ?? require(name) });
  return exports;
}
const lib = load('lib/training-institutions.ts');
const { TrainingInstitutionRecord } = load('components/training-institution-record.tsx', { '@/lib/training-institutions': lib });
const current = { id: 'internal-id', name: '현재 기관', designationNo: 'TR-NEW', validFrom: '2026-01-01', validUntil: '2027-12-31', standards: ['ISO 9001'], active: false };
const record = { providerInstitutionId: current.id, providerName: '과거 기관', providerDesignationNo: 'TR-OLD' };
const original = JSON.stringify(record);
assert.equal(lib.trainingInstitutionRecordComparison(record, current), 'CHANGED');
assert.equal(lib.trainingInstitutionRecordComparison(record, undefined), 'MISSING');
assert.equal(lib.trainingInstitutionRecordComparison(record, { ...current, id: 'wrong' }), 'MISSING');
assert.equal(lib.trainingInstitutionRecordComparison({ providerName: '과거 기관' }, current), 'LEGACY');
assert.equal(lib.trainingInstitutionRecordComparison({ ...record, providerName: current.name, providerDesignationNo: current.designationNo }, current), 'SAME');
const render = props => renderToStaticMarkup(createElement(TrainingInstitutionRecord, { record, current, lookupState: 'READY', ...props }));
const html = render({});
for (const text of ['TR-OLD', 'TR-NEW', '과거 기관', '현재 명단(참고)', '비활성', '기록과 다릅니다']) assert.ok(html.includes(text));
assert.ok(!html.includes('internal-id'));
const missing = render({ current: undefined }); assert.ok(missing.includes('확인하지 못했습니다')); assert.ok(missing.includes('TR-OLD'));
assert.ok(!render({ current: { ...current, id: 'wrong' } }).includes('TR-NEW'));
for (const lookupState of ['LOADING', 'ERROR']) { const text = render({ lookupState }); assert.ok(text.includes('대조 미확정')); assert.ok(!text.includes('TR-NEW')); assert.ok(text.includes('TR-OLD')); }
const legacy = render({ record: { providerName: '<이름>' } }); assert.ok(legacy.includes('지정번호 미입력')); assert.ok(legacy.includes('기관 ID 미연결')); assert.ok(legacy.includes('&lt;이름&gt;'));
assert.equal(JSON.stringify(record), original);
assert.ok(readFileSync('components/application-detail.tsx', 'utf8').includes('<TrainingInstitutionRecord record={schedule}'));
console.log('기관 기록 실제 HTML: 당시/현재 분리·변경/미확인/조회 실패·과거 번호 미추정·문자 이스케이프·원본 보존 통과');
