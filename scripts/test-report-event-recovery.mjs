import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { verifyReportPage, verifyReportTotal } = await import(`data:text/javascript;base64,${Buffer.from(compile(fs.readFileSync(new URL("../lib/report-query-completeness.ts", import.meta.url), "utf8"))).toString("base64")}`);
const analytics = compile(fs.readFileSync(new URL("../lib/report-analytics.ts", import.meta.url), "utf8"));
const { isCertificationEventRecord } = await import(`data:text/javascript;base64,${Buffer.from(analytics).toString("base64")}`);
const record = { id: "event", job_id: "job", action_type: "SUSPENDED", effective_date: "2026-10-05" };
assert.equal(isCertificationEventRecord(record), true);
assert.equal(isCertificationEventRecord({ ...record, effective_date: "2024-02-29" }), true);
for (const value of [null, {}, { ...record, job_id: "" }, { ...record, action_type: "UNKNOWN" }, { ...record, effective_date: "2026-02-29" }, { ...record, effective_date: "2026-04-31" }]) assert.equal(isCertificationEventRecord(value), false);
const source = fs.readFileSync(new URL("../components/report-certification-events.tsx", import.meta.url), "utf8");
const effect = compile(source.slice(source.indexOf("  useEffect(() => {"), source.indexOf("  const rows =")));
function fixture(query) {
  const states = [], events = []; let cleanup;
  const client = { from() { return this; }, select() { return this; }, order() { return this; }, range: async (...args) => { const page = await query(...args); return { count: Array.isArray(page.data) ? new Set(page.data.map(row => row?.id)).size : null, ...page }; } };
  new Function("useEffect", "hasEnvVars", "createClient", "setState", "setEvents", "revision", "isCertificationEventRecord", "verifyReportPage", "verifyReportTotal", effect)(
    (callback) => { cleanup = callback(); }, true, () => client, (value) => states.push(value), (value) => events.push(value), 1, isCertificationEventRecord, verifyReportPage, verifyReportTotal);
  return { states, events, cleanup: () => cleanup() };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
let f = fixture(async () => ({ data: [record, record], error: null })); await flush();
assert.equal(f.states.at(-1), "ready"); assert.equal(f.events.at(-1).length, 1); f.cleanup();
for (const data of [null, [{ ...record, effective_date: null }]]) {
  f = fixture(async () => ({ data, error: null })); await flush(); assert.equal(f.states.at(-1), "error"); assert.deepEqual(f.events.at(-1), []); f.cleanup();
}
f = fixture(async () => { throw new Error("network"); }); await flush(); assert.equal(f.states.at(-1), "error"); f.cleanup();
f = fixture(async () => ({ data: [record], error: null, count: 2 })); await flush(); assert.equal(f.states.at(-1), "error"); assert.deepEqual(f.events.at(-1), []); f.cleanup();
let release;
f = fixture(() => new Promise((resolve) => { release = resolve; })); f.cleanup(); release({ data: [record], error: null }); await flush();
assert.equal(f.events.length, 1); assert.equal(f.states.at(-1), "loading");
assert.match(source, /\[revision\]/); assert.match(source, /상태변동 기록 다시 조회/);
console.log("정지·철회 실제 조회 effect: 재조회·누락/손상 기록 차단·유효 날짜·중복 제거·늦은 응답 미반영 통과 (DB 모의)");
