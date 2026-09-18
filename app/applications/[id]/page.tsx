import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ApplicationDetail } from "@/components/application-detail";
import { getCandidate, jobs } from "@/data/mock-data";
import { applications, getApplication, getApplicationInvoices } from "@/data/workflow-data";
import { PrototypeRecordDetail } from "@/components/prototype-record-detail";

export function generateStaticParams() { return applications.map((application) => ({ id: application.id })); }

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.startsWith("local-")) return <AppShell title="신규 신청 상세" description="브라우저에 저장된 샘플 신청 기록입니다."><PrototypeRecordDetail id={id} kind="application"/></AppShell>;
  const application = getApplication(id);
  if (!application) notFound();
  const candidate = getCandidate(application.candidateId);
  if (!candidate) notFound();
  const linkedJobs = jobs.filter((job) => application.jobIds.includes(job.id));
  return <AppShell title={application.applicationNo} description={`${candidate.name} · ${application.dropboxFolderName}`}><ApplicationDetail application={application} candidate={candidate} linkedJobs={linkedJobs} invoices={getApplicationInvoices(application)}/></AppShell>;
}
