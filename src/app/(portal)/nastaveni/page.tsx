import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForms } from "./settings-forms";
import { WidgetSetup } from "./widget-setup";
import { PushSettings } from "./push-settings";
import { CalendarSetup } from "./calendar-setup";

export const metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: widget }, { data: push }, { data: calendar }] = await Promise.all([
    supabase.from("widget_tokens").select("created_at, last_used_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("push_subscriptions").select("endpoint, topics").eq("user_id", user.id),
    // Tabulka přibyla migrací 13 – bez ní se karta ukáže jako nepropojená
    supabase.from("calendar_tokens").select("created_at, last_used_at").eq("user_id", user.id).maybeSingle(),
  ]);
  return (
    <>
      <PageHeader title="Nastavení" description="Předvolby zobrazení, upozornění, kalendář a widget na telefon a zabezpečení účtu." />
      <SettingsForms preferences={user.profile.preferences ?? {}} email={user.email ?? ""} />
      <PushSettings subscriptions={push ?? []} />
      <CalendarSetup status={calendar ? { createdAt: calendar.created_at, lastUsedAt: calendar.last_used_at } : null} />
      <WidgetSetup status={widget ? { createdAt: widget.created_at, lastUsedAt: widget.last_used_at } : null} />
    </>
  );
}
