import { BarChart3, BriefcaseBusiness, Building2, ClipboardList, DatabaseBackup, FileWarning, LayoutDashboard, PackageCheck, Settings, ShieldCheck, TableProperties, Users, UserPlus, type LucideIcon } from "lucide-react";
type NavigationItem = { href: string; label: string; icon: LucideIcon; access?: "admin" | "owner" };
export const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  { label: "업무현황", items: [{ href: "/", label: "대시보드", icon: LayoutDashboard }, { href: "/status", label: "통합 업무현황", icon: TableProperties }] },
  { label: "인증업무", items: [{ href: "/applications", label: "신청 접수·검토", icon: ClipboardList }, { href: "/jobs", label: "심의·발행 처리 (Job)", icon: BriefcaseBusiness }, { href: "/packages", label: "기록 패키지", icon: PackageCheck }] },
  { label: "인증 후 관리", items: [{ href: "/certification-actions", label: "정지·철회 관리", icon: FileWarning }, { href: "/reports/monthly", label: "월간 업무보고", icon: BarChart3 }] },
  { label: "기준정보", items: [{ href: "/candidates", label: "후보자 정보", icon: Users }, { href: "/training-institutions", label: "협약 연수기관", icon: Building2 }] },
  { label: "운영관리", items: [{ href: "/staff-invitations", label: "직원 초대", icon: UserPlus, access: "admin" }, { href: "/security/access-logs", label: "개인정보 접근이력", icon: ShieldCheck, access: "owner" }, { href: "/data-import", label: "과거자료 이관", icon: DatabaseBackup, access: "owner" }, { href: "/settings", label: "시스템 설정", icon: Settings, access: "owner" }] },
];
export function isNavigationActive(pathname: string, href: string) { return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`); }
