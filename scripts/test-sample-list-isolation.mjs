import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const files = {
  "components/applications-table.tsx": ["jobs", "applications"],
  "components/candidates-table.tsx": ["jobs", "candidates"],
  "components/jobs-table.tsx": ["jobs"],
  "components/packages-manager.tsx": ["packageDocuments"],
};
for (const [path, names] of Object.entries(files)) {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]);
  for (const name of names) {
    const declaration = declarations.find(item => item.name.getText(ast) === name);
    assert.ok(declaration, `${path}: ${name}`);
    const initializer = declaration.initializer.getText(ast);
    const alias = name === "jobs" ? "sampleJobs" : name === "applications" ? "sampleApplications" : name === "candidates" ? "sampleCandidates" : "samplePackageDocuments";
    const samples = [{ id: "sample-only" }];
    for (const configured of [true, "configured", false, undefined]) {
      const runtime = vm.createContext({ hasEnvVars: configured, [alias]: samples });
      vm.runInContext(`globalThis.value = ${initializer};`, runtime);
      assert.equal(runtime.value.length, configured ? 0 : 1);
      if (!configured) assert.equal(runtime.value, samples);
    }
    assert.match(source, new RegExp(`\\b${alias}\\b`));
  }
  // No change to registered records: those still come from the shared hook.
  assert.match(source, /useLinkedRecordsState\(revision\)/);
}
console.log("신청·후보자·Job·패키지: DB 연결 시 내장 샘플 제외, 로컬 샘플 유지 검사 통과 (운영 화면 검증 별도)");
