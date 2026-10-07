import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = readFileSync("components/package-generation-history.tsx", "utf8");
const ast = ts.createSourceFile("history.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") callback = node.arguments[0]; ts.forEachChild(node, visit); }
visit(ast);
assert.ok(callback);
const code = ts.transpileModule(`const effect = ${callback.getText(ast)}; globalThis.start = effect;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const helper = ts.transpileModule(readFileSync("lib/package-history-summary.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const helpers = vm.createContext({ exports: {} }); vm.runInContext(helper, helpers);
const document = { jobId: "job", language: "KR", documentType: "APPLICATION_REVIEW", entryName: "review.docx" };
const row = id => ({ id, actor_id: "staff", occurred_at: "2026-10-07T00:00:00Z", file_count: 1, byte_size: 100, complete: false, sha256: "a".repeat(64), documents: [document] });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture() {
  const pending = []; const listeners = {}; const rows = []; const names = []; const notices = [];
  const runtime = vm.createContext({
    applicationId: "app", hasEnvVars: true, parsePackageHistoryRows: helpers.exports.parsePackageHistoryRows,
    setRows: value => rows.push(value), setNames: value => names.push(value), setNotice: value => notices.push(value),
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; } },
    createClient: () => ({ from: table => ({ select: () => table === "profiles" ? { in: async () => ({ data: [{ id: "staff", display_name: "담당자" }], error: null }) } : { eq: () => ({ order: () => ({ limit: () => new Promise(resolve => pending.push(resolve)) }) }) } }) }),
  });
  vm.runInContext(code, runtime);
  const cleanup = runtime.start();
  return { pending, listeners, rows, names, notices, cleanup };
}
const f = fixture();
f.pending[0]({ data: [row("old")], error: null }); await flush();
assert.equal(f.rows.at(-1)[0].id, "old");
assert.equal(f.names.at(-1).staff, "담당자");
f.listeners["package-generation-recorded"]();
assert.equal(f.rows.at(-1).length, 0);
assert.equal(Object.keys(f.names.at(-1)).length, 0);
f.listeners["package-generation-recorded"]();
f.pending[2]({ data: [row("latest")], error: null }); await flush();
f.pending[1]({ data: [row("stale")], error: null }); await flush();
assert.equal(f.rows.at(-1)[0].id, "latest");
f.listeners["package-generation-recorded"]();
f.pending[3]({ data: [{ ...row("broken"), documents: null }], error: null }); await flush();
assert.equal(f.rows.at(-1).length, 0);
assert.match(f.notices.at(-1), /정상 생성기록으로 표시하지 않습니다/);
f.listeners["package-generation-recorded"]();
const before = f.rows.length;
f.cleanup(); f.pending[4]({ data: [row("after-close")], error: null }); await flush();
assert.equal(f.rows.length, before);
assert.equal(Object.keys(f.listeners).length, 0);
console.log("생성기록 실제 조회: 재조회 시 기존 기록/직원명 제거·늦은 응답 무시·손상 기록 미표시·화면 종료 보호 검사 통과 (DB/브라우저 모의)");
