import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../components/mfa-setup.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("mfa-setup.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "verify") handler = node.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(handler);
const js = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
async function run({ error = null, level = "aal2", assuranceError = null, fail = false, input = "123456" } = {}) {
  const calls = []; let secretRemoved = false;
  const createClient = () => ({ auth: { mfa: {
    challengeAndVerify: async () => { if (fail) throw new Error("모의 네트워크 실패"); return { error }; },
    getAuthenticatorAssuranceLevel: async () => ({ error: assuranceError, data: { currentLevel: level } }),
  } } });
  const execute = new Function("createClient", "window", "busy", "factorId", "code", "setBusy", "setMessage", "setCode", "setSetup", "setLevel", "setFactors", `${js}; return verify;`);
  const verify = execute(createClient, { location: { replace: (path) => { assert.equal(secretRemoved, true); calls.push(path); } } }, false, "가상인증", input, () => {}, () => {}, () => {}, () => { secretRemoved = true; }, () => {}, () => {});
  await verify({ preventDefault() {} });
  return calls;
}
assert.deepEqual(await run(), ["/"]);
for (const scenario of [{ error: {} }, { level: "aal1" }, { assuranceError: {} }, { fail: true }, { input: "123" }]) assert.deepEqual(await run(scenario), []);
console.log("MFA 확인 후 업무 화면 이동: 성공 이동·설정 키 제거·실패 시 유지 검사 통과");
