#!/usr/bin/env node
// #region rehearse-upgrade — docs: docs/launch/release-mac.md#upgrading-an-existing-database
// The executable rehearsal of a database upgrade (CO-198): runbook steps 3 and 5 as commands.
//
//   node scripts/rehearse-upgrade.mjs --dump <private.dump> [--ref <tag or commit>] [--from <schema>]
//                                     [--receipt <file>] [--keep]
//   node scripts/rehearse-upgrade.mjs --make-fixture <migration count> --out <file.dump>
//
// It never touches the operator's stack (project `fabric`, ports 54321/54322): everything happens in
// a disposable stack from `scripts/test-stack.mjs`, started with NO migrations so it holds only what
// Supabase itself provides (roles, extensions, auth). The dump's `public` schema and its migration
// ledger are restored into it, then the candidate's migrations are copied in and applied with
// `supabase migration up --local` — the very command of runbook step 4. Before and after, it reads
// `public.schema_version()`, the journal count and every public table's row count, judges them
// (`scripts/lib/rehearse-upgrade.mjs`) and writes a mode-600 receipt beside the dump: numbers only,
// never a row of data. The stack is removed afterwards unless --keep.
//
// --make-fixture builds a synthetic dump shaped like an older release: a disposable stack with only the
// first N migrations, the seed's estate and a few journal events. It is how this rehearsal is itself tested. The seed
// is this checkout's, so since 0.3.4 the fixture's estate is owned by the app's person: it rehearses the upgrade's
// counts, not CO-241 (that is apps/desktop/test/first-install-db.test.mjs, 0.3.4 verification, iteration 3, DA-2).
import { spawnSync, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { up, down } from './test-stack.mjs'
import { REPO_ROOT } from './lib/test-stack.mjs'
import { isPgMajor, dumpProblems, restoreList, judge, receipt } from './lib/rehearse-upgrade.mjs'

const say = (m) => process.stderr.write(`rehearse-upgrade: ${m}\n`)
const PG_BIN = process.env.FABRIC_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin'
const ESTATE = '00000000-0000-0000-0000-000000000001'

function tool(name, args, { input, timeout = 600_000 } = {}) {
  const r = spawnSync(path.join(PG_BIN, name), args, { input, encoding: 'utf8', timeout, env: pgEnv() })
  if (r.error) throw new Error(`${name} could not run: ${r.error.message}`)
  if (r.status !== 0) throw new Error(`${name} exited ${r.status}: ${(r.stderr || '').trim().split('\n').slice(-14).join(' | ')}`)
  return r.stdout
}
/** The client reads the target from its arguments only, never an operator's PG* variables. */
function pgEnv() {
  const env = { ...process.env }
  for (const k of Object.keys(env)) if (k.startsWith('PG')) delete env[k]
  return env
}
const sql = (url, text) => tool('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', text], { timeout: 120_000 }).trim()

function checkClient() {
  for (const name of ['psql', 'pg_dump', 'pg_restore']) {
    const line = tool(name, ['--version']).trim()
    if (!isPgMajor(line)) throw new Error(`${name} at ${PG_BIN} is "${line}"; the stack runs PostgreSQL 17 (set FABRIC_PG_BIN)`)
  }
  return tool('pg_restore', ['--version']).trim()
}

/** Schema version, journal count and every public base table's row count. */
function readState(url) {
  const schemaVersion = Number(sql(url, 'select public.schema_version()'))
  const journal = Number(sql(url, 'select count(*) from public.journal'))
  const names = sql(url, "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1").split('\n').filter(Boolean)
  const tables = {}
  if (names.length) {
    const q = names.map((n) => `select ${quoteLiteral(n)}, count(*) from public.${quoteIdent(n)}`).join(' union all ')
    for (const line of sql(url, q).split('\n').filter(Boolean)) {
      const i = line.lastIndexOf('|')
      tables[line.slice(0, i)] = Number(line.slice(i + 1))
    }
  }
  return { schemaVersion, journal, tables }
}
const quoteIdent = (s) => '"' + String(s).replace(/"/g, '""') + '"'
const quoteLiteral = (s) => "'" + String(s).replace(/'/g, "''") + "'"

/** The candidate's migrations and admitted schema: this checkout, or a ref through `git archive`. */
function candidate(ref) {
  if (!ref) {
    const dir = path.join(REPO_ROOT, 'supabase', 'migrations')
    const contract = JSON.parse(readFileSync(path.join(REPO_ROOT, 'apps/desktop/src/shared/schemaContract.json'), 'utf8'))
    const commit = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    return { ref: 'checkout', commit, dir, expected: contract.maximum, count: readdirSync(dir).filter((f) => f.endsWith('.sql')).length, cleanup() {} }
  }
  const commit = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', `${ref}^{commit}`], { encoding: 'utf8' }).trim()
  const tmp = mkdtempSync(path.join(realpathSync(tmpdir()), 'fabric-candidate-'))
  const tar = execFileSync('git', ['-C', REPO_ROOT, 'archive', commit, 'supabase/migrations', 'apps/desktop/src/shared/schemaContract.json'], { maxBuffer: 512 * 1024 * 1024 })
  execFileSync('tar', ['-x', '-C', tmp], { input: tar })
  const dir = path.join(tmp, 'supabase', 'migrations')
  const contract = JSON.parse(readFileSync(path.join(tmp, 'apps/desktop/src/shared/schemaContract.json'), 'utf8'))
  return { ref, commit, dir, expected: contract.maximum, count: readdirSync(dir).filter((f) => f.endsWith('.sql')).length, cleanup: () => rmSync(tmp, { recursive: true, force: true }) }
}

function supabase(args, timeout = 900_000) {
  const r = spawnSync('supabase', args, { encoding: 'utf8', timeout })
  if (r.status !== 0) throw new Error(`supabase ${args[0]} exited ${r.status ?? r.signal}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-8).join(' | ')}`)
  return r.stdout
}

/** `up()` can fail after containers exist (a refused stack, a timed-out health check): whatever it
 *  left behind under its marker is removed here, so a failed rehearsal never leaves a stack running. */
async function startStack(dir, options) {
  try { return await up(dir, options) }
  catch (e) {
    if (existsSync(path.join(dir, '.fabric-test-stack.json'))) { try { down(dir) } catch (d) { say(`could not remove the half-started stack: ${d.message}`) } }
    throw e
  }
}

async function rehearse({ dump, ref, from, receiptFile, keep }) {
  const t0 = Date.now(), timings = {}
  const tools = { client: checkClient(), supabase: supabase(['--version'], 60_000).trim() }
  if (!existsSync(dump)) throw new Error(`no dump at ${dump}`)
  const toc = tool('pg_restore', ['--list', dump])
  const problems = dumpProblems(toc)
  if (problems.length) throw new Error(problems.join('; '))
  const bytes = readFileSync(dump)
  const dumpFacts = { file: path.basename(dump), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
  const cand = candidate(ref)
  if (cand.count !== cand.expected) say(`note: the candidate holds ${cand.count} migration files and admits schema ${cand.expected}`)
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), 'fabric-test-stack.'))
  rmSync(dir, { recursive: true, force: true })
  let stack = null
  try {
    say(`starting a disposable stack with no migrations (Supabase's roles, extensions and auth only)`)
    stack = await startStack(dir, { migrationCount: 0, seed: false })
    timings.stack = Math.round((Date.now() - t0) / 1000)
    const url = stack.env.DATABASE_URL
    // The fresh stack's empty migration ledger is replaced by the dump's, so `migration up` applies
    // exactly the candidate's files the dump has not seen.
    // `pg_restore --schema` restores the objects of a schema, not the schema itself: it is made empty here.
    sql(url, 'drop schema if exists supabase_migrations cascade; create schema supabase_migrations')
    say(`restoring the dump's public schema and migration ledger`)
    const { list, skipped } = restoreList(toc)
    const listFile = path.join(dir, 'restore.list')
    writeFileSync(listFile, list, { mode: 0o600 })
    tool('pg_restore', ['--dbname', url, '--use-list', listFile, '--schema', 'public', '--schema', 'supabase_migrations', '--exit-on-error', '--single-transaction', dump])
    rmSync(listFile, { force: true })
    const before = readState(url)
    timings.restore = Math.round((Date.now() - t0) / 1000) - timings.stack
    say(`restored: schema ${before.schemaVersion}, journal ${before.journal}, ${Object.keys(before.tables).length} tables; applying the candidate (${cand.ref}, ${cand.count} files, admits ${cand.expected})`)
    const target = path.join(dir, 'supabase', 'migrations')
    for (const f of readdirSync(cand.dir).filter((f) => f.endsWith('.sql'))) cpSync(path.join(cand.dir, f), path.join(target, f))
    supabase(['migration', 'up', '--local', '--workdir', dir])
    const after = readState(url)
    timings.migrate = Math.round((Date.now() - t0) / 1000) - timings.stack - timings.restore
    const verdict = judge({ dumpVersion: from ?? before.schemaVersion, before, after, expected: cand.expected })
    const out = receipt({ dump: dumpFacts, candidate: cand, stack: { projectId: stack.projectId, kept: keep }, before, after, verdict, timings, tools, skipped })
    const file = receiptFile ?? `${dump}.rehearsal.json`
    writeFileSync(file, JSON.stringify(out, null, 2) + '\n', { mode: 0o600 })
    chmodSync(file, 0o600)
    say(`${out.verdict}: schema ${before.schemaVersion} → ${after.schemaVersion} (admits ${cand.expected}), journal ${before.journal} → ${after.journal}; receipt ${file}`)
    for (const f of verdict.failures) say(`FAIL ${f}`)
    for (const n of verdict.notes) say(`note ${n}`)
    return verdict.ok ? 0 : 1
  } finally {
    cand.cleanup()
    if (stack && !keep) { try { down(dir) } catch (e) { say(`could not remove the stack: ${e.message}`) } }
    else if (stack) say(`kept the stack at ${dir} (remove it with: node scripts/test-stack.mjs down ${dir})`)
  }
}

async function makeFixture({ count, out }) {
  checkClient()
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), 'fabric-test-stack.'))
  rmSync(dir, { recursive: true, force: true })
  let stack = null
  try {
    stack = await startStack(dir, { migrationCount: count, seed: true })
    const url = stack.env.DATABASE_URL
    // A few projects through the journal, as the app writes them: the estate itself is the seed's.
    sql(url, `select append_event(${quoteLiteral(ESTATE)}::uuid, 'project.created@1', '{"kind":"system","id":"rehearsal-fixture"}'::jsonb,
      jsonb_build_object('id', p, 'name', 'fixture project ' || i), '1', p) from (select gen_random_uuid() as p, i from generate_series(1, 5) i) s`)
    const state = readState(url)
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
    tool('pg_dump', ['--dbname', url, '--format', 'custom', '--file', out])
    chmodSync(out, 0o600)
    say(`fixture: schema ${state.schemaVersion}, journal ${state.journal}, ${Object.keys(state.tables).length} tables → ${out}`)
    return 0
  } finally {
    if (stack) { try { down(dir) } catch (e) { say(`could not remove the stack: ${e.message}`) } }
  }
}

export function parseArgs(argv) {
  const a = { keep: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw new Error(`${k} needs a value`); return x }
    if (k === '--dump') a.dump = v()
    else if (k === '--ref') a.ref = v()
    else if (k === '--from') a.from = Number(v())
    else if (k === '--receipt') a.receiptFile = v()
    else if (k === '--keep') a.keep = true
    else if (k === '--make-fixture') a.count = Number(v())
    else if (k === '--out') a.out = v()
    else throw new Error(`unknown argument ${k}`)
  }
  if (a.count !== undefined) {
    if (!Number.isInteger(a.count) || a.count < 1 || !a.out) throw new Error('usage: --make-fixture <migration count> --out <file.dump>')
    return { mode: 'fixture', ...a }
  }
  if (!a.dump) throw new Error('usage: --dump <private.dump> [--ref <tag or commit>] [--from <schema>] [--receipt <file>] [--keep]')
  if (a.from !== undefined && !Number.isInteger(a.from)) throw new Error('--from takes a schema number')
  return { mode: 'rehearse', ...a }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let args
  try { args = parseArgs(process.argv.slice(2)) } catch (e) { console.error(e.message); process.exit(2) }
  ;(args.mode === 'fixture' ? makeFixture(args) : rehearse(args)).then((code) => process.exit(code), (e) => { say(e.message); process.exit(1) })
}
// #endregion rehearse-upgrade
