// #region resource-reservation-runner — docs: docs/execution/harness-waves/resource-reservation.md#verification
// One owned Unix-socket-only PostgreSQL cluster. No live DB or provider is addressed.
import { mkdtempSync, rmSync, existsSync, readFileSync, statfsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pgEnv } from './helpers/pg-env.mjs'
const bin = process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'
if (!existsSync(path.join(bin, 'initdb'))) { console.error('NOT_RUN: set FABRIC_PG_BIN'); process.exit(2) }
const space = statfsSync(tmpdir())
if (space.bavail * space.bsize < 1.5 * 1024 ** 3) { console.error('NOT_RUN: disposable fixture needs 1.5 GiB free to preserve 1 GiB reserve'); process.exit(2) }
const dir = mkdtempSync(path.join(tmpdir(), 'fabric-resources-'))
const data = path.join(dir, 'data')
let started = false
const run = (name, args, input) => execFileSync(path.join(bin, name), args, { input, encoding: 'utf8', env: pgEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
try {
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '-E', 'UTF8'])
  run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-F -k ${dir} -c listen_addresses='' -p 58438`, '-w', 'start'])
  started = true
  run('createdb', ['-h', dir, '-p', '58438', '-U', 'postgres', 'fabric_dispatch_test_resources'])
  const url = `postgresql://postgres@localhost:58438/fabric_dispatch_test_resources?host=${encodeURIComponent(dir)}`
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FABRIC_DISPATCH_TEST_DATABASE_URL: url }
  const test = (name, extra = {}) => execFileSync(process.execPath, [new URL(name, import.meta.url).pathname], { stdio: 'inherit', env: { ...env, ...extra }, timeout: 120_000 })
  test('./continuation-dispatch-db.test.mjs', { FABRIC_DISPATCH_TEST_FULL_SCHEMA: '1' })
  // Deliberately fixture-applied: this proposal is NOT in the application's active chain.
  const migration = readFileSync(new URL('../../../supabase/pending-migrations/20261013000107_resource_reservations.sql', import.meta.url), 'utf8')
  run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], migration)
  const waitMigration = readFileSync(new URL('../../../supabase/pending-migrations/20261013000108_resource_wait_queue.sql', import.meta.url), 'utf8')
  run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], waitMigration)
  test('./managed-launch-db.test.mjs')
  test('./managed-stop-db.test.mjs')
  test('./resource-reservation-db.test.mjs')
  test('./resource-reconciliation-db.test.mjs')
  test('./resource-wait-store-db.test.mjs')
  console.log('PASS pending R2/R5 SQL plus recovery and legacy managed launch/stop on one disposable PostgreSQL cluster')
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  rmSync(dir, { recursive: true, force: true })
}
// #endregion resource-reservation-runner
