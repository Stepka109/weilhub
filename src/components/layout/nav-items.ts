import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileCheck,
  FolderOpen,
  House,
  LayoutDashboard,
  Link2,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { IconAnimation } from "@/components/icons/animated-icon";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  anim: IconAnimation;
  /** Shoda i pro podstránky (např. /predmety/matematika) */
  prefix?: boolean;
}

export const PORTAL_NAV: NavItem[] = [
  { href: "/", label: "Domů", icon: House, anim: "bounce" },
  { href: "/predmety", label: "Předměty", icon: BookOpen, anim: "pop", prefix: true },
  { href: "/materialy", label: "Materiály", icon: FolderOpen, anim: "bounce", prefix: true },
  { href: "/ukoly", label: "Úkoly", icon: ClipboardCheck, anim: "pop", prefix: true },
  { href: "/testy", label: "Testy", icon: FileCheck, anim: "wiggle", prefix: true },
  { href: "/rozvrh", label: "Rozvrh", icon: CalendarDays, anim: "bounce", prefix: true },
  { href: "/kalendar", label: "Kalendář", icon: CalendarRange, anim: "pop", prefix: true },
  { href: "/oznameni", label: "Oznámení", icon: Bell, anim: "bell", prefix: true },
  { href: "/odkazy", label: "Důležité odkazy", icon: Link2, anim: "wiggle", prefix: true },
];

export const MOBILE_PRIMARY = ["/", "/predmety", "/ukoly", "/rozvrh"];

export const ADMIN_NAV: (NavItem & { adminOnly?: boolean })[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, anim: "pop" },
  { href: "/admin/predmety", label: "Předměty", icon: BookOpen, anim: "pop", prefix: true },
  { href: "/admin/materialy", label: "Materiály", icon: FolderOpen, anim: "bounce", prefix: true },
  { href: "/admin/ukoly", label: "Úkoly", icon: ClipboardCheck, anim: "pop", prefix: true },
  { href: "/admin/testy", label: "Testy", icon: FileCheck, anim: "wiggle", prefix: true },
  { href: "/admin/rozvrh", label: "Rozvrh", icon: CalendarDays, anim: "bounce", prefix: true },
  { href: "/admin/akce", label: "Akce a volné dny", icon: CalendarRange, anim: "pop", prefix: true },
  { href: "/admin/oznameni", label: "Oznámení", icon: Megaphone, anim: "wiggle", prefix: true },
  { href: "/admin/odkazy", label: "Odkazy", icon: Link2, anim: "wiggle", prefix: true },
  { href: "/admin/uzivatele", label: "Uživatelé", icon: Users, anim: "bounce", prefix: true, adminOnly: true },
  { href: "/admin/nastaveni", label: "Nastavení", icon: Settings, anim: "spin", prefix: true, adminOnly: true },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "prefix">) {
  if (item.href === "/" || item.href === "/admin") return pathname === item.href;
  return item.prefix ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href;
}
