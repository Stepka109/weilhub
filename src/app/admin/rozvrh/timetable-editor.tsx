"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { CalendarCheck2, CalendarOff, CalendarPlus, CircleSlash, Pencil, RotateCcw, Rows3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { clearOverride, deleteDayOverride, deleteSlot, saveDayOverride, saveOverride, saveSlot } from "@/lib/actions/admin/timetable";
import { useAction } from "@/lib/use-action";
import { WEEKDAYS, formatDate, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Cell, DayRow, TimetableWeek } from "@/lib/timetable";
import type { TimetableSubject, TimetableTeacher } from "@/lib/data/timetable";

type Mode = "default" | "changed" | "new" | "event" | "cancelled";

const MODES: { key: Mode; label: string; hint: string; icon: typeof Pencil; tone: string }[] = [
  { key: "default", label: "Výchozí rozvrh", hint: "Trvalá hodina", icon: Rows3, tone: "border-line" },
  { key: "changed", label: "Změna / supl.", hint: "Jen tento týden", icon: Pencil, tone: "border-[#db2d2d]" },
  { key: "new", label: "Nová hodina", hint: "Dočasně navíc · N", icon: CalendarPlus, tone: "border-[#4f9a12]" },
  { key: "event", label: "Akce třídy", hint: "Zeleně · A", icon: CalendarCheck2, tone: "border-[#4f9a12] border-dashed" },
  { key: "cancelled", label: "Odpadá", hint: "Vyjmuto z rozvrhu", icon: CircleSlash, tone: "border-[#db2d2d] border-dashed" },
];

interface CellValues {
  subject_code: string;
  subject_name: string;
  teacher: string;
  room: string;
  title: string;
  event_code: string;
  lesson_to: string;
  note: string;
}

function CellDialog({
  target,
  week,
  catalog,
  onClose,
}: {
  target: { cell: Cell; row: DayRow } | null;
  week: TimetableWeek;
  catalog: { subjects: TimetableSubject[]; teachers: TimetableTeacher[] };
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const cell = target?.cell;
  const ov = cell?.override ?? null;
  const base = cell?.base ?? null;
  const initialMode: Mode = ov?.kind ?? (base ? "default" : "new");
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [error, setError] = React.useState<string | null>(null);
  const [accent, setAccent] = React.useState<"red" | "green">(ov?.kind === "cancelled" && ov.accent === "green" ? "green" : "red");

  const values: CellValues = {
    subject_code: (ov && (ov.kind === "changed" || ov.kind === "new") ? ov.subject_code : base?.subject_code) ?? "",
    subject_name: (ov && (ov.kind === "changed" || ov.kind === "new") ? ov.subject_name : base?.subject_name) ?? "",
    teacher: (ov && ov.kind !== "cancelled" ? ov.teacher : base?.teacher) ?? "",
    room: (ov && ov.kind !== "cancelled" ? ov.room : base?.room) ?? "",
    title: ov?.kind === "event" ? (ov.title ?? "Akce třídy") : "Akce třídy",
    event_code: ov?.kind === "event" ? (ov.subject_code ?? "AKT") : "AKT",
    lesson_to: String(cell?.lesson ?? ""),
    note: ov?.note ?? "",
  };
  const { register, handleSubmit, setValue, watch, reset } = useForm<CellValues>({ values });
  const subjectCode = watch("subject_code");

  // Při otevření jiné hodiny nastavit odpovídající režim
  const key = target ? `${target.row.date}-${target.cell.lesson}` : "";
  const [lastKey, setLastKey] = React.useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setMode(initialMode);
    setError(null);
    setAccent(ov?.kind === "cancelled" && ov.accent === "green" ? "green" : "red");
  }

  if (!target || !cell) return null;
  const period = week.lessons.find((l) => l.lesson_number === cell.lesson);
  const dayLabel = `${WEEKDAYS[target.row.day - 1]} ${formatDate(target.row.date)} · ${cell.lesson}. hodina${period ? ` (${formatTime(period.start_time)}–${formatTime(period.end_time)})` : ""}`;
  const teacherList = [...new Set([...catalog.teachers.map((t) => t.name), ...(values.teacher ? [values.teacher] : [])])];

  function onSubject(codeValue: string) {
    const s = catalog.subjects.find((x) => x.code === codeValue);
    setValue("subject_code", codeValue);
    setValue("subject_name", s?.name ?? "");
    if (s?.default_teacher) setValue("teacher", s.default_teacher);
  }

  const submit = handleSubmit(async (v) => {
    setError(null);
    const common = { day_of_week: target.row.day, lesson_number: cell.lesson };
    const res =
      mode === "default"
        ? await run(() =>
            saveSlot({ ...common, cycle_week: week.cycleWeek, subject_code: v.subject_code, subject_name: v.subject_name, teacher: v.teacher, room: v.room }),
          )
        : await run(() =>
            saveOverride({
              ...common,
              week_start: week.monday,
              kind: mode,
              subject_code: mode === "event" ? v.event_code : v.subject_code,
              subject_name: v.subject_name,
              title: v.title,
              teacher: v.teacher,
              room: v.room,
              note: v.note,
              lesson_to: mode === "event" ? Number(v.lesson_to) : undefined,
              accent: mode === "cancelled" ? accent : undefined,
            }),
          );
    if (res.ok) {
      // Uložení výchozí hodiny nesmí ponechat starou týdenní změnu nečekaně aktivní – jen informujeme
      onClose();
    } else setError(res.error);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Úprava rozvrhu" description={`${dayLabel} · týden ${week.cycleWeek}`} wide>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div role="radiogroup" aria-label="Typ úpravy" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {MODES.filter((m) => m.key !== "cancelled" || base).map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors",
                  mode === m.key ? cn(m.tone, "bg-light-blue/40") : "border-line hover:border-[#cfd7e4]",
                )}
              >
                <m.icon className={cn("size-[18px]", mode === m.key ? "text-primary" : "text-muted")} aria-hidden />
                <span className="text-sm font-semibold text-ink">{m.label}</span>
                <span className="text-xs text-muted">{m.hint}</span>
              </button>
            ))}
          </div>

          {mode === "default" && (
            <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-slate-ink">
              Hodina se uloží natrvalo do výchozího rozvrhu <strong>týdne {week.cycleWeek}</strong> (opakuje se každý {week.cycleWeek}-týden).
              {ov && " Pro tento týden ale stále platí uložená změna – vraťte ji tlačítkem „Vrátit běžný stav“."}
            </p>
          )}

          {(mode === "default" || mode === "changed" || mode === "new") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Předmět" htmlFor="tt-subject" required>
                <Select id="tt-subject" value={subjectCode} onChange={(e) => onSubject(e.target.value)}>
                  <option value="">Vyberte předmět…</option>
                  {catalog.subjects.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} – {s.name}
                    </option>
                  ))}
                  {subjectCode && !catalog.subjects.some((s) => s.code === subjectCode) && <option value={subjectCode}>{subjectCode}</option>}
                </Select>
              </Field>
              <Field label="Učitel" htmlFor="tt-teacher" hint="Vyberte nebo napište jméno.">
                <Input id="tt-teacher" list="tt-teachers" {...register("teacher")} />
              </Field>
              <Field label="Místnost" htmlFor="tt-room">
                <Input id="tt-room" placeholder="např. S113" {...register("room")} />
              </Field>
              {mode !== "default" && (
                <Field label="Poznámka" htmlFor="tt-note" hint="Nepovinné, uvidí ji studenti v detailu.">
                  <Input id="tt-note" {...register("note")} />
                </Field>
              )}
            </div>
          )}

          {mode === "event" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Název akce" htmlFor="tt-title" required>
                <Input id="tt-title" {...register("title")} />
              </Field>
              <Field label="Zkratka v rozvrhu" htmlFor="tt-ecode">
                <Input id="tt-ecode" maxLength={10} {...register("event_code")} />
              </Field>
              <Field label="Učitel / doprovod" htmlFor="tt-eteacher">
                <Input id="tt-eteacher" list="tt-teachers" {...register("teacher")} />
              </Field>
              <Field label="Místnost / místo" htmlFor="tt-eroom">
                <Input id="tt-eroom" {...register("room")} />
              </Field>
              <Field label="Akce trvá do hodiny" htmlFor="tt-to" hint="Navazující hodiny se spojí do jedné karty.">
                <Select id="tt-to" {...register("lesson_to")}>
                  {week.lessons
                    .filter((l) => l.lesson_number >= cell.lesson)
                    .map((l) => (
                      <option key={l.lesson_number} value={l.lesson_number}>
                        {l.lesson_number}. hodina ({formatTime(l.end_time)})
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Poznámka" htmlFor="tt-enote">
                <Input id="tt-enote" {...register("note")} />
              </Field>
            </div>
          )}

          {mode === "cancelled" && (
            <div className="space-y-4">
              <p className="rounded-2xl bg-rose px-4 py-3 text-sm text-rose-ink">
                Hodina <strong>{base?.subject_name}</strong> v tomto týdnu odpadá. Výchozí rozvrh zůstane beze změny.
              </p>
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink" id="tt-accent-label">
                  Ohraničení v rozvrhu
                </p>
                <div role="radiogroup" aria-labelledby="tt-accent-label" className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "red", label: "Červeně šrafované", hint: "Běžné odpadnutí", color: "#db2d2d" },
                      { key: "green", label: "Zeleně šrafované", hint: "Např. kvůli akci", color: "#4f9a12" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={accent === o.key}
                      onClick={() => setAccent(o.key)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors",
                        accent === o.key ? "border-primary bg-light-blue/40" : "border-line hover:border-[#cfd7e4]",
                      )}
                    >
                      <span
                        className="relative grid h-11 w-14 shrink-0 place-items-center rounded-lg border-2 border-dashed bg-white"
                        style={{ borderColor: o.color }}
                        aria-hidden
                      >
                        <span className="absolute top-1/2 -left-0.5 grid h-5 w-4 -translate-y-1/2 place-items-center rounded-r text-[10px] font-extrabold text-white" style={{ background: o.color }}>
                          O
                        </span>
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">{o.label}</span>
                        <span className="block text-xs text-muted">{o.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Poznámka" htmlFor="tt-cnote" hint="Např. důvod (nemoc, exkurze…).">
                <Input id="tt-cnote" {...register("note")} />
              </Field>
            </div>
          )}

          <datalist id="tt-teachers">
            {teacherList.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          {error && (
            <p className="rounded-2xl bg-rose px-4 py-3 text-sm text-rose-ink" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              {ov && (
                <Button
                  variant="outline"
                  loading={pending}
                  onClick={async () => {
                    const res = await run(() => clearOverride({ week_start: week.monday, day_of_week: target.row.day, lesson_number: cell.lesson }));
                    if (res.ok) onClose();
                  }}
                >
                  <RotateCcw /> Vrátit běžný stav
                </Button>
              )}
              {mode === "default" && base && (
                <Button
                  variant="danger-soft"
                  loading={pending}
                  onClick={async () => {
                    const res = await run(() => deleteSlot({ cycle_week: week.cycleWeek, day_of_week: target.row.day, lesson_number: cell.lesson }));
                    if (res.ok) {
                      reset();
                      onClose();
                    }
                  }}
                >
                  <Trash2 /> Smazat výchozí hodinu
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={onClose}>
                Zavřít
              </Button>
              <Button type="submit" loading={pending}>
                {mode === "default" ? "Uložit jako výchozí" : "Uložit pro tento týden"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DayValues {
  kind: "holiday" | "event";
  title: string;
  room: string;
  teacher: string;
}

function DayDialog({ row, onClose, teachers }: { row: DayRow | null; onClose: () => void; teachers: string[] }) {
  const { pending, run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const o = row?.dayOverride?.source === "timetable" ? row.dayOverride : null;
  const { register, handleSubmit, watch } = useForm<DayValues>({
    values: { kind: o?.kind ?? "holiday", title: o?.title ?? "", room: o?.room ?? "", teacher: o?.teacher ?? "" },
  });
  if (!row) return null;
  const kind = watch("kind");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Celý den" description={`${WEEKDAYS[row.day - 1]} ${formatDate(row.date)} – volno, svátek nebo celodenní akce`}>
        {row.dayOverride?.source === "calendar" && (
          <p className="mb-4 rounded-2xl bg-lavender px-4 py-3 text-sm text-lavender-ink">
            Tento den je volný podle kalendáře akcí („{row.dayOverride.title}“). Upravit ho lze v sekci{" "}
            <Link href="/admin/akce" className="font-semibold underline">
              Akce a volné dny
            </Link>
            .
          </p>
        )}
        <form
          className="space-y-5"
          noValidate
          onSubmit={handleSubmit(async (v) => {
            const res = await run(() => saveDayOverride({ date: row.date, ...v }));
            if (res.ok) onClose();
          })}
        >
          <Field label="Typ celého dne" htmlFor="d-kind">
            <Select id="d-kind" {...register("kind")}>
              <option value="holiday">Volno / svátek (fialově)</option>
              <option value="event">Akce (zeleně)</option>
            </Select>
          </Field>
          <Field label="Text dne" htmlFor="d-title" required>
            <Input id="d-title" placeholder={kind === "event" ? "např. Exkurze – Technické muzeum" : "např. Státní svátek"} {...register("title")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Místo / učebna" htmlFor="d-room">
              <Input id="d-room" {...register("room")} />
            </Field>
            <Field label="Učitel / doprovod" htmlFor="d-teacher">
              <Input id="d-teacher" list="d-teachers" {...register("teacher")} />
            </Field>
            <datalist id="d-teachers">
              {teachers.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <DialogFooter className="sm:justify-between">
            {o ? (
              <Button
                variant="danger-soft"
                onClick={() =>
                  ask({
                    title: "Smazat celodenní záznam?",
                    description: `„${o.title}“ zmizí a den se zobrazí podle běžného rozvrhu.`,
                    confirmLabel: "Smazat",
                    onConfirm: async () => {
                      const res = await run(() => deleteDayOverride(row.date));
                      if (res.ok) onClose();
                    },
                  })
                }
              >
                <CalendarOff /> Smazat celodenní záznam
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={onClose}>
                Zavřít
              </Button>
              <Button type="submit" loading={pending}>
                Uložit
              </Button>
            </div>
          </DialogFooter>
        </form>
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}

export function TimetableEditor({
  week,
  catalog,
  allLessons,
}: {
  week: TimetableWeek;
  catalog: { subjects: TimetableSubject[]; teachers: TimetableTeacher[] };
  allLessons: boolean;
}) {
  const [cellTarget, setCellTarget] = React.useState<{ cell: Cell; row: DayRow } | null>(null);
  const [dayTarget, setDayTarget] = React.useState<DayRow | null>(null);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Klikněte na hodinu pro úpravu, na den (vlevo) pro volno nebo celodenní akci.</p>
        <Button asChild variant={allLessons ? "secondary" : "outline"} size="sm">
          <Link href={`/admin/rozvrh?tyden=${week.monday}${allLessons ? "" : "&vse=1"}`} scroll={false}>
            {allLessons ? "Zobrazit jen používané hodiny" : "Zobrazit 0.–15. hodinu"}
          </Link>
        </Button>
      </div>
      <TimetableGrid
        week={week}
        editable
        onCellClick={(cell, row) => setCellTarget({ cell, row })}
        onDayClick={(row) => setDayTarget(row)}
      />
      <CellDialog target={cellTarget} week={week} catalog={catalog} onClose={() => setCellTarget(null)} />
      <DayDialog row={dayTarget} onClose={() => setDayTarget(null)} teachers={catalog.teachers.map((t) => t.name)} />
    </>
  );
}
