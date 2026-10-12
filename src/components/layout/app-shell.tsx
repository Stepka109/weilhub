"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchDialog } from "./search-dialog";
import { UserAvatar } from "./user-avatar";
import { MOBILE_PRIMARY, PORTAL_NAV, isActive, type NavItem } from "./nav-items";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/types";

export interface ShellUser {
  name: string;
  avatarPath: string | null;
  role: AppRole;
}

const ROLE_LABEL: Record<AppRole, string> = { admin: "Administrátor", editor: "Editor", student: "Student" };

const SIDEBAR_KEY = "wh-sidebar";
const sidebarListeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false; // úložiště nedostupné
  }
}

/** Sbalení bočního panelu – předvolba uložená v prohlížeči. */
function useCollapsed() {
  const collapsed = React.useSyncExternalStore(
    (cb) => {
      sidebarListeners.add(cb);
      return () => sidebarListeners.delete(cb);
    },
    readCollapsed,
    () => false,
  );
  const toggle = React.useCallback(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, readCollapsed() ? "open" : "collapsed");
    } catch {
      /* nic */
    }
    sidebarListeners.forEach((l) => l());
  }, []);
  return [collapsed, toggle] as const;
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-nav px-3.5 text-[0.95rem] font-medium transition-colors duration-150",
        active
          ? "bg-primary text-white shadow-[0_8px_18px_-8px_rgba(47,104,255,0.7)]"
          : "text-slate-ink hover:bg-light-blue/60 hover:text-primary",
        collapsed && "justify-center px-0",
      )}
    >
      <AnimatedIcon icon={item.icon} animation={item.anim} className="size-5 shrink-0" />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );
}

export function AppShell({
  user,
  unread,
  children,
}: {
  user: ShellUser;
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, toggleCollapsed] = useCollapsed();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [moreOpenAt, setMoreOpenAt] = React.useState<string | null>(null);
  const moreOpen = moreOpenAt === pathname;
  const setMoreOpen = (o: boolean) => setMoreOpenAt(o ? pathname : null);
  const isStaff = user.role === "admin" || user.role === "editor";

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setMoreOpenAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bottomLinks = (
    <>
      <SidebarLink
        item={{ href: "/profil", label: "Profil", icon: UserRound, anim: "bounce" }}
        active={pathname === "/profil"}
        collapsed={collapsed}
      />
      <SidebarLink
        item={{ href: "/nastaveni", label: "Nastavení", icon: Settings, anim: "spin" }}
        active={pathname === "/nastaveni"}
        collapsed={collapsed}
      />
      {isStaff && (
        <SidebarLink
          item={{ href: "/admin", label: "Administrace", icon: ShieldCheck, anim: "pop" }}
          active={false}
          collapsed={collapsed}
        />
      )}
      <form action={signOut}>
        <button
          type="submit"
          title={collapsed ? "Odhlásit se" : undefined}
          className={cn(
            "group flex h-11 w-full items-center gap-3 rounded-nav px-3.5 text-[0.95rem] font-medium text-slate-ink transition-colors hover:bg-rose hover:text-rose-ink",
            collapsed && "justify-center px-0",
          )}
        >
          <AnimatedIcon icon={LogOut} animation="nudge" className="size-5 shrink-0" />
          <span className={cn(collapsed && "sr-only")}>Odhlásit se</span>
        </button>
      </form>
    </>
  );

  return (
    <div className="min-h-dvh">
      <a
        href="#obsah"
        className="sr-only z-[60] rounded-full bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Přeskočit na obsah
      </a>

      {/* Postranní panel – desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line/80 bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-[84px]" : "w-[264px]",
        )}
      >
        <div className={cn("flex h-[76px] items-center px-5", collapsed && "justify-center px-0")}>
          <Link href="/" aria-label="WeilHub – domů" className="rounded-xl">
            {collapsed ? <LogoMark /> : <Logo />}
          </Link>
        </div>
        <nav aria-label="Hlavní navigace" className="scrollbar-none flex-1 overflow-y-auto px-3 pb-3">
          <ul className="space-y-1">
            {PORTAL_NAV.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isActive(pathname, item)} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 border-t border-line/80 px-3 py-3">
          {bottomLinks}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-nav px-3.5 text-sm text-muted transition-colors hover:bg-slate-soft hover:text-ink",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Rozbalit panel" : "Sbalit panel"}
          >
            {collapsed ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}
            {!collapsed && <span>Sbalit panel</span>}
          </button>
        </div>
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[84px]" : "lg:pl-[264px]")}>
        {/* Horní lišta */}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 pt-[var(--safe-top)] backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:h-[76px] lg:px-8">
            <Link href="/" className="rounded-xl lg:hidden" aria-label="WeilHub – domů">
              <Logo className="[&_span.font-display]:text-[1.15rem] [&_svg]:size-8" />
            </Link>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="group ml-auto flex h-11 items-center gap-3 rounded-full border border-line bg-card px-4 text-left text-sm text-muted shadow-card transition-colors hover:border-[#cfd7e4] lg:ml-0 lg:w-full lg:max-w-md"
              aria-label="Hledat (Ctrl+K)"
            >
              <AnimatedIcon icon={Search} animation="wiggle" className="size-[18px] text-muted" />
              <span className="hidden flex-1 lg:inline">Hledat materiály, úkoly, testy…</span>
              <kbd className="hidden rounded-md border border-line bg-bg px-1.5 py-0.5 font-sans text-[11px] text-muted lg:inline">
                Ctrl K
              </kbd>
            </button>

            <div className="flex items-center gap-1.5 lg:ml-auto">
              <Link
                href="/oznameni"
                className="group relative grid size-11 place-items-center rounded-full border border-line bg-card text-slate-ink shadow-card transition-colors hover:text-primary"
                aria-label={unread > 0 ? `Oznámení, ${unread} nepřečtených` : "Oznámení"}
              >
                <AnimatedIcon icon={Bell} animation="bell" className="size-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] leading-5 font-semibold text-white ring-2 ring-bg">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-2.5 rounded-full p-0.5 transition-colors hover:bg-card lg:pr-3"
                  aria-label="Uživatelské menu"
                >
                  <UserAvatar name={user.name} path={user.avatarPath} />
                  <span className="hidden max-w-36 text-left lg:block">
                    <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
                    <span className="block text-xs text-muted">{ROLE_LABEL[user.role]}</span>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/profil">
                      <UserRound /> Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/nastaveni">
                      <Settings /> Nastavení
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <ShieldCheck /> Administrace
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => void signOut()}>
                    <LogOut /> Odhlásit se
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main
          id="obsah"
          className="mx-auto max-w-[1320px] px-4 pt-6 pb-[calc(96px+var(--safe-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      {/* Spodní navigace – mobil */}
      <nav
        aria-label="Mobilní navigace"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-card/95 pb-[var(--safe-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid h-[68px] max-w-md grid-cols-5 px-2">
          {PORTAL_NAV.filter((i) => MOBILE_PRIMARY.includes(i.href)).map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium"
                >
                  <span
                    className={cn(
                      "grid h-8 w-14 place-items-center rounded-full transition-colors",
                      active ? "bg-primary text-white" : "text-slate-ink",
                    )}
                  >
                    <AnimatedIcon icon={item.icon} animation={item.anim} className="size-5" />
                  </span>
                  <span className={active ? "text-primary" : "text-muted"}>
                    {item.href === "/" ? "Domů" : item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className="group flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium"
            >
              <span className="grid h-8 w-14 place-items-center rounded-full text-slate-ink">
                <AnimatedIcon icon={LayoutGrid} animation="pop" className="size-5" />
              </span>
              <span className="text-muted">Více</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Přehled dalších sekcí – mobil */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Další sekce">
          <button
            type="button"
            className="absolute inset-0 bg-navy/35 animate-fade-in"
            aria-label="Zavřít"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-card px-4 pt-3 pb-[calc(20px+var(--safe-bottom))] shadow-pop animate-slide-up">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" aria-hidden />
            <div className="grid grid-cols-3 gap-2">
              {[
                ...PORTAL_NAV.filter((i) => !MOBILE_PRIMARY.includes(i.href)),
                { href: "/profil", label: "Profil", icon: UserRound, anim: "bounce" as const },
                { href: "/nastaveni", label: "Nastavení", icon: Settings, anim: "spin" as const },
                ...(isStaff ? [{ href: "/admin", label: "Administrace", icon: ShieldCheck, anim: "pop" as const }] : []),
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col items-center gap-2 rounded-2xl bg-bg px-2 py-4 text-center text-[13px] font-medium text-ink active:bg-light-blue"
                >
                  <AnimatedIcon icon={item.icon} animation={item.anim} className="size-6 text-primary" />
                  {item.label}
                </Link>
              ))}
              <form action={signOut} className="contents">
                <button
                  type="submit"
                  className="flex flex-col items-center gap-2 rounded-2xl bg-rose px-2 py-4 text-[13px] font-medium text-rose-ink"
                >
                  <LogOut className="size-6" aria-hidden />
                  Odhlásit se
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
