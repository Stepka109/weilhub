import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data/portal";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Nastavení portálu" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  if (!settings) {
    return <p className="text-rose-ink">Nastavení se nepodařilo načíst. Zkontrolujte, že proběhly databázové migrace.</p>;
  }
  return (
    <>
      <PageHeader title="Nastavení portálu" description="Obecné údaje, registrace, obsah a vzhled. Bezpečnostní klíče se nastavují pouze v proměnných prostředí serveru." />
      <SettingsForm settings={settings} />
    </>
  );
}
