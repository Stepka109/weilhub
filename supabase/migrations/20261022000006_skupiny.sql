-- =============================================================================
-- WeilHub – dělení třídy na skupiny S1 a S2
--
-- Dosavadní rozvrh i obsah dělených předmětů patří skupině S2. Migrace:
--  1) přidá skupinu k hodinám rozvrhu a k týdenním změnám
--     ('all' = celá třída, 'S1', 'S2'),
--  2) označí dosavadní hodiny dělených předmětů jako S2,
--  3) doplní rozvrh skupiny S1 (stálý rozvrh z Bakalářů, učitelé zatím
--     stejní jako u S2),
--  4) přidá předmětům příznak „dělí se na skupiny“ a materiálům, úkolům
--     a testům skupinu (prázdná = obě skupiny); dosavadní obsah dělených
--     předmětů patří S2.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Rozvrh: skupina hodiny a změny
-- -----------------------------------------------------------------------------
alter table public.timetable_slots
  add column study_group text not null default 'all' check (study_group in ('all', 'S1', 'S2'));
alter table public.timetable_overrides
  add column study_group text not null default 'all' check (study_group in ('all', 'S1', 'S2'));

-- Jedinečnost pozice nově včetně skupiny (název původního omezení se dohledá)
do $$
declare r record;
begin
  for r in
    select con.conrelid::regclass as tbl, con.conname from pg_constraint con
    where con.conrelid in ('public.timetable_slots'::regclass, 'public.timetable_overrides'::regclass)
      and con.contype = 'u'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end;
$$;
alter table public.timetable_slots
  add constraint timetable_slots_position_key unique (cycle_week, day_of_week, lesson_number, study_group);
alter table public.timetable_overrides
  add constraint timetable_overrides_position_key unique (week_start, day_of_week, lesson_number, study_group);

-- -----------------------------------------------------------------------------
-- 2) Dosavadní hodiny dělených předmětů = skupina S2
-- -----------------------------------------------------------------------------
update public.timetable_slots
set study_group = 'S2'
where subject_code in ('WWW', 'DIG', 'HDW', 'DIP', 'ASW', 'ANG');

-- Týdenní změny: akce platí pro celou třídu; ostatní změny patří S2, pokud
-- se týkají hodiny skupiny S2 (nebo nové hodiny děleného předmětu).
with cfg as (
  select timetable_cycle as cycle,
         timetable_reference_monday as ref_monday,
         array_position(timetable_cycle, timetable_reference_week) - 1 as ref_idx,
         cardinality(timetable_cycle) as n
  from public.app_settings
  limit 1
),
ov as (
  select o.id, o.kind, o.subject_code, o.day_of_week, o.lesson_number,
         cfg.cycle[((((cfg.ref_idx + (o.week_start - cfg.ref_monday) / 7) % cfg.n) + cfg.n) % cfg.n) + 1] as cycle_week
  from public.timetable_overrides o, cfg
)
update public.timetable_overrides t
set study_group = 'S2'
from ov
where t.id = ov.id
  and ov.kind <> 'event'
  and (
    exists (
      select 1 from public.timetable_slots s
      where s.study_group = 'S2' and s.cycle_week = ov.cycle_week
        and s.day_of_week = ov.day_of_week and s.lesson_number = ov.lesson_number
    )
    or (
      not exists (
        select 1 from public.timetable_slots s
        where s.study_group = 'all' and s.cycle_week = ov.cycle_week
          and s.day_of_week = ov.day_of_week and s.lesson_number = ov.lesson_number
      )
      and upper(coalesce(ov.subject_code, '')) in ('WWW', 'DIG', 'HDW', 'DIP', 'ASW', 'ANG')
    )
  );

-- -----------------------------------------------------------------------------
-- 3) Rozvrh skupiny S1 (Bakaláři, stálý rozvrh I1.M)
--    „AB“ = týdny A a B, „EF“ = týdny E a F. Učitel = výchozí učitel předmětu.
-- -----------------------------------------------------------------------------
insert into public.timetable_slots (cycle_week, day_of_week, lesson_number, subject_code, subject_name, teacher, room, study_group)
select w.cycle_week, v.d, v.l, v.code, coalesce(ts.name, v.code), ts.default_teacher, v.room, 'S1'
from (values
  -- pondělí
  ('AB', 1, 3, 'DIP', 'S105'), ('EF', 1, 3, 'DIP', 'S105'),
  ('AB', 1, 4, 'DIG', 'S310'), ('EF', 1, 4, 'DIG', 'S310'),
  ('AB', 1, 5, 'ANG', 'N108'), ('EF', 1, 5, 'ANG', 'S210'),
  -- úterý
  ('AB', 2, 4, 'WWW', 'N305'), ('EF', 2, 4, 'WWW', 'N305'),
  ('AB', 2, 5, 'ASW', 'S001'), ('EF', 2, 5, 'ASW', 'S001'),
  ('AB', 2, 6, 'ANG', 'S319'), ('EF', 2, 6, 'ANG', 'S103'),
  ('EF', 2, 7, 'HDW', 'S004'),
  -- středa
  ('AB', 3, 4, 'HDW', 'S004'), ('EF', 3, 4, 'HDW', 'S004'),
  ('AB', 3, 5, 'DIG', 'S001'), ('EF', 3, 5, 'DIG', 'S001'),
  -- čtvrtek
  ('AB', 4, 2, 'HDW', 'S309'), ('EF', 4, 2, 'ASW', 'N307'),
  ('AB', 4, 5, 'ANG', 'S105'),
  ('AB', 4, 6, 'ANG', 'S319'),
  ('EF', 4, 7, 'ANG', 'S305'),
  -- pátek
  ('AB', 5, 1, 'ASW', 'S001'),
  ('AB', 5, 3, 'WWW', 'N305'), ('EF', 5, 3, 'WWW', 'N305'),
  ('AB', 5, 4, 'HDW', 'S310'), ('EF', 5, 4, 'HDW', 'S310'),
  ('EF', 5, 6, 'ANG', 'S317')
) as v (weeks, d, l, code, room)
cross join lateral unnest(case v.weeks when 'AB' then array['A', 'B'] else array['E', 'F'] end) as w (cycle_week)
left join public.timetable_subjects ts on ts.code = v.code
on conflict (cycle_week, day_of_week, lesson_number, study_group) do nothing;

-- -----------------------------------------------------------------------------
-- 4) Předměty dělené na skupiny a skupina u obsahu
-- -----------------------------------------------------------------------------
alter table public.subjects add column has_groups boolean not null default false;

alter table public.materials
  add column study_group text check (study_group in ('S1', 'S2'));
alter table public.assignments
  add column study_group text check (study_group in ('S1', 'S2'));
alter table public.exams
  add column study_group text check (study_group in ('S1', 'S2'));

-- Předmět portálu je dělený, když zkratkou nebo názvem odpovídá děleným
-- předmětům rozvrhu (WWW, DIG, HDW, DIP, ASW, ANG). Lze později změnit
-- v administraci předmětů.
update public.subjects s
set has_groups = true
where upper(s.abbreviation) in ('WWW', 'TWS', 'DIG', 'DG', 'HDW', 'HW', 'DIP', 'ASW', 'ANG', 'AJ', 'ANJ')
   or exists (
     select 1 from public.timetable_subjects t
     where t.code in ('WWW', 'DIG', 'HDW', 'DIP', 'ASW', 'ANG')
       and (
         lower(t.name) = lower(s.name)
         or lower(t.name) like lower(s.name) || ' %'
         or lower(s.name) like lower(t.name) || ' %'
       )
   );

-- Dosavadní obsah dělených předmětů patří skupině S2
update public.materials set study_group = 'S2'
where subject_id in (select id from public.subjects where has_groups);
update public.assignments set study_group = 'S2'
where subject_id in (select id from public.subjects where has_groups);
update public.exams set study_group = 'S2'
where subject_id in (select id from public.subjects where has_groups);

create index materials_group_idx on public.materials (subject_id, study_group);
