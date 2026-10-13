// #region resource-reservation-runner — docs: docs/execution/harness-waves/resource-reservation.md#verification
// One owned Unix-socket-only PostgreSQL cluster. No live DB or provider is addressed.
import { mkdtempSync, rmSync, existsSync, readFileSync, statfsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pgEnv } from "../../../../../apps/desktop/test/helpers/pg-env.mjs"
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
  const test = (name, extra = {}) => execFileSync(process.execPath, [new URL(name, new URL('../../../../../apps/desktop/test/run-resource-reservation-db.mjs', import.meta.url)).pathname], { stdio: 'inherit', env: { ...env, ...extra }, timeout: 120_000 })
  test('./continuation-dispatch-db.test.mjs', { FABRIC_DISPATCH_TEST_FULL_SCHEMA: '1' })
  // Deliberately fixture-applied: this proposal is NOT in the application's active chain.
  const migration = readFileSync(new URL('../../../supabase/pending-migrations/20261013000107_resource_reservations.sql', new URL('../../../../../apps/desktop/test/run-resource-reservation-db.mjs', import.meta.url)), 'utf8')
  run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], migration)
  const waitMigration = readFileSync(new URL('../../../supabase/pending-migrations/20261013000108_resource_wait_queue.sql', new URL('../../../../../apps/desktop/test/run-resource-reservation-db.mjs', import.meta.url)), 'utf8')
  run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], waitMigration)

  // Added owned-cluster source-negative control; no root runner modification.
  try {
    run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], "-- Run only in the owned disposable runner database, before or after correction.\n-- Original SQL: expected exit 1 at stale-writer assertion. Corrected SQL: exit 0.\n-- The transaction rolls back every fixture row; no production database is allowed.\nbegin;\ndrop function configure_resource_pool(text,text,text,jsonb,bigint,text,bigint);\ncreate function configure_resource_pool(p_host text,p_pool text,p_revision text,p_capacity jsonb,p_max_age_ms bigint)\nreturns boolean language plpgsql security definer set search_path=public as $$\ndeclare previous resource_pools;\nbegin\n if p_host is null or p_host !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' or p_pool is null or p_pool !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'\n  or p_revision is null or p_revision !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' or not resource_vector_valid(p_capacity)\n  or p_max_age_ms is null or p_max_age_ms not between 1 and 9007199254740991 then return false; end if;\n insert into resource_pools(host_id,pool_id,policy_revision,capacity,max_age_ms)\n values(p_host,p_pool,p_revision,p_capacity,p_max_age_ms) on conflict do nothing;\n select * into previous from resource_pools where host_id=p_host and pool_id=p_pool for update;\n if previous.policy_revision=p_revision and previous.capacity=p_capacity and previous.max_age_ms=p_max_age_ms then return true; end if;\n if previous.policy_revision=p_revision or exists(select 1 from resource_reservations where host_id=p_host and pool_id=p_pool and state='held') then return false; end if;\n update resource_pools set policy_revision=p_revision,capacity=p_capacity,max_age_ms=p_max_age_ms,observed=null,observed_at=null\n where host_id=p_host and pool_id=p_pool;\n return true;\nend $$;\ndo $$ begin\n if current_database() !~ '^fabric_dispatch_test_[a-z0-9_]+$' then\n  raise exception 'requires owned disposable resource fixture';\n end if;\nend $$;\nset local role service_role;\ndo $$\ndeclare capacity constant jsonb := '{\"workerSlots\":2,\"memoryBytes\":100,\"diskBytes\":100,\"cpuMilliCores\":100}';\nbegin\n if not configure_resource_pool('n024-negative-host','n024-negative-pool','new-policy',capacity,60000) then\n  raise exception 'fixture could not establish initial policy';\n end if;\n if configure_resource_pool('n024-negative-host','n024-negative-pool','old-policy',capacity,60000) then\n  raise exception 'stale five-argument writer rolled back the newer policy';\n end if;\nend $$;\nrollback;\n");
    throw Error('Original stale writer unexpectedly passed');
  } catch(error) {
    if (!String(error.stderr ?? error.message).includes('stale five-argument writer rolled back the newer policy')) throw error;
    console.log('EXPECTED_RED exact original configure allowed stale writer; transaction rolled back');
  }
  run('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1'], "-- Run only in the owned disposable runner database, before or after correction.\n-- Original SQL: expected exit 1 at stale-writer assertion. Corrected SQL: exit 0.\n-- The transaction rolls back every fixture row; no production database is allowed.\nbegin;\ndo $$ begin\n if current_database() !~ '^fabric_dispatch_test_[a-z0-9_]+$' then\n  raise exception 'requires owned disposable resource fixture';\n end if;\nend $$;\nset local role service_role;\ndo $$\ndeclare capacity constant jsonb := '{\"workerSlots\":2,\"memoryBytes\":100,\"diskBytes\":100,\"cpuMilliCores\":100}';\nbegin\n if not configure_resource_pool('n024-negative-host','n024-negative-pool','new-policy',capacity,60000) then\n  raise exception 'fixture could not establish initial policy';\n end if;\n if configure_resource_pool('n024-negative-host','n024-negative-pool','old-policy',capacity,60000) then\n  raise exception 'stale five-argument writer rolled back the newer policy';\n end if;\nend $$;\nrollback;\n");
  console.log('PASS same source-negative control on corrected configuration');

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
