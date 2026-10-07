import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = readFileSync("lib/bounded-row-reader.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const runtime = vm.createContext({ exports: {} }); vm.runInContext(code, runtime);
const read = runtime.exports.readBoundedRows;
const rows = Array.from({ length: 1201 }, (_, index) => ({ id: `id-${index}` }));
const calls = [];
const all = await read(async (from, to) => { calls.push([from, to]); return { data: rows.slice(from, to + 1), count: rows.length, error: null }; }, row => row?.id, () => false);
assert.equal(all.length, 1201);
assert.deepEqual(calls, [[0, 499], [500, 999], [1000, 1499]]);
assert.equal((await read(async () => ({ data: [], count: 0, error: null }), row => row?.id, () => false)).length, 0);
for (const response of [
  { data: null, count: 0, error: null }, { data: [], count: null, error: null }, { data: [], count: 10001, error: null },
  { data: rows.slice(0, 20), count: 501, error: null }, { data: [{ id: "a" }, { id: "a" }], count: 2, error: null },
  { data: [{}], count: 1, error: null }, { data: [], count: 0, error: { code: "failure" } },
]) await assert.rejects(() => read(async () => response, row => row?.id, () => false));
await assert.rejects(() => read(async from => ({ data: rows.slice(from, from + 500), count: from ? 1200 : 1201, error: null }), row => row?.id, () => false));
assert.equal(await read(async () => { throw new Error("Must not query"); }, row => row?.id, () => true), null);
let closed = false;
assert.equal(await read(async () => { closed = true; return { data: [rows[0]], count: 1, error: null }; }, row => row?.id, () => closed), null);
await assert.rejects(() => read(async () => ({ data: [rows[0]], count: 101, error: null }), row => row?.id, () => false, 100));
const hook = readFileSync("components/prototype-linked-rows.tsx", "utf8");
assert.equal((hook.match(/await readBoundedRows\(/g) ?? []).length, 3);
assert.match(hook, /order\("received_at".*order\("id"/);
assert.match(hook, /applicationIds\.slice\(start, start \+ 100\)/);
assert.match(hook, /ownerIds\.slice\(start, start \+ 100\)/);
assert.match(hook, /if \(!cancelled\) \{ setRecords\(mapped\)/);
console.log("공통 목록 분할 조회: 1,201건·빈 결과·건수 변경·잘림·중복·조회 취소·신청/업무값/담당자 연결 검사 통과 (운영 DB 별도)");
