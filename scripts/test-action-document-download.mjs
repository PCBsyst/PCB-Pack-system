import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import PizZip from "pizzip";
const require = createRequire(import.meta.url);
const url = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = (path) => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8").replace('import "server-only";', ""), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const provenance = url(compile("../lib/template-provenance.ts"));
const download = compile("../lib/document-download.ts").replace('"@/lib/template-provenance"', JSON.stringify(provenance)).replace("@/lib/bounded-download", url(compile("../lib/bounded-download.ts")));
const { verifiedDocxBlob } = await import(url(download));
const fixture = { jobNo: "QMS260099", managementNo: 99, candidateName: "가상후보", candidateContact: "후보자 상세정보 참조", certificationNo: "26130099", certificationIssueDate: "2026-01-01", actionType: "SUSPENDED", standardReason: "가상 사유", detailReason: "가상 상세 & 확인", effectiveDate: "2026-09-01", actor: "가상담당자", recordedAt: "2026-09-01T01:00:00Z" };
let route = compile("../app/api/documents/certification-action/route.ts");
const dependencies = {
  pizzip: pathToFileURL(require.resolve("pizzip")).href,
  "@/lib/template-provenance": provenance,
  "@/lib/server/api-auth": url('export async function requireApiStaff(){return null;}'),
  "@/lib/server/privacy-access": url('export async function recordDocumentResponse(){return null;}'),
  "@/lib/server/action-document-records": url(`export async function loadStoredActionDocument(input){return {ok:true,values:{...${JSON.stringify(fixture)},kind:input.kind}};}`),
};
for (const path of ["action-document-records", "private-document-response", "docx-output-validation", "server/docx-response-headers"]) dependencies[`@/lib/${path}`] = url(compile(`../lib/${path}.ts`));
for (const [name, value] of Object.entries(dependencies)) route = route.replaceAll(`"${name}"`, JSON.stringify(value));
const { POST } = await import(url(route));
const input = { jobId: "11111111-1111-1111-1111-111111111111", actionId: "22222222-2222-2222-2222-222222222222" };
for (const kind of ["REPORT", "LETTER"]) {
  const response = await POST(new Request("https://example.com/test", { method: "POST", body: JSON.stringify({ ...input, kind }) }));
  assert.equal(response.status, 200);
  assert.ok(decodeURIComponent(response.headers.get("X-Template-Version")).includes(kind === "REPORT" ? "Rev.3" : "Rev.4"));
  const blob = await verifiedDocxBlob(response);
  const xml = new PizZip(await blob.arrayBuffer()).file("word/document.xml").asText();
  assert.ok(xml.includes(fixture.candidateName));
  assert.ok(xml.includes(fixture.certificationNo));
  assert.ok(xml.includes("가상 상세 &amp; 확인"));
  assert.ok(xml.includes("2026-09-01"));
  assert.ok(!/항목을 선택하세요|날짜를 입력하려면|XX-X-XXXX/.test(xml.replace(/<[^>]*>/g, "")));
  if (kind === "LETTER") assert.ok(xml.includes(fixture.certificationIssueDate));
  if (kind === "REPORT") assert.ok(xml.includes(fixture.actor));
}
const source = fs.readFileSync(new URL("../components/supabase-job-detail.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("job.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "downloadActionDocument").getText(tree);
const code = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let checked = false, fail = false, saved = 0;
const run = new Function("fetch", "withDownloadSingleFlight", "documentErrorMessage", "verifiedDocxBlob", "downloadBlob", `${code};return downloadActionDocument;`)(
  async () => ({ ok: true, headers: new Headers() }), async (_key, task) => task(), async () => "오류", async () => { if (fail) throw new Error("무결성 실패"); checked = true; return new Blob(); }, () => { assert.equal(checked, true); saved++; },
);
await run({ id: "j1", jobNo: "TEST" }, { id: "a1" }, "REPORT");
assert.equal(saved, 1); fail = true;
await assert.rejects(run({ id: "j1", jobNo: "TEST" }, { id: "a1" }, "LETTER"), /무결성 실패/);
assert.equal(saved, 1);
assert.ok(source.includes('label="보고서 DOCX"'));
assert.ok(source.includes('label="통보문 DOCX"'));
console.log("정지·철회 DOCX: 실제 두 양식 생성·파일 해시/크기·양식 근거·특수문자·검증 실패 시 미다운로드 검사 통과 (DB/인증 모의)");
