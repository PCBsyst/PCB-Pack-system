import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/package-request-validation.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validatePackageRequest: validate } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const job = { id: "j1", jobNo: "QMS260001", standard: "ISO 9001", currentGrade: "심사원", candidateId: "c1", applicationId: "a1" };
function fixture() { return { context: { application: { id: "a1", applicationNo: "APP1", candidateId: "c1", jobIds: ["j1"] }, candidate: { id: "c1", name: "가상 후보자" }, jobs: [structuredClone(job)], review: {}, certificates: {}, decisions: {}, deliveryDocuments: {}, assessment: {}, panelMembers: [] }, jobs: [structuredClone(job)], languages: ["KR", "EN"] }; }
assert.equal(validate(fixture()), null);
for (const [key, value] of [["issueDate", "2026-02-29"], ["expiryDate", "2026-04-31"], ["draftIssuedAt", "26-01-01"], ["originalSentAt", null]]) {
  const request = fixture(); request.context.certificates.j1 = { [key]: value };
  assert.ok(validate(request), `${key}: 잘못된 인증 날짜 차단`);
}
const reversed = fixture(); reversed.context.certificates.j1 = { issueDate: "2026-09-15", expiryDate: "2026-09-14" };
assert.match(validate(reversed), /만료일이 전자본 발행일보다 빠릅니다/);
for (const dates of [{ issueDate: "2028-02-29", expiryDate: "2031-02-28" }, { issueDate: "2026-09-15", expiryDate: "2026-09-15" }, { issueDate: "", expiryDate: "", draftIssuedAt: "", originalSentAt: "" }]) {
  const request = fixture(); request.context.certificates.j1 = dates;
  const original = JSON.stringify(request);
  assert.equal(validate(request), null);
  assert.equal(JSON.stringify(request), original);
}
const unrelated = fixture(); unrelated.context.certificates.other = { issueDate: "invalid" };
assert.equal(validate(unrelated), null);
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
function scheduledFixture() {
  const value = fixture();
  value.context.examSchedules = { j1: { providerType: "PARTNER", providerName: "가상 연수기관", trainingEndDate: "2028-02-29", examNoticeDate: "2028-02-22", examDate: "2028-02-29" } };
  return value;
}
assert.equal(validate(scheduledFixture()), null);
const emptySchedule = scheduledFixture();
Object.assign(emptySchedule.context.examSchedules.j1, { providerName: "", trainingEndDate: "", examNoticeDate: "", examDate: "" });
assert.equal(validate(emptySchedule), null); // 미입력은 사실을 만들어 채우지 않는다.
for (const [key, invalid] of [["providerType", "UNKNOWN"], ["providerName", 123], ["providerName", "x".repeat(501)], ["providerName", "잘못\u0000된 값"], ["examDate", "2026-02-29"], ["examDate", "2026-04-31"], ["examDate", "26-01-01"], ["examDate", null], ["trainingEndDate", "2026-13-01"], ["examNoticeDate", "2026-01-00"]]) {
  const value = scheduledFixture(); value.context.examSchedules.j1[key] = invalid;
  assert.ok(validate(value), `${key}: 잘못된 입력 차단`);
}
const missingSchedule = scheduledFixture(); delete missingSchedule.context.examSchedules.j1;
assert.ok(validate(missingSchedule));
const arraySchedule = scheduledFixture(); arraySchedule.context.examSchedules = [];
assert.ok(validate(arraySchedule));
console.log("패키지 요청 정합성: 기존 연결 및 교육·시험 날짜 검사 통과");
