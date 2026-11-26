"use client";

import * as React from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { ArrowRight, Bell, CalendarHeart, Clock3, Info, Moon, NotebookPen, Palette, ShieldCheck, Smartphone, UtensilsCrossed, Vote, X } from "lucide-react";
import { updatePreferences } from "@/lib/actions/student";
import { NEWS, type NewsItem } from "@/lib/news";

const ICONS: Record<NewsItem["icon"], typeof Info> = {
  moon: Moon,
  bell: Bell,
  calendar: CalendarHeart,
  palette: Palette,
  shield: ShieldCheck,
  notebook: NotebookPen,
  utensils: UtensilsCrossed,
  vote: Vote,
  clock: Clock3,
  phone: Smartphone,
};

/**
 * Ikonka „i“ s novinkami v aplikaci. Ukazuje se jen, dokud uživatel aktuální
 * novinky neodklikne – po zavření okna se to uloží k účtu a ikonka zmizí.
 */
export function WhatsNew({ seen }: { seen?: string }) {
  const [dismissed, setDismissed] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  if (dismissed || seen === NEWS.id || !NEWS.items.length) return null;

  function markSeen() {
    setDismissed(true);
    // Uložení k účtu; při chybě se ikonka po obnovení stránky jen znovu ukáže
    void updatePreferences({ newsSeen: NEWS.id }).catch(() => undefined);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) markSeen();
      }}
    >
      <Popover.Trigger
        className="group relative grid size-10 place-items-center sm:size-11 rounded-full border border-line bg-card text-slate-ink shadow-card transition-colors hover:text-primary"
        aria-label="Novinky v aplikaci"
        title="Novinky v aplikaci"
      >
        <Info className="size-5" aria-hidden />
        <span className="absolute top-1 right-1 flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-lime ring-2 ring-card" />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-[min(380px,calc(100vw-24px))] rounded-dialog border border-line bg-card p-5 shadow-pop data-[state=open]:animate-fade-in"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">Novinky</p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-ink">{NEWS.title}</h2>
            </div>
            <Popover.Close className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-muted hover:bg-slate-soft hover:text-ink" aria-label="Zavřít">
              <X className="size-5" aria-hidden />
            </Popover.Close>
          </div>
          <ul className="max-h-[60dvh] space-y-3 overflow-y-auto">
            {NEWS.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.title} className="flex gap-3 rounded-2xl bg-bg p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-light-blue text-primary">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-ink">{item.text}</span>
                    {item.href && (
                      <Link
                        href={item.href}
                        onClick={() => {
                          setOpen(false);
                          markSeen();
                        }}
                        className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                      >
                        {item.cta ?? "Zobrazit"} <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <Popover.Close className="mt-4 h-10 w-full rounded-full bg-primary text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover">
            Rozumím
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
