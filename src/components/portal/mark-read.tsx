"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAnnouncementsRead } from "@/lib/actions/student";

export function MarkReadButton({ ids, label = "Označit vše jako přečtené", small }: { ids: string[]; label?: string; small?: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!ids.length) return null;
  return (
    <Button
      variant={small ? "ghost" : "secondary"}
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markAnnouncementsRead(ids);
          if (!res.ok) toast.error(res.error);
          else if (!small) toast.success("Hotovo – vše přečteno.");
        })
      }
    >
      {!pending && <CheckCheck aria-hidden />}
      {label}
    </Button>
  );
}
