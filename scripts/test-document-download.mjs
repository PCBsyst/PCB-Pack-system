import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
const compile = (file) => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const provenanceModule = `data:text/javascript;base64,${Buffer.from(compile("../lib/template-provenance.ts")).toString("base64")}`;
const boundedModule = `data:text/javascript;base64,${Buffer.from(compile("../lib/bounded-download.ts")).toString("base64")}`;
const code = compile("../lib/document-download.ts").replace("@/lib/template-provenance", provenanceModule).replace("@/lib/bounded-download", boundedModule);
const { verifiedDocxBlob: verify } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const bytes = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4]);
function response(change = () => {}, data = bytes) {
  const headers = new Headers({ "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "X-Document-SHA256": createHash("sha256").update(bytes).digest("hex"), "X-Document-Byte-Size": String(bytes.length), "X-Template-Source": "BUILT_IN", "X-Template-Version": "Rev.1", "X-Template-SHA256": "a".repeat(64) });
  change(headers); return new Response(data, { headers });
}
assert.equal((await verify(response())).size, 8);
for (const change of [
  (h) => h.set("Content-Type", "text/html"),
  (h) => h.delete("X-Document-SHA256"),
  (h) => h.set("X-Document-SHA256", "a".repeat(64)),
  (h) => h.set("X-Document-Byte-Size", "9"),
  (h) => h.set("X-Document-Byte-Size", "NaN"),
  (h) => h.delete("X-Template-Source"),
]) await assert.rejects(() => verify(response(change)));
await assert.rejects(() => verify(response(() => {}, new Uint8Array([1, 2, 3, 4, 1, 2, 3, 4]))));
await assert.rejects(() => verify(response(() => {}, bytes.slice(0, 4))));
for (const route of ["application-review", "decision-report", "delivery-confirmation"]) assert.match(fs.readFileSync(new URL(`../app/api/documents/${route}/route.ts`, import.meta.url), "utf8"), /docxOutputHeaders\(output\)/);
console.log("개별 Word 수신 파일 무결성 검사: 통과");
