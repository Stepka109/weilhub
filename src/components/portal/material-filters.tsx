"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/form-controls";

/** Filtry materiálů (typ, řazení, téma, předmět) uložené v URL. */
export function MaterialFilters({
  subjects,
  topics,
}: {
  subjects?: { slug: string; name: string }[];
  topics?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "predmet") next.delete("tema");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {subjects && (
        <Select aria-label="Předmět" value={params.get("predmet") ?? ""} onChange={(e) => set("predmet", e.target.value)} className="h-10 sm:w-52">
          <option value="">Všechny předměty</option>
          {subjects.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      {topics && topics.length > 0 && (
        <Select aria-label="Téma" value={params.get("tema") ?? ""} onChange={(e) => set("tema", e.target.value)} className="h-10 sm:w-56">
          <option value="">Všechna témata</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      )}
      <Select aria-label="Typ materiálu" value={params.get("typ") ?? ""} onChange={(e) => set("typ", e.target.value)} className="h-10 sm:w-44">
        <option value="">Všechny typy</option>
        <option value="note">Zápisy</option>
        <option value="file">Soubory</option>
      </Select>
      <Select aria-label="Řazení" value={params.get("razeni") ?? ""} onChange={(e) => set("razeni", e.target.value)} className="h-10 sm:w-48">
        <option value="">Výchozí řazení</option>
        <option value="newest">Nejnovější</option>
        <option value="oldest">Nejstarší</option>
        <option value="title">Podle názvu</option>
      </Select>
    </div>
  );
}
