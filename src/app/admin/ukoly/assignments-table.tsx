"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, ClipboardCheck, EyeOff, MoreHorizontal, Paperclip, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/admin/common";
import { setStatus } from "@/lib/actions/admin/content";
import { deleteAssignment } from "@/lib/actions/admin/materials";
import { useAction } from "@/lib/use-action";
import { formatDate, formatDue, todayIso } from "@/lib/dates";
import type { Assignment, SubjectRef } from "@/lib/types";

type Row = Assignment & { subject: SubjectRef | null; files: { id: string }[] };

export function AssignmentsTable({ assignments }: { assignments: Row[] }) {
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [tab, setTab] = React.useState<"active" | "past" | "all">("active");
  const today = todayIso();
  const rows = assignments
    .filter((a) => (tab === "active" ? a.due_date >= today && a.status !== "archived" : tab === "past" ? a.due_date < today || a.status === "archived" : true))
    .sort((a, b) => (tab === "active" ? a.due_date.localeCompare(b.due_date) : b.due_date.localeCompare(a.due_date)));

  return (
    <>
      <div className="mb-4 flex">
        <div className="inline-flex gap-1 rounded-full border border-line bg-card p-1 shadow-card">
          {(
            [
              ["active", "Aktivní"],
              ["past", "Proběhlé a archiv"],
              ["all", "Všechny"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${tab === k ? "bg-primary text-white" : "text-muted hover:bg-slate-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck} title="Žádné úkoly" description="V tomto výběru nejsou žádné úkoly." />
        </Card>
      ) : (
        <AdminTable head={["Název", "Předmět", "Zadáno", "Termín", "Stav", "Akce"]}>
          {rows.map((a) => (
            <Tr key={a.id}>
              <Td>
                <Link href={`/admin/ukoly/${a.id}`} className="font-medium text-ink hover:text-primary">
                  {a.title}
                </Link>
                {a.files.length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-muted">
                    <Paperclip className="size-3" aria-label="Přílohy" />
                    {a.files.length}
                  </span>
                )}
              </Td>
              <Td label="Předmět" className="text-muted">
                {a.subject?.name}
              </Td>
              <Td label="Zadáno" className="whitespace-nowrap text-muted">
                {formatDate(a.assigned_on)}
              </Td>
              <Td label="Termín" className="whitespace-nowrap font-medium text-ink">
                {formatDue(a.due_date, a.due_time)}
              </Td>
              <Td>
                <StatusBadge status={a.status} />
              </Td>
              <Td className="md:text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon-sm" aria-label={`Akce pro ${a.title}`} className="mt-2 md:mt-0">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/ukoly/${a.id}`}>
                        <Pencil /> Upravit
                      </Link>
                    </DropdownMenuItem>
                    {a.status === "published" ? (
                      <DropdownMenuItem onSelect={() => run(() => setStatus("assignments", a.id, "draft"))}>
                        <EyeOff /> Stáhnout z publikace
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => run(() => setStatus("assignments", a.id, "published"))}>
                        <Send /> Publikovat
                      </DropdownMenuItem>
                    )}
                    {a.status !== "archived" && (
                      <DropdownMenuItem onSelect={() => run(() => setStatus("assignments", a.id, "archived"))}>
                        <Archive /> Archivovat
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onSelect={() =>
                        ask({
                          title: "Smazat úkol?",
                          description: `Úkol „${a.title}“ bude trvale smazán včetně příloh a stavu splnění u všech studentů.`,
                          confirmLabel: "Smazat trvale",
                          onConfirm: () => run(() => deleteAssignment(a.id)),
                        })
                      }
                    >
                      <Trash2 /> Smazat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}
      {confirmDialog}
    </>
  );
}
