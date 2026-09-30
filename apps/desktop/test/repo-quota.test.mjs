// Repository state (M56) and account quota (M83).
//
// Both read the world outside the app, so both take an injected reader and both
// are probed on POLICY rather than on git or the network. What is under test is
// the part that decides whether the panel tells the truth:
//
//   - a reading that fails keeps the last good facts and CARRIES THE ERROR,
//     rather than blanking, because "we could not look just now" and "there is
//     nothing here" are different statements
//   - one absent part does not make the rest unknowable — a branch with no
//     upstream has no ahead/behind and that is a fact, not a failure
//   - every reading carries its age, because a caller that cannot tell fresh
//     from stale cannot decide anything
//   - the quota never shows a number whose meaning it does not know

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createRepoStateReader,
  parseStatus,
  parseAheadBehind
} from '../src/main/repoState.ts'
import { createQuotaReader } from '../src/main/quota.ts'

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

console.log('repository state and account quota')

// ───────────────────────────── parsing ─────────────────────────────
{
  const s = parseStatus(' M src/a.ts\nA  src/b.ts\n?? scratch.md\n?? notes/\nD  old.ts\n')
  if (s.changed !== 3 || s.untracked !== 2) fail(`status parsed as ${JSON.stringify(s)}`)
  else ok('changed and untracked are counted apart — "8 changed" and "3 new" are different facts')
  if (parseStatus('').changed !== 0) fail('an empty status counted a change')
  else ok('a clean tree counts zero')

  const ab = parseAheadBehind('3\t7\n')
  if (!ab || ab.behind !== 3 || ab.ahead !== 7) fail(`ahead/behind parsed as ${JSON.stringify(ab)}`)
  else ok('ahead and behind are read in the order git prints them (behind first)')
  if (parseAheadBehind("fatal: no upstream\n") !== null) fail('a fatal was parsed as a count')
  else ok('no upstream parses to null rather than to zero')
}

// ───────────────────────── a healthy repository ─────────────────────
const GOOD = {
  'rev-parse': 'main\n',
  status: ' M src/index.ts\n?? scratch.md\n',
  'rev-list': '0\t2\n',
  log: 'abc1234def\u0000fix the thing\u00002026-09-01T10:00:00+00:00\n'
}
const routed = (table) => async (_p, args) => {
  const key = args[0]
  if (!(key in table)) throw new Error(`unexpected git ${key}`)
  const v = table[key]
  if (v instanceof Error) throw v
  return v
}

{
  let clock = 1_000_000
  const r = createRepoStateReader({ git: routed(GOOD), now: () => clock, ttlMs: 5000 })
  const s = await r.read('/repo')
  if (s.branch !== 'main') fail(`branch is ${s.branch}`)
  else ok('the branch is read')
  if (s.ahead !== 2 || s.behind !== 0) fail(`ahead/behind ${s.ahead}/${s.behind}`)
  else ok('ahead and behind are read')
  if (s.changed !== 1 || s.untracked !== 1) fail(`changed ${s.changed} untracked ${s.untracked}`)
  else ok('the working tree is counted')
  if (s.lastCommit?.sha !== 'abc1234d' || !s.lastCommit.subject.includes('fix the thing'))
    fail(`last commit ${JSON.stringify(s.lastCommit)}`)
  else ok('the last commit is read and its sha is shortened')
  if (!s.readAt) fail('the reading carries no time')
  else ok('every reading carries when it was taken')

  // Cached inside the TTL, re-measured after it.
  let calls = 0
  const counting = createRepoStateReader({
    git: async (...a) => {
      calls++
      return routed(GOOD)(...a)
    },
    now: () => clock,
    ttlMs: 5000
  })
  await counting.read('/repo')
  const first = calls
  await counting.read('/repo')
  if (calls !== first) fail(`a second read inside the TTL shelled out again (${calls - first} calls)`)
  else ok('a read inside the TTL is served from cache — never from a render')
  clock += 5001
  await counting.read('/repo')
  if (calls === first) fail('the TTL never expired — a stale branch would be shown forever')
  else ok('the reading is re-taken once the TTL passes')
}

// ─────────────── one absent part must not blank the rest ─────────────
{
  const noUpstream = { ...GOOD, 'rev-list': new Error('fatal: no upstream configured') }
  const r = createRepoStateReader({ git: routed(noUpstream) })
  const s = await r.read('/repo')
  if (s.error) fail(`a missing upstream was reported as an error: ${s.error}`)
  else ok('a branch with no upstream is a fact, not a failure')
  if (s.ahead !== null || s.behind !== null) fail('ahead/behind were invented')
  else ok('with no upstream, ahead and behind are null rather than zero')
  if (s.branch !== 'main' || s.changed !== 1) fail('the readable parts were lost with the unreadable one')
  else ok('the parts that could be read are still there')
}

// ───────── a failed reading keeps the facts and carries the error ─────
{
  let clock = 1_000_000
  let broken = false
  const r = createRepoStateReader({
    git: async (p, args) => {
      if (broken) throw new Error('fatal: not a git repository')
      return routed(GOOD)(p, args)
    },
    now: () => clock,
    ttlMs: 10
  })
  const good = await r.read('/repo')
  broken = true
  clock += 100
  const bad = await r.read('/repo')
  if (bad.branch !== good.branch) fail('a failed reading blanked the last known branch')
  else ok('a failed reading keeps the last good facts')
  if (!bad.error) fail('a failed reading did not say it failed')
  else ok('and carries the error, so "could not look" is not read as "nothing here"')
  if (bad.readAt === good.readAt) fail('the failed reading reused the old timestamp')
  else ok('with a fresh timestamp, so its age is visible')
}

// ───────────────────────────── quota ─────────────────────────────
const USAGE = {
  five_hour: { utilization: 46, resets_at: '2026-09-01T04:39:59Z', limit_dollars: null },
  seven_day: { utilization: 17, resets_at: '2026-09-07T04:59:59Z' },
  seven_day_opus: { utilization: 61, resets_at: '2026-09-07T04:59:59Z' },
  // Codenamed internal buckets. Their meaning is unknown, so they must not be shown.
  iguana_necktie: { utilization: 99 },
  tangelo: { utilization: 3 }
}

{
  let clock = 1_000_000
  const q = createQuotaReader({
    token: async () => 'tok',
    fetchUsage: async () => ({ status: 200, body: USAGE }),
    now: () => clock,
    ttlMs: 60_000
  })
  const r = await q.read()
  if (r.fiveHour?.utilization !== 46 || !r.fiveHour.resetsAt) fail(`five hour ${JSON.stringify(r.fiveHour)}`)
  else ok('the five-hour window and its reset are read')
  if (r.sevenDay?.utilization !== 17) fail('the seven-day window was not read')
  else ok('the seven-day window is read')
  if (r.byModel.opus?.utilization !== 61) fail(`per-model ${JSON.stringify(r.byModel)}`)
  else ok('per-model windows are read')
  if ('iguana_necktie' in r.byModel || Object.keys(r.byModel).length !== 1)
    fail(`unknown buckets leaked into the reading: ${Object.keys(r.byModel)}`)
  else ok('codenamed internal buckets are NOT shown — a number whose meaning is unknown is worse than none')
  if (r.problem !== null || r.ageSeconds !== 0) fail('a fresh reading claimed a problem')
  else ok('a fresh reading has no problem and no age')
}

// ─── unreachable: last known WITH ITS AGE, never a stale number as current ───
{
  let clock = 1_000_000
  let down = false
  const q = createQuotaReader({
    token: async () => 'tok',
    fetchUsage: async () => {
      if (down) throw new Error('ENOTFOUND')
      return { status: 200, body: USAGE }
    },
    now: () => clock,
    ttlMs: 10
  })
  await q.read()
  down = true
  clock += 60_000
  const r = await q.read()
  if (!r) fail('an unreachable endpoint returned nothing despite a last known reading')
  else if (r.problem !== 'unreachable') fail(`problem is ${r.problem}`)
  else if (r.ageSeconds < 59) fail(`the stale reading claims to be ${r.ageSeconds}s old`)
  else ok(`unreachable returns the last known reading with its real age (${r.ageSeconds}s)`)
  if (r && r.fiveHour?.utilization !== 46) fail('the last known numbers were lost')
  else ok('and the numbers are the last ones actually measured')
}

// ─────────────── throttling: honoured, and said out loud ───────────────
{
  let clock = 1_000_000
  let calls = 0
  const q = createQuotaReader({
    token: async () => 'tok',
    fetchUsage: async () => {
      calls++
      return calls === 1 ? { status: 200, body: USAGE } : { status: 429, retryAfter: 30 }
    },
    now: () => clock,
    ttlMs: 10
  })
  await q.read()
  clock += 100
  const throttled = await q.read()
  if (throttled.problem !== 'throttled') fail(`a 429 reported ${throttled.problem}`)
  else ok('a 429 is reported as throttled, not as an error')
  const before = calls
  clock += 1000
  await q.read()
  if (calls !== before) fail('the reader asked again inside the Retry-After window')
  else ok('Retry-After is honoured — nothing is asked until it passes')
  clock += 30_000
  await q.read()
  if (calls === before) fail('the reader never resumed after the backoff')
  else ok('and asking resumes once it has')
}

// ───────────── not signed in is a state, not a failure ─────────────
{
  const q = createQuotaReader({ token: async () => null, fetchUsage: async () => ({ status: 200 }) })
  const r = await q.read()
  if (r?.problem !== 'no-credential') fail(`no token reported ${r?.problem}`)
  else ok('no credential is its own state — Claude Code is simply not signed in here')
  if (r.fiveHour !== null) fail('a reading was invented with no credential')
  else ok('and no numbers are invented for it')
}

// ─────────── a repository must not be able to execute code ───────────
//
// `git status` runs the program named by `core.fsmonitor`, read from the
// repository's OWN `.git/config` — which every agent working in that repository
// can write. Reproduced 2026-09-01 against the unhardened reader: arbitrary code
// ran as the operator inside Fabric's main process, the one holding the Supabase
// service key and the Anthropic OAuth token, while the reading returned
// `error: null` so the panel showed a healthy repository.
//
// This probe uses the REAL git, deliberately: the whole finding is about what
// the real binary does with repository-controlled configuration, and an injected
// runner would prove nothing.
{
  const { execFileSync } = await import('node:child_process')
  const { mkdtempSync, existsSync, writeFileSync, chmodSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const pathMod = (await import('node:path')).default

  const base = mkdtempSync(pathMod.join(tmpdir(), 'fabric-fsmon-'))
  const repo = pathMod.join(base, 'repo')
  const proof = pathMod.join(base, 'PROOF')
  const payload = pathMod.join(base, 'payload.sh')
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })
  try {
    execFileSync('git', ['init', '-q', repo], { encoding: 'utf8' })
    git('config', 'user.email', 'probe@fabric')
    git('config', 'user.name', 'probe')
    writeFileSync(pathMod.join(repo, 'f.txt'), 'x\n')
    git('add', '-A')
    git('commit', '-qm', 'init')

    writeFileSync(payload, `#!/bin/sh\necho pwned > ${proof}\nexit 1\n`)
    chmodSync(payload, 0o755)
    // Exactly what an agent with write access to the repository can do.
    git('config', 'core.fsmonitor', payload)

    const state = await createRepoStateReader().read(repo)

    if (existsSync(proof))
      fail('a repository executed code inside the process holding the service key and the OAuth token')
    else ok('a hostile core.fsmonitor does NOT execute — the repository cannot run code in this process')
    if (state.branch === null)
      fail(`hardening broke the reading itself: ${state.error}`)
    else ok(`and the repository is still read correctly (branch ${state.branch})`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}


// ─────────────────── the watch, and what it cannot see (M107) ───────────────────
//
// The main process broadcasts this callback to every window. Until M107 it
// broadcast into a channel with no listener anywhere, so what is under test
// here is the half that was never in doubt — and one fact that was, and that
// decides whether a listener is ENOUGH.
{
  const root = mkdtempSync(join(tmpdir(), 'fabric-watch-'))
  const repo = join(root, 'repo')
  mkdirSync(join(repo, '.git'), { recursive: true })
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  writeFileSync(join(repo, 'src.ts'), 'const a = 1\n')

  const reader = createRepoStateReader({
    git: async () => 'main',
    debounceMs: 20
  })

  const seen = []
  reader.watchAll([repo], (p) => seen.push(p))
  // Waits for the callback rather than sleeping a fixed time. A 250 ms sleep
  // passed alone and failed under the full tier, where the machine is busy —
  // and `fs.watch` on macOS is exactly the thing this file's own comments call
  // unreliable. A probe that is green alone and red under load is a probe that
  // fails CI at random, which teaches everyone to re-run rather than to read.
  const until = async (want, budgetMs = 4000) => {
    const deadline = Date.now() + budgetMs
    while (Date.now() < deadline) {
      if (want()) return true
      await new Promise((r) => setTimeout(r, 25))
    }
    return false
  }
  // Kept for the NEGATIVE case: proving nothing fires needs a fixed wait, and
  // it is generous because a false "nothing happened" is the expensive answer.
  const settle = () => new Promise((r) => setTimeout(r, 600))

  // Something under `.git` — a commit, a branch switch, `git add`.
  //
  // WRITTEN REPEATEDLY, and that is not superstition: `fs.watch` on macOS does
  // not deliver events for writes that land before the watch is fully
  // registered, and a probe created a millisecond earlier loses the race about
  // half the time (measured: 3 of 6 runs red with a single write). What is
  // under test is that a change under `.git` REACHES the callback, not how long
  // the kernel takes to arm a watcher — the production reader compensates for
  // exactly that unreliability with its TTL, which is why the poll exists.
  let beats = 0
  await until(() => {
    writeFileSync(join(repo, '.git', 'HEAD'), `ref: refs/heads/other-${beats++}\n`)
    return seen.length > 0
  })
  if (seen.length === 0) fail('a change under .git notified nobody — the watch is inert')
  else ok('a change under .git names the repository that moved')
  if (seen[0] !== repo) fail(`the callback named ${seen[0]}, not the repository`)
  else ok('the callback carries the PATH, so a window can decide whether it cares')

  // DRAIN before the next case. The write loop above fired several times and the
  // reader debounces, so events are still in flight; without this the next two
  // assertions read THIS case's echoes and report a watch that fires on a
  // working-tree edit and a stopped watcher that still speaks — both false, and
  // both of them looked like real findings for a minute.
  await settle()
  seen.length = 0

  // THE MEASURED FACT THAT JUSTIFIES THE INTERVAL. `.git` is watched
  // non-recursively on purpose — watching objects is thousands of events for
  // one commit — so a file edited in the WORKING TREE touches nothing under
  // `.git` and fires nothing at all. A listener alone therefore cannot fix
  // M107's own sentence, "an agent rewrites twelve files while the strip says
  // clean": that needs the poll in `shared/repoWatch.ts`, and this is why.
  const before = seen.length
  writeFileSync(join(repo, 'src.ts'), 'const a = 2\n')
  await settle()
  if (seen.length !== before)
    fail('editing a tracked file fired the watch — the interval may be unnecessary; re-measure')
  else ok('editing a tracked file fires NOTHING — which is why a poll sits beside the watch')

  reader.stop()
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/third\n')
  await settle() // negative case: a fixed wait is what proves nothing fired
  if (seen.length !== before) fail('a stopped watcher still notified — the estate leaks watchers')
  else ok('stop() is the end of it: a watcher outliving its window would notify a dead renderer')

  rmSync(root, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED — the page would state something it does not know`)
  process.exit(1)
}
console.log('\nall green: both readings carry their age, keep their facts, and invent nothing')
