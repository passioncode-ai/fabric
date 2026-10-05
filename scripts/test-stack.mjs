#!/usr/bin/env node
// #region test-stack-cli — docs: README.md#the-disposable-test-stack
// A disposable Supabase stack for the database-backed probes: its own project id, its own ports,
// its own volumes, gone at the end. The operator's live stack (project `fabric`, API 54321,
// DB 54322) is never started, migrated, read or written by anything here.
//
//   node scripts/test-stack.mjs up <dir>     make <dir> a stack project, start it, write <dir>/stack.env
//   node scripts/test-stack.mjs down <dir>   stop it, delete its volumes, remove <dir>
//   node scripts/test-stack.mjs guard        refuse (exit 1) unless the environment names a disposable stack
//   node scripts/test-stack.mjs run -- <command…>   up, run the command with the stack's env, down
//   node scripts/test-stack.mjs with <dir> -- <command…>   run one command against a stack already up
//
// `up` copies the root `supabase/` project (migrations and seed as they are in this checkout) and
// rewrites only `config.toml`: project id `fabric_test_<hex>` and every port moved into a free block
// of ten (FABRIC_TEST_STACK_BASE pins the block). A fresh database means `supabase start` applies the
// whole migration chain and the seed — the same path a new install takes.
//
// Containers the probes do not use are excluded (storage, realtime, studio, mail, edge functions,
// logs, pooler, imgproxy, meta): the probes speak PostgREST through Kong with the service role, and
// SQL through Postgres, and nothing else — measured by grepping every probe on 2026-10-03.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdtempSync, realpathSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  REPO_ROOT, PORT_BLOCK, DISPOSABLE_ID, liveStack, disposableConfig, parseStackConfig, checkTestStack
} from './lib/test-stack.mjs'

const MARKER = '.fabric-test-stack.json'
const EXCLUDE = ['realtime', 'storage-api', 'imgproxy', 'mailpit', 'postgres-meta', 'studio', 'edge-runtime', 'logflare', 'vector', 'supavisor']
const say = m => process.stderr.write(`test-stack: ${m}\n`)

/** The ports a stack at `base` would use; throws when any of them is the live stack's. */
export function stackPlan({ base, projectId, live = liveStack(), rootConfig = readFileSync(path.join(REPO_ROOT, 'supabase', 'config.toml'), 'utf8') }) {
  const config = disposableConfig(rootConfig, { projectId, base })
  const { ports } = parseStackConfig(config)
  const clash = Object.entries(ports).filter(([, p]) => live.ports.has(p))
  if (clash.length)
    throw new Error(`refusing: ${clash.map(([k, p]) => `${k}=${p}`).join(', ')} is a port of the LIVE stack (API ${live.apiPort}, DB ${live.dbPort}) — the operator's database`)
  if (projectId === live.projectId) throw new Error(`refusing: project id ${projectId} is the live stack's`)
  return { config, ports, apiPort: ports['api.port'], dbPort: ports['db.port'] }
}

/** A directory `down` may stop and delete: it carries the marker `up` wrote, naming a disposable id. */
export function assertDisposableDir(dir) {
  const abs = path.resolve(dir)
  const marker = path.join(abs, MARKER)
  const fail = why => { throw new Error(`refusing: ${abs} is not a disposable stack (${why})`) }
  if (abs === path.parse(abs).root) fail('filesystem root')
  if (abs === REPO_ROOT || REPO_ROOT.startsWith(abs + path.sep)) fail('the repository or a parent of it')
  if (!existsSync(marker)) fail(`no ${MARKER}`)
  let meta
  try { meta = JSON.parse(readFileSync(marker, 'utf8')) } catch { fail('unreadable marker') }
  if (!DISPOSABLE_ID.test(meta?.projectId ?? '')) fail(`marker names ${meta?.projectId}`)
  if (meta.projectId === liveStack().projectId) fail('marker names the live project')
  const cfg = path.join(abs, 'supabase', 'config.toml')
  if (existsSync(cfg) && parseStackConfig(readFileSync(cfg, 'utf8')).projectId !== meta.projectId) fail('config and marker disagree')
  return meta
}

function portFree(port) {
  return new Promise(resolve => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen({ port, host: '0.0.0.0', exclusive: true }, () => s.close(() => resolve(true)))
  })
}

async function blockFree(base) {
  for (let p = base; p < base + PORT_BLOCK; p++) if (!(await portFree(p))) return false
  return true
}

/** Where port-block claims live: one directory per machine, shared by every concurrent run. */
const CLAIM_DIR = path.join(realpathSync(tmpdir()), 'fabric-test-stack-claims')

function pidAlive(pid) {
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}

/**
 * Claim the block at `base` for this run, from the choice until `supabase start` has bound its ports
 * (release review 2026-10-03, iteration 2: two concurrent `up`s both found 55420 free and the second
 * start failed on a taken port). An exclusive-create lock file holds the claimant's pid; a claim whose
 * holder is no longer alive is taken over. Returns the release function, or null when another live run
 * holds the block.
 */
export function claimBlock(base, { dir = CLAIM_DIR, pid = process.pid, alive = pidAlive } = {}) {
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `block-${base}.lock`)
  const release = () => { try { if (readFileSync(file, 'utf8').trim() === String(pid)) rmSync(file, { force: true }) } catch { /* already gone */ } }
  const take = () => { try { writeFileSync(file, String(pid), { flag: 'wx' }); return true } catch (e) { if (e.code === 'EEXIST') return false; throw e } }
  if (take()) return release
  let holder = NaN
  try { holder = Number(readFileSync(file, 'utf8').trim()) } catch { /* vanished between the two calls */ }
  if (Number.isInteger(holder) && holder > 0 && alive(holder)) return null
  // A stale claim: its run died before releasing. Remove it and try once; a concurrent taker may win.
  rmSync(file, { force: true })
  return take() ? release : null
}

/** The first block that is free AND unclaimed, claimed for this run: `{ base, release }`. */
export async function chooseBase(live, { dir = CLAIM_DIR, free = blockFree, alive = pidAlive, pinned = process.env.FABRIC_TEST_STACK_BASE } = {}) {
  if (pinned) {
    const base = Number(pinned)
    const release = claimBlock(base, { dir, alive })
    if (!release) throw new Error(`the pinned block ${base} (FABRIC_TEST_STACK_BASE) is claimed by another running test stack`)
    return { base, release }
  }
  for (let base = 55420; base < 56420; base += PORT_BLOCK) {
    if ([...live.ports].some(p => p >= base && p < base + PORT_BLOCK)) continue
    if (!(await free(base))) continue
    const release = claimBlock(base, { dir, alive })
    if (release) return { base, release }
  }
  throw new Error('no free, unclaimed block of ten ports between 55420 and 56420')
}

function supabase(args, { log, timeout = 600_000 } = {}) {
  // The CLI addresses the project named by --workdir / --project-id; nothing inherited may redirect it.
  const env = { ...process.env }
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'SUPABASE_PROJECT_ID', 'SUPABASE_WORKDIR']) delete env[k]
  const r = spawnSync('supabase', args, { encoding: 'utf8', timeout, maxBuffer: 64_000_000, env })
  // `start` prints the stack's keys; the log keeps the progress and drops the material.
  const redact = s => String(s ?? '').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted: jwt]').replace(/\bsb_(secret|publishable)_\S+/g, 'sb_$1_[redacted]')
  if (log) writeFileSync(log, `$ supabase ${args.join(' ')}\n${redact(r.stdout)}${redact(r.stderr)}\n`, { flag: 'a' })
  return r
}

const shQuote = v => `'${String(v).replace(/'/g, `'\\''`)}'`

/** Runs `start`; on a failure, calls `beforeRetry` and runs it exactly once more. Returns the last result. */
export function startWithOneRetry(start, beforeRetry) {
  const first = start()
  if (first.status === 0) return first
  beforeRetry(first)
  return start()
}

/**
 * Make `dir` a disposable stack and start it. Options, for the upgrade rehearsal (CO-198):
 * `migrationsDir` — where the migration files come from (default: this checkout's); `migrationCount` —
 * apply only the first N (a fixture shaped like an older release); `seed` — run seed.sql (default yes).
 */
export async function up(dir, { migrationsDir = path.join(REPO_ROOT, 'supabase', 'migrations'), migrationCount = null, seed = true } = {}) {
  const live = liveStack()
  const abs = path.resolve(dir)
  mkdirSync(abs, { recursive: true })
  if (readdirSync(abs).length) throw new Error(`refusing: ${abs} is not empty`)
  const projectId = `fabric_test_${randomBytes(4).toString('hex')}`
  const { base, release } = await chooseBase(live)
  try {
    // The guard runs on the PLAN, before a single container exists.
    const plan = stackPlan({ base, projectId, live })
    for (const p of Object.values(plan.ports)) if (!(await portFree(p))) throw new Error(`port ${p} is in use; pick another block with FABRIC_TEST_STACK_BASE`)
    writeFileSync(path.join(abs, MARKER), JSON.stringify({ projectId, base, createdAt: new Date().toISOString(), source: REPO_ROOT }, null, 2) + '\n')
    const sb = path.join(abs, 'supabase')
    mkdirSync(sb)
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    if (migrationCount !== null && (!Number.isInteger(migrationCount) || migrationCount < 0 || migrationCount > files.length))
      throw new Error(`migrationCount ${migrationCount} is not between 0 and the ${files.length} files in ${migrationsDir}`)
    mkdirSync(path.join(sb, 'migrations'))
    for (const f of files.slice(0, migrationCount ?? files.length)) cpSync(path.join(migrationsDir, f), path.join(sb, 'migrations', f))
    if (seed) for (const f of ['seed.sql']) if (existsSync(path.join(REPO_ROOT, 'supabase', f))) cpSync(path.join(REPO_ROOT, 'supabase', f), path.join(sb, f))
    writeFileSync(path.join(sb, 'config.toml'), plan.config)
    const log = path.join(abs, 'stack.log')
    say(`starting ${projectId} on API ${plan.apiPort}, DB ${plan.dbPort} (live stack: API ${live.apiPort}, DB ${live.dbPort}, untouched); log ${log}`)
    const started = Date.now()
    const start = startWithOneRetry(
      () => supabase(['start', '--workdir', abs, '-x', EXCLUDE.join(',')], { log }),
      (failed) => {
        // A start can fail after every migration applied (a health check timing out under load, measured
        // 2026-10-03); this stack is disposable, so it is stopped and started once more before failing.
        say(`supabase start failed (${failed.status ?? failed.signal}); stopping ${projectId} and starting it once more`)
        supabase(['stop', '--workdir', abs, '--no-backup'], { log })
      }
    )
    // The ports are bound (or the start failed): the claim has done its job either way.
    release()
    if (start.status !== 0) throw new Error(`supabase start failed (${start.status ?? start.signal}); last lines:\n${(start.stderr || start.stdout || '').trim().split('\n').slice(-15).join('\n')}`)
    const status = supabase(['status', '-o', 'env', '--workdir', abs], { timeout: 60_000 })
    if (status.status !== 0) throw new Error(`supabase status failed: ${(status.stderr || '').trim()}`)
    const vars = {}
    for (const line of status.stdout.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
      if (m) vars[m[1]] = m[2]
    }
    const env = {
      SUPABASE_URL: vars.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: vars.SERVICE_ROLE_KEY,
      DATABASE_URL: vars.DB_URL,
      FABRIC_TEST_STACK: projectId
    }
    // And again on what the CLI actually reports, because a plan is not a measurement.
    const reasons = checkTestStack(env, live)
    if (reasons.length) throw new Error(`refusing the started stack:\n  ${reasons.join('\n  ')}`)
    if (new URL(env.SUPABASE_URL).port !== String(plan.apiPort) || new URL(env.DATABASE_URL).port !== String(plan.dbPort))
      throw new Error(`the started stack is not on the planned ports (API ${env.SUPABASE_URL}, DB port ${new URL(env.DATABASE_URL).port})`)
    writeFileSync(path.join(abs, 'stack.env'), Object.entries(env).map(([k, v]) => `${k}=${shQuote(v)}`).join('\n') + '\n', { mode: 0o600 })
    say(`ready in ${Math.round((Date.now() - started) / 1000)} s: ${projectId}, API ${plan.apiPort}, DB ${plan.dbPort}, migrations ${readdirSync(path.join(sb, 'migrations')).filter(f => f.endsWith('.sql')).length} + seed`)
    return { dir: abs, projectId, env }
  } finally {
    release()
  }
}

export function down(dir) {
  const abs = path.resolve(dir)
  if (!existsSync(abs)) { say(`${abs} is already gone`); return }
  // An empty directory is one `up` never reached (the trap fired first): nothing was started.
  if (!readdirSync(abs).length) { rmSync(abs, { recursive: true, force: true }); return }
  const meta = assertDisposableDir(abs)
  const r = supabase(['stop', '--no-backup', '--project-id', meta.projectId], { log: path.join(abs, 'stack.log'), timeout: 180_000 })
  if (r.status !== 0) say(`supabase stop for ${meta.projectId} answered ${r.status}: ${(r.stderr || '').trim().split('\n').slice(-3).join(' ')}`)
  const left = spawnSync('docker', ['ps', '-a', '--filter', `name=_${meta.projectId}`, '--format', '{{.Names}}'], { encoding: 'utf8' })
  const names = (left.stdout ?? '').trim()
  if (left.status === 0 && names) {
    say(`containers still present after stop, removing: ${names.split('\n').join(', ')}`)
    spawnSync('docker', ['rm', '-f', ...names.split('\n')], { stdio: 'ignore' })
  }
  // Measured 2026-10-03 (CLI 2.114): `stop --no-backup` deletes the db volume but leaves
  // `supabase_edge_runtime_<id>` behind even with edge-runtime excluded. Only names ending in this
  // disposable id are touched, so the live project's volumes cannot match.
  const vols = spawnSync('docker', ['volume', 'ls', '-q', '--filter', `name=_${meta.projectId}`], { encoding: 'utf8' })
  const volNames = (vols.stdout ?? '').trim().split('\n').filter(v => v.endsWith(`_${meta.projectId}`))
  if (vols.status === 0 && volNames.length) spawnSync('docker', ['volume', 'rm', '-f', ...volNames], { stdio: 'ignore' })
  rmSync(abs, { recursive: true, force: true })
  say(`removed ${meta.projectId} and ${abs}`)
  if (r.status !== 0 && left.status !== 0) throw new Error(`could not confirm ${meta.projectId} is stopped`)
}

function guard() {
  const live = liveStack()
  const reasons = checkTestStack(process.env, live)
  if (reasons.length) {
    for (const r of reasons) console.error(`REFUSED: ${r}`)
    console.error(`REFUSED: the full tier runs its probes only against a disposable stack, never the live one (project ${live.projectId}, API ${live.apiPort}, DB ${live.dbPort}).`)
    return 1
  }
  console.log(`ok: probes target disposable stack ${process.env.FABRIC_TEST_STACK} (API ${new URL(process.env.SUPABASE_URL).port}, DB ${new URL(process.env.DATABASE_URL).port}); the live stack (API ${live.apiPort}, DB ${live.dbPort}) is not addressed`)
  return 0
}

async function run(command) {
  if (!command.length) throw new Error('usage: test-stack.mjs run -- <command…>')
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), 'fabric-test-stack.'))
  let code = 1
  const stop = () => { try { down(dir) } catch (e) { say(e.message) } }
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => { stop(); process.exit(130) })
  try {
    const { env } = await up(dir)
    const r = spawnSync(command[0], command.slice(1), { stdio: 'inherit', env: { ...process.env, ...env } })
    code = r.status ?? 1
  } finally {
    stop()
  }
  return code
}

/** The environment an existing stack directory hands its probes, read back from stack.env. */
export function stackEnv(dir) {
  assertDisposableDir(dir)
  const env = {}
  for (const line of readFileSync(path.join(path.resolve(dir), 'stack.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)='(.*)'$/)
    if (m) env[m[1]] = m[2].replace(/'\\''/g, "'")
  }
  const reasons = checkTestStack(env)
  if (reasons.length) throw new Error(`refusing ${dir}:\n  ${reasons.join('\n  ')}`)
  return env
}

/** One command against a stack that is already up — the way to rerun a single probe. */
function withStack(dir, command) {
  if (!dir || !command.length) throw new Error('usage: test-stack.mjs with <dir> -- <command…>')
  const r = spawnSync(command[0], command.slice(1), { stdio: 'inherit', env: { ...process.env, ...stackEnv(dir) } })
  return r.status ?? 1
}

async function main(argv) {
  const [cmd, ...rest] = argv
  if (cmd === 'up') { if (!rest[0]) throw new Error('usage: test-stack.mjs up <dir>'); await up(rest[0]); return 0 }
  if (cmd === 'with') return withStack(rest[0], rest[1] === '--' ? rest.slice(2) : rest.slice(1))
  if (cmd === 'down') { if (!rest[0]) throw new Error('usage: test-stack.mjs down <dir>'); down(rest[0]); return 0 }
  if (cmd === 'guard') return guard()
  if (cmd === 'run') return run(rest[0] === '--' ? rest.slice(1) : rest)
  console.error('usage: test-stack.mjs up <dir> | down <dir> | guard | run -- <command…> | with <dir> -- <command…>')
  return 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => process.exit(code), e => {
    console.error(`test-stack: ${e.message}`)
    // `up` cleans what it made: a half-started stack must not outlive the command that started it.
    if (process.argv[2] === 'up' && process.argv[3] && existsSync(path.join(path.resolve(process.argv[3]), MARKER))) {
      try { down(process.argv[3]) } catch (d) { console.error(`test-stack: ${d.message}`) }
    }
    process.exit(1)
  })
}
// #endregion test-stack-cli
