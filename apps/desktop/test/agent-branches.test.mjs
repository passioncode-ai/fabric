// The branch of each agent at work (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §1 «Where the branch
// comes from»): a console Fabric holds has a known folder, and its branch is read with git, bounded and cached for the
// home's 15 s reading; any other agent's branch stays unknown. Pure but for the injected git.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { createBranchReader, withBranches } = await import(path.resolve(import.meta.dirname, '../src/main/agentBranches.ts'))

const live = (sessionId, over = {}) => ({ sessionId, projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: 'a', lastSignAt: null, stale: false, doing: null, task: null, ...over })
const view = (agents) => ({ live: agents, inWork: [], review: [], done: [], projects: [], readAt: 'r' })

test('a console Fabric holds carries the branch of its folder; an agent with no folder carries none', async () => {
  const calls = []
  const reader = createBranchReader({ git: async (folder, args) => { calls.push([folder, args]); return 'release/0.3.14\n' }, now: () => 0 })
  const out = await withBranches(view([live('s1'), live('s2', { console: false })]), [{ sessionId: 's1', folder: '/work/fabric' }, { sessionId: 's2' }], reader)
  assert.equal(out.live[0].branch, 'release/0.3.14')
  assert.equal(out.live[1].branch, null)
  assert.deepEqual(calls, [['/work/fabric', ['rev-parse', '--abbrev-ref', 'HEAD']]])
})

test('git that fails, or a detached HEAD, leaves the branch unknown and the reading whole', async () => {
  const reader = createBranchReader({ git: async (folder) => { if (folder === '/bad') throw new Error('not a git repository'); return 'HEAD\n' }, now: () => 0 })
  const out = await withBranches(view([live('s1'), live('s2')]), [{ sessionId: 's1', folder: '/bad' }, { sessionId: 's2', folder: '/detached' }], reader)
  assert.deepEqual(out.live.map((a) => a.branch), [null, null])
})

test('a folder is read once per window, shared by every console in it, and again after the window', async () => {
  let clock = 0
  let reads = 0
  const reader = createBranchReader({ git: async () => { reads++; return 'main' }, now: () => clock, ttlMs: 15_000 })
  const held = [{ sessionId: 's1', folder: '/f' }, { sessionId: 's2', folder: '/f' }]
  await withBranches(view([live('s1'), live('s2')]), held, reader)
  await withBranches(view([live('s1'), live('s2')]), held, reader)
  assert.equal(reads, 1)
  clock = 15_001
  await withBranches(view([live('s1')]), held, reader)
  assert.equal(reads, 2)
})

test('the number of folders read at once is bounded', async () => {
  let inFlight = 0
  let most = 0
  const reader = createBranchReader({
    git: async () => { inFlight++; most = Math.max(most, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return 'b' },
    now: () => 0,
    concurrency: 2
  })
  const agents = Array.from({ length: 6 }, (_, i) => live(`s${i}`))
  await withBranches(view(agents), agents.map((a, i) => ({ sessionId: a.sessionId, folder: `/f${i}` })), reader)
  assert.equal(most, 2)
})

test('ER-16, DA-2: the branch is kept 60 s by default, above the home\'s 15 s reading; a failure is held as long', async () => {
  let clock = 0
  let reads = 0
  const reader = createBranchReader({ git: async () => { reads++; throw new Error('timed out') }, now: () => clock })
  const held = [{ sessionId: 's1', folder: '/f' }]
  await withBranches(view([live('s1')]), held, reader)
  clock = 45_000
  await withBranches(view([live('s1')]), held, reader)
  assert.equal(reads, 1, 'three home readings, one git run')
  clock = 60_001
  await withBranches(view([live('s1')]), held, reader)
  assert.equal(reads, 2)
})

test('ER-16: a git that never answers (one that ignores SIGTERM) does not hold the reading past its deadline', async () => {
  const reader = createBranchReader({ git: () => new Promise(() => {}), now: () => 0, timeoutMs: 20 })
  const started = Date.now()
  const out = await withBranches(view([live('s1')]), [{ sessionId: 's1', folder: '/stuck' }], reader)
  assert.equal(out.live[0].branch, null, 'unread')
  assert.ok(Date.now() - started < 3_000)
})

// The 0.3.14 review, iteration 3, ER-28: a git's deadline counts from its spawn, and a git that never answers gives its
// slot back then, so a folder queued behind four stuck ones is read; at the cap (four stuck) a slot is kept, and work
// still queued when its answer was given runs no git once a slot frees.
test('ER-28: stuck gits give their slots back at their deadline; queued work already answered runs no git', async () => {
  const ran = []
  let release5
  const reader = createBranchReader({
    git: (folder) => {
      ran.push(folder)
      if (folder === '/stuck5') return new Promise((r) => { release5 = () => r('main') })
      return folder.startsWith('/stuck') ? new Promise(() => {}) : Promise.resolve('main')
    },
    now: () => 0, timeoutMs: 20, concurrency: 4
  })
  const first = await Promise.all(['/stuck1', '/stuck2', '/stuck3', '/stuck4', '/queued'].map((f) => reader.read(f)))
  assert.deepEqual(first, [null, null, null, null, 'main'], 'the fifth folder is read once the stuck gits give their slots back')
  // Four stuck now (the cap): four more stuck gits keep their slots, so a folder queued behind them is answered unknown...
  const more = Promise.all(['/stuck5', '/stuck6', '/stuck7', '/stuck8'].map((f) => reader.read(f)))
  assert.equal(await reader.read('/b'), null)
  await more
  // ...and when a slot frees after that, its queued work runs no git.
  release5()
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(ran.includes('/b'), false)
})
