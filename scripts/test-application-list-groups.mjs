import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/application-list-groups.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { groupApplicationRecords: group, sortApplicationGroups: sort } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const records = [
  { id: "a", applicationNo: "APP-2", receivedAt: "2026-10-01", candidateName: "나", partnerCompany: "나", standard: "ISO 9001", jobId: "one" },
  { id: "a", applicationNo: "APP-2", receivedAt: "2026-10-01", candidateName: "나", partnerCompany: "나", standard: "ISO 14001", jobId: "two" },
  { id: "b", applicationNo: "APP-1", receivedAt: "2026-10-02", candidateName: "가", partnerCompany: "가", standard: "ISO 45001", jobId: "three" },
];
const groups = group(records);
assert.equal(groups.length, 2);
assert.equal(groups[0].linkedRecords.length, 2);
assert.equal(groups[0].linkedRecords[1].jobId, "two");
assert.equal(group([]).length, 0);
for (const key of ["received-desc", "candidate", "partner"]) assert.equal(sort(groups, key, () => "")[0].record.id, "b");
assert.equal(sort(groups, "received-asc", () => "")[0].record.id, "a");
assert.equal(sort(groups, "standard", () => "")[0].record.id, "a");
assert.equal(sort(groups, "status", (record) => record.id === "a" ? "나" : "가")[0].record.id, "b");
assert.equal(groups[0].record.id, "a");
assert.equal(records.length, 3);
const ui = fs.readFileSync(new URL("../components/applications-table.tsx", import.meta.url), "utf8");
assert.match(ui, /useLinkedRecordsState\(revision\)/);
assert.match(ui, /linkedRecords.some\(\(item\) => item.standard === standard\)/);
assert.match(ui, /linkedRecords.some\(\(item\) => item.grade === grade\)/);
assert.match(ui, /linkedRecords.map\(\(item\) =>/);
assert.match(ui, /!notice && rows.length \+ visibleLocalRows.length === 0/);
assert.doesNotMatch(ui, /jobs\[0\]/);
console.log("신청 목록 복수 Job 그룹·정렬 및 조회 복구 연결 검사: 통과 (브라우저 검증은 별도)");
