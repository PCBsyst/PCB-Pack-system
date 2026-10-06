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
const names = ["runFormalStep", "move", "finishReview", "recordInvoice", "recoverInvoiceLinks", "confirmPayment", "applySharedPayment"];
const found = [];
function visit(node) {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => names.includes(item.name.getText(tree)))) found.push(node.getText(tree));
  ts.forEachChild(node, visit);
}
visit(tree);
const code = compile(found.join("\n"));
function fixture(query, { editable = true, local = false, confirmed = true, reason = "연결 실패 복구" } = {}) {
  const demo = { stage: "PAYMENT_PENDING", review: { reviewer: "검토자", reviewedAt: "2026-10-01", verifier: "검증자", verifiedAt: "2026-10-02", verificationResult: "확인", result: "적합" }, invoiceNo: "sample", invoiceAmount: "100", invoiceRecipientName: "가상수신자", invoiceIssuedAt: "2026-10-01", paidAmount: "100", payerName: "가상입금자", paymentConfirmedAt: "2026-10-02", paymentConfirmedBy: "가상담당자", dateAuditLogs: [] };
  const notices = [], busy = [], stages = [], requests = [], states = [];
  const latestDemo = { current: demo }, running = { current: false }, snapshot = { current: null }, mounted = { current: true };
  const client = { auth: { getUser: async () => ({ data: { user: { id: "staff" } } }) }, from(table) {
    const chain = { action: "select", update() { this.action = "update"; return this; }, insert() { this.action = "insert"; return this; }, upsert() { this.action = "upsert"; return this; }, in() { return this; }, eq() { return this; }, select() { return this; }, single() { return this; }, maybeSingle() { return this; }, then(resolve, reject) { requests.push({ table, action: this.action }); return Promise.resolve().then(() => query(table, this.action)).then(resolve, reject); } }; return chain;
  } };
  const deps = { demo, latestDemo, formalRunning: running, formalSnapshot: snapshot, downloadMounted: mounted, saveAccess: { current: { canEdit: editable } }, setFormalSaving: value => busy.push(value), setNotice: value => notices.push(value), setDemo: update => { const state = update(demo); states.push(state); stages.push(state.stage); }, setActive() {}, stageLabels: { PAYMENT_PENDING: "입금대기", DECISION_PENDING: "심의대기", INVOICE_PENDING: "청구대기" }, createAuditLog: () => ({}), application: { primaryOwner: "담당자" }, usesSupabaseWorkspace: !local, linkedJobs: [{ id: "j" }], cycleIds: { j: "c" }, createClient: () => client, ...checks };
  deps.window = { confirm: () => confirmed, prompt: () => reason };
  const actions = new Function(...Object.keys(deps), `${code};return {${names.join(",")}};`)(...Object.values(deps));
  return { actions, demo, latestDemo, mounted, notices, busy, stages, states, requests, running };
}
const invoiceRow = { id: "invoice", amount: 100, payment_status: "UNPAID" };
const normal = async (table, action) => ({ data: table === "invoice_jobs" ? [{ job_id: "j" }] : action === "select" ? invoiceRow : [{ id: "invoice" }], error: null });
let f = fixture(normal);
await f.actions.confirmPayment(); assert.deepEqual(f.stages, ["DECISION_PENDING"]); assert.equal(f.busy.at(-1), false);
f = fixture(async () => ({ data: [], error: null })); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0); assert.match(f.notices.at(-1), /인보이스 1건/);
f = fixture(async table => table === "document_reviews" ? { error: null } : { data: [], error: null }); await f.actions.finishReview(); assert.equal(f.stages.length, 0); assert.match(f.notices.at(-1), /회차 검토일/);
f = fixture(async () => { throw new Error("network"); }); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0); assert.equal(f.running.current, false); assert.match(f.notices.at(-1), /일부 기록/);
let release;
let held = false;
f = fixture((table, action) => { if (!held) { held = true; return new Promise(resolve => { release = resolve; }); } return normal(table, action); }); const first = f.actions.confirmPayment(); await new Promise(resolve => setTimeout(resolve, 0)); await f.actions.confirmPayment(); assert.equal(f.requests.length, 1);
f.latestDemo.current = { ...f.demo, paidAmount: "200" }; release({ data: invoiceRow, error: null }); await first; assert.equal(f.stages.length, 0); assert.match(f.notices.at(-1), /입력이 변경/);
f = fixture(async () => ({ data: [{ id: "invoice" }], error: null }), { editable: false }); await f.actions.confirmPayment(); assert.equal(f.requests.length, 0);
f = fixture(async () => ({ data: [{ id: "invoice" }], error: null }), { local: true }); f.demo.invoiceAmount = "NaN"; await f.actions.recordInvoice(); assert.equal(f.stages.length, 0); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0);
assert.ok(source.includes("disabled={!canEdit || formalSaving}"));
for (const bad of [{ ...invoiceRow, amount: 200 }, { ...invoiceRow, payment_status: "PAID" }]) {
  f = fixture(async () => ({ data: bad, error: null })); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0); assert.ok(!f.requests.some(r => r.action === "update"));
}
f = fixture(async (table, action) => table === "invoice_jobs" ? { data: [{ job_id: "other" }], error: null } : normal(table, action)); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0); assert.ok(!f.requests.some(r => r.action === "update"));
f = fixture(normal); await f.actions.recordInvoice(); assert.equal(f.stages.length, 0); assert.ok(!f.requests.some(r => r.action === "insert" || r.action === "upsert"));
f = fixture(async table => ({ data: table === "invoice_jobs" ? [] : invoiceRow, error: null })); await f.actions.recordInvoice(); assert.equal(f.stages.length, 0); assert.match(f.notices.at(-1), /이미 등록된/); assert.ok(!f.requests.some(r => r.action === "insert"));
f = fixture(async (table, action) => ({ data: action === "select" ? table === "invoice_jobs" ? [] : null : table === "invoices" ? { id: "new-invoice" } : [{ invoice_id: "new-invoice", job_id: "j" }], error: null })); await f.actions.recordInvoice(); assert.deepEqual(f.stages, ["PAYMENT_PENDING"]); assert.ok(f.requests.some(r => r.action === "insert"));
f = fixture(async (table, action) => table === "invoice_jobs" ? { data: [{ job_id: "j" }, { job_id: "another-candidate-job" }], error: null } : normal(table, action)); await f.actions.confirmPayment(); assert.deepEqual(f.stages, ["DECISION_PENDING"]);
f = fixture(async (table, action) => action === "update" ? { data: [], error: null } : normal(table, action)); await f.actions.confirmPayment(); assert.equal(f.stages.length, 0);
for (const name of ["finishReview", "recordInvoice", "confirmPayment", "finishDecision", "finishCertification", "finishOriginalDelivery"]) assert.ok(source.includes(`const ${name} = () => runFormalStep(async () => {`));
const paidInvoice = { ...invoiceRow, payment_status: "PAID", paid_amount: 150, paid_at: "2026-10-02", issued_at: "2026-10-01", payer_name: "통합입금자", confirmed_by: "original-staff", recipient_type: "PARTNER", recipient_name: "가상파트너" };
const shared = async table => ({ data: table === "invoices" ? paidInvoice : table === "profiles" ? { display_name: "원 확인자" } : [{ job_id: "j" }, { job_id: "another-job" }], error: null });
f = fixture(shared); f.demo.invoiceAmount = "999"; f.demo.paidAmount = ""; await f.actions.applySharedPayment(); assert.deepEqual(f.stages, ["DECISION_PENDING"]); assert.equal(f.states[0].invoiceAmount, "100"); assert.equal(f.states[0].paidAmount, "150"); assert.equal(f.states[0].paymentConfirmedBy, "원 확인자"); assert.equal(f.states[0].paymentConfirmedAt, "2026-10-02"); assert.equal(f.states[0].invoiceRecipientType, "파트너사"); assert.ok(f.requests.every(r => r.action === "select"));
for (const patch of [{ payment_status: "UNPAID" }, { paid_amount: 99 }, { paid_at: "2026-02-30" }, { confirmed_by: "" }, { payer_name: "" }, { amount: "NaN" }]) {
  assert.equal(checks.isConfirmedInvoice({ ...paidInvoice, ...patch }), false);
  f = fixture(async table => table === "invoices" ? { data: { ...paidInvoice, ...patch }, error: null } : shared(table)); await f.actions.applySharedPayment(); assert.equal(f.stages.length, 0);
}
f = fixture(async table => table === "invoice_jobs" ? { data: [{ job_id: "other" }], error: null } : shared(table)); await f.actions.applySharedPayment(); assert.equal(f.stages.length, 0);
f = fixture(async table => table === "profiles" ? { data: null, error: null } : shared(table)); await f.actions.applySharedPayment(); assert.equal(f.stages.length, 0);
f = fixture(shared); f.demo.stage = "PACKAGE_READY"; await f.actions.applySharedPayment(); assert.equal(f.requests.length, 0);
f = fixture(shared, { editable: false }); await f.actions.applySharedPayment(); assert.equal(f.requests.length, 0);
f = fixture(shared, { local: true }); await f.actions.applySharedPayment(); assert.equal(f.requests.length, 0);
f = fixture(async () => { throw new Error("network"); }); await f.actions.applySharedPayment(); assert.equal(f.stages.length, 0); assert.equal(f.running.current, false);
f = fixture(async table => { if (table === "profiles") f.mounted.current = false; return shared(table); }); await f.actions.applySharedPayment(); assert.equal(f.stages.length, 0);
held = false;
f = fixture(table => { if (!held) { held = true; return new Promise(resolve => { release = resolve; }); } return shared(table); }); const pending = f.actions.applySharedPayment(); await new Promise(resolve => setTimeout(resolve, 0)); f.latestDemo.current = { ...f.demo, invoiceNo: "changed" }; release({ data: paidInvoice, error: null }); await pending; assert.equal(f.stages.length, 0);
const recoverable = { ...invoiceRow, issued_at: "2026-10-01", recipient_type: "PARTNER", recipient_name: "가상수신자", paid_at: null, paid_amount: null, confirmed_by: null, payer_name: null };
const recovery = async (table, action) => ({ data: table === "invoices" ? recoverable : action === "upsert" ? [{ invoice_id: "invoice", job_id: "j" }] : [], error: null });
f = fixture(recovery); await f.actions.recoverInvoiceLinks(); assert.deepEqual(f.stages, ["PAYMENT_PENDING"]); assert.ok(f.requests.every(r => r.table === "invoice_jobs" || r.action === "select")); assert.match(f.notices.at(-1), /사유: 연결 실패 복구/);
for (const patch of [{ amount: 99 }, { recipient_name: "다른 수신자" }, { issued_at: "2026-10-02" }, { payment_status: "PAID" }, { paid_amount: 1 }]) {
  f = fixture(async (table, action) => table === "invoices" ? { data: { ...recoverable, ...patch }, error: null } : recovery(table, action)); await f.actions.recoverInvoiceLinks(); assert.equal(f.stages.length, 0); assert.ok(!f.requests.some(r => r.action === "upsert"));
}
for (const options of [{ confirmed: false }, { reason: "" }, { reason: "x".repeat(501) }, { editable: false }]) { f = fixture(recovery, options); await f.actions.recoverInvoiceLinks(); assert.equal(f.stages.length, 0); assert.ok(!f.requests.some(r => r.action === "upsert")); }
f = fixture(async (table, action) => table === "invoice_jobs" ? { data: [{ job_id: "other" }], error: null } : recovery(table, action)); await f.actions.recoverInvoiceLinks(); assert.equal(f.stages.length, 0);
let linkRead = 0;
f = fixture(async (table, action) => table === "invoice_jobs" && action === "select" && ++linkRead === 2 ? { data: [{ invoice_id: "other-invoice", job_id: "j" }], error: null } : recovery(table, action)); await f.actions.recoverInvoiceLinks(); assert.equal(f.stages.length, 0);
f = fixture(async (table, action) => action === "upsert" ? { data: [], error: null } : recovery(table, action)); await f.actions.recoverInvoiceLinks(); assert.equal(f.stages.length, 0);
f = fixture(async (table, action) => table === "invoice_jobs" ? { data: [], error: null } : { data: action === "select" ? null : { id: "new-invoice" }, error: null }); await f.actions.recordInvoice(); assert.equal(f.stages.length, 0);
console.log("업무 단계 확정: 연결 복구·사유/취소·다른 청구/입금 기록 차단·Job 연결 저장 대조·통합 입금 반영 검사 통과 (DB/브라우저 모의, 트랜잭션 보장 별도)");
