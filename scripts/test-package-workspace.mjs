import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/package-workspace-matching.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { matchesPackageWorkspace: match } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const context = { reviewRequirements: { education: "충족" }, review: { result: "적합", comment: "확인" }, invoiceNo: "INV1", invoiceAmount: "100", invoiceIssuedAt: "2026-10-01", paidAmount: "100", paymentConfirmedAt: "2026-10-02", panelMembers: [{ name: "시험위원", selected: true }], decisionDate: "2026-10-02", finalApprover: "대표자", finalApprovalDate: "2026-10-02", englishText: {}, assessment: { j1: { education: "적합" } }, decisions: { j1: { result: "승인" } }, certificates: { j1: { issueDate: "2026-10-05" } }, deliveryDocuments: { j1: { education: { received: true } } } };
assert.equal(match(context, ["j1"], structuredClone(context)), true);
assert.equal(match(context, ["j1"], null), false);
assert.equal(match(context, ["j1"], {}), false);
for (const key of Object.keys(context)) {
  const saved = structuredClone(context); saved[key] = "변경된 값";
  assert.equal(match(context, ["j1"], saved), false);
}
const reordered = structuredClone(context); reordered.review = { comment: "확인", result: "적합" };
assert.equal(match(context, ["j1"], reordered), true);
const extra = structuredClone(context); extra.stage = "COMPLETED"; extra.certificates.j2 = { issueDate: "other" };
assert.equal(match(context, ["j1"], extra), true);
const scheduled = structuredClone(context);
scheduled.examSchedules = { j1: { providerType: "PARTNER", providerName: "시험 연수기관", trainingEndDate: "2026-09-01", examNoticeDate: "2026-08-25", examDate: "2026-09-01" } };
assert.equal(match(scheduled, ["j1"], structuredClone(scheduled)), true);
assert.equal(match(context, ["j1"], scheduled), false);
assert.equal(match(scheduled, ["j1"], context), false);
for (const key of Object.keys(scheduled.examSchedules.j1)) {
  const changed = structuredClone(scheduled); changed.examSchedules.j1[key] = "변경";
  assert.equal(match(scheduled, ["j1"], changed), false);
}
console.log("패키지 저장 업무값 및 교육·시험 입력 대조 검사 통과");
