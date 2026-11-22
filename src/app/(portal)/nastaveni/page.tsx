import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForms } from "./settings-forms";
import { WidgetSetup } from "./widget-setup";
import { PushSettings } from "./push-settings";

export const metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: widget }, { data: push }] = await Promise.all([
    supabase.from("widget_tokens").select("created_at, last_used_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("push_subscriptions").select("endpoint, topics").eq("user_id", user.id),
  ]);
  return (
    <>
      <PageHeader title="Nastavení" description="Předvolby zobrazení, upozornění, widget na telefon a zabezpečení účtu." />
      <SettingsForms preferences={user.profile.preferences ?? {}} email={user.email ?? ""} />
      <PushSettings subscriptions={push ?? []} />
      <WidgetSetup status={widget ? { createdAt: widget.created_at, lastUsedAt: widget.last_used_at } : null} />
    </>
  );
}
