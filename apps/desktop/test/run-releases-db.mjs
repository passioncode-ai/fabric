// Owns a disposable local PostgreSQL cluster; never targets an existing DB (L8, ADR-0084).
// Applies the whole migration chain, then runs releases-db.test.mjs against it.
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const bin = process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
if (!existsSync(path.join(bin, 'initdb'))) {
  console.error('NOT_RUN: set FABRIC_PG_BIN to installed PostgreSQL binaries'); process.exit(2)
}
const dir = mkdtempSync(path.join(tmpdir(), 'fabric-releases-'))
const data = path.join(dir, 'data')
let started = false
const run = (name, args, input) => execFileSync(path.join(bin, name), args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] })
try {
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
  run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-F -k ${dir} -c listen_addresses='' -p 58443`, '-w', 'start'])
  started = true
  run('createdb', ['-h', dir, '-p', '58443', '-U', 'postgres', 'fabric_dispatch_test_releases'])
  const url = `postgresql://postgres@localhost:58443/fabric_dispatch_test_releases?host=${encodeURIComponent(dir)}`
  const sql = input => run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], input)
  sql(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text);`)
  const migrations = new URL('../../../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(migrations).filter(x => x.endsWith('.sql')).sort()) {
    sql(readFileSync(new URL(file, migrations), 'utf8'))
    sql(`insert into supabase_migrations.schema_migrations values ('${file.split('_')[0]}')`)
  }
  execFileSync(process.execPath, [new URL('./releases-db.test.mjs', import.meta.url).pathname], {
    stdio: 'inherit', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FABRIC_DISPATCH_TEST_DATABASE_URL: url }
  })
  console.log('PASS full migration chain, releases with their basis on isolated PostgreSQL')
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  rmSync(dir, { recursive: true, force: true })
}
