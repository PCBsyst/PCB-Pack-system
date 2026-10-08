export type RegistrationExpectation = { jobCount: number; standards: string[]; source: "USER_REFERENCE" };
const canonical = (value: string) => value.trim().normalize("NFC").toUpperCase();

export function parseRegistrationExpectation(countText: string, standardsText: string): RegistrationExpectation | null {
  const count = countText.trim();
  if (standardsText.length > 20000) throw new Error("표준 목록이 너무 깁니다.");
  const standards = standardsText.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (!count && !standards.length) return null;
  if (count && (!/^\d{1,4}$/.test(count) || Number(count) < 1 || Number(count) > 1000)) throw new Error("원 신청 Job 수는 1~1000 사이 정수로 입력해 주세요.");
  if (standards.length > 1000 || standards.some(value => value.length > 200 || /[\u0000-\u001f]/.test(value)) || new Set(standards.map(canonical)).size !== standards.length) throw new Error("표준명을 한 줄에 하나씩, 중복 없이 입력해 주세요.");
  const jobCount = count ? Number(count) : standards.length;
  if (standards.length && standards.length !== jobCount) throw new Error("원 신청 Job 수와 입력한 표준 목록의 줄 수가 다릅니다.");
  return { jobCount, standards, source: "USER_REFERENCE" };
}

export function compareRegistrationExpectation(jobs: Array<{ standard: string }>, expectation: RegistrationExpectation | null) {
  if (!expectation) return null;
  const actual = new Set(jobs.map(job => canonical(job.standard))), expected = new Set(expectation.standards.map(canonical));
  const missingStandards = expectation.standards.filter(standard => !actual.has(canonical(standard)));
  const unexpectedStandards = expectation.standards.length ? [...new Set(jobs.filter(job => !expected.has(canonical(job.standard))).map(job => job.standard))] : [];
  const countMismatch = jobs.length !== expectation.jobCount;
  return { expectedCount: expectation.jobCount, actualCount: jobs.length, standardsProvided: Boolean(expectation.standards.length), countMismatch, missingStandards, unexpectedStandards, matched: !countMismatch && !missingStandards.length && !unexpectedStandards.length };
}
