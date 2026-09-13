import { AppShell } from "@/components/app-shell";
import { OperationsStatusTable } from "@/components/operations-status-table";

export default function StatusPage() {
  return <AppShell title="통합 업무현황" description="후보자와 Job별 서류검토, 청구, 입금, 인증서 발행 및 원본 송부 현황을 한 화면에서 확인합니다.">
    <OperationsStatusTable/>
  </AppShell>;
}
