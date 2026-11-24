"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileList } from "@/components/portal/file-list";
import { GroupBadge } from "@/components/portal/group-badge";
import { CompletionToggle } from "@/components/portal/toggles";
import { DueBar } from "@/components/portal/due-bar";
import { formatDate, formatDue } from "@/lib/dates";
import type { AssignmentListItem } from "@/lib/data/portal";
import { cn } from "@/lib/utils";

/**
 * Úkol, který se po kliknutí otevře v okně se zadáním (bez přechodu na
 * jinou stránku). `children` je to, na co se kliká – karta nebo řádek.
 */
export function AssignmentDialog({
  assignment: a,
  children,
  className,
}: {
  assignment: AssignmentListItem;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("block w-full cursor-pointer text-left", className)} aria-haspopup="dialog">
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogContent title={a.title} description={a.subject.name} wide>
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
                <GroupBadge group={a.study_group} className="h-6" />
                <span className="inline-flex items-center gap-1.5">
                  <CalendarPlus className="size-4" aria-hidden /> Zadáno {formatDate(a.assigned_on)}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <CalendarClock className="size-4" aria-hidden /> Odevzdat {formatDue(a.due_date, a.due_time)}
                </span>
              </div>
              <DueBar assignedOn={a.assigned_on} dueDate={a.due_date} dueTime={a.due_time} completed={a.completed} />

              <section aria-label="Zadání">
                <h3 className="mb-1.5 text-sm font-semibold text-ink">Zadání</h3>
                {a.instructions ? (
                  <p className="leading-relaxed whitespace-pre-line text-slate-ink">{a.instructions}</p>
                ) : (
                  <p className="text-muted">Úkol nemá podrobné zadání.</p>
                )}
              </section>

              {a.files.length > 0 && <FileList files={a.files} />}

              <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/ukoly/${a.id}`}>
                    Celý úkol a materiály <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <CompletionToggle assignmentId={a.id} completed={a.completed} title={a.title} variant="button" />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
