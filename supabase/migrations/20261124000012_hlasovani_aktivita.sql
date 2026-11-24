-- =============================================================================
-- WeilHub – hlasování a přehled aktivity
--
-- 1) Hlasování: redaktor vytvoří anketu (jedna možnost / více možností /
--    krátká odpověď). Student hlasuje jen za sebe, dokud je anketa otevřená.
--    Výsledky vidí student po odhlasování (pokud je anketa nepřiskrývá),
--    redaktor vždy. U neanonymní ankety redaktor vidí i jména.
-- 2) Aktivita: kdo si otevřel materiál (počet a čas), souhrn přečtení
--    oznámení a otevření materiálů pro redaktory.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Hlasování
-- -----------------------------------------------------------------------------
create table public.polls (
  id            uuid primary key default gen_random_uuid(),
  question      text not null check (char_length(question) between 1 and 300),
  description   text not null default '' check (char_length(description) <= 2000),
  kind          text not null default 'single' check (kind in ('single', 'multiple', 'text')),
  options       text[] not null default '{}',
  closes_at     timestamptz,
  show_results  boolean not null default true,
  anonymous     boolean not null default false,
  status        public.publication_status not null default 'draft',
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by    uuid references public.profiles (id) on delete set null,
  check (kind = 'text' or cardinality(options) between 2 and 12)
);
create index polls_status_idx on public.polls (status, published_at desc);

create trigger polls_set_updated before insert or update on public.polls
  for each row execute function public.set_updated_fields();
create trigger polls_published_at before insert or update on public.polls
  for each row execute function public.set_published_at();
create trigger polls_audit after insert or update or delete on public.polls
  for each row execute function public.write_audit_log();

create table public.poll_votes (
  poll_id     uuid not null references public.polls (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  choices     smallint[] not null default '{}',
  answer      text not null default '' check (char_length(answer) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- Hlas musí odpovídat druhu ankety a anketa musí být otevřená
create or replace function public.validate_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.polls;
  c smallint;
begin
  select * into p from public.polls where id = new.poll_id;
  if p.id is null or p.status <> 'published' then
    raise exception 'Hlasování není dostupné.';
  end if;
  if p.closes_at is not null and p.closes_at <= now() then
    raise exception 'Hlasování už je uzavřené.';
  end if;
  if p.kind = 'text' then
    new.choices := '{}';
    new.answer := btrim(new.answer);
    if new.answer = '' then
      raise exception 'Napiš odpověď.';
    end if;
  else
    new.answer := '';
    if cardinality(new.choices) = 0 then
      raise exception 'Vyber aspoň jednu možnost.';
    end if;
    if p.kind = 'single' and cardinality(new.choices) <> 1 then
      raise exception 'Vyber jednu možnost.';
    end if;
    foreach c in array new.choices loop
      if c < 0 or c >= cardinality(p.options) then
        raise exception 'Neplatná možnost.';
      end if;
    end loop;
    new.choices := array(select distinct x from unnest(new.choices) as x order by x);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger poll_votes_validate before insert or update on public.poll_votes
  for each row execute function public.validate_poll_vote();

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls from anon;
revoke all on public.poll_votes from anon;

create policy "polls: čtení" on public.polls
  for select to authenticated using (public.is_approved() and (status = 'published' or public.is_staff()));
create policy "polls: správa" on public.polls
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "poll_votes: vlastní nebo redaktor – čtení" on public.poll_votes
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "poll_votes: vlastní hlas" on public.poll_votes
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
create policy "poll_votes: změna vlastního hlasu" on public.poll_votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "poll_votes: zrušení vlastního hlasu" on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- Výsledky ankety: počty hlasů pro jednotlivé možnosti a počet hlasujících.
-- Student je vidí jen po svém hlasování (nebo po uzavření), a jen pokud je
-- anketa nepřiskrývá. Redaktor vždy.
create or replace function public.poll_results(p_poll uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.polls;
  allowed boolean;
begin
  select * into p from public.polls where id = p_poll;
  if p.id is null or not public.is_approved() then
    return null;
  end if;
  allowed := public.is_staff() or (
    p.status = 'published' and p.show_results and (
      exists (select 1 from public.poll_votes v where v.poll_id = p_poll and v.user_id = auth.uid())
      or (p.closes_at is not null and p.closes_at <= now())
    )
  );
  if not allowed then
    return null;
  end if;
  return jsonb_build_object(
    'voters', (select count(*) from public.poll_votes v where v.poll_id = p_poll),
    'counts', (
      select coalesce(jsonb_agg(coalesce(cnt, 0) order by i), '[]'::jsonb)
      from generate_series(0, greatest(cardinality(p.options) - 1, -1)) as i
      left join (
        select c as idx, count(*) as cnt
        from public.poll_votes v, unnest(v.choices) as c
        where v.poll_id = p_poll
        group by c
      ) t on t.idx = i
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Aktivita
-- -----------------------------------------------------------------------------
create table public.material_views (
  material_id  uuid not null references public.materials (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  first_at     timestamptz not null default now(),
  last_at      timestamptz not null default now(),
  views        integer not null default 1,
  primary key (material_id, user_id)
);
alter table public.material_views enable row level security;
revoke all on public.material_views from anon;
create policy "material_views: vlastní nebo redaktor – čtení" on public.material_views
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- Zapsání otevření materiálu (jen za sebe, jen zveřejněný materiál)
create or replace function public.record_material_view(p_material uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_approved()
     or not exists (select 1 from public.materials m where m.id = p_material and m.status = 'published') then
    return;
  end if;
  insert into public.material_views (material_id, user_id)
  values (p_material, auth.uid())
  on conflict (material_id, user_id)
  do update set last_at = now(), views = public.material_views.views + 1;
end;
$$;

-- Souhrn aktivity pro redaktory: kolik lidí přečetlo oznámení, otevřelo
-- materiál a hlasovalo v anketě (+ počet schválených studentů)
create or replace function public.activity_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'K přehledu aktivity nemáte oprávnění.';
  end if;
  return jsonb_build_object(
    'people', (select count(*) from public.profiles where status = 'approved'),
    'announcements', coalesce((select jsonb_object_agg(announcement_id, n) from (
      select announcement_id, count(*) as n from public.announcement_reads group by announcement_id) a), '{}'::jsonb),
    'materials', coalesce((select jsonb_object_agg(material_id, n) from (
      select material_id, count(*) as n from public.material_views group by material_id) m), '{}'::jsonb),
    'polls', coalesce((select jsonb_object_agg(poll_id, n) from (
      select poll_id, count(*) as n from public.poll_votes group by poll_id) v), '{}'::jsonb)
  );
end;
$$;

-- Kdo konkrétně (jen redaktor): přečetl oznámení / otevřel materiál / hlasoval
-- v neanonymní anketě. Vrací i ty, kdo zatím ne (seen_at = null).
create or replace function public.activity_people(p_kind text, p_id uuid)
returns table (person text, seen_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'K přehledu aktivity nemáte oprávnění.';
  end if;
  if p_kind = 'poll' and exists (select 1 from public.polls where id = p_id and anonymous) then
    raise exception 'Anketa je anonymní.';
  end if;
  return query
    select p.display_name::text,
      case p_kind
        when 'announcement' then (select r.read_at from public.announcement_reads r where r.announcement_id = p_id and r.user_id = p.id)
        when 'material' then (select v.first_at from public.material_views v where v.material_id = p_id and v.user_id = p.id)
        when 'poll' then (select v.created_at from public.poll_votes v where v.poll_id = p_id and v.user_id = p.id)
      end
    from public.profiles p
    where p.status = 'approved'
    order by 2 nulls last, 1;
end;
$$;

revoke all on function public.poll_results(uuid) from public;
revoke all on function public.record_material_view(uuid) from public;
revoke all on function public.activity_summary() from public;
revoke all on function public.activity_people(text, uuid) from public;
grant execute on function public.poll_results(uuid) to authenticated;
grant execute on function public.record_material_view(uuid) to authenticated;
grant execute on function public.activity_summary() to authenticated;
grant execute on function public.activity_people(text, uuid) to authenticated;
