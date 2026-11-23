-- =============================================================================
-- WeilHub – zápis z hodiny a úprava příjemců upozornění
--
-- 1) Zápis z hodiny: k jedné konkrétní hodině (datum + číslo hodiny +
--    skupina) může redaktor napsat, co se probíralo, a připojit odkaz na
--    zápis (materiál). V rozvrhu se pak u hodiny ukáže zelená fajfka.
-- 2) Upozornění chodí i autorovi obsahu (admin s žákovským pohledem chce
--    vidět totéž co ostatní).
-- =============================================================================

create table public.lesson_notes (
  id             uuid primary key default gen_random_uuid(),
  date           date not null check (extract(isodow from date) between 1 and 5),
  lesson_number  smallint not null references public.timetable_periods (lesson_number),
  study_group    text not null default 'all' check (study_group in ('all', 'S1', 'S2')),
  subject_code   text check (char_length(subject_code) <= 10),
  content        text not null default '' check (char_length(content) <= 5000),
  material_id    uuid references public.materials (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by     uuid references public.profiles (id) on delete set null,
  unique (date, lesson_number, study_group),
  check (char_length(content) > 0 or material_id is not null)
);
create index lesson_notes_date_idx on public.lesson_notes (date);

create trigger lesson_notes_set_updated before insert or update on public.lesson_notes
  for each row execute function public.set_updated_fields();
create trigger lesson_notes_audit after insert or update or delete on public.lesson_notes
  for each row execute function public.write_audit_log();

alter table public.lesson_notes enable row level security;
revoke all on public.lesson_notes from anon;
create policy "lesson_notes: čtení" on public.lesson_notes
  for select to authenticated using (public.is_approved());
create policy "lesson_notes: správa" on public.lesson_notes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Upozornění i autorovi: bez vynechání vlastního účtu
create or replace function public.push_targets(p_topic text, p_group text default null)
returns table (target_endpoint text, target_p256dh text, target_auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'K odeslání upozornění nemáte oprávnění.';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id and p.status = 'approved'
    where p_topic = any (s.topics)
      and (
        p_group is null
        or coalesce(p.preferences ->> 'studyGroup', '') not in ('S1', 'S2')
        or p.preferences ->> 'studyGroup' = p_group
      );
end;
$$;
