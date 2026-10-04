import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/package-request-validation.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validatePackageRequest: validate } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const job = { id: "j1", jobNo: "QMS260001", standard: "ISO 9001", currentGrade: "심사원", candidateId: "c1", applicationId: "a1" };
function fixture() { return { context: { application: { id: "a1", applicationNo: "APP1", candidateId: "c1", jobIds: ["j1"] }, candidate: { id: "c1", name: "가상 후보자" }, jobs: [structuredClone(job)], review: {}, certificates: {}, decisions: {}, deliveryDocuments: {}, assessment: {}, panelMembers: [] }, jobs: [structuredClone(job)], languages: ["KR", "EN"] }; }
assert.equal(validate(fixture()), null);
assert.ok(validate(null));
for (const change of [
  (v) => v.jobs.push(v.jobs[0]),
  (v) => v.languages.push("KR"),
  (v) => v.context.candidate.id = "other",
  (v) => v.jobs[0].candidateId = "other",
  (v) => v.jobs[0].applicationId = "other",
  (v) => v.jobs[0].standard = "ISO 14001",
  (v) => v.context.application.jobIds = [],
  (v) => delete v.context.review,
  (v) => v.jobs[0].jobNo = "",
  (v) => v.languages = ["JP"],
]) { const value = fixture(); change(value); assert.ok(validate(value)); }
const collision = fixture();
collision.jobs[0].jobNo = "QMS/1";
const second = { ...collision.jobs[0], id: "j2", jobNo: "QMS_1" };
collision.jobs.push(second); collision.context.jobs = structuredClone(collision.jobs); collision.context.application.jobIds.push("j2");
assert.ok(validate(collision));
console.log("패키지 요청 정합성: 13건 검사 통과");
