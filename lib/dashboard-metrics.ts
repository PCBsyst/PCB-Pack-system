type WorkloadRow = { applicationId: string; jobId: string; businessArea: string; workflow: { stage?: string; review?: { result?: string } } };
export function dashboardMetrics(rows: WorkloadRow[]) {
  const applications = new Set<string>(), active = new Set<string>(), payment = new Set<string>(), packageReady = new Set<string>(), supplement = new Set<string>();
  const jobs = new Set<string>(), iso = new Set<string>(), beauty = new Set<string>(), intake = new Set<string>();
  for (const row of rows) {
    applications.add(row.applicationId);
    if (row.jobId) {
      jobs.add(row.jobId);
      if (row.businessArea === "ISO") iso.add(row.jobId);
      if (row.businessArea === "K_BEAUTY") beauty.add(row.jobId);
    } else { intake.add(row.applicationId); }
    if (row.workflow.stage !== "COMPLETED") active.add(row.applicationId);
    if (row.workflow.stage === "PAYMENT_PENDING") payment.add(row.applicationId);
    if (row.workflow.stage === "PACKAGE_READY") packageReady.add(row.applicationId);
    if (row.workflow.stage === "DOCUMENT_REVIEW" && row.workflow.review?.result === "보완필요") supplement.add(row.applicationId);
  }
  return { applications: applications.size, jobs: jobs.size, active: active.size, intake: intake.size, payment: payment.size, packageReady: packageReady.size, supplement: supplement.size, iso: iso.size, beauty: beauty.size };
}
