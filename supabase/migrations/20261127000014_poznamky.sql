-- =============================================================================
-- WeilHub – vlastní poznámkový blok žáků
--
-- Každý schválený uživatel si vede vlastní poznámky k předmětům: text,
-- kresby perem (Apple Pencil) a obrázky. Poznámka je SOUKROMÁ, dokud ji
-- autor nesdílí se správcem (shared). Redaktor vidí jen sdílené poznámky
-- a může z nich sestavit materiál. Nikdo jiný (ani spolužáci) je nevidí.
--
-- Kresby jsou uložené přímo v obsahu poznámky (uzel „drawing“ s tahy),
-- obrázky v soukromém bucketu „notes“ ve složce autora.
-- =============================================================================

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  subject_id   uuid references public.subjects (id) on delete set null,
  title        text not null default '' check (char_length(title) <= 200),
  content      jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  content_text text not null default '' check (char_length(content_text) <= 60000),
  -- Den hodiny, ke které poznámka patří (pro správce při skládání zápisu)
  lesson_date  date,
  shared       boolean not null default false,
  shared_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Kresby jsou uložené jako tahy; rozumná horní mez velikosti poznámky
  check (pg_column_size(content) <= 6000000)
);
create index notes_user_idx on public.notes (user_id, updated_at desc);
create index notes_shared_idx on public.notes (subject_id, lesson_date) where shared;

create or replace function public.notes_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.shared and (tg_op = 'INSERT' or not old.shared) then
    new.shared_at := now();
  elsif not new.shared then
    new.shared_at := null;
  end if;
  return new;
end;
$$;

create trigger notes_before_write before insert or update on public.notes
  for each row execute function public.notes_before_write();

create table public.note_images (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null references public.notes (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  storage_path  text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$'),
  file_name     text not null check (char_length(file_name) between 1 and 255),
  mime_type     text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at    timestamptz not null default now()
);
create index note_images_note_idx on public.note_images (note_id);

alter table public.notes enable row level security;
alter table public.note_images enable row level security;
revoke all on public.notes from anon;
revoke all on public.note_images from anon;

-- Autor: všechno se svými poznámkami (jen schválený účet)
create policy "notes: vlastní – čtení" on public.notes
  for select to authenticated using (user_id = auth.uid() or (shared and public.is_staff()));
create policy "notes: vlastní – vytvoření" on public.notes
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
create policy "notes: vlastní – úprava" on public.notes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_approved());
create policy "notes: vlastní – smazání" on public.notes
  for delete to authenticated using (user_id = auth.uid());

create policy "note_images: čtení" on public.note_images
  for select to authenticated using (
    user_id = auth.uid()
    or (public.is_staff() and exists (select 1 from public.notes n where n.id = note_id and n.shared))
  );
create policy "note_images: vlastní – vložení" on public.note_images
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_approved()
    and exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
    and (storage.foldername(storage_path))[1] = auth.uid()::text
  );
create policy "note_images: vlastní – smazání" on public.note_images
  for delete to authenticated using (user_id = auth.uid());

-- Soukromý bucket na obrázky z poznámek (složka = id autora)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create or replace function public.can_read_note_file(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(object_path))[1] = auth.uid()::text
    or (
      public.is_staff() and exists (
        select 1 from public.note_images i
        join public.notes n on n.id = i.note_id
        where i.storage_path = object_path and n.shared
      )
    )
$$;

revoke all on function public.can_read_note_file(text) from public, anon;
grant execute on function public.can_read_note_file(text) to authenticated;

create policy "notes bucket: čtení" on storage.objects for select to authenticated
  using (bucket_id = 'notes' and public.can_read_note_file(name));
create policy "notes bucket: nahrání do vlastní složky" on storage.objects for insert to authenticated
  with check (bucket_id = 'notes' and public.is_approved() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "notes bucket: smazání vlastních" on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
