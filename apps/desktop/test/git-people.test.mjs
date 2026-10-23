// W2-6 (D-5, OF-27): a project's people, read from Git and never stored.
// #region git-people — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

const { addLogLines, orderPeople, readGitPeople } = await import(path.resolve(import.meta.dirname, '../src/main/gitPeople.ts'))
const US = '\u001f'
const line = (name, email, at) => [name, email, at].join(US)

test('authors merge by email whatever its case, counting commits and keeping the newest name and date', () => {
  const people = new Map()
  addLogLines(people, [line('Ada L', 'ada@example.invalid', '2026-10-01T00:00:00Z'), line('Ada Lovelace', 'ADA@example.invalid', '2026-10-20T00:00:00Z'), line('Bob', 'bob@example.invalid', '2026-09-01T00:00:00Z'), '', 'garbage'].join('\n'))
  const ordered = orderPeople(people.values())
  assert.deepEqual(ordered.map((p) => [p.name, p.commits, p.lastAt]), [['Ada Lovelace', 2, '2026-10-20T00:00:00Z'], ['Bob', 1, '2026-09-01T00:00:00Z']])
})

test('a repository whose history cannot be read is named, the others still count, and the reading is cached', async () => {
  let calls = 0
  const log = async (folder) => { calls++; if (folder === '/broken') throw new Error('fatal: not a git repository\nmore'); return line('Ada', 'ada@example.invalid', '2026-10-20T00:00:00Z') }
  const r = await readGitPeople('p-cache', ['/ok', '/broken'], 1_000, log)
  assert.equal(r.people.length, 1)
  assert.deepEqual(r.unread, [{ path: '/broken', reason: 'fatal: not a git repository' }])
  await readGitPeople('p-cache', ['/ok', '/broken'], 1_000 + 60_000, log)
  assert.equal(calls, 2, 'read again within ten minutes from the cache')
  await readGitPeople('p-cache', ['/ok', '/broken'], 1_000 + 11 * 60_000, log)
  assert.equal(calls, 4, 'read again after ten minutes')
})
// #endregion git-people
