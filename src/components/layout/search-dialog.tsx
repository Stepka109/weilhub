"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { BookOpen, ClipboardCheck, FileCheck, FileText, Loader2, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { subjectColor } from "@/lib/subject-style";
import type { SearchGroup, SearchResult } from "@/lib/search-types";

const GROUP_META: Record<SearchResult["kind"], { label: string; icon: typeof BookOpen }> = {
  subject: { label: "Předměty", icon: BookOpen },
  material: { label: "Materiály", icon: FileText },
  assignment: { label: "Úkoly", icon: ClipboardCheck },
  exam: { label: "Testy", icon: FileCheck },
};

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const tooShort = query.trim().length < 2;
  const visibleGroups = tooShort ? [] : groups;
  const status = tooShort ? "idle" : state;
  const flat = visibleGroups.flatMap((g) => g.items);
  const offsets = visibleGroups.map((_, gi) => visibleGroups.slice(0, gi).reduce((n, g) => n + g.items.length, 0));

  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/hledat?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { groups: SearchGroup[] };
        setGroups(json.groups);
        setActiveIndex(0);
        setState("done");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  function go(item: SearchResult) {
    onOpenChange(false);
    setQuery("");
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) go(item);
    }
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-navy/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content
          className="fixed top-[8vh] left-1/2 z-50 flex max-h-[80dvh] w-[calc(100vw-24px)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-dialog bg-card shadow-pop data-[state=open]:animate-fade-in"
          onKeyDown={onKeyDown}
        >
          <D.Title className="sr-only">Hledat ve WeilHubu</D.Title>
          <D.Description className="sr-only">Vyhledávání v předmětech, materiálech, úkolech a testech.</D.Description>
          <div className="flex items-center gap-3 border-b border-line px-5">
            <Search className="size-5 shrink-0 text-muted" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat materiály, zápisy, úkoly, testy…"
              className="h-16 w-full bg-transparent text-base text-ink outline-none placeholder:text-[#8d96a6] focus-visible:outline-none"
              aria-label="Hledaný výraz"
              aria-controls="vysledky-hledani"
              maxLength={100}
            />
            {status === "loading" && <Loader2 className="size-5 shrink-0 animate-spin text-muted" aria-label="Hledám" />}
          </div>

          <div id="vysledky-hledani" className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label="Výsledky">
            {status === "idle" && (
              <p className="px-4 py-10 text-center text-sm text-muted">Napište alespoň 2 znaky. Diakritiku psát nemusíte.</p>
            )}
            {status === "error" && (
              <p className="px-4 py-10 text-center text-sm text-rose-ink" role="alert">
                Vyhledávání se nezdařilo. Zkontrolujte připojení a zkuste to znovu.
              </p>
            )}
            {status === "done" && flat.length === 0 && (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <SearchX className="mb-3 size-8 text-muted" aria-hidden />
                <p className="text-sm font-medium text-ink">Nic jsme nenašli</p>
                <p className="mt-1 text-sm text-muted">Zkuste jiný výraz nebo kratší slovo.</p>
              </div>
            )}
            {visibleGroups.map((group, gi) => {
              const meta = GROUP_META[group.kind];
              return (
                <div key={group.kind} className="mb-2">
                  <p className="px-3 pt-2 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{meta.label}</p>
                  {group.items.map((item, ii) => {
                    const i = offsets[gi] + ii;
                    const color = subjectColor(item.subjectColor);
                    const Icon = meta.icon;
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={i === activeIndex}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => go(item)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                          i === activeIndex ? "bg-light-blue/60" : "hover:bg-bg",
                        )}
                      >
                        <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", color.bg, color.ink)}>
                          <Icon className="size-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{item.title}</span>
                          <span className="block truncate text-xs text-muted">
                            {item.subjectName}
                            {item.meta ? ` · ${item.meta}` : ""}
                          </span>
                          {item.snippet && <span className="mt-1 line-clamp-2 block text-sm text-slate-ink">{item.snippet}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="hidden items-center gap-4 border-t border-line px-5 py-2.5 text-xs text-muted sm:flex">
            <span>↑↓ výběr</span>
            <span>Enter otevřít</span>
            <span>Esc zavřít</span>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
