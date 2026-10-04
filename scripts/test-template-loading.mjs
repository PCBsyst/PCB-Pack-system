import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
function compile(file) { return ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText; }
const { isMissingTemplateTable } = await import(`data:text/javascript;base64,${Buffer.from(compile("../lib/template-load-policy.ts")).toString("base64")}`);
assert.equal(isMissingTemplateTable({ code: "PGRST205", message: "Could not find the table 'public.document_templates' in the schema cache" }), true);
assert.equal(isMissingTemplateTable({ code: "42P01", message: 'relation "public.document_templates" does not exist' }), true);
for (const error of [null, { code: "42501", message: "public.document_templates" }, { code: "42P01", message: 'relation "public.candidates" does not exist' }, { code: "42P01", message: 'relation "public.document_templates_old" does not exist' }]) assert.equal(isMissingTemplateTable(error), false);
const loaderCode = compile("../lib/server/document-template-loader.ts").replace(/^import .*;\r?$/gm, "").replace(/export /g, "");
function fixture(lookup, download = { data: new Blob([new Uint8Array([1, 2])]), error: null }) {
  let fallbacks = 0;
  const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => lookup, then(resolve, reject) { return Promise.resolve(lookup).then(resolve, reject); } };
  const client = { from: () => query, storage: { from: () => ({ download: async () => download }) } };
  const loader = new Function("createClient", "hasEnvVars", "readFile", "path", "createHash", "corporateTemplateRegistry", "isMissingTemplateTable", `${loaderCode}; return { loadDocumentTemplate, getActiveDocumentTemplateKeys };`)(async () => client, true, async () => { fallbacks++; return new Uint8Array([3]); }, path, createHash, [{ documentType: "APPLICATION_REVIEW", language: "KR", version: "Rev.14" }], isMissingTemplateTable);
  return { loader, count: () => fallbacks };
}
for (const lookup of [{ data: null, error: null }, { data: null, error: { code: "PGRST205", message: "'public.document_templates' missing" } }]) {
  const f = fixture(lookup); assert.equal((await f.loader.loadDocumentTemplate("APPLICATION_REVIEW", "KR", "sample.docx")).source, "BUILT_IN"); assert.equal(f.count(), 1);
}
for (const error of [{ code: "42501", message: "permission denied" }, { code: "PGRST116", message: "multiple rows" }, { code: "NETWORK", message: "unavailable" }]) {
  const f = fixture({ data: null, error }); await assert.rejects(() => f.loader.loadDocumentTemplate("APPLICATION_REVIEW", "KR", "sample.docx")); assert.equal(f.count(), 0); await assert.rejects(() => f.loader.getActiveDocumentTemplateKeys());
}
for (const download of [{ data: null, error: { message: "missing file" } }, { data: new Blob([]), error: null }]) {
  const f = fixture({ data: { storage_path: "registered.docx", version: "Rev.1" }, error: null }, download); await assert.rejects(() => f.loader.loadDocumentTemplate("APPLICATION_REVIEW", "KR", "sample.docx")); assert.equal(f.count(), 0);
}
const f = fixture({ data: { storage_path: "registered.docx", version: "Rev.1" }, error: null });
assert.equal((await f.loader.loadDocumentTemplate("APPLICATION_REVIEW", "KR", "sample.docx")).source, "DATABASE"); assert.equal(f.count(), 0);
console.log("양식 조회 오류·저장소 실패·내장 대체 정책 모의 검사: 통과");
