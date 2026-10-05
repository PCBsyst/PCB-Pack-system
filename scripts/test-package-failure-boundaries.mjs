import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const require = createRequire(import.meta.url), PizZip = require("pizzip");
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const stateUrl = url('export const state={mode:"",documentCalls:0,recordChecks:0,accessCalls:0,receiptCalls:0};');
const { state } = await import(stateUrl);
const prefix = `import {state} from ${JSON.stringify(stateUrl)};`;
const zip = new PizZip(); zip.file("[Content_Types].xml", "<Types/>"); zip.file("_rels/.rels", "<Relationships/>"); zip.file("word/document.xml", "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body/></w:document>");
const bytes = zip.generate({ type: "nodebuffer" }).toString("base64");
const generator = url(prefix + `export async function POST(){state.documentCalls++; if(state.mode==="child-throw")throw new Error("private@example.com internal details"); if(state.mode==="child-failure"&&state.documentCalls===2)return Response.json({error:"두 번째 문서 생성 실패"},{status:400}); return new Response(state.mode==="corrupt"?"invalid":Buffer.from("${bytes}","base64"),{headers:state.mode==="provenance"?{}:{"X-Template-Source":"BUILT_IN","X-Template-Version":"Rev.1","X-Template-SHA256":"${"a".repeat(64)}"}});}`);
const dependencies = {
  pizzip: pathToFileURL(require.resolve("pizzip")).href,
  "@/lib/server/api-auth": url(prefix + 'export async function requireApiStaff(){return state.mode==="denied"?Response.json({error:"권한 없음"},{status:403}):null;}'),
  "@/lib/server/package-record-validation": url(prefix + 'export async function validateStoredPackageRecords(){state.recordChecks++; return (state.mode==="initial-change"||state.mode==="final-change"&&state.recordChecks===2)?Response.json({error:"원본 변경"},{status:409}):null;}'),
  "@/lib/server/privacy-access": url(prefix + 'export async function recordDocumentResponse(){state.accessCalls++;return state.mode==="access-failure"?Response.json({error:"접근이력 실패"},{status:503}):null;}'),
  "@/lib/server/package-receipts": url(prefix + 'import {createHash} from "node:crypto";export async function recordPackageGeneration(id,docs,complete,bytes){state.receiptCalls++;if(state.mode==="receipt-throw")throw new Error("private@example.com");return {id:"receipt",status:"RECORDED",sha256:createHash("sha256").update(bytes).digest("hex"),error:state.mode==="receipt-failure"?Response.json({error:"생성이력 실패"},{status:503}):null};}'),
  "@/lib/server/document-template-loader": url(prefix + 'export async function getActiveDocumentTemplateKeys(){if(state.mode==="loader-throw")throw new Error("private details");return new Set();}export function templateLoadErrorResponse(){return Response.json({error:"양식 조회 실패"},{status:503});}'),
  "@/lib/document-translation-checks": url('export function documentTranslationIssues(){return [];}export function documentTranslationMessage(){return "번역 확인";}'),
};
for (const route of ["application-review", "decision-report", "delivery-confirmation"]) dependencies[`@/app/api/documents/${route}/route`] = generator;
for (const name of ["package-manifest", "private-document-response", "document-errors", "docx-output-validation", "template-provenance", "package-request-validation", "document-template-registry"]) dependencies[`@/lib/${name}`] = url(compile(`../lib/${name}.ts`));
let code = compile("../app/api/documents/package/route.ts");
for (const [name, module] of Object.entries(dependencies)) code = code.replaceAll(JSON.stringify(name), JSON.stringify(module));
const { POST } = await import(url(code));
const job = { id: "j1", jobNo: "QMS260001", candidateId: "c1", applicationId: "a1", standard: "ISO 9001", currentGrade: "심사원" };
const input = { context: { application: { id: "a1", applicationNo: "APP001", candidateId: "c1", jobIds: ["j1"] }, candidate: { id: "c1", name: "가상 후보자" }, jobs: [job], review: {}, certificates: {}, decisions: {}, deliveryDocuments: {}, assessment: {}, panelMembers: [] }, jobs: [job], languages: ["KR"] };
for (const [mode, expectedStatus] of [["denied",403],["invalid-json",400],["initial-change",409],["loader-throw",503],["child-failure",400],["child-throw",503],["corrupt",503],["provenance",503],["final-change",409],["access-failure",503],["receipt-failure",503],["receipt-throw",503]]) {
  Object.assign(state, { mode, documentCalls: 0, recordChecks: 0, accessCalls: 0, receiptCalls: 0 });
  const response = await POST(new Request("https://example.com/package", { method: "POST", body: mode === "invalid-json" ? "invalid" : JSON.stringify(input) }));
  assert.equal(response.status, expectedStatus, mode);
  assert.equal(response.headers.get("Content-Disposition"), null, mode);
  assert.equal(response.headers.get("X-Package-Complete"), null, mode);
  assert.equal(response.headers.get("X-Package-Receipt-Id"), null, mode);
  assert.match(response.headers.get("Cache-Control"), /no-store/, mode);
  const message = await response.text(); assert.doesNotMatch(message, /private@example.com|internal details/);
  assert.equal(state.receiptCalls, mode.startsWith("receipt-") ? 1 : 0, mode);
  if (mode === "child-failure") assert.equal(state.documentCalls, 2);
  if (mode === "final-change") { assert.equal(state.recordChecks, 2); assert.equal(state.accessCalls, 0); }
}
Object.assign(state, { mode: "", documentCalls: 0, recordChecks: 0, accessCalls: 0, receiptCalls: 0 });
const recovered = await POST(new Request("https://example.com/package", { method: "POST", body: JSON.stringify(input) }));
assert.equal(recovered.status, 200); assert.equal(state.receiptCalls, 1); assert.equal(state.recordChecks, 2);
assert.equal(recovered.headers.get("X-Package-Complete"), "false"); // 미등록 양식을 완료로 오인하지 않는다.
console.log("패키지 실패 경계 12개: 권한·입력·원본 변경·문서 손상·접근/생성이력 실패 시 ZIP 미응답·내부 예외 비노출·정상 재시도 통과 (인증/DB/문서 생성 모의)");
