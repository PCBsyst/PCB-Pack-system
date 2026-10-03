"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Save, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, controlClass, textareaClass } from "@/components/form-fields";
import { PanelMembersManager } from "@/components/panel-members-manager";
import { StaffInviteForm } from "@/components/staff-invite-form";
import { PartnersManager } from "@/components/partners-manager";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

const STORAGE_KEY = "certification-general-settings";
type StaffRole = "STAFF" | "ADMIN";
type UserStatus = "ACTIVE" | "INVITED" | "INACTIVE";
type UserAccount = { id: string; name: string; email: string; role: StaffRole; status: UserStatus; invitedAt: string };
type Settings = { reviewers: string; reviewDays: string; decisionDays: string; deliveryDays: string; suspensionReasons: string; withdrawalReasons: string; users: UserAccount[] };
const defaultUsers: UserAccount[] = [
  { id: "user-001", name: "김담당", email: "staff1@example.com", role: "STAFF", status: "ACTIVE", invitedAt: "2026-08-01" },
  { id: "user-002", name: "오실무", email: "staff2@example.com", role: "STAFF", status: "ACTIVE", invitedAt: "2026-08-01" },
  { id: "user-003", name: "정관리", email: "admin@example.com", role: "ADMIN", status: "ACTIVE", invitedAt: "2026-08-01" },
];
const defaults: Settings = { reviewers: "박심의, 이위원, 최위원", reviewDays: "10", decisionDays: "5", deliveryDays: "1", suspensionReasons: "자격유지 요구사항 미충족\n인증서 오용\n시정조치 미이행\n기타", withdrawalReasons: "중대한 인증서 오용\n정지 후 시정조치 미이행\n본인 요청", users: defaultUsers };
const statusLabels: Record<UserStatus, string> = { ACTIVE: "사용 중", INVITED: "승인 대기", INACTIVE: "비활성" };

export function GeneralSettings() {
  const [settings, setSettings] = useState(defaults);
  const [notice, setNotice] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  useEffect(() => { try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved) as Partial<Settings> & { users?: UserAccount[] | string[] }; const users = Array.isArray(parsed.users) && parsed.users.length && typeof parsed.users[0] === "string" ? (parsed.users as string[]).map((name, index) => ({ id: `legacy-${index}`, name, email: "", role: "STAFF" as const, status: "ACTIVE" as const, invitedAt: "" })) : parsed.users as UserAccount[] | undefined; setSettings({ ...defaults, ...parsed, users: users ?? defaultUsers }); } } catch {} if (hasEnvVars) { const supabase = createClient(); void Promise.all([supabase.auth.getUser(), supabase.from("system_settings").select("value").eq("key", "workflow_rules").maybeSingle(), supabase.from("profiles").select("id, email, display_name, role, active, created_at").order("created_at")]).then(([authResult, rulesResult, profilesResult]) => { setCurrentUserId(authResult.data.user?.id ?? ""); setSettings((current) => ({ ...current, ...(rulesResult.data?.value as Partial<Settings> | undefined), users: profilesResult.data?.map((profile) => ({ id: profile.id, name: profile.display_name, email: profile.email, role: profile.role, status: profile.active ? "ACTIVE" : "INACTIVE", invitedAt: profile.created_at?.slice(0, 10) ?? "" })) ?? current.users })); }); } }, []);
  const save = async () => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); if (hasEnvVars) { const supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); const { error } = await supabase.from("system_settings").upsert({ key: "workflow_rules", value: { decisionDays: settings.decisionDays, deliveryDays: settings.deliveryDays, suspensionReasons: settings.suspensionReasons, withdrawalReasons: settings.withdrawalReasons }, updated_by: userData.user?.id ?? null, updated_at: new Date().toISOString() }); if (error) { setNotice(`공유 설정을 저장하지 못했습니다: ${error.message}`); return; } setNotice("공유 업무규칙을 저장했습니다. 이후 입력되는 업무 날짜 계산에 적용됩니다."); return; } setNotice("설정이 이 브라우저에 저장되었습니다."); };
  const updateUser = async (id: string, patch: Partial<UserAccount>) => {
    const previous = settings.users.find((user) => user.id === id);
    setSettings((current) => ({ ...current, users: current.users.map((user) => user.id === id ? { ...user, ...patch } : user) }));
    if (!hasEnvVars || id.startsWith("user-") || id.startsWith("legacy-")) return;
    const supabase = createClient();
    const changes: { role?: StaffRole; active?: boolean } = {};
    if (patch.role) changes.role = patch.role;
    if (patch.status) changes.active = patch.status === "ACTIVE";
    const { error } = await supabase.from("profiles").update(changes).eq("id", id);
    if (error) {
      if (previous) setSettings((current) => ({ ...current, users: current.users.map((user) => user.id === id ? previous : user) }));
      setNotice(`사용자 권한을 변경하지 못했습니다: ${error.message}`);
      return;
    }
    setNotice("사용자 역할과 활성상태를 Supabase에 반영했습니다.");
  };
  return <div className="mt-6 space-y-6">
    {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="h-4 w-4"/>{notice}</div>}
    <PanelMembersManager/>
    <PartnersManager/>
    <section id="date-rules" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><Header title="업무일자 계산 규칙" description="불변인 인증서 발행일을 기준으로 심의일과 문서전달확인서 작성일만 영업일로 계산합니다."/><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="인증심의일 (발행 전 영업일)"><input type="number" min="0" className={controlClass} value={settings.decisionDays} onChange={(event) => setSettings({ ...settings, decisionDays: event.target.value })}/></Field><Field label="문서전달확인서 (발행 후 영업일)"><input type="number" min="0" className={controlClass} value={settings.deliveryDays} onChange={(event) => setSettings({ ...settings, deliveryDays: event.target.value })}/></Field></div><p className="px-5 pb-5 text-xs text-slate-500">서류접수·검토·인보이스·입금일 등 나머지 날짜는 실제 처리 시점을 직접 입력합니다.</p></section>
    <section id="reasons" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><Header title="정지·철회 표준 사유" description="한 줄에 하나씩 입력하며 향후 보고서 선택 항목으로 사용합니다."/><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="인증 정지 사유"><textarea className={textareaClass} value={settings.suspensionReasons} onChange={(event) => setSettings({ ...settings, suspensionReasons: event.target.value })}/></Field><Field label="인증 철회 사유"><textarea className={textareaClass} value={settings.withdrawalReasons} onChange={(event) => setSettings({ ...settings, withdrawalReasons: event.target.value })}/></Field></div></section>
    <section id="users" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><Header title="사용자 및 권한" description="최고관리자만 계정 활성화와 역할 변경을 수행합니다. 심의자는 계정 대상이 아닙니다."/><div className="p-5">
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="전체 계정" value={`${settings.users.length}명`}/><Metric label="사용 중" value={`${settings.users.filter((user) => user.status === "ACTIVE").length}명`}/><Metric label="초대 대기" value={`${settings.users.filter((user) => user.status === "INVITED").length}명`}/></div>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[780px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 text-left">직원</th><th className="px-4 py-3 text-left">이메일</th><th className="px-4 py-3 text-left">역할</th><th className="px-4 py-3 text-left">상태</th><th className="px-4 py-3 text-right">관리</th></tr></thead><tbody className="divide-y">{settings.users.map((user) => { const isCurrentUser = user.id === currentUserId; return <tr key={user.id}><td className="px-4 py-3 font-semibold">{user.name}{isCurrentUser && <span className="ml-2 text-xs font-medium text-blue-700">현재 계정</span>}</td><td className="px-4 py-3 text-slate-600">{user.email || "이메일 미등록"}</td><td className="px-4 py-3"><select disabled={isCurrentUser} className={controlClass} value={user.role} onChange={(event) => void updateUser(user.id, { role: event.target.value as StaffRole })}><option value="STAFF">실무자</option><option value="ADMIN">서브 관리자</option></select></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : user.status === "INVITED" ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{statusLabels[user.status]}</span></td><td className="px-4 py-3 text-right"><Button size="sm" variant="outline" disabled={isCurrentUser} onClick={() => { const status = user.status === "INACTIVE" ? "ACTIVE" : "INACTIVE"; void updateUser(user.id, { status }); }}>{user.status === "INACTIVE" ? <><UserCheck/>활성화</> : <><UserX/>비활성화</>}</Button></td></tr>; })}</tbody></table></div>
      <div className="mt-5"><StaffInviteForm/></div>
      <div className="mt-5 rounded-lg border p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-600"/><p className="font-semibold">권한 기준</p></div><div className="mt-3 grid gap-3 md:grid-cols-2"><PermissionCard title="실무자" items={["모든 신청·후보자·Job 조회 및 업무처리", "주 담당자 지정 여부와 관계없이 공동 처리", "설정·사용자 관리 접근 불가"]}/><PermissionCard title="최고관리자" items={["실무자 권한 전체", "사용자 초대·역할·활성상태 관리", "심의자 명단 및 업무규칙 관리"]}/></div></div>
    </div></section>
    <div className="flex justify-end"><Button onClick={save} className="bg-blue-800 hover:bg-blue-900"><Save/>전체 설정 저장</Button></div>
  </div>;
}

function Header({ title, description }: { title: string; description: string }) { return <div className="border-b px-5 py-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
function PermissionCard({ title, items }: { title: string; items: string[] }) { return <div className="rounded-md bg-slate-50 p-4"><p className="text-sm font-semibold">{title}</p><ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">{items.map((item) => <li key={item}>· {item}</li>)}</ul></div>; }
