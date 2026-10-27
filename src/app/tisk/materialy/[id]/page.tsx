import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { RichText } from "@/components/portal/rich-text";
import { PrintToolbar } from "@/components/portal/print-toolbar";
import { requireUser } from "@/lib/auth";
import { getMaterial } from "@/lib/data/portal";
import { formatDate, formatTimestampDate, todayIso } from "@/lib/dates";

export async function generateMetadata({ params }: PageProps<"/tisk/materialy/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Zápis" };
  const m = await getMaterial(id);
  // Název stránky je zároveň výchozí název PDF souboru
  return { title: { absolute: m ? `${m.subject.name} – ${m.title}` : "Zápis" } };
}

/**
 * Tisková podoba zápisu → „Uložit jako PDF“ v prohlížeči. Text zůstane
 * ostrý a označitelný, vzorce, tabulky i obrázky se vykreslí stejně jako na webu.
 */
export default async function PrintMaterialPage({ params }: PageProps<"/tisk/materialy/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireUser();
  const material = await getMaterial(id);
  if (!material) notFound();
  if (material.kind !== "note") redirect(`/materialy/${material.id}`);

  const attachments = material.files.filter((f) => f.role === "attachment");
  const meta = [
    material.author?.display_name,
    material.material_date ? formatDate(material.material_date) : null,
    `upraveno ${formatTimestampDate(material.updated_at)}`,
  ].filter(Boolean);

  return (
    <main className="wh-print">
      <PrintToolbar backHref={`/materialy/${material.id}`} />
      <article className="wh-print-page">
        <header className="wh-print-header">
          <p className="wh-print-eyebrow">
            {material.subject.name}
            {material.study_group && ` · skupina ${material.study_group}`}
            {material.topic && ` · ${material.topic.name}`}
          </p>
          <h1>{material.title}</h1>
          {material.description && <p className="wh-print-desc">{material.description}</p>}
          <p className="wh-print-meta">{meta.join(" · ")}</p>
        </header>

        <RichText doc={material.content} />

        {attachments.length > 0 && (
          <section className="wh-print-attachments">
            <h2>Přílohy (ke stažení ve WeilHubu)</h2>
            <ul>
              {attachments.map((f) => (
                <li key={f.id}>{f.file_name}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="wh-print-footer">Staženo z WeilHubu {formatDate(todayIso())}</footer>
      </article>
    </main>
  );
}
