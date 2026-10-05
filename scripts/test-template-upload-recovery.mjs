import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../components/document-template-manager.tsx", import.meta.url), "utf8");
const body = source.slice(source.indexOf("  async function upload()"), source.indexOf('  return <section'));
function fixture(auth, storage) {
  const notices = [], busy = [], ref = { current: false };
  let loads = 0, writes = 0;
  const deps = {
    uploadInFlight: ref, setNotice: (value) => notices.push(value), setBusy: (value) => busy.push(value),
    supabase: { auth: { getUser: auth }, storage: { from: () => ({ upload: async () => { writes++; return storage(); } }) } },
    file: { name: "test.docx", size: 10, arrayBuffer: async () => new ArrayBuffer(0) }, version: "Rev.1",
    documentType: "DELIVERY_CONFIRMATION", language: "KR", items: [],
    PizZip: class {}, documentTemplateRegistrationIssue: () => null, missingDocumentTemplateFields: () => [],
    setVersion: () => {}, setFile: () => {}, load: async () => { loads++; },
  };
  const upload = new Function(...Object.keys(deps), `${body};return upload;`)(...Object.values(deps));
  return { upload, ref, notices, busy, writes: () => writes, loads: () => loads };
}
let f = fixture(async () => { throw new Error("private details"); });
await f.upload();
assert.equal(f.writes(), 0); assert.equal(f.ref.current, false); assert.equal(f.busy.at(-1), false);
assert.match(f.notices.at(-1), /연결 오류/); assert.ok(!f.notices.at(-1).includes("private details"));
f = fixture(async () => ({ data: { user: null }, error: null }));
await f.upload(); assert.equal(f.writes(), 0); assert.match(f.notices.at(-1), /로그인/); assert.equal(f.ref.current, false);
f = fixture(async () => ({ data: { user: { id: "staff" } }, error: null }), async () => { throw new Error("network"); });
await f.upload(); assert.equal(f.writes(), 1); assert.equal(f.loads(), 1); assert.match(f.notices.at(-1), /완료 여부/); assert.equal(f.ref.current, false);
let release;
f = fixture(() => new Promise((resolve) => { release = resolve; }));
const first = f.upload();
await Promise.resolve(); await Promise.resolve();
await f.upload(); assert.equal(f.writes(), 0);
release({ data: { user: null }, error: null }); await first;
assert.equal(f.ref.current, false);
console.log("양식 등록 실제 처리함수: 중복 클릭·인증 실패·통신 예외·잠금 해제·불확실 저장 후 조회 검사 통과 (DB 모의)");
