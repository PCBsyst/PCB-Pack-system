import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/prototype-package.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("prototype-package.ts", source, ts.ScriptTarget.Latest, true);
const names = ["downloadCorporateDocumentDocx", "downloadApplicationReviewDocx", "downloadDecisionReportDocx", "downloadDeliveryConfirmationDocx"];
const declarations = tree.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map((node) => node.getText(tree).replace(/^export /, "")).join("\n");
const code = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const requests = [], downloads = [], locks = [];
let fail = false;
const functions = new Function("fetch", "withDownloadSingleFlight", "documentErrorMessage", "verifiedDocxBlob", "downloadBlob", `${code}; return { ${names.join(", ")} };`)(
  async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: !fail, headers: new Headers() }; },
  async (key, task) => { locks.push(key); return task(); },
  async () => "모의 생성 실패", async () => new Blob(["가상 DOCX"]), (name, blob) => downloads.push({ name, blob }),
);
const context = { application: { id: "a1" } }, job = { id: "j1", jobNo: "TEST-001" };
for (const [name, route, defaultLanguage] of [["downloadApplicationReviewDocx", "application-review", "KR"], ["downloadDecisionReportDocx", "decision-report", "KR"], ["downloadDeliveryConfirmationDocx", "delivery-confirmation", "EN"]]) {
  await functions[name](context, job);
  assert.equal(requests.at(-1).body.language, defaultLanguage);
  for (const language of ["KR", "EN"]) {
    await functions[name](context, job, language);
    assert.equal(requests.at(-1).url, `/api/documents/${route}`);
    assert.equal(requests.at(-1).body.language, language);
    assert.ok(downloads.at(-1).name.endsWith(`_${language}.docx`));
    assert.ok(locks.at(-1).endsWith(`:${language}`));
  }
}
fail = true;
const count = downloads.length;
await assert.rejects(functions.downloadApplicationReviewDocx(context, job, "EN"), /모의 생성 실패/);
assert.equal(downloads.length, count);
const ui = fs.readFileSync(new URL("../components/application-detail.tsx", import.meta.url), "utf8");
const buttons = ui.split(/\r?\n/).find((line) => line.startsWith("function DocumentButtons"));
assert.ok(!buttons.includes("downloadWord("));
assert.ok(buttons.includes("개발용 미리보기·인쇄"));
for (const name of names.slice(1)) for (const language of ["KR", "EN"]) assert.ok(ui.includes(`${name}(packageContext, job, "${language}")`));
console.log("개별 DOCX 다운로드: 세 양식·언어 전달·중복 키·실패 시 미저장·HTML Word 대체 제거 검사 통과");
