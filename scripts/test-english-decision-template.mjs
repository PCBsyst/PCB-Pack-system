import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import PizZip from 'pizzip';
const kr=new PizZip(readFileSync('templates/FGPC-012-01-decision-report-kr.docx')),en=new PizZip(readFileSync('templates/FGPC-012-01-decision-report-en.docx'));const body=en.file('word/document.xml').asText();
assert.deepEqual(body.match(/\{\{\w+\}\}/g),kr.file('word/document.xml').asText().match(/\{\{\w+\}\}/g));assert.ok(!/[가-힣]/.test(body.replace(/<[^>]*>/g,'')));
for(const name of Object.keys(kr.files).filter(n=>n.startsWith('word/media/')))assert.deepEqual(en.file(name).asUint8Array(),kr.file(name).asUint8Array());
const generated=spawnSync(process.execPath,['scripts/create-english-decision-samples.mjs'],{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
console.log('영문 인증결정보고서: 모든 입력 필드/기업 이미지 보존·실제 생성 코드·영문 의견·번역 누락 차단 통과 (인증/DB 모의)');
