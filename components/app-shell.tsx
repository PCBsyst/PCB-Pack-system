"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Building2, ChevronRight, ClipboardList, DatabaseBackup, FileWarning, LayoutDashboard, LogOut, Menu, PackageCheck, Settings, ShieldCheck, TableProperties, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn, hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NotificationCenter } from "@/components/notification-center";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/status", label: "통합 업무현황", icon: TableProperties },
  { href: "/applications", label: "신청 관리", icon: ClipboardList },
  { href: "/candidates", label: "후보자", icon: Users },
  { href: "/jobs", label: "Job 관리", icon: BriefcaseBusiness },
  { href: "/packages", label: "패키지", icon: PackageCheck },
  { href: "/certification-actions", label: "정지·철회 현황", icon: FileWarning },
  { href: "/reports/monthly", label: "월간 업무보고", icon: BarChart3 },
  { href: "/training-institutions", label: "협약 연수기관", icon: Building2 },
  { href: "/data-import", label: "과거자료 가져오기", icon: DatabaseBackup, adminOnly: true },
  { href: "/settings", label: "설정", icon: Settings, adminOnly: true },
];

export function AppShell({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string; roleKey: "STAFF" | "ADMIN" | null }>({ name: "김담당", role: hasEnvVars ? "확인 중" : "관리자", roleKey: hasEnvVars ? null : "ADMIN" });
  useEffect(() => { if (!hasEnvVars) return; const supabase = createClient(); void supabase.auth.getUser().then(async ({ data }) => { if (!data.user) return; const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", data.user.id).single(); if (profile) setCurrentUser({ name: profile.display_name, role: profile.role === "ADMIN" ? "관리자" : "실무자", roleKey: profile.role }); }); }, []);
  const logout = async () => { const supabase = createClient(); await supabase.auth.signOut(); window.location.href = "/auth/login"; };
  const sidebar = <>
    <div className="flex h-16 items-center gap-3 border-b px-5">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-800 text-white"><ShieldCheck className="h-5 w-5" /></span>
      <div><p className="text-sm font-bold text-slate-950">자격인증 기록관리</p><p className="text-[11px] text-slate-500">INTERNAL SYSTEM</p></div>
    </div>
    <nav className="space-y-1 p-3">{navigation.filter((item) => !item.adminOnly || currentUser.roleKey === "ADMIN").map(({ href, label, icon: Icon }) => {
      const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
      return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium", active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}><Icon className="h-4 w-4" />{label}{active && <ChevronRight className="ml-auto h-4 w-4" />}</Link>;
    })}</nav>
    <div className="absolute bottom-0 w-full border-t p-4"><div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">프로토타입 모드</p><p className="mt-1 text-[11px] leading-4 text-slate-500">가상 데이터는 현재 브라우저에만 저장됩니다.</p></div></div>
  </>;
  return <div className="min-h-screen bg-slate-50">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white lg:block">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-40 lg:hidden"><button className="absolute inset-0 bg-slate-950/30" aria-label="메뉴 닫기" onClick={() => setOpen(false)} /><aside className="relative h-full w-72 bg-white shadow-xl">{sidebar}<button className="absolute right-3 top-5" onClick={() => setOpen(false)} aria-label="메뉴 닫기"><X className="h-5 w-5" /></button></aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-6"><button className="rounded-md p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="메뉴 열기"><Menu className="h-5 w-5" /></button><p className="hidden text-sm text-slate-500 sm:block">Certification Record Management System</p><div className="flex items-center gap-3"><NotificationCenter/><span className="h-6 w-px bg-slate-200" /><div className="text-right"><p className="text-sm font-medium">{currentUser.name}</p><p className="text-xs text-slate-500">{currentUser.role}</p></div><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white">{currentUser.name.slice(0, 1)}</span>{hasEnvVars && <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={logout} aria-label="로그아웃"><LogOut className="h-4 w-4"/></button>}</div></header>
      <main className="p-4 sm:p-6 lg:p-8"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}</div>{actions}</div>{children}</main>
    </div>
  </div>;
}
