"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { updateProfile } from "@/lib/actions/student";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState, setError, reset } = useForm({ defaultValues: { displayName } });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      const res = await updateProfile(values);
      if (res.ok) {
        toast.success(res.message);
        reset(values);
      } else {
        toast.error(res.error);
        const msg = res.fieldErrors?.displayName?.[0];
        if (msg) setError("displayName", { message: msg });
      }
    }),
  );

  return (
    <Card>
      <CardHeader title="Základní údaje" />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Field label="Zobrazované jméno" htmlFor="displayName" error={formState.errors.displayName?.message} required>
            <Input
              id="displayName"
              maxLength={80}
              aria-invalid={!!formState.errors.displayName}
              {...register("displayName", { required: "Zadejte jméno.", minLength: { value: 2, message: "Alespoň 2 znaky." } })}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={pending} disabled={!formState.isDirty}>
              Uložit změny
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
