"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/form-controls";

export function SubjectSelectFilter({ subjects }: { subjects: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      aria-label="Filtrovat podle předmětu"
      className="h-10 min-w-52"
      value={params.get("predmet") ?? ""}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("predmet", e.target.value);
        else next.delete("predmet");
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
      }}
    >
      <option value="">Všechny předměty</option>
      {subjects.map((s) => (
        <option key={s.slug} value={s.slug}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
