"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { requestPasswordReset } from "@/lib/actions/auth";
import { resetRequestSchema } from "@/lib/validation/auth";

type Values = z.input<typeof resetRequestSchema>;

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(resetRequestSchema) });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const res = await requestPasswordReset(values);
      setResult(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error });
    }),
  );

  return (
    <>
      <title>Zapomenuté heslo · WeilHub</title>
      <h1 className="text-3xl font-bold text-ink">Zapomenuté heslo</h1>
      <p className="mt-2 text-muted">Pošleme ti odkaz, přes který si nastavíš nové heslo.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {result && (
          <p
            className={`rounded-2xl px-4 py-3 text-sm ${result.ok ? "bg-mint text-mint-ink" : "bg-rose text-rose-ink"}`}
            role={result.ok ? "status" : "alert"}
          >
            {result.text}
          </p>
        )}
        <Field label="E-mail" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Poslat odkaz
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/prihlaseni" className="font-medium text-primary hover:underline">
          Zpět na přihlášení
        </Link>
      </p>
    </>
  );
}
