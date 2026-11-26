import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SubjectRef, TiptapNode } from "@/lib/types";

const SUBJECT = "subject:subjects(id, name, slug, abbreviation, color, icon)";

export interface NoteListItem {
  id: string;
  title: string;
  lesson_date: string | null;
  shared: boolean;
  updated_at: string;
  preview: string;
  subject: SubjectRef | null;
}

export interface NoteFull extends NoteListItem {
  user_id: string;
  subject_id: string | null;
  content: TiptapNode;
}

export interface SharedNote extends NoteFull {
  author: string;
  shared_at: string | null;
}

const preview = (text: string | null) => (text ?? "").slice(0, 180);

/** Moje poznámky (nejnovější nahoře). */
export async function getMyNotes(userId: string): Promise<NoteListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select(`id, title, lesson_date, shared, updated_at, content_text, ${SUBJECT}`)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(500);
  return (data ?? []).map(({ content_text, ...n }) => ({ ...(n as unknown as NoteListItem), preview: preview(content_text) }));
}

/** Jedna poznámka – vlastní, nebo (pro redaktora) sdílená. RLS hlídá přístup. */
export async function getNote(id: string): Promise<NoteFull | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select(`id, user_id, subject_id, title, lesson_date, shared, updated_at, content, content_text, ${SUBJECT}`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { content_text, ...n } = data as unknown as NoteFull & { content_text: string };
  return { ...n, preview: preview(content_text) };
}

/** Sdílené poznámky žáků pro správce (filtr předmět / den hodiny). */
export async function getSharedNotes(opts: { subjectId?: string | null; date?: string | null } = {}): Promise<SharedNote[]> {
  const supabase = await createClient();
  let q = supabase
    .from("notes")
    .select(`id, user_id, subject_id, title, lesson_date, shared, shared_at, updated_at, content, content_text, ${SUBJECT}, author:profiles!notes_user_id_fkey(display_name)`)
    .eq("shared", true)
    .order("lesson_date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  if (opts.date) q = q.eq("lesson_date", opts.date);
  const { data } = await q;
  return (data ?? []).map((row) => {
    const { content_text, author, ...n } = row as unknown as SharedNote & { content_text: string; author: { display_name: string } | null };
    return { ...n, preview: preview(content_text), author: author?.display_name ?? "Neznámý žák" };
  });
}
