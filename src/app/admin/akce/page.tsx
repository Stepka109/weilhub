import { PageHeader } from "@/components/ui/misc";
import { getAdminEvents } from "@/lib/data/admin";
import { EventsManager } from "./events-manager";

export const metadata = { title: "Akce a volné dny" };

export default async function AdminEventsPage() {
  const events = await getAdminEvents();
  return (
    <>
      <PageHeader
        title="Akce a volné dny"
        description="Školní akce, prázdniny a další události. Volné dny se promítnou i do rozvrhu a kalendáře."
      />
      <EventsManager events={events} />
    </>
  );
}
