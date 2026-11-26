import type { Metadata } from "next";
import { ExternalLink, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { CanteenDishes, canteenDayLabel } from "@/components/portal/canteen-menu";
import { requireUser } from "@/lib/auth";
import { CANTEEN_ORDER_URL, CANTEEN_URL, getCanteenMenu } from "@/lib/canteen";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Jídelna" };

export default async function CanteenPage() {
  await requireUser();
  const today = todayIso();
  const menu = await getCanteenMenu();
  const days = (menu ?? []).filter((d) => d.date >= today);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jídelna"
        description="Jídelníček školní jídelny na nejbližší dny. Objednává se na Strava.cz."
        actions={
          <Button asChild variant="outline">
            <a href={CANTEEN_ORDER_URL} target="_blank" rel="noopener noreferrer">
              Objednat na Strava.cz <ExternalLink aria-hidden />
            </a>
          </Button>
        }
      />
      {menu === null ? (
        <Card>
          <EmptyState
            icon={UtensilsCrossed}
            title="Jídelníček se teď nepodařilo načíst"
            description="Strava.cz neodpovídá. Zkus to za chvíli, nebo se podívej přímo na Strava.cz."
          />
        </Card>
      ) : days.length === 0 ? (
        <Card>
          <EmptyState icon={UtensilsCrossed} title="Jídelníček zatím není zveřejněný" description="Jídelna ho obvykle zveřejní na týden dopředu." />
        </Card>
      ) : (
        days.map((d) => (
          <Card key={d.date} className="p-5 sm:p-6">
            <h2 className="mb-3 font-display text-lg font-bold text-ink">{canteenDayLabel(d.date, today)}</h2>
            <CanteenDishes day={d} />
          </Card>
        ))
      )}
      <p className="text-xs text-muted">
        Zdroj:{" "}
        <a href={CANTEEN_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          Strava.cz – jídelna 5228
        </a>
        . Čísla v závorce jsou alergeny (po najetí myší uvidíš názvy).
      </p>
    </div>
  );
}
