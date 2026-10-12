/**
 * Testovací prostředí databáze: spouští skutečné migrace WeilHubu v PGlite
 * (PostgreSQL ve WebAssembly) se zjednodušenou náhradou schémat Supabase
 * (auth, storage, role anon/authenticated/service_role).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
`;

export type Db = PGlite;

export async function createTestDb(options: { seed?: boolean } = {}): Promise<Db> {
  const db = await PGlite.create({ extensions: { unaccent } });
  await db.exec(SUPABASE_STUB);

  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  // V Supabase mají role authenticated/service_role výchozí práva na nové tabulky.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to service_role;
    grant select, insert, delete on all tables in schema public to authenticated;
    grant update on all tables in schema public to authenticated;
    revoke update on public.profiles from authenticated;
    grant update (display_name, avatar_path, preferences, role, status) on public.profiles to authenticated;
    grant usage on all sequences in schema public to authenticated;
  `);

  if (options.seed) {
    await db.exec(readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8"));
  }
  return db;
}

/** Vytvoří uživatele přes auth.users (spustí registrační trigger). */
export async function createUser(
  db: Db,
  email: string,
  meta: Record<string, string> = {},
): Promise<string> {
  await asSuperuser(db);
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return res.rows[0].id;
}

export async function asSuperuser(db: Db) {
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
}

export async function asUser(db: Db, userId: string) {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated;");
}

export async function asAnon(db: Db) {
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;");
}

/** Nastaví roli a stav přímo (jako by to udělal administrátor). */
export async function setProfile(db: Db, userId: string, role: string, status = "approved") {
  await asSuperuser(db);
  await db.query("update public.profiles set role = $2::public.app_role, status = $3::public.account_status where id = $1", [
    userId,
    role,
    status,
  ]);
}
