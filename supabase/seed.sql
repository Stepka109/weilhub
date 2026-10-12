-- =============================================================================
-- WeilHub – DEMONSTRAČNÍ OBSAH PRO LOKÁLNÍ VÝVOJ
--
-- Tento soubor se spouští pouze při `supabase db reset` na lokální instanci.
-- NIKDY jej nespouštějte v produkční databázi. Všechny demo záznamy mají
-- v názvu nebo popisu značku „[DEMO]“, aby byly jasně odlišitelné.
-- =============================================================================

insert into public.subjects (id, name, slug, abbreviation, teacher, color, icon, description, sort_order) values
  ('10000000-0000-4000-8000-000000000001', 'Matematika', 'matematika', 'M', 'Mgr. Novák', 'blue', 'calculator', '[DEMO] Algebra, funkce a geometrie.', 1),
  ('10000000-0000-4000-8000-000000000002', 'Český jazyk', 'cesky-jazyk', 'ČJ', 'Mgr. Dvořáková', 'red', 'book-open', '[DEMO] Literatura, sloh a mluvnice.', 2),
  ('10000000-0000-4000-8000-000000000003', 'Anglický jazyk', 'anglicky-jazyk', 'AJ', null, 'lavender', 'languages', '[DEMO] Gramatika a slovní zásoba.', 3),
  ('10000000-0000-4000-8000-000000000004', 'Hardware', 'hardware', 'HW', 'Ing. Svoboda', 'mint', 'cpu', '[DEMO] Stavba počítače a principy výpočetní techniky.', 4),
  ('10000000-0000-4000-8000-000000000005', 'Tvorba webových stránek', 'tvorba-webovych-stranek', 'TWS', null, 'yellow', 'globe', '[DEMO] HTML, CSS a základy JavaScriptu.', 5),
  ('10000000-0000-4000-8000-000000000006', 'Programování', 'programovani', 'PRG', null, 'sky', 'code', '[DEMO] Algoritmizace a programování.', 6);

insert into public.subject_topics (id, subject_id, name, sort_order) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'Historie výpočetní techniky', 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'Číselné soustavy', 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'Procesory', 3),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'Paměti', 4);

insert into public.materials (id, subject_id, topic_id, title, kind, description, content, content_text, status, material_date) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002',
   '[DEMO] Převody mezi číselnými soustavami', 'note', 'Dvojková, osmičková a šestnáctková soustava.',
   '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Dvojková soustava"}]},{"type":"paragraph","content":[{"type":"text","text":"Každá číslice má váhu "},{"type":"text","marks":[{"type":"bold"}],"text":"mocniny dvou"},{"type":"text","text":"."}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"1010₂ = 10₁₀"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"FF₁₆ = 255₁₀"}]}]}]}]}',
   'Dvojková soustava Každá číslice má váhu mocniny dvou. 1010₂ = 10₁₀ FF₁₆ = 255₁₀', 'published', current_date - 5),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null,
   '[DEMO] Lineární funkce – shrnutí', 'note', 'Definice, graf a vlastnosti lineární funkce.',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Lineární funkce má předpis y = ax + b."}]}]}',
   'Lineární funkce má předpis y = ax + b.', 'published', current_date - 2),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', null,
   '[DEMO] Rozpracovaný zápis (koncept)', 'note', 'Tento koncept studenti nevidí.',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Koncept."}]}]}',
   'Koncept.', 'draft', null);

insert into public.assignments (subject_id, title, instructions, assigned_on, due_date, due_time, status) values
  ('10000000-0000-4000-8000-000000000001', '[DEMO] Pracovní list – lineární funkce', 'Vypracujte úlohy 1–6 z pracovního listu.', current_date - 3, current_date + 1, null, 'published'),
  ('10000000-0000-4000-8000-000000000002', '[DEMO] Slohová práce – úvaha', 'Napište úvahu v rozsahu 250–300 slov.', current_date - 7, current_date + 6, '08:00', 'published'),
  ('10000000-0000-4000-8000-000000000004', '[DEMO] Převody soustav', 'Převeďte čísla z tabulky do dvojkové soustavy.', current_date - 10, current_date - 1, null, 'published');

insert into public.exams (subject_id, title, exam_date, exam_time, scope, notes, status) values
  ('10000000-0000-4000-8000-000000000004', '[DEMO] Test – číselné soustavy', current_date + 4, '09:50', 'Převody mezi soustavami, sčítání ve dvojkové soustavě.', 'Kalkulačka není povolena.', 'published'),
  ('10000000-0000-4000-8000-000000000003', '[DEMO] Vocabulary test – Unit 3', current_date + 9, null, 'Slovní zásoba lekce 3.', '', 'published');

-- Rozvrh třídy (I1.M) se importuje migrací 20261013000004_import_rozvrh_i1m.sql

insert into public.events (title, kind, start_date, end_date, description, status) values
  ('[DEMO] Podzimní prázdniny', 'holiday', current_date + 14, current_date + 15, '', 'published'),
  ('[DEMO] Exkurze – technické muzeum', 'school_event', current_date + 8, current_date + 8, 'Sraz v 7:45 před školou.', 'published');

insert into public.announcements (title, body, priority, pinned, status) values
  ('[DEMO] Vítejte ve WeilHubu', 'Tohle je ukázkové oznámení. Najdete tu materiály, úkoly, testy a rozvrh.', 'important', true, 'published'),
  ('[DEMO] Nový materiál z hardwaru', 'Přibyl zápis o číselných soustavách.', 'normal', false, 'published');

insert into public.useful_links (title, description, url, icon, sort_order) values
  ('[DEMO] Bakaláři', 'Oficiální školní systém', 'https://www.bakalari.cz/', 'graduation-cap', 1),
  ('[DEMO] Microsoft 365', 'Školní e-mail a Teams', 'https://www.office.com/', 'mail', 2);

-- Demo pozvánka pro registraci studentů (kód: DEMO-POZVANKA)
insert into public.invitations (code, note, role, max_uses) values ('DEMO-POZVANKA', '[DEMO] lokální vývoj', 'student', 100);
