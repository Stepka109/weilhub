"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { UserAvatar } from "@/components/layout/user-avatar";
import { ADMIN_NAV, isActive } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/types";

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; avatarPath: string | null; role: AppRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Menu je otevřené jen pro stránku, na které bylo otevřeno (po navigaci se zavře)
  const [openAt, setOpenAt] = React.useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (o: boolean) => setOpenAt(o ? pathname : null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const items = ADMIN_NAV.filter((i) => !i.adminOnly || user.role === "admin");

  const nav = (
    <>
      <div className="flex h-[76px] items-center justify-between px-5">
        <Link href="/admin" className="flex items-center gap-2 rounded-xl" aria-label="Administrace – přehled">
          <Logo />
        </Link>
        <span className="rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">Admin</span>
      </div>
      <nav aria-label="Navigace administrace" className="scrollbar-none flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-11 items-center gap-3 rounded-nav px-3.5 text-[0.95rem] font-medium transition-colors duration-150",
                    active ? "bg-primary text-white shadow-[0_8px_18px_-8px_rgba(47,104,255,0.7)]" : "text-slate-ink hover:bg-light-blue/60 hover:text-primary",
                  )}
                >
                  <AnimatedIcon icon={item.icon} animation={item.anim} className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-2 border-t border-line/80 p-3">
        <Link
          href="/"
          className="group flex h-11 items-center gap-3 rounded-full bg-light-blue px-4 text-[0.95rem] font-medium text-primary transition-colors hover:bg-[#cfe0ff]"
        >
          <AnimatedIcon icon={ArrowLeft} animation="nudge" className="size-5" />
          Zpět na portál
        </Link>
        <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <UserAvatar name={user.name} path={user.avatarPath} className="size-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-xs text-muted">{user.role === "admin" ? "Administrátor" : "Editor"}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh">
      <a href="#obsah" className="sr-only z-[60] rounded-full bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Přeskočit na obsah
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line/80 bg-card lg:flex">{nav}</aside>

      {/* Mobilní lišta */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/80 bg-card/95 px-4 pt-[var(--safe-top)] backdrop-blur-md lg:hidden">
        <Logo className="[&_span.font-display]:text-[1.15rem] [&_svg]:size-8" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-11 place-items-center rounded-full border border-line"
          aria-label="Otevřít menu administrace"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu administrace">
          <button type="button" className="absolute inset-0 bg-navy/35 animate-fade-in" aria-label="Zavřít" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[290px] max-w-[85vw] flex-col bg-card pb-[var(--safe-bottom)] shadow-pop animate-slide-up">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-5 right-3 z-10 grid size-9 place-items-center rounded-full bg-card" aria-label="Zavřít menu">
              <X className="size-5" />
            </button>
            {nav}
          </div>
        </div>
      )}

      <main id="obsah" className="px-4 pt-6 pb-16 sm:px-6 lg:ml-[264px] lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
