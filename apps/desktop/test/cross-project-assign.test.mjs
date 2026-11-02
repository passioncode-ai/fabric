// CO-458: «Поручить агенту B в Fabric». No board or database: the deps are stand-ins with the shapes index.ts gives.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { assignAcross, answerAssigned } = await import(path.resolve(import.meta.dirname, '../src/main/crossProjectAssign.ts'))

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const TA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', REQ = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
function world(over = {}) {
  const w = { submitted: [], replied: [], filed: [], notes: [], tasks: new Map([[TA, { id: TA, project_id: A, title: 'Fix the login', instruction: 'x' }]]),
    submitAnswer: { ok: true, message: REQ, request: { id: REQ } }, replyAnswer: { ok: true, repeated: false }, ...over }
  w.deps = {
    readTask: async (id) => w.tasks.get(id) ?? null,
    readProject: async (id) => (id === A ? { id: A, name: 'Atlas' } : id === B ? { id: B, name: 'Mail' } : null),
    submit: async (p, input) => { w.submitted.push({ p, input }); return w.submitAnswer },
    reply: async (p, input) => { w.replied.push({ p, input }); return w.replyAnswer },
    epoch: async () => 1,
    fileTask: async (p, title, instruction) => { const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; w.tasks.set(id, { id, project_id: p, title, instruction }); w.filed.push({ p, title, instruction }); return { id } },
    note: async (taskId, p, body) => { w.notes.push({ taskId, p, body }) },
    notes: async (taskId) => w.notes.filter((n) => n.taskId === taskId).map((n) => n.body).reverse()
  }
  return w
}

test('CO-458: the ask becomes a board request from A to B and a task in B, tied by a note; A\'s task says it was assigned', async () => {
  const w = world()
  const r = await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'Add a retry to the mail sender', key: 'k1' })
  assert.deepEqual(r, { ok: true, taskId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', requestId: REQ, project: 'Mail' })
  assert.equal(w.submitted.length, 1)
  const { p, input } = w.submitted[0]
  assert.equal(p, A, 'sent as A')
  assert.deepEqual(input.request, { target: B, capability: 'project.work' })
  assert.deepEqual(input.idempotency, { epoch: 1, key: 'assign:k1' })
  assert.match(input.body.text, new RegExp(`task ${TA}`))
  assert.equal(w.filed[0].p, B)
  assert.match(w.filed[0].instruction, new RegExp(REQ))
  assert.match(w.notes.find((n) => n.p === B).body, new RegExp(`^Board request: ${REQ} \\(from task ${TA} in project ${A}\\)`))
  assert.match(w.notes.find((n) => n.taskId === TA).body, /^Поручено Mail: «Add a retry to the mail sender»/)
})

test('CO-458: a refused request files nothing in B; nothing is sent for an empty ask or the task\'s own project', async () => {
  const w = world({ submitAnswer: { error: { code: 'not_authorized', message: 'two businesses' } } })
  const r = await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'x', key: 'k' })
  assert.equal(r.ok, false)
  assert.match(r.reason, /not_authorized/)
  assert.deepEqual([w.filed.length, w.notes.length], [0, 0])
  const v = world()
  assert.equal((await assignAcross(v.deps, { fromTaskId: TA, toProjectId: B, text: '  ', key: 'k' })).ok, false)
  assert.equal((await assignAcross(v.deps, { fromTaskId: TA, toProjectId: A, text: 'x', key: 'k' })).ok, false)
  assert.equal(v.submitted.length, 0)
})

test('CO-458: B\'s task released done answers the request as B, once, and tells A\'s task', async () => {
  const w = world()
  const { taskId } = await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'Add a retry', key: 'k1' })
  assert.deepEqual(await answerAssigned(w.deps, taskId), { answered: true })
  assert.equal(w.replied[0].p, B, 'answered by the target, which answers the request')
  assert.equal(w.replied[0].input.replyTo, REQ)
  assert.deepEqual(w.replied[0].input.idempotency, { epoch: 1, key: `assign-done:${taskId}` })
  assert.ok(w.notes.some((n) => n.taskId === TA && /^Mail сделал: «Add a retry»/.test(n.body)))
  // A second done release repeats the same reply (the board answers repeated) and writes no second note.
  w.replyAnswer = { ok: true, repeated: true }
  await answerAssigned(w.deps, taskId)
  assert.equal(w.notes.filter((n) => n.taskId === TA && /сделал/.test(n.body)).length, 1)
})

test('CO-458: a task that was not assigned answers nothing', async () => {
  const w = world()
  assert.deepEqual(await answerAssigned(w.deps, TA), { answered: false })
  assert.equal(w.replied.length, 0)
})
