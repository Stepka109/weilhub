-- =============================================================================
-- WeilHub – push upozornění (Web Push)
--
-- Každé zařízení, které si upozornění zapne, má jeden odběr (endpoint
-- prohlížeče + šifrovací klíče). Student vidí a spravuje jen své odběry.
-- Seznam příjemců pro odeslání vydá jen funkce push_targets, a to pouze
-- redaktorům a administrátorům (odesílá se při zveřejnění obsahu).
-- =============================================================================

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint      text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh        text not null check (char_length(p256dh) between 20 and 200),
  auth          text not null check (char_length(auth) between 8 and 100),
  topics        text[] not null default array['tests', 'assignments', 'announcements', 'timetable', 'materials']
                  check (topics <@ array['tests', 'assignments', 'announcements', 'timetable', 'materials']),
  user_agent    text check (char_length(user_agent) <= 300),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

create policy "push_subscriptions: vlastní – čtení" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions: vlastní – změna" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subscriptions: vlastní – smazání" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Přihlášení zařízení k odběru. Stejné zařízení (endpoint) mohl dřív používat
-- někdo jiný – jeho odběr se nahradí, aby upozornění nechodila cizímu účtu.
create or replace function public.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_topics text[], p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_approved() then
    raise exception 'Účet není schválený.';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, topics, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_topics, left(p_user_agent, 300));
end;
$$;

-- Příjemci upozornění daného druhu (jen pro redaktory). Obsah jen pro jednu
-- skupinu dostanou členové té skupiny a ti, kdo skupinu nemají zvolenou.
-- Autor upozornění sám sobě nechodí.
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
      and s.user_id <> auth.uid()
      and (
        p_group is null
        or coalesce(p.preferences ->> 'studyGroup', '') not in ('S1', 'S2')
        or p.preferences ->> 'studyGroup' = p_group
      );
end;
$$;

-- Úklid odběrů, které prohlížeč zrušil (služba vrátila 404 / 410)
create or replace function public.push_forget(p_endpoints text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'K této akci nemáte oprávnění.';
  end if;
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
end;
$$;

revoke all on function public.push_subscribe(text, text, text, text[], text) from public;
revoke all on function public.push_targets(text, text) from public;
revoke all on function public.push_forget(text[]) from public;
grant execute on function public.push_subscribe(text, text, text, text[], text) to authenticated;
grant execute on function public.push_targets(text, text) to authenticated;
grant execute on function public.push_forget(text[]) to authenticated;
