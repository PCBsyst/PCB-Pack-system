import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/package-history-summary.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { documentHistoryLabel: label, summarizeHistoryDocuments: summary, filterPackageHistory: filter, parsePackageHistoryRows: parse } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const kr = { jobId: "a", documentType: "APPLICATION_REVIEW", language: "KR", entryName: "a.docx" };
const en = { ...kr, language: "EN", entryName: "b.docx" };
const rows = [{ complete: true, documents: [kr, en] }, { complete: false, documents: [kr] }];
assert.equal(label(kr), "서류검토서 · 국문");
assert.equal(label({ ...en, documentType: "DELIVERY_CONFIRMATION" }), "문서전달확인서 · 영문");
assert.equal(label({ ...kr, documentType: "OTHER", language: "OTHER" }), "OTHER · OTHER");
assert.deepEqual(summary([kr, en, { ...kr, jobId: "b" }]), { jobs: 2, korean: 2, english: 1 });
assert.deepEqual(summary([]), { jobs: 0, korean: 0, english: 0 });
assert.equal(filter(rows, "ALL", "ALL").length, 2);
assert.equal(filter(rows, "COMPLETE", "KR").length, 1);
assert.equal(filter(rows, "PARTIAL", "EN").length, 0);
assert.equal(filter(rows, "ALL", "EN")[0], rows[0]);
assert.equal(filter(rows, "PARTIAL", "KR")[0], rows[1]);
const ui = fs.readFileSync(new URL("../components/package-generation-history.tsx", import.meta.url), "utf8");
assert.match(ui, /current === sequence/);
assert.match(ui, /setRows\(\[\]\); setNames\(\{\}\)/);
assert.match(ui, /현재 입력과의 일치/);
const receipt = { id: "receipt", actor_id: "staff", occurred_at: "2026-10-07T10:00:00+09:00", file_count: 1, complete: false, sha256: "a".repeat(64), byte_size: 100, documents: [kr] };
assert.deepEqual(parse([]), []);
assert.deepEqual(parse([receipt]), [receipt]);
const full = { ...receipt, complete: true, file_count: 3, documents: [kr, { ...kr, documentType: "CERTIFICATION_DECISION_REPORT", entryName: "decision.docx" }, { ...kr, documentType: "DELIVERY_CONFIRMATION", entryName: "delivery.docx" }] };
assert.deepEqual(parse([full]), [full]);
assert.equal(parse(null), null);
assert.equal(parse({}), null);
assert.equal(parse([receipt, receipt]), null);
for (const patch of [
  { documents: null }, { documents: [{}] }, { file_count: 2 }, { byte_size: -1 }, { byte_size: "100" },
  { complete: "true" }, { complete: true }, { occurred_at: "invalid" }, { occurred_at: "2026-02-30T10:00:00Z" },
  { sha256: "bad" }, { actor_id: "" }, { id: "" },
  { documents: [{ ...kr, language: "JP" }] }, { documents: [{ ...kr, documentType: "OTHER" }] },
  { documents: [{ ...kr, language: ["KR"] }] }, { documents: [{ ...kr, documentType: ["APPLICATION_REVIEW"] }] },
  { file_count: 2, documents: [kr, { ...kr, entryName: "other.docx" }] },
  { documents: [{ ...kr, template: { source: "BUILT_IN", version: "Rev.1", sha256: "bad" } }] },
]) assert.equal(parse([{ ...receipt, ...patch }]), null);
const withTemplate = { ...receipt, documents: [{ ...kr, template: { source: "DATABASE", version: "Rev.1", sha256: "b".repeat(64) } }] };
assert.deepEqual(parse([withTemplate]), [withTemplate]);
assert.match(ui, /parsePackageHistoryRows\(data\)/);
console.log("패키지 생성기록: 범위/언어 필터·이전 양식 기록 허용·파일 수/날짜/중복/양식 구성 오류 차단 검사 통과 (DB/파일 자체 검증 별도)");
