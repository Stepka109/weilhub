-- =============================================================================
-- WeilHub – widget rozvrhu pro iPhone (aplikace Scriptable)
--
-- Widget nemá přihlášení přes cookies, prokazuje se osobním klíčem. V databázi
-- je uložen jen jeho otisk (SHA-256), samotný klíč zná jen uživatel. Funkce
-- widget_timetable vydá pouze data rozvrhu (nic jiného) a jen schválenému
-- uživateli s platným klíčem.
-- =============================================================================

create table public.widget_tokens (
  user_id       uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

alter table public.widget_tokens enable row level security;
revoke all on public.widget_tokens from anon;

create policy "widget_tokens: vlastní klíč – čtení" on public.widget_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "widget_tokens: vlastní klíč – vytvoření" on public.widget_tokens
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
create policy "widget_tokens: vlastní klíč – změna" on public.widget_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_approved());
create policy "widget_tokens: vlastní klíč – smazání" on public.widget_tokens
  for delete to authenticated using (user_id = auth.uid());

-- Data rozvrhu pro widget (týdny od p_from do p_to včetně)
create or replace function public.widget_timetable(p_token_hash text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  result jsonb;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_to < p_from or p_to - p_from > 21 then
    return null;
  end if;

  select w.user_id into uid
  from public.widget_tokens w
  join public.profiles p on p.id = w.user_id and p.status = 'approved'
  where w.token_hash = p_token_hash;
  if uid is null then
    return null;
  end if;

  update public.widget_tokens set last_used_at = now() where user_id = uid;

  select jsonb_build_object(
    'group', (select p.preferences ->> 'studyGroup' from public.profiles p where p.id = uid),
    'settings', (
      select jsonb_build_object(
        'class_label', s.class_label,
        'cycle', s.timetable_cycle,
        'reference_monday', s.timetable_reference_monday,
        'reference_week', s.timetable_reference_week,
        'visible_from', s.timetable_visible_from,
        'visible_to', s.timetable_visible_to)
      from public.app_settings s limit 1),
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object('lesson_number', lesson_number, 'start_time', start_time, 'end_time', end_time) order by lesson_number)
      from public.timetable_periods), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cycle_week', cycle_week, 'day_of_week', day_of_week, 'lesson_number', lesson_number,
        'subject_code', subject_code, 'subject_name', subject_name, 'teacher', teacher, 'room', room,
        'study_group', study_group))
      from public.timetable_slots), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(to_jsonb(o) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by')
      from public.timetable_overrides o
      where o.week_start between p_from - 6 and p_to), '[]'::jsonb),
    'day_overrides', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'date', d.date, 'kind', d.kind, 'title', d.title, 'room', d.room, 'teacher', d.teacher))
      from public.timetable_day_overrides d
      where d.date between p_from and p_to), '[]'::jsonb),
    'holidays', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'start_date', e.start_date, 'end_date', e.end_date))
      from public.events e
      where e.status = 'published' and e.kind = 'holiday' and e.start_date <= p_to and e.end_date >= p_from), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.widget_timetable(text, date, date) from public;
grant execute on function public.widget_timetable(text, date, date) to anon, authenticated;
