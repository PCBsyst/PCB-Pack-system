import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync("components/application-detail.tsx", "utf8");
const ast = ts.createSourceFile("application-detail.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "applyCorrectionValue");
assert.ok(declaration);
const js = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const context = vm.createContext({ nextKoreanBusinessDay: (value) => value });
vm.runInContext(js, context);
const state = { review: { result: "적합" }, certificates: { job: { certificationNo: "26750032", issueDate: "2026-10-07" } } };
const changed = context.applyCorrectionValue(state, "certificationNo:job", "26750033");
assert.equal(changed.certificates.job.certificationNo, "26750033");
assert.equal(state.certificates.job.certificationNo, "26750032");
for (const key of ["issueDate:job", "certificateNo:job", "unknown:job", "trackingNumber:missing"]) {
  assert.equal(context.applyCorrectionValue(state, key, "changed"), state);
}
assert.match(source, /key: `certificationNo:\$\{job.id\}`/);
assert.match(source, /actor = data.user.id/);
assert.match(source, /generated: false, packageGeneration: undefined/);
assert.match(source, /정식 업무 테이블은 자동 변경하지 않습니다/);
console.log("업무 입력 정정: 인증번호 반영 및 보호 필드 검사 통과");
