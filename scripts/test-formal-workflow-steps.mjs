import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const checks = await import(`data:text/javascript;base64,${Buffer.from(compile(fs.readFileSync(new URL("../lib/workflow-record-checks.ts", import.meta.url), "utf8"))).toString("base64")}`);
for (const input of ["", "0", "-1", "NaN", "Infinity", "1e4", "1,000", "1.234", "9007199254740992"]) assert.equal(checks.workflowAmount(input), null);
assert.equal(checks.workflowAmount("123.45"), 123.45);
assert.equal(checks.workflowAmount(" 100 "), 100);
assert.equal(checks.hasExactAffectedIds([{ id: "a" }, { id: "b" }], ["b", "a"]), true);
for (const rows of [null, [], [{ id: "a" }, { id: "a" }], [{ id: "other" }]]) assert.equal(checks.hasExactAffectedIds(rows, ["a", "b"]), false);
const source = fs.readFileSync(new URL("../components/application-detail.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("application.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["runFormalStep", "move", "finishReview", "recordInvoice", "confirmPayment"];
const found = [];
function visit(node) {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => names.includes(item.name.getText(tree)))) found.push(node.getText(tree));
  ts.forEachChild(node, visit);
}
visit(tree);
const code = compile(found.join("\n"));
function fixture(query, { editable = true, local = false } = {}) {
  const demo = { stage: "PAYMENT_PENDING", review: { reviewer: "검토자", reviewedAt: "2026-10-01", verifier: "검증자", verifiedAt: "2026-10-02", verificationResult: "확인", result: "적합" }, invoiceNo: "sample", invoiceAmount: "100", invoiceRecipientName: "가상수신자", invoiceIssuedAt: "2026-10-01", paidAmount: "100", payerName: "가상입금자", paymentConfirmedAt: "2026-10-02", paymentConfirmedBy: "가상담당자", dateAuditLogs: [] };
  const notices = [], busy = [], stages = [], requests = [];
  const latestDemo = { current: demo }, running = { current: false }, snapshot = { current: null }, mounted = { current: true };
  const client = { auth: { getUser: async () => ({ data: { user: { id: "staff" } } }) }, from(table) {
    const chain = { action: "", update() { this.action = "update"; return this; }, upsert() { this.action = "upsert"; return this; }, in() { return this; }, eq() { return this; }, select() { return this; }, single() { return this; }, then(resolve, reject) { requests.push({ table, action: this.action }); return Promise.resolve().then(() => query(table, this.action)).then(resolve, reject); } }; return chain;
  } };
  const deps = { demo, latestDemo, formalRunning: running, formalSnapshot: snapshot, downloadMounted: mounted, saveAccess: { current: { canEdit: editable } }, setFormalSaving: value => busy.push(value), setNotice: value => notices.push(value), setDemo: update => stages.push(update(demo).stage), setActive() {}, stageLabels: { PAYMENT_PENDING: "입금대기", DECISION_PENDING: "심의대기", INVOICE_PENDING: "청구대기" }, createAuditLog: () => ({}), application: { primaryOwner: "담당자" }, usesSupabaseWorkspace: !local, linkedJobs: [{ id: "j" }], cycleIds: { j: "c" }, createClient: () => client, ...checks };
  const actions = new Function(...Object.keys(deps), `${code};return {${names.join(",")}};`)(...Object.values(deps));
  return { actions, demo, latestDemo, mounted, notices, busy, stages, requests, running };
}
let f = fixture(async table => ({ data: [{ id: table === "invoices" ? "invoice" : "c" }], error: null }));
await f.actions.confirmPayment(); assert.deepEqual(f.stages, ["DECISION_PENDING"]); assert.equal(f.busy.at(-1), false);
f = fixture(async () => ({ data: [], error: null })); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0); assert.match(f.notices.at(-1), /인보이스 1건/);
f = fixture(async table => table === "document_reviews" ? { error: null } : { data: [], error: null }); await f.actions.finishReview(); assert.equal(f.stages.length, 0); assert.match(f.notices.at(-1), /회차 검토일/);
f = fixture(async () => { throw new Error("network"); }); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0); assert.equal(f.running.current, false); assert.match(f.notices.at(-1), /일부 기록/);
let release;
f = fixture(() => new Promise(resolve => { release = resolve; })); const first = f.actions.confirmPayment(); await new Promise(resolve => setTimeout(resolve, 0)); await f.actions.confirmPayment(); assert.equal(f.requests.length, 1);
f.latestDemo.current = { ...f.demo, paidAmount: "200" }; release({ data: [{ id: "invoice" }], error: null }); await first; assert.equal(f.stages.length, 0); assert.match(f.notices.at(-1), /입력이 변경/);
f = fixture(async () => ({ data: [{ id: "invoice" }], error: null }), { editable: false }); await f.actions.confirmPayment(); assert.equal(f.requests.length, 0);
f = fixture(async () => ({ data: [{ id: "invoice" }], error: null }), { local: true }); f.demo.invoiceAmount = "NaN"; await f.actions.recordInvoice(); assert.equal(f.stages.length, 0); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0);
assert.ok(source.includes("disabled={!canEdit || formalSaving}"));
for (const name of ["finishReview", "recordInvoice", "confirmPayment", "finishDecision", "finishCertification", "finishOriginalDelivery"]) assert.ok(source.includes(`const ${name} = () => runFormalStep(async () => {`));
console.log("업무 단계 확정: 금액 검증·0건/일부 저장 차단·중복 실행·입력 변경·읽기전용·실패 후 해제 검사 통과 (DB/브라우저 모의, 트랜잭션 보장 별도)");
