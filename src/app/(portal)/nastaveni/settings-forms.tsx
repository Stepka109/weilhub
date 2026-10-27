"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { signOut, updatePassword } from "@/lib/actions/auth";
import { updatePreferences } from "@/lib/actions/student";
import { newPasswordSchema } from "@/lib/validation/auth";
import type { UserPreferences } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SettingsForms({ preferences, email }: { preferences: UserPreferences; email: string }) {
  const [prefs, setPrefs] = useState(preferences);
  const [pending, startTransition] = useTransition();
  const [pwPending, startPw] = useTransition();
  const pw = useForm<z.input<typeof newPasswordSchema>>({ resolver: zodResolver(newPasswordSchema) });

  function savePref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value });
    startTransition(async () => {
      const res = await updatePreferences({ [key]: value });
      if (!res.ok) {
        setPrefs(prev);
        toast.error(res.error);
      } else toast.success("Uloženo", { duration: 1500 });
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Zobrazení" description="Předvolby se ukládají k tvému účtu." />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>
              <span className="block font-medium text-ink" id="pref-group">
                Moje skupina
              </span>
              <span className="block text-sm text-muted">U dělených předmětů uvidíš rozvrh, materiály, úkoly a testy své skupiny.</span>
            </span>
            <div role="radiogroup" aria-labelledby="pref-group" className="inline-flex gap-1 rounded-full border border-line bg-card p-1">
              {([null, "S1", "S2"] as const).map((g) => {
                const active = (prefs.studyGroup ?? null) === g;
                return (
                  <button
                    key={g ?? "none"}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={pending}
                    onClick={() => savePref("studyGroup", g)}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
                      active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-slate-soft hover:text-ink",
                    )}
                  >
                    {g ?? "Nezvoleno"}
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Změna hesla" description={`Přihlašovací e-mail: ${email}`} />
        <CardBody>
          <form
            className="space-y-4"
            noValidate
            onSubmit={pw.handleSubmit((values) =>
              startPw(async () => {
                const res = await updatePassword(values);
                if (res.ok) {
                  toast.success(res.message);
                  pw.reset({ password: "", passwordConfirm: "" });
                } else toast.error(res.error);
              }),
            )}
          >
            <Field label="Nové heslo" htmlFor="password" error={pw.formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" {...pw.register("password")} />
            </Field>
            <Field label="Nové heslo znovu" htmlFor="passwordConfirm" error={pw.formState.errors.passwordConfirm?.message}>
              <Input id="passwordConfirm" type="password" autoComplete="new-password" {...pw.register("passwordConfirm")} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={pwPending}>
                {!pwPending && <KeyRound aria-hidden />} Změnit heslo
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="xl:col-span-2">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-ink">Odhlášení</p>
            <p className="text-sm text-muted">Ukončí relaci na tomto zařízení.</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="danger-soft">
              <LogOut aria-hidden /> Odhlásit se
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
