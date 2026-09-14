import { CalendarDays, ChevronRight, ListChecks, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DocumentRuleSettings } from "@/components/document-rule-settings";
import { GeneralSettings } from "@/components/general-settings";

const sections = [
  { id: "reviewers", icon: UsersRound, title: "심의자 명단", description: "계정 없이 심의기록에서 선택할 심의자를 관리합니다.", meta: "명단 편집 가능" },
  { id: "date-rules", icon: CalendarDays, title: "업무일자 계산 규칙", description: "인증발행일 기준 전·후 영업일 간격을 설정합니다.", meta: "새 회차부터 적용" },
  { id: "reasons", icon: ListChecks, title: "정지·철회 표준 사유", description: "보고서 집계에 사용할 표준 사유를 관리합니다.", meta: "사유 편집 가능" },
  { id: "users", icon: UserCog, title: "사용자 및 권한", description: "실무자와 관리자 초대 및 비활성화를 관리합니다.", meta: "테스트 명단 관리" },
];

export default function SettingsPage() {
  return <AppShell title="설정" description="관리자 전용 기준정보와 업무 규칙을 관리합니다.">
    <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="mr-2 inline h-4 w-4"/>현재 규칙은 테스트 브라우저에만 저장됩니다.</div>
    <div className="grid gap-4 md:grid-cols-2">{sections.map(({ id, icon: Icon, title, description, meta }) => <a href={`#${id}`} key={title} className="group flex items-center gap-4 rounded-lg border bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-800"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span><span className="mt-2 block text-xs font-medium text-blue-700">{meta}</span></span><ChevronRight className="h-5 w-5 text-slate-300"/></a>)}</div>
    <GeneralSettings/>
    <DocumentRuleSettings/>
  </AppShell>;
}
