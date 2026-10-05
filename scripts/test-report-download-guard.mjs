import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
const compile = (file) => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const errorsUrl = moduleUrl(compile("../lib/document-errors.ts"));
const { verifiedReportCsv } = await import(moduleUrl(compile("../lib/report-download.ts").replace("@/lib/document-errors", errorsUrl).replace("@/lib/bounded-download", moduleUrl(compile("../lib/bounded-download.ts")))));
const bytes = new TextEncoder().encode('\ufeff"가상보고서"');
const headers = { "Content-Type": "text/csv;charset=utf-8", "X-Report-SHA256": createHash("sha256").update(bytes).digest("hex"), "X-Report-Byte-Size": String(bytes.length) };
assert.equal((await verifiedReportCsv(new Response(bytes, { headers }))).size, bytes.length);
for (const override of [{ "Content-Type": "text/html" }, { "X-Report-SHA256": "0".repeat(64) }, { "X-Report-Byte-Size": "1" }, { "X-Report-Byte-Size": "999999999" }]) {
  await assert.rejects(() => verifiedReportCsv(new Response(bytes, { headers: { ...headers, ...override } })));
}
await assert.rejects(() => verifiedReportCsv(Response.json({ error: "권한 없음" }, { status: 403 })), /권한 없음/);
const source = fs.readFileSync(new URL("../components/monthly-operations-report.tsx", import.meta.url), "utf8");
const body = source.slice(source.indexOf("  const exportCsv ="), source.indexOf("  const exportGroupedCsv ="));
function fixture(fetcher, confirm = true) {
  const notices = [], busy = []; let clicks = 0, calls = 0;
  const exporting = { current: false }, mounted = { current: true }, snapshot = { current: "original" };
  const deps = { exporting, mounted, exportSnapshot: snapshot, loading: false, error: "", filtered: [1], setExportBusy: (value) => busy.push(value), setExportNotice: (value) => notices.push(value),
    month: "2026-10", dateBasis: "ISSUED", reportFilters: { area: "ISO" }, verifiedReportCsv,
    fetch: async (...args) => { calls++; return fetcher(...args); },
    window: { confirm: () => confirm, setTimeout() {} }, URL: { createObjectURL: () => "blob:sample", revokeObjectURL() {} }, document: { createElement: () => ({ click() { clicks++; } }) } };
  const upload = new Function(...Object.keys(deps), `${body};return exportCsv;`)(...Object.values(deps));
  return { upload, notices, busy, mounted, snapshot, exporting, clicks: () => clicks, calls: () => calls };
}
let f = fixture(async () => new Response(bytes, { headers })); await f.upload(); assert.equal(f.clicks(), 1); assert.equal(f.exporting.current, false); assert.equal(f.busy.at(-1), false);
f = fixture(async () => { throw new Error("연결 실패"); }); await f.upload(); assert.equal(f.clicks(), 0); assert.equal(f.exporting.current, false);
f = fixture(async () => new Response(bytes, { headers }), false); await f.upload(); assert.equal(f.calls(), 0);
let release;
f = fixture(() => new Promise((resolve) => { release = resolve; })); const first = f.upload(); await f.upload(); assert.equal(f.calls(), 1);
f.snapshot.current = "changed"; release(new Response(bytes, { headers })); await first; assert.equal(f.clicks(), 0); assert.match(f.notices.at(-1), /조건이 바뀌어/);
f = fixture(() => new Promise((resolve) => { release = resolve; })); const pending = f.upload(); f.mounted.current = false; release(new Response(bytes, { headers })); await pending; assert.equal(f.clicks(), 0);
console.log("상세 CSV 실제 수신/저장 함수: 해시·크기·형식 검사·중복 클릭·조건 변경·화면 종료·권한 거절·실패 후 잠금 해제 통과 (브라우저 IO 모의)");
