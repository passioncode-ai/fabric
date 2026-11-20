// Memory (docs/evidence/specs/2026-11-20-memory-dashboard.md): each source's freshness from the pass, the graph of
// organizations and projects with the board's requests between projects, the overview's counts, what changed in a
// window, and the same answers through the execute door the window, the CEO and the voice all call.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { EstateIndex } = await import(path.resolve(import.meta.dirname, '../src/main/estateIndex.ts'))
const { memoryOverview, memoryGraph, memoryChanges } = await import(path.resolve(import.meta.dirname, '../src/main/memoryRead.ts'))
const { createKnowledgeOperations } = await import(path.resolve(import.meta.dirname, '../src/main/knowledgeTools.ts'))
const { nextMarks, freshnessOf, composeMemoryGraph, FRESH_MS } = await import(path.resolve(import.meta.dirname, '../src/shared/memory.ts'))

const NOW = Date.parse('2026-11-20T21:00:00Z')
const labels = { names: new Map([['acme', 'Acme Org']]), personal: 'Owner' }

function seeded() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'memory-')), 'index.sqlite')
  const ix = new EstateIndex(file)
  ix.putGraph([
    { id: 'project:p1', kind: 'project', label: 'alpha', attrs: { folder: '/d/alpha', role: 'canonical', context: 'personal' } },
    { id: 'project:p2', kind: 'project', label: 'beta', attrs: { folder: '/d/beta', role: 'canonical', context: 'org:acme' } },
    { id: 'project:p3', kind: 'project', label: 'alpha', attrs: { folder: '/d/_worktrees/alpha-x', role: 'worktree', context: 'personal' } }
  ], [
    { src: 'message:m1', rel: 'belongs-to', dst: 'project:p1' }, { src: 'message:m1', rel: 'relates-to', dst: 'project:p2' },
    { src: 'message:m2', rel: 'belongs-to', dst: 'project:p2' }, { src: 'message:m2', rel: 'relates-to', dst: 'project:p1' },
    { src: 'message:m3', rel: 'belongs-to', dst: 'project:p1' }, { src: 'message:m3', rel: 'relates-to', dst: 'project:p1' }
  ])
  ix.putDocs([
    { id: 'task:t1', kind: 'task', source: 'fabric', node: 'task:t1', title: 'Memory dashboard', body: 'draw the graph', at: '2026-11-20T20:00:00Z', context: 'personal', project: 'alpha' },
    { id: 'commit:c1', kind: 'commit', source: 'git', node: 'commit:c1', title: 'feat: memory', body: 'feat: memory', at: '2026-11-20T19:00:00Z', context: 'personal', project: 'alpha' },
    { id: 'message:m2', kind: 'message', source: 'fabric', node: 'message:m2', title: 'Запрос: граф', body: 'нужен граф', at: '2026-11-18T10:00:00Z', context: 'org:acme', project: 'beta' },
    { id: 'claude:s1', kind: 'session', source: 'claude', node: 'session:s1', title: 'Сессия', body: 'граф', at: '2026-11-20T20:30:00Z', context: 'personal', project: 'alpha' }
  ])
  return { ix, file }
}

test('a source read without an error takes the pass time; one that failed keeps its last read and says why', () => {
  const first = nextMarks(null, { at: '2026-11-20T20:00:00Z', transcripts: { left: 12 }, degraded: ['transcript-unread: a.jsonl: x', 'documents-deferred: beta'], boardMore: true })
  assert.equal(first.transcripts.readAt, '2026-11-20T20:00:00Z')
  assert.equal(first.transcripts.left, 12)
  assert.equal(first.transcripts.unread, 1)
  assert.equal(first.git.left, 1, 'a repository whose documents wait')
  assert.equal(first.board.left, 1, 'older board pages wait')
  const second = nextMarks(first, { at: '2026-11-20T20:05:00Z', transcripts: { left: 0 }, degraded: ['board-unread: the board could not be read', 'vector-unavailable'], boardMore: false })
  assert.equal(second.board.readAt, '2026-11-20T20:00:00Z', 'a failed source keeps its last read')
  assert.match(second.board.error, /board could not be read/)
  assert.equal(second.vectors.error, 'vector-unavailable')
  assert.equal(freshnessOf(second.board, NOW), 'unread')
  assert.equal(freshnessOf(first.transcripts, NOW), 'catching-up')
  assert.equal(freshnessOf({ readAt: new Date(NOW - FRESH_MS + 1000).toISOString(), left: 0, unread: 0, error: null }, NOW), 'fresh')
  assert.equal(freshnessOf({ readAt: new Date(NOW - FRESH_MS - 1000).toISOString(), left: 0, unread: 0, error: null }, NOW), 'stale')
  assert.equal(freshnessOf(undefined, NOW), 'never')
})

test('the graph joins each canonical project to its organization, names it from Observatory, and counts requests both ways as one line', () => {
  const { ix } = seeded()
  const g = memoryGraph(ix, labels)
  const ids = g.nodes.map((n) => n.id).sort()
  assert.deepEqual(ids, ['ctx:org:acme', 'ctx:personal', 'project:p1', 'project:p2'], 'the worktree is not drawn apart from its project')
  assert.equal(g.nodes.find((n) => n.id === 'ctx:org:acme').label, 'Acme Org')
  assert.equal(g.nodes.find((n) => n.id === 'ctx:personal').label, 'Owner')
  const alpha = g.nodes.find((n) => n.id === 'project:p1')
  assert.equal(alpha.docs, 3)
  assert.deepEqual(alpha.byKind, { commit: 1, session: 1, task: 1 })
  assert.equal(alpha.lastAt, '2026-11-20T20:30:00Z')
  const board = g.edges.filter((e) => e.kind === 'board')
  assert.deepEqual(board, [{ source: 'project:p1', target: 'project:p2', kind: 'board', weight: 2 }], 'm1 and m2 are one line of weight 2; a request to oneself draws none')
  assert.deepEqual(memoryGraph(ix, labels, 'org:acme').nodes.map((n) => n.id).sort(), ['ctx:org:acme', 'project:p2'])
})

test('a request to a project the graph does not hold draws no line', () => {
  const g = composeMemoryGraph([{ id: 'a', name: 'a', context: 'personal', role: 'canonical', folder: null, docs: 1, byKind: {}, lastAt: null }], [{ from: 'a', to: 'gone', n: 3 }], new Map(), 'Owner')
  assert.equal(g.edges.filter((e) => e.kind === 'board').length, 0)
})

test('the overview counts by kind, source and context with each context named, and says each source never read before a pass', () => {
  const { ix, file } = seeded()
  const o = memoryOverview(ix, file, labels, NOW)
  assert.equal(o.docs, 4)
  assert.equal(o.projects, 2)
  assert.equal(o.sessions, 1)
  assert.deepEqual(o.byKind, { commit: 1, message: 1, session: 1, task: 1 })
  assert.deepEqual(o.byContext.map((c) => [c.label, c.docs]), [['Owner', 3], ['Acme Org', 1]])
  assert.ok(o.bytes > 0)
  assert.deepEqual(o.sources.map((s) => s.state), ['never', 'never', 'never', 'never', 'never'])
  assert.deepEqual(o.vectors, { model: null, embedded: 0, of: 4 })
})

test('what changed reads the window by project and kind, newest first, and narrows to one project', () => {
  const { ix } = seeded()
  const day = memoryChanges(ix, 24, undefined, NOW)
  assert.equal(day.total, 3, 'the board message of 2026-11-18 is outside the last day')
  assert.deepEqual(day.changes.map((c) => [c.project, c.kind]), [['alpha', 'session'], ['alpha', 'task'], ['alpha', 'commit']])
  assert.equal(day.changes[0].newest[0].id, 'claude:s1')
  const week = memoryChanges(ix, 168, 'beta', NOW)
  assert.deepEqual(week.changes.map((c) => [c.project, c.kind, c.count]), [['beta', 'message', 1]])
})

test('the execute door answers the memory operations for every caller, lists them, and keeps an answer until the next pass', async () => {
  const { ix, file } = seeded()
  const ops = createKnowledgeOperations({ index: () => ix, embedder: async () => null, catalogue: async () => [], refresh: async () => ({}), rebuild: async () => ({}), record: () => {}, file, labels: () => labels })
  const list = await ops.run('execute', { operations: true })
  for (const op of ['memory.overview', 'memory.graph', 'memory.changes']) assert.ok(op in list.operations, op)
  const g = await ops.run('execute', { operation: 'memory.graph', arguments: {} })
  assert.equal(g.ok, true)
  assert.equal(g.organizations.length, 2)
  const refused = await ops.run('execute', { operation: 'memory.changes', arguments: { hours: 500 } })
  assert.equal(refused.ok, false)
  const o1 = await ops.run('execute', { operation: 'memory.overview' })
  ix.putDocs([{ id: 'task:t9', kind: 'task', source: 'fabric', node: 'task:t9', title: 'new', body: 'new', at: '2026-11-20T20:59:00Z', context: 'personal', project: 'alpha' }])
  assert.equal((await ops.run('execute', { operation: 'memory.overview' })).docs, o1.docs, 'kept while no pass ran')
  ix.setMeta('last_pass', JSON.stringify({ at: '2026-11-20T21:00:00Z' }))
  assert.equal((await ops.run('execute', { operation: 'memory.overview' })).docs, o1.docs + 1, 'read again after a pass')
})
