import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/report-analytics.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { revenueForJobs, customerCounts, certificationEventCounts, isReportPeriod, matchesReportPeriod } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const invoices = [{ id: 'i1', amount: 1000, paid_amount: 800, issued_at: '2026-09-01', paid_at: '2026-10-01', invoice_jobs: [{ job_id: 'a' }, { job_id: 'b' }, { job_id: 'b' }] }];
assert.deepEqual(revenueForJobs(invoices, new Set(['a']), '2026-09'), { billed: 500, received: 0 });
assert.deepEqual(revenueForJobs(invoices, new Set(['a']), '2026-10'), { billed: 0, received: 400 });
assert.deepEqual(revenueForJobs(invoices, new Set(['a','b']), '2026'), { billed: 1000, received: 800 });
assert.deepEqual(revenueForJobs(invoices, new Set(['other']), '2026'), { billed: 0, received: 0 });
assert.deepEqual(revenueForJobs([{ ...invoices[0], invoice_jobs: [] }], new Set(['a']), '2026'), { billed: 0, received: 0 });
const jobs = [{ candidateId: 'c1', certificationState: 'ACTIVE' }, { candidateId: 'c1', certificationState: 'ACTIVE' }, { candidateId: 'c1', certificationState: 'SUSPENDED' }, { candidateId: 'c2', certificationState: 'WITHDRAWN' }];
assert.deepEqual(customerCounts(jobs), { total: 2, active: 1, suspended: 1, withdrawn: 1 });
assert.deepEqual(customerCounts([]), { total: 0, active: 0, suspended: 0, withdrawn: 0 });
const eventJobs = [{ jobId: 'a', candidateId: 'c1' }, { jobId: 'b', candidateId: 'c1' }];
const events = [
  { id: 'e1', job_id: 'a', action_type: 'SUSPENDED', effective_date: '2026-10-01' },
  { id: 'e2', job_id: 'b', action_type: 'SUSPENDED', effective_date: '2026-10-02' },
  { id: 'e3', job_id: 'a', action_type: 'WITHDRAWN', effective_date: '2026-11-01' },
  { id: 'e4', job_id: 'excluded', action_type: 'WITHDRAWN', effective_date: '2026-10-01' },
];
assert.deepEqual(certificationEventCounts(events, eventJobs, '2026-10'), { suspended: { customers: 1, events: 2 }, withdrawn: { customers: 0, events: 0 } });
assert.deepEqual(certificationEventCounts([...events, events[0]], eventJobs, '2026-10'), certificationEventCounts(events, eventJobs, '2026-10'));
assert.equal(certificationEventCounts(events, eventJobs, '2026').withdrawn.events, 1);
assert.equal(certificationEventCounts(events, [], '2026').suspended.events, 0);
for (const period of ['', '202', '2026-1', '2026-00', '2026-13', '2026-10-01']) {
  assert.equal(isReportPeriod(period), false);
  assert.deepEqual(revenueForJobs(invoices, new Set(['a','b']), period), { billed: 0, received: 0 });
  assert.deepEqual(certificationEventCounts(events, eventJobs, period), { suspended: { customers: 0, events: 0 }, withdrawn: { customers: 0, events: 0 } });
}
assert.equal(matchesReportPeriod('2026-10-01', '2026'), true);
assert.equal(matchesReportPeriod('2026-10-01T08:00:00Z', '2026-10'), true);
assert.equal(matchesReportPeriod('2026-10-01', '2026-01'), false);
for (const date of [null, undefined, '', '2026-10', '2026-10-00', '2026-13-01', '20260-10-01']) assert.equal(matchesReportPeriod(date, '2026'), false);
const analyticsUi = fs.readFileSync(new URL('../components/report-business-analytics.tsx', import.meta.url), 'utf8');
assert.match(analyticsUi, /if \(!validMonth\) return;/);
assert.match(analyticsUi, /보고서를 조회할 월을 선택/);
const eventsUi = fs.readFileSync(new URL('../components/report-certification-events.tsx', import.meta.url), 'utf8');
assert.match(eventsUi, /if \(state !== "ready" \|\| !periods.length\) return;/);
console.log('보고서 분석: 수익·고객·상태변동 및 빈 기간/잘못된 월/날짜 접두어 혼동 차단 검사 통과');
