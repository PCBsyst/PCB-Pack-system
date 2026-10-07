import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const ast = ts.createSourceFile("page.tsx", readFileSync("app/page.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) { if (!effect && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") effect = node.arguments[0].getText(ast); ts.forEachChild(node, visit); }
visit(ast);
const helpers = vm.createContext({ exports: {} }); vm.runInContext(compile(readFileSync("lib/bounded-row-reader.ts", "utf8")), helpers);
const rows = Array.from({ length: 1201 }, (_, i) => ({ id: `app-${i}`, candidates: { id: `candidate-${i}`, name: "가상 후보자" }, jobs: i === 0 ? [] : [{ id: `job-${i}`, job_no: `TEST-${i}`, primary_owner_id: "staff" }] }));
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function fixture(options = {}) {
  const records = [], states = [], calls = []; let resolve;
  const runtime = vm.createContext({ hasEnvVars: true, readBoundedRows: helpers.exports.readBoundedRows,
    setRecords: value => records.push(value), setLoadState: value => states.push(value), setCheckedAt: () => {},
    createClient: () => ({ from: table => {
      const q = { select: () => q, order: () => q, in: () => q, range: (from, to) => {
        calls.push(table);
        if (options.pending) return new Promise(done => { resolve = done; });
        const data = table === "applications" ? rows : [{ id: "staff", display_name: "담당자" }];
        return Promise.resolve({ data: data.slice(from, options.truncated && table === "applications" ? from + 1 : to + 1), count: options.changed && from > 0 ? data.length - 1 : data.length, error: options.profileFailure && table === "profiles" ? { message: "denied" } : null });
      } }; return q;
    } }),
  });
  vm.runInContext(compile(`globalThis.start = ${effect};`), runtime); const cleanup = runtime.start();
  return { records, states, calls, cleanup, respond: value => resolve(value) };
}
const good = fixture(); await flush(); assert.equal(good.states.at(-1), "ready"); assert.equal(good.records.at(-1).length, 1201);
assert.equal(good.records.at(-1)[0].jobId, ""); assert.equal(good.records.at(-1)[1].primaryOwner, "담당자");
assert.equal(rows[0].jobs.length, 0); // Display placeholder must not mutate fetched rows.
assert.equal(good.calls.filter(table => table === "applications").length, 3);
for (const options of [{ truncated: true }, { changed: true }, { profileFailure: true }]) {
  const f = fixture(options); await flush(); assert.equal(f.states.at(-1), "error"); assert.equal(f.records.at(-1).length, 0);
}
const closed = fixture({ pending: true }); const before = closed.states.length;
closed.cleanup(); closed.respond({ data: [], count: 0, error: null }); await flush(); assert.equal(closed.states.length, before);
console.log("대시보드 실제 조회: 1,201건·Job 미부여 유지·부분/건수 변경/담당자 실패 차단·종료 응답 무시 통과 (DB 모의)");
