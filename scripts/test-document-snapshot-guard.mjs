import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/prototype-package.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("package.ts", source, ts.ScriptTarget.Latest, true);
const names = ["downloadCorporateDocumentDocx", "downloadDeliveryConfirmationDraftDocx", "downloadCorporatePackageZip", "downloadCorporatePackageZipImpl"];
const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast).replace(/^export /, "")).join("\n");
const compiled = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { application: { id: "a1", applicationNo: "TEST" } }, job = { id: "j1", jobNo: "TEST" };
const blob = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]);
let current = true, downloads = 0, events = 0, mutateOnVerify = false;
const functions = new Function("fetch", "withDownloadSingleFlight", "documentErrorMessage", "verifiedDocxBlob", "downloadBlob", "parsePackageGeneration", "window", "verifiedPackageBlob", `${compiled};return {${names.join(",")}};`)(
  async () => ({ ok: true, headers: new Headers({ "X-Document-Status": "DRAFT" }), blob: async () => { if (mutateOnVerify) current = false; return blob; } }),
  async (_, task) => task(), async () => "실패",
  async () => { if (mutateOnVerify) current = false; return blob; },
  () => { downloads++; }, () => ({ sha256: "", complete: true }), { dispatchEvent: () => { events++; } },
  async () => { if (mutateOnVerify) current = false; return blob; },
);
for (const task of [
  () => functions.downloadCorporateDocumentDocx(context, job, "APPLICATION_REVIEW", "KR", () => current),
  () => functions.downloadDeliveryConfirmationDraftDocx(context, job, () => current),
  () => functions.downloadCorporatePackageZip(context, [job], ["KR"], () => current),
]) {
  current = true; mutateOnVerify = true;
  const before = downloads, beforeEvents = events;
  await assert.rejects(task(), /업무 입력이나 화면이 변경/);
  assert.equal(downloads, before); assert.equal(events, beforeEvents);
  current = true; mutateOnVerify = false; await task(); assert.equal(downloads, before + 1);
}
const ui = fs.readFileSync(new URL("../components/application-detail.tsx", import.meta.url), "utf8");
assert.equal(ui.split("currentDownloadGuard(args[0])").length - 1, 5);
assert.ok(ui.includes("downloadMounted.current && canAttachPackageGeneration(snapshot, latestPackageContext.current)"));
assert.ok(ui.includes("downloadMounted.current = false"));
console.log("문서 수신 중 입력 변경: 개별 DOCX·국문 초안·ZIP 미다운로드 및 완료 이벤트 미발행·정상 재시도 검사 통과 (실제 브라우저 검증 별도)");
