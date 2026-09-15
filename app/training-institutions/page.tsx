import { AppShell } from "@/components/app-shell";
import { TrainingInstitutionsManager } from "@/components/training-institutions-manager";

export default function TrainingInstitutionsPage() {
  return <AppShell title="협약 연수기관" description="지정번호, 유효기간과 교육 가능한 신청표준을 관리합니다.">
    <TrainingInstitutionsManager/>
  </AppShell>;
}
