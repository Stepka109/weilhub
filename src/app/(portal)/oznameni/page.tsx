import { CalendarDays, Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NOTICE_KIND, NoticeDateTile, isDated, noticeRelative, noticeWhen } from "@/components/portal/notice-meta";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAnnouncements, getReadAnnouncementIds } from "@/lib/data/portal";
import { formatDateTime, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/lib/types";

export const metadata = { title: "Oznámení" };

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const [items, read] = await Promise.all([getAnnouncements(), getReadAnnouncementIds(user.id)]);
  const unread = items.filter((a) => !read.has(a.id)).map((a) => a.id);
  // Otevřením stránky se oznámení počítají jako přečtená (přehled aktivity);
  // značka „Nové“ zůstane vidět do příští návštěvy
  if (unread.length) {
    const supabase = await createClient();
    await supabase
      .from("announcement_reads")
      .upsert(unread.map((id) => ({ user_id: user.id, announcement_id: id })), { onConflict: "user_id,announcement_id", ignoreDuplicates: true })
      .then(
        () => undefined,
        () => undefined,
      );
  }
  const today = todayIso();

  // Nahoře nadcházející události a termíny (podle data), pod nimi ostatní oznámení
  const upcoming = items
    .filter((a) => isDated(a) && a.event_date! >= today)
    .sort((a, b) => a.event_date!.localeCompare(b.event_date!) || (a.event_time ?? "").localeCompare(b.event_time ?? ""));
  const feed = items.filter((a) => !upcoming.includes(a));

  return (
    <>
      <PageHeader
        title="Oznámení"
        description={unread.length ? `Nová oznámení od minula: ${unread.length}.` : "Žádná nová oznámení od minula."}
      />

      {upcoming.length > 0 && (
        <section aria-labelledby="co-se-chysta" className="mb-8">
          <h2 id="co-se-chysta" className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink">
            <CalendarDays className="size-5 text-primary" aria-hidden /> Co se chystá
          </h2>
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <li key={a.id}>
                <NoticeCard a={a} unread={!read.has(a.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title="Zatím žádná oznámení" description="Důležité informace pro třídu se objeví tady." />
        </Card>
      ) : (
        feed.length > 0 && (
          <section aria-labelledby="vsechna-oznameni">
            {upcoming.length > 0 && (
              <h2 id="vsechna-oznameni" className="mb-3 text-lg font-semibold text-ink">
                Oznámení
              </h2>
            )}
            <ul className="space-y-4">
              {feed.map((a) => (
                <li key={a.id}>
                  <NoticeCard a={a} unread={!read.has(a.id)} />
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </>
  );
}

function NoticeCard({ a, unread }: { a: Announcement; unread: boolean }) {
  const dated = isDated(a);
  const rel = noticeRelative(a);
  const meta = dated ? NOTICE_KIND[a.kind as "event" | "deadline"] : null;
  return (
    <Card
      className={cn(
        "p-5 sm:p-6",
        a.priority === "important" && "border-rose-ink/20",
        unread && "ring-1 ring-primary/25",
        rel.past && "opacity-75",
      )}
    >
      <div className="flex gap-4">
        {dated && <NoticeDateTile notice={a} className={cn("hidden sm:flex", rel.past && "grayscale")} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {unread && (
              <Badge tone="solid">
                <span className="size-1.5 rounded-full bg-on-primary" aria-hidden /> Nové
              </Badge>
            )}
            {meta && (
              <Badge className={meta.badge}>
                <meta.icon aria-hidden /> {meta.label} · {noticeWhen(a)}
              </Badge>
            )}
            {rel.label && <Badge tone={rel.past ? "slate" : rel.soon ? "orange" : "outline"}>{rel.label}</Badge>}
            {a.priority === "important" && <Badge tone="red">Důležité</Badge>}
            {a.pinned && (
              <Badge tone="outline">
                <Pin aria-hidden /> Připnuto
              </Badge>
            )}
            {!dated && <span className="text-sm text-muted">{a.published_at ? formatDateTime(a.published_at) : ""}</span>}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-ink">{a.title}</h3>
          {a.body && <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-ink">{a.body}</p>}
        </div>
      </div>
    </Card>
  );
}
