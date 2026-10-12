"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { signUp } from "@/lib/actions/auth";
import { registerSchema } from "@/lib/validation/auth";

type Values = z.input<typeof registerSchema>;

export function RegisterForm({ requiresInvite, defaultCode }: { requiresInvite: boolean; defaultCode: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { inviteCode: defaultCode },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const res = await signUp(values);
      if (!res) return;
      if (res.ok) {
        setDone(res.message ?? "Účet byl vytvořen.");
      } else {
        setError(res.error);
        for (const [k, v] of Object.entries(res.fieldErrors ?? {})) {
          if (v?.[0]) setFieldError(k as keyof Values, { message: v[0] });
        }
      }
    });
  });

  if (done) {
    return (
      <div className="mt-8 rounded-card bg-mint p-6 text-mint-ink" role="status">
        <MailCheck className="mb-3 size-8" aria-hidden />
        <p className="font-semibold">Skoro hotovo!</p>
        <p className="mt-1 text-sm">{done}</p>
      </div>
    );
  }

  const e = formState.errors;
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      {error && (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm text-rose-ink" role="alert">
          {error}
        </p>
      )}
      <Field label="Jméno" htmlFor="displayName" error={e.displayName?.message} hint="Zobrazí se spolužákům, např. Jan N.">
        <Input id="displayName" autoComplete="nickname" aria-invalid={!!e.displayName} {...register("displayName")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={e.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!e.email} {...register("email")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Heslo" htmlFor="password" error={e.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} {...register("password")} />
        </Field>
        <Field label="Heslo znovu" htmlFor="passwordConfirm" error={e.passwordConfirm?.message}>
          <Input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!e.passwordConfirm}
            {...register("passwordConfirm")}
          />
        </Field>
      </div>
      <Field
        label={requiresInvite ? "Kód pozvánky" : "Kód pozvánky (nepovinné)"}
        htmlFor="inviteCode"
        error={e.inviteCode?.message}
        required={requiresInvite}
        hint="S platnou pozvánkou bude účet aktivní hned."
      >
        <Input id="inviteCode" autoComplete="off" aria-invalid={!!e.inviteCode} {...register("inviteCode")} />
      </Field>
      <p className="text-xs text-muted">
        Ukládáme jen jméno, e-mail a nastavení potřebná k chodu portálu. Heslo musí mít alespoň 8 znaků, písmeno a číslici.
      </p>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Vytvořit účet
      </Button>
    </form>
  );
}
