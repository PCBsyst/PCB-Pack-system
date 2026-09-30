import { AppShell } from "@/components/app-shell";
import { CertificationActionsReport } from "@/components/certification-actions-report";

export default function CertificationActionsPage() {
  return (
    <AppShell
      title="정지·철회 현황"
      description="인증 정지 및 철회 이력을 조회하고 보고용 자료로 내려받습니다."
    >
      <CertificationActionsReport />
    </AppShell>
  );
}
