import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/document-translation-checks.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { documentTranslationIssues: issues, documentTranslationMessage: message } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const context = { jobs: [{ id: "j1", jobNo: "TEST-001" }, { id: "j2", jobNo: "TEST-002" }], review: { comment: "국문검토", verificationComment: "국문검증" }, panelMembers: [{ name: "위원1", selected: true, comment: "심의" }, { name: "위원2", selected: false, comment: "제외" }], decisions: { j1: { comment: "승인" }, j2: { comment: "선택제외" } }, englishText: {} };
assert.deepEqual(issues(context, ["j1"], ["DELIVERY_CONFIRMATION"]), []);
assert.equal(issues(context, ["j1"], ["APPLICATION_REVIEW"]).length, 2);
const missing = issues(context, ["j1"], ["CERTIFICATION_DECISION_REPORT"]);
assert.equal(missing.length, 4);
assert.ok(missing.includes("TEST-001 최종 승인 의견 (영문)"));
assert.ok(!missing.some((item) => item.includes("위원2") || item.includes("TEST-002")));
assert.ok(message(missing).includes("입력하고 저장"));
const filled = structuredClone(context);
filled.englishText = { reviewComment: "Reviewed", verificationComment: "Verified", panelComments: { 위원1: "Approved" }, decisionComments: { j1: "Approved" } };
assert.deepEqual(issues(filled, ["j1"], ["APPLICATION_REVIEW", "CERTIFICATION_DECISION_REPORT"]), []);
filled.englishText.reviewComment = "   ";
assert.deepEqual(issues(filled, ["j1"], ["APPLICATION_REVIEW"]), ["서류검토 의견 (영문)"]);
filled.review.comment = ""; filled.review.verificationComment = "";
assert.deepEqual(issues(filled, ["j1"], ["APPLICATION_REVIEW"]), []);
for (const route of ["application-review", "decision-report", "package"]) {
  const text = fs.readFileSync(new URL(`../app/api/documents/${route}/route.ts`, import.meta.url), "utf8");
  assert.ok(text.includes("documentTranslationIssues(context"));
  assert.ok(text.indexOf("documentTranslationIssues(context") < text.indexOf("const output ="));
}
const ui = fs.readFileSync(new URL("../components/application-detail.tsx", import.meta.url), "utf8");
assert.ok(ui.includes("documentTranslationIssues(packageContext"));
console.log("영문 의견 누락: 문서 범위·선택 Job/위원·빈값·화면/API 생성 전 차단 검사 통과");
