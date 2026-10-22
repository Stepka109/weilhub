import Link from "next/link";
import { GroupBadge } from "@/components/portal/group-badge";
import {
  AlarmClock,
  CalendarCheck2,
  CircleAlert,
  Clock3,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  NotebookPen,
  Paperclip,
  Presentation,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/misc";
import { iconFor } from "@/components/icons/icon-registry";
import { subjectColor } from "@/lib/subject-style";
import { dueInfo, formatDate, formatDue, formatTimestampDate, type DueTone } from "@/lib/dates";
import { extensionOf } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { MaterialListItem } from "@/lib/data/portal";
import type { SubjectRef } from "@/lib/types";

export function SubjectBadge({ subject, link = false }: { subject: SubjectRef; link?: boolean }) {
  const c = subjectColor(subject.color);
  const badge = (
    <Badge className={cn(c.bg, c.ink)}>
      <span className={cn("size-1.5 rounded-full", c.dot)} aria-hidden />
      {subject.name}
    </Badge>
  );
  return link ? (
    <Link href={`/predmety/${subject.slug}`} className="rounded-full">
      {badge}
    </Link>
  ) : (
    badge
  );
}

export function SubjectIcon({ subject, size = "md" }: { subject: Pick<SubjectRef, "color" | "icon">; size?: "sm" | "md" | "lg" }) {
  const c = subjectColor(subject.color);
  return <IconTile icon={iconFor(subject.icon)} size={size} className={cn(c.bg, c.ink)} />;
}

const DUE_TONE: Record<DueTone, BadgeTone> = { overdue: "red", today: "orange", soon: "yellow", later: "slate" };
const DUE_ICON: Record<DueTone, typeof Clock3> = { overdue: CircleAlert, today: AlarmClock, soon: Clock3, later: CalendarCheck2 };

/** Štítek termínu – barva je vždy doplněna textem a ikonou. */
export function DueBadge({ date, completed }: { date: string; completed?: boolean }) {
  const info = dueInfo(date);
  if (completed) {
    return (
      <Badge tone="mint">
        <CalendarCheck2 aria-hidden /> Splněno
      </Badge>
    );
  }
  const Icon = DUE_ICON[info.tone];
  return (
    <Badge tone={DUE_TONE[info.tone]}>
      <Icon aria-hidden />
      {info.label}
    </Badge>
  );
}

export function DueText({ date, time }: { date: string; time: string | null }) {
  return <span>Termín: {formatDue(date, time)}</span>;
}

/** Typ materiálu odvozený od hlavního souboru (nebo zápis). */
export function materialType(m: { kind: MaterialListItem["kind"]; files: { file_name: string; role: string }[] }) {
  if (m.kind === "note") return { label: "Zápis", icon: NotebookPen, tone: "blue" as const };
  const main = m.files.find((f) => f.role === "main") ?? m.files[0];
  const ext = main ? extensionOf(main.file_name) : "";
  switch (ext) {
    case "pdf":
      return { label: "PDF", icon: FileText, tone: "red" as const };
    case "docx":
      return { label: "Word", icon: FileType2, tone: "sky" as const };
    case "pptx":
      return { label: "Prezentace", icon: Presentation, tone: "orange" as const };
    case "xlsx":
      return { label: "Tabulka", icon: FileSpreadsheet, tone: "mint" as const };
    case "png":
    case "jpg":
    case "webp":
      return { label: "Obrázek", icon: FileImage, tone: "lavender" as const };
    case "txt":
      return { label: "Text", icon: FileText, tone: "slate" as const };
    default:
      return { label: "Soubor", icon: Paperclip, tone: "slate" as const };
  }
}

export function MaterialRow({ material, showSubject = true }: { material: MaterialListItem; showSubject?: boolean }) {
  const t = materialType(material);
  const attachments = material.files.filter((f) => f.role === "attachment").length;
  return (
    <Link
      href={`/materialy/${material.id}`}
      className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-150 hover:bg-bg sm:px-4"
    >
      <IconTile
        icon={t.icon}
        className={cn(
          {
            blue: "bg-light-blue text-primary",
            red: "bg-rose text-rose-ink",
            sky: "bg-sky text-sky-ink",
            orange: "bg-orange text-orange-ink",
            mint: "bg-mint text-mint-ink",
            lavender: "bg-lavender text-lavender-ink",
            slate: "bg-slate-soft text-slate-ink",
          }[t.tone],
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink transition-colors group-hover:text-primary">{material.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
          <GroupBadge group={material.study_group} />
          <span>{t.label}</span>
          {showSubject && (
            <>
              <span aria-hidden>·</span>
              <span>{material.subject.name}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{formatTimestampDate(material.published_at ?? material.updated_at)}</span>
          {material.author && (
            <>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">{material.author.display_name}</span>
            </>
          )}
          {attachments > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3.5" aria-hidden />
              {attachments}
            </span>
          )}
        </p>
      </div>
      {material.material_date && (
        <span className="hidden shrink-0 text-sm text-muted md:block">{formatDate(material.material_date)}</span>
      )}
    </Link>
  );
}
