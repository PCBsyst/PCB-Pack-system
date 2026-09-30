import { AppShell } from "@/components/app-shell";
import { PackagesManager } from "@/components/packages-manager";

export default function PackagesPage() {
  return <AppShell title="패키지" description="Job별 기록 문서의 생성상태와 다운로드 준비 여부를 확인합니다."><PackagesManager/></AppShell>;
}
