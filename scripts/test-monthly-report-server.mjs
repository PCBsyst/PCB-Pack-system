import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
const compile = (file) => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const load = async (file) => import(`data:text/javascript;base64,${Buffer.from(compile(file)).toString("base64")}`);
const records = await load("../lib/monthly-report-records.ts");
const filtersHelper = await load("../lib/report-filters.ts");
const exportHelper = await load("../lib/report-export.ts");
const bounded = await load("../lib/bounded-row-reader.ts");
const { privateDocumentResponse } = await load("../lib/private-document-response.ts");
const route = compile("../app/api/reports/monthly-csv/route.ts").replace(/^import .*;\r?$/gm, "").replace(/export /g, "");
const application = { id: "application-1", received_at: "2026-09-01", business_area: "ISO", partner_name_snapshot: "가상파트너", application_type: "RENEWAL",
  jobs: [{ id: "job-1", job_no: "QMS260001", standard: "ISO 9001", grade: "A", certification_state: "ACTIVE", candidates: { name: '=HYPERLINK("bad")' }, certification_records: [{ history_state: "CURRENT", issue_date: "2026-10-01", certification_no: "TEST", state: "SUSPENDED" }] }] };
const filters = { area: "전체", standard: "전체", partner: "전체", grade: "전체", applicationType: "전체", certificationState: "전체" };
const input = { month: "2026-10", dateBasis: "ISSUED", filters };
function fixture({ denied = null, data = [application], dbError = null, audit = true, pageQuery } = {}) {
  let queries = 0; const logs = [];
  const query = { select() { return this; }, order() { return this; }, range: async (from, to) => { queries++; return pageQuery ? pageQuery(from, to) : { data: Array.isArray(data) ? data.slice(from, to + 1) : data, count: Array.isArray(data) ? data.length : null, error: dbError }; } };
  const deps = { createHash, requireApiStaff: async () => denied, createClient: async () => ({ from: () => query }), recordMonthlyReportAccess: async (...args) => { logs.push(args); return audit; }, privateDocumentResponse, ...records, ...filtersHelper, ...exportHelper, ...bounded };
  const POST = new Function(...Object.keys(deps), `${route}; return POST;`)(...Object.values(deps));
  return { POST, logs, queries: () => queries };
}
const request = (body = input, origin = "https://example.com") => new Request("https://example.com/api/reports/monthly-csv", { method: "POST", headers: { Origin: origin }, body: typeof body === "string" ? body : JSON.stringify(body) });
let f = fixture(); let response = await f.POST(request());
assert.equal(response.status, 200); const bytes = new Uint8Array(await response.arrayBuffer()); const csv = new TextDecoder().decode(bytes);
assert.ok(csv.includes("다운로드 요청 시 서버 재조회")); assert.ok(csv.includes("갱신")); assert.ok(csv.includes("인증 정지")); assert.ok(csv.includes('"\'=HYPERLINK'));
assert.equal(response.headers.get("X-Report-SHA256"), createHash("sha256").update(bytes).digest("hex")); assert.equal(Number(response.headers.get("X-Report-Byte-Size")), bytes.length);
assert.match(response.headers.get("Cache-Control"), /no-store/); assert.deepEqual(f.logs[0][0], ["application-1"]); assert.ok(f.logs[0][1].length <= 100);
for (const body of [{ ...input, candidateName: "위조" }, { ...input, month: ["2026-10"] }, { ...input, month: "" }, { ...input, filters: { ...filters, forged: "test" } }, "{bad", "x".repeat(8193)]) {
  f = fixture(); response = await f.POST(request(body)); assert.ok([400, 413].includes(response.status)); assert.equal(f.queries(), 0); assert.equal(f.logs.length, 0);
}
f = fixture({ denied: Response.json({ error: "권한 없음" }, { status: 403 }) }); response = await f.POST(request()); assert.equal(response.status, 403); assert.equal(f.queries(), 0);
f = fixture(); response = await f.POST(request(input, "https://other.example")); assert.equal(response.status, 403); assert.equal(f.queries(), 0);
for (const options of [{ audit: false }, { dbError: { message: "private db details" } }, { data: null }, { data: [{ ...application, jobs: [{ ...application.jobs[0], candidates: null }] }] }]) {
  f = fixture(options); response = await f.POST(request()); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes("private db details"));
}
f = fixture(); response = await f.POST(request({ ...input, dateBasis: "RECEIVED" })); assert.equal(response.status, 409); assert.equal(f.logs.length, 0);
f = fixture({ data: Array.from({ length: 101 }, (_, index) => ({ ...application, id: `app-${index}`, jobs: [{ ...application.jobs[0], id: `job-${index}` }] })) });
response = await f.POST(request()); assert.equal(response.status, 413); assert.equal(f.logs.length, 0);
assert.throws(() => records.normalizeMonthlyReportRecords(null));
const duplicateCurrent = { ...application, jobs: [{ ...application.jobs[0], certification_records: [application.jobs[0].certification_records[0], { ...application.jobs[0].certification_records[0], issue_date: "2026-10-02" }] }] };
f = fixture({ data: [duplicateCurrent] }); response = await f.POST(request()); assert.equal(response.status, 503); assert.equal(f.logs.length, 0);
assert.throws(() => records.normalizeMonthlyReportRecords([duplicateCurrent]));
assert.equal(records.selectCurrentReportCertification(null), undefined);
assert.equal(records.selectCurrentReportCertification([{ history_state: "REPLACED" }]), undefined);
assert.equal(records.selectCurrentReportCertification([{ history_state: "REPLACED" }, application.jobs[0].certification_records[0]]).certification_no, "TEST");
for (const malformed of [[null], [{}], ["CURRENT"], [{ history_state: 42 }]]) assert.throws(() => records.selectCurrentReportCertification(malformed));
const many = Array.from({ length: 501 }, (_, index) => ({ ...application, id: `app-${index}`, jobs: index === 0 ? application.jobs : [] }));
f = fixture({ data: many }); response = await f.POST(request()); assert.equal(response.status, 200); assert.equal(f.queries(), 2); assert.equal(f.logs.length, 1);
for (const pageQuery of [
  () => ({ data: [application], count: 501, error: null }),
  () => ({ data: [application], count: null, error: null }),
  () => ({ data: [application, application], count: 2, error: null }),
  (from, to) => ({ data: many.slice(from, to + 1), count: from ? 500 : 501, error: null }),
]) {
  f = fixture({ pageQuery }); response = await f.POST(request()); assert.equal(response.status, 503); assert.equal(f.logs.length, 0); assert.match(response.headers.get("Cache-Control"), /no-store/);
}
f = fixture({ pageQuery: () => ({ data: [], count: 10001, error: null }) }); response = await f.POST(request()); assert.equal(response.status, 413); assert.equal(f.logs.length, 0);
const controller = new AbortController(); controller.abort();
f = fixture(); response = await f.POST(new Request("https://example.com/api/reports/monthly-csv", { method: "POST", body: JSON.stringify(input), signal: controller.signal }));
assert.equal(response.status, 408); assert.equal(f.queries(), 0); assert.equal(f.logs.length, 0);
const during = new AbortController();
f = fixture({ pageQuery: () => { during.abort(); return { data: [application], count: 1, error: null }; } });
response = await f.POST(new Request("https://example.com/api/reports/monthly-csv", { method: "POST", body: JSON.stringify(input), signal: during.signal }));
assert.equal(response.status, 408); assert.equal(f.queries(), 1); assert.equal(f.logs.length, 0);
console.log("상세 보고서 실제 API: 서버 재조회·국문 CSV/수식 보호·파일 해시·권한/요청/대상 제한·접근이력 실패 시 미응답 통과 (DB/인증 모의)");
