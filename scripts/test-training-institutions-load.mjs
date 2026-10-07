import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function loadModule(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports });
  return exports;
}
const { parseTrainingInstitutionRow } = loadModule('lib/training-institutions.ts');
const { readBoundedRows } = loadModule('lib/bounded-row-reader.ts');
const text = readFileSync('components/training-institutions-manager.tsx', 'utf8');
const source = ts.createSourceFile('manager.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const effects = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect') effects.push(node.arguments[0].getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const effect = effects.find(value => value.includes('readBoundedRows'));
assert.ok(effect);
const rows = Array.from({ length: 501 }, (_, i) => ({ id: `org-${i}`, name: `기관${i}`, designation_no: `TR-${i}`, valid_from: '2026-01-01', valid_until: '2026-12-31', standards: ['ISO 9001'], active: true }));
async function run({ broken = false, authError = false, profileError = false, malformed = false, cancelled = false, local = false, role = 'ADMIN' } = {}) {
  const state = { items: ['stale'], error: '', loading: false, admin: true, pages: [], locals: 0, updates: 0 };
  let release;
  const gate = new Promise(resolve => release = resolve);
  const context = {
    hasEnvVars: !local, parseTrainingInstitutionRow, readBoundedRows,
    readTrainingInstitutions: () => { state.locals++; return []; },
    setInstitutions: value => { state.items = value; state.updates++; },
    setLoadError: value => { state.error = value; state.updates++; }, setNotice: () => { state.updates++; },
    setLoading: value => { state.loading = value; state.updates++; }, setIsAdmin: value => { state.admin = value; state.updates++; },
    createClient: () => ({ auth: { getUser: async () => { await gate; return { data: { user: { id: 'user' } }, error: authError }; } }, from: table => {
      const chain = { select: () => chain, eq: () => chain, order: () => chain,
        maybeSingle: async () => ({ data: { role }, error: profileError }),
        range: async (from, to) => { state.pages.push([from, to]); return { data: malformed ? [{ ...rows[0], active: null }] : rows.slice(from, to + 1), count: malformed ? 1 : rows.length, error: broken }; },
      }; assert.ok(['profiles', 'training_institutions'].includes(table)); return chain;
    } }),
  };
  const cleanup = vm.runInNewContext(ts.transpileModule(`(${effect})()`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  const initialUpdates = state.updates;
  if (cancelled) cleanup();
  release();
  for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
  if (cancelled) assert.equal(state.updates, initialUpdates);
  return state;
}
let state = await run(); assert.equal(state.items.length, 501); assert.equal(state.pages.length, 2); assert.equal(state.locals, 0); assert.equal(state.loading, false); assert.equal(state.admin, true);
for (const options of [{ broken: true }, { authError: true }, { profileError: true }, { malformed: true }]) {
  state = await run(options); assert.equal(state.items.length, 0); assert.ok(state.error); assert.equal(state.admin, false); assert.equal(state.loading, false); assert.equal(state.locals, 0);
}
await run({ cancelled: true });
state = await run({ role: 'STAFF' }); assert.equal(state.admin, false); assert.equal(state.items.length, 501);
state = await run({ local: true }); assert.equal(state.locals, 1); assert.equal(state.pages.length, 0);
assert.ok(text.includes('조회 실패 · 건수 미확정'));
assert.ok(text.includes('!loading && !loadError && visible.map'));
console.log('연수기관 실제 조회: 501건 분할·권한/통신/손상 실패·종료 응답 무시·로컬 분리 통과 (DB 모의)');
