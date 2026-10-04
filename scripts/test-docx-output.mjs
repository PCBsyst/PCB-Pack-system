import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import PizZip from "pizzip";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/docx-output-validation.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateGeneratedDocx: validate } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
function doc() { const zip = new PizZip(); zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'); zip.file("_rels/.rels", "<Relationships/>"); zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>시험 문서</w:t></w:r></w:p></w:body></w:document>'); return zip; }
assert.equal(validate(doc()), true);
for (const part of ["word/document.xml", "[Content_Types].xml", "_rels/.rels"]) { const zip = doc(); zip.remove(part); assert.equal(validate(zip), false); }
for (const part of ["word/document.xml", "word/header1.xml", "word/footer1.xml"]) {
  const zip = doc(); zip.file(part, "<w:document><w:t>{{candidate</w:t><w:t>Name}}</w:t></w:document>"); assert.equal(validate(zip), false);
}
const invalid = doc(); invalid.file("word/header1.xml", "<w:t>bad\u0001text</w:t>"); assert.equal(validate(invalid), false);
const ordinary = doc(); ordinary.file("word/footer1.xml", "<w:t>한글 / English {일반괄호}</w:t>"); assert.equal(validate(ordinary), true);
// Check every bundled template can pass after substituting its declared placeholders.
for (const name of fs.readdirSync(new URL("../templates/", import.meta.url)).filter((name) => name.endsWith(".docx"))) {
  const zip = new PizZip(fs.readFileSync(new URL(`../templates/${name}`, import.meta.url)));
  for (const part of Object.keys(zip.files).filter((part) => part.endsWith(".xml"))) {
    zip.file(part, zip.file(part).asText().replace(/\{\{[^{}]+\}\}/g, "가상 시험값"));
  }
  assert.equal(validate(zip), true, name);
}
console.log("Word 구조·자리표시자·내장 양식 검사: 통과 (화면 레이아웃 검증은 별도)");
