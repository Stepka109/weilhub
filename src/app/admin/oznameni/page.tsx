import { PageHeader } from "@/components/ui/misc";
import { getActivitySummary, getAdminAnnouncements } from "@/lib/data/admin";
import { AnnouncementsManager } from "./announcements-manager";

export const metadata = { title: "Oznámení" };

export default async function AdminAnnouncementsPage({ searchParams }: PageProps<"/admin/oznameni">) {
  const [items, sp, activity] = await Promise.all([getAdminAnnouncements(), searchParams, getActivitySummary()]);
  return (
    <>
      <PageHeader title="Oznámení" description="Zprávy pro třídu. Připnutá oznámení se zobrazí nahoře na dashboardu." />
      <AnnouncementsManager items={items} openNew={sp.novy === "1"} reads={activity.announcements} people={activity.people} />
    </>
  );
}
