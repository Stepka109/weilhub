/**
 * Automatizované testy kritických bezpečnostních pravidel databáze.
 * Spouštějí skutečné migrace (supabase/migrations) v PGlite.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asSuperuser, asUser, createTestDb, createUser, setProfile, type Db } from "./harness";

let db: Db;
let adminId: string;
let editorId: string;
let studentId: string;
let pendingId: string;
const SUBJECT = "10000000-0000-4000-8000-000000000004";

async function count(sql: string, params: unknown[] = []) {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return res.rows[0].n;
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
  adminId = await createUser(db, "admin@test.cz", { invite_code: "DEMO-POZVANKA", display_name: "Admin" });
  await asSuperuser(db);
  await db.query("select public.bootstrap_first_admin('admin@test.cz')");
  editorId = await createUser(db, "editor@test.cz", { invite_code: "DEMO-POZVANKA" });
  await setProfile(db, editorId, "editor");
  studentId = await createUser(db, "student@test.cz", { invite_code: "DEMO-POZVANKA", display_name: "Jana" });
  await asSuperuser(db);
  await db.query("update public.app_settings set registration_requires_invite = false");
  pendingId = await createUser(db, "cekajici@test.cz");
  await db.query("update public.app_settings set registration_requires_invite = true");
}, 60_000);

describe("registrace a role", () => {
  it("registrace přes pozvánku vytvoří schváleného studenta, nikdy admina", async () => {
    await asSuperuser(db);
    const res = await db.query<{ role: string; status: string; display_name: string }>(
      "select role, status, display_name from public.profiles where id = $1",
      [studentId],
    );
    expect(res.rows[0]).toEqual({ role: "student", status: "approved", display_name: "Jana" });
  });

  it("registrace bez pozvánky je zablokovaná, pokud je pozvánka vyžadována", async () => {
    await expect(createUser(db, "cizi@test.cz")).rejects.toThrow(/pozvánku/);
  });

  it("registrace bez pozvánky (je-li povolena) čeká na schválení", async () => {
    await asSuperuser(db);
    const res = await db.query<{ status: string }>("select status from public.profiles where id = $1", [pendingId]);
    expect(res.rows[0].status).toBe("pending");
  });

  it("metadata registrace nemohou udělit roli admin", async () => {
    const id = await createUser(db, "hacker@test.cz", { invite_code: "DEMO-POZVANKA", role: "admin" });
    await asSuperuser(db);
    const res = await db.query<{ role: string }>("select role from public.profiles where id = $1", [id]);
    expect(res.rows[0].role).toBe("student");
  });

  it("student si nemůže změnit roli ani stav", async () => {
    await asUser(db, studentId);
    await expect(db.query("update public.profiles set role = 'admin' where id = $1", [studentId])).rejects.toThrow(
      /oprávnění/,
    );
    await expect(
      db.query("update public.profiles set status = 'approved' where id = $1", [pendingId]),
    ).resolves.toBeDefined(); // RLS – řádek není viditelný, nic se nezmění
    await asSuperuser(db);
    const res = await db.query<{ status: string }>("select status from public.profiles where id = $1", [pendingId]);
    expect(res.rows[0].status).toBe("pending");
  });

  it("student smí změnit své zobrazované jméno", async () => {
    await asUser(db, studentId);
    await db.query("update public.profiles set display_name = 'Jana N.' where id = $1", [studentId]);
    const res = await db.query<{ display_name: string }>("select display_name from public.profiles where id = $1", [
      studentId,
    ]);
    expect(res.rows[0].display_name).toBe("Jana N.");
  });

  it("nelze odebrat posledního administrátora", async () => {
    await asUser(db, adminId);
    await expect(db.query("update public.profiles set role = 'student' where id = $1", [adminId])).rejects.toThrow(
      /posledního administrátora/,
    );
  });

  it("bootstrap prvního admina nelze spustit podruhé ani z klienta", async () => {
    await asSuperuser(db);
    await expect(db.query("select public.bootstrap_first_admin('student@test.cz')")).rejects.toThrow(/již existuje/);
    await asUser(db, studentId);
    await expect(db.query("select public.bootstrap_first_admin('student@test.cz')")).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("viditelnost obsahu", () => {
  it("student nevidí koncepty materiálů", async () => {
    await asUser(db, studentId);
    expect(await count("select 1 from public.materials where status <> 'published'")).toBe(0);
    expect(await count("select 1 from public.materials")).toBe(2);
  });

  it("editor vidí i koncepty", async () => {
    await asUser(db, editorId);
    expect(await count("select 1 from public.materials")).toBe(3);
  });

  it("neschválený uživatel nevidí žádná studentská data", async () => {
    await asUser(db, pendingId);
    expect(await count("select 1 from public.materials")).toBe(0);
    expect(await count("select 1 from public.subjects")).toBe(0);
    expect(await count("select 1 from public.assignments")).toBe(0);
    expect(await count("select 1 from public.timetable_slots")).toBe(0);
    expect(await count("select 1 from public.timetable_overrides")).toBe(0);
  });

  it("nepřihlášený uživatel nemá k obsahu přístup", async () => {
    await asAnon(db);
    await expect(db.query("select * from public.materials")).rejects.toThrow(/permission denied/);
    const settings = await db.query("select portal_name from public.app_settings");
    expect(settings.rows).toHaveLength(1);
  });

  it("vyhledávání nevrací koncepty", async () => {
    await asUser(db, studentId);
    const res = await db.query<{ title: string }>("select title from public.search_content('koncept')");
    expect(res.rows).toHaveLength(0);
    const ok = await db.query<{ title: string }>("select title from public.search_content('ciselnymi')");
    expect(ok.rows.map((r) => r.title)).toContain("[DEMO] Převody mezi číselnými soustavami");
  });

  it("vyhledávání escapuje zástupné znaky LIKE", async () => {
    await asUser(db, studentId);
    const res = await db.query("select * from public.search_content('%')");
    expect(res.rows).toHaveLength(0);
  });
});

describe("zápis obsahu", () => {
  it("student nemůže vytvořit, upravit ani smazat materiál", async () => {
    await asUser(db, studentId);
    await expect(
      db.query("insert into public.materials (subject_id, title) values ($1, 'Hack')", [SUBJECT]),
    ).rejects.toThrow(/row-level security/);
    await db.query("update public.materials set title = 'Hack'");
    await db.query("delete from public.materials");
    await asSuperuser(db);
    expect(await count("select 1 from public.materials where title = 'Hack'")).toBe(0);
    expect(await count("select 1 from public.materials")).toBe(3);
  });

  it("editor může vytvořit a publikovat materiál; published_at se doplní", async () => {
    await asUser(db, editorId);
    const res = await db.query<{ id: string; published_at: string | null; created_by: string }>(
      "insert into public.materials (subject_id, title, status) values ($1, 'Nový zápis', 'published') returning id, published_at, created_by",
      [SUBJECT],
    );
    expect(res.rows[0].published_at).not.toBeNull();
    expect(res.rows[0].created_by).toBe(editorId);
    await asUser(db, studentId);
    expect(await count("select 1 from public.materials where title = 'Nový zápis'")).toBe(1);
  });

  it("tematický okruh musí patřit ke stejnému předmětu", async () => {
    await asUser(db, editorId);
    await expect(
      db.query(
        "insert into public.materials (subject_id, topic_id, title) values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'X')",
      ),
    ).rejects.toThrow(/nepatří/);
  });

  it("editor nemůže měnit role ani nastavení portálu", async () => {
    await asUser(db, editorId);
    await expect(db.query("update public.profiles set role = 'admin' where id = $1", [editorId])).rejects.toThrow(
      /oprávnění/,
    );
    await db.query("update public.app_settings set portal_name = 'Hack'");
    await asSuperuser(db);
    const res = await db.query<{ portal_name: string }>("select portal_name from public.app_settings");
    expect(res.rows[0].portal_name).toBe("WeilHub");
  });

  it("úpravy se zapisují do auditu, který čte jen admin", async () => {
    await asUser(db, studentId);
    expect(await count("select 1 from public.audit_logs")).toBe(0);
    await asUser(db, adminId);
    expect(await count("select 1 from public.audit_logs where entity = 'materials'")).toBeGreaterThan(0);
  });
});

describe("osobní stav úkolů", () => {
  it("dokončení úkolu je soukromé a unikátní pro dvojici uživatel + úkol", async () => {
    await asUser(db, studentId);
    const a = await db.query<{ id: string }>("select id from public.assignments limit 1");
    const id = a.rows[0].id;
    await db.query("insert into public.assignment_completions (assignment_id) values ($1)", [id]);
    await expect(
      db.query("insert into public.assignment_completions (assignment_id) values ($1)", [id]),
    ).rejects.toThrow(/duplicate key/);

    await asUser(db, editorId);
    expect(await count("select 1 from public.assignment_completions")).toBe(0);
  });

  it("nelze označit úkol jménem jiného uživatele", async () => {
    await asUser(db, studentId);
    const a = await db.query<{ id: string }>("select id from public.assignments limit 1 offset 1");
    await expect(
      db.query("insert into public.assignment_completions (user_id, assignment_id) values ($1, $2)", [
        editorId,
        a.rows[0].id,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("soubory v úložišti", () => {
  it("student smí číst jen soubory publikovaných materiálů", async () => {
    await asSuperuser(db);
    await db.exec(`
      insert into public.material_files (material_id, role, storage_path, file_name, mime_type, size_bytes) values
        ('30000000-0000-4000-8000-000000000001', 'main', 'materials/pub.pdf', 'pub.pdf', 'application/pdf', 100),
        ('30000000-0000-4000-8000-000000000003', 'main', 'materials/draft.pdf', 'draft.pdf', 'application/pdf', 100);
      insert into storage.objects (bucket_id, name) values ('materials', 'materials/pub.pdf'), ('materials', 'materials/draft.pdf');
    `);
    await asUser(db, studentId);
    const res = await db.query<{ name: string }>("select name from storage.objects where bucket_id = 'materials'");
    expect(res.rows.map((r) => r.name)).toEqual(["materials/pub.pdf"]);

    await asUser(db, pendingId);
    expect(await count("select 1 from storage.objects where bucket_id = 'materials'")).toBe(0);
  });

  it("student nemůže nahrávat do bucketu materiálů", async () => {
    await asUser(db, studentId);
    await expect(
      db.query("insert into storage.objects (bucket_id, name) values ('materials', 'materials/x.pdf')"),
    ).rejects.toThrow(/row-level security/);
  });

  it("avatar lze nahrát pouze do vlastní složky", async () => {
    await asUser(db, studentId);
    await db.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${studentId}/a.png`]);
    await expect(
      db.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${editorId}/a.png`]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("rozvrh se střídáním týdnů", () => {
  it("import obsahuje rozvrh I1.M pro týdny A, E, B, F", async () => {
    await asUser(db, studentId);
    const res = await db.query<{ cycle_week: string; n: number }>(
      "select cycle_week, count(*)::int as n from public.timetable_slots group by cycle_week order by cycle_week",
    );
    expect(res.rows).toEqual([
      { cycle_week: "A", n: 32 },
      { cycle_week: "B", n: 32 },
      { cycle_week: "E", n: 32 },
      { cycle_week: "F", n: 32 },
    ]);
    expect(await count("select 1 from public.timetable_subjects")).toBe(14);
  });

  it("student nemůže měnit rozvrh, redaktor ano", async () => {
    await asUser(db, studentId);
    await expect(
      db.query("insert into public.timetable_overrides (week_start, day_of_week, lesson_number, kind) values ('2026-10-12', 1, 1, 'cancelled')"),
    ).rejects.toThrow(/row-level security/);
    await asUser(db, editorId);
    await db.query(
      "insert into public.timetable_overrides (week_start, day_of_week, lesson_number, kind) values ('2026-10-19', 1, 1, 'cancelled')",
    );
  });

  it("změna musí patřit k pondělí a být platná", async () => {
    await asUser(db, editorId);
    await expect(
      db.query("insert into public.timetable_overrides (week_start, day_of_week, lesson_number, kind) values ('2026-10-13', 1, 1, 'cancelled')"),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query("insert into public.timetable_overrides (week_start, day_of_week, lesson_number, kind) values ('2026-10-26', 1, 1, 'changed')"),
    ).rejects.toThrow(/check constraint/);
  });
});
