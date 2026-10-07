import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = readFileSync("lib/package-document-history.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const runtime = vm.createContext({ exports: {} }); vm.runInContext(js, runtime);
const { parsePackageDocumentHistory: parse, packageDocumentLanguageSummary: summary } = runtime.exports;
const row = { id: "row", job_id: "job", document_type: "APPLICATION_REVIEW", language: "KR", format: "WORD", generated_at: null };
assert.equal(parse([row], ["job"])[0], row);
assert.equal(parse([], ["job"]).length, 0);
assert.equal(parse([{ ...row, document_type: "LEGACY_CERTIFICATE", format: "ZIP" }], ["job"]).length, 1);
for (const patch of [{ job_id: "other" }, { language: "JP" }, { format: "HTML" }, { document_type: [] }, { document_type: "" }, { generated_at: "bad" }, { generated_at: "2026-02-30T00:00:00Z" }, { generated_at: undefined }]) assert.equal(parse([{ ...row, ...patch }], ["job"]), null);
assert.equal(parse(null, ["job"]), null);
assert.equal(summary([], false), "기존 이력 조회 미확인");
assert.equal(summary([], true), "확인된 기존 언어 이력 없음");
assert.equal(summary([row, { ...row, language: "EN" }, row], true), "국문 · 영문");

const ui = readFileSync("components/packages-manager.tsx", "utf8");
const ast = ts.createSourceFile("ui.tsx", ui, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) { if (!effect && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") effect = node.arguments[0]; ts.forEachChild(node, visit); }
visit(ast); assert.ok(effect);
const effectJS = ts.transpileModule(`const effect = ${effect.getText(ast)}; globalThis.start = effect;`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function load(response, close = false) {
  const rows = [], notices = []; let resolve;
  const sandbox = vm.createContext({ records: [{ jobId: "job" }], hasEnvVars: true, readPackageDocumentHistory: runtime.exports.readPackageDocumentHistory,
    setDocumentRows: value => rows.push(value), setDocumentNotice: value => notices.push(value),
    createClient: () => ({ from: () => ({ select: () => ({ in: () => ({ order: () => ({ range: () => new Promise(done => { resolve = done; }) }) }) }) }) }),
  });
  vm.runInContext(effectJS, sandbox); const cleanup = sandbox.start();
  if (close) cleanup(); resolve(response); await flush(); return { rows, notices };
}
assert.equal((await load({ data: [row], count: 1, error: null })).rows.at(-1)[0], row);
for (const response of [{ data: null, count: 0, error: null }, { data: [row], count: 2, error: null }, { data: [row], count: null, error: null }, { data: [{ ...row, job_id: "other" }], count: 1, error: null }, { data: null, error: { message: "DB error" } }]) {
  const result = await load(response); assert.equal(result.rows.at(-1).length, 0); assert.match(result.notices.at(-1), /조회하지 못했습니다/);
}
assert.equal((await load({ data: [row], count: 1, error: null }, true)).rows.length, 1);
assert.match(ui, /languageSummary\(documents, !documentNotice && !recordsNotice\)/);
const read = runtime.exports.readPackageDocumentHistory;
const many = Array.from({ length: 1201 }, (_, index) => ({ ...row, id: `row-${index}` }));
const pages = [];
const fetched = await read(["job", "job"], async (ids, from, to) => { pages.push([ids.length, from, to]); return { data: many.slice(from, to + 1), count: many.length, error: null }; }, () => false);
assert.equal(fetched.length, 1201);
assert.deepEqual(pages, [[1, 0, 499], [1, 500, 999], [1, 1000, 1499]]);
const chunks = [];
assert.equal((await read(Array.from({ length: 101 }, (_, index) => `job-${index}`), async ids => { chunks.push(ids.length); return { data: [], count: 0, error: null }; }, () => false)).length, 0);
assert.deepEqual(chunks, [100, 1]);
for (const fetch of [
  async () => ({ data: [row], count: 501, error: null }),
  async (_, from) => ({ data: from ? [row] : Array.from({ length: 500 }, (_, index) => ({ ...row, id: `id-${index}` })), count: from ? 502 : 501, error: null }),
  async () => ({ data: [row, row], count: 2, error: null }),
  async () => ({ data: [], count: 10001, error: null }),
]) await assert.rejects(() => read(["job"], fetch, () => false));
assert.equal(await read(["job"], async () => { throw new Error("Must not fetch"); }, () => true), null);
console.log("패키지 목록 문서 이력: 조회 실패/빈 기록 구분·Job 범위·잘못된 응답·기존 ZIP/양식 허용·화면 종료 보호 검사 통과 (DB/브라우저 모의)");
