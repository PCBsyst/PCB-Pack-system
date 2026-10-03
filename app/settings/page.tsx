import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { SettingsWorkspace } from "@/components/settings-workspace";
import { requireAdmin } from "@/lib/supabase/access";

export default function SettingsPage() {
  return <Suspense fallback={<AppShell title="시스템 설정" description="최고관리자 권한을 확인하고 있습니다."><p className="rounded-xl border bg-white p-8 text-sm text-slate-500">설정을 불러오는 중입니다.</p></AppShell>}><SettingsContent/></Suspense>;
}
async function SettingsContent() {
  await requireAdmin();
  return <AppShell title="시스템 설정" description="필요한 카테고리를 선택해 기준정보와 업무 환경을 관리하세요."><SettingsWorkspace/></AppShell>;
}
