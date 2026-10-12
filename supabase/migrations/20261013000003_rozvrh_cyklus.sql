-- =============================================================================
-- WeilHub – rozvrh se střídáním týdnů (A → E → B → F) podle Family Station
--
-- Nahrazuje původní model (lichý/sudý týden + výjimky). Struktura:
--   timetable_periods        časy vyučovacích hodin (0.–15. hodina)
--   timetable_subjects       katalog předmětů (zkratka, název, výchozí vyučující)
--   timetable_teachers       seznam vyučujících
--   timetable_slots          výchozí rozvrh pro každý týden cyklu
--   timetable_overrides      změny pro konkrétní týden (supl., nová hodina, akce, odpadá)
--   timetable_day_overrides  celodenní záznamy (volno/svátek, celodenní akce)
-- Výchozí rozvrh se změnami nikdy nepřepisuje.
-- =============================================================================

drop table if exists public.timetable_exceptions cascade;
drop table if exists public.timetable_entries cascade;
drop type if exists public.timetable_exception_kind;
drop type if exists public.week_parity;

alter table public.app_settings drop column if exists odd_week_is_iso_odd;
alter table public.app_settings
  add column timetable_cycle text[] not null default array['A','E','B','F']
    check (array_length(timetable_cycle, 1) between 1 and 8),
  add column timetable_reference_monday date not null default '2026-09-14'
    check (extract(isodow from timetable_reference_monday) = 1),
  add column timetable_reference_week text not null default 'B'
    check (timetable_reference_week ~ '^[A-Z]$'),
  add column timetable_visible_from date not null default '2026-09-01',
  add column timetable_visible_to date not null default '2027-06-30',
  add constraint app_settings_timetable_period check (timetable_visible_to >= timetable_visible_from),
  add constraint app_settings_timetable_reference check (timetable_reference_week = any (timetable_cycle));

create type public.timetable_override_kind as enum ('changed', 'new', 'event', 'cancelled');
create type public.timetable_day_kind as enum ('holiday', 'event');

-- -----------------------------------------------------------------------------
-- Časy hodin
-- -----------------------------------------------------------------------------
create table public.timetable_periods (
  lesson_number  smallint primary key check (lesson_number between 0 and 15),
  start_time     time not null,
  end_time       time not null,
  check (end_time > start_time)
);

insert into public.timetable_periods (lesson_number, start_time, end_time) values
  (0, '07:10', '07:55'), (1, '08:00', '08:45'), (2, '08:50', '09:35'), (3, '09:55', '10:40'),
  (4, '10:45', '11:30'), (5, '11:35', '12:20'), (6, '12:25', '13:10'), (7, '13:15', '14:00'),
  (8, '14:05', '14:50'), (9, '14:55', '15:40'), (10, '15:45', '16:30'), (11, '16:35', '17:20'),
  (12, '17:25', '18:10'), (13, '18:15', '19:00'), (14, '19:05', '19:50'), (15, '19:55', '20:40');

-- -----------------------------------------------------------------------------
-- Katalog předmětů a vyučujících
-- -----------------------------------------------------------------------------
create table public.timetable_subjects (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9]{1,10}$'),
  name             text not null check (char_length(name) between 1 and 120),
  default_teacher  text check (char_length(default_teacher) <= 120),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by       uuid references public.profiles (id) on delete set null
);

create table public.timetable_teachers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by  uuid references public.profiles (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Výchozí rozvrh (pro každý týden cyklu zvlášť)
-- -----------------------------------------------------------------------------
create table public.timetable_slots (
  id             uuid primary key default gen_random_uuid(),
  cycle_week     text not null check (cycle_week ~ '^[A-Z]$'),
  day_of_week    smallint not null check (day_of_week between 1 and 5),
  lesson_number  smallint not null references public.timetable_periods (lesson_number),
  subject_code   text not null check (char_length(subject_code) between 1 and 10),
  subject_name   text not null check (char_length(subject_name) between 1 and 120),
  teacher        text check (char_length(teacher) <= 120),
  room           text check (char_length(room) <= 40),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by     uuid references public.profiles (id) on delete set null,
  unique (cycle_week, day_of_week, lesson_number)
);

-- -----------------------------------------------------------------------------
-- Změny pro konkrétní týden (week_start = pondělí daného týdne)
-- -----------------------------------------------------------------------------
create table public.timetable_overrides (
  id             uuid primary key default gen_random_uuid(),
  week_start     date not null check (extract(isodow from week_start) = 1),
  day_of_week    smallint not null check (day_of_week between 1 and 5),
  lesson_number  smallint not null references public.timetable_periods (lesson_number),
  kind           public.timetable_override_kind not null,
  subject_code   text check (char_length(subject_code) <= 10),
  subject_name   text check (char_length(subject_name) <= 120),
  title          text check (char_length(title) <= 120),
  teacher        text check (char_length(teacher) <= 120),
  room           text check (char_length(room) <= 40),
  note           text check (char_length(note) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by     uuid references public.profiles (id) on delete set null,
  unique (week_start, day_of_week, lesson_number),
  check (kind not in ('changed', 'new') or subject_code is not null),
  check (kind <> 'event' or coalesce(subject_code, title) is not null)
);
create index timetable_overrides_week_idx on public.timetable_overrides (week_start);

create table public.timetable_day_overrides (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique check (extract(isodow from date) between 1 and 5),
  kind        public.timetable_day_kind not null default 'holiday',
  title       text not null check (char_length(title) between 1 and 120),
  room        text check (char_length(room) <= 40),
  teacher     text check (char_length(teacher) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by  uuid references public.profiles (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Triggery (časové značky, audit)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'timetable_subjects','timetable_teachers','timetable_slots','timetable_overrides','timetable_day_overrides'
  ] loop
    execute format(
      'create trigger %I_set_updated before insert or update on public.%I
         for each row execute function public.set_updated_fields()', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.write_audit_log()', t, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security: číst smí schválení uživatelé, měnit jen redaktoři
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'timetable_periods','timetable_subjects','timetable_teachers','timetable_slots',
    'timetable_overrides','timetable_day_overrides'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy "%s: čtení" on public.%I for select to authenticated using (public.is_approved())', t, t);
    execute format(
      'create policy "%s: správa" on public.%I for all to authenticated
         using (public.is_staff()) with check (public.is_staff())', t, t);
  end loop;
end;
$$;
