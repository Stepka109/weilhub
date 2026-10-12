import { ExternalLink, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, IconTile, PageHeader } from "@/components/ui/misc";
import { iconFor } from "@/components/icons/icon-registry";
import { getLinks } from "@/lib/data/portal";
import { isSafeExternalUrl } from "@/lib/utils";

export const metadata = { title: "Důležité odkazy" };

const TONES = ["bg-light-blue text-primary", "bg-mint text-mint-ink", "bg-yellow text-yellow-ink", "bg-lavender text-lavender-ink", "bg-sky text-sky-ink", "bg-orange text-orange-ink"];

export default async function LinksPage() {
  const links = (await getLinks()).filter((l) => isSafeExternalUrl(l.url));
  return (
    <>
      <PageHeader title="Důležité odkazy" description="Školní systémy a užitečné stránky na jednom místě." />
      {links.length === 0 ? (
        <Card>
          <EmptyState icon={Link2} title="Zatím žádné odkazy" />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((l, i) => (
            <li key={l.id}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="group block h-full">
                <Card interactive className="flex h-full items-start gap-4 p-5">
                  <IconTile icon={iconFor(l.icon, Link2)} className={TONES[i % TONES.length]} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-ink group-hover:text-primary">
                      {l.title}
                      <ExternalLink className="size-4 shrink-0 text-muted" aria-label="(otevře se v novém okně)" />
                    </p>
                    {l.description && <p className="mt-1 text-sm text-muted">{l.description}</p>}
                    <p className="mt-2 truncate text-xs text-muted">{new URL(l.url).hostname}</p>
                  </div>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
