#!/usr/bin/env node
// #region probe-fresh-vs-upgraded — docs: docs/launch/release-mac.md#upgrading-an-existing-database
// CO-199 / CO-201 on the path an install takes (Fabric 0.4.0 wave 1, REQ-32):
//
//   node scripts/test-stack.mjs run -- node scripts/probe-fresh-vs-upgraded.mjs [--from <count>]
//
// The stack `run` hands this probe is the FRESH database: `supabase start` applied the whole chain and the seed,
// as on a new Mac. The probe starts a second disposable stack holding only the first <count> migrations (default
// 76, the hub's first schema), writes through that schema's own door an access request that lives an hour — an
// event the door has refused since 77 — then upgrades it with the runbook's command, `supabase migration up
// --local`, and requires: the upgrade applies every later file (the CLI refuses one that sorts below an applied
// one), the estate rebuilds from its journal, and the two databases' `public` schemas are one
// (scripts/lib/schema-catalog.mjs). Both stacks are disposable (fabric_test_<hex>, their own ports); the live
// stack on 54321/54322 is refused by `checkTestStack` before anything connects.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { up, down } from './test-stack.mjs'
import { REPO_ROOT, checkTestStack, liveStack } from './lib/test-stack.mjs'
import { catalogOf, catalogDifferences } from './lib/schema-catalog.mjs'

const say = (m) => process.stderr.write(`probe-fresh-vs-upgraded: ${m}\n`)
const PG_BIN = process.env.FABRIC_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
const ESTATE = '00000000-0000-0000-0000-000000000001'
const at = process.argv.indexOf('--from')
const from = at >= 0 ? Number(process.argv[at + 1]) : 76
const files = readdirSync(path.join(REPO_ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort()
if (!Number.isInteger(from) || from < 76 || from >= files.length) { console.error(`--from takes a migration count from 76 to ${files.length - 1}`); process.exit(2) }

const refusals = checkTestStack(process.env, liveStack())
if (refusals.length) { for (const r of refusals) console.error(`REFUSED: ${r}`); process.exit(1) }

function psql(url, text) {
  const env = { ...process.env }
  for (const k of Object.keys(env)) if (k.startsWith('PG')) delete env[k]
  const r = spawnSync(path.join(PG_BIN, 'psql'), [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', text], { encoding: 'utf8', env, timeout: 120_000 })
  if (r.status !== 0) throw new Error(`psql: ${(r.stderr || '').trim().split('\n').slice(0, 4).join(' | ')}`)
  return r.stdout.trim()
}
const json = (url, q) => JSON.parse(psql(url, q))
const hubRows = (url) => json(url, `select jsonb_build_object(${['access_requests', 'access_bindings', 'access_grants', 'product_connections']
  .map((t) => `'${t}', (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from ${t} x)`).join(',')})`)

let failures = 0
const check = (name, ok, detail = '') => { if (ok) console.log(`PASS ${name}`); else { failures++; console.log(`FAIL ${name}${detail ? `\n     ${detail}` : ''}`) } }

const fresh = process.env.DATABASE_URL
const dir = mkdtempSync(path.join(realpathSync(tmpdir()), 'fabric-test-stack.'))
rmSync(dir, { recursive: true, force: true })
let stack = null
try {
  say(`starting a second disposable stack at migration count ${from} (${files[from - 1]})`)
  stack = await up(dir, { migrationCount: from, seed: true })
  const old = stack.env.DATABASE_URL
  const guard = checkTestStack({ ...process.env, ...stack.env }, liveStack())
  if (guard.length) throw new Error(`the second stack is not disposable: ${guard.join('; ')}`)
  check(`the old database is at ${from}`, psql(old, 'select public.schema_version()') === String(from))
  // Written through the door of its day: at 76 nothing refused a request that lives an hour.
  const request = { id: '8200000b-0000-4000-8000-000000000001', agent_id: 'example-agent', callee: 'fabric-inbox', capabilities: ['list_messages'],
    resources: ['cloudflare:news@example.com'], reason: 'fresh-vs-upgraded probe', registry: {}, binding_id: null,
    expires_at: new Date(Date.now() + 3600_000).toISOString() }
  let planted = false
  try {
    psql(old, `select append_event('${ESTATE}', 'access.requested@1', '{"kind":"system","id":"fabric-hub"}'::jsonb, '${JSON.stringify(request)}'::jsonb, '1', null)`)
    planted = true
  } catch (e) { say(`the old schema refused the planted request (${e.message}); the rebuild check still runs`) }
  if (from === 76) check('at 76 the door accepted a request that lives an hour', planted)

  const target = path.join(dir, 'supabase', 'migrations')
  for (const f of files.slice(from)) cpSync(path.join(REPO_ROOT, 'supabase', 'migrations', f), path.join(target, f))
  const env = { ...process.env }
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'SUPABASE_PROJECT_ID', 'SUPABASE_WORKDIR']) delete env[k]
  const mig = spawnSync('supabase', ['migration', 'up', '--local', '--workdir', dir], { encoding: 'utf8', env, timeout: 900_000 })
  check(`supabase migration up --local applies ${files.length - from} later file(s) without --include-all`, mig.status === 0,
    (mig.stderr || mig.stdout || '').trim().split('\n').slice(-4).join(' | '))
  check(`the upgraded database is at ${files.length}`, psql(old, 'select public.schema_version()') === String(files.length))

  const before = hubRows(old)
  let rebuilt = true, why = ''
  try { psql(old, `select rebuild_estate_projections('${ESTATE}')`) } catch (e) { rebuilt = false; why = e.message }
  check('CO-201: the upgraded estate rebuilds from its journal', rebuilt, why)
  check('CO-201: and every hub projection row is as it was', JSON.stringify(hubRows(old)) === JSON.stringify(before))

  const differences = catalogDifferences(catalogOf((q) => json(old, q)), catalogOf((q) => json(fresh, q)))
  check('CO-199: the upgraded database is the schema a fresh install makes', differences.length === 0,
    differences.map((d) => `${d.part}: ${d.counts.join('/')} rows differ, e.g. ${d.onlyFirst[0] ?? d.onlySecond[0]}`).join('\n     '))
} catch (e) {
  failures++
  console.log(`FAIL the probe could not run: ${e.message}`)
} finally {
  if (stack) { try { down(dir) } catch (e) { say(`could not remove the second stack: ${e.message}`) } }
}
console.log(failures ? `FAIL ${failures} check(s)` : 'all green: fresh and upgraded are one schema, and the upgraded estate rebuilds')
process.exit(failures ? 1 : 0)
// #endregion probe-fresh-vs-upgraded
