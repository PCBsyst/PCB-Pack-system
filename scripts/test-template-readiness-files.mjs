import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (path) => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const registryUrl = `data:text/javascript;base64,${Buffer.from(compile("../lib/document-template-registry.ts")).toString("base64")}`;
const { corporateTemplateRegistry } = await import(registryUrl);
const readinessCode = compile("../lib/template-readiness.ts").replace("@/lib/document-template-registry", registryUrl);
const { templateReadiness } = await import(`data:text/javascript;base64,${Buffer.from(readinessCode).toString("base64")}`);
const route = compile("../app/api/documents/template-readiness/route.ts").replace(/^import .*;\r?$/gm, "").replace(/export /g, "");
function fixture({ authError = null, keys = new Set(), fail = false, changed = false } = {}) {
  const calls = [];
  const GET = new Function("requireApiStaff", "getActiveDocumentTemplateKeys", "loadDocumentTemplate", "templateLoadErrorResponse", "templateReadiness", "corporateTemplateRegistry", `${route}; return GET;`)(
    async () => authError, async () => keys,
    async (type, language, fallback) => { calls.push({ type, language, fallback }); if (fail) throw new Error("private storage path"); return { source: changed ? "DATABASE" : keys.has(`${type}:${language}`) ? "DATABASE" : "BUILT_IN" }; },
    () => Response.json({ error: "양식 확인 실패" }, { status: 503, headers: { "Cache-Control": "private, no-store" } }), templateReadiness, corporateTemplateRegistry);
  return { GET, calls };
}
let f = fixture(); let response = await f.GET();
assert.equal(response.status, 200); assert.equal(f.calls.length, 3);
assert.ok(f.calls.every((call) => call.fallback?.endsWith(".docx")));
assert.equal((await response.json()).templates.length, 6);
assert.equal(response.headers.get("Cache-Control"), "private, no-store");
f = fixture({ keys: new Set(["DELIVERY_CONFIRMATION:KR"]) }); response = await f.GET();
assert.equal(response.status, 200); assert.equal(f.calls.length, 4);
assert.equal(f.calls.find((call) => call.type === "DELIVERY_CONFIRMATION" && call.language === "KR").fallback, undefined);
for (const options of [{ fail: true }, { changed: true }]) {
  f = fixture(options); response = await f.GET(); assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private storage path"));
}
f = fixture({ authError: Response.json({ error: "권한 없음" }, { status: 403 }) }); response = await f.GET();
assert.equal(response.status, 403); assert.equal(f.calls.length, 0);
console.log("양식 준비 API: 권한 선검사·실파일 로더 호출·미등록 건 제외·등록 변경/파일 오류 시 준비 상태 미반환 통과 (DB 모의)");
