"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

export interface MaterialOption {
  id: string;
  title: string;
  status: string;
  subject_id: string;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Výběr souvisejících materiálů (relační vazba, ne seznam ID v textu). */
export function MaterialPicker({
  options,
  value,
  onChange,
  subjectId,
}: {
  options: MaterialOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  subjectId?: string;
}) {
  const [q, setQ] = React.useState("");
  const selected = options.filter((o) => value.includes(o.id));
  const list = options
    .filter((o) => !value.includes(o.id))
    .filter((o) => !q || fold(o.title).includes(fold(q)))
    .sort((a, b) => Number(b.subject_id === subjectId) - Number(a.subject_id === subjectId))
    .slice(0, 8);

  return (
    <div>
      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {selected.map((o) => (
            <li key={o.id} className="inline-flex items-center gap-1.5 rounded-full bg-light-blue py-1 pr-1 pl-3 text-sm text-primary">
              {o.title}
              {o.status !== "published" && <span className="text-xs opacity-70">(koncept)</span>}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== o.id))}
                className="grid size-6 place-items-center rounded-full hover:bg-white/60"
                aria-label={`Odebrat ${o.title}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat materiál…" className="h-10 pl-10" aria-label="Hledat související materiál" />
      </div>
      <ul className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-line">
        {list.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">Žádné další materiály.</li>
        ) : (
          list.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onChange([...value, o.id])}
                className={cn("flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-bg")}
              >
                <Check className="size-4 text-transparent" aria-hidden />
                <span className="flex-1 truncate text-ink">{o.title}</span>
                {o.subject_id === subjectId && <span className="text-xs text-primary">stejný předmět</span>}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
