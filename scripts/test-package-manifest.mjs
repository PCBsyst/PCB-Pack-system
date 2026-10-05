import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";
const require = createRequire(import.meta.url);
const PizZip = require("pizzip");
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createPackageManifest: manifest } = await import(moduleUrl(compile("../lib/package-manifest.ts")));
const job = { id: "j1", jobNo: "QMS260001", standard: "ISO 9001", grade: "심사원", certificateNo: "26130001", issueDate: "2026-09-01", expiryDate: "2029-08-31" };
const metadata = { applicationNo: "TEST001", candidateName: "가상 후보자", generatedAt: "2026-10-05T00:00:00Z", jobs: [job], languages: ["KR"], documents: [] };
const original = JSON.stringify(metadata);
assert.equal(manifest(metadata).manifest.missing.length, 3);
assert.equal(manifest(metadata).complete, false);
assert.equal(JSON.stringify(metadata), original);
const multi = manifest({ ...metadata, jobs: [job, { ...job, id: "j2", jobNo: "QMS260002" }], languages: ["KR", "EN"] });
assert.equal(multi.manifest.missing.length, 12);
const deps = {
  pizzip: pathToFileURL(require.resolve("pizzip")).href,
  "@/lib/server/api-auth": moduleUrl('export async function requireApiStaff(){return null;}'),
  "@/lib/server/package-record-validation": moduleUrl('export async function validateStoredPackageRecords(){return null;}'),
  "@/lib/server/privacy-access": moduleUrl('export async function recordDocumentResponse(){return null;}'),
  "@/lib/document-translation-checks": moduleUrl('export function documentTranslationIssues(){return [];} export function documentTranslationMessage(){return "번역 확인";}'),
  "@/lib/server/package-receipts": moduleUrl('import {createHash} from "node:crypto"; export async function recordPackageGeneration(id,documents,complete,bytes){return {status:"RECORDED",id:"test-receipt",sha256:createHash("sha256").update(bytes).digest("hex"),error:null};}'),
};
for (const name of ["package-manifest", "private-document-response", "document-errors", "docx-output-validation", "template-provenance", "package-request-validation", "document-template-registry"]) deps[`@/lib/${name}`] = moduleUrl(compile(`../lib/${name}.ts`));
const document = new PizZip(); document.file("[Content_Types].xml", "<Types/>"); document.file("_rels/.rels", "<Relationships/>"); document.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>가상 문서</w:t></w:r></w:p></w:body></w:document>');
const bytes = document.generate({ type: "nodebuffer" });
const generator = moduleUrl(`export async function POST(){return new Response(Buffer.from("${bytes.toString("base64")}","base64"),{headers:{"X-Template-Source":"BUILT_IN","X-Template-Version":"Rev.1","X-Template-SHA256":"${"a".repeat(64)}"}});}`);
for (const route of ["application-review", "decision-report", "delivery-confirmation"]) deps[`@/app/api/documents/${route}/route`] = generator;
const inputJob = { ...job, candidateId: "c1", applicationId: "a1", currentGrade: job.grade };
const context = { application: { id: "a1", applicationNo: "TEST001", candidateId: "c1", jobIds: ["j1"] }, candidate: { id: "c1", name: "가상 후보자", email: "private@example.com", birthDate: "1990-01-01", phone: "010-0000-0000" }, jobs: [inputJob], review: {}, assessment: {}, decisions: {}, panelMembers: [], deliveryDocuments: {}, certificates: { j1: { certificationNo: job.certificateNo, issueDate: job.issueDate, expiryDate: job.expiryDate } } };
async function generate(languages, registered = []) {
  let code = compile("../app/api/documents/package/route.ts");
  const loader = moduleUrl(`export async function getActiveDocumentTemplateKeys(){return new Set(${JSON.stringify(registered)});} export function templateLoadErrorResponse(){return new Response(null,{status:503});}`);
  for (const [name, url] of Object.entries({ ...deps, "@/lib/server/document-template-loader": loader })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  const { POST } = await import(moduleUrl(code));
  const response = await POST(new Request("https://example.com/package", { method: "POST", body: JSON.stringify({ context, jobs: [inputJob], languages }) }));
  assert.equal(response.status, 200);
  const archiveBytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(response.headers.get("X-Package-SHA256"), createHash("sha256").update(archiveBytes).digest("hex"));
  const zip = new PizZip(archiveBytes);
  const json = JSON.parse(zip.file("package_manifest.json").asText());
  const text = zip.file("package_manifest.txt").asText();
  assert.equal(json.documentCount, Number(response.headers.get("X-Package-File-Count")));
  assert.equal(json.generatedAt, response.headers.get("X-Package-Generated-At"));
  for (const item of json.documents) {
    const file = zip.file(item.entryName).asUint8Array();
    assert.equal(item.sha256, createHash("sha256").update(file).digest("hex"));
    assert.equal(item.byteSize, file.length); assert.equal(item.template.sha256, "a".repeat(64));
  }
  assert.doesNotMatch(JSON.stringify(json) + text, /private@example.com|1990-01-01|010-0000-0000/);
  assert.match(text, /ISO 9001 \/ 심사원/); assert.match(text, /26130001/);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  return { json, response, text };
}
const partial = await generate(["KR"]);
assert.equal(partial.json.documentCount, 2); assert.equal(partial.json.complete, false); assert.equal(partial.json.missing.length, 1); assert.equal(partial.json.missing[0].documentType, "DELIVERY_CONFIRMATION"); assert.equal(partial.response.headers.get("X-Package-Complete"), "false");
const complete = await generate(["KR", "EN"], ["DELIVERY_CONFIRMATION:KR", "APPLICATION_REVIEW:EN", "CERTIFICATION_DECISION_REPORT:EN"]);
assert.equal(complete.json.documentCount, 6); assert.equal(complete.json.complete, true); assert.deepEqual(complete.json.missing, []); assert.equal(complete.response.headers.get("X-Package-Complete"), "true");
assert.doesNotMatch(complete.text, /양식 미등록/);
console.log("실제 ZIP 경로: 포함/누락 문서·언어/Job 범위·개별 파일/ZIP 해시·문서 수·개인정보 최소화 검사 통과 (인증/DB/하위 문서 생성 모의)");
