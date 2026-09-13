import { AppShell } from "@/components/app-shell";
import { NewApplicationForm } from "@/components/new-application-form";

export default function NewApplicationPage() {
  return <AppShell title="신규 신청 등록" description="대표메일 최초 수신일을 공식 접수일로 기록하고 세부 분야별 관리 No.와 Job No.를 확정합니다.">
    <NewApplicationForm />
  </AppShell>;
}
