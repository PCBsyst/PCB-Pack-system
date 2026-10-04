import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/template-provenance.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { templateProvenanceHeaders: encode, readTemplateProvenance: decode } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
for (const source of ["DATABASE", "BUILT_IN"]) {
  const template = { source, version: "국문 양식 Rev.14", sha256: "a".repeat(64) };
  assert.deepEqual(decode(new Headers(encode(template))), template);
}
assert.throws(() => decode(new Headers()));
for (const [key, value] of [["X-Template-Source", "CLIENT"], ["X-Template-SHA256", "invalid"], ["X-Template-Version", "%invalid"], ["X-Template-Version", "%0A"]]) {
  const headers = new Headers(encode({ source: "DATABASE", version: "Rev.6", sha256: "b".repeat(64) }));
  headers.set(key, value);
  assert.throws(() => decode(headers));
}
for (const route of ["application-review", "decision-report", "delivery-confirmation"]) {
  assert.match(fs.readFileSync(new URL(`../app/api/documents/${route}/route.ts`, import.meta.url), "utf8"), /templateProvenanceHeaders\(template\)/);
}
console.log("양식 추적 메타데이터 검사: 통과");
