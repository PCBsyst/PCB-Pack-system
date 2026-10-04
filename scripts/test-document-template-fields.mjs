import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import PizZip from "pizzip";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/document-template-fields.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { missingDocumentTemplateFields: missing } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
for (const [type, name, important] of [
  ["APPLICATION_REVIEW", "FGPC-008-01-application-review-kr.docx", "verifiedAt"],
  ["CERTIFICATION_DECISION_REPORT", "FGPC-012-01-decision-report-kr.docx", "finalApprover"],
  ["DELIVERY_CONFIRMATION", "FGPC-012-03-delivery-confirmation-en.docx", "examNoticeDate"],
]) {
  const original = new PizZip(fs.readFileSync(new URL(`../templates/${name}`, import.meta.url)));
  assert.deepEqual(missing(original, type), [], name);
  const body = original.file("word/document.xml").asText();
  for (const replacement of ["", important, `<w:t>{{${important}}}</w:t>`, `{{${important.slice(0, 3)}}</w:t><w:t>${important.slice(3)}}}`]) {
    const zip = new PizZip(original.generate({ type: "nodebuffer" }));
    // XML 주석에 동일 키를 남겨도 실제 본문 입력 칸의 누락을 숨길 수 없습니다.
    zip.file("word/document.xml", body.replaceAll(`{{${important}}}`, replacement.startsWith("<") ? "" : replacement) + `<!--${replacement.startsWith("<") ? replacement : ""}-->`);
    zip.file("word/header1.xml", `<w:t>{{${important}}}</w:t>`);
    assert.ok(missing(zip, type).includes(important), `${type}: 누락·단순 문자열·주석·분리된 키 거절`);
  }
  const empty = new PizZip();
  assert.ok(missing(empty, type).includes("candidateName"));
}
console.log("양식 필수 입력 칸: 내장 세 양식·항목 누락·머릿글/주석 위장·분리된 키 차단 검사 통과 (시각 검증 별도)");
