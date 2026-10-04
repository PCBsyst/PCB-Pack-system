import { Suspense } from "react";
import { MfaSetup } from "@/components/mfa-setup";
import { getMfaSetupStaff } from "@/lib/supabase/access";

export default function MfaPage() {
  return <Suspense fallback={<p className="p-8">직원 권한을 확인하고 있습니다.</p>}><Content/></Suspense>;
}
async function Content() {
  const staff = await getMfaSetupStaff();
  return <main className="mx-auto max-w-2xl px-4 py-10"><h1 className="mb-5 text-2xl font-semibold">내 계정 보안</h1><MfaSetup prototype={staff.prototype}/></main>;
}
