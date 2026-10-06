import type { PackageContext } from "@/lib/prototype-package";
import { matchesPackageWorkspace } from "@/lib/package-workspace-matching";

/** Download success is not proof that preceding workflow steps have completed. */
export function packageStageAfterDownload(currentStage: string, startedStage: string, complete: boolean, canEdit: boolean, sharedWorkspace: boolean, receiptStatus?: string): string {
  if (!complete || !canEdit || currentStage !== startedStage || (sharedWorkspace && receiptStatus !== "RECORDED")) return currentStage;
  return currentStage === "PACKAGE_READY" ? "COMPLETED" : currentStage;
}

/** A generated file belongs to its input snapshot, not subsequently edited work. */
export function canAttachPackageGeneration(snapshot: PackageContext, current: PackageContext): boolean {
  if (snapshot.application.id !== current.application.id || snapshot.application.applicationNo !== current.application.applicationNo
    || snapshot.jobs.length !== current.jobs.length) return false;
  for (const key of ["id", "name", "nameEn", "birthDate", "nationality", "email", "phone", "address"] as const) {
    if (snapshot.candidate[key] !== current.candidate[key]) return false;
  }
  if (snapshot.jobs.some((job) => !current.jobs.some((latest) => latest.id === job.id && latest.jobNo === job.jobNo
    && latest.candidateId === job.candidateId && latest.standard === job.standard && latest.currentGrade === job.currentGrade))) return false;
  return matchesPackageWorkspace(snapshot, snapshot.jobs.map((job) => job.id), current);
}
