import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/document-errors.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { documentErrorMessage: message, packageDocumentFailure: forward } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
assert.equal(await message(Response.json({ error: "현재 입력 저장 후 다시 생성해 주세요." })), "현재 입력 저장 후 다시 생성해 주세요.");
for (const body of [{ error: {} }, { error: "" }, { error: "x".repeat(601) }, { error: "<html>" }, { error: "bad\ntext" }, null, []]) assert.equal(await message(Response.json(body), "기본 안내"), "기본 안내");
assert.equal(await message(new Response("<html>server error</html>", { headers: { "Content-Type": "text/html" } }), "기본 안내"), "기본 안내");
assert.equal(await message(new Response("broken", { headers: { "Content-Type": "application/json" } }), "기본 안내"), "기본 안내");
for (const status of [400, 401, 403, 409, 422, 429, 503]) {
  const result = await forward(Response.json({ error: "시험 안내" }, { status }));
  assert.equal(result.status, status); assert.equal((await result.json()).error, "시험 안내"); assert.equal(result.headers.get("Cache-Control"), "private, no-store");
}
assert.equal((await forward(new Response("internal details", { status: 500 }))).status, 503);
console.log("문서 생성 오류 안내·상태 전달 검사: 통과");
