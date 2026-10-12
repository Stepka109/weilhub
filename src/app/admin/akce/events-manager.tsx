"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { CalendarRange, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/admin/common";
import { RowMenu, StatusSelect } from "@/components/admin/row-menu";
import { deleteRow, saveEvent, setStatus } from "@/lib/actions/admin/content";
import { useAction } from "@/lib/use-action";
import { formatDate } from "@/lib/dates";
import type { EventKind, PublicationStatus, SchoolEvent } from "@/lib/types";

const KIND: Record<EventKind, { label: string; tone: "lavender" | "mint" | "yellow" }> = {
  school_event: { label: "Školní akce", tone: "lavender" },
  holiday: { label: "Volný den / prázdniny", tone: "mint" },
  other: { label: "Jiná událost", tone: "yellow" },
};

interface Values {
  title: string;
  kind: EventKind;
  start_date: string;
  end_date: string;
  start_time: string;
  description: string;
  status: PublicationStatus;
}

function EventDialog({ event, open, onOpenChange }: { event: SchoolEvent | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction();
  const { register, handleSubmit, control, formState, setError } = useForm<Values>({
    values: {
      title: event?.title ?? "",
      kind: event?.kind ?? "school_event",
      start_date: event?.start_date ?? "",
      end_date: event?.end_date ?? "",
      start_time: event?.start_time?.slice(0, 5) ?? "",
      description: event?.description ?? "",
      status: event?.status ?? "published",
    },
  });
  const e = formState.errors;
  const onSubmit = handleSubmit(async (v) => {
    const res = await run(() => saveEvent(event?.id ?? null, { ...v, end_date: v.end_date || v.start_date }), { onSuccess: () => onOpenChange(false) });
    if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={event ? "Upravit událost" : "Nová událost"}>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Field label="Název" htmlFor="ev-title" required error={e.title?.message}>
            <Input id="ev-title" placeholder="např. Podzimní prázdniny" {...register("title", { required: "Zadejte název." })} />
          </Field>
          <Field label="Typ" htmlFor="ev-kind">
            <Select id="ev-kind" {...register("kind")}>
              {Object.entries(KIND).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Od" htmlFor="ev-start" required error={e.start_date?.message}>
              <Input id="ev-start" type="date" {...register("start_date", { required: "Zadejte datum." })} />
            </Field>
            <Field label="Do" htmlFor="ev-end" hint="Prázdné = jeden den" error={e.end_date?.message}>
              <Input id="ev-end" type="date" {...register("end_date")} />
            </Field>
            <Field label="Čas" htmlFor="ev-time" hint="Nepovinné">
              <Input id="ev-time" type="time" {...register("start_time")} />
            </Field>
          </div>
          <Field label="Popis" htmlFor="ev-desc">
            <Textarea id="ev-desc" rows={3} {...register("description")} />
          </Field>
          <Field label="Stav">
            <Controller control={control} name="status" render={({ field }) => <StatusSelect value={field.value} onChange={field.onChange} />} />
          </Field>
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

export function EventsManager({ events }: { events: SchoolEvent[] }) {
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [dialog, setDialog] = React.useState<{ open: boolean; event: SchoolEvent | null }>({ open: false, event: null });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ open: true, event: null })}>
          <Plus /> Nová událost
        </Button>
      </div>
      {events.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarRange} title="Zatím žádné události" />
        </Card>
      ) : (
        <AdminTable head={["Termín", "Název", "Typ", "Stav", "Akce"]}>
          {events.map((ev) => (
            <Tr key={ev.id}>
              <Td className="font-medium whitespace-nowrap text-ink">
                {formatDate(ev.start_date)}
                {ev.end_date !== ev.start_date && ` – ${formatDate(ev.end_date)}`}
              </Td>
              <Td>
                <button type="button" onClick={() => setDialog({ open: true, event: ev })} className="text-left font-medium text-ink hover:text-primary">
                  {ev.title}
                </button>
              </Td>
              <Td>
                <Badge tone={KIND[ev.kind].tone}>{KIND[ev.kind].label}</Badge>
              </Td>
              <Td>
                <StatusBadge status={ev.status} />
              </Td>
              <Td className="md:text-right">
                <RowMenu
                  label={ev.title}
                  status={ev.status}
                  onEdit={() => setDialog({ open: true, event: ev })}
                  onStatus={(s) => run(() => setStatus("events", ev.id, s))}
                  onDelete={() =>
                    ask({
                      title: "Smazat událost?",
                      description: `Událost „${ev.title}“ bude trvale smazána.`,
                      confirmLabel: "Smazat",
                      onConfirm: () => run(() => deleteRow("events", ev.id)),
                    })
                  }
                />
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}
      {confirmDialog}
      <EventDialog event={dialog.event} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
    </>
  );
}
