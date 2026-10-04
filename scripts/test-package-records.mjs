import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/package-record-matching.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { matchesPackageRecords: match } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const context = { application: { id: "a1", applicationNo: "APP1" }, candidate: { id: "c1", name: "시험 후보자", nameEn: "Sample Person", birthDate: "1990-01-01", nationality: "대한민국", email: "sample@example.invalid", phone: "010-0000-0000", address: "가상 주소" } };
const jobs = [{ id: "j1", jobNo: "QMS260001", standard: "ISO 9001", currentGrade: "심사원" }];
const app = { id: "a1", application_no: "APP1", candidate_id: "c1" };
const candidate = { id: "c1", name: "시험 후보자", name_en: "Sample Person", birth_date: "1990-01-01", nationality: "대한민국", email: "sample@example.invalid", phone: "010-0000-0000", address: "가상 주소" };
const row = { id: "j1", application_id: "a1", candidate_id: "c1", job_no: "QMS260001", standard: "ISO 9001", grade: "심사원" };
assert.equal(match(context, jobs, app, candidate, [row]), true);
for (const key of Object.keys(row)) assert.equal(match(context, jobs, app, candidate, [{ ...row, [key]: "wrong" }]), false);
assert.equal(match(context, jobs, null, candidate, [row]), false);
assert.equal(match(context, jobs, app, null, [row]), false);
assert.equal(match(context, jobs, app, candidate, []), false);
assert.equal(match(context, jobs, app, { ...candidate, name: "다른 후보자" }, [row]), false);
assert.equal(match(context, jobs, { ...app, application_no: "old" }, candidate, [row]), false);
for (const [inputKey, storedKey] of [["nameEn", "name_en"], ["birthDate", "birth_date"], ["nationality", "nationality"], ["email", "email"], ["phone", "phone"], ["address", "address"]]) {
  assert.equal(match(context, jobs, app, { ...candidate, [storedKey]: "다른 값" }, [row]), false);
  for (const value of ["", "미입력"]) {
    const blank = structuredClone(context); blank.candidate[inputKey] = value;
    assert.equal(match(blank, jobs, app, { ...candidate, [storedKey]: null }, [row]), true);
  }
  assert.equal(match(context, jobs, app, { ...candidate, [storedKey]: null }, [row]), false);
}
console.log("패키지 DB 대상 및 고객 기본정보 대조: 36건 검사 통과");
const serverCode = fs.readFileSync(new URL("../lib/server/package-record-validation.ts", import.meta.url), "utf8");
assert.match(serverCode, /rpc\("read_candidate_with_access_log"/);
assert.doesNotMatch(serverCode, /from\("candidates"\)/);
