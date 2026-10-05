import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/server/report-access.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\r?$/gm, "").replace(/export /g, "");
function fixture({ user = { id: "staff" }, error = null, secret = "fake-test-key", rpcError = null } = {}) {
  const events = []; let admins = 0, current = 0, max = 0;
  const record = new Function("createClient", "createAdminClient", "process", `${code};return recordMonthlyReportAccess;`)(
    async () => ({ auth: { getUser: async () => ({ data: { user }, error }) } }),
    () => { admins++; return { rpc: async (name, args) => { current++; max = Math.max(max, current); events.push({ name, args }); await new Promise((resolve) => setTimeout(resolve, 0)); current--; return { error: rpcError }; } }; },
    { env: { SUPABASE_SERVICE_ROLE_KEY: secret, NEXT_PUBLIC_SUPABASE_URL: "https://sample.supabase.co" } });
  return { record, events, admins: () => admins, max: () => max };
}
let f = fixture(); assert.equal(await f.record(Array.from({ length: 11 }, (_, index) => `app-${index}`), "CSV 2026-10 ISSUED hash"), true);
assert.equal(f.events.length, 11); assert.equal(f.max(), 5); assert.ok(f.events.every((event) => event.name === "record_privacy_access" && event.args.event_actor === "staff" && event.args.target_type === "application"));
for (const options of [{ user: null }, { error: { message: "auth" } }, { secret: "" }]) { f = fixture(options); assert.equal(await f.record(["app"], "CSV"), false); assert.equal(f.admins(), 0); }
f = fixture({ rpcError: { message: "unavailable" } }); assert.equal(await f.record(["app"], "CSV"), false);
f = fixture(); assert.equal(await f.record([], "CSV"), false); assert.equal(await f.record(Array(101).fill("app"), "CSV"), false); assert.equal(await f.record(["app"], "x".repeat(101)), false);
console.log("보고서 접근 기록: 실제 저장 함수의 직원 검증·신청별 기록·5건 병렬 제한·설정/인증/SQL 실패 차단 통과 (운영 DB 미검증)");
