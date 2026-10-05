import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../components/application-detail.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("detail.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes("setWorkspaceLoadError(\"\")")) callback = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast); assert.ok(callback);
const compiled = ts.transpileModule(`const effect = ${callback};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function run(result, local = false) {
  const state = { hydrated: false, error: "", demo: "untouched", saved: "", writes: 0 };
  const dependencies = {
    usesSupabaseWorkspace: !local, application: { id: "app" }, linkedJobs: [], storageKey: "storage",
    makeInitial: () => ({ initial: true }),
    setHydrated: (value) => { state.hydrated = value; },
    setWorkspaceLoadError: (value) => { state.error = value; },
    setLastSavedAt: (value) => { state.saved = value; },
    setPersistedSnapshot: () => {}, setWorkspaceSaveError: () => {},
    setDemo: (value) => { state.demo = value; },
    createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => result }) }) }) }),
    window: { localStorage: { getItem: () => "invalid JSON", setItem: () => { state.writes++; } } },
  };
  const factory = new Function("deps", `const {${Object.keys(dependencies).join(",")}} = deps; ${compiled}; return effect;`);
  const cleanup = factory(dependencies)();
  return { state, cleanup };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
for (const result of [{ data: null, error: { message: "failed" } }, { data: { state: [] }, error: null }, { data: { state: null }, error: null }]) {
  const { state } = run(Promise.resolve(result)); await flush();
  assert.equal(state.hydrated, false); assert.ok(state.error); assert.equal(state.demo, "untouched"); assert.equal(state.saved, "");
}
const rejected = run(Promise.reject(new Error("network"))); await flush(); assert.equal(rejected.state.hydrated, false); assert.ok(rejected.state.error);
const success = run(Promise.resolve({ data: { state: { savedValue: "persisted" } }, error: null })); await flush();
assert.equal(success.state.hydrated, true); assert.equal(success.state.demo.savedValue, "persisted"); assert.equal(success.state.error, "");
const fresh = run(Promise.resolve({ data: null, error: null })); await flush(); assert.equal(fresh.state.hydrated, true); assert.equal(fresh.state.demo.initial, true);
let resolve;
const stale = run(new Promise((done) => { resolve = done; })); stale.cleanup(); resolve({ data: { state: { stale: true } }, error: null }); await flush();
assert.equal(stale.state.hydrated, false); assert.equal(stale.state.demo, "untouched");
const local = run(null, true); assert.equal(local.state.hydrated, false); assert.ok(local.state.error); assert.equal(local.state.writes, 0);
assert.match(source, /const canEdit = hydrated &&/);
assert.match(source, /if \(!hydrated \|\| \(usesSupabaseWorkspace/);
assert.match(source, /if \(!canEdit\)/);
assert.match(source, /저장된 업무기록 다시 조회/);
console.log("업무기록 읽기 실패·네트워크 오류·손상 로컬·이전 응답 보호 모의 검사: 통과 (실제 브라우저 시험은 별도)");
