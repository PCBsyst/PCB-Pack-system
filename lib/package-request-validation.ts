function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= 500 && !/[\x00-\x1f]/.test(value);
}
function optionalDate(value: unknown): boolean {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function packageSafePath(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

/** Checks request consistency only, not equivalence to authoritative DB records. */
export function validatePackageRequest(value: unknown): string | null {
  if (!record(value) || !record(value.context)) return "패키지 신청정보가 없습니다.";
  const context = value.context;
  if (!record(context.application) || !record(context.candidate)
    || !text(context.application.id) || !text(context.application.applicationNo)
    || !text(context.candidate.id) || !text(context.candidate.name)
    || context.application.candidateId !== context.candidate.id) return "신청과 후보자 정보가 일치하지 않습니다.";
  const jobs = value.jobs;
  if (!Array.isArray(jobs) || !jobs.length || jobs.length > 100
    || !Array.isArray(value.languages) || !value.languages.length
    || value.languages.length > 2 || value.languages.some((item) => item !== "KR" && item !== "EN")
    || new Set(value.languages).size !== value.languages.length) return "Job과 국문·영문을 중복 없이 선택해 주세요.";
  if (!Array.isArray(context.application.jobIds) || !Array.isArray(context.jobs)
    || !record(context.review) || !record(context.certificates) || !record(context.decisions)
    || !record(context.deliveryDocuments) || !record(context.assessment)
    || !Array.isArray(context.panelMembers) || context.panelMembers.some((member) => !record(member))) return "문서 생성에 필요한 신청 구성이 없습니다.";
  const ids = new Set<string>();
  const paths = new Set<string>();
  if (context.examSchedules !== undefined && !record(context.examSchedules)) return "교육·시험 일정 구성이 올바르지 않습니다.";
  for (const job of jobs) {
    if (!record(job) || !text(job.id) || !text(job.jobNo) || !text(job.standard) || !text(job.currentGrade)
      || job.candidateId !== context.candidate.id
      || (job.applicationId !== undefined && job.applicationId !== context.application.id)
      || !context.application.jobIds.includes(job.id)
      || !context.jobs.some((item) => record(item) && item.id === job.id && item.jobNo === job.jobNo
        && item.candidateId === job.candidateId && item.standard === job.standard && item.currentGrade === job.currentGrade)) {
      return "선택한 Job이 신청정보와 일치하지 않습니다.";
    }
    const path = packageSafePath(job.jobNo).toLowerCase();
    if (record(context.examSchedules)) {
      const schedule = context.examSchedules[job.id];
      if (!record(schedule) || !["PARTNER", "NON_PARTNER"].includes(String(schedule.providerType))
        || typeof schedule.providerName !== "string" || schedule.providerName.length > 500
        || /[\x00-\x1f]/.test(schedule.providerName)
        || ![schedule.trainingEndDate, schedule.examNoticeDate, schedule.examDate].every(optionalDate)) {
        return "교육기관 구분·명칭과 시험 일정의 날짜를 확인해 주세요.";
      }
    }
    if (ids.has(job.id) || paths.has(path)) return "Job 또는 문서 파일명이 중복됩니다. 번호를 확인해 주세요.";
    ids.add(job.id); paths.add(path);
  }
  return null;
}
