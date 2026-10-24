// W2-6 (D-5, OF-27): a project's people, read from Git and never stored.
// #region git-people — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

const { addLogLines, orderPeople, readGitPeople } = await import(path.resolve(import.meta.dirname, '../src/main/gitPeople.ts'))
const US = '\u001f'
const line = (hash, name, email, at) => [hash, name, email, at].join(US)

test('authors merge by email whatever its case, counting commits and keeping the newest name and date', () => {
  const people = new Map()
  addLogLines(people, [line('a1', 'Ada L', 'ada@example.invalid', '2026-10-01T00:00:00Z'), line('a2', 'Ada Lovelace', 'ADA@example.invalid', '2026-10-20T00:00:00Z'), line('b1', 'Bob', 'bob@example.invalid', '2026-09-01T00:00:00Z'), '', 'garbage'].join('\n'))
  const ordered = orderPeople(people.values())
  assert.deepEqual(ordered.map((p) => [p.name, p.commits, p.lastAt]), [['Ada Lovelace', 2, '2026-10-20T00:00:00Z'], ['Bob', 1, '2026-09-01T00:00:00Z']])
})

// A fake Git: folders map to a common directory and a HEAD; a log answers its revisions' commits.
const fakeGit = (repos, commits) => {
  const calls = { identify: 0, log: [] }
  return {
    calls,
    reader: {
      async identify(folder) { calls.identify++; const r = repos[folder]; if (!r) throw new Error(`fatal: not a git repository: ${folder}\nmore`); return r },
      async log(folder, revs) { calls.log.push([folder, [...revs].sort()]); if (repos[folder]?.broken) throw new Error('fatal: bad object\nmore'); return [...new Set(revs.flatMap((r) => commits[r] ?? []))].join('\n') }
    }
  }
}

test('DO-10: one log per repository, its checkout\'s worktree folded in, and a commit two clones share counted once', async () => {
  const repos = {
    '/w/fabric': { commonDir: '/w/fabric/.git', head: 'main' },
    '/w/fabric-wt': { commonDir: '/w/fabric/.git', head: 'topic' },
    '/w/fabric-clone': { commonDir: '/w/fabric-clone/.git', head: 'main' }
  }
  const commits = { main: [line('c1', 'Ada', 'ada@example.invalid', '2026-10-20T00:00:00Z')], topic: [line('c1', 'Ada', 'ada@example.invalid', '2026-10-20T00:00:00Z'), line('c2', 'Ada', 'ada@example.invalid', '2026-10-21T00:00:00Z')] }
  const { reader, calls } = fakeGit(repos, commits)
  const r = await readGitPeople('p-dedupe', ['/w/fabric', '/w/fabric-wt', '/w/fabric-clone'], 1_000, reader)
  assert.equal(calls.log.length, 2, 'one log per repository, not per folder')
  assert.deepEqual(calls.log[0], ['/w/fabric', ['main', 'topic']], 'the worktree\'s HEAD is read in its repository\'s one log')
  assert.deepEqual(r.people.map((p) => [p.name, p.commits]), [['Ada', 2]], 'c1 seen in two clones counts once')
  assert.deepEqual([r.unread, r.read], [[], 2])
})

test('ER-3: a failed reading is not cached; a complete one is, ten minutes, per set of folders', async () => {
  const repos = { '/ok': { commonDir: '/ok/.git', head: 'h' } }
  const { reader, calls } = fakeGit(repos, { h: [line('c1', 'Ada', 'ada@example.invalid', '2026-10-20T00:00:00Z')] })
  const failed = await readGitPeople('p-cache', ['/ok', '/broken'], 1_000, reader)
  assert.equal(failed.people.length, 1)
  assert.deepEqual(failed.unread, [{ path: '/broken', reason: 'fatal: not a git repository: /broken' }])
  // 0.3.12 review i2 ER-6: held 60 s, so a journal move within that does not read every repository again.
  await readGitPeople('p-cache', ['/ok', '/broken'], 1_000 + 30_000, reader)
  assert.equal(calls.log.length, 1, 'a reading with a repository unread is held for 60 s')
  await readGitPeople('p-cache', ['/ok', '/broken'], 1_000 + 60_000, reader)
  assert.equal(calls.log.length, 2, 'and read again after 60 s')
  await readGitPeople('p-cache', ['/ok'], 1_000, reader)
  await readGitPeople('p-cache', ['/ok'], 1_000 + 60_000, reader)
  assert.equal(calls.log.length, 3, 'a complete reading is served from the cache within ten minutes')
  await readGitPeople('p-cache', ['/ok'], 1_000 + 11 * 60_000, reader)
  assert.equal(calls.log.length, 4, 'and read again after ten minutes')
})

test('ER-6: at most four folders are identified at once, however many the project holds', async () => {
  let running = 0, peak = 0
  const reader = {
    async identify(folder) { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; return { commonDir: '/one/.git', head: 'h' } },
    async log() { return line('c1', 'Ada', 'ada@example.invalid', '2026-10-20T00:00:00Z') },
  }
  const folders = Array.from({ length: 41 }, (_, i) => `/w/${i}`)
  const r = await readGitPeople('p-peak', folders, 3_000, reader)
  assert.equal(peak, 4)
  assert.deepEqual([r.read, r.unread.length, r.people.length], [1, 0, 1])
})

test('ER-6: the limiter never runs more than its slots and runs every call', async () => {
  const { limiter } = await import(path.resolve(import.meta.dirname, '../src/main/gitPeople.ts'))
  const slot = limiter(4)
  let running = 0, peak = 0
  const out = await Promise.all(Array.from({ length: 20 }, (_, i) => slot(async () => {
    running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, i % 3)); running--
    if (i === 7) throw new Error('refused')
    return i
  }).catch((e) => e.message)))
  assert.equal(peak, 4)
  assert.equal(out.length, 20)
  assert.equal(out[7], 'refused')
  assert.equal(out[19], 19)
})

test('ER-3: concurrent first reads of one project share one reading', async () => {
  const repos = { '/a': { commonDir: '/a/.git', head: 'h' } }
  const { reader, calls } = fakeGit(repos, { h: [line('c1', 'Ada', 'ada@example.invalid', '2026-10-20T00:00:00Z')] })
  const all = await Promise.all([1, 2, 3, 4, 5].map(() => readGitPeople('p-share', ['/a'], 2_000, reader)))
  assert.equal(calls.identify, 1)
  assert.equal(calls.log.length, 1)
  assert.ok(all.every((r) => r === all[0]))
})

test('a repository with no commit is read and has nobody; one whose log fails is unread, every folder of it named', async () => {
  const repos = { '/empty': { commonDir: '/empty/.git', head: null }, '/bad': { commonDir: '/bad/.git', head: 'h', broken: true } }
  const { reader } = fakeGit(repos, {})
  const r = await readGitPeople('p-empty', ['/empty', '/bad'], 3_000, reader)
  assert.deepEqual(r, { people: [], unread: [{ path: '/bad', reason: 'fatal: bad object' }], read: 1 })
})
// #endregion git-people
