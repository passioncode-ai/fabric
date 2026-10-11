// Owns one disposable PostgreSQL 17 cluster (initdb into a temporary directory, a unix socket only,
// listen_addresses=''), runs write-rules-db.test.mjs in it, and removes it. No caller database is accepted.
// FABRIC_SKIP_MIGRATION=<file> leaves one migration out, to WATCH the test fail without it (never in CI).
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { pgEnv } from './helpers/pg-env.mjs'

const bin = process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
if (!existsSync(path.join(bin, 'initdb'))) {
  console.error('NOT_RUN: set FABRIC_PG_BIN to PostgreSQL 17 binaries')
  process.exit(2)
}
const env = { ...pgEnv() }
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key]
const run = (tool, args) => execFileSync(path.join(bin, tool), args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })
if (!/PostgreSQL\) 17\./.test(run('postgres', ['--version']))) throw new Error('The write-rules replay test requires PostgreSQL 17')
const dir = mkdtempSync(path.join(tmpdir(), 'fabric-write-rules-'))
const data = path.join(dir, 'data'), nonce = randomUUID(), port = '58591'
let started = false
let code = 0
try {
  writeFileSync(path.join(dir, 'owner'), nonce, { mode: 0o600 })
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
  run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o',
    `-F -k '${dir.replaceAll("'", "'\\''")}' -c listen_addresses='' -p ${port}`, '-w', 'start'])
  started = true
  try {
    execFileSync(process.execPath, [new URL('./write-rules-db.test.mjs', import.meta.url).pathname], {
      stdio: 'inherit', timeout: 300_000, env: { ...env, FABRIC_WRITE_RULES_DB_DIR: dir, FABRIC_WRITE_RULES_DB_NONCE: nonce, FABRIC_WRITE_RULES_PG_BIN: bin, FABRIC_WRITE_RULES_PORT: port }
    })
  } catch (e) { code = typeof e.status === 'number' ? e.status : 1 }
} finally {
  if (started || existsSync(path.join(data, 'postmaster.pid'))) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  rmSync(dir, { recursive: true, force: true })
  if (existsSync(dir)) throw new Error('Owned PostgreSQL directory was not removed')
  console.log('PASS cleanup: owned PostgreSQL stopped; socket and data removed')
}
process.exit(code)
