import { PageHeader } from "@/components/ui/misc";
import { getActivitySummary, getAdminPolls } from "@/lib/data/admin";
import { PollsManager } from "./polls-manager";

export const metadata = { title: "Hlasování" };

export default async function AdminPollsPage() {
  const [items, activity] = await Promise.all([getAdminPolls(), getActivitySummary()]);
  return (
    <>
      <PageHeader title="Hlasování" description="Ankety pro třídu – jedna možnost, více možností nebo krátká odpověď." />
      <PollsManager items={items} people={activity.people} />
    </>
  );
}
