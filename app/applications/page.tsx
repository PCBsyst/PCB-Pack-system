import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ApplicationsTable } from "@/components/applications-table";
import { Button } from "@/components/ui/button";
import { applications } from "@/data/workflow-data";

export default function ApplicationsPage() {
  return <AppShell title="신청 관리" description="대표메일 접수부터 복수 Job, 청구, 심의와 패키지까지 신청 단위로 관리합니다." actions={<Button asChild className="bg-blue-800 hover:bg-blue-900"><Link href="/applications/new"><Plus />신규 신청 등록</Link></Button>}>
    <div className="mb-5 grid gap-4 md:grid-cols-2">
      <Link href="/applications?area=ISO" className="rounded-lg border border-blue-100 bg-blue-50 p-5"><p className="text-xs font-semibold text-blue-700">ISO</p><p className="mt-2 text-lg font-semibold text-slate-950">ISO 경영시스템 심사원</p><p className="mt-1 text-sm text-slate-600">신청 {applications.filter((item) => item.businessArea === "ISO").length}건</p></Link>
      <Link href="/applications?area=K_BEAUTY" className="rounded-lg border border-rose-100 bg-rose-50 p-5"><p className="text-xs font-semibold text-rose-700">K-BEAUTY</p><p className="mt-2 text-lg font-semibold text-slate-950">K-Beauty 전문가 자격</p><p className="mt-1 text-sm text-slate-600">신청 {applications.filter((item) => item.businessArea === "K_BEAUTY").length}건</p></Link>
    </div>
    <ApplicationsTable />
  </AppShell>;
}
