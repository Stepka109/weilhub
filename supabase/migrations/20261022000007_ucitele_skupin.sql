-- =============================================================================
-- WeilHub – učitelé podle skupin
-- U děleného předmětu může mít každá skupina jiného vyučujícího. Prázdná
-- hodnota = stejný vyučující jako výchozí (u obou skupin stejný).
-- =============================================================================

alter table public.timetable_subjects
  add column teacher_s1 text check (char_length(teacher_s1) <= 120),
  add column teacher_s2 text check (char_length(teacher_s2) <= 120);

alter table public.subjects
  add column teacher_s1 text check (char_length(teacher_s1) <= 120),
  add column teacher_s2 text check (char_length(teacher_s2) <= 120);
