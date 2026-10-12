"use client";

import { useForm } from "react-hook-form";
import { CalendarRange, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { saveTimetablePeriod } from "@/lib/actions/admin/timetable";
import { useAction } from "@/lib/use-action";
import { formatDate } from "@/lib/dates";
import type { TimetableSettings } from "@/lib/data/timetable";

interface Values {
  timetable_visible_from: string;
  timetable_visible_to: string;
  timetable_cycle: string;
  timetable_reference_monday: string;
  timetable_reference_week: string;
}

export function PeriodForm({ settings, canEdit, currentWeek }: { settings: TimetableSettings; canEdit: boolean; currentWeek: string }) {
  const { pending, run } = useAction();
  const { register, handleSubmit, formState, setError, reset } = useForm<Values>({
    defaultValues: {
      timetable_visible_from: settings.visibleFrom,
      timetable_visible_to: settings.visibleTo,
      timetable_cycle: settings.cycle.join(", "),
      timetable_reference_monday: settings.referenceMonday,
      timetable_reference_week: settings.referenceWeek,
    },
  });
  const e = formState.errors;

  return (
    <form
      noValidate
      className="grid gap-6 xl:grid-cols-2"
      onSubmit={handleSubmit(async (v) => {
        const res = await run(() => saveTimetablePeriod(v), { onSuccess: () => reset(v) });
        if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
      })}
    >
      <Card>
        <CardHeader
          title="Období zobrazení"
          description="Mimo toto období se v rozvrhu zobrazí prázdné pracovní dny (např. o prázdninách)."
          icon={<CalendarRange className="size-5 text-muted" aria-hidden />}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Rozvrh zobrazovat od" htmlFor="p-from" error={e.timetable_visible_from?.message}>
            <Input id="p-from" type="date" disabled={!canEdit} {...register("timetable_visible_from")} />
          </Field>
          <Field label="Rozvrh zobrazovat do" htmlFor="p-to" error={e.timetable_visible_to?.message}>
            <Input id="p-to" type="date" disabled={!canEdit} {...register("timetable_visible_to")} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Střídání týdnů"
          description={`Tento týden je podle nastavení týden ${currentWeek}.`}
          icon={<Repeat className="size-5 text-muted" aria-hidden />}
        />
        <CardBody className="space-y-4">
          <Field label="Pořadí týdnů" htmlFor="p-cycle" hint="Písmena oddělená čárkou, např. A, E, B, F" error={e.timetable_cycle?.message}>
            <Input id="p-cycle" disabled={!canEdit} {...register("timetable_cycle")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field
              label="Týden začínající pondělím"
              htmlFor="p-ref"
              hint={`Nyní: ${formatDate(settings.referenceMonday)}`}
              error={e.timetable_reference_monday?.message}
            >
              <Input id="p-ref" type="date" disabled={!canEdit} {...register("timetable_reference_monday")} />
            </Field>
            <Field label="je týden" htmlFor="p-refw" error={e.timetable_reference_week?.message}>
              <Input id="p-refw" maxLength={1} className="uppercase" disabled={!canEdit} {...register("timetable_reference_week")} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3 xl:col-span-2">
        {!canEdit && <p className="text-sm text-muted">Období a střídání týdnů může měnit jen administrátor.</p>}
        <Button type="submit" loading={pending} disabled={!canEdit || !formState.isDirty}>
          Uložit období
        </Button>
      </div>
    </form>
  );
}
