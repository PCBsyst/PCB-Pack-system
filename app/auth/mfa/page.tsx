import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { MfaSetup } from "@/components/mfa-setup";
import { getCurrentStaff } from "@/lib/supabase/access";

export default function MfaPage() {
  return <Suspense fallback={<p className="p-8">직원 권한을 확인하고 있습니다.</p>}><Content/></Suspense>;
}
async function Content() {
  const staff = await getCurrentStaff();
  return <AppShell title="내 계정 보안" description="인증 앱을 연결하고 2단계 인증 코드를 확인합니다."><MfaSetup prototype={staff.prototype}/></AppShell>;
}
