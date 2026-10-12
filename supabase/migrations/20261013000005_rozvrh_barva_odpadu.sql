-- =============================================================================
-- WeilHub – barva ohraničení odpadlé hodiny
-- Odpadlá hodina má vždy odznak „O“; ohraničení může být červené (výchozí)
-- nebo zelené šrafované jako u akce.
-- =============================================================================

alter table public.timetable_overrides
  add column accent text not null default 'red' check (accent in ('red', 'green'));
