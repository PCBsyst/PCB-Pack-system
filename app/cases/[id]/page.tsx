import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CaseDetail } from "@/components/case-detail";
import { certificationCases } from "@/data/mock-data";
export function generateStaticParams() { return certificationCases.map((item) => ({ id: item.id })); }
export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const item = certificationCases.find((entry) => entry.id === id); if (!item) notFound(); return <AppShell title="인증건 상세" description={`${item.registrationNo} 인증업무 처리 기록`}><CaseDetail item={item} /></AppShell>; }
