import {AppShell} from "@/components/app-shell";
import {StaffTestChecklist} from "@/components/staff-test-checklist";
export default function TestingPage(){return <AppShell title="실무 테스트 점검표" description="가상 데이터로 접수부터 패키지까지 검증하고, 발견한 문제와 재현 절차를 기록합니다."><StaffTestChecklist/></AppShell>;}
