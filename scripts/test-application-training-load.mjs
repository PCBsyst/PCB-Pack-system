import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function moduleAt(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports });
  return exports;
}
const { parseTrainingInstitutionRow } = moduleAt('lib/training-institutions.ts');
const { readBoundedRows } = moduleAt('lib/bounded-row-reader.ts');
const text = readFileSync('components/application-detail.tsx', 'utf8');
const source = ts.createSourceFile('detail.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0].getText(source).includes('setTrainingInstitutions')) effect = node.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(effect);
const rows = Array.from({ length: 501 }, (_, i) => ({ id: `id-${i}`, name: `기관${i}`, designation_no: `TR-${i}`, valid_from: '2026-01-01', valid_until: '2026-12-31', standards: ['ISO 9001'], active: true }));
async function run({ failure = false, malformed = false, cancelled = false, local = false, truncated = false } = {}) {
  const state = { items: ['stale'], loading: false, error: '', pages: 0, local: 0, updates: 0 };
  let release; const gate = new Promise(resolve => release = resolve);
  const context = {
    hasEnvVars: !local, readBoundedRows, parseTrainingInstitutionRow,
    setTrainingInstitutions: v => { state.items = v; state.updates++; },
    setTrainingLoading: v => { state.loading = v; state.updates++; },
    setTrainingError: v => { state.error = v; state.updates++; },
    readTrainingInstitutions: () => { state.local++; return []; },
    createClient: () => ({ from: table => {
      assert.equal(table, 'training_institutions');
      const chain = { select: (_s, options) => { assert.equal(options.count, 'exact'); return chain; }, order: () => chain,
        range: async (from, to) => { await gate; state.pages++; if (failure) throw Error('private'); return { data: malformed ? [{ ...rows[0], valid_until: 'wrong' }] : rows.slice(from, truncated ? from + 1 : to + 1), count: malformed ? 1 : rows.length, error: null }; },
      }; return chain;
    } }),
  };
  const cleanup = vm.runInNewContext(ts.transpileModule(`(${effect})()`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  const updates = state.updates; if (cancelled) cleanup(); release();
  for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
  if (cancelled) assert.equal(state.updates, updates);
  return state;
}
let state = await run(); assert.equal(state.items.length, 501); assert.equal(state.pages, 2); assert.equal(state.local, 0); assert.equal(state.loading, false);
for (const options of [{ failure: true }, { malformed: true }, { truncated: true }]) { state = await run(options); assert.equal(state.items.length, 0); assert.ok(state.error); assert.equal(state.loading, false); assert.equal(state.local, 0); }
await run({ cancelled: true });
state = await run({ local: true }); assert.equal(state.local, 1); assert.equal(state.pages, 0);
assert.ok(text.includes('item.active && item.validFrom <= application.receivedAt && item.validUntil >= application.receivedAt && item.standards.includes(job.standard)'));
assert.ok(text.includes('과거 기록은 자동 변경하지 않으니'));
console.log('신청 연수기관 실제 조회: 공유/로컬 분리·501건·부분/손상/통신 실패·종료 보호 통과 (DB 모의)');
