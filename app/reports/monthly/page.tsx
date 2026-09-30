import { AppShell } from "@/components/app-shell";
import { MonthlyOperationsReport } from "@/components/monthly-operations-report";

export default function MonthlyReportPage() {
  return <AppShell title="월간 업무보고" description="월별 접수 및 인증발행 실적을 분야·표준·파트너사 기준으로 집계합니다."><MonthlyOperationsReport /></AppShell>;
}
