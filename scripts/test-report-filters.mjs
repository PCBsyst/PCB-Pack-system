import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/report-filters.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { matchesReportFilters } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const row = { businessArea: 'ISO', standard: 'ISO 9001', partner: '파트너A', grade: 'A', applicationType: 'RENEWAL' };
const all = { area: '전체', standard: '전체', partner: '전체', grade: '전체', applicationType: '전체' };
assert.equal(matchesReportFilters(row, all), true);
for (const [filter, field] of [['area','businessArea'], ['standard','standard'], ['partner','partner'], ['grade','grade'], ['applicationType','applicationType']]) {
  assert.equal(matchesReportFilters(row, { ...all, [filter]: row[field] }), true);
  assert.equal(matchesReportFilters(row, { ...all, [filter]: '다른 조건' }), false);
}
assert.equal(matchesReportFilters(row, { area: 'ISO', standard: 'ISO 9001', partner: '파트너A', grade: 'A', applicationType: 'RENEWAL' }), true);
console.log('Report filters: 12 cases passed');
