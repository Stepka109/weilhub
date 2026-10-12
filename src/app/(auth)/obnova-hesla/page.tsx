"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { updatePassword } from "@/lib/actions/auth";
import { newPasswordSchema } from "@/lib/validation/auth";

type Values = z.input<typeof newPasswordSchema>;

export default function NewPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, formState, reset } = useForm<Values>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const res = await updatePassword(values);
      setResult(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error });
      if (res.ok) reset();
    }),
  );

  return (
    <>
      <title>Nové heslo · WeilHub</title>
      <h1 className="text-3xl font-bold text-ink">Nastav si nové heslo</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {result && (
          <p
            className={`rounded-2xl px-4 py-3 text-sm ${result.ok ? "bg-mint text-mint-ink" : "bg-rose text-rose-ink"}`}
            role={result.ok ? "status" : "alert"}
          >
            {result.text}{" "}
            {result.ok && (
              <Link href="/" className="font-semibold underline">
                Pokračovat do portálu
              </Link>
            )}
          </p>
        )}
        <Field label="Nové heslo" htmlFor="password" error={formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Nové heslo znovu" htmlFor="passwordConfirm" error={formState.errors.passwordConfirm?.message}>
          <Input id="passwordConfirm" type="password" autoComplete="new-password" {...register("passwordConfirm")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Uložit heslo
        </Button>
      </form>
    </>
  );
}
