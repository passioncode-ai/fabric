// CO-458: «Поручить агенту B в Fabric». No board or database: the deps are stand-ins with the shapes index.ts gives.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { assignAcross, answerAssigned, assignedTaskId } = await import(path.resolve(import.meta.dirname, '../src/main/crossProjectAssign.ts'))

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
    fileTask: async (p, id, title, instruction) => { if (w.failFile) { w.failFile--; throw new Error('the journal did not answer') } w.tasks.set(id, { id, project_id: p, title, instruction }); w.filed.push({ p, id, title, instruction }); return { id } },
    note: async (taskId, p, body) => { if (w.failNote) { w.failNote--; throw new Error('the journal did not answer') } w.notes.push({ taskId, p, body }) },
    notes: async (taskId) => w.notes.filter((n) => n.taskId === taskId).map((n) => n.body).reverse()
  }
  return w
}

test('CO-458: the ask becomes a board request from A to B and a task in B, tied by a note; A\'s task says it was assigned', async () => {
  const w = world()
  const r = await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'Add a retry to the mail sender', key: 'k1' })
  assert.deepEqual(r, { ok: true, taskId: assignedTaskId(REQ), requestId: REQ, project: 'Mail' })
  assert.match(r.taskId, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'B\'s task is named by the request (UUID v5)')
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

test('CO-510: a retry with the same key after the task was filed but not marked files no second task and completes the marks', async () => {
  const w = world({ failNote: 1 })
  await assert.rejects(assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'Add a retry', key: 'k1' }))
  assert.equal(w.filed.length, 1)
  assert.equal(w.notes.length, 0, 'the first attempt left B\'s task without its mark')
  // The board answers the stored request again (the same key), so the retry reaches the same request id.
  w.submitAnswer = { ok: true, repeated: true, message: REQ, request: { id: REQ } }
  const r = await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'Add a retry', key: 'k1' })
  assert.equal(r.ok, true)
  assert.equal(w.filed.length, 1, 'one task in B for one request')
  assert.equal(w.notes.filter((n) => n.p === B && /^Board request: /.test(n.body)).length, 1)
  assert.equal(w.notes.filter((n) => n.taskId === TA && /^Поручено/.test(n.body)).length, 1)
  // So releasing B's task answers the request.
  assert.deepEqual(await answerAssigned(w.deps, r.taskId), { answered: true })
})

test('CO-510: a repeated assign after a full success writes nothing twice; a retry after the filing failed files it once', async () => {
  const w = world()
  await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'Add a retry', key: 'k1' })
  w.submitAnswer = { ok: true, repeated: true, message: REQ, request: { id: REQ } }
  await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'Add a retry', key: 'k1' })
  assert.deepEqual([w.filed.length, w.notes.length], [1, 2])
  const v = world({ failFile: 1 })
  await assert.rejects(assignAcross(v.deps, { fromTaskId: TA, toProjectId: B, text: 'x', key: 'k2' }))
  assert.equal(v.filed.length, 0)
  assert.equal((await assignAcross(v.deps, { fromTaskId: TA, toProjectId: B, text: 'x', key: 'k2' })).ok, true)
  assert.deepEqual([v.filed.length, v.notes.length], [1, 2])
})

test('CO-510: a filing that fails because a concurrent retry filed the task first continues with that task', async () => {
  const w = world()
  w.deps.fileTask = async (p, id, title, instruction) => { w.tasks.set(id, { id, project_id: p, title, instruction }); w.filed.push({ p, id }); throw new Error('duplicate key') }
  const r = await assignAcross(w.deps, { fromTaskId: TA, toProjectId: B, text: 'x', key: 'k3' })
  assert.equal(r.ok, true)
  assert.equal(w.notes.filter((n) => n.p === B).length, 1)
})

test('CO-458: a task that was not assigned answers nothing', async () => {
  const w = world()
  assert.deepEqual(await answerAssigned(w.deps, TA), { answered: false })
  assert.equal(w.replied.length, 0)
})
