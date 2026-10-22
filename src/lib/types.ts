/** Datové typy odpovídající databázovému schématu (supabase/migrations). */

export type AppRole = "admin" | "editor" | "student";
export type AccountStatus = "pending" | "approved" | "blocked";
export type PublicationStatus = "draft" | "published" | "archived";
export type MaterialKind = "note" | "file";
export type FileRole = "main" | "attachment" | "inline";
export type EventKind = "school_event" | "holiday" | "other";
export type AnnouncementPriority = "normal" | "important";
export type SubjectColor = "blue" | "mint" | "yellow" | "lavender" | "red" | "sky" | "orange" | "slate";

export interface Profile {
  id: string;
  display_name: string;
  avatar_path: string | null;
  role: AppRole;
  status: AccountStatus;
  preferences: UserPreferences;
  approved_at: string | null;
  created_at: string;
}

export interface UserPreferences {
  hideCompleted?: boolean;
  compactLists?: boolean;
  /** Skupina u dělených předmětů (S1 / S2) */
  studyGroup?: "S1" | "S2" | null;
}

export interface AppSettings {
  portal_name: string;
  portal_description: string;
  school_year: string;
  class_label: string;
  registration_enabled: boolean;
  registration_requires_invite: boolean;
  auto_approve_invited: boolean;
  default_material_sort: "newest" | "oldest" | "title";
  allowed_file_types: string[];
  max_upload_mb: number;
  timetable_cycle: string[];
  timetable_reference_monday: string;
  timetable_reference_week: string;
  timetable_visible_from: string;
  timetable_visible_to: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  slug: string;
  abbreviation: string;
  teacher: string | null;
  color: SubjectColor;
  icon: string;
  description: string | null;
  is_archived: boolean;
  /** Předmět se učí zvlášť ve skupinách S1 a S2 */
  has_groups: boolean;
  /** Vyučující skupiny S1 / S2 (null = stejný jako u předmětu) */
  teacher_s1: string | null;
  teacher_s2: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SubjectRef = Pick<Subject, "id" | "name" | "slug" | "abbreviation" | "color" | "icon">;

/** Skupina u obsahu děleného předmětu (null = obě skupiny). */
export type StudyGroup = "S1" | "S2";

export interface SubjectTopic {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface Material {
  id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  kind: MaterialKind;
  description: string | null;
  content: TiptapNode | null;
  content_text: string;
  material_date: string | null;
  study_group: StudyGroup | null;
  status: PublicationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface StoredFile {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface MaterialFile extends StoredFile {
  material_id: string;
  role: FileRole;
}

export interface AssignmentFile extends StoredFile {
  assignment_id: string;
}

export interface Assignment {
  id: string;
  subject_id: string;
  title: string;
  instructions: string;
  assigned_on: string;
  due_date: string;
  due_time: string | null;
  study_group: StudyGroup | null;
  status: PublicationStatus;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  subject_id: string;
  title: string;
  exam_date: string;
  exam_time: string | null;
  scope: string;
  notes: string;
  study_group: StudyGroup | null;
  status: PublicationStatus;
  created_at: string;
  updated_at: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  kind: EventKind;
  start_date: string;
  end_date: string;
  start_time: string | null;
  description: string;
  status: PublicationStatus;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  pinned: boolean;
  status: PublicationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsefulLink {
  id: string;
  title: string;
  description: string | null;
  url: string;
  icon: string;
  sort_order: number;
  is_visible: boolean;
}

export interface Invitation {
  id: string;
  code: string;
  note: string | null;
  role: AppRole;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: "insert" | "update" | "delete";
  entity: string;
  entity_id: string | null;
  summary: string | null;
  created_at: string;
}

/** Jednotný výsledek server actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
