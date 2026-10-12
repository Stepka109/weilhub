import { z } from "zod";
import { SUBJECT_COLOR_KEYS } from "@/lib/subject-style";
import { PICKABLE_ICONS } from "@/components/icons/icon-registry";
import { isSafeExternalUrl } from "@/lib/utils";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maximálně ${max} znaků.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Zadejte platné datum.");
const optionalDate = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Zadejte platné datum.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Zadejte čas ve formátu 8:00.");
const optionalTime = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d(:00)?)?$/, "Zadejte čas ve formátu 8:00.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const publicationStatus = z.enum(["draft", "published", "archived"]);
const iconKey = z.string().refine((v) => v in PICKABLE_ICONS, "Vyberte ikonku z nabídky.");
const uuid = z.uuid("Neplatný výběr.");

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název předmětu.").max(80),
  abbreviation: z.string().trim().min(1, "Zadejte zkratku.").max(10, "Zkratka může mít nejvýše 10 znaků."),
  slug: z
    .string()
    .trim()
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Pouze malá písmena bez diakritiky, číslice a pomlčky.")
    .max(60)
    .optional(),
  teacher: optionalText(120),
  color: z.enum(SUBJECT_COLOR_KEYS as [string, ...string[]]),
  icon: iconKey,
  description: optionalText(2000),
  is_archived: z.boolean(),
});

export const topicSchema = z.object({
  subject_id: uuid,
  name: z.string().trim().min(1, "Zadejte název tématu.").max(120),
  description: optionalText(1000),
});

export const materialSchema = z
  .object({
    title: z.string().trim().min(1, "Zadejte název materiálu.").max(200),
    subject_id: uuid,
    topic_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(uuid.nullable())
      .nullable()
      .optional(),
    kind: z.enum(["note", "file"]),
    description: optionalText(1000),
    content: z.unknown().optional(),
    material_date: optionalDate,
    status: publicationStatus,
  });

export const assignmentSchema = z
  .object({
    title: z.string().trim().min(1, "Zadejte název úkolu.").max(200),
    subject_id: uuid,
    instructions: z.string().trim().max(10000, "Zadání je příliš dlouhé."),
    assigned_on: date,
    due_date: date,
    due_time: optionalTime,
    status: publicationStatus,
    material_ids: z.array(uuid).max(50).default([]),
  })
  .refine((v) => v.due_date >= v.assigned_on, { message: "Termín nemůže být dříve než datum zadání.", path: ["due_date"] });

export const examSchema = z.object({
  title: z.string().trim().min(1, "Zadejte název testu.").max(200),
  subject_id: uuid,
  exam_date: date,
  exam_time: optionalTime,
  scope: z.string().trim().max(5000),
  notes: z.string().trim().max(5000),
  status: publicationStatus,
  material_ids: z.array(uuid).max(50).default([]),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Zadejte název.").max(200),
    kind: z.enum(["school_event", "holiday", "other"]),
    start_date: date,
    end_date: date,
    start_time: optionalTime,
    description: z.string().trim().max(5000),
    status: publicationStatus,
  })
  .refine((v) => v.end_date >= v.start_date, { message: "Konec nemůže být před začátkem.", path: ["end_date"] });

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Zadejte nadpis.").max(200),
  body: z.string().trim().max(10000),
  priority: z.enum(["normal", "important"]),
  pinned: z.boolean(),
  status: publicationStatus,
});

export const linkSchema = z.object({
  title: z.string().trim().min(1, "Zadejte název.").max(120),
  description: optionalText(300),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine(isSafeExternalUrl, "Zadejte platnou adresu začínající https:// nebo http://."),
  icon: iconKey,
  is_visible: z.boolean(),
});

export const settingsSchema = z.object({
  portal_name: z.string().trim().min(1, "Zadejte název.").max(60),
  portal_description: z.string().trim().max(200),
  school_year: z.string().trim().regex(/^\d{4}\/\d{4}$/, "Formát 2026/2027."),
  class_label: z.string().trim().min(1, "Zadejte označení třídy.").max(20),
  registration_enabled: z.boolean(),
  registration_requires_invite: z.boolean(),
  auto_approve_invited: z.boolean(),
  default_material_sort: z.enum(["newest", "oldest", "title"]),
  allowed_file_types: z.array(z.enum(["pdf", "docx", "pptx", "xlsx", "txt", "png", "jpg", "webp"])).min(1, "Povolte alespoň jeden typ."),
  max_upload_mb: z.coerce.number().int().min(1).max(50, "Maximum je 50 MB (limit úložiště)."),
});

export const invitationSchema = z.object({
  note: optionalText(200),
  role: z.enum(["student", "editor"]),
  max_uses: z.coerce.number().int().min(1).max(500),
  expires_in_days: z.coerce.number().int().min(0).max(365),
});
