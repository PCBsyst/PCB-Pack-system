import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../components/monthly-operations-report.tsx", import.meta.url), "utf8");
const body = source.slice(source.indexOf("  const exportSummaryXlsx ="), source.indexOf("  const printReport ="));
const code = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('import("@/lib/monthly-report-xlsx")', "load()");
function fixture(load) {
  let clicks = 0, calls = 0;
  const notices = [], busy = [], exporting = { current: false }, mounted = { current: true }, snapshot = { current: "original" };
  const deps = { exporting, mounted, exportSnapshot: snapshot, loading: false, error: "", filtered: [{ grade: "A" }], month: "2026-10", dateBasis: "RECEIVED", reportFilters: {}, reportExportMetadata: () => [["기간", "2026-10"]], setExportBusy: value => busy.push(value), setExportNotice: value => notices.push(value), load: () => { calls++; return load(); }, URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} }, document: { createElement: () => ({ click() { clicks++; } }) }, window: { setTimeout() {} } };
  const run = new Function(...Object.keys(deps), `${code};return exportSummaryXlsx;`)(...Object.values(deps));
  return { run, exporting, mounted, snapshot, notices, busy, clicks: () => clicks, calls: () => calls };
}
const ready = { buildMonthlySummaryXlsx: () => new Blob(["test"]) };
let f = fixture(async () => ready); await f.run(); assert.equal(f.clicks(), 1); assert.equal(f.exporting.current, false); assert.equal(f.busy.at(-1), false);
f = fixture(async () => { throw new Error("읽기 실패"); }); await f.run(); assert.equal(f.clicks(), 0); assert.match(f.notices.at(-1), /읽기 실패/); assert.equal(f.exporting.current, false);
let release;
f = fixture(() => new Promise(resolve => { release = resolve; })); const pending = f.run(); await f.run(); assert.equal(f.calls(), 1); f.snapshot.current = "changed"; release(ready); await pending; assert.equal(f.clicks(), 0); assert.match(f.notices.at(-1), /조건이 바뀌/);
f = fixture(() => new Promise(resolve => { release = resolve; })); const stopped = f.run(); f.mounted.current = false; release(ready); await stopped; assert.equal(f.clicks(), 0);
console.log("Excel 집계 UI: 정상 저장 요청·중복 클릭·조건 변경·화면 종료·생성 실패 후 재시도 잠금 해제 검사 통과 (브라우저 IO 모의)");
