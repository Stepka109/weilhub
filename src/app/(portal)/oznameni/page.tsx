import { Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MarkReadButton } from "@/components/portal/mark-read";
import { requireUser } from "@/lib/auth";
import { getAnnouncements, getReadAnnouncementIds } from "@/lib/data/portal";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Oznámení" };

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const [items, read] = await Promise.all([getAnnouncements(), getReadAnnouncementIds(user.id)]);
  const unread = items.filter((a) => !read.has(a.id)).map((a) => a.id);

  return (
    <>
      <PageHeader
        title="Oznámení"
        description={unread.length ? `Máš ${unread.length} nepřečtených oznámení.` : "Všechna oznámení máš přečtená."}
        actions={<MarkReadButton ids={unread} />}
      />
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title="Zatím žádná oznámení" description="Důležité informace pro třídu se objeví tady." />
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map((a) => {
            const isUnread = !read.has(a.id);
            return (
              <li key={a.id}>
                <Card className={cn("p-5 sm:p-6", a.priority === "important" && "border-rose-ink/20", isUnread && "ring-1 ring-primary/25")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {isUnread && (
                      <Badge tone="solid">
                        <span className="size-1.5 rounded-full bg-white" aria-hidden /> Nové
                      </Badge>
                    )}
                    {a.priority === "important" && <Badge tone="red">Důležité</Badge>}
                    {a.pinned && (
                      <Badge tone="outline">
                        <Pin aria-hidden /> Připnuto
                      </Badge>
                    )}
                    <span className="text-sm text-muted">{a.published_at ? formatDateTime(a.published_at) : ""}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-ink">{a.title}</h2>
                  {a.body && <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-ink">{a.body}</p>}
                  {isUnread && (
                    <div className="mt-4 -ml-2">
                      <MarkReadButton ids={[a.id]} label="Označit jako přečtené" small />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
