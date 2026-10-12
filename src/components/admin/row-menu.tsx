"use client";

import { Archive, EyeOff, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PublicationStatus } from "@/lib/types";

/** Jednotné menu akcí pro řádek s publikačním stavem. */
export function RowMenu({
  label,
  status,
  onEdit,
  onStatus,
  onDelete,
  extra,
}: {
  label: string;
  status?: PublicationStatus;
  onEdit: () => void;
  onStatus?: (s: PublicationStatus) => void;
  onDelete: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={`Akce pro ${label}`} className="mt-2 md:mt-0">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Upravit
        </DropdownMenuItem>
        {extra}
        {status && onStatus && (
          <>
            {status === "published" ? (
              <DropdownMenuItem onSelect={() => onStatus("draft")}>
                <EyeOff /> Stáhnout z publikace
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onStatus("published")}>
                <Send /> Publikovat
              </DropdownMenuItem>
            )}
            {status !== "archived" && (
              <DropdownMenuItem onSelect={() => onStatus("archived")}>
                <Archive /> Archivovat
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 /> Smazat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StatusSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-3 gap-1 rounded-full border border-line bg-bg p-1">
      {(
        [
          ["draft", "Koncept"],
          ["published", "Publikovat"],
          ["archived", "Archiv"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`h-9 rounded-full text-sm font-medium transition-colors ${value === v ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
