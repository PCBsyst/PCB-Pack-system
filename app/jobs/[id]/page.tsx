import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { JobDetail } from "@/components/job-detail";
import { Button } from "@/components/ui/button";
import { getCandidate, getJob, jobs } from "@/data/mock-data";
export function generateStaticParams(){return jobs.map((job)=>({id:job.id}));}
export default async function JobPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const job=getJob(id);if(!job)notFound();const candidate=getCandidate(job.candidateId)!;return <AppShell title={job.jobNo} description={`${candidate.name} · ${job.standard} · Job 상세`} actions={!job.currentCycleId?<Button asChild className="bg-blue-800 hover:bg-blue-900"><Link href={`/cycles/new?job=${job.id}`}><Plus/>새 처리 회차</Link></Button>:undefined}><Link href="/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4"/>Job 목록</Link><JobDetail job={job} candidate={candidate}/></AppShell>}
