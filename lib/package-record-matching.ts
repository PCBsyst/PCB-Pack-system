import type { PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

export type PackageApplicationRow = { id: string; application_no: string; candidate_id: string };
export type PackageCandidateRow = { id: string; name: string };
export type PackageJobRow = { id: string; application_id: string; candidate_id: string; job_no: string; standard: string; grade: string };

export function matchesPackageRecords(context: PackageContext, jobs: Job[], application: PackageApplicationRow | null,
  candidate: PackageCandidateRow | null, records: PackageJobRow[] | null): boolean {
  if (!application || !candidate || !records || records.length !== jobs.length
    || application.id !== context.application.id || application.application_no !== context.application.applicationNo
    || application.candidate_id !== context.candidate.id || candidate.id !== context.candidate.id
    || candidate.name !== context.candidate.name) return false;
  const byId = new Map(records.map((row) => [row.id, row]));
  if (byId.size !== records.length) return false;
  return jobs.every((job) => {
    const row = byId.get(job.id);
    return !!row && row.application_id === application.id && row.candidate_id === candidate.id
      && row.job_no === job.jobNo && row.standard === job.standard && row.grade === job.currentGrade;
  });
}
