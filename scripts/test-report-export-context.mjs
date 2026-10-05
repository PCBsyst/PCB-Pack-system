import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (code) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const code = compile(fs.readFileSync(new URL("../lib/report-export.ts", import.meta.url), "utf8"));
const helpers = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const { reportExportMetadata, serializeReportCsv, reportApplicationTypeLabel, reportGroupLabel } = helpers;
const filters = { area: "K_BEAUTY", standard: "SMP", grade: "전문가", partner: '파트너,"가"', applicationType: "RENEWAL", certificationState: "SUSPENDED" };
const metadata = reportExportMetadata("테스트 보고서", "2026-10", "인증발행일", filters, new Date("2026-10-04T23:00:00Z"));
const fields = Object.fromEntries(metadata);
assert.equal(fields["분야 필터"], "K-Beauty"); assert.equal(fields["신청 유형 필터"], "갱신"); assert.equal(fields["현재 인증상태 필터"], "인증 정지");
assert.match(fields["생성 시각(한국)"], /2026.*10.*5/);
assert.equal(reportGroupLabel("TRANSFER", "applicationType"), "전환");
assert.equal(reportGroupLabel("알수없음", "applicationType"), "알수없음");
for (const dangerous of ['=SUM(1,2)', ' +SUM(1,2)', '-1+2', '@test', '\t=1', '\n=1']) assert.ok(serializeReportCsv([[dangerous]]).startsWith('"\''));
assert.equal(serializeReportCsv([['정상,"값"', "줄1\n줄2", 0, null]]), '"정상,""값""","줄1\n줄2","0",""');
const monthly = fs.readFileSync(new URL("../components/monthly-operations-report.tsx", import.meta.url), "utf8");
const exportBody = compile(monthly.slice(monthly.indexOf("  const exportCsv ="), monthly.indexOf("  const printReport =")));
let output;
const row = { receivedAt: "2026-09-01", issueDate: "2026-10-02", businessArea: "K_BEAUTY", candidateName: "가상후보", partner: filters.partner, applicationType: "RENEWAL", jobNo: "SMP260001", standard: "SMP", grade: "전문가", certificationNo: "TEST", certificationState: "SUSPENDED" };
const run = (loading, error, confirm = true) => new Function("loading", "error", "filtered", "areaLabel", "reportApplicationTypeLabel", "certificationLabel", "reportExportMetadata", "reportFilters", "month", "dateBasis", "downloadCsv", "window", `${exportBody};return exportCsv;`)(loading, error, [row], (value) => reportGroupLabel(value, "businessArea"), reportApplicationTypeLabel, helpers.reportStateLabel, reportExportMetadata, filters, "2026-10", "ISSUED", (rows) => { output = rows; }, { confirm: () => confirm })();
run(false, ""); assert.ok(output.some((item) => item[0] === "현재 인증상태 필터" && item[1] === "인증 정지"));
assert.equal(output.at(-1)[5], "갱신"); assert.equal(output.at(-1)[2], "K-Beauty");
output = undefined; run(true, ""); assert.equal(output, undefined); run(false, "error"); assert.equal(output, undefined);
run(false, "", false); assert.equal(output, undefined, "상세 CSV 확인 취소 시 파일 미생성");
assert.match(monthly, /setCertificationState\("전체"\)/); assert.match(monthly, /filters=\{reportFilters\}/);
for (const file of ["report-business-analytics", "report-certification-events"]) {
  const component = fs.readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), "utf8");
  assert.match(component, /reportExportMetadata\(/); assert.match(component, /serializeReportCsv\(/);
}
const downloadFixture = () => {
  let blob, clicks = 0;
  return { URL: { createObjectURL: (value) => { blob = value; return "blob:test"; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { clicks++; } }) }, setTimeout: () => {},
    text: async () => blob?.text(), clicks: () => clicks };
};
const analyticsSource = fs.readFileSync(new URL("../components/report-business-analytics.tsx", import.meta.url), "utf8");
const analyticsExport = compile(analyticsSource.slice(analyticsSource.indexOf("  function exportSummary()"), analyticsSource.indexOf("  if (!validMonth) return <section")));
const browser = downloadFixture();
const deps = { ...browser, Blob, validMonth: true, filters, period: "2026-10", customerBasisLabel: "발행", dimension: "applicationType", financeState: "error",
  groups: [{ name: "RENEWAL", total: 1, jobs: 1, active: 0, suspended: 1, withdrawn: 0, billed: 999, received: 999 }], trends: [], ...helpers };
new Function(...Object.keys(deps), `${analyticsExport};return exportSummary;`)(...Object.values(deps))();
const analysisCsv = await browser.text();
assert.equal(browser.clicks(), 1); assert.ok(analysisCsv.includes('"갱신"')); assert.ok(analysisCsv.includes('"현재 인증상태 필터","인증 정지"'));
assert.ok(analysisCsv.includes('"미확인","미확인"')); assert.ok(!analysisCsv.includes('"999"'));
const eventSource = fs.readFileSync(new URL("../components/report-certification-events.tsx", import.meta.url), "utf8");
const eventExport = compile(eventSource.slice(eventSource.indexOf("  function download()"), eventSource.indexOf("  return <div")));
const eventBrowser = downloadFixture();
const eventDeps = { ...eventBrowser, Blob, state: "ready", periods: ["2026-10"], filters, rows: [{ period: "2026-10", suspended: { customers: 1, events: 2 }, withdrawn: { customers: 0, events: 0 } }], ...helpers };
new Function(...Object.keys(eventDeps), `${eventExport};return download;`)(...Object.values(eventDeps))();
assert.equal(eventBrowser.clicks(), 1); const eventCsv = await eventBrowser.text();
assert.ok(eventCsv.includes('"집계 기준","상태 적용일"')); assert.ok(eventCsv.includes('"2026-10","1","2","0","0"'));
console.log("보고서 확장: 현재 상태 필터·실제 상세 CSV 내 필터/국문 값·한국 시각·오류 시 미출력·공통 CSV 수식 보호 검사 통과");
