import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = readFileSync("components/prototype-linked-rows.tsx", "utf8");
const ast = ts.createSourceFile("rows.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) { if (!callback && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") callback = node.arguments[0]; ts.forEachChild(node, visit); }
visit(ast);
const code = ts.transpileModule(`globalThis.start = ${callback.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const helperCode = ts.transpileModule(readFileSync("lib/bounded-row-reader.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const helpers = vm.createContext({ exports: {} }); vm.runInContext(helperCode, helpers);
const base = () => ({ id: "app", candidate_id: "candidate", candidates: { id: "candidate", name: "가상 후보자" }, jobs: [{ id: "job", application_id: "app", candidate_id: "candidate", job_no: "QMS260001", primary_owner_id: "staff" }] });
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function fixture(applications, options = {}) {
  const records = [], notices = [], calls = [];
  let resolve;
  const runtime = vm.createContext({ hasEnvVars: true, readBoundedRows: helpers.exports.readBoundedRows,
    setRecords: value => records.push(value), setNotice: value => notices.push(value),
    createClient: () => ({ from: table => {
      calls.push(table);
      const query = { select: () => query, order: () => query, in: () => query, range: () => {
        if (options.pending && table === "applications") return new Promise(done => { resolve = done; });
        const data = table === "applications" ? applications : table === "profiles" ? [{ id: "staff", display_name: "담당자" }] : [];
        return Promise.resolve({ data, count: data.length, error: options.profileFailure && table === "profiles" ? { message: "denied" } : null });
      } }; return query;
    } }),
  });
  vm.runInContext(code, runtime); const cleanup = runtime.start();
  return { records, notices, calls, cleanup, respond: value => resolve(value) };
}
for (const candidate of [{ id: "candidate", name: "가상 후보자" }, [{ id: "candidate", name: "가상 후보자" }]]) {
  const row = base(); row.candidates = candidate;
  const f = fixture([row]); await flush();
  assert.equal(f.records.at(-1)[0].candidateId, "candidate");
  assert.equal(f.records.at(-1)[0].jobId, "job");
  assert.equal(f.records.at(-1)[0].primaryOwner, "담당자"); assert.equal(f.notices.at(-1), "");
}
const invalid = [null, [], [{ id: "candidate" }, { id: "other" }], { id: "other" }];
for (const candidate of invalid) {
  const row = base(); row.candidates = candidate;
  const f = fixture([row]); await flush();
  assert.equal(f.records.at(-1).length, 0); assert.match(f.notices.at(-1), /조회 실패는 기록 없음이 아닙니다/);
  assert.deepEqual(f.calls, ["applications"]);
}
for (const jobs of [null, {}, [null], [{ id: "job", application_id: "other" }], [{ id: "", application_id: "app" }], [base().jobs[0], base().jobs[0]]]) {
  const row = base(); row.jobs = jobs; const f = fixture([row]); await flush();
  assert.equal(f.records.at(-1).length, 0); assert.match(f.notices.at(-1), /조회 실패/);
}
const second = base(); second.id = "app-2"; second.jobs[0].application_id = "app-2";
const wrongCandidate = base(); wrongCandidate.jobs[0].candidate_id = "other";
const wrong = fixture([wrongCandidate]); await flush(); assert.match(wrong.notices.at(-1), /조회 실패/);
const duplicate = fixture([base(), second]); await flush(); assert.match(duplicate.notices.at(-1), /조회 실패/);
const noJobs = base(); noJobs.jobs = []; const empty = fixture([noJobs]); await flush(); assert.equal(empty.notices.at(-1), "");
const denied = fixture([base()], { profileFailure: true }); await flush(); assert.match(denied.notices.at(-1), /조회 실패/);
const closed = fixture([base()], { pending: true }); const updates = closed.records.length;
closed.cleanup(); closed.respond({ data: [base()], count: 1, error: null }); await flush(); assert.equal(closed.records.length, updates);
assert.match(source, /jobs\(id, application_id,/);
console.log("공통 목록 실제 조회: 후보자·신청·Job 연결 대조, 중복/누락 차단, 빈 Job 허용, 담당자 실패 및 화면 종료 보호 통과 (DB 모의)");
