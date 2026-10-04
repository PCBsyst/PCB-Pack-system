import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/action-document-records.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateActionDocumentInput: valid, actionDocumentFromRecords: map } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const input = { kind: "REPORT", jobId: "11111111-1111-1111-1111-111111111111", actionId: "22222222-2222-2222-2222-222222222222" };
const action = { id: input.actionId, job_id: input.jobId, certification_record_id: "old-cert", action_type: "SUSPENDED", standard_reason: "가상 사유", detail_reason: "가상 상세", effective_date: "2026-09-01", recorded_by_name: "가상 담당자", created_at: "2026-09-01T01:00:00Z" };
const job = { id: input.jobId, job_no: "QMS260099", management_no: 99, candidate_id: "c1" };
const certificate = { id: "old-cert", job_id: input.jobId, certification_no: "26130099", issue_date: "2026-01-01" };
const candidate = { id: "c1", name: "가상 후보자" };
assert.equal(valid(input), true);
for (const bad of [null, [], {}, { ...input, kind: "UNKNOWN" }, { ...input, jobId: "invalid" }, { ...input, actionId: 1 }]) assert.equal(valid(bad), false);
const original = JSON.stringify([input, action, job, certificate, candidate]);
const result = map({ ...input, candidateName: "변조 이름", certificationNo: "FAKE" }, action, job, certificate, candidate);
assert.equal(result.candidateName, candidate.name);
assert.equal(result.certificationNo, certificate.certification_no);
assert.equal(result.actionType, "SUSPENDED");
assert.equal(JSON.stringify([input, action, job, certificate, candidate]), original);
assert.equal(map(input, action, job, { ...certificate, id: "new-cert" }, candidate), null);
for (const [index, key, value] of [[0, "id", "other"], [0, "job_id", "other"], [0, "action_type", "UNKNOWN"], [0, "detail_reason", ""], [1, "candidate_id", "other"], [1, "management_no", -1], [2, "job_id", "other"], [2, "certification_no", ""], [3, "name", "잘못\u0000된 이름"]]) {
  const rows = structuredClone([action, job, certificate, candidate]); rows[index][key] = value;
  assert.equal(map(input, ...rows), null);
}
const route = fs.readFileSync(new URL("../app/api/documents/certification-action/route.ts", import.meta.url), "utf8");
assert.ok(route.indexOf("loadStoredActionDocument(input)") < route.indexOf("const bytes = await readFile"));
assert.ok(route.includes('recordDocumentResponse("certification_action", input.actionId'));
const loader = fs.readFileSync(new URL("../lib/server/action-document-records.ts", import.meta.url), "utf8");
assert.ok(loader.includes('eq("id", action.data.certification_record_id)'));
assert.ok(loader.includes('rpc("read_candidate_with_access_log"'));
assert.ok(!loader.includes("SERVICE_ROLE"));
const client = fs.readFileSync(new URL("../components/supabase-job-detail.tsx", import.meta.url), "utf8");
assert.ok(client.includes("JSON.stringify({ kind, jobId: view.id, actionId: record.id })"));
const serverTree = ts.createSourceFile("server.ts", loader, ts.ScriptTarget.Latest, true);
const declaration = serverTree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "loadStoredActionDocument").getText(serverTree).replace(/^export /, "");
const serverCode = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
async function loadScenario(overrides = {}) {
  const rows = { certification_actions: { data: action }, jobs: { data: job }, certification_records: { data: certificate }, candidate: { data: candidate }, ...overrides };
  const fakeClient = { from: (table) => ({ select() { return this; }, eq(key, id) { if (table === "certification_records") assert.equal(id, "old-cert"); return this; }, async maybeSingle() { return rows[table]; } }), rpc: async () => rows.candidate };
  const run = new Function("createClient", "actionDocumentFromRecords", `${serverCode}; return loadStoredActionDocument;`)(async () => fakeClient, map);
  return run(input);
}
assert.equal((await loadScenario()).ok, true);
for (const [override, status] of [[{ certification_actions: { error: {} } }, 503], [{ certification_actions: { data: null } }, 404], [{ certification_actions: { data: { ...action, job_id: "other" } } }, 409], [{ jobs: { data: null } }, 503], [{ candidate: { error: {} } }, 503], [{ certification_records: { data: { ...certificate, job_id: "other" } } }, 409]]) {
  const result = await loadScenario(override);
  assert.equal(result.ok, false); assert.equal(result.response.status, status);
}
console.log("정지·철회 문서 원본: ID 연결·과거 인증서 참조·변조 입력 미사용·잘못된 기록 거절 검사 통과 (운영 DB 검증 별도)");
