import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function compile(path) {
  return ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
}
const packageModule = `data:text/javascript;base64,${Buffer.from(compile("../lib/package-request-validation.ts")).toString("base64")}`;
const documentCode = compile("../lib/document-request-validation.ts").replace("@/lib/package-request-validation", packageModule);
const { validateDocumentInput: validate } = await import(`data:text/javascript;base64,${Buffer.from(documentCode).toString("base64")}`);
const job = { id: "j1", jobNo: "QMS260001", standard: "ISO 9001", currentGrade: "심사원", candidateId: "c1", applicationId: "a1" };
const context = { application: { id: "a1", applicationNo: "APP1", candidateId: "c1", jobIds: ["j1"] }, candidate: { id: "c1", name: "시험 후보자" }, jobs: [job], review: {}, certificates: {}, decisions: {}, deliveryDocuments: {}, assessment: {}, panelMembers: [] };
assert.equal(validate({ context, job }, "KR").input.language, "KR");
assert.equal(validate({ context, job }, "EN").input.language, "EN");
assert.equal(validate({ context, job, language: "EN" }, "KR").input.language, "EN");
const badDates = structuredClone(context);
badDates.certificates.j1 = { issueDate: "2026-09-15", expiryDate: "2026-09-14" };
assert.equal(validate({ context: badDates, job }, "KR").ok, false);
badDates.certificates.j1 = { issueDate: "2026-02-29" };
assert.equal(validate({ context: badDates, job }, "KR").ok, false);
for (const value of [null, [], {}, { context }, { context, job, language: "JP" }, { context, job, language: null }, { context, job: { ...job, candidateId: "other" } }, { context, job: { ...job, standard: "other" } }]) {
  assert.equal(validate(value, "KR").ok, false);
}
for (const route of ["application-review", "decision-report", "delivery-confirmation"]) {
  const code = fs.readFileSync(new URL(`../app/api/documents/${route}/route.ts`, import.meta.url), "utf8");
  assert.match(code, /readValidatedDocumentRequest\(request/);
  assert.ok(code.indexOf("if (!parsed.ok)") < code.indexOf("loadDocumentTemplate(\""));
}
console.log("개별 문서 요청 검증 및 보호 연결 검사: 통과");
