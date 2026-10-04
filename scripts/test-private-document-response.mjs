import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/private-document-response.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { privateDocumentResponse: protect } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
for (const status of [200, 400, 401, 403, 409, 422, 503]) {
  const original = new Response(new Uint8Array([0, 1, 255]), { status, headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=test.docx", "X-Document-SHA256": "test-hash", "Vary": "Accept-Encoding, cookie", "Cache-Control": "public, max-age=3600" } });
  const result = protect(original);
  assert.equal(result.status, status);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(result.headers.get("CDN-Cache-Control"), "no-store");
  assert.equal(result.headers.get("Vercel-CDN-Cache-Control"), "no-store");
  assert.equal(result.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(result.headers.get("X-Document-SHA256"), "test-hash");
  assert.equal(result.headers.get("Content-Disposition"), "attachment; filename=test.docx");
  assert.equal(result.headers.get("Vary"), "Accept-Encoding, cookie, Authorization");
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([0, 1, 255]));
}
assert.equal(protect(new Response(null, { headers: { Vary: "*" } })).headers.get("Vary"), "*");
for (const route of ["application-review", "decision-report", "delivery-confirmation", "package", "certification-action"]) {
  const source = fs.readFileSync(new URL(`../app/api/documents/${route}/route.ts`, import.meta.url), "utf8");
  assert.ok(source.includes("return privateDocumentResponse(await createDocumentResponse(request));"));
}
console.log("문서 응답 보호: 성공/오류 캐시 금지·기존 헤더·파일 바이트 보존·다섯 API 연결 검사 통과");
