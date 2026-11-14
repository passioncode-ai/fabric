// fabric_board_search's reads and answer (the operator, 2026-11-14: «хочу чтобы агенты делали раг поиск по доске когда
// ищут связи кто чем занят»; spec docs/evidence/specs/2026-11-14-board-search.md): each part stands alone, a failed read
// is named and never read as "nothing matches", the board window narrows to fit, and every hit says who holds it.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { searchBoard, BOARD_PAGES } = await import(path.resolve(import.meta.dirname, '../src/main/boardSearchRead.ts'))

const NOW = Date.parse('2026-11-14T12:00:00Z')
const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const PROJECT = '33333333-3333-4333-8333-333333333333'
const MEDIA = '44444444-4444-4444-8444-444444444444'

function deps(over = {}) {
  return {
    projectId: PROJECT,
    sessionId: ME,
    now: () => NOW,
    tasks: async () => ({ rows: [
      { id: 't1', title: 'Диспетчер доски: повторные запуски', instruction: 'the board dispatcher starts a run twice', status: 'running', moved_at: '2026-11-14T09:00:00Z' },
      { id: 't2', title: 'Иконка приложения', instruction: '', status: 'done', moved_at: '2026-11-01T09:00:00Z' },
      { id: 't3', title: 'Поиск по доске для агентов', instruction: '', status: 'done', moved_at: '2026-11-10T09:00:00Z' }
    ], failed: null }),
    liveClaims: async () => [{ id: 'c1', work_id: 't1', owner_session: OTHER, agent: 'codex', came_in: 'enrolled', claimed_at: '2026-11-14T08:00:00Z', life: 'live', touches: ['apps/desktop/src/main/boardDispatchRun.ts'] }],
    releasedClaims: async () => ({ rows: [{ id: 'c0', work_id: 't3', owner_session: OTHER, agent: 'claude-code', released_how: 'done', released_at: '2026-11-10T09:00:00Z' }], failed: null }),
    notes: async () => ({ rows: [{ id: 'n1', task_id: 't2', author_kind: 'person', body_md: 'иконку отдать в медиа-службу', created_at: '2026-11-02T10:00:00Z' }], failed: null }),
    boardList: async () => ({ messages: [
      { id: 'm1', thread: 'th1', kind: 'request', sender: { project: PROJECT }, at: '2026-11-13T10:00:00Z', body: { text: 'нужна иконка для доски' },
        request: { id: 'r1', target: MEDIA, capability: 'media.order', state: 'queued' } }
    ], cursor: null }),
    // The contract's shape (boardService.ts#commsDirectorySchema): each capability is {capability, responder}.
    boardDirectory: async () => ({ projects: [{ id: MEDIA, name: 'media-house', capabilities: [{ capability: 'media.order', responder: 'active' }, { capability: 'icon', responder: 'absent' }] }], cursor: null }),
    ...over
  }
}

test('a hit names who holds the task now, or held it last, and who groups the holders', async () => {
  const a = await searchBoard({ query: 'диспетчер dispatcher' }, deps())
  assert.equal(a.hits[0].kind, 'task')
  assert.equal(a.hits[0].task.id, 't1')
  assert.equal(a.hits[0].held_by.session_id, OTHER)
  assert.equal(a.hits[0].held_by.agent, 'codex')
  assert.equal(a.hits[0].held_by.is_you, false)
  assert.ok(a.who.some((w) => w.live && w.holder.includes('codex')))
  const b = await searchBoard({ query: 'поиск по доске' }, deps())
  const t3 = b.hits.find((h) => h.task?.id === 't3')
  assert.equal(t3.held_by, null)
  assert.equal(t3.last_held_by.agent, 'claude-code')
  assert.equal(t3.last_held_by.released, 'done')
})

test('a board request names its target project by name and its state; a project hit names its capabilities', async () => {
  const a = await searchBoard({ query: 'иконка icon' }, deps())
  const req = a.hits.find((h) => h.kind === 'request')
  assert.equal(req.request.target, 'media-house')
  assert.equal(req.request.state, 'queued')
  assert.equal(req.from, 'this project')
  const proj = a.hits.find((h) => h.kind === 'project')
  assert.deepEqual(proj.project.capabilities, ['media.order', 'icon'])
  assert.ok(a.who.some((w) => w.holder === 'media-house' && w.live))
  assert.ok(a.hits.some((h) => h.kind === 'note' && h.author === 'the operator'))
})

test('a part that fails is named in degraded and the others still answer; every part failing is never "nothing matches"', async () => {
  const a = await searchBoard({ query: 'иконка' }, deps({ boardList: async () => ({ error: { code: 'not_available', message: 'the board is down' } }), notes: async () => { throw new Error('database away') },
    releasedClaims: async () => ({ rows: [], failed: 'the released claims could not be read: timeout' }) }))
  assert.deepEqual(a.degraded.map((d) => d.part).sort(), ['board', 'notes', 'released claims'])
  assert.ok(a.hits.some((h) => h.task?.id === 't2'))
  const none = await searchBoard({ query: 'иконка', kinds: ['board'] }, deps({ boardList: async () => { throw new Error('socket hang up') } }))
  assert.equal(none.hits.length, 0)
  assert.match(none.note, /not "nothing matches"/)
})

test('DA-1: the board is read narrowest first and the widest window that fits whole is kept, so the newest are never left out', async () => {
  const daysOf = (since) => Math.round(((NOW - Date.parse(since)) / 86_400_000) * 24) / 24
  // Fits in one day and in seven, not in thirty: seven days are kept, and no thirty-day page beyond the bound is read.
  const sinces = []
  const fitsInSeven = async ({ since }) => { sinces.push(daysOf(since)); return { messages: [{ id: `m${sinces.length}`, thread: 'th', kind: 'message', sender: { project: PROJECT }, at: since, body: { text: 'board' } }], cursor: daysOf(since) > 7 ? 'more' : null } }
  const a = await searchBoard({ query: 'board', kinds: ['board'], days: 30 }, deps({ boardList: fitsInSeven }))
  assert.deepEqual(sinces, [1, 7, ...Array(BOARD_PAGES).fill(30)])
  assert.equal(a.read.board_window_days, 7)
  assert.equal(a.capped, undefined)
  // Not even one day fits: six hours, then one hour, are read whole when they fit.
  const sixHours = []
  const busy = async ({ since }) => { sixHours.push(daysOf(since)); return { messages: [], cursor: daysOf(since) > 0.25 ? 'more' : null } }
  const b = await searchBoard({ query: 'board', kinds: ['board'] }, deps({ boardList: busy }))
  assert.equal(b.read.board_window_days, 0.25)
  assert.equal(b.capped, undefined)
  assert.deepEqual([...new Set(sixHours)], [1, 0.25])
  // Not even the last hour fits: it is kept and named capped.
  const endless = async () => ({ messages: [], cursor: 'more' })
  const c = await searchBoard({ query: 'board', kinds: ['board'] }, deps({ boardList: endless }))
  assert.deepEqual(c.capped, ['board'])
  assert.equal(Math.round(c.read.board_window_days * 24), 1)
})

test('DA-5: the released claims at their bound are named capped; tasks read only for notes\' titles are not', async () => {
  const many = Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}`, work_id: 'none', owner_session: OTHER, released_how: 'done', released_at: '2026-11-10T09:00:00Z' }))
  const full = Array.from({ length: 500 }, (_, i) => ({ id: `t${i}`, title: 'x', status: 'done', moved_at: '2026-11-10T09:00:00Z' }))
  const a = await searchBoard({ query: 'board', kinds: ['tasks'] }, deps({ releasedClaims: async () => ({ rows: many, failed: null }) }))
  assert.deepEqual(a.capped, ['released claims'])
  const b = await searchBoard({ query: 'board', kinds: ['notes'] }, deps({ tasks: async () => ({ rows: full, failed: null }) }))
  assert.equal(b.capped, undefined)
})

test('nothing matching says the words were not found, not that nobody works on it', async () => {
  const a = await searchBoard({ query: 'zebra' }, deps())
  assert.equal(a.hits.length, 0)
  assert.match(a.note, /not that nobody works on it/)
})

test('UX-1 (0.3.21 review, iteration 1): a capability alone finds the project that takes it, as com.directory answers it', async () => {
  const a = await searchBoard({ query: 'media.order', kinds: ['projects'] }, deps())
  assert.equal(a.hits.length, 1)
  assert.equal(a.hits[0].project.name, 'media-house')
  assert.deepEqual(a.hits[0].project.capabilities, ['media.order', 'icon'])
})

test('UX-5 (0.3.21 review, iteration 1): unread claims mark every task hit unknown; a query of stop words searches nothing and says so', async () => {
  const a = await searchBoard({ query: 'диспетчер dispatcher' }, deps({ liveClaims: async () => { throw new Error('database away') } }))
  const hit = a.hits.find((h) => h.kind === 'task')
  assert.equal(hit.holder_unknown, true)
  assert.match(a.holders, /could not be read/)
  const none = await searchBoard({ query: 'who is what' }, deps())
  assert.equal(none.hits.length, 0)
  assert.match(none.note, /no words that can be searched/)
})
