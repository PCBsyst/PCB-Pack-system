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
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "applyCorrection") handler = node;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handler);
const handlerJS = ts.transpileModule(`const ${handler.getText(ast)}; globalThis.correct = applyCorrection;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const validationSource = readFileSync("lib/package-request-validation.ts", "utf8");
const validationJS = ts.transpileModule(validationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const validationContext = vm.createContext({ exports: {} });
vm.runInContext(validationJS, validationContext);
async function attempt(overrides = {}) {
  let saved;
  let notice = "";
  let authCalls = 0;
  const initial = { ...state, dateAuditLogs: [], generated: true, packageGeneration: { complete: true } };
  const target = overrides.target ?? "certificationNo:job";
  const sandbox = vm.createContext({
    nextKoreanBusinessDay: (value) => value === "2026-10-10" ? "2026-10-12" : value,
    certificateDateIssues: validationContext.exports.certificateDateIssues,
    correctionTarget: target, correctionValue: "26750033", correctionReason: "오입력 정정",
    selectedCorrection: { value: "26750032", label: "인증번호" },
    correctionOptions: [{ key: target }], demo: initial,
    usesSupabaseWorkspace: true,
    createClient: () => ({ auth: { getUser: async () => { authCalls++; return { data: { user: { id: "actual-user" } }, error: null }; } }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "실제 담당자" }, error: null }) }) }) }) }),
    downloadMounted: { current: true }, saveAccess: { current: { canEdit: true } },
    formalSnapshot: { current: JSON.stringify(initial) }, latestDemo: { current: initial },
    runFormalStep: (task) => task(),
    setNotice: (value) => { notice = value; },
    setDemo: (update) => { saved = update(initial); },
    setCorrectionValue: () => {}, setCorrectionReason: () => {},
    createAuditLog: (...args) => ({ after: args[4], actor: args[6] }),
    ...overrides,
  });
  vm.runInContext(js + handlerJS, sandbox);
  await sandbox.correct();
  return { saved, notice, authCalls };
}
const valid = await attempt();
assert.equal(valid.saved.certificates.job.certificationNo, "26750033");
assert.equal(valid.saved.generated, false);
assert.equal(valid.saved.packageGeneration, undefined);
assert.equal(valid.saved.dateAuditLogs[0].actor, "실제 담당자 (actual-user)");
for (const overrides of [
  { correctionReason: "" }, { correctionReason: "x".repeat(501) }, { correctionValue: "bad\u0000" },
  { target: "review.result", correctionValue: "알 수 없음" },
  { target: "expiryDate:job", correctionValue: "2026-02-30", selectedCorrection: { type: "date" } },
  { target: "expiryDate:job", correctionValue: "2026-10-06", selectedCorrection: { type: "date" } },
]) {
  const result = await attempt(overrides);
  assert.equal(result.saved, undefined);
  assert.equal(result.authCalls, 0);
}
for (const overrides of [
  { downloadMounted: { current: false } },
  { saveAccess: { current: { canEdit: false } } },
  { formalSnapshot: { current: "stale" } },
  { createClient: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) },
  { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "actual-user" } }, error: null }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "lookup failed" } }) }) }) }) }) },
]) assert.equal((await attempt(overrides)).saved, undefined);
const adjusted = await attempt({ target: "expiryDate:job", correctionValue: "2026-10-10", selectedCorrection: { type: "date", value: "2027-01-01" } });
assert.equal(adjusted.saved.certificates.job.expiryDate, "2026-10-12");
assert.equal(adjusted.saved.dateAuditLogs[0].after, "2026-10-12");
console.log("업무 입력 정정 실제 처리함수: 인증번호·날짜 역전·사유·작업자·권한 상실·입력 변경·패키지 재생성 검사 통과 (DB/브라우저 모의)");
