import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function moduleAt(path) { const exports = {}; vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports }); return exports; }
const { parseBasicDirectoryItem: parse } = moduleAt('lib/basic-directory.ts');
const { readBoundedRows } = moduleAt('lib/bounded-row-reader.ts');
const text = readFileSync('components/use-basic-directory.ts', 'utf8');
const source = ts.createSourceFile('hook.ts', text, ts.ScriptTarget.Latest, true);
const handlers = {}; let effect;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['register', 'toggle'].includes(node.name.getText(source))) handlers[node.name.getText(source)] = node.initializer.getText(source);
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0].getText(source).includes('readBoundedRows')) effect = node.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
const row = { id: 'id-1', name: '기관', active: true, updated_at: '2026-10-08T01:00:00+00:00' };
for (const changes of [{ id: '' }, { name: 'x\u0000y' }, { active: 'true' }, { updated_at: 'invalid' }]) assert.throws(() => parse({ ...row, ...changes }));
function harness(table, options = {}) {
  const state = { items: [parse(row)], notice: '', error: '', saving: false, loading: false, writes: 0, filters: [], pages: 0, localReads: 0, updates: 0 };
  const chain = { select: () => chain, order: () => chain, eq: (key,value) => { state.filters.push([key,value]); return chain; },
    insert: payload => { state.writes++; state.payload = payload; state.insert = true; return chain; }, update: payload => { state.writes++; state.payload = payload; return chain; },
    single: async () => { if (options.gate) await options.gate; if (options.result instanceof Error) throw options.result; return options.result ?? { data: { ...row, id: state.insert ? 'new-id' : row.id, ...state.payload }, error: null }; },
    range: async (from,to) => { state.pages++; if (options.gate) await options.gate; if (options.loadError) throw Error('private-details'); const rows = Array.from({ length: 501 }, (_,i) => ({ ...row, id: `row-${i}` })); return { data: options.truncated ? [] : rows.slice(from,to+1), count: 501, error: null }; },
  };
  const context = { table, hasEnvVars: !options.local, local: options.noLocal ? undefined : { read: () => { state.localReads++; return [parse(row)]; }, save: () => { if (options.failLocal) throw Error('storage'); } },
    items: state.items, loading: false, error: '', busy: { current: false }, mounted: { current: true }, parseBasicDirectoryItem: parse, readBoundedRows,
    setItems: v => { state.items = typeof v === 'function' ? v(state.items) : v; state.updates++; }, setLoading: v => { state.loading = v; state.updates++; }, setSaving: v => state.saving = v,
    setNotice: v => { state.notice = v; state.updates++; }, setError: v => { state.error = v; state.updates++; },
    createClient: () => ({ from: value => { assert.equal(value,table); return chain; } }),
  };
  for (const [name,value] of Object.entries(handlers)) context[name] = vm.runInNewContext(ts.transpileModule(`(${value})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return { context, state, load: () => vm.runInNewContext(ts.transpileModule(`(${effect})()`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context) };
}
const settle = async () => { for(let i=0;i<20;i++) await new Promise(resolve=>setImmediate(resolve)); };
for (const table of ['partners','panel_members']) {
  let h = harness(table); h.load(); await settle(); assert.equal(h.state.items.length,501); assert.equal(h.state.pages,2); assert.equal(h.state.localReads,0);
  for (const options of [{ loadError:true }, { truncated:true }]) { h=harness(table,options); h.load(); await settle(); assert.equal(h.state.items.length,0); assert.ok(h.state.error); assert.equal(h.state.loading,false); }
  h=harness(table); assert.equal(await h.context.register('새 이름'),true); assert.equal(h.state.items.length,2); assert.equal(h.state.saving,false);
  for (const result of [Error('private-details'),{ data:null,error:null },{ data:{...row,name:'wrong'},error:null }]) { h=harness(table,{result}); assert.equal(await h.context.register('새 이름'),false); assert.equal(h.state.items.length,1); assert.ok(h.state.error); assert.equal(h.state.saving,false); assert.ok(!h.state.notice.includes('private-details')); }
  h=harness(table); await h.context.toggle(parse(row)); assert.equal(h.state.items[0].active,false); assert.ok(h.state.filters.some(([key,value])=>key==='updated_at' && value===row.updated_at));
  h=harness(table,{result:{data:null,error:null}}); await h.context.toggle(parse(row)); assert.equal(h.state.items[0].active,true); assert.ok(h.state.error);
  let release; const gate=new Promise(resolve=>release=resolve); h=harness(table,{gate}); const pending=h.context.register('새 이름'); assert.equal(await h.context.register('또 다른 이름'),false); assert.equal(h.state.writes,1); release(); await pending;
  let releaseLoad; const loadGate=new Promise(resolve=>releaseLoad=resolve); h=harness(table,{gate:loadGate}); const cleanup=h.load(); const before=h.state.updates; cleanup(); releaseLoad(); await settle(); assert.equal(h.state.updates,before);
}
let h=harness('partners',{local:true,failLocal:true}); assert.equal(await h.context.register('새 이름'),false); assert.equal(h.state.items.length,1); assert.equal(h.state.saving,false);
h=harness('panel_members',{local:true,noLocal:true}); h.load(); await settle(); assert.ok(h.state.error); assert.equal(h.state.items.length,0);
for(const file of ['partners-manager.tsx','panel-members-manager.tsx']) assert.ok(readFileSync(`components/${file}`,'utf8').includes('useBasicDirectory'));
console.log('파트너·심의위원 실제 조회/저장: 501건·오류/부분 응답·중복 요청·상태 변경 조건·종료 응답·로컬 저장 실패 통과 (DB 모의)');
