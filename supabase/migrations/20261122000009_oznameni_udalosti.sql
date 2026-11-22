-- =============================================================================
-- WeilHub – události a termíny v oznámeních
--
-- Oznámení může být:
--   info      – běžné oznámení (dosavadní chování),
--   event     – událost: co se kdy bude dít (např. v pátek hospitace),
--   deadline  – termín: co je potřeba do kdy (např. do pondělí domluvit akci).
-- Událost a termín mají datum (a volitelně čas).
-- =============================================================================

alter table public.announcements
  add column kind text not null default 'info' check (kind in ('info', 'event', 'deadline')),
  add column event_date date,
  add column event_time time,
  add constraint announcements_event_date_check check (kind = 'info' or event_date is not null);

create index announcements_event_idx on public.announcements (status, event_date) where kind <> 'info';
