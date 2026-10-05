import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const url = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = (code) => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = compile(read("../lib/operations-readiness.ts")).replace("@/lib/mfa-requirement", url(compile(read("../lib/mfa-requirement.ts")))).replace("@/lib/operation-mode", url(compile(read("../lib/operation-mode.ts"))));
const linked = module.replace("@/lib/staff-session", url(compile(read("../lib/staff-session.ts"))));
const idleLinked = linked.replace("@/lib/server-idle-session", url(compile(read("../lib/server-idle-session.ts"))));
const { probeOperationsReadiness, databaseReadinessChecks, policyReadinessChecks } = await import(url(idleLinked));
const calls = [];
let failTable = "", failPolicy = "";
const client = {
  from(table) { return { select(columns) { return { async limit(count) { calls.push({ table, columns, count }); if (table === failTable) throw new Error("통신 실패"); return { error: null }; } }; } }; },
  async rpc(name) { calls.push({ rpc: name }); return name === failPolicy ? { data: null, error: { code: "PGRST202", message: name } } : { error: null, data: name === "has_live_staff_session" ? true : name === "get_mfa_policy" ? { required: false, updatedAt: "2026-10-05T01:00:00Z" } : { active: true, paused: ["DOCUMENT_GENERATION"], endsOn: "2026-10-10", updatedAt: "2026-10-05T01:00:00Z" } }; },
};
let results = await probeOperationsReadiness(client);
assert.equal(results.length, 14);
assert.ok(calls.filter((call) => call.table).every((call) => call.count === 0));
assert.deepEqual(calls.filter((call) => call.rpc).map((call) => call.rpc).sort(), ["get_mfa_policy", "get_operation_mode", "get_staff_idle_status", "has_live_staff_session"]);
assert.match(results.find((item) => item.id === "mfaPolicy").detail, /OFF/);
assert.match(results.find((item) => item.id === "operationMode").detail, /중지 1개/);
failTable = "application_workspaces"; failPolicy = "get_mfa_policy";
results = await probeOperationsReadiness(client);
assert.equal(results.find((item) => item.id === "workspaces").status, "ERROR");
assert.equal(results.find((item) => item.id === "mfaPolicy").status, "PENDING");
assert.equal(results.find((item) => item.id === "certificates").status, "READABLE");

const source = compile(read("../components/operations-readiness.tsx"));
const body = source.slice(source.indexOf("    async function check()"), source.indexOf("    useEffect("));
function fixture({ authorized = true, env = true } = {}) {
  const checking = { current: false }, scope = { current: 0 }, rows = [], busy = [], notices = [], times = [];
  let probes = 0, release;
  const deps = { checking, scope, hasEnvVars: env, databaseReadinessChecks, policyReadinessChecks,
    setBusy: (value) => busy.push(value), setNotice: (value) => notices.push(value), setResults: (value) => rows.push(value), setCheckedAt: (value) => times.push(value),
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { active: true, is_owner: authorized }, error: null }) }) }) }) }),
    probeOperationsReadiness: async () => { probes++; return new Promise((resolve) => { release = resolve; }); } };
  const check = new Function(...Object.keys(deps), `${body};return check;`)(...Object.values(deps));
  return { check, scope, rows, busy, notices, times, probes: () => probes, release: () => release([{ id: "test", status: "READABLE" }]) };
}
let f = fixture(); const first = f.check(); await new Promise((resolve) => setTimeout(resolve, 0)); await f.check(); assert.equal(f.probes(), 1); f.release(); await first; assert.equal(f.rows.at(-1)[0].id, "test"); assert.equal(f.busy.at(-1), false);
f = fixture(); const pending = f.check(); await new Promise((resolve) => setTimeout(resolve, 0)); f.scope.current++; f.release(); await pending; assert.deepEqual(f.rows.at(-1), []); assert.equal(f.times.at(-1), "");
f = fixture({ authorized: false }); await f.check(); assert.equal(f.probes(), 0); assert.match(f.notices.at(-1), /권한/);
f = fixture({ env: false }); await f.check(); assert.equal(f.probes(), 0); assert.ok(f.rows.at(-1).every((row) => row.status === "UNTESTED"));
console.log("운영 점검: 고객 0행 조회·읽기 전용 정책·개별 장애 격리·권한 거절·중복 클릭·화면 종료·가상모드 미검증 표시 통과 (운영 DB/브라우저 모의)");
