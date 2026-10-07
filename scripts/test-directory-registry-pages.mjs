import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const helpers = vm.createContext({ exports: {} }); vm.runInContext(compile(readFileSync("lib/bounded-row-reader.ts", "utf8")), helpers);
function effects(path) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), results = [];
  function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") results.push(node.arguments[0].getText(ast)); ts.forEachChild(node, visit); }
  visit(ast); return results;
}
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function fixture(effect, sourceRows, options = {}) {
  const output = [], notices = [], loaded = [], calls = []; let resolve;
  const runtime = vm.createContext({ hasEnvVars: true, notice: "", records: options.records ?? [], readBoundedRows: helpers.exports.readBoundedRows,
    setDirectory: value => output.push(value), setArchiveIds: value => output.push(value), setRegistry: value => output.push(value),
    setDirectoryNotice: value => notices.push(value), setArchiveNotice: value => notices.push(value), setRegistryNotice: value => notices.push(value), setRegistryLoaded: value => loaded.push(value),
    createClient: () => ({ from: () => {
      let ids; const q = { select: () => q, order: () => q, eq: () => q, in: (_, value) => { ids = value; return q; }, range: (from, to) => {
        calls.push({ from, to, ids });
        if (options.pending) return new Promise(done => { resolve = done; });
        const rows = ids ? sourceRows.filter(row => ids.includes(row.job_id)) : sourceRows;
        return Promise.resolve({ data: rows.slice(from, options.truncated ? from + 1 : to + 1), count: rows.length, error: options.error ? { message: "denied" } : null });
      } }; return q;
    } }),
  });
  vm.runInContext(compile(`globalThis.start = ${effect};`), runtime); const cleanup = runtime.start();
  return { output, notices, loaded, calls, cleanup, respond: value => resolve(value) };
}
const [directory, archive] = effects("components/candidates-table.tsx");
const candidates = Array.from({ length: 1201 }, (_, i) => ({ id: `c-${i}`, name: "가상 후보자", archived_at: i % 2 ? "2026-10-07" : null }));
const d = fixture(directory, candidates); await flush(); assert.equal(d.output.at(-1).length, 1201); assert.equal(d.calls.length, 3);
const a = fixture(archive, candidates); await flush(); assert.equal(a.output.at(-1).length, 600); assert.equal(a.calls.length, 3);
for (const effect of [directory, archive]) {
  for (const options of [{ truncated: true }, { error: true }]) { const f = fixture(effect, candidates, options); await flush(); assert.equal(f.output.at(-1).length, 0); assert.match(f.notices.at(-1), /실패|확인하지 못/); }
  const f = fixture(effect, candidates, { pending: true }); const before = f.output.length; f.cleanup(); f.respond({ data: [], count: 0, error: null }); await flush(); assert.equal(f.output.length, before);
}
const [registry] = effects("components/jobs-table.tsx");
const certs = Array.from({ length: 201 }, (_, i) => ({ id: `cert-${i}`, job_id: `job-${i}` }));
const records = certs.map(row => ({ jobId: row.job_id })); records.push(records[0]);
const r = fixture(registry, certs, { records }); await flush(); assert.equal(r.output.at(-1).length, 201); assert.equal(r.loaded.at(-1), true); assert.deepEqual(r.calls.map(call => call.ids.length), [100, 100, 1]);
const failed = fixture(registry, certs, { records, error: true }); await flush(); assert.equal(failed.loaded.at(-1), false); assert.equal(failed.output.at(-1).length, 0);
const closed = fixture(registry, certs, { records, pending: true }); closed.cleanup(); closed.respond({ data: [], count: 0, error: null }); await flush(); assert.equal(closed.loaded.at(-1), false);
console.log("후보자/보관 1,201건·원장 201건 분할 조회, 부분/실패 응답 미확정 및 종료 응답 무시 통과 (DB 모의)");
