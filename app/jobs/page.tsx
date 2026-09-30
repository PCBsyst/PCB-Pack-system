import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { JobsTable } from "@/components/jobs-table";
export default function JobsPage(){return <AppShell title="Job 관리" description="규격별 Job과 접수부터 인증서 발행까지의 현재 단계를 조회합니다." actions={<Button asChild className="bg-blue-800 hover:bg-blue-900"><Link href="/applications/new"><Plus/>새 신청 등록</Link></Button>}><JobsTable/></AppShell>}
