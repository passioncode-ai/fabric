// Connections to databases inside the one owned cluster that run-ceo-private-archive-db.mjs
// starts. Nothing here reaches a caller's database: the socket directory and its nonce file
// are checked before the first statement.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'

export function ownedCluster() {
  const dir = process.env.FABRIC_ARCHIVE_DB_DIR, nonce = process.env.FABRIC_ARCHIVE_DB_NONCE, bin = process.env.FABRIC_ARCHIVE_PG_BIN
  if (!dir || !nonce || !bin || !process.env.FABRIC_ARCHIVE_DB_NAME) { console.error('NOT_RUN: use run-ceo-private-archive-db.mjs'); process.exit(2) }
  assert.match(path.basename(dir), /^fabric-ceo-private-archive-[a-zA-Z0-9]+$/)
  assert.equal(readFileSync(path.join(dir, 'owner'), 'utf8'), nonce)
  return { dir, bin, db: process.env.FABRIC_ARCHIVE_DB_NAME }
}

export const lit = v => `convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
export const uuid = v => `${lit(v)}::uuid`
export const jsonb = v => `${lit(typeof v === 'string' ? v : JSON.stringify(v))}::jsonb`
export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export function connect({ dir, bin }, db) {
  const args = ['-h', dir, '-p', '58467', '-U', 'postgres', '-d', db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
  const sql = input => execFileSync(path.join(bin, 'psql'), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  const sqlAsync = input => runPsqlAsync(path.join(bin, 'psql'), args, input).then(r => {
    if (r.code !== 0) throw new Error(r.stderr)
    return r.stdout.trim()
  })
  return { sql, sqlAsync, rpc: q => JSON.parse(sql('set role service_role;select ' + q)) }
}

/** A new database in the owned cluster with the whole migration chain applied. */
export function freshDatabase(cluster, db) {
  const admin = connect(cluster, cluster.db)
  admin.sql(`create database ${db}`)
  const c = connect(cluster, db)
  assert.equal(realpathSync(c.sql('show data_directory')), realpathSync(path.join(cluster.dir, 'data')))
  assert.equal(c.sql("select count(*) from pg_tables where schemaname='public'"), '0')
  // Roles are cluster-wide: a later database finds them already made.
  c.sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;create role authenticated;create role service_role bypassrls; end if; end $$;
create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.auth_uid',true),'')::uuid$$;
create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text);`)
  const migrations = new URL('../../../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    c.sql(readFileSync(new URL(file, migrations), 'utf8'))
    c.sql(`insert into supabase_migrations.schema_migrations values(${lit(file.split('_')[0])})`)
  }
  return c
}

/** The ordinary archive of one Estate as `backup.take` writes it: lineOf key order, seq as a
 * number, timestamps as PostgREST text at microsecond precision — never through a JS Date. */
export function journalLines(c, estate) {
  const rows = JSON.parse(c.sql(`select coalesce(jsonb_agg(jsonb_build_object('seq',seq,'type',type,'schema_rev',schema_rev,'actor',actor,
    'project_id',project_id,'run_id',run_id,'node_id',node_id,'payload',payload,
    'occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'+00:00') order by seq),'[]') from journal where estate_id=${uuid(estate)}`))
  return rows.map(r => JSON.stringify({ seq: r.seq, type: r.type, schema_rev: r.schema_rev, actor: r.actor, project_id: r.project_id,
    run_id: r.run_id, node_id: r.node_id, payload: r.payload, occurred_at: r.occurred_at }))
}
