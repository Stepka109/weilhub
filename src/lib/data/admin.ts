import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIso } from "@/lib/dates";
import type {
  Announcement,
  Assignment,
  AssignmentFile,
  AuditLog,
  Exam,
  Invitation,
  Material,
  MaterialFile,
  Profile,
  SchoolEvent,
  Subject,
  SubjectRef,
  SubjectTopic,
  UsefulLink,
} from "@/lib/types";

/** Dotazy administrace – vidí i koncepty (RLS je povolí jen redaktorům). */

const SUBJECT_REF = "subject:subjects(id, name, slug, abbreviation, color, icon)";

export async function getAdminStats() {
  const supabase = await createClient();
  const today = todayIso();
  const [subjects, materials, assignments, exams, users, drafts] = await Promise.all([
    supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("materials").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("assignments").select("id", { count: "exact", head: true }).eq("status", "published").gte("due_date", today),
    supabase.from("exams").select("id", { count: "exact", head: true }).eq("status", "published").gte("exam_date", today),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("materials").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  return {
    subjects: subjects.count ?? 0,
    materials: materials.count ?? 0,
    assignments: assignments.count ?? 0,
    exams: exams.count ?? 0,
    users: users.count ?? 0,
    drafts: drafts.count ?? 0,
  };
}

export async function getAllSubjects(): Promise<(Subject & { topics: SubjectTopic[] })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*, topics:subject_topics(*)")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as (Subject & { topics: SubjectTopic[] })[]).map((s) => ({
    ...s,
    topics: [...s.topics].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "cs")),
  }));
}

export type AdminMaterialRow = Pick<Material, "id" | "title" | "kind" | "status" | "updated_at" | "created_at" | "subject_id"> & {
  subject: SubjectRef | null;
  author: { display_name: string } | null;
  files: Pick<MaterialFile, "file_name" | "role">[];
};

export async function getAdminMaterials(limit?: number): Promise<AdminMaterialRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("materials")
    .select(`id, title, kind, status, updated_at, created_at, subject_id, ${SUBJECT_REF}, author:profiles!materials_created_by_fkey(display_name), files:material_files(file_name, role)`)
    .order("updated_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AdminMaterialRow[];
}

export async function getAdminMaterial(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("materials").select("*, files:material_files(*)").eq("id", id).maybeSingle();
  return data as (Material & { files: MaterialFile[] }) | null;
}

/** Krátký seznam materiálů pro výběr souvisejících položek. */
export async function getMaterialOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select("id, title, status, subject_id")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(500);
  return (data ?? []) as { id: string; title: string; status: string; subject_id: string }[];
}

export async function getAdminAssignments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(`*, ${SUBJECT_REF}, files:assignment_files(id), materials:assignment_materials(material_id)`)
    .order("due_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (Assignment & { subject: SubjectRef | null; files: { id: string }[]; materials: { material_id: string }[] })[];
}

export async function getAdminAssignment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select("*, files:assignment_files(*), materials:assignment_materials(material_id)")
    .eq("id", id)
    .maybeSingle();
  return data as (Assignment & { files: AssignmentFile[]; materials: { material_id: string }[] }) | null;
}

export async function getAdminExams() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .select(`*, ${SUBJECT_REF}, materials:exam_materials(material_id)`)
    .order("exam_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (Exam & { subject: SubjectRef | null; materials: { material_id: string }[] })[];
}

export async function getAdminEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SchoolEvent[];
}

export async function getAdminAnnouncements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function getAdminLinks() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("useful_links").select("*").order("sort_order").order("title");
  if (error) throw error;
  return (data ?? []) as UsefulLink[];
}

export interface AdminUser extends Profile {
  email: string | null;
  last_sign_in_at: string | null;
}

/**
 * Seznam uživatelů. Profily čte admin přes RLS; e-maily (uložené jen
 * v auth.users) se doplní servisním klientem, pokud je nastaven.
 */
export async function getAdminUsers(): Promise<{ users: AdminUser[]; emailsAvailable: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const admin = createAdminClient();
  const emails = new Map<string, { email: string | null; last: string | null }>();
  if (admin) {
    for (let page = 1; page <= 10; page++) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listError || !list) break;
      for (const u of list.users) emails.set(u.id, { email: u.email ?? null, last: u.last_sign_in_at ?? null });
      if (list.users.length < 200) break;
    }
  }
  return {
    emailsAvailable: Boolean(admin),
    users: ((data ?? []) as Profile[]).map((p) => ({
      ...p,
      email: emails.get(p.id)?.email ?? null,
      last_sign_in_at: emails.get(p.id)?.last ?? null,
    })),
  };
}

export async function getInvitations() {
  const supabase = await createClient();
  const { data } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Invitation[];
}

export async function getAuditLogs(limit = 30) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as (AuditLog & { actor: { display_name: string } | null })[];
}
