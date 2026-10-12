"use client";

import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { History, KeyRound, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { Logo, LogoMark } from "@/components/brand/logo";
import { saveSettings } from "@/lib/actions/admin/users";
import { useAction } from "@/lib/use-action";
import { FILE_TYPES } from "@/lib/files";
import type { AppSettings } from "@/lib/types";

type Values = Omit<AppSettings, "updated_at">;

function ToggleRow({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-bg px-4 py-3">
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const { pending, run } = useAction();
  const { register, handleSubmit, control, formState, setError, reset } = useForm<Values>({ defaultValues: settings });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    const res = await run(() => saveSettings(v as Parameters<typeof saveSettings>[0]), { onSuccess: () => reset(v) });
    if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Obecné" />
        <CardBody className="space-y-5">
          <Field label="Název portálu" htmlFor="st-name" required error={e.portal_name?.message}>
            <Input id="st-name" {...register("portal_name")} />
          </Field>
          <Field label="Krátký popis" htmlFor="st-desc" error={e.portal_description?.message}>
            <Input id="st-desc" {...register("portal_description")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Aktuální školní rok" htmlFor="st-year" error={e.school_year?.message} hint="např. 2026/2027">
              <Input id="st-year" {...register("school_year")} />
            </Field>
            <Field label="Označení třídy" htmlFor="st-class" error={e.class_label?.message} hint="Upravte při postupu do vyššího ročníku.">
              <Input id="st-class" {...register("class_label")} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Registrace" />
        <CardBody className="space-y-3">
          <Controller
            control={control}
            name="registration_enabled"
            render={({ field }) => (
              <ToggleRow title="Povolit registrace" text="Vypnuté = registrovat se lze jen s platnou pozvánkou." checked={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="registration_requires_invite"
            render={({ field }) => (
              <ToggleRow title="Vyžadovat pozvánku" text="Bez kódu pozvánky nelze účet vytvořit." checked={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="auto_approve_invited"
            render={({ field }) => (
              <ToggleRow
                title="Automaticky schválit pozvané"
                text="Vypnuté = i pozvaní uživatelé čekají na ruční schválení."
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Link href="/admin/uzivatele" className="inline-flex items-center gap-2 pt-2 text-sm font-medium text-primary hover:underline">
            <Users className="size-4" aria-hidden /> Správa pozvánek a uživatelů
          </Link>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Obsah" />
        <CardBody className="space-y-5">
          <Field label="Výchozí řazení materiálů" htmlFor="st-sort">
            <Select id="st-sort" {...register("default_material_sort")}>
              <option value="newest">Nejnovější</option>
              <option value="oldest">Nejstarší</option>
              <option value="title">Podle názvu</option>
            </Select>
          </Field>
          <Field label="Povolené typy souborů" error={e.allowed_file_types?.message as string | undefined}>
            <Controller
              control={control}
              name="allowed_file_types"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Object.values(FILE_TYPES).map((t) => (
                    <label key={t.ext} className="flex cursor-pointer items-center gap-2 rounded-xl bg-bg px-3 py-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(t.ext)}
                        onChange={(ev) => field.onChange(ev.target.checked ? [...field.value, t.ext] : field.value.filter((x) => x !== t.ext))}
                      />
                      {t.ext.toUpperCase()}
                    </label>
                  ))}
                </div>
              )}
            />
          </Field>
          <Field label="Maximální velikost souboru (MB)" htmlFor="st-max" error={e.max_upload_mb?.message} hint="1–50 MB">
            <Input id="st-max" type="number" min={1} max={50} {...register("max_upload_mb", { valueAsNumber: true })} />
          </Field>
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Vzhled" description="Logo WeilHub se používá v navigaci, při přihlášení, ve favikoně i v ikoně aplikace." />
          <CardBody className="flex flex-wrap items-center gap-6">
            <Logo />
            <LogoMark className="size-14" />
            <span className="grid size-14 place-items-center rounded-2xl bg-navy">
              <LogoMark className="size-10" />
            </span>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Bezpečnost" />
          <CardBody className="space-y-3 text-sm text-slate-ink">
            <p className="flex gap-2">
              <ShieldCheck className="size-4 shrink-0 text-mint-ink" aria-hidden /> Role se mění v sekci Uživatelé. Databáze brání odebrání posledního administrátora.
            </p>
            <p className="flex gap-2">
              <History className="size-4 shrink-0 text-primary" aria-hidden /> Důležité akce se zapisují do evidence – přehled najdete na dashboardu administrace.
            </p>
            <p className="flex gap-2">
              <KeyRound className="size-4 shrink-0 text-yellow-ink" aria-hidden /> Technické klíče (Supabase) se z bezpečnostních důvodů nastavují pouze v proměnných prostředí serveru.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="sticky bottom-4 z-10 flex justify-end xl:col-span-2">
        <Button type="submit" size="lg" loading={pending} disabled={!formState.isDirty} className="shadow-pop">
          Uložit nastavení
        </Button>
      </div>
    </form>
  );
}
