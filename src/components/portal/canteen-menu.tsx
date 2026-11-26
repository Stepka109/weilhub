import Link from "next/link";
import { ExternalLink, Soup, UtensilsCrossed } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { CANTEEN_ORDER_URL, type CanteenDay, type Dish } from "@/lib/canteen";
import { WEEKDAYS, formatDate, isoWeekday, shiftDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** „Dnes“, „Zítra“ nebo „Pondělí 30. 11.“ */
export function canteenDayLabel(date: string, today: string): string {
  if (date === today) return "Dnes";
  if (date === shiftDate(today, 1)) return "Zítra";
  return `${WEEKDAYS[isoWeekday(date) - 1]} ${formatDate(date, "d. M.")}`;
}

function Allergens({ dish }: { dish: Dish }) {
  if (!dish.allergens.length) return null;
  return (
    <span className="ml-1.5 text-xs whitespace-nowrap text-muted" title={`Alergeny: ${dish.allergens.map((a) => `${a.code} ${a.name}`).join(", ")}`}>
      ({dish.allergens.map((a) => a.code).join(", ")})
    </span>
  );
}

/** Obědy jednoho dne: polévka a jídla na výběr. */
export function CanteenDishes({ day, compact = false }: { day: CanteenDay; compact?: boolean }) {
  return (
    <ul className={cn("grid gap-3", !compact && "md:grid-cols-3")}>
      {day.dishes.map((d, i) => (
        <li key={i} className={cn("rounded-2xl px-4 py-3", d.kind === "soup" ? "bg-orange/70" : "bg-bg")}>
          <span className={cn("flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase", d.kind === "soup" ? "text-orange-ink" : "text-primary")}>
            {d.kind === "soup" ? <Soup className="size-3.5" aria-hidden /> : <UtensilsCrossed className="size-3.5" aria-hidden />}
            {d.label}
          </span>
          <span className="mt-1 block text-[0.95rem] leading-snug font-medium text-ink">
            {d.name}
            <Allergens dish={d} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Karta na nástěnce: oběd dnes (do 14:30), jinak nejbližší další den. */
export function CanteenCard({ day, today }: { day: CanteenDay; today: string }) {
  return (
    <Card>
      <CardHeader
        title={`${canteenDayLabel(day.date, today)} v jídelně`}
        icon={<UtensilsCrossed className="size-5 text-muted" aria-hidden />}
        action={
          <div className="flex items-center gap-4">
            <Link href="/jidelna" className="text-sm font-medium text-primary hover:underline">
              Celý týden
            </Link>
            <a
              href={CANTEEN_ORDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-primary max-sm:hidden"
            >
              Objednat <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        }
      />
      <div className="px-4 pt-3 pb-5 sm:px-6">
        <CanteenDishes day={day} />
      </div>
    </Card>
  );
}
