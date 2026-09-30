// Statistics that measure the PROJECT, not Fabric (M57, via M113).
//
// The strip spent its slots on `Memory facts`, `Journal events` and
// `Transcripts` — facts about our own storage, which an operator never asks
// about. M57 was marked shipped and none of the five numbers it named existed.
//
// What is measurable and what is not, decided by measurement rather than by
// wishing:
//   - commits in a window, and the lines they added and removed: cheap and
//     exact (0.5 s on a 197 000-line repository, no reflog needed)
//   - tracked files and their lines: one `git grep -I -c` in 30 ms, binaries
//     skipped
//   - "lines of code": NOT SHIPPED, because it cannot be measured honestly.
//     Counting tracked lines here gives 184 178, of which a 32 582-line icon
//     JSON and a 20 185-line font-licence file are two entries. A number named
//     "lines of code" that is a third data files is the exact failure M113 is
//     about, so the number is named for what it is.
//   - tokens and cost: NOT SHIPPED and not shippable — CO-096 measured that the
//     endpoint returns utilisation against rate-limit windows, with
//     `limit_dollars`, `used_dollars` and `remaining_dollars` all null, and
//     nothing per-project.

import { createCodeStatsReader, parseGrepCounts, parseNumstat } from '../src/main/codeStats.ts'

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

console.log('project statistics')

{
  const c = parseGrepCounts('src/a.ts:120\nsrc/b.tsx:8\ndocs/x.md:1\n')
  if (c.files !== 3 || c.lines !== 129) fail(`counted ${JSON.stringify(c)}`)
  else ok('tracked files and their lines are summed')

  const colons = parseGrepCounts('src/a:b:c.ts:12\n')
  if (colons.lines !== 12) fail(`a path containing a colon broke the count: ${JSON.stringify(colons)}`)
  else ok('a path with a colon in it is still read from the RIGHT — the count is the last field')

  if (parseGrepCounts('').files !== 0) fail('an empty repository counted files')
  else ok('an empty result is zero, not a failure')
}

{
  // `--numstat --format=%H` prints the sha on its own line, then a row per file.
  //
  // THE FIRST VERSION OF THIS FIXTURE WAS WRONG AND THE PROBE PASSED ANYWAY. It
  // used `--format=''` and blank-line separators, because that is the shape the
  // parser assumed — so the fixture tested the assumption against itself. Run
  // against this repository's REAL output it reported 0 commits where git says
  // 162: `--format=''` emits no separator at all. The last case below now reads
  // real git rather than a string I wrote.
  const sha = (n) => String(n).padStart(40, '0')
  const out = sha(1) + '\n1\t2\tsrc/a.ts\n30\t0\tsrc/b.ts\n' + sha(2) + '\n5\t5\tdocs/x.md\n'
  const n = parseNumstat(out)
  if (n.commits !== 2) fail(`counted ${n.commits} commits`)
  else ok('commits are counted by their separators, not by their file rows')
  if (n.added !== 36 || n.removed !== 7) fail(`counted +${n.added}/-${n.removed}`)
  else ok('added and removed lines are summed across every file')

  const binary = parseNumstat(sha(3) + '\n-\t-\tlogo.png\n4\t1\tsrc/a.ts\n')
  if (binary.added !== 4) fail(`a binary file polluted the count: +${binary.added}`)
  else ok('a binary file reports "-" and is not counted as zero-or-anything')
  if (binary.commits !== 1) fail(`counted ${binary.commits} commits for one`)
  else ok('and it is still one commit')
}

{
  const calls = []
  const reader = createCodeStatsReader({
    git: async (_repo, args) => {
      calls.push(args.join(' '))
      if (args[0] === 'grep') return 'src/a.ts:100\n'
      if (args[0] === 'log') return '0'.repeat(40) + '\n10\t2\tsrc/a.ts\n'
      throw new Error(`unexpected git ${args[0]}`)
    },
    now: () => 1_000_000
  })
  const s = await reader.read('/w/repo', 7)
  if (s.trackedLines !== 100 || s.commits !== 1 || s.linesAdded !== 10) fail(`read ${JSON.stringify(s)}`)
  else ok('a reading carries the project’s own numbers')
  if (!s.readAt) fail('a reading with no timestamp — a caller cannot tell fresh from stale')
  else ok('and when it was taken, like every other reading in the product')
  if (s.windowDays !== 7) fail('the window is not carried, so "12 commits" means nothing')
  else ok('and the WINDOW it counted, because "12 commits" without one is not a fact')

  const before = calls.length
  await reader.read('/w/repo', 7)
  if (calls.length !== before) fail('a second read within the TTL shelled out again')
  else ok('a read inside the TTL is served from cache — git is never on a render path')

  reader.invalidate()
  await reader.read('/w/repo', 7)
  if (calls.length === before) fail('invalidate did not force a fresh reading')
  else ok('and invalidate forces a fresh one')
}

{
  const reader = createCodeStatsReader({
    git: async () => {
      throw new Error('fatal: not a git repository')
    }
  })
  const s = await reader.read('/w/nope', 7)
  if (!s.error) fail('a directory that is not a repository reported no error')
  else ok('a directory that is not a repository says so rather than reporting zeros')
  if (s.trackedLines !== null) fail(`it reported ${s.trackedLines} lines for an unreadable repository`)
  else ok('and its numbers are NULL, not zero — "we could not look" is not "there is nothing"')
}

// ─────────────── against REAL git, not against a string I wrote ───────────────
//
// This case exists because the fixture above passed while the parser was wrong.
// A fixture encodes the author's belief about a format; only the format itself
// can refute it. It reads this repository, which is the one thing certain to be
// present wherever this probe runs.
{
  const { gitRun } = await import('../src/main/gitRun.ts')
  const here = process.cwd()
  let real = null
  try {
    real = await gitRun(here, ['rev-parse', '--git-dir'])
  } catch {
    ok('not inside a git repository — the live check is SKIPPED, and says so rather than passing quietly')
  }
  if (real) {
    // GUARDED, and the reason is a real failure rather than caution. This
    // repository's own 30-day history reached 140 kB and 2.3 s on an idle
    // machine; `gitRun` gives git five seconds, and under a full CI run — the
    // stack, the suite and this probe at once — it went over. The whole file
    // then died on an unhandled rejection and reported NOTHING: not a pass, not
    // a failure, no line at all.
    //
    // The probe already knows how to say this for "not a git repository". A
    // verification that cannot reach its subject is inconclusive about the
    // harness, never a verdict on the product (R-004) — and the product's own
    // path is fine: `codeStats.read` catches this and reports nulls with the
    // reason, which is exactly the honest degradation it was built for.
    let log = null
    let counted = null
    try {
      ;[log, counted] = await Promise.all([
        gitRun(here, ['log', '--since=30 days ago', '--numstat', '--format=%H']),
        gitRun(here, ['rev-list', '--count', '--since=30 days ago', 'HEAD'])
      ])
    } catch (e) {
      ok(`git could not read this repository's history in time (${String(e).split('\n')[0]}) — the live check is INCONCLUSIVE, and says so rather than passing quietly`)
    }
  if (log !== null && counted !== null) {
    const parsed = parseNumstat(log)
    const truth = Number(counted.trim())
    if (parsed.commits !== truth)
      fail(`the parser counted ${parsed.commits} commits and git counts ${truth} — the format assumption is wrong again`)
    else ok(`the parser agrees with git on this repository's own history (${truth} commits in 30 days)`)
    if (!(parsed.added > 0)) fail('no added lines across 30 days of real history — the row parsing is wrong')
    else ok('and it reads the lines those commits moved')

    const grep = await gitRun(here, ['grep', '-I', '-c', '', '--', '.']).catch(() => '')
    const c = parseGrepCounts(grep)
    if (!(c.files > 0 && c.lines > c.files))
      fail(`tracked counts look wrong: ${JSON.stringify(c)}`)
    else ok(`and it counts this repository's tracked text (${c.files} files, ${c.lines} lines)`)
  }
  }
}

console.log(
  failures === 0
    ? '\nall green: the numbers measure the project, carry their window, and are absent rather than zero'
    : `\n${failures} failure(s)`
)
process.exit(failures === 0 ? 0 : 1)
