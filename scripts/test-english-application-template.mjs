import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import PizZip from 'pizzip';

const source = new PizZip(readFileSync('templates/FGPC-008-01-application-review-kr.docx'));
const translated = new PizZip(readFileSync('templates/FGPC-008-01-application-review-en.docx'));
const body = translated.file('word/document.xml').asText();
assert.deepEqual(body.match(/\{\{\w+\}\}/g), source.file('word/document.xml').asText().match(/\{\{\w+\}\}/g));
assert.ok(!/[가-힣]/.test(body.replace(/<[^>]*>/g, '')));
assert.deepEqual(Object.keys(translated.files), Object.keys(source.files));
for (const name of Object.keys(source.files).filter(name => !source.files[name].dir && name !== 'word/document.xml' && !/^word\/footer.*\.xml$/.test(name))) {
  assert.deepEqual(translated.file(name).asUint8Array(), source.file(name).asUint8Array(), name);
}
const generated = spawnSync(process.execPath, ['scripts/create-english-application-samples.mjs'], {encoding: 'utf8'});
assert.equal(generated.status, 0, generated.stdout + generated.stderr);
console.log(generated.stdout.trim());
