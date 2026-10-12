import * as React from "react";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-[#e9eef6]", className)} aria-hidden />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-light-blue text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {back && (
        <Link
          href={back.href}
          className="group mb-3 inline-flex items-center gap-1 rounded-full text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-2">{eyebrow}</div>}
          <h1 className="text-[1.65rem] leading-tight font-bold text-ink sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[0.95rem] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Ikonka v barevném zaobleném čtverci. */
export function IconTile({
  icon: Icon,
  className,
  size = "md",
}: {
  icon: LucideIcon;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const s = { sm: "size-9 rounded-xl [&_svg]:size-[18px]", md: "size-11 rounded-[14px] [&_svg]:size-5", lg: "size-14 rounded-2xl [&_svg]:size-6" }[size];
  return (
    <div className={cn("grid shrink-0 place-items-center", s, className)}>
      <Icon aria-hidden strokeWidth={1.9} />
    </div>
  );
}

/** Přepínač filtrů ve tvaru pilulek (odkazy, funguje bez JS). */
export function PillTabs({
  items,
  className,
  label,
}: {
  items: { href: string; label: string; active: boolean; count?: number }[];
  className?: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className={cn("scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="inline-flex gap-1 rounded-full border border-line bg-card p-1 shadow-card">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              scroll={false}
              aria-current={it.active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                it.active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-slate-soft hover:text-ink",
              )}
            >
              {it.label}
              {it.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs",
                    it.active ? "bg-white/20 text-white" : "bg-slate-soft text-slate-ink",
                  )}
                >
                  {it.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}
