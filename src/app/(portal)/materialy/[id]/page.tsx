import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Download, ExternalLink, FolderOpen, PenLine, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { FileList } from "@/components/portal/file-list";
import { RichText } from "@/components/portal/rich-text";
import { MaterialRow, SubjectBadge, materialType } from "@/components/portal/shared";
import { FavoriteButton } from "@/components/portal/toggles";
import { requireUser } from "@/lib/auth";
import { GroupBadge } from "@/components/portal/group-badge";
import { getFavoriteIds, getMaterial, getMaterials } from "@/lib/data/portal";
import { formatDate, formatTimestampDate } from "@/lib/dates";
import { fileTypeOf } from "@/lib/files";
import { formatBytes } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/materialy/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Materiál" };
  const m = await getMaterial(id);
  return { title: m?.title ?? "Materiál" };
}

export default async function MaterialDetailPage({ params }: PageProps<"/materialy/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [user, material] = await Promise.all([requireUser(), getMaterial(id)]);
  if (!material) notFound();

  const [favorites, related] = await Promise.all([
    getFavoriteIds(user.id),
    getMaterials({
      subjectId: material.subject_id,
      topicId: material.topic_id ?? undefined,
      limit: 6,
      group: user.profile.preferences?.studyGroup ?? null,
    }),
  ]);
  const type = materialType(material);
  const main = material.files.find((f) => f.role === "main");
  const attachments = material.files.filter((f) => f.role === "attachment");
  const mainType = main ? fileTypeOf(main.file_name) : undefined;
  const isStaff = user.profile.role !== "student";

  return (
    <>
      <PageHeader
        back={{ href: `/predmety/${material.subject.slug}`, label: material.subject.name }}
        title={material.title}
        description={material.description ?? undefined}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <SubjectBadge subject={material.subject} link />
            <GroupBadge group={material.study_group} className="h-6" />
            <Badge tone="outline">
              <type.icon aria-hidden /> {type.label}
            </Badge>
            {material.topic && (
              <Badge tone="outline">
                <FolderOpen aria-hidden /> {material.topic.name}
              </Badge>
            )}
          </div>
        }
        actions={
          <>
            <FavoriteButton materialId={material.id} favorite={favorites.has(material.id)} />
            {main && (
              <Button asChild>
                <a href={`/api/soubory/${main.id}`}>
                  <Download aria-hidden /> Stáhnout
                </a>
              </Button>
            )}
            {isStaff && (
              <Button asChild variant="outline">
                <Link href={`/admin/materialy/${material.id}`}>
                  <PenLine aria-hidden /> Upravit
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {material.kind === "note" && (
            <Card className="p-5 sm:p-8">
              <RichText doc={material.content} />
            </Card>
          )}

          {material.kind === "file" && main && (
            <Card className="overflow-hidden">
              {mainType?.inline === "pdf" ? (
                <>
                  <iframe
                    src={`/api/soubory/${main.id}?inline=1`}
                    title={`Náhled: ${main.file_name}`}
                    className="h-[75dvh] min-h-[480px] w-full bg-bg"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-sm text-muted">
                    <span className="truncate">{main.file_name}</span>
                    <a href={`/api/soubory/${main.id}?inline=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      Otevřít v novém okně <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </div>
                </>
              ) : mainType?.inline === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- soubor za autorizovanou routou
                <img src={`/api/soubory/${main.id}?inline=1`} alt={material.title} className="mx-auto max-h-[80dvh] w-auto" />
              ) : (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <span className="grid size-16 place-items-center rounded-2xl bg-light-blue font-display text-sm font-bold text-primary uppercase">
                    {mainType?.ext ?? "?"}
                  </span>
                  <p className="mt-4 font-semibold text-ink">{main.file_name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {mainType?.label ?? "Soubor"} · {formatBytes(main.size_bytes)}
                  </p>
                  <p className="mt-3 max-w-sm text-sm text-muted">
                    Tento typ souboru nelze bezpečně zobrazit přímo v prohlížeči. Stáhni si ho a otevři v příslušné aplikaci.
                  </p>
                  <Button asChild className="mt-5">
                    <a href={`/api/soubory/${main.id}`}>
                      <Download aria-hidden /> Stáhnout soubor
                    </a>
                  </Button>
                </div>
              )}
            </Card>
          )}

          {attachments.length > 0 && (
            <Card className="p-5 sm:p-6">
              <FileList files={attachments} />
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-ink">Informace</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 size-4 text-muted" aria-hidden />
                <div>
                  <dt className="text-muted">Autor</dt>
                  <dd className="font-medium text-ink">{material.author?.display_name ?? "Neznámý"}</dd>
                </div>
              </div>
              {material.material_date && (
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 text-muted" aria-hidden />
                  <div>
                    <dt className="text-muted">Datum materiálu</dt>
                    <dd className="font-medium text-ink">{formatDate(material.material_date)}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 size-4 text-muted" aria-hidden />
                <div>
                  <dt className="text-muted">Vytvořeno</dt>
                  <dd className="font-medium text-ink">{formatTimestampDate(material.created_at)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <PenLine className="mt-0.5 size-4 text-muted" aria-hidden />
                <div>
                  <dt className="text-muted">Poslední úprava</dt>
                  <dd className="font-medium text-ink">
                    {formatTimestampDate(material.updated_at)}
                    {material.editor && <span className="font-normal text-muted"> · {material.editor.display_name}</span>}
                  </dd>
                </div>
              </div>
            </dl>
          </Card>

          {related.filter((r) => r.id !== material.id).length > 0 && (
            <Card className="p-3">
              <h2 className="px-3 pt-2 pb-1 text-base font-semibold text-ink">Související materiály</h2>
              {related
                .filter((r) => r.id !== material.id)
                .slice(0, 5)
                .map((r) => (
                  <MaterialRow key={r.id} material={r} showSubject={false} />
                ))}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
