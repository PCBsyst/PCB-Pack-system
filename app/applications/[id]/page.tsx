import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ApplicationDetail } from "@/components/application-detail";
import { getCandidate, jobs } from "@/data/mock-data";
import { applications, getApplication, getApplicationInvoices } from "@/data/workflow-data";
import { PrototypeApplicationWorkspace } from "@/components/prototype-application-workspace";
import { SupabaseApplicationWorkspace } from "@/components/supabase-application-workspace";
import { hasEnvVars } from "@/lib/utils";
import {Suspense} from "react";

export function generateStaticParams() { return applications.map((application) => ({ id: application.id })); }

export default function ApplicationDetailPage(props:{params:Promise<{id:string}>}){
  return <Suspense fallback={<p role="status" className="p-6">신청 업무기록을 불러오고 있습니다.</p>}><ApplicationDetailContent {...props}/></Suspense>;
}
async function ApplicationDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.startsWith("local-")) return <AppShell title="신규 신청 업무" description="서류검토부터 최종 패키지까지 전체 업무를 처리합니다."><PrototypeApplicationWorkspace key={id} id={id}/></AppShell>;
  const application = getApplication(id);
  if (!application && hasEnvVars) return <AppShell title="신규 신청 업무" description="Supabase에 저장된 신청의 전체 업무를 처리합니다."><SupabaseApplicationWorkspace key={id} id={id}/></AppShell>;
  if (!application) notFound();
  const candidate = getCandidate(application.candidateId);
  if (!candidate) notFound();
  const linkedJobs = jobs.filter((job) => application.jobIds.includes(job.id));
  return <AppShell title={application.applicationNo} description={`${candidate.name} · ${application.dropboxFolderName}`}><ApplicationDetail key={application.id} application={application} candidate={candidate} linkedJobs={linkedJobs} invoices={getApplicationInvoices(application)}/></AppShell>;
}
