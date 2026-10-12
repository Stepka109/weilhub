"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { signIn } from "@/lib/actions/auth";
import { loginSchema } from "@/lib/validation/auth";

type Values = z.input<typeof loginSchema>;

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const res = await signIn({ ...values, next });
      if (res && !res.ok) setError(res.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      {error && (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm text-rose-ink" role="alert">
          {error}
        </p>
      )}
      <Field label="E-mail" htmlFor="email" error={formState.errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!formState.errors.email}
          {...register("email")}
        />
      </Field>
      <Field label="Heslo" htmlFor="password" error={formState.errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!formState.errors.password}
          {...register("password")}
        />
      </Field>
      <div className="flex justify-end">
        <Link href="/zapomenute-heslo" className="text-sm font-medium text-primary hover:underline">
          Zapomenuté heslo?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Přihlásit se
      </Button>
    </form>
  );
}
