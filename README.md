# WeilHub

Neoficiální studentský portál pro třídu na Weilovce – studijní materiály, zápisy, domácí úkoly, testy, rozvrh, kalendář a oznámení na jednom místě. Součástí je samostatná administrace, ve které se veškerý obsah spravuje formuláři, bez zásahu do kódu.

> **Stav:** aplikace je hotová a otestovaná (databázová pravidla, logika, build). Aby fungovala, je potřeba ji **propojit s vlastním projektem Supabase** – postup níže. Bez toho se zobrazí stránka „Aplikace čeká na připojení databáze“.

---

## Technologie

| Vrstva | Použito |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI (základ shadcn/ui) |
| Ikonky | Lucide (`lucide-react`) s vlastními hover animacemi ve stylu itshover.com |
| Formuláře | React Hook Form + Zod |
| Editor | TipTap 3 (obsah uložený jako strukturovaný JSON) |
| Backend | Supabase – PostgreSQL, Auth, Storage, Row Level Security |
| Datumy | date-fns s českou lokalizací, časová zóna Europe/Prague |
| Testy | Vitest + PGlite (skutečné migrace v Postgresu), Playwright (E2E) |

### Proč Supabase a ne Firebase

Zadání je silně relační: vazby materiál ↔ úkol ↔ test, unikátní dvojice *uživatel + úkol*, tematické okruhy patřící k předmětu, audit, fulltextové vyhledávání bez ohledu na diakritiku. To vše PostgreSQL řeší nativně (cizí klíče, `UNIQUE`, `CHECK`, triggery) a **Row Level Security** vynucuje oprávnění přímo v databázi – i pro požadavky mimo aplikaci. Ve Firestore by se stejná pravidla musela složitě duplikovat v Security Rules a denormalizovat data.

---

## První spuštění

### 1. Projekt Supabase

1. Na [supabase.com](https://supabase.com) založte nový projekt (region **Central EU – Frankfurt**).
2. V **SQL Editoru** postupně spusťte obsah souborů:
   1. `supabase/migrations/20261012000001_schema.sql`
   2. `supabase/migrations/20261012000002_security.sql`
   3. `supabase/migrations/20261013000003_rozvrh_cyklus.sql` – rozvrh se střídáním týdnů A → E → B → F
   4. `supabase/migrations/20261013000004_import_rozvrh_i1m.sql` – import rozvrhu I1.M z Family Station

   Alternativně přes CLI: `npx supabase link --project-ref <ref>` a `npx supabase db push`.

   Migrace vytvoří tabulky, RLS politiky, triggery i **oba Storage buckety**:
   - `materials` – **soukromý**, soubory materiálů a úkolů (max. 50 MB, jen povolené MIME typy),
   - `avatars` – veřejný pro profilové obrázky (náhodné názvy souborů, zápis jen do vlastní složky).

   Pokud by vytvoření bucketů selhalo (např. kvůli oprávněním), vytvořte je ručně v **Storage → New bucket** se stejnými názvy a nastavením a spusťte znovu jen část „Úložiště souborů“ ze souboru `…_security.sql`.

### 2. Nastavení Auth v Supabase

V **Authentication → URL Configuration**:
- *Site URL*: adresa aplikace (lokálně `http://localhost:3000`, v produkci např. `https://weilhub.vercel.app`),
- *Redirect URLs*: `http://localhost:3000/auth/callback` a `https://<vaše-doména>/auth/callback`.

V **Authentication → Sign In / Providers → Email**: ponechte zapnuté *Confirm email*.

Doporučené (ochrana proti zneužití):
- **Authentication → Rate Limits** – ponechte výchozí nebo zpřísněte limity pro přihlášení a e-maily,
- **Authentication → Attack Protection** – zapněte CAPTCHA (hCaptcha / Turnstile) a *Leaked password protection*,
- **Authentication → Emails** – můžete přeložit šablony e-mailů do češtiny,
- pro ostrý provoz nastavte vlastní SMTP (výchozí e-maily Supabase mají nízký limit).

Aplikace má navíc vlastní limit pokusů o přihlášení, registraci a obnovu hesla.

### 3. Proměnné prostředí

```bash
cp .env.example .env.local
```

Vyplňte `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `NEXT_PUBLIC_SITE_URL`. Volitelně `SUPABASE_SECRET_KEY` (jen server – zpřístupní v administraci e-maily uživatelů a mazání účtů).

> Tajný klíč **nikdy** nedávejte do proměnné s prefixem `NEXT_PUBLIC_` ani do klientského kódu.

### 4. Spuštění

```bash
npm install
npm run dev
```

Aplikace běží na <http://localhost:3000>.

### 5. Založení prvního administrátora (bezpečný bootstrap)

Veřejná registrace **nikdy** neudělí roli admin. První administrátor se zakládá takto:

1. V administraci zatím nikdo není, proto vytvořte jednorázovou pozvánku přímo v SQL editoru:
   ```sql
   insert into public.invitations (code, note, max_uses) values ('PRVNI-ADMIN-2026', 'bootstrap', 1);
   ```
2. Zaregistrujte se v aplikaci (`/registrace`) s tímto kódem a potvrďte e-mail.
3. V SQL editoru spusťte:
   ```sql
   select public.bootstrap_first_admin('vas@email.cz');
   ```
   Funkce funguje **jen z SQL editoru** (není dostupná přes API) a **jen dokud žádný admin neexistuje**.
4. Odhlaste se a znovu přihlaste – v menu se objeví **Administrace**.

Další administrátory a editory už nastavujete v **Administrace → Uživatelé**. Databáze nedovolí odebrat posledního administrátora.

### 6. Demonstrační data (volitelné, jen lokálně)

`supabase/seed.sql` obsahuje ukázkové předměty, materiály, úkoly, testy, rozvrh a pozvánku `DEMO-POZVANKA`. Všechny položky jsou označené `[DEMO]`.
- s lokálním Supabase CLI se nahraje automaticky při `npx supabase db reset`,
- **do produkční databáze ho nespouštějte.**

---

## Nasazení na Vercel

1. Nahrajte repozitář na GitHub a importujte ho ve Vercelu (framework se rozpozná automaticky).
2. V *Settings → Environment Variables* nastavte proměnné z `.env.example` (pro Production i Preview). Veřejné proměnné `NEXT_PUBLIC_*` musí být nastavené **před buildem**.
3. V Supabase doplňte produkční adresu do *Site URL* a *Redirect URLs*.
4. Deploy. Aplikace je PWA – na telefonu ji lze „Přidat na plochu“.

---

## Role a oprávnění

| Role | Může |
|---|---|
| **Admin** | vše – obsah, uživatelé a role, pozvánky, nastavení portálu, evidence akcí |
| **Editor** | předměty, materiály, úkoly, testy, rozvrh, akce, oznámení, odkazy |
| **Student** | číst publikovaný obsah, stahovat soubory, označovat vlastní úkoly, oblíbené, upravit profil |
| *Neschválený / zablokovaný* | nevidí žádná data (stránka „Čeká na schválení“) |

Registrace: primárně **pozvánkou** (kód nebo odkaz `…/registrace?pozvanka=KÓD`). V *Administrace → Nastavení* lze registrace vypnout, vyžadovat pozvánku a zvolit, zda se pozvaní schvalují automaticky.

## Bezpečnost

- **RLS na všech tabulkách** – koncepty, archiv a soukromá data chrání databáze, ne skrytá tlačítka. Přímé API požadavky podléhají stejným pravidlům.
- **Role nelze změnit z klienta** – sloupce role/stav hlídá trigger, registrace roli admin nikdy neudělí.
- **Soukromé soubory** – bucket `materials` není veřejný. Stažení jde přes `/api/soubory/<id>`: ověří přihlášení, přes RLS zkontroluje, že rodičovský materiál/úkol je publikovaný, a vydá podepsaný odkaz platný 60 s.
- **Kontrola nahrávaných souborů** – povolená přípona, velikost a **skutečný obsah podle magických bajtů** (podvržený soubor se okamžitě smaže).
- **XSS** – zápisy se ukládají jako JSON a vykreslují vlastním rendererem, který escapuje text a propouští jen známé prvky a bezpečné URL.
- **Validace** – každý formulář validuje Zod na serveru (klientská validace je jen pro pohodlí).
- **Audit** – vytvoření/úpravy/mazání obsahu, změny rolí a nastavení se zapisují do `audit_logs` (čte jen admin).
- Minimum osobních údajů: jméno, e-mail (jen v Supabase Auth), volitelný avatar.

## Testy

```bash
npm test          # jednotkové + databázové testy (bez internetu, bez Dockeru)
npm run check     # typy + lint + testy
npm run test:e2e  # E2E proti TESTOVACÍ instanci Supabase
```

- `tests/db` – spouští **skutečné migrace** v PGlite (Postgres ve WASM) a ověřuje RLS: koncepty, neschválené účty, zákaz změny role, ochrana posledního admina, soukromé soubory, vyhledávání bez konceptů, unikátnost splnění úkolu…
- `tests/unit` – štítky termínů, střídání týdnů A/E/B/F, změny a slučování akcí v rozvrhu, validace souborů, bezpečné vykreslení zápisů.
- `tests/e2e` – 20 hlavních scénářů ze zadání. Vyžadují testovací projekt Supabase a dva účty (admin, student) v proměnných `E2E_*` – viz `.env.example`. Před prvním spuštěním: `npx playwright install chromium`.

## Struktura projektu

```
src/
  app/
    (auth)/          přihlášení, registrace, obnova hesla
    (portal)/        studentský portál (dashboard, předměty, materiály, úkoly, …)
    admin/           administrace
    api/             vyhledávání, autorizované stahování souborů
    auth/callback/   odkazy z e-mailů
  components/        UI komponenty (ui/, layout/, portal/, admin/, editor/, upload/)
  lib/
    actions/         server actions (vždy kontrolují oprávnění)
    data/            čtecí dotazy (přes RLS)
    validation/      Zod schémata
    supabase/        klienti Supabase (server, prohlížeč, admin)
  proxy.ts           obnova relace, přesměrování nepřihlášených
supabase/
  migrations/        schéma, RLS, triggery, Storage
  seed.sql           demonstrační data (jen lokálně)
tests/               db, unit, e2e
```

## Rozvrh

Rozvrh třídy funguje stejně jako ve Family Station: týdny se střídají **A → E → B → F** (pondělí 14. 9. 2026 = týden B), každý týden cyklu má vlastní výchozí rozvrh a nad ním se zadávají změny jen pro konkrétní týden:

| Štítek | Význam |
|---|---|
| S | změna / suplování (červený rámeček) |
| M | změna místnosti (červený čárkovaný) |
| N | nová hodina navíc (zelený) |
| A | akce třídy – navazující hodiny se spojí do jedné karty (zelený čárkovaný) |
| O | hodina odpadá (červený čárkovaný, přeškrtnuté) |
| V | celodenní volno / svátek (fialový) |

V **Administrace → Rozvrh** se klikem na hodinu upravuje výchozí rozvrh nebo změna pro daný týden, klikem na den celodenní volno či akce. Dále jsou tam záložky *Předměty a učitelé* (nabídka pro výběr) a *Období zobrazení* (od–do a nastavení střídání týdnů). Výchozí rozvrh se změnami nikdy nepřepisuje.

## Údržba v dalších letech

Označení třídy a školní rok se mění v **Administrace → Nastavení** – nic není pevně svázané s „I1.M“. Předměty lze archivovat (obsah zůstane zachován) a přidávat nové.

## Známá omezení první verze

- Push notifikace nejsou součástí (oznámení se zobrazují v aplikaci).
- Rozvrh se spravuje ručně – nejde o živá data z Bakalářů (veřejný rozvrh školy vyžaduje přihlášení). Výchozí data byla jednorázově importována z Family Station.
- Soubory Word/PowerPoint/Excel se nabízejí ke stažení; online prohlížeč by vyžadoval odeslání souboru třetí straně, proto není zapnutý.
- PWA nefunguje offline pro soukromá data (záměrně) – cachují se jen statické soubory.
