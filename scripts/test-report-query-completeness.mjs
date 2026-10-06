import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/report-query-completeness.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { verifyReportPage: page, verifyReportTotal: total } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
assert.equal(page({ data: [], count: 0, error: null }), 0);
assert.equal(page({ data: [{ id: "a" }], count: 501, error: null }, 501), 501);
for (const count of [undefined, null, -1, NaN, 0.5, 10001]) assert.throws(() => page({ data: [], count, error: null }));
assert.throws(() => page({ data: [], count: 1, error: null }, 2));
assert.throws(() => page({ data: Array(501).fill({ id: "a" }), count: 501, error: null }));
total([{ id: "a" }, { id: "a" }], 1);
total([], 0);
assert.throws(() => total([{ id: "a" }], 2));
assert.throws(() => total([{ id: "a" }, { id: "b" }], 1));
assert.throws(() => total([{ id: "" }], 1));
for (const file of ["monthly-operations-report", "report-business-analytics", "report-certification-events"]) {
  const source = fs.readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), "utf8");
  assert.ok(source.includes('{ count: "exact" }')); assert.ok(source.includes("verifyReportPage(")); assert.ok(source.includes("verifyReportTotal("));
}
console.log("보고서 조회 범위: 정확 행 수·누락/초과·조회 중 행 수 변경·잘린 페이지·조회 한도·세 화면 연결 검사 통과 (운영 DB 동시성/고정 스냅샷 별도)");
