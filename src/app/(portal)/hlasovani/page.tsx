import { Vote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PollCard } from "@/components/portal/poll-card";
import { requireUser } from "@/lib/auth";
import { getPolls } from "@/lib/data/portal";

export const metadata = { title: "Hlasování" };

export default async function PollsPage() {
  const user = await requireUser();
  const polls = await getPolls(user.id);
  const open = polls.filter((p) => p.open);
  const closed = polls.filter((p) => !p.open);

  return (
    <>
      <PageHeader title="Hlasování" description="Ankety pro třídu – hlasuj, svůj hlas můžeš do uzavření změnit." />
      {polls.length === 0 ? (
        <Card>
          <EmptyState icon={Vote} title="Zatím žádné hlasování" description="Až správce vytvoří anketu, objeví se tady i na nástěnce." />
        </Card>
      ) : (
        <div className="space-y-8">
          {open.length > 0 && (
            <section aria-labelledby="otevrena" className="space-y-4">
              <h2 id="otevrena" className="text-lg font-semibold text-ink">
                Otevřená
              </h2>
              {open.map((p) => (
                <PollCard key={p.id} poll={p} highlight={!p.myVote} />
              ))}
            </section>
          )}
          {closed.length > 0 && (
            <section aria-labelledby="uzavrena" className="space-y-4">
              <h2 id="uzavrena" className="text-lg font-semibold text-ink">
                Uzavřená
              </h2>
              {closed.map((p) => (
                <PollCard key={p.id} poll={p} />
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
