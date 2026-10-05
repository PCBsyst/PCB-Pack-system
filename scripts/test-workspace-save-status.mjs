import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../components/application-detail.tsx", import.meta.url), "utf8");
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { workspaceSaveStatus: status } = await import(`data:text/javascript;base64,${Buffer.from(compile(fs.readFileSync(new URL("../lib/workspace-save-status.ts", import.meta.url), "utf8"))).toString("base64")}`);
const { createWorkspaceSaveQueue } = await import(`data:text/javascript;base64,${Buffer.from(compile(fs.readFileSync(new URL("../lib/workspace-save-queue.ts", import.meta.url), "utf8"))).toString("base64")}`);
assert.equal(status("A", null, false, ""), "LOADING");
assert.equal(status("A", null, true, ""), "PENDING");
assert.equal(status("A", "A", true, ""), "SAVED");
assert.equal(status("B", "A", true, ""), "PENDING");
assert.equal(status("A", "A", true, "저장 실패"), "ERROR");
const ast = ts.createSourceFile("ui.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes("const saved =")) effect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast); assert.ok(effect);
const code = compile(`const effect = ${effect};`);
function run(result, local = false) {
  let timer;
  const state = { snapshot: null, error: "", writes: 0 };
  const deps = { hydrated: true, usesSupabaseWorkspace: !local, editLock: "OWNED", demo: { sample: true }, application: { id: "a" }, storageKey: "local", saveQueue: { current: createWorkspaceSaveQueue() }, saveAccess: { current: { key: "local", canEdit: true } }, setPersistedSnapshot: value => state.snapshot = value, setWorkspaceSaveError: value => state.error = value, setNotice: () => {}, createClient: () => ({ from: () => ({ upsert: () => result }) }), window: { setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => {}, localStorage: { setItem: () => { state.writes++; if (result instanceof Error) throw result; } } } };
  const cleanup = new Function("deps", `const {${Object.keys(deps).join(",")}} = deps; ${code}; return effect();`)(deps);
  return { state, cleanup, start: () => timer?.() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const success = run(Promise.resolve({ error: null })); success.start(); await flush(); assert.equal(success.state.snapshot, '{"sample":true}'); assert.equal(success.state.error, "");
const failed = run(Promise.resolve({ error: { message: "db" } })); failed.start(); await flush(); assert.equal(failed.state.snapshot, null); assert.ok(failed.state.error);
const rejected = run(Promise.reject(new Error("network"))); rejected.start(); await flush(); assert.ok(rejected.state.error);
let resolve;
const stale = run(new Promise(done => resolve = done)); stale.start(); stale.cleanup(); resolve({ error: null }); await flush(); assert.equal(stale.state.snapshot, null);
const local = run(null, true); assert.equal(local.state.snapshot, '{"sample":true}'); assert.equal(local.state.writes, 1);
const localFailed = run(new Error("quota"), true); assert.equal(localFailed.state.snapshot, null); assert.ok(localFailed.state.error);
assert.ok(source.includes('role="status" aria-live="polite"'));
assert.ok(source.includes("다른 기기에 공유된 저장이 아닙니다"));
console.log("업무 저장 상태: 자동 저장 성공·DB/통신/로컬 실패·이전 응답 무시·입력 변경 후 대기 검사 통과 (운영 DB 검증 별도)");
