"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { Megaphone, Pin, PinOff, Plus } from "lucide-react";
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
import { deleteRow, saveAnnouncement, setPinned, setStatus } from "@/lib/actions/admin/content";
import { useAction } from "@/lib/use-action";
import { formatDateTime } from "@/lib/dates";
import type { Announcement, AnnouncementPriority, PublicationStatus } from "@/lib/types";

interface Values {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  pinned: boolean;
  status: PublicationStatus;
}

function AnnouncementDialog({ item, open, onOpenChange }: { item: Announcement | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction();
  const { register, handleSubmit, control, formState, setError } = useForm<Values>({
    values: {
      title: item?.title ?? "",
      body: item?.body ?? "",
      priority: item?.priority ?? "normal",
      pinned: item?.pinned ?? false,
      status: item?.status ?? "published",
    },
  });
  const onSubmit = handleSubmit(async (v) => {
    const res = await run(() => saveAnnouncement(item?.id ?? null, v), { onSuccess: () => onOpenChange(false) });
    if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={item ? "Upravit oznámení" : "Nové oznámení"}>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Field label="Nadpis" htmlFor="an-title" required error={formState.errors.title?.message}>
            <Input id="an-title" {...register("title", { required: "Zadejte nadpis." })} />
          </Field>
          <Field label="Text" htmlFor="an-body">
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

export function AnnouncementsManager({ items, openNew }: { items: Announcement[]; openNew: boolean }) {
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [dialog, setDialog] = React.useState<{ open: boolean; item: Announcement | null }>({ open: openNew, item: null });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ open: true, item: null })}>
          <Plus /> Nové oznámení
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
                    {a.priority === "important" && <Badge tone="red">Důležité</Badge>}
                    {a.pinned && (
                      <Badge tone="blue">
                        <Pin aria-hidden /> Připnuto
                      </Badge>
                    )}
                    <span className="text-xs text-muted">{formatDateTime(a.published_at ?? a.created_at)}</span>
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
