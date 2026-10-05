import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import PizZip from "pizzip";
const require = createRequire(import.meta.url);
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = (path) => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const keys = ["application", "career", "education", "diploma", "auditLog", "agreement", "examNotice", "examAnswers", "decisionReport", "certificate", "survey", "deliveryConfirmation"];
const job = { id: "j1", jobNo: "QMS260099", standard: "ISO 9001", currentGrade: "심사원" };
const context = {
  application: { receivedAt: "2026-09-01", applicationType: "최초", primaryOwner: "가상 담당자" },
  candidate: { name: "가상후보", nameEn: "Sample Candidate", birthDate: "1990-01-01", nationality: "KR", address: "가상 주소", email: "sample@example.com", phone: "000-0000-0000" },
  jobs: [job], reviewRequirements: { 교육요건: "충족" }, review: { result: "적합", comment: "국문검토 & 확인\r\n두 번째 검토 의견 <시험>", verificationComment: "국문검증", reviewer: "검토자", reviewedAt: "2026-09-02", verifier: "검증자", verifiedAt: "2026-09-03", verificationResult: "확인" },
  panelMembers: [{ name: "위원1", selected: true, decision: "승인", comment: "국문심의" }, { name: "위원2", selected: true, decision: "승인", comment: "국문심의2" }, { name: "제외위원", selected: false, decision: "", comment: "미선택의견" }],
  decisions: { j1: { result: "승인", comment: "국문최종승인" } }, decisionDate: "2026-09-04", finalApprover: "대표자", finalApprovalDate: "2026-09-07",
  assessment: { j1: Object.fromEntries(["지식 시험", "인성 시험", "교육 요구사항", "학력 요구사항", "심사이력"].map((key) => [key, "적합"])) },
  certificates: { j1: { certificationNo: "26130099", draftIssuedAt: "2026-09-08", issueDate: "2026-09-09", expiryDate: "2029-09-08", originalSentAt: "", trackingNumber: "" } },
  deliveryDocuments: { j1: Object.fromEntries(keys.map((key) => [key, { applicability: "REQUIRED", received: true, date: "2026-09-10", comment: "가상 기록" }])) },
  examSchedules: { j1: { providerType: "PARTNER", providerName: "가상기관 & 교육", trainingEndDate: "2026-08-25", examNoticeDate: "2026-08-18", examDate: "2026-08-25" } },
  invoiceNo: "TEST-INV", invoiceIssuedAt: "2026-09-03", paymentConfirmedAt: "2026-09-04",
  englishText: { reviewComment: "Review & evidence verified", verificationComment: "Evidence confirmed", panelComments: { 위원1: "Panel approved", 위원2: "Panel approved twice" }, decisionComments: { j1: "Final approval confirmed" } },
};
const deps = {
  pizzip: pathToFileURL(require.resolve("pizzip")).href,
  "@/lib/server/api-auth": moduleUrl('export async function requireApiStaff(){return null;}'),
  "@/lib/server/privacy-access": moduleUrl('export async function recordDocumentResponse(){return null;}'),
  "@/lib/server/docx-response-headers": moduleUrl('export function docxOutputHeaders(){return {};}'),
  "@/lib/template-provenance": moduleUrl('export function templateProvenanceHeaders(){return {};}'),
  "@/lib/prototype-package": moduleUrl(`export const deliveryDocumentRows=${JSON.stringify(keys.map((key) => ({ key })))};`),
  "@/lib/server/document-request-validation": moduleUrl(`export async function readValidatedDocumentRequest(request, language){return {ok:true,input:{context:${JSON.stringify(context)},job:${JSON.stringify(job)},language:(await request.json()).language||language}};}`),
};
for (const name of ["document-template-fields", "document-language-values", "document-training-summary", "document-delivery-values", "document-translation-checks", "docx-output-validation", "private-document-response"]) deps[`@/lib/${name}`] = moduleUrl(compile(`../lib/${name}.ts`));
async function loadRoute(route, overrides = {}) {
  let code = compile(`../app/api/documents/${route}/route.ts`);
  for (const [name, url] of Object.entries({ ...deps, ...overrides })) code = code.replaceAll(`"${name}"`, JSON.stringify(url));
  return (await import(moduleUrl(code))).POST;
}
const request = (language = "KR") => new Request("https://example.com/test", { method: "POST", body: JSON.stringify({ language }) });
for (const [route, template] of [
  ["application-review", "FGPC-008-01-application-review-kr.docx"],
  ["decision-report", "FGPC-012-01-decision-report-kr.docx"],
  ["delivery-confirmation", "FGPC-012-03-delivery-confirmation-en.docx"],
]) {
  const bytes = fs.readFileSync(new URL(`../templates/${template}`, import.meta.url)).toString("base64");
  deps["@/lib/server/document-template-loader"] = moduleUrl(`export async function loadDocumentTemplate(){return {bytes:Buffer.from('${bytes}','base64')};} export function templateLoadErrorResponse(){return new Response(null,{status:503});}`);
  const POST = await loadRoute(route);
  const incomplete = new PizZip(Buffer.from(bytes, "base64"));
  incomplete.file("word/document.xml", incomplete.file("word/document.xml").asText().replaceAll("{{candidateName}}", ""));
  const incompleteBytes = incomplete.generate({ type: "nodebuffer" }).toString("base64");
  const incompleteRoute = await loadRoute(route, { "@/lib/server/document-template-loader": moduleUrl(`export async function loadDocumentTemplate(){return {bytes:Buffer.from('${incompleteBytes}','base64')};} export function templateLoadErrorResponse(){return new Response(null,{status:503});}`) });
  const rejected = await incompleteRoute(request());
  assert.equal(rejected.status, 503, `${route}: 필수 입력 칸 누락 거절`);
  assert.ok(!rejected.headers.get("Content-Disposition"));
  assert.match((await rejected.json()).error, /candidateName/);
  for (const language of ["KR", "EN"]) {
    const response = await POST(new Request("https://example.com/test", { method: "POST", body: JSON.stringify({ language }) }));
    assert.equal(response.status, 200, `${route}/${language}`);
    assert.match(response.headers.get("Cache-Control"), /private, no-store/);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    const zip = new PizZip(await response.arrayBuffer());
    const xml = zip.file("word/document.xml").asText();
    assert.ok(xml.includes(job.jobNo));
    assert.ok(xml.includes(language === "KR" ? "가상후보" : "Sample Candidate"));
    assert.ok(xml.includes("가상기관 &amp; 교육"));
    assert.ok(!xml.includes("{{"));
    assert.ok(![...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].some(match => /[\r\n]/.test(match[1])), "여러 줄 값은 Word 줄바꿈 요소로 출력");
    if (language === "KR" && route !== "delivery-confirmation") {
      assert.ok(xml.includes('국문검토 &amp; 확인</w:t><w:br/><w:t xml:space="preserve">두 번째 검토 의견 &lt;시험&gt;'));
    }
    assert.ok(!xml.includes("미선택의견"));
    if (route !== "delivery-confirmation") assert.ok(xml.includes(language === "KR" ? "국문검토 &amp; 확인" : "Review &amp; evidence verified"));
    if (route === "decision-report") {
      assert.ok(xml.includes(language === "KR" ? "국문심의" : "Panel approved"));
      assert.ok(xml.includes(language === "KR" ? "국문최종승인" : "Final approval confirmed"), "기본 양식에도 최종 승인 의견이 들어가야 합니다.");
    }
    if (route === "delivery-confirmation") for (const date of ["2026-09-02", "2026-09-04", "2026-09-08", "2026-09-09", "2029-09-08"]) assert.ok(xml.includes(date));
  }
  // 권한·저장값 대조·양식·접근이력 검사에 실패하면 파일을 반환하지 않습니다.
  for (const [dependency, stub, status] of [
    ["@/lib/server/api-auth", 'export async function requireApiStaff(){return Response.json({error:"권한 부족"},{status:403});}', 403],
    ["@/lib/server/document-request-validation", 'export async function readValidatedDocumentRequest(){return {ok:false,response:Response.json({error:"저장값 불일치"},{status:409})};}', 409],
    ["@/lib/server/document-template-loader", 'export async function loadDocumentTemplate(){return {bytes:Buffer.from("invalid")};} export function templateLoadErrorResponse(){return Response.json({error:"양식 오류"},{status:503});}', 503],
    ["@/lib/server/privacy-access", 'export async function recordDocumentResponse(){return Response.json({error:"이력 저장 실패"},{status:503});}', 503],
  ]) {
    const guarded = await loadRoute(route, { [dependency]: moduleUrl(stub) });
    const response = await guarded(request());
    assert.equal(response.status, status, `${route}: 실패 시 Word 차단`);
    assert.match(response.headers.get("Cache-Control"), /private, no-store/);
    assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
    assert.ok(!response.headers.get("Content-Disposition"));
  }
  if (route === "decision-report") {
    const customized = new PizZip(Buffer.from(bytes, "base64"));
    customized.file("word/document.xml", customized.file("word/document.xml").asText().replace("</w:body>", "<w:p><w:r><w:t>{{finalApprovalComment}}</w:t></w:r></w:p></w:body>"));
    const customBytes = customized.generate({ type: "nodebuffer" }).toString("base64");
    const customRoute = await loadRoute(route, { "@/lib/server/document-template-loader": moduleUrl(`export async function loadDocumentTemplate(){return {bytes:Buffer.from('${customBytes}','base64')};} export function templateLoadErrorResponse(){return new Response(null,{status:503});}`) });
    for (const language of ["KR", "EN"]) {
      const response = await customRoute(request(language));
      assert.equal(response.status, 200);
      const content = new PizZip(await response.arrayBuffer()).file("word/document.xml").asText();
      const comment = language === "KR" ? "국문최종승인" : "Final approval confirmed";
      assert.equal(content.split(comment).length - 1, 1, "승인 의견 전용 칸이 있으면 한 번만 출력");
    }
  }
}
// 검토용 전용 API도 실제 내장 파일과 생성/수신 무결성 함수를 함께 검사합니다.
const provenanceUrl = moduleUrl(compile("../lib/template-provenance.ts"));
const draftDeps = {
  "@/lib/korean-delivery-template-draft": moduleUrl(compile("../lib/korean-delivery-template-draft.ts")),
  "@/lib/template-provenance": provenanceUrl,
  "@/lib/server/docx-response-headers": moduleUrl(compile("../lib/server/docx-response-headers.ts").replace('import "server-only";', "")),
};
const draftPOST = await loadRoute("delivery-confirmation-draft", draftDeps);
const draftResponse = await draftPOST(request("KR"));
assert.equal(draftResponse.status, 200);
assert.equal(draftResponse.headers.get("X-Document-Status"), "DRAFT");
assert.match(draftResponse.headers.get("Content-Disposition"), /DRAFT_KR\.docx/);
assert.match(draftResponse.headers.get("Cache-Control"), /private, no-store/);
const verifyCode = compile("../lib/document-download.ts").replace("@/lib/template-provenance", provenanceUrl);
const { verifiedDocxBlob } = await import(moduleUrl(verifyCode));
const draftBlob = await verifiedDocxBlob(draftResponse);
const draftBody = new PizZip(await draftBlob.arrayBuffer()).file("word/document.xml").asText();
for (const value of ["검토용 초안", "출력 배치 미검증", "정식 패키지 완료에 포함되지 않음", "가상후보", "가상 기록", "2026-09-02", "2026-09-04", "2026-09-09", "2029-09-08", "시험통보서"]) assert.ok(draftBody.includes(value), value);
assert.ok(!draftBody.includes("{{"));
assert.ok(![...draftBody.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].some(match => /[\r\n]/.test(match[1])), "국문 초안도 Word 줄바꿈 요소로 출력");
assert.equal((await draftPOST(request("EN"))).status, 400);
for (const [dependency, stub, status] of [
  ["@/lib/server/api-auth", 'export async function requireApiStaff(){return Response.json({error:"권한 부족"},{status:403});}', 403],
  ["@/lib/server/document-request-validation", 'export async function readValidatedDocumentRequest(){return {ok:false,response:Response.json({error:"저장값 불일치"},{status:409})};}', 409],
  ["node:fs/promises", 'export async function readFile(){return Buffer.from("invalid");}', 503],
  ["@/lib/server/privacy-access", 'export async function recordDocumentResponse(){return Response.json({error:"이력 저장 실패"},{status:503});}', 503],
]) {
  const guarded = await loadRoute("delivery-confirmation-draft", { ...draftDeps, [dependency]: moduleUrl(stub) });
  const response = await guarded(request());
  assert.equal(response.status, status);
  assert.ok(!response.headers.get("Content-Disposition"));
  assert.match(response.headers.get("Cache-Control"), /private, no-store/);
}
console.log("세 정식 문서 및 국문 검토용 초안 API: 파일 내용·초안 표시·생성/수신 무결성·실패 시 차단 통과 (인증/DB 모의, 출력 배치 검증 별도)");
