import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForms } from "./settings-forms";
import { WidgetSetup } from "./widget-setup";

export const metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: widget } = await supabase.from("widget_tokens").select("created_at, last_used_at").eq("user_id", user.id).maybeSingle();
  return (
    <>
      <PageHeader title="Nastavení" description="Předvolby zobrazení, widget na telefon a zabezpečení účtu." />
      <SettingsForms preferences={user.profile.preferences ?? {}} email={user.email ?? ""} />
      <WidgetSetup status={widget ? { createdAt: widget.created_at, lastUsedAt: widget.last_used_at } : null} />
    </>
  );
}
