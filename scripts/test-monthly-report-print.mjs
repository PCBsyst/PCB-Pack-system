import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (code) => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportUrl = `data:text/javascript;base64,${Buffer.from(compile(fs.readFileSync(new URL("../lib/report-export.ts", import.meta.url), "utf8"))).toString("base64")}`;
const helper = compile(fs.readFileSync(new URL("../lib/monthly-report-print.ts", import.meta.url), "utf8")).replace("@/lib/report-export", exportUrl);
const { buildMonthlyReportPrintHtml } = await import(`data:text/javascript;base64,${Buffer.from(helper).toString("base64")}`);
const input = { month: "2026-10", metadata: [["등급 필터", '<img src=x onerror="alert(1)">']], summary: { total: 1, issued: 1, active: 1, suspended: 0, withdrawn: 0 }, groups: [{ area: "ISO", standard: "ISO 9001", received: 1, issued: 1, active: 1, suspended: 0, withdrawn: 0 }] };
let html = buildMonthlyReportPrintHtml(input);
assert.ok(!html.includes("<img")); assert.ok(html.includes("&lt;img")); assert.ok(html.includes("등급 필터"));
assert.ok(!html.includes("대상 상세 (고객정보 포함)")); assert.match(html, /display:table-header-group/); assert.match(html, /overflow-wrap:anywhere/);
const detail = { candidateName: '가상후보 <script>alert(1)</script>', partner: "가상파트너", jobNo: "QMS260001", standard: "ISO 9001", grade: "A", applicationType: "RENEWAL", certificationNo: "TEST", certificationState: "SUSPENDED", receivedAt: "2026-09-01", issueDate: "2026-10-01" };
html = buildMonthlyReportPrintHtml({ ...input, details: Array.from({ length: 40 }, () => detail) });
assert.ok(html.includes("대상 상세 (고객정보 포함)")); assert.ok(html.includes("갱신")); assert.ok(html.includes("인증 정지"));
assert.ok(!html.includes("<script>alert(1)</script>")); assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
assert.equal((html.match(/QMS260001/g) ?? []).length, 40);
const source = fs.readFileSync(new URL("../components/monthly-operations-report.tsx", import.meta.url), "utf8");
const handler = compile(source.slice(source.indexOf("  const printReport ="), source.indexOf("  return <div")));
function printFixture({ include = false, confirm = true, blocked = false, loading = false } = {}) {
  const notices = []; let opens = 0, output;
  const deps = { setExportNotice: (value) => notices.push(value), loading, error: "", filtered: [detail], includePrintDetails: include, month: "2026-10", summary: input.summary, grouped: input.groups,
    reportExportMetadata: () => input.metadata, reportFilters: {}, dateBasis: "ISSUED", buildMonthlyReportPrintHtml,
    window: { confirm: () => confirm, open: () => { opens++; return blocked ? null : { document: { write(value) { output = value; }, close() {} }, close() {} }; } } };
  new Function(...Object.keys(deps), `${handler};return printReport;`)(...Object.values(deps))();
  return { notices, opens, output };
}
assert.equal(printFixture({ include: true, confirm: false }).opens, 0);
assert.equal(printFixture({ loading: true }).opens, 0);
assert.match(printFixture({ blocked: true }).notices.at(-1), /팝업/);
assert.ok(!printFixture().output.includes("가상후보")); assert.ok(printFixture({ include: true }).output.includes("가상후보"));
const groupHandler = compile(source.slice(source.indexOf("  const exportGroupedCsv ="), source.indexOf("  const printReport =")));
let groupedExport;
const groupDeps = { loading: false, error: "", filtered: [detail], reportExportMetadata: () => input.metadata, month: "2026-10", dateBasis: "ISSUED", reportFilters: {}, grouped: input.groups, areaLabel: (value) => value,
  downloadCsv: (value) => { groupedExport = value; } };
new Function(...Object.keys(groupDeps), `${groupHandler};return exportGroupedCsv;`)(...Object.values(groupDeps))();
assert.ok(!JSON.stringify(groupedExport).includes(detail.candidateName)); assert.ok(!JSON.stringify(groupedExport).includes(detail.jobNo));
assert.ok(groupedExport.some((row) => row[0] === "ISO" && row[1] === "ISO 9001"));
assert.match(source, /표준별 집계 CSV/); assert.match(source, /집계 CSV·인쇄는 서버 접근이력에 기록되지/);
console.log("보고서 출력 실제 함수: 조건 표시·기본 고객 상세 제외·동의 취소·팝업 차단·HTML 삽입 방지·40건 내용 보존 통과 (실제 인쇄 배치 검증 별도)");
