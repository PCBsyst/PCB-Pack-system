"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn, hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { navigationGroups, isNavigationActive } from "@/lib/app-navigation";
import { NotificationCenter } from "@/components/notification-center";

export function AppShell({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [user, setUser] = useState({ name: hasEnvVars ? "직원" : "김담당", role: hasEnvVars ? "확인 중" : "개발 관리자", admin: !hasEnvVars, owner: !hasEnvVars });
  useEffect(() => {
    if (!hasEnvVars) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("display_name,role,is_owner,active").eq("id", data.user.id).single();
      if (profile && !cancelled) setUser({ name: profile.display_name, role: profile.is_owner ? "최고관리자" : profile.role === "ADMIN" ? "서브 관리자" : "실무자", admin: profile.active && profile.role === "ADMIN", owner: profile.active && profile.is_owner });
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const elements = drawer.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); menuButton.current?.focus(); };
  }, [open]);
  const groups = navigationGroups.map((group) => ({ ...group, items: group.items.filter((item) => !item.access || (item.access === "owner" ? user.owner : user.admin)) })).filter((group) => group.items.length);
  const currentGroup = navigationGroups.find((group) => group.items.some((item) => isNavigationActive(pathname, item.href)));
  const currentItem = currentGroup?.items.find((item) => isNavigationActive(pathname, item.href));
  const logout = async () => { await createClient().auth.signOut(); window.location.href = "/auth/login"; };
  const sidebar = <>
    <Link href="/" onClick={() => setOpen(false)} className="flex h-[76px] shrink-0 items-center gap-3 border-b border-slate-200/80 px-5" aria-label="자격인증 기록관리 홈"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white"><ShieldCheck className="h-5 w-5"/></span><div><p className="text-sm font-bold tracking-tight text-slate-900">자격인증 기록관리</p><p className="mt-0.5 text-[10px] tracking-[0.1em] text-slate-400">CERTIFICATION WORKSPACE</p></div></Link>
    <div className="px-4 pb-1 pt-4"><Link href="/applications/new" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-900"><Plus className="h-4 w-4"/>신규 신청 접수</Link></div>
    <nav aria-label="주 메뉴" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">{groups.map((group) => <section key={group.label}><h2 className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-slate-400">{group.label}</h2><div className="space-y-0.5">{group.items.map(({ href, label, icon: Icon }) => {
      const active = isNavigationActive(pathname, href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={cn("group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors", active ? "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}><Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-blue-700" : "text-slate-400")}/><span className="flex-1">{label}</span>{active && <ChevronRight className="h-3.5 w-3.5"/>}</Link>;
    })}</div></section>)}</nav>
    <div className="shrink-0 border-t px-5 py-3"><div className="flex items-center gap-2"><span className={cn("h-1.5 w-1.5 rounded-full", hasEnvVars ? "bg-blue-500" : "bg-amber-500")}/><span className="text-xs font-medium text-slate-600">{hasEnvVars ? "내부 직원 전용" : "로컬 가상데이터 모드"}</span></div><p className="mt-1 text-[10px] text-slate-400">{hasEnvVars ? "개인정보 취급 · 권한에 따른 접근" : "실제 개인정보를 입력하지 마세요"}</p></div>
  </>;
  return <div className="min-h-screen bg-[#f5f7fb]">
    <a href="#main-content" className="sr-only z-50 rounded-lg bg-white p-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">본문으로 건너뛰기</a>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-200/80 bg-white lg:flex">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-40 lg:hidden"><button className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" aria-label="메뉴 닫기" onClick={() => setOpen(false)}/><aside ref={drawer} role="dialog" aria-modal="true" aria-label="주 메뉴" className="relative flex h-full w-[min(300px,90vw)] flex-col bg-white shadow-2xl"><button className="absolute right-1 top-1 rounded p-1 text-slate-500" onClick={() => setOpen(false)} aria-label="메뉴 닫기"><X className="h-4 w-4"/></button>{sidebar}</aside></div>}
    <div className="min-w-0 lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><button ref={menuButton} className="rounded-lg border p-2 text-slate-600 lg:hidden" onClick={() => setOpen(true)} aria-label="메뉴 열기" aria-expanded={open}><Menu className="h-4 w-4"/></button><div className="hidden items-center gap-2 text-xs sm:flex"><span className="text-slate-400">{currentGroup?.label ?? "업무공간"}</span><ChevronRight className="h-3 w-3 text-slate-300"/><span className="font-medium text-slate-700">{currentItem?.label ?? title}</span></div></div><div className="flex shrink-0 items-center gap-3"><NotificationCenter/><div className="hidden h-7 w-px bg-slate-200 sm:block"/><div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-800">{user.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{user.role}</p></div><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{user.name.slice(0, 1)}</span>{hasEnvVars && <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={logout} aria-label="로그아웃"><LogOut className="h-4 w-4"/></button>}</div></header>
      <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="mb-1.5 text-[11px] font-semibold tracking-wide text-blue-700">{currentGroup?.label ?? "인증업무"}</p><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title === "Dashboard" ? "대시보드" : title}</h1>{description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}</div>{actions && <div className="shrink-0">{actions}</div>}</div>{children}<footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-4 text-[10px] text-slate-400"><span>Certification Record Management System</span><Link href="/">내부 업무공간</Link></footer></main>
    </div>
  </div>;
}
