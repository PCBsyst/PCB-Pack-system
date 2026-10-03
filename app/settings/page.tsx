import { CalendarDays, ChevronRight, Database, FileArchive, ListChecks, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DocumentRuleSettings } from "@/components/document-rule-settings";
import { DocumentTemplateManager } from "@/components/document-template-manager";
import { GeneralSettings } from "@/components/general-settings";
import { hasEnvVars } from "@/lib/utils";
import { requireAdmin } from "@/lib/supabase/access";
import { Suspense } from "react";

const sections = [
  { id: "reviewers", icon: UsersRound, title: "심의자 명단", description: "계정 없이 심의기록에서 선택할 심의자를 관리합니다.", meta: "명단 편집 가능" },
  { id: "partners", icon: UsersRound, title: "파트너사 명단", description: "신규 신청에서 선택할 파트너사를 관리합니다.", meta: "활성상태 관리" },
  { id: "date-rules", icon: CalendarDays, title: "업무일자 계산 규칙", description: "인증발행일 기준 전·후 영업일 간격을 설정합니다.", meta: "새 회차부터 적용" },
  { id: "reasons", icon: ListChecks, title: "정지·철회 표준 사유", description: "보고서 집계에 사용할 표준 사유를 관리합니다.", meta: "사유 편집 가능" },
  { id: "users", icon: UserCog, title: "사용자 및 권한", description: "실무자와 관리자 초대 및 비활성화를 관리합니다.", meta: "테스트 명단 관리" },
  { id: "document-templates", icon: FileArchive, title: "문서 양식", description: "국문·영문 DOCX 원본과 개정 버전을 관리합니다.", meta: "양식 등록·교체" },
];

export default function SettingsPage() {
  return <Suspense fallback={<AppShell title="설정" description="관리자 권한을 확인하고 있습니다."><div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">설정을 불러오는 중입니다.</div></AppShell>}><SettingsContent/></Suspense>;
}

async function SettingsContent() {
  await requireAdmin();
  return <AppShell title="설정" description="관리자 전용 기준정보와 업무 규칙을 관리합니다.">
    <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="mr-2 inline h-4 w-4"/>현재 규칙은 테스트 브라우저에만 저장됩니다.</div>
    <div className={`mb-5 flex items-start gap-3 rounded-lg border p-4 text-sm ${hasEnvVars ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}><Database className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="font-semibold">Supabase {hasEnvVars ? "연결 설정 완료" : "연결 준비 중"}</p><p className="mt-1 text-xs leading-5">{hasEnvVars ? "환경변수가 등록되어 있습니다. 데이터 이관 검증 후 화면별 저장 경로를 전환할 수 있습니다." : "DB 스키마는 준비됐으며 프로젝트 URL과 Publishable Key 등록 전까지 가상데이터 모드로 안전하게 동작합니다."}</p></div></div>
    <div className="grid gap-4 md:grid-cols-2">{sections.map(({ id, icon: Icon, title, description, meta }) => <a href={`#${id}`} key={title} className="group flex items-center gap-4 rounded-lg border bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-800"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span><span className="mt-2 block text-xs font-medium text-blue-700">{meta}</span></span><ChevronRight className="h-5 w-5 text-slate-300"/></a>)}</div>
    <GeneralSettings/>
    <a href="/security/access-logs" className="mt-6 block rounded-lg border bg-white p-5 font-semibold text-blue-800">개인정보 조회·문서 생성 접근이력 보기 (최고관리자 전용)</a>
    <DocumentRuleSettings/>
    <DocumentTemplateManager/>
  </AppShell>;
}
