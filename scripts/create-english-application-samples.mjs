import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import PizZip from 'pizzip';
import {decisionReportSample} from './fixtures/decision-report.mjs';

const require = createRequire(import.meta.url);
const directory = '../output/english-application/qa';
mkdirSync(directory, {recursive: true});
const rows = vm.runInNewContext('(' + readFileSync('lib/prototype-package.ts', 'utf8')
  .match(/export const deliveryDocumentRows[^=]*= (\[[\s\S]*?\]);/)[1] + ')');
const {context, job} = decisionReportSample();
Object.assign(context.candidate, {birthDate: '1990-01-01', nationality: 'Republic of Korea',
  address: '10 Sample Road (synthetic)', email: 'sample@example.test', phone: '010-0000-0000'});
context.deliveryDocuments[job.id] = Object.fromEntries(rows.map(({key}) => [key, {
  applicability: key === 'auditLog' ? 'NOT_APPLICABLE' : 'REQUIRED',
  received: key !== 'auditLog', date: '2026-11-16', comment: '',
}]));
const cache = {};
const overrides = {
  '@/lib/server/api-auth': {requireApiStaff: async () => null},
  '@/lib/server/privacy-access': {recordDocumentResponse: async () => null},
  '@/lib/server/package-record-validation': {validateStoredPackageRecords: async () => null},
  '@/lib/prototype-package': {deliveryDocumentRows: rows},
  '@/lib/server/document-request-validation': {readValidatedDocumentRequest: async request => ({ok: true, input: await request.json()})},
  '@/lib/server/package-receipts': {recordPackageGeneration: async (_id, documents, complete, bytes) => {
    assert.equal(documents.length, 6); assert.equal(complete, true);
    return {status: 'RECORDED', id: 'synthetic-receipt', sha256: createHash('sha256').update(bytes).digest('hex'), error: null};
  }},
  '@/lib/server/document-template-loader': {
    getActiveDocumentTemplateKeys: async () => new Set(),
    loadDocumentTemplate: async (type, language, fallback) => {
      const expected = {APPLICATION_REVIEW: 'FGPC-008-01-application-review',
        CERTIFICATION_DECISION_REPORT: 'FGPC-012-01-decision-report', DELIVERY_CONFIRMATION: 'FGPC-012-03-delivery-confirmation'}[type];
      assert.equal(fallback, `${expected}-${language.toLowerCase()}.docx`);
      const bytes = readFileSync('templates/' + fallback);
      return {bytes, source: 'BUILT_IN', version: 'Synthetic QA', sha256: createHash('sha256').update(bytes).digest('hex')};
    },
    templateLoadErrorResponse: () => new Response(null, {status: 503}),
  },
};
function load(name) {
  if (name === 'server-only') return {};
  if (overrides[name]) return overrides[name];
  if (!name.startsWith('@/')) return require(name);
  if (cache[name]) return cache[name];
  const exports = {}; cache[name] = exports;
  const code = ts.transpileModule(readFileSync(name.slice(2) + '.ts', 'utf8'),
    {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, require: load, Response, Request, Headers, TextEncoder, Buffer, crypto: globalThis.crypto});
  return exports;
}
const POST = load('@/app/api/documents/application-review/route').POST;
const request = (input, language = 'EN') => new Request('https://example.test/document', {
  method: 'POST', body: JSON.stringify({context: input, job, language}),
});
for (const kind of ['normal', 'long']) {
  const input = structuredClone(context);
  if (kind === 'long') {
    input.englishText.reviewComment = Array.from({length: 35}, (_, i) =>
      `${i + 1}. Synthetic review note. The submitted records were checked against the requested certification scope and grade.`).join('\n');
    input.englishText.verificationComment += ' Additional synthetic verification evidence was checked.'.repeat(20);
  }
  const response = await POST(request(input));
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  const xml = new PizZip(bytes).file('word/document.xml').asText();
  for (const text of ['Personnel Certification Application and Document Review', 'Sample Candidate',
    '1990-01-01', 'sample@example.test', 'Not applicable', 'Secondary verification', 'Verifier:', 'Conforming']) assert.ok(xml.includes(text), text);
  for (const text of ['{{', context.review.comment, context.review.verificationComment, '신청구분:', '해당 없음']) assert.ok(!xml.includes(text), text);
  writeFileSync(`${directory}/${kind}.docx`, bytes);
  for (const field of ['reviewComment', 'verificationComment']) {
    const missing = structuredClone(input); missing.englishText[field] = '';
    assert.equal((await POST(request(missing))).status, 422, field);
  }
}
for (const [type, label] of [['전환', 'Transfer'], ['등급변경', 'Grade change'], ['기타', 'Other']]) {
  const input = structuredClone(context); input.application.applicationType = type;
  const response = await POST(request(input)); assert.equal(response.status, 200);
  assert.ok(new PizZip(await response.arrayBuffer()).file('word/document.xml').asText().includes(`Application type: ${label}`));
}
const packagePOST = load('@/app/api/documents/package/route').POST;
const packageRequest = input => new Request('https://example.test/package', {method: 'POST', body: JSON.stringify({context: input, jobs: [job], languages: ['KR', 'EN']})});
const packageResponse = await packagePOST(packageRequest(context));
assert.equal(packageResponse.status, 200);
assert.equal(packageResponse.headers.get('X-Package-Complete'), 'true');
const packageBytes = Buffer.from(await packageResponse.arrayBuffer());
const archive = new PizZip(packageBytes);
const manifest = JSON.parse(archive.file('package_manifest.json').asText());
assert.equal(manifest.documentCount, 6); assert.deepEqual(manifest.missing, []);
assert.equal(Object.keys(archive.files).filter(name => name.endsWith('.docx')).length, 6);
assert.equal(packageResponse.headers.get('X-Package-SHA256'), createHash('sha256').update(packageBytes).digest('hex'));
for (const entry of manifest.documents) {
  const bytes = archive.file(entry.entryName).asNodeBuffer();
  assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.ok(!new PizZip(bytes).file('word/document.xml').asText().includes('{{'));
}
writeFileSync(`${directory}/bilingual-package.zip`, packageBytes);
const unsupportedEvidence = structuredClone(context);
unsupportedEvidence.evidenceReview = {links: [{requirement: '교육요건'}]};
assert.equal((await POST(request(unsupportedEvidence))).status, 422);
assert.equal((await packagePOST(packageRequest(unsupportedEvidence))).status, 422);
console.log('영문 검토서: 일반/장문·미번역 차단·신청구분·해당없음·실제 국영문 6종 ZIP/해시 통과 (인증/DB 모의)');
export {context,job,POST,request,packagePOST,packageRequest};
