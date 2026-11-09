// One project's board requests, both ways (SCN-181, CO-543), read in main through the waiting list's door: the
// requests addressed to it and the ones it sent, each with its newest state, and the other projects' names. A read
// that fails rejects, so the page never says «no requests» for a read that did not happen.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { readProjectRequests, readProjectSources, REQUEST_ROWS, SOURCE_ROWS } = await import(path.resolve(import.meta.dirname, '../src/main/projectRequests.ts'))

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const P3 = '33333333-3333-4333-8333-333333333333'
const NOW = Date.parse('2026-11-09T12:00:00Z')

const submit = (id, from, to, at, subject = null) => ({
  seq: 1, occurred_at: at,
  payload: { kind: 'request', message_id: id, thread_id: 'th-' + id, sender_project_id: from, request: { target_project_id: to, capability: 'code.review' }, thread_new: subject ? { subject } : null }
})

function store({ incoming = [], outgoing = [], transitions = [], projects = [], fail = {}, sources = [] } = {}) {
  const calls = []
  return {
    calls,
    select: (table, columns) => {
      const call = { table, columns, eq: [] }
      calls.push(call)
      const chain = {
        eq: (c, v) => { call.eq.push([c, v]); return chain },
        gte: (c, v) => { call.gte = [c, v]; return chain },
        order: () => chain,
        limit: (n) => {
          call.limit = n
          if (table === 'task_sources') return Promise.resolve(fail.sources ? { data: null, error: { message: fail.sources } } : { data: sources, error: null })
          const way = call.eq.some(([c]) => c === 'payload->>sender_project_id') ? 'outgoing' : 'incoming'
          if (fail[way]) return Promise.resolve({ data: null, error: { message: fail[way] } })
          return Promise.resolve({ data: way === 'outgoing' ? outgoing : incoming, error: null })
        }
      }
      return chain
    },
    selectIn: async (table, columns, key, values, chunk, signal, eq) => {
      calls.push({ table, key, values, eq })
      if (table === 'journal') return fail.transitions ? { rows: [], failed: fail.transitions } : { rows: transitions.filter((t) => values.includes(t.payload.request_id)), failed: null }
      return fail.projects ? { rows: [], failed: fail.projects } : { rows: projects.filter((p) => values.includes(p.id)), failed: null }
    }
  }
}

test('reads the requests both ways, each with its newest state and the other project\'s name', async () => {
  const s = store({
    incoming: [submit('in1', P2, P1, '2026-11-08T10:00:00Z', 'Review the API')],
    outgoing: [submit('out1', P1, P3, '2026-11-07T10:00:00Z')],
    transitions: [
      { seq: 5, occurred_at: '2026-11-08T11:00:00Z', payload: { request_id: 'in1', to: 'claimed' } },
      { seq: 9, occurred_at: '2026-11-08T12:00:00Z', payload: { request_id: 'in1', to: 'answered' } },
      { seq: 7, occurred_at: '2026-11-08T11:30:00Z', payload: { request_id: 'in1', to: 'in_progress' } }
    ],
    projects: [{ id: P2, name: 'Billing' }, { id: P3, name: 'Docs' }]
  })
  const r = await readProjectRequests(s, P1, NOW)
  assert.deepEqual(r.requests, [
    { requestId: 'in1', threadId: 'th-in1', from: P2, to: P1, capability: 'code.review', subject: 'Review the API', state: 'answered', at: '2026-11-08T10:00:00Z', changedAt: '2026-11-08T12:00:00Z' },
    { requestId: 'out1', threadId: 'th-out1', from: P1, to: P3, capability: 'code.review', subject: null, state: null, at: '2026-11-07T10:00:00Z', changedAt: null }
  ])
  assert.deepEqual(r.names, { [P2]: 'Billing', [P3]: 'Docs' })
  assert.equal(r.capped, false)
  const [inRead, outRead] = s.calls
  assert.deepEqual(inRead.eq, [['type', 'comms.message_submitted@1'], ['payload->>kind', 'request'], ['payload->request->>target_project_id', P1]])
  assert.deepEqual(outRead.eq, [['type', 'comms.message_submitted@1'], ['payload->>kind', 'request'], ['payload->>sender_project_id', P1]])
  assert.equal(inRead.limit, REQUEST_ROWS)
  assert.equal(inRead.gte[0], 'occurred_at')
  assert.deepEqual(s.calls[2].eq, [['type', 'comms.request_transitioned@1']])
})

test('a request to itself is read once; a read at its bound is said capped', async () => {
  const self = submit('self', P1, P1, '2026-11-08T10:00:00Z')
  const many = Array.from({ length: REQUEST_ROWS }, (_, i) => submit('o' + i, P1, P2, '2026-11-08T10:00:00Z'))
  const r = await readProjectRequests(store({ incoming: [self], outgoing: [self, ...many], projects: [{ id: P2, name: 'Billing' }] }), P1, NOW)
  assert.equal(r.requests.filter((x) => x.requestId === 'self').length, 1)
  assert.equal(r.capped, true)
})

test('any read that fails rejects, never an empty list; a project id that is not one is refused', async () => {
  for (const fail of [{ incoming: 'away' }, { outgoing: 'away' }, { transitions: 'away' }, { projects: 'away' }])
    await assert.rejects(readProjectRequests(store({ incoming: [submit('in1', P2, P1, '2026-11-08T10:00:00Z')], fail }), P1, NOW))
  await assert.rejects(readProjectRequests(store(), 'p1; drop', NOW), /Invalid project identity/)
})

test('the project\'s backlog rows: read by project, a failure rejects, a full read is capped', async () => {
  const s = store({ sources: [{ task_id: 't1', path: 'docs/backlog.md', row_id: 'CO-1', repository: 'x' }, { task_id: 7 }] })
  const r = await readProjectSources(s, P1)
  assert.deepEqual(r, { sources: [{ task_id: 't1', path: 'docs/backlog.md', row_id: 'CO-1' }], capped: false })
  assert.deepEqual(s.calls[0].eq, [['project_id', P1]])
  assert.equal(s.calls[0].limit, SOURCE_ROWS)
  await assert.rejects(readProjectSources(store({ fail: { sources: 'away' } }), P1), /backlog rows/)
})
