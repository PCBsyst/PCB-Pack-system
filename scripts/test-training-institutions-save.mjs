import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const lib = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync('lib/training-institutions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: lib.exports });
const parse = lib.exports.parseTrainingInstitutionRow;
const row = { id: 'one', name: '시험기관', designation_no: 'TR-01', valid_from: '2026-01-01', valid_until: '2026-12-31', standards: ['ISO 9001'], active: true };
assert.equal(parse(row).designationNo, 'TR-01');
for (const changes of [{ active: 'true' }, { valid_from: '2026-02-30' }, { valid_until: '2025-12-31' }, { standards: [null] }, { id: '' }]) assert.throws(() => parse({ ...row, ...changes }));
assert.equal(parse({ ...row, standards: [] }).standards.length, 0);
const source = ts.createSourceFile('manager.tsx', readFileSync('components/training-institutions-manager.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['save', 'toggle'].includes(node.name.getText(source))) handlers[node.name.getText(source)] = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
function harness({ result = { data: row, error: null }, local = false, failLocal = false, pending = null } = {}) {
  const state = { saving: false, items: [parse(row)], notice: '', error: '', writes: 0, cache: 0, draftCleared: false, predicates: [] };
  const context = {
    busy: { current: false }, mounted: { current: true }, isAdmin: true, loading: false, loadError: '', hasEnvVars: !local,
    draft: { id: 'one', name: row.name, designationNo: row.designation_no, validFrom: row.valid_from, validUntil: row.valid_until, standards: 'ISO 9001' },
    institutions: state.items, emptyDraft: {}, parseTrainingInstitutionRow: parse,
    setSaving: v => state.saving = v, setNotice: v => state.notice = v, setLoadError: v => state.error = v,
    setDraft: () => state.draftCleared = true,
    setInstitutions: v => state.items = typeof v === 'function' ? v(state.items) : v,
    saveTrainingInstitutions: () => { state.cache++; if (failLocal) throw Error('storage'); },
    createClient: () => ({ from: () => {
      const chain = { update: () => { state.writes++; return chain; }, insert: () => { state.writes++; return chain; }, eq: (k, v) => { state.predicates.push([k,v]); return chain; }, select: () => chain, single: async () => { if (pending) await pending; if (result instanceof Error) throw result; return result; } };
      return chain;
    } }),
  };
  for (const [name, handler] of Object.entries(handlers)) context[name] = vm.runInNewContext(ts.transpileModule(`(${handler})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return { state, context };
}
let h = harness(); await h.context.save(); assert.equal(h.state.draftCleared, true); assert.equal(h.state.saving, false); assert.equal(h.state.cache, 0);
for (const result of [Error('network private details'), { data: null, error: null }, { data: { ...row, id: 'wrong' }, error: null }]) {
  h = harness({ result }); await h.context.save(); assert.equal(h.state.draftCleared, false); assert.equal(h.state.saving, false); assert.ok(h.state.error); assert.ok(!h.state.notice.includes('private details'));
}
h = harness({ local: true, failLocal: true }); await h.context.toggle('one'); assert.equal(h.state.items[0].active, true); assert.equal(h.state.saving, false);
h = harness({ result: { data: { ...row, active: false }, error: null } }); await h.context.toggle('one'); assert.equal(h.state.items[0].active, false); assert.ok(h.state.predicates.some(([k,v]) => k === 'active' && v === true)); assert.equal(h.state.cache, 0);
h = harness({ result: { data: null, error: null } }); await h.context.toggle('one'); assert.equal(h.state.items[0].active, true); assert.ok(h.state.error);
let release; const pending = new Promise(resolve => release = resolve);
h = harness({ pending }); const first = h.context.save(); await h.context.save(); assert.equal(h.state.writes, 1); release(); await first;
h = harness(); h.context.isAdmin = false; await h.context.save(); await h.context.toggle('one'); assert.equal(h.state.writes, 0);
h = harness(); h.context.draft.validFrom = '2026-02-30'; await h.context.save(); assert.equal(h.state.writes, 0); assert.equal(h.state.error, '');
console.log('지정 연수기관 응답 검증·저장·상태 변경·중복 클릭 검사 통과');
