-- =============================================================================
-- WeilHub – databázové schéma
-- Tabulky, typy, omezení a indexy. RLS politiky jsou v samostatné migraci.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Výčtové typy
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'editor', 'student');
create type public.account_status as enum ('pending', 'approved', 'blocked');
create type public.publication_status as enum ('draft', 'published', 'archived');
create type public.material_kind as enum ('note', 'file');
create type public.file_role as enum ('main', 'attachment', 'inline');
create type public.week_parity as enum ('all', 'odd', 'even');
create type public.timetable_exception_kind as enum (
  'cancelled', 'room_change', 'teacher_change', 'substitution', 'extra_lesson'
);
create type public.event_kind as enum ('school_event', 'holiday', 'other');
create type public.announcement_priority as enum ('normal', 'important');

-- -----------------------------------------------------------------------------
-- Pomocné funkce pro časové značky a autora
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  -- updated_by existuje u všech obsahových tabulek
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profily uživatelů (bez e-mailu – ten zůstává pouze v auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 80),
  avatar_path   text,
  role          public.app_role not null default 'student',
  status        public.account_status not null default 'pending',
  preferences   jsonb not null default '{}'::jsonb,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_role_status_idx on public.profiles (role, status);

-- -----------------------------------------------------------------------------
-- Pozvánky
-- -----------------------------------------------------------------------------
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (char_length(code) between 8 and 64),
  note        text check (char_length(note) <= 200),
  role        public.app_role not null default 'student' check (role in ('student', 'editor')),
  max_uses    integer not null default 1 check (max_uses between 1 and 500),
  used_count  integer not null default 0 check (used_count >= 0),
  expires_at  timestamptz,
  revoked     boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Nastavení portálu (jediný řádek)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id                           boolean primary key default true check (id),
  portal_name                  text not null default 'WeilHub' check (char_length(portal_name) between 1 and 60),
  portal_description           text not null default 'Všechno důležité ke studiu na jednom místě.'
                                 check (char_length(portal_description) <= 200),
  school_year                  text not null default '2026/2027' check (char_length(school_year) <= 20),
  class_label                  text not null default 'I1.M' check (char_length(class_label) <= 20),
  registration_enabled         boolean not null default true,
  registration_requires_invite boolean not null default true,
  auto_approve_invited         boolean not null default true,
  default_material_sort        text not null default 'newest'
                                 check (default_material_sort in ('newest', 'oldest', 'title')),
  allowed_file_types           text[] not null default array['pdf','docx','pptx','xlsx','txt','png','jpg','webp'],
  max_upload_mb                integer not null default 25 check (max_upload_mb between 1 and 50),
  odd_week_is_iso_odd          boolean not null default true,
  updated_at                   timestamptz not null default now(),
  updated_by                   uuid references public.profiles (id) on delete set null
);
insert into public.app_settings (id) values (true);

-- -----------------------------------------------------------------------------
-- Předměty a tematické okruhy
-- -----------------------------------------------------------------------------
create table public.subjects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 80),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  abbreviation  text not null check (char_length(abbreviation) between 1 and 10),
  teacher       text check (char_length(teacher) <= 120),
  color         text not null default 'blue'
                  check (color in ('blue','mint','yellow','lavender','red','sky','orange','slate')),
  icon          text not null default 'book-open' check (char_length(icon) <= 40),
  description   text check (char_length(description) <= 2000),
  is_archived   boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by    uuid references public.profiles (id) on delete set null
);
create index subjects_sort_idx on public.subjects (is_archived, sort_order, name);

create table public.subject_topics (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid not null references public.subjects (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  description  text check (char_length(description) <= 1000),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by   uuid references public.profiles (id) on delete set null,
  unique (subject_id, name)
);
create index subject_topics_subject_idx on public.subject_topics (subject_id, sort_order);

-- -----------------------------------------------------------------------------
-- Studijní materiály
-- -----------------------------------------------------------------------------
create table public.materials (
  id             uuid primary key default gen_random_uuid(),
  subject_id     uuid not null references public.subjects (id) on delete restrict,
  topic_id       uuid references public.subject_topics (id) on delete set null,
  title          text not null check (char_length(title) between 1 and 200),
  kind           public.material_kind not null default 'note',
  description    text check (char_length(description) <= 1000),
  content        jsonb,
  content_text   text not null default '',
  material_date  date,
  status         public.publication_status not null default 'draft',
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by     uuid references public.profiles (id) on delete set null
);
create index materials_subject_idx on public.materials (subject_id, status);
create index materials_status_published_idx on public.materials (status, published_at desc);
create index materials_topic_idx on public.materials (topic_id);

-- Tematický okruh musí patřit ke stejnému předmětu
create or replace function public.check_material_topic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.topic_id is not null and not exists (
    select 1 from public.subject_topics t
    where t.id = new.topic_id and t.subject_id = new.subject_id
  ) then
    raise exception 'Tematický okruh nepatří k vybranému předmětu.' using errcode = '23514';
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create table public.material_files (
  id            uuid primary key default gen_random_uuid(),
  material_id   uuid not null references public.materials (id) on delete cascade,
  role          public.file_role not null default 'attachment',
  storage_path  text not null check (storage_path ~ '^[a-z0-9/_.-]+$'),
  file_name     text not null check (char_length(file_name) between 1 and 255),
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid()
);
create index material_files_material_idx on public.material_files (material_id);
create index material_files_path_idx on public.material_files (storage_path);

create table public.material_favorites (
  user_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  material_id  uuid not null references public.materials (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, material_id)
);

-- -----------------------------------------------------------------------------
-- Domácí úkoly
-- -----------------------------------------------------------------------------
create table public.assignments (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.subjects (id) on delete restrict,
  title         text not null check (char_length(title) between 1 and 200),
  instructions  text not null default '' check (char_length(instructions) <= 10000),
  assigned_on   date not null default current_date,
  due_date      date not null,
  due_time      time,
  status        public.publication_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by    uuid references public.profiles (id) on delete set null,
  check (due_date >= assigned_on)
);
create index assignments_due_idx on public.assignments (status, due_date);
create index assignments_subject_idx on public.assignments (subject_id);

create table public.assignment_files (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  storage_path   text not null check (storage_path ~ '^[a-z0-9/_.-]+$'),
  file_name      text not null check (char_length(file_name) between 1 and 255),
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes > 0),
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid()
);
create index assignment_files_assignment_idx on public.assignment_files (assignment_id);
create index assignment_files_path_idx on public.assignment_files (storage_path);

create table public.assignment_materials (
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  material_id    uuid not null references public.materials (id) on delete cascade,
  primary key (assignment_id, material_id)
);

create table public.assignment_completions (
  user_id        uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  completed_at   timestamptz not null default now(),
  primary key (user_id, assignment_id)
);

-- -----------------------------------------------------------------------------
-- Testy a písemky
-- -----------------------------------------------------------------------------
create table public.exams (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects (id) on delete restrict,
  title       text not null check (char_length(title) between 1 and 200),
  exam_date   date not null,
  exam_time   time,
  scope       text not null default '' check (char_length(scope) <= 5000),
  notes       text not null default '' check (char_length(notes) <= 5000),
  status      public.publication_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by  uuid references public.profiles (id) on delete set null
);
create index exams_date_idx on public.exams (status, exam_date);
create index exams_subject_idx on public.exams (subject_id);

create table public.exam_materials (
  exam_id      uuid not null references public.exams (id) on delete cascade,
  material_id  uuid not null references public.materials (id) on delete cascade,
  primary key (exam_id, material_id)
);

-- -----------------------------------------------------------------------------
-- Rozvrh: pravidelné hodiny a jednorázové výjimky (oddělené tabulky)
-- -----------------------------------------------------------------------------
create table public.timetable_entries (
  id             uuid primary key default gen_random_uuid(),
  day_of_week    smallint not null check (day_of_week between 1 and 5),
  lesson_number  smallint check (lesson_number between 0 and 15),
  start_time     time not null,
  end_time       time not null,
  subject_id     uuid not null references public.subjects (id) on delete cascade,
  teacher        text check (char_length(teacher) <= 120),
  room           text check (char_length(room) <= 40),
  parity         public.week_parity not null default 'all',
  note           text check (char_length(note) <= 200),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by     uuid references public.profiles (id) on delete set null,
  check (end_time > start_time)
);
create index timetable_entries_day_idx on public.timetable_entries (day_of_week, start_time);

create table public.timetable_exceptions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  entry_id    uuid references public.timetable_entries (id) on delete cascade,
  kind        public.timetable_exception_kind not null,
  subject_id  uuid references public.subjects (id) on delete cascade,
  start_time  time,
  end_time    time,
  room        text check (char_length(room) <= 40),
  teacher     text check (char_length(teacher) <= 120),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by  uuid references public.profiles (id) on delete set null,
  -- Mimořádná hodina nemá vazbu na pravidelnou hodinu, ostatní změny ano
  check (
    (kind = 'extra_lesson' and entry_id is null and subject_id is not null
       and start_time is not null and end_time is not null and end_time > start_time)
    or (kind <> 'extra_lesson' and entry_id is not null)
  ),
  check (kind <> 'room_change' or room is not null),
  check (kind <> 'teacher_change' or teacher is not null),
  check (kind <> 'substitution' or subject_id is not null or teacher is not null)
);
create unique index timetable_exceptions_entry_date_uidx
  on public.timetable_exceptions (entry_id, date) where entry_id is not null;
create index timetable_exceptions_date_idx on public.timetable_exceptions (date);

-- -----------------------------------------------------------------------------
-- Školní akce a volné dny (kalendář)
-- -----------------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 200),
  kind         public.event_kind not null default 'school_event',
  start_date   date not null,
  end_date     date not null,
  start_time   time,
  description  text not null default '' check (char_length(description) <= 5000),
  status       public.publication_status not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by   uuid references public.profiles (id) on delete set null,
  check (end_date >= start_date)
);
create index events_dates_idx on public.events (status, start_date, end_date);

-- -----------------------------------------------------------------------------
-- Oznámení
-- -----------------------------------------------------------------------------
create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  body          text not null default '' check (char_length(body) <= 10000),
  priority      public.announcement_priority not null default 'normal',
  pinned        boolean not null default false,
  status        public.publication_status not null default 'draft',
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by    uuid references public.profiles (id) on delete set null
);
create index announcements_status_idx on public.announcements (status, pinned desc, published_at desc);

create or replace function public.set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create table public.announcement_reads (
  user_id          uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  read_at          timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

-- -----------------------------------------------------------------------------
-- Užitečné odkazy
-- -----------------------------------------------------------------------------
create table public.useful_links (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (char_length(description) <= 300),
  url          text not null check (url ~* '^https?://[^\s/$.?#].[^\s]*$' and char_length(url) <= 2000),
  icon         text not null default 'link' check (char_length(icon) <= 40),
  sort_order   integer not null default 0,
  is_visible   boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by   uuid references public.profiles (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Evidence administrativních akcí
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  entity      text not null,
  entity_id   text,
  summary     text,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- Triggery pro časové značky
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'subjects','subject_topics','materials','assignments','exams',
    'timetable_entries','timetable_exceptions','events','announcements','useful_links'
  ] loop
    execute format(
      'create trigger %I_set_updated before insert or update on public.%I
         for each row execute function public.set_updated_fields()', t, t);
  end loop;
end;
$$;

create trigger materials_check_topic before insert or update on public.materials
  for each row execute function public.check_material_topic();
create trigger announcements_published_at before insert or update on public.announcements
  for each row execute function public.set_published_at();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.touch_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_settings();
