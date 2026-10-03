import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PrivacyAccessLogTable } from "@/components/privacy-access-log-table";
import { requireAdmin } from "@/lib/supabase/access";

async function AccessLogsContent() {
  const staff = await requireAdmin();
  return <AppShell title="개인정보 접근이력" description="최고관리자 전용 · 조회 및 문서 생성 응답 기록">
    {staff.prototype ? <p>실제 접근이력은 Supabase 연결 후 확인할 수 있습니다.</p> : <PrivacyAccessLogTable/>}
  </AppShell>;
}
export default function AccessLogsPage() {
  return <Suspense fallback={<p className="p-8">권한을 확인하고 있습니다.</p>}><AccessLogsContent/></Suspense>;
}
