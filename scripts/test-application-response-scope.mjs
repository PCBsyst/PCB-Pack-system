import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
const buttonSource = fs.readFileSync(new URL("../components/document-download-button.tsx", import.meta.url), "utf8");
const buttonTree = ts.createSourceFile("button.tsx", buttonSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const button = buttonTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "DocumentDownloadButton").getText(buttonTree).replace(/^export /, "");
function runButton(task) {
  let cleanup; const notices = [], pending = [];
  const deps = { useRef: value => ({ current: value }), useState: () => [false, value => pending.push(value)], useEffect: fn => cleanup = fn(), React: { createElement: (tag, props, ...children) => ({ tag, props, children }) }, Button: "button", Download: "icon", LoaderCircle: "spinner" };
  const render = new Function("deps", `const {${Object.keys(deps).join(",")}} = deps; ${compile(button)}; return DocumentDownloadButton;`)(deps);
  const node = render({ label: "DOCX", task, setNotice: value => notices.push(value), successMessage: "다운로드 요청 완료" });
  return { node, notices, pending, close: () => cleanup() };
}
for (const fail of [false, true]) {
  let finish, calls = 0;
  const result = runButton(() => { calls++; return new Promise((resolve, reject) => finish = fail ? () => reject(new Error("생성 실패")) : resolve); });
  result.node.props.onClick(); result.node.props.onClick(); assert.equal(calls, 1);
  result.close(); finish(); await flush();
  assert.equal(result.notices.length, 1); assert.deepEqual(result.pending, [true]);
}
const success = runButton(async () => {}); success.node.props.onClick(); await flush(); assert.equal(success.notices.at(-1), "다운로드 요청 완료"); assert.deepEqual(success.pending, [true, false]);
const failure = runButton(async () => { throw new Error("실패 안내"); }); failure.node.props.onClick(); await flush(); assert.equal(failure.notices.at(-1), "실패 안내");
const source = fs.readFileSync(new URL("../components/supabase-application-workspace.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect" && node.arguments[0]?.getText(tree).includes('from("applications")')) callback = node.arguments[0].getText(tree); ts.forEachChild(node, visit); }
visit(tree); assert.ok(callback);
const row = { id: "a1", candidates: { id: "c1", name: "가상 후보자" }, jobs: [], created_at: "2026-10-05T00:00:00Z" };
function runLoader(response) {
  const state = { data: "old", error: "", selected: "" };
  const deps = { id: "a1", setData: value => state.data = value, setError: value => state.error = value, setSelectedOwnerId: value => state.selected = value, createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: () => response }) }) }) }) };
  const cleanup = new Function("deps", `const {${Object.keys(deps).join(",")}} = deps; ${compile(`const effect = ${callback};`)}; return effect();`)(deps);
  return { state, cleanup };
}
const loaded = runLoader(Promise.resolve({ data: row, error: null })); await flush(); assert.equal(loaded.state.data.application.id, "a1");
const rejected = runLoader(Promise.reject(new Error("network"))); await flush(); assert.equal(rejected.state.data, null); assert.ok(rejected.state.error);
const missing = runLoader(Promise.resolve({ data: { ...row, candidates: null }, error: null })); await flush(); assert.equal(missing.state.data, null); assert.ok(missing.state.error);
let resolve;
const stale = runLoader(new Promise(done => resolve = done)); stale.cleanup(); resolve({ data: row, error: null }); await flush(); assert.equal(stale.state.data, undefined); assert.equal(stale.state.error, "");
const page = fs.readFileSync(new URL("../app/applications/[id]/page.tsx", import.meta.url), "utf8");
assert.ok(page.includes("<PrototypeApplicationWorkspace key={id}")); assert.ok(page.includes("<SupabaseApplicationWorkspace key={id}")); assert.ok(page.includes("<ApplicationDetail key={application.id}"));
assert.ok(source.includes("<ApplicationDetail key={data.application.id}"));
console.log("신청 응답 범위: 화면 종료 후 알림 미변경·중복 클릭 제한·이전 조회 무시·통신/후보자 누락 오류·신청별 편집 분리 검사 통과 (브라우저/운영 DB 검증 별도)");
