import * as React from "react";
import { Archive, CircleDot, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicationStatus } from "@/lib/types";

export const STATUS_LABEL: Record<PublicationStatus, string> = {
  draft: "Koncept",
  published: "Publikováno",
  archived: "Archivováno",
};

export function StatusBadge({ status }: { status: PublicationStatus }) {
  const tone = { draft: "yellow", published: "mint", archived: "slate" } as const;
  const Icon = { draft: CircleDot, published: Eye, archived: Archive }[status];
  return (
    <Badge tone={tone[status]}>
      <Icon aria-hidden />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Přehledná tabulka na desktopu, na mobilu se řádky skládají do karet. */
export function AdminTable({ head, children, className }: { head: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-card border border-line/80 bg-card shadow-card", className)}>
      <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-line bg-bg/70 md:table-header-group">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase first:pl-6 last:pr-6 last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/80">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <td className={cn("block px-5 py-1 align-middle md:table-cell md:px-4 md:py-3.5 md:first:pl-6 md:last:pr-6", className)}>
      {label && <span className="mr-2 text-xs text-muted md:hidden">{label}:</span>}
      {children}
    </td>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="block py-3 transition-colors hover:bg-bg/60 md:table-row md:py-0">{children}</tr>;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-card border border-line/80 bg-card p-5 shadow-card">
      <div className={cn("grid size-11 place-items-center rounded-[14px]", tone)}>
        <Icon className="size-5" />
      </div>
      <p className="mt-4 font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}
