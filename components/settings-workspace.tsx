"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, CalendarDays, FileArchive, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { GeneralSettings } from "@/components/general-settings";
import { DocumentRuleSettings } from "@/components/document-rule-settings";
import { DocumentTemplateManager } from "@/components/document-template-manager";
import { cn, hasEnvVars } from "@/lib/utils";

const categories = [
  { id: "users", label: "사용자·권한", icon: UserCog, description: "직원 계정, 초대 및 승인·활성상태를 관리합니다." },
  { id: "directory", label: "기준정보", icon: UsersRound, description: "심의위원과 파트너사 명단을 관리합니다." },
  { id: "workflow", label: "업무규칙", icon: CalendarDays, description: "업무일자 계산, 정지·철회 사유와 제출서류 적용 규칙을 설정합니다." },
  { id: "documents", label: "문서양식", icon: FileArchive, description: "국문·영문 원본 양식과 개정 버전을 관리합니다." },
  { id: "security", label: "보안·이력", icon: ShieldCheck, description: "개인정보 접근 추적과 현재 적용된 보안 범위를 확인합니다." },
] as const;
export type SettingsCategory = typeof categories[number]["id"];
const aliases: Record<string, SettingsCategory> = { reviewers: "directory", partners: "directory", "date-rules": "workflow", reasons: "workflow", "document-templates": "documents" };
export function SettingsWorkspace() {
  const [category, setCategory] = useState<SettingsCategory>("users");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const sync = () => { const hash = window.location.hash.slice(1); const matching = categories.find((item) => item.id === hash); setCategory(matching?.id ?? aliases[hash] ?? "users"); };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const select = (id: SettingsCategory) => { setCategory(id); window.history.replaceState(null, "", `#${id}`); };
  const current = categories.find((item) => item.id === category)!;
  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm"><div role="tablist" aria-label="설정 카테고리" className="grid grid-cols-2 gap-1 sm:grid-cols-5">{categories.map(({ id, label, icon: Icon }, index) => <button key={id} ref={(element) => { tabs.current[index] = element; }} id={`settings-tab-${id}`} role="tab" type="button" aria-selected={category === id} aria-controls={`settings-panel-${id}`} tabIndex={category === id ? 0 : -1} onClick={() => select(id)} onKeyDown={(event) => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % categories.length;
      else if (event.key === "ArrowLeft") next = (index + categories.length - 1) % categories.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = categories.length - 1;
      else return;
      event.preventDefault(); select(categories[next].id); tabs.current[next]?.focus();
    }} className={cn("flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition", category === id ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")}><Icon className="h-4 w-4 shrink-0"/>{label}</button>)}</div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-1"><div><h2 className="text-lg font-semibold text-slate-900">{current.label}</h2><p className="mt-1 text-sm text-slate-500">{current.description}</p></div><span className="rounded-full border bg-white px-3 py-1 text-[11px] text-slate-500">최고관리자 전용</span></div>
    {/* Keep form components mounted so switching categories never discards unsaved edits. */}
    <div hidden={!(["users", "directory", "workflow"] as string[]).includes(category)} role="tabpanel" id={`settings-panel-${["users", "directory", "workflow"].includes(category) ? category : "general"}`} aria-labelledby={`settings-tab-${category}`}>
      <GeneralSettings category={category}/>
      <div hidden={category !== "directory"}><Link href="/training-institutions" className="mt-5 flex items-center justify-between rounded-xl border bg-white p-5 text-sm font-medium text-blue-800"><span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4"/>협약 연수기관 관리로 이동</span><ArrowRight className="h-4 w-4"/></Link></div>
      <div hidden={category !== "workflow"}><DocumentRuleSettings/><p className="mt-3 text-xs text-slate-500">업무일자·표준 사유는 {hasEnvVars ? "공유 DB" : "이 브라우저"}에 저장됩니다. 분야별 제출서류 적용 규칙은 현재 브라우저 저장 방식입니다.</p></div>
    </div>
    <div hidden={category !== "documents"} role="tabpanel" id="settings-panel-documents" aria-labelledby="settings-tab-documents"><DocumentTemplateManager/></div>
    <div hidden={category !== "security"} role="tabpanel" id="settings-panel-security" aria-labelledby="settings-tab-security" className="space-y-4">
      <Link href="/security/access-logs" className="flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-6 shadow-sm hover:border-blue-300"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-800"><ShieldCheck className="h-5 w-5"/></span><span className="flex-1"><span className="block font-semibold">개인정보 접근이력</span><span className="mt-1 block text-sm text-slate-500">후보자 상세 조회 및 Word·ZIP 생성 응답 이력을 확인합니다.</span></span><ArrowRight className="h-5 w-5 text-slate-400"/></Link>
      <section className="rounded-xl border bg-white p-6"><h3 className="font-semibold">현재 보안 적용 범위</h3><p className="mt-3 text-sm leading-7 text-slate-600">계정 승인·활성상태 검사와 최고관리자 권한 분리를 적용합니다. 접근이력은 현재 DB 후보자 상세 조회와 서버 문서 생성 경로에 연결되어 있습니다. 전체 화면 조회 추적, MFA, 신뢰 기기, 자동백업은 후속 검증·구현 항목입니다.</p><p className="mt-3 text-xs text-slate-500">보안 기능을 단순 표시만으로 적용 완료로 판단하지 않습니다.</p></section>
    </div>
  </div>;
}
