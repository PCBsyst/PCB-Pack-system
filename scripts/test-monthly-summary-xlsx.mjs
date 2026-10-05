import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import PizZip from "pizzip";
const require = createRequire(import.meta.url);
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const xlsxUrl = url(compile("../lib/report-xlsx.ts").replace('"pizzip"', JSON.stringify(pathToFileURL(require.resolve("pizzip")).href)));
const { createReportXlsx } = await import(xlsxUrl);
const { buildMonthlySummaryXlsx } = await import(url(compile("../lib/monthly-report-xlsx.ts").replace("@/lib/report-xlsx", xlsxUrl).replace("@/lib/report-export", url(compile("../lib/report-export.ts")))));
const rows = [
  { businessArea: "ISO", standard: "ISO 9001", grade: "A", applicationType: "INITIAL", certificationState: "ACTIVE", certificationNo: "SECRET_CERT", candidateName: "SECRET_NAME" },
  { businessArea: "ISO", standard: "ISO 9001", grade: "PA", applicationType: "RENEWAL", certificationState: "SUSPENDED", certificationNo: "SECRET_CERT", email: "SECRET_MAIL" },
  { businessArea: "K_BEAUTY", standard: '=HYPERLINK("x")<&', grade: "A", applicationType: "TRANSFER", certificationState: "NONE", certificationNo: "" },
];
const blob = buildMonthlySummaryXlsx([["대상 기간", "2026-10"]], rows);
assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
const zip = new PizZip(await blob.arrayBuffer());
assert.equal(Object.keys(zip.files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length, 5);
const workbook = zip.file("xl/workbook.xml").asText();
for (const name of ["조회 조건", "전체 요약", "표준별 현황", "등급별 현황", "유형별 현황"]) assert.ok(workbook.includes(name));
const all = Object.values(zip.files).filter(file => !file.dir).map(file => file.asText()).join("\n");
for (const secret of ["SECRET_NAME", "SECRET_CERT", "SECRET_MAIL"]) assert.ok(!all.includes(secret));
assert.ok(!all.includes("<f>"), "사용자 문자열은 수식으로 해석하지 않음");
assert.ok(all.includes("&lt;&amp;"));
const summary = zip.file("xl/worksheets/sheet2.xml").asText();
assert.match(summary, /<c r="B2" s="2"><v>3<\/v>/);
assert.match(summary, /<c r="B3" s="2"><v>2<\/v>/);
for (const i of [3, 4, 5]) {
  const sheet = zip.file(`xl/worksheets/sheet${i}.xml`).asText();
  assert.ok(sheet.includes('state="frozen"')); assert.ok(sheet.includes("<autoFilter"));
  const totals = [...sheet.matchAll(/<c r="C(\d+)" s="2"><v>(\d+)<\/v>/g)].reduce((sum, value) => sum + Number(value[2]), 0);
  assert.equal(totals, rows.length);
}
assert.throws(() => buildMonthlySummaryXlsx([], []));
assert.throws(() => createReportXlsx([{ name: "불가/시트", rows: [["항목"]], widths: [20] }]));
assert.throws(() => createReportXlsx([{ name: "시트", rows: [[NaN]], widths: [20] }]));
const ui = fs.readFileSync(new URL("../components/monthly-operations-report.tsx", import.meta.url), "utf8");
assert.ok(ui.includes("onClick={exportSummaryXlsx}"));
assert.ok(ui.includes('await import("@/lib/monthly-report-xlsx")'));
assert.ok(ui.includes("snapshot !== exportSnapshot.current"));
console.log("월간 집계 XLSX: 5개 시트·숫자 자료형·집계 합계·고객 원문 제외·문자열 수식 차단·필터/고정행 검사 통과 (Excel 앱 시각 검수 별도)");
