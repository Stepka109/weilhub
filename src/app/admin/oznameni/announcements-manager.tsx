"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { CalendarClock, CalendarHeart, Megaphone, Pin, PinOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/admin/common";
import { RowMenu, StatusSelect } from "@/components/admin/row-menu";
import { ActivityButton } from "@/components/admin/activity-button";
import { deleteRow, saveAnnouncement, setPinned, setStatus } from "@/lib/actions/admin/content";
import { useAction } from "@/lib/use-action";
import { formatDateTime } from "@/lib/dates";
import { NOTICE_KIND, noticeWhen } from "@/components/portal/notice-meta";
import { cn } from "@/lib/utils";
import type { Announcement, AnnouncementKind, AnnouncementPriority, PublicationStatus } from "@/lib/types";

const KINDS: { key: AnnouncementKind; label: string; hint: string; icon: typeof Megaphone }[] = [
  { key: "info", label: "Oznámení", hint: "Běžná informace", icon: Megaphone },
  { key: "event", label: "Událost", hint: "Co se kdy bude dít", icon: CalendarHeart },
  { key: "deadline", label: "Termín", hint: "Co je potřeba do kdy", icon: CalendarClock },
];

interface Values {
  title: string;
  body: string;
  kind: AnnouncementKind;
  event_date: string;
  event_time: string;
  priority: AnnouncementPriority;
  pinned: boolean;
  status: PublicationStatus;
}

function AnnouncementDialog({ item, open, onOpenChange }: { item: Announcement | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction();
  const { register, handleSubmit, control, formState, setError, watch } = useForm<Values>({
    values: {
      title: item?.title ?? "",
      body: item?.body ?? "",
      kind: item?.kind ?? "info",
      event_date: item?.event_date ?? "",
      event_time: item?.event_time?.slice(0, 5) ?? "",
      priority: item?.priority ?? "normal",
      pinned: item?.pinned ?? false,
      status: item?.status ?? "published",
    },
  });
  const kind = watch("kind");
  const onSubmit = handleSubmit(async (v) => {
    const res = await run(() => saveAnnouncement(item?.id ?? null, v), { onSuccess: () => onOpenChange(false) });
    if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={item ? "Upravit oznámení" : "Nové oznámení"}>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Typ oznámení" className="grid grid-cols-3 gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    role="radio"
                    aria-checked={field.value === k.key}
                    onClick={() => field.onChange(k.key)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors",
                      field.value === k.key ? "border-primary bg-light-blue/40" : "border-line hover:border-line-strong",
                    )}
                  >
                    <k.icon className={cn("size-[18px]", field.value === k.key ? "text-primary" : "text-muted")} aria-hidden />
                    <span className="text-sm font-semibold text-ink">{k.label}</span>
                    <span className="text-xs text-muted max-sm:hidden">{k.hint}</span>
                  </button>
                ))}
              </div>
            )}
          />
          <Field label="Nadpis" htmlFor="an-title" required error={formState.errors.title?.message}>
            <Input id="an-title" {...register("title", { required: "Zadejte nadpis." })} />
          </Field>
          {kind !== "info" && (
            <div className="grid grid-cols-[1fr_130px] gap-3">
              <Field
                label={kind === "event" ? "Kdy" : "Do kdy"}
                htmlFor="an-date"
                required
                error={formState.errors.event_date?.message}
                hint={kind === "event" ? "Např. den hospitace." : "Např. do kdy se domluvit."}
              >
                <Input id="an-date" type="date" {...register("event_date")} />
              </Field>
              <Field label="Čas" htmlFor="an-time" hint="Nepovinné">
                <Input id="an-time" type="time" {...register("event_time")} />
              </Field>
            </div>
          )}
          <Field label="Text" htmlFor="an-body" hint={kind === "deadline" ? "Co je potřeba udělat nebo rozhodnout." : undefined}>
            <Textarea id="an-body" rows={5} {...register("body")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
                  <span className="font-medium text-ink">Důležité</span>
                  <Switch checked={field.value === "important"} onCheckedChange={(v) => field.onChange(v ? "important" : "normal")} />
                </label>
              )}
            />
            <Controller
              control={control}
              name="pinned"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
                  <span className="font-medium text-ink">Připnout nahoru</span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          </div>
          <Field label="Stav">
            <Controller control={control} name="status" render={({ field }) => <StatusSelect value={field.value} onChange={field.onChange} />} />
          </Field>
          <p className="text-xs text-muted">Oznámení se zobrazí v aplikaci. Push notifikace se neodesílají.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" loading={pending}>
              Uložit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementsManager({
  items,
  openNew,
  reads,
  people,
}: {
  items: Announcement[];
  openNew: boolean;
  /** Kolik lidí oznámení přečetlo (id → počet) a kolik je schválených celkem */
  reads: Record<string, number>;
  people: number;
}) {
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [dialog, setDialog] = React.useState<{ open: boolean; item: Announcement | null }>({ open: openNew, item: null });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ open: true, item: null })}>
          <Plus /> Nové oznámení nebo událost
        </Button>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title="Zatím žádná oznámení" />
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Card className="flex items-start gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.kind !== "info" && (
                      <Badge className={NOTICE_KIND[a.kind].badge}>
                        {a.kind === "event" ? <CalendarHeart aria-hidden /> : <CalendarClock aria-hidden />} {NOTICE_KIND[a.kind].label} · {noticeWhen(a)}
                      </Badge>
                    )}
                    {a.priority === "important" && <Badge tone="red">Důležité</Badge>}
                    {a.pinned && (
                      <Badge tone="blue">
                        <Pin aria-hidden /> Připnuto
                      </Badge>
                    )}
                    <span className="text-xs text-muted">{formatDateTime(a.published_at ?? a.created_at)}</span>
                    {a.status === "published" && <ActivityButton kind="announcement" id={a.id} count={reads[a.id] ?? 0} total={people} />}
                  </div>
                  <button type="button" onClick={() => setDialog({ open: true, item: a })} className="mt-2 block text-left font-semibold text-ink hover:text-primary">
                    {a.title}
                  </button>
                  {a.body && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>}
                </div>
                <RowMenu
                  label={a.title}
                  status={a.status}
                  onEdit={() => setDialog({ open: true, item: a })}
                  onStatus={(s) => run(() => setStatus("announcements", a.id, s))}
                  extra={
                    <DropdownMenuItem onSelect={() => run(() => setPinned(a.id, !a.pinned))}>
                      {a.pinned ? <PinOff /> : <Pin />} {a.pinned ? "Odepnout" : "Připnout"}
                    </DropdownMenuItem>
                  }
                  onDelete={() =>
                    ask({
                      title: "Smazat oznámení?",
                      description: `Oznámení „${a.title}“ bude trvale smazáno.`,
                      confirmLabel: "Smazat",
                      onConfirm: () => run(() => deleteRow("announcements", a.id)),
                    })
                  }
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
      <AnnouncementDialog item={dialog.item} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
    </>
  );
}
