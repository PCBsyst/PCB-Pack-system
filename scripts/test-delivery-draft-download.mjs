import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/prototype-package.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("prototype-package.ts", source, ts.ScriptTarget.Latest, true);
const declaration = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "downloadDeliveryConfirmationDraftDocx").getText(tree).replace(/^export /, "");
const code = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let ok = true, marked = true, valid = true;
const calls = [], saved = [], keys = [];
const download = new Function("fetch", "withDownloadSingleFlight", "documentErrorMessage", "verifiedDocxBlob", "downloadBlob", `${code};return downloadDeliveryConfirmationDraftDocx;`)(
  async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok, headers: new Headers(marked ? { "X-Document-Status": "DRAFT" } : {}) }; },
  async (key, task) => { keys.push(key); return task(); },
  async () => "모의 생성 실패", async () => { if (!valid) throw new Error("무결성 실패"); return new Blob(["가상 문서"]); },
  (name) => saved.push(name),
);
const context = { application: { id: "a1" } }, job = { id: "j1", jobNo: "QMS260001" };
await download(context, job);
assert.equal(saved.length, 1);
assert.match(saved[0], /DRAFT_KR\.docx$/);
assert.equal(calls[0].url, "/api/documents/delivery-confirmation-draft");
assert.equal(calls[0].body.language, "KR");
assert.match(keys[0], /^draft:/);
marked = false; await assert.rejects(download(context, job), /초안 표시/);
marked = true; valid = false; await assert.rejects(download(context, job), /무결성 실패/);
valid = true; ok = false; await assert.rejects(download(context, job), /모의 생성 실패/);
assert.equal(saved.length, 1);
const ui = fs.readFileSync(new URL("../components/application-detail.tsx", import.meta.url), "utf8");
assert.ok(ui.includes("downloadDeliveryConfirmationDraftDocx(packageContext, job)"));
const registry = fs.readFileSync(new URL("../lib/document-template-registry.ts", import.meta.url), "utf8");
assert.match(registry.split(/\r?\n/).find((line) => line.includes('id: "delivery-confirmation-kr"')), /available: false/);
const packageRoute = fs.readFileSync(new URL("../app/api/documents/package/route.ts", import.meta.url), "utf8");
assert.ok(!packageRoute.includes("delivery-confirmation-draft"));
console.log("국문 초안 다운로드: 별도 경로·초안 표시/무결성 실패 시 미저장·정식 ZIP 제외 검사 통과");
