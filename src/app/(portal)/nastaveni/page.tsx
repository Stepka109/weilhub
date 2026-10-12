import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { SettingsForms } from "./settings-forms";

export const metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Nastavení" description="Předvolby zobrazení a zabezpečení účtu." />
      <SettingsForms preferences={user.profile.preferences ?? {}} email={user.email ?? ""} />
    </>
  );
}
