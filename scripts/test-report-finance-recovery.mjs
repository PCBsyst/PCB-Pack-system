import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../components/report-business-analytics.tsx", import.meta.url), "utf8");
const effect = source.slice(source.indexOf("  useEffect(() => {"), source.indexOf("  const groups ="));
const js = effect.replace("const result: RevenueInvoice[]", "const result").replace("(data as unknown as RevenueInvoice[])", "data");
async function run(pages) {
  const states = [], invoices = []; let cleanup, task, count = 0;
  const client = { from() { return this; }, select() { return this; }, order() { return this; }, async range() { return pages[count++]; } };
  new Function("useEffect", "hasEnvVars", "createClient", "setFinanceState", "setInvoices", "financeRevision", js)(
    (callback) => { cleanup = callback(); }, true, () => client, (value) => states.push(value), (value) => invoices.push(value), 0);
  await new Promise((resolve) => setTimeout(resolve, 0)); cleanup();
  return { states, invoices };
}
const valid = { id: "invoice-1", amount: 100, paid_amount: 100, invoice_jobs: [{ job_id: "job-1" }] };
let result = await run([{ data: [valid, valid], error: null }]);
assert.equal(result.states.at(-1), "ready"); assert.equal(result.invoices.at(-1).length, 1);
for (const data of [null, [{ ...valid, amount: null }], [{ ...valid, amount: "bad" }], [{ ...valid, amount: -1 }], [{ ...valid, invoice_jobs: null }]]) {
  result = await run([{ data, error: null }]); assert.equal(result.states.at(-1), "error"); assert.deepEqual(result.invoices.at(-1), []);
}
result = await run([{ data: null, error: { message: "network" } }]); assert.equal(result.states.at(-1), "error");
assert.match(source, /value="standard">표준·세부 분야/);
assert.match(source, /\[financeRevision\]/);
assert.match(source, /수익 자료 다시 조회/);
console.log("수익 조회 실제 effect: 초기화·중복 인보이스 제거·비정상 금액/연결 및 조회 실패 차단·재조회/표준 선택 연결 통과 (DB 모의)");
