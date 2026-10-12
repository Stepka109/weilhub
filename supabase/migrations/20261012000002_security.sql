-- =============================================================================
-- WeilHub – oprávnění, Row Level Security, registrace, audit a úložiště
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pomocné funkce oprávnění (SECURITY DEFINER, aby nevznikala rekurze v RLS)
-- -----------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'approved'
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved'
  )
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.role in ('admin', 'editor')
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.role = 'admin'
  )
$$;

revoke all on function public.auth_role(), public.is_approved(), public.is_staff(), public.is_admin() from public;
grant execute on function public.auth_role(), public.is_approved(), public.is_staff(), public.is_admin()
  to authenticated, anon;

-- -----------------------------------------------------------------------------
-- Registrace: profil vzniká výhradně triggerem, nikdy s rolí admin
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings     public.app_settings;
  invite       public.invitations;
  invite_code  text := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');
  name         text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  new_role     public.app_role := 'student';
  new_status   public.account_status := 'pending';
begin
  select * into settings from public.app_settings where id = true;

  if invite_code is not null then
    select * into invite from public.invitations i
    where i.code = invite_code
      and not i.revoked
      and i.used_count < i.max_uses
      and (i.expires_at is null or i.expires_at > now())
    for update;
  end if;

  if invite.id is not null then
    update public.invitations set used_count = used_count + 1 where id = invite.id;
    -- Pozvánka může udělit nejvýše roli editor (omezeno i CHECK v tabulce)
    new_role := case when invite.role = 'editor' then 'editor'::public.app_role else 'student'::public.app_role end;
    if settings.auto_approve_invited then
      new_status := 'approved';
    end if;
  else
    if not settings.registration_enabled then
      raise exception 'Registrace jsou momentálně vypnuté.' using errcode = 'P0001';
    end if;
    if settings.registration_requires_invite then
      raise exception 'Registrace vyžaduje platnou pozvánku.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, display_name, role, status, approved_at)
  values (
    new.id,
    left(coalesce(name, split_part(new.email, '@', 1), 'Student'), 80),
    new_role,
    new_status,
    case when new_status = 'approved' then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Ochrana profilů: role a stav smí měnit pouze administrátor,
-- poslední administrátor nesmí být odebrán.
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_admins integer;
  -- auth.uid() je NULL pouze mimo uživatelskou relaci (SQL editor, service role);
  -- anonymní role nemá na tabulku profiles žádné oprávnění UPDATE.
  privileged boolean := auth.uid() is null or public.is_admin();
begin
  if new.id <> old.id then
    raise exception 'ID profilu nelze měnit.';
  end if;

  if (new.role is distinct from old.role or new.status is distinct from old.status
      or new.approved_at is distinct from old.approved_at) and not privileged then
    raise exception 'Nemáte oprávnění měnit roli nebo stav účtu.' using errcode = '42501';
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_at := now();
  end if;

  if old.role = 'admin' and old.status = 'approved'
     and (new.role <> 'admin' or new.status <> 'approved') then
    select count(*) into remaining_admins from public.profiles
    where role = 'admin' and status = 'approved' and id <> old.id;
    if remaining_admins = 0 then
      raise exception 'Nelze odebrat posledního administrátora.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.status = 'approved' and not exists (
    select 1 from public.profiles
    where role = 'admin' and status = 'approved' and id <> old.id
  ) then
    raise exception 'Nelze smazat posledního administrátora.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger profiles_guard_delete before delete on public.profiles
  for each row execute function public.guard_profile_delete();

-- -----------------------------------------------------------------------------
-- Bootstrap prvního administrátora.
-- Spustitelné POUZE z SQL editoru Supabase (role postgres / service_role),
-- a jen pokud zatím žádný administrátor neexistuje.
-- -----------------------------------------------------------------------------
create or replace function public.bootstrap_first_admin(user_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Administrátor již existuje. Další role přidělujte v administraci.';
  end if;

  select u.id into target from auth.users u where lower(u.email) = lower(trim(user_email));
  if target is null then
    raise exception 'Uživatel s e-mailem % neexistuje. Nejprve se zaregistrujte.', user_email;
  end if;

  update public.profiles set role = 'admin', status = 'approved' where id = target;
  return 'Uživatel ' || user_email || ' je nyní administrátorem.';
end;
$$;

revoke all on function public.bootstrap_first_admin(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Audit důležitých administrativních akcí
-- -----------------------------------------------------------------------------
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  label text;
begin
  label := coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'display_name', rec ->> 'portal_name', rec ->> 'code');
  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    if (to_jsonb(old) ->> 'role') = (rec ->> 'role') and (to_jsonb(old) ->> 'status') = (rec ->> 'status') then
      return null; -- běžná úprava profilu se neeviduje
    end if;
    label := label || ': ' || (rec ->> 'role') || ' / ' || (rec ->> 'status');
  end if;
  if tg_table_name = 'materials' and tg_op = 'UPDATE'
     and (to_jsonb(old) ->> 'status') is distinct from (rec ->> 'status') then
    label := label || ' → ' || (rec ->> 'status');
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, summary)
  values (auth.uid(), lower(tg_op), tg_table_name, rec ->> 'id', left(label, 300));
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'subjects','subject_topics','materials','assignments','exams','timetable_entries',
    'timetable_exceptions','events','announcements','useful_links','invitations','app_settings','profiles'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.write_audit_log()', t, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.invitations            enable row level security;
alter table public.app_settings           enable row level security;
alter table public.subjects               enable row level security;
alter table public.subject_topics         enable row level security;
alter table public.materials              enable row level security;
alter table public.material_files         enable row level security;
alter table public.material_favorites     enable row level security;
alter table public.assignments            enable row level security;
alter table public.assignment_files       enable row level security;
alter table public.assignment_materials   enable row level security;
alter table public.assignment_completions enable row level security;
alter table public.exams                  enable row level security;
alter table public.exam_materials         enable row level security;
alter table public.timetable_entries      enable row level security;
alter table public.timetable_exceptions   enable row level security;
alter table public.events                 enable row level security;
alter table public.announcements          enable row level security;
alter table public.announcement_reads     enable row level security;
alter table public.useful_links           enable row level security;
alter table public.audit_logs             enable row level security;

-- Profily
create policy "profiles: vlastní profil" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: schválení vidí schválené" on public.profiles
  for select to authenticated using (public.is_approved() and status = 'approved');
create policy "profiles: admin vidí vše" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "profiles: úprava vlastního profilu" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin upravuje" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Sloupce role/status chrání trigger; navíc omezíme, co smí klient vůbec měnit
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_path, preferences) on public.profiles to authenticated;
grant update (role, status) on public.profiles to authenticated; -- kontroluje guard_profile_update

-- Pozvánky – pouze admin
create policy "invitations: admin" on public.invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Nastavení – čtení veřejné (název portálu na přihlašovací stránce), změna jen admin
create policy "settings: čtení" on public.app_settings for select to anon, authenticated using (true);
create policy "settings: admin" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Předměty a okruhy
create policy "subjects: čtení" on public.subjects for select to authenticated
  using (public.is_staff() or (public.is_approved() and not is_archived));
create policy "subjects: správa" on public.subjects for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "topics: čtení" on public.subject_topics for select to authenticated
  using (public.is_approved());
create policy "topics: správa" on public.subject_topics for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Materiály – studenti vidí pouze publikované
create policy "materials: čtení" on public.materials for select to authenticated
  using (public.is_staff() or (public.is_approved() and status = 'published'));
create policy "materials: správa" on public.materials for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "material_files: čtení" on public.material_files for select to authenticated
  using (
    public.is_staff() or (
      public.is_approved() and exists (
        select 1 from public.materials m where m.id = material_id and m.status = 'published'
      )
    )
  );
create policy "material_files: správa" on public.material_files for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "favorites: vlastní" on public.material_favorites for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (
    user_id = auth.uid() and public.is_approved() and exists (
      select 1 from public.materials m where m.id = material_id and m.status = 'published'
    )
  );

-- Úkoly
create policy "assignments: čtení" on public.assignments for select to authenticated
  using (public.is_staff() or (public.is_approved() and status = 'published'));
create policy "assignments: správa" on public.assignments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "assignment_files: čtení" on public.assignment_files for select to authenticated
  using (
    public.is_staff() or (
      public.is_approved() and exists (
        select 1 from public.assignments a where a.id = assignment_id and a.status = 'published'
      )
    )
  );
create policy "assignment_files: správa" on public.assignment_files for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "assignment_materials: čtení" on public.assignment_materials for select to authenticated
  using (public.is_approved());
create policy "assignment_materials: správa" on public.assignment_materials for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "completions: vlastní" on public.assignment_completions for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (
    user_id = auth.uid() and public.is_approved() and exists (
      select 1 from public.assignments a where a.id = assignment_id and a.status = 'published'
    )
  );

-- Testy
create policy "exams: čtení" on public.exams for select to authenticated
  using (public.is_staff() or (public.is_approved() and status = 'published'));
create policy "exams: správa" on public.exams for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "exam_materials: čtení" on public.exam_materials for select to authenticated
  using (public.is_approved());
create policy "exam_materials: správa" on public.exam_materials for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Rozvrh
create policy "timetable: čtení" on public.timetable_entries for select to authenticated
  using (public.is_approved());
create policy "timetable: správa" on public.timetable_entries for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "timetable_exceptions: čtení" on public.timetable_exceptions for select to authenticated
  using (public.is_approved());
create policy "timetable_exceptions: správa" on public.timetable_exceptions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Akce
create policy "events: čtení" on public.events for select to authenticated
  using (public.is_staff() or (public.is_approved() and status = 'published'));
create policy "events: správa" on public.events for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Oznámení
create policy "announcements: čtení" on public.announcements for select to authenticated
  using (public.is_staff() or (public.is_approved() and status = 'published'));
create policy "announcements: správa" on public.announcements for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "announcement_reads: vlastní" on public.announcement_reads for all to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (
    user_id = auth.uid() and public.is_approved() and exists (
      select 1 from public.announcements a where a.id = announcement_id and a.status = 'published'
    )
  );

-- Odkazy
create policy "links: čtení" on public.useful_links for select to authenticated
  using (public.is_staff() or (public.is_approved() and is_visible));
create policy "links: správa" on public.useful_links for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Audit – čte pouze admin, zapisují pouze triggery
create policy "audit: admin" on public.audit_logs for select to authenticated using (public.is_admin());

-- Anonymní role nemá k obsahovým tabulkám žádný přístup
revoke all on all tables in schema public from anon;
grant select on public.app_settings to anon;

-- -----------------------------------------------------------------------------
-- Úložiště souborů
--   materials – soukromý bucket pro materiály a přílohy úkolů
--   avatars   – veřejný bucket pro profilové obrázky (náhodné názvy souborů)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials', 'materials', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'image/png', 'image/jpeg', 'image/webp'
  ]
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Smí aktuální uživatel číst daný soubor? (publikovaný rodičovský záznam)
create or replace function public.can_read_storage_file(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or (
    public.is_approved() and (
      exists (
        select 1 from public.material_files f
        join public.materials m on m.id = f.material_id
        where f.storage_path = object_path and m.status = 'published'
      )
      or exists (
        select 1 from public.assignment_files f
        join public.assignments a on a.id = f.assignment_id
        where f.storage_path = object_path and a.status = 'published'
      )
    )
  )
$$;

revoke all on function public.can_read_storage_file(text) from public, anon;
grant execute on function public.can_read_storage_file(text) to authenticated;

create policy "materials bucket: čtení" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and public.can_read_storage_file(name));
create policy "materials bucket: nahrávání" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.is_staff());
create policy "materials bucket: úpravy" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and public.is_staff());
create policy "materials bucket: mazání" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.is_staff());

create policy "avatars: nahrání vlastního" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: úprava vlastního" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: smazání vlastního" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: čtení vlastních" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- Počet dalších odkazů na stejný soubor (před smazáním z úložiště)
-- -----------------------------------------------------------------------------
create or replace function public.storage_path_usage(object_path text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff() then (
    (select count(*) from public.material_files where storage_path = object_path)
    + (select count(*) from public.assignment_files where storage_path = object_path)
  )::integer else null end
$$;

revoke all on function public.storage_path_usage(text) from public, anon;
grant execute on function public.storage_path_usage(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Globální vyhledávání (SECURITY INVOKER → plně respektuje RLS)
-- -----------------------------------------------------------------------------
create or replace function public.search_content(q text, max_results integer default 40)
returns table (
  kind          text,
  id            uuid,
  title         text,
  subject_name  text,
  subject_slug  text,
  subject_color text,
  body          text,
  ref_date      date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with term as (
    select '%' || replace(replace(replace(
             extensions.unaccent(lower(trim(q))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
  )
  (
    select 'subject', s.id, s.name, s.name, s.slug, s.color, coalesce(s.description, ''), null::date
    from public.subjects s, term
    where not s.is_archived
      and (extensions.unaccent(lower(s.name)) like term.p
           or extensions.unaccent(lower(s.abbreviation)) like term.p)
    limit max_results
  )
  union all
  (
    select 'material', m.id, m.title, s.name, s.slug, s.color,
           coalesce(nullif(m.description, ''), m.content_text), coalesce(m.material_date, m.published_at::date)
    from public.materials m
    join public.subjects s on s.id = m.subject_id, term
    where m.status = 'published'
      and (extensions.unaccent(lower(m.title)) like term.p
           or extensions.unaccent(lower(coalesce(m.description, ''))) like term.p
           or extensions.unaccent(lower(m.content_text)) like term.p)
    order by m.published_at desc nulls last
    limit max_results
  )
  union all
  (
    select 'assignment', a.id, a.title, s.name, s.slug, s.color, a.instructions, a.due_date
    from public.assignments a
    join public.subjects s on s.id = a.subject_id, term
    where a.status = 'published'
      and (extensions.unaccent(lower(a.title)) like term.p
           or extensions.unaccent(lower(a.instructions)) like term.p)
    order by a.due_date desc
    limit max_results
  )
  union all
  (
    select 'exam', e.id, e.title, s.name, s.slug, s.color, e.scope, e.exam_date
    from public.exams e
    join public.subjects s on s.id = e.subject_id, term
    where e.status = 'published'
      and (extensions.unaccent(lower(e.title)) like term.p
           or extensions.unaccent(lower(e.scope)) like term.p)
    order by e.exam_date desc
    limit max_results
  )
$$;

revoke all on function public.search_content(text, integer) from public, anon;
grant execute on function public.search_content(text, integer) to authenticated;
grant usage on schema extensions to authenticated;
