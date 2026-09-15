"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, controlClass, textareaClass } from "@/components/form-fields";

const STORAGE_KEY = "certification-general-settings";
type Settings = { reviewers: string; reviewDays: string; decisionDays: string; deliveryDays: string; suspensionReasons: string; withdrawalReasons: string; users: string[] };
const defaults: Settings = { reviewers: "박심의, 이위원, 최위원", reviewDays: "10", decisionDays: "5", deliveryDays: "1", suspensionReasons: "자격유지 요구사항 미충족\n인증서 오용\n시정조치 미이행\n기타", withdrawalReasons: "중대한 인증서 오용\n정지 후 시정조치 미이행\n본인 요청", users: ["김담당", "오실무", "정실무"] };

export function GeneralSettings() {
  const [settings, setSettings] = useState(defaults);
  const [invite, setInvite] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) setSettings({ ...defaults, ...JSON.parse(saved) }); } catch {} }, []);
  const save = () => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); setNotice("설정이 이 브라우저에 저장되었습니다. 새 회차부터 적용됩니다."); };
  const addUser = () => { if (!invite.trim()) return; setSettings((current) => ({ ...current, users: [...current.users, invite.trim()] })); setInvite(""); setNotice("테스트 사용자가 명단에 추가되었습니다. 실제 초대메일은 전송하지 않습니다."); };
  return <div className="mt-6 space-y-6">
    {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="h-4 w-4"/>{notice}</div>}
    <section id="reviewers" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><Header title="심의자 명단" description="인증심의 단계에서 선택할 패널 명단입니다."/><div className="p-5"><Field label="심의자 이름 (쉼표로 구분)"><input className={controlClass} value={settings.reviewers} onChange={(event) => setSettings({ ...settings, reviewers: event.target.value })}/></Field></div></section>
    <section id="date-rules" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><Header title="업무일자 계산 규칙" description="인증서 발행일 기준 영업일 간격입니다. 변경값은 새 회차부터 적용합니다."/><div className="grid gap-4 p-5 sm:grid-cols-3"><Field label="서류검토일 (발행 전)"><input type="number" className={controlClass} value={settings.reviewDays} onChange={(event) => setSettings({ ...settings, reviewDays: event.target.value })}/></Field><Field label="인증심의일 (발행 전)"><input type="number" className={controlClass} value={settings.decisionDays} onChange={(event) => setSettings({ ...settings, decisionDays: event.target.value })}/></Field><Field label="문서전달일 (발행 후)"><input type="number" className={controlClass} value={settings.deliveryDays} onChange={(event) => setSettings({ ...settings, deliveryDays: event.target.value })}/></Field></div></section>
    <section id="reasons" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><Header title="정지·철회 표준 사유" description="한 줄에 하나씩 입력하며 향후 보고서 선택 항목으로 사용합니다."/><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="인증 정지 사유"><textarea className={textareaClass} value={settings.suspensionReasons} onChange={(event) => setSettings({ ...settings, suspensionReasons: event.target.value })}/></Field><Field label="인증 철회 사유"><textarea className={textareaClass} value={settings.withdrawalReasons} onChange={(event) => setSettings({ ...settings, withdrawalReasons: event.target.value })}/></Field></div></section>
    <section id="users" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><Header title="사용자 및 권한" description="현재는 테스트 명단만 관리하며 실제 이메일 초대는 Supabase 연결 후 적용합니다."/><div className="p-5"><div className="mb-4 flex flex-wrap gap-2">{settings.users.map((user) => <span key={user} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">{user} · 실무자</span>)}</div><div className="flex gap-2"><input type="email" className={controlClass} value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="직원 이메일 또는 이름"/><Button type="button" variant="outline" onClick={addUser}><Plus/>명단 추가</Button></div></div></section>
    <div className="flex justify-end"><Button onClick={save} className="bg-blue-800 hover:bg-blue-900"><Save/>전체 설정 저장</Button></div>
  </div>;
}

function Header({ title, description }: { title: string; description: string }) { return <div className="border-b px-5 py-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
