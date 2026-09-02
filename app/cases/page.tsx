import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CasesTable } from "@/components/cases-table";
import { Button } from "@/components/ui/button";
export default function CasesPage() { return <AppShell title="인증업무" description="등록된 인증건을 조회하고 처리 현황을 관리합니다." actions={<Button asChild className="bg-blue-800 hover:bg-blue-900"><Link href="/cases/new"><Plus />신규 인증건 등록</Link></Button>}><CasesTable /></AppShell>; }
