export function readApplicationBundle(value: unknown, expectedCandidateId?: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("신청 연결 응답 오류");
  const row = value as Record<string, unknown>;
  const uuid = (input: unknown): input is string => typeof input === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
  if (!uuid(row.application_id) || !uuid(row.candidate_id) || !uuid(row.job_id) || (expectedCandidateId && row.candidate_id !== expectedCandidateId)) throw new Error("신청·후보자·Job 연결 ID를 확인하지 못했습니다.");
  return { application_id: row.application_id, candidate_id: row.candidate_id, job_id: row.job_id };
}

export function hasUniqueRegistrationIds(rows: unknown, excluded: string[] = []): rows is Array<{ id: string }> {
  return Array.isArray(rows) && rows.length > 0 && rows.every(row => row && typeof row.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) && !excluded.includes(row.id)) && new Set(rows.map(row => row.id)).size === rows.length;
}
