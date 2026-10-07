import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = readFileSync("components/storage-backup-overview.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const runtime = vm.createContext({ exports: {}, React: { createElement: (tag, props, ...children) => ({ tag, props, children }) } });
vm.runInContext(code, runtime);
const text = tree => typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join(" ") : tree?.children ? tree.children.map(text).join(" ") : "";
const render = configured => text(runtime.exports.StorageBackupOverview({ sharedConfigured: configured }));
const shared = render(true), local = render(false);
assert.match(shared, /Supabase PostgreSQL/);
assert.match(shared, /document-templates/);
assert.match(local, /브라우저 가상데이터 저장/);
assert.doesNotMatch(local, /Supabase PostgreSQL/);
for (const displayed of [shared, local]) {
  assert.match(displayed, /실시간 백업 상태 점검 결과가 아닙니다/);
  assert.match(displayed, /자동백업 실행·보관기간·실패 알림: 확인되지 않음/);
  assert.match(displayed, /이 화면에서는 백업이나 복원을 실행하지 않습니다/);
  assert.match(displayed, /DB 기록만 복원해도 양식 파일이 복구되는 것은 아닙니다/);
  assert.match(displayed, /생성 이력은 파일 보관과 다릅니다/);
  assert.match(displayed, /지역을 조회·검증하지 않았습니다/);
}
assert.doesNotMatch(source, /createClient|fetch\(|localStorage|process\.env|\.upload\(|\.rpc\(/);
const settings = readFileSync("components/settings-workspace.tsx", "utf8");
assert.match(settings, /<StorageBackupOverview sharedConfigured=\{Boolean\(hasEnvVars\)\}/);
assert.ok(settings.indexOf('<StorageBackupOverview') > settings.indexOf('id="settings-panel-security"'));
console.log("보관·백업 안내: 공유/가상모드 구분·백업 미확인·DB/실파일/다운로드 분리·비밀값 및 외부 요청 없음 검사 통과 (실제 백업 검증 별도)");
