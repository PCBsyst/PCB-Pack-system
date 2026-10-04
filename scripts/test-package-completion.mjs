import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (file) => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const matching = `data:text/javascript;base64,${Buffer.from(compile("../lib/package-workspace-matching.ts")).toString("base64")}`;
const code = compile("../lib/package-completion-policy.ts").replace("@/lib/package-workspace-matching", matching);
const { canAttachPackageGeneration: attach } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const original = { application: { id: "a1", applicationNo: "APP1" }, candidate: { id: "c1", name: "시험 후보자" }, jobs: [{ id: "j1", jobNo: "QMS1", candidateId: "c1", standard: "ISO 9001", currentGrade: "심사원" }], reviewRequirements: {}, review: {}, invoiceNo: "INV1", invoiceAmount: "1", invoiceIssuedAt: "", paidAmount: "1", paymentConfirmedAt: "", panelMembers: [], decisionDate: "", finalApprover: "대표자", finalApprovalDate: "", englishText: {}, assessment: { j1: {} }, decisions: { j1: {} }, certificates: { j1: { issueDate: "2026-10-01" } }, deliveryDocuments: { j1: {} } };
assert.equal(attach(original, structuredClone(original)), true);
for (const change of [(v) => v.review.result = "부적합", (v) => v.certificates.j1.issueDate = "2026-10-02", (v) => v.candidate.name = "다른 후보자", (v) => v.jobs[0].currentGrade = "다른 등급", (v) => v.application.id = "other", (v) => v.jobs = []]) {
  const current = structuredClone(original); change(current); assert.equal(attach(original, current), false);
}
const uiOnly = structuredClone(original); uiOnly.stage = "PACKAGE_READY"; uiOnly.dateAuditLogs = [];
assert.equal(attach(original, uiOnly), true);
const serverCode = fs.readFileSync(new URL("../app/api/documents/package/route.ts", import.meta.url), "utf8");
assert.ok(serverCode.indexOf("const finalRecordError") < serverCode.indexOf("const receipt = await recordPackageGeneration"));
console.log("생성 중 입력 변경 및 오래된 완료 기록 방지 검사: 통과");
