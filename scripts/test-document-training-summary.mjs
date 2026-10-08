import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import PizZip from "pizzip";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/document-training-summary.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { documentTrainingSummary: summary } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const schedule = { providerType: "PARTNER", providerName: "가상 교육기관", trainingEndDate: "2026-09-01", examNoticeDate: "2026-08-25", examDate: "2026-09-01" };
const identified = { ...schedule, providerInstitutionId: "private-org-id", providerDesignationNo: "TR-012" };
assert.match(summary(identified, "KR"), /지정번호: TR-012/);
assert.match(summary(identified, "EN"), /Designation number: TR-012/);
assert.ok(!summary(identified, "KR").includes("private-org-id"));
assert.match(summary(schedule, "KR"), /지정번호: -/);
assert.ok(!summary({ ...identified, providerType: "NON_PARTNER" }, "KR").includes("TR-012"));
assert.equal(summary(undefined, "KR"), "");
assert.match(summary(schedule, "KR"), /지정 연수기관/);
assert.match(summary({ ...schedule, providerType: "NON_PARTNER" }, "KR"), /비지정 교육기관/);
assert.match(summary(schedule, "EN"), /Designated training provider/);
assert.match(summary({ ...schedule, examDate: "" }, "KR"), /시험일: -$/);
for (const [route, template, placeholder, language] of [
  ["application-review", "FGPC-008-01-application-review-kr.docx", "reviewComment", "KR"],
  ["decision-report", "FGPC-012-01-decision-report-kr.docx", "assessmentComment", "KR"],
  ["delivery-confirmation", "FGPC-012-03-delivery-confirmation-en.docx", "note", "EN"],
]) {
  const source = fs.readFileSync(new URL(`../app/api/documents/${route}/route.ts`, import.meta.url), "utf8");
  assert.ok(source.includes("documentTrainingSummary(context.examSchedules?.[job.id], language)"));
  const zip = new PizZip(fs.readFileSync(new URL(`../templates/${template}`, import.meta.url)));
  const xml = zip.file("word/document.xml").asText();
  assert.ok(xml.includes(`{{${placeholder}}}`), `${route}: 양식 삽입 위치 확인`);
  const replaced = xml.replaceAll(`{{${placeholder}}}`, summary(identified, language));
  assert.ok(replaced.includes("TR-012"));
  for (const value of [schedule.providerName, schedule.trainingEndDate, schedule.examNoticeDate]) assert.ok(replaced.includes(value));
}
console.log("교육·시험 정보: 국영문 매핑, 미입력 처리, 세 Word 양식 삽입 검사 통과");
