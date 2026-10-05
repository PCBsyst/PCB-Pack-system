import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../components/monthly-operations-report.tsx", import.meta.url), "utf8");
const helper = source.slice(source.indexOf("function arrayOf"), source.indexOf("export function MonthlyOperationsReport"));
const effect = source.slice(source.indexOf("  useEffect(() => {"), source.indexOf("  const options ="));
const code = ts.transpileModule(helper + effect, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(query) {
  const rows = [], errors = [], loading = []; let cleanup;
  const client = { from() { return this; }, select() { return this; }, order() { return this; }, range: query };
  new Function("useEffect", "hasEnvVars", "createClient", "setRows", "setError", "setLoading", "revision", code)(
    (callback) => { cleanup = callback(); }, true, () => client, (value) => rows.push(value), (value) => errors.push(value), (value) => loading.push(value), 1);
  return { rows, errors, loading, cleanup: () => cleanup() };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const application = { id: "app", received_at: "2026-10-01", jobs: [{ id: "job", candidates: [{ id: "candidate", name: "가상후보" }], certification_records: [] }] };
let f = fixture(async () => ({ data: [application, application], error: null })); await flush();
assert.deepEqual(f.rows[0], []); assert.equal(f.rows.at(-1).length, 1); assert.equal(f.loading.at(-1), false); f.cleanup();
for (const page of [{ data: null, error: null }, { data: [], error: { message: "network" } }]) {
  f = fixture(async () => page); await flush(); assert.deepEqual(f.rows.at(-1), []); assert.match(f.errors.at(-1), /조회하지 못/); assert.equal(f.loading.at(-1), false); f.cleanup();
}
let release;
f = fixture(() => new Promise((resolve) => { release = resolve; })); f.cleanup();
release({ data: [application], error: null }); await flush(); assert.equal(f.rows.length, 1); assert.equal(f.errors.length, 1);
assert.match(source, /\[revision\]/); assert.match(source, /업무보고 자료 다시 조회/);
assert.match(source, /setRows\(\[\]\); setError\(""\); setLoading\(true\); setRevision/);
console.log("월간 보고서 실제 조회 effect: 재조회 초기화·중복 Job 제거·오류 후 빈 자료 유지·화면 종료 후 과거 응답 무시 통과 (DB 모의)");
