import { cn } from "@/lib/utils";

/**
 * Symbol WeilHub: abstraktní „W“ složené ze dvou listů otevřené knihy.
 * Stejná geometrie se používá ve favikoně a PWA ikonách (src/app/icons).
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="40" height="40" rx="12" fill="#1B3A6B" />
      {/* listy knihy */}
      <path d="M8 11.5c3.6-.6 6.9.4 9.6 2.6L20 16l2.4-1.9c2.7-2.2 6-3.2 9.6-2.6" fill="none" stroke="#8DC63F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* W */}
      <path d="M9 15.5l5 13.5 6-10.5 6 10.5 5-13.5" fill="none" stroke="#1FC2CA" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="logo-text font-display text-[1.35rem] leading-none font-extrabold tracking-[-0.03em]">
          <span className="text-navy">Weil</span>
          <span className="text-teal">Hub</span>
        </span>
      )}
      {/* Svislý pruh v barvách Weilovky jako v logu školy */}
      {!compact && (
        <span className="logo-text flex h-7 w-[3px] flex-col overflow-hidden rounded-full" aria-hidden>
          <span className="flex-1 bg-lime" />
          <span className="flex-1 bg-teal" />
          <span className="flex-1 bg-cyan" />
        </span>
      )}
      <span className="sr-only">WeilHub</span>
    </span>
  );
}
