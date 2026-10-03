import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaffInviteForm } from "@/components/staff-invite-form";
import { getCurrentStaff } from "@/lib/supabase/access";

async function InvitationContent() {
  const staff = await getCurrentStaff();
  if (staff.role !== "ADMIN") redirect("/?access=admin-required");
  return <AppShell title="직원 초대" description="최고관리자 및 서브 관리자 전용"><StaffInviteForm/></AppShell>;
}
export default function Page() { return <Suspense fallback={<p className="p-8">권한 확인 중…</p>}><InvitationContent/></Suspense>; }
