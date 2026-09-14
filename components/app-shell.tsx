"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, ChevronRight, ClipboardList, LayoutDashboard, Menu, PackageCheck, Settings, ShieldCheck, TableProperties, Users, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/status", label: "통합 업무현황", icon: TableProperties },
  { href: "/applications", label: "신청 관리", icon: ClipboardList },
  { href: "/candidates", label: "후보자", icon: Users },
  { href: "/jobs", label: "Job 관리", icon: BriefcaseBusiness },
  { href: "/packages", label: "패키지", icon: PackageCheck },
  { href: "/settings", label: "설정", icon: Settings },
];

export function AppShell({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebar = <>
    <div className="flex h-16 items-center gap-3 border-b px-5">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-800 text-white"><ShieldCheck className="h-5 w-5" /></span>
      <div><p className="text-sm font-bold text-slate-950">자격인증 기록관리</p><p className="text-[11px] text-slate-500">INTERNAL SYSTEM</p></div>
    </div>
    <nav className="space-y-1 p-3">{navigation.map(({ href, label, icon: Icon }) => {
      const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
      return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium", active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}><Icon className="h-4 w-4" />{label}{active && <ChevronRight className="ml-auto h-4 w-4" />}</Link>;
    })}</nav>
    <div className="absolute bottom-0 w-full border-t p-4"><div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">프로토타입 모드</p><p className="mt-1 text-[11px] leading-4 text-slate-500">가상 데이터는 현재 브라우저에만 저장됩니다.</p></div></div>
  </>;
  return <div className="min-h-screen bg-slate-50">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white lg:block">{sidebar}</aside>
    {open && <div className="fixed inset-0 z-40 lg:hidden"><button className="absolute inset-0 bg-slate-950/30" aria-label="메뉴 닫기" onClick={() => setOpen(false)} /><aside className="relative h-full w-72 bg-white shadow-xl">{sidebar}<button className="absolute right-3 top-5" onClick={() => setOpen(false)} aria-label="메뉴 닫기"><X className="h-5 w-5" /></button></aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-6"><button className="rounded-md p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="메뉴 열기"><Menu className="h-5 w-5" /></button><p className="hidden text-sm text-slate-500 sm:block">Certification Record Management System</p><div className="flex items-center gap-3"><button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="알림"><Bell className="h-5 w-5" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /></button><span className="h-6 w-px bg-slate-200" /><div className="text-right"><p className="text-sm font-medium">김담당</p><p className="text-xs text-slate-500">실무자</p></div><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-bold text-white">김</span></div></header>
      <main className="p-4 sm:p-6 lg:p-8"><div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}</div>{actions}</div>{children}</main>
    </div>
  </div>;
}
