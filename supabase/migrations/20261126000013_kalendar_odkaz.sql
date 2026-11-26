-- =============================================================================
-- WeilHub – testy, úkoly a akce ve vlastním kalendáři (Google, Apple, Outlook)
--
-- Kalendářová aplikace se nepřihlašuje, odebírá soukromý odkaz s osobním
-- klíčem. V databázi je jen otisk klíče (SHA-256). Funkce calendar_feed vydá
-- jen zveřejněné testy, úkoly, akce a události z oznámení, a jen schválenému
-- uživateli s platným klíčem (s ohledem na jeho skupinu S1 / S2).
-- =============================================================================

create table public.calendar_tokens (
  user_id       uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

alter table public.calendar_tokens enable row level security;
revoke all on public.calendar_tokens from anon;

create policy "calendar_tokens: vlastní klíč – čtení" on public.calendar_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "calendar_tokens: vlastní klíč – vytvoření" on public.calendar_tokens
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
create policy "calendar_tokens: vlastní klíč – změna" on public.calendar_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_approved());
create policy "calendar_tokens: vlastní klíč – smazání" on public.calendar_tokens
  for delete to authenticated using (user_id = auth.uid());

-- Obsah kalendáře: 2 měsíce zpět a rok dopředu
create or replace function public.calendar_feed(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  grp text;
  d_from date := current_date - 60;
  d_to date := current_date + 366;
  result jsonb;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select c.user_id, p.preferences ->> 'studyGroup' into uid, grp
  from public.calendar_tokens c
  join public.profiles p on p.id = c.user_id and p.status = 'approved'
  where c.token_hash = p_token_hash;
  if uid is null then
    return null;
  end if;

  -- Čas posledního načtení stačí zapisovat jednou za hodinu
  update public.calendar_tokens set last_used_at = now()
  where user_id = uid and (last_used_at is null or last_used_at < now() - interval '1 hour');

  select jsonb_build_object(
    'class_label', (select s.class_label from public.app_settings s limit 1),
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'date', e.exam_date, 'time', e.exam_time, 'scope', e.scope,
        'subject', s.abbreviation, 'subject_name', s.name, 'group', e.study_group, 'updated_at', e.updated_at))
      from public.exams e
      join public.subjects s on s.id = e.subject_id
      where e.status = 'published' and e.exam_date between d_from and d_to
        and (e.study_group is null or grp is null or e.study_group = grp)), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'date', a.due_date, 'time', a.due_time, 'instructions', a.instructions,
        'subject', s.abbreviation, 'subject_name', s.name, 'group', a.study_group, 'updated_at', a.updated_at,
        'done', exists (select 1 from public.assignment_completions c where c.assignment_id = a.id and c.user_id = uid)))
      from public.assignments a
      join public.subjects s on s.id = a.subject_id
      where a.status = 'published' and a.due_date between d_from and d_to
        and (a.study_group is null or grp is null or a.study_group = grp)), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'kind', e.kind, 'start_date', e.start_date, 'end_date', e.end_date,
        'time', e.start_time, 'description', e.description, 'updated_at', e.updated_at))
      from public.events e
      where e.status = 'published' and e.end_date >= d_from and e.start_date <= d_to), '[]'::jsonb),
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'title', n.title, 'kind', n.kind, 'date', n.event_date, 'time', n.event_time,
        'body', n.body, 'updated_at', n.updated_at))
      from public.announcements n
      where n.status = 'published' and n.kind <> 'info' and n.event_date between d_from and d_to), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
