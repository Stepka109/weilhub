import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayIso, shiftDate } from "@/lib/dates";
import type {
  Announcement,
  AppSettings,
  Assignment,
  AssignmentFile,
  Exam,
  Material,
  MaterialFile,
  SchoolEvent,
  Subject,
  SubjectRef,
  SubjectTopic,
  UsefulLink,
} from "@/lib/types";

/**
 * Čtecí dotazy studentského portálu. Všechny běží s relací uživatele,
 * takže viditelnost (publikováno / koncept) vynucuje databáze (RLS).
 * Navíc explicitně filtrujeme publikovaný obsah, aby i redaktoři viděli
 * v portálu totéž co studenti.
 */

const SUBJECT_REF = "subject:subjects!inner(id, name, slug, abbreviation, color, icon)";

export type WithSubject<T> = T & { subject: SubjectRef };
export type MaterialListItem = WithSubject<
  Pick<Material, "id" | "title" | "kind" | "description" | "material_date" | "published_at" | "updated_at" | "topic_id">
> & { author: { display_name: string } | null; files: Pick<MaterialFile, "mime_type" | "file_name" | "role">[] };

export const getSettings = cache(async (): Promise<AppSettings | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").single();
  return (data as AppSettings | null) ?? null;
});

export async function getSubjects(): Promise<(Subject & { material_count: number })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*, materials(count)")
    .eq("is_archived", false)
    .eq("materials.status", "published")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((s) => {
    const { materials, ...rest } = s as Subject & { materials: { count: number }[] };
    return { ...rest, material_count: materials?.[0]?.count ?? 0 };
  });
}

export async function getSubjectBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("subjects").select("*").eq("slug", slug).eq("is_archived", false).maybeSingle();
  return data as Subject | null;
}

export async function getTopics(subjectId: string): Promise<SubjectTopic[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("subject_topics").select("*").eq("subject_id", subjectId).order("sort_order").order("name");
  return (data ?? []) as SubjectTopic[];
}

const MATERIAL_LIST =
  `id, title, kind, description, material_date, published_at, updated_at, topic_id, ${SUBJECT_REF}, ` +
  "author:profiles!materials_created_by_fkey(display_name), files:material_files(mime_type, file_name, role)";

export async function getMaterials(opts: {
  subjectId?: string;
  topicId?: string;
  kind?: "note" | "file";
  sort?: "newest" | "oldest" | "title";
  limit?: number;
  ids?: string[];
} = {}): Promise<MaterialListItem[]> {
  const supabase = await createClient();
  let q = supabase.from("materials").select(MATERIAL_LIST).eq("status", "published");
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  if (opts.topicId) q = q.eq("topic_id", opts.topicId);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.ids) q = q.in("id", opts.ids.length ? opts.ids : ["00000000-0000-0000-0000-000000000000"]);
  if (opts.sort === "title") q = q.order("title");
  else q = q.order("published_at", { ascending: opts.sort === "oldest", nullsFirst: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as MaterialListItem[];
}

export async function getMaterial(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select(
      `*, ${SUBJECT_REF}, topic:subject_topics(id, name), author:profiles!materials_created_by_fkey(display_name), ` +
        "editor:profiles!materials_updated_by_fkey(display_name), files:material_files(*)",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data as unknown as
    | (WithSubject<Material> & {
        topic: Pick<SubjectTopic, "id" | "name"> | null;
        author: { display_name: string } | null;
        editor: { display_name: string } | null;
        files: MaterialFile[];
      })
    | null;
}

export async function getFavoriteIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("material_favorites").select("material_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.material_id as string));
}

export type AssignmentListItem = WithSubject<Assignment> & {
  files: Pick<AssignmentFile, "id" | "file_name">[];
  completed: boolean;
};

export async function getAssignments(
  userId: string,
  opts: { subjectId?: string; from?: string; limit?: number; onlyOpen?: boolean } = {},
): Promise<AssignmentListItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("assignments")
    .select(`*, ${SUBJECT_REF}, files:assignment_files(id, file_name)`)
    .eq("status", "published")
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false });
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  if (opts.from) q = q.gte("due_date", opts.from);
  const [{ data, error }, completions] = await Promise.all([
    q,
    supabase.from("assignment_completions").select("assignment_id").eq("user_id", userId),
  ]);
  if (error) throw error;
  const done = new Set((completions.data ?? []).map((c) => c.assignment_id as string));
  let items = ((data ?? []) as unknown as WithSubject<Assignment & { files: AssignmentFile[] }>[]).map((a) => ({
    ...a,
    completed: done.has(a.id),
  }));
  if (opts.onlyOpen) items = items.filter((a) => !a.completed);
  return opts.limit ? items.slice(0, opts.limit) : items;
}

export async function getAssignment(id: string, userId: string) {
  const supabase = await createClient();
  const [{ data }, completion, related] = await Promise.all([
    supabase
      .from("assignments")
      .select(`*, ${SUBJECT_REF}, files:assignment_files(*)`)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle(),
    supabase.from("assignment_completions").select("completed_at").eq("assignment_id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("assignment_materials").select("material_id").eq("assignment_id", id),
  ]);
  if (!data) return null;
  const materialIds = (related.data ?? []).map((r) => r.material_id as string);
  return {
    ...(data as unknown as WithSubject<Assignment> & { files: AssignmentFile[] }),
    completedAt: (completion.data?.completed_at as string | undefined) ?? null,
    materials: materialIds.length ? await getMaterials({ ids: materialIds }) : [],
  };
}

export type ExamListItem = WithSubject<Exam> & { materials: { material: { id: string; title: string; status: string } | null }[] };

export async function getExams(opts: { subjectId?: string; upcoming?: boolean; limit?: number } = {}): Promise<ExamListItem[]> {
  const supabase = await createClient();
  const today = todayIso();
  let q = supabase
    .from("exams")
    .select(`*, ${SUBJECT_REF}, materials:exam_materials(material:materials(id, title, status))`)
    .eq("status", "published");
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  if (opts.upcoming === true) q = q.gte("exam_date", today).order("exam_date").order("exam_time", { nullsFirst: false });
  else if (opts.upcoming === false) q = q.lt("exam_date", today).order("exam_date", { ascending: false });
  else q = q.order("exam_date");
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  // Odkazy jen na publikované materiály
  return ((data ?? []) as unknown as ExamListItem[]).map((e) => ({
    ...e,
    materials: e.materials.filter((m) => m.material && m.material.status === "published"),
  }));
}

export async function getAnnouncements(opts: { limit?: number } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function getReadAnnouncementIds(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("announcement_reads").select("announcement_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.announcement_id as string));
}

export const getUnreadCount = cache(async (userId: string) => {
  const supabase = await createClient();
  const [{ data: all }, read] = await Promise.all([
    supabase.from("announcements").select("id").eq("status", "published"),
    getReadAnnouncementIds(userId),
  ]);
  return (all ?? []).filter((a) => !read.has(a.id as string)).length;
});

export async function getLinks(): Promise<UsefulLink[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("useful_links").select("*").eq("is_visible", true).order("sort_order").order("title");
  return (data ?? []) as UsefulLink[];
}

export interface CalendarItem {
  id: string;
  kind: "exam" | "assignment" | "school_event" | "holiday" | "other";
  title: string;
  date: string;
  endDate: string;
  time: string | null;
  subject: SubjectRef | null;
  description: string;
  href: string | null;
}

/** Společný kalendář: testy, termíny úkolů, akce a volné dny. */
export async function getCalendarItems(from: string, to: string): Promise<CalendarItem[]> {
  const supabase = await createClient();
  const [exams, assignments, events] = await Promise.all([
    supabase.from("exams").select(`id, title, exam_date, exam_time, scope, ${SUBJECT_REF}`).eq("status", "published").gte("exam_date", from).lte("exam_date", to),
    supabase.from("assignments").select(`id, title, due_date, due_time, instructions, ${SUBJECT_REF}`).eq("status", "published").gte("due_date", from).lte("due_date", to),
    supabase.from("events").select("*").eq("status", "published").lte("start_date", to).gte("end_date", from),
  ]);
  const { data: ttDays } = await supabase.from("timetable_day_overrides").select("*").gte("date", from).lte("date", to);
  const items: CalendarItem[] = [];
  for (const e of (exams.data ?? []) as unknown as (Exam & { subject: SubjectRef })[]) {
    items.push({ id: e.id, kind: "exam", title: e.title, date: e.exam_date, endDate: e.exam_date, time: e.exam_time, subject: e.subject, description: e.scope, href: `/testy#test-${e.id}` });
  }
  for (const a of (assignments.data ?? []) as unknown as (Assignment & { subject: SubjectRef })[]) {
    items.push({ id: a.id, kind: "assignment", title: a.title, date: a.due_date, endDate: a.due_date, time: a.due_time, subject: a.subject, description: a.instructions, href: `/ukoly/${a.id}` });
  }
  for (const ev of (events.data ?? []) as SchoolEvent[]) {
    items.push({ id: ev.id, kind: ev.kind, title: ev.title, date: ev.start_date, endDate: ev.end_date, time: ev.start_time, subject: null, description: ev.description, href: null });
  }
  for (const d of (ttDays ?? []) as { id: string; date: string; kind: "holiday" | "event"; title: string; room: string | null; teacher: string | null }[]) {
    items.push({
      id: d.id,
      kind: d.kind === "event" ? "school_event" : "holiday",
      title: d.title,
      date: d.date,
      endDate: d.date,
      time: null,
      subject: null,
      description: [d.room, d.teacher].filter(Boolean).join(" · "),
      href: `/rozvrh?tyden=${d.date}`,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}

export function upcomingWindow(days = 60) {
  const today = todayIso();
  return { from: today, to: shiftDate(today, days) };
}
