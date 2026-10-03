// A disposable PostgreSQL cluster this process owns, with the whole migration
// chain applied (L8, ADR-0084).
//
// The older `run-*-db.mjs` runners each carry this code inline; it is the
// same sequence they run, extracted once for the runners added with the
// 2026-10-03 release-review fixes rather than copied a twelfth time (migration
// 75 moved the releases and board-deferral runners onto it too). It never
// targets an existing database: `initdb` into a temporary directory, a Unix
// socket only (`listen_addresses=''`), and the directory removed afterwards.
//
// `FABRIC_SKIP_MIGRATION` names one migration file to leave out. It exists so a
// fix can be WATCHED failing against the chain without it (AGENTS.md: a planted
// defect is watched being caught) — never set it in CI.
//
// `supabaseDefaults: true` puts Supabase's default privileges in force BEFORE the chain:
// every function, table and sequence a migration creates in `public` is then granted to
// anon, authenticated and service_role, as on every Supabase project. A bare cluster has
// no such default, so a migration that revokes from `public` alone looks closed here and is
// open on Supabase (migration 75 measured three such commands). Privilege sweeps run with it.
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

export function withOwnedPostgres({ name, port, supabaseDefaults = false }, body) {
  const bin = process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
  if (!existsSync(path.join(bin, 'initdb'))) {
    console.error('NOT_RUN: set FABRIC_PG_BIN to installed PostgreSQL binaries')
    process.exit(2)
  }
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error('owned database names are [a-z0-9_]+')
  const dir = mkdtempSync(path.join(tmpdir(), `fabric-${name}-`))
  const data = path.join(dir, 'data')
  let started = false
  const run = (tool, args, input) =>
    execFileSync(path.join(bin, tool), args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] })
  try {
    run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
    run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-F -k ${dir} -c listen_addresses='' -p ${port}`, '-w', 'start'])
    started = true
    const db = `fabric_dispatch_test_${name}`
    run('createdb', ['-h', dir, '-p', String(port), '-U', 'postgres', db])
    const url = `postgresql://postgres@localhost:${port}/${db}?host=${encodeURIComponent(dir)}`
    const sql = (input) => run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], input)
    sql(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text);`)
    if (supabaseDefaults)
      sql(`alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;`)
    const migrations = new URL('../../../../supabase/migrations/', import.meta.url)
    const skip = process.env.FABRIC_SKIP_MIGRATION ?? ''
    for (const file of readdirSync(migrations).filter((x) => x.endsWith('.sql')).sort()) {
      if (skip && file === skip) {
        console.log(`  (chain applied WITHOUT ${file} — a watched-failure run, not a receipt)`)
        continue
      }
      sql(readFileSync(new URL(file, migrations), 'utf8'))
      sql(`insert into supabase_migrations.schema_migrations values ('${file.split('_')[0]}')`)
    }
    return body({ url, bin })
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Run one test file against the owned cluster, the way the runners do. */
export function runAgainst(url, bin, testFile) {
  execFileSync(process.execPath, ['--experimental-strip-types', testFile], {
    stdio: 'inherit',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FABRIC_DISPATCH_TEST_DATABASE_URL: url }
  })
}
