// The screens waves S3 (2026-11-16): the person's «start a task», moved out of `index.ts`'s `tasks.start` into
// `taskStart.ts`. The fallback choice becomes the runner before the task exists (ADR-0125); a setup preset is refused
// without the surface (0.3.3 verification); a known id is the SAME task, brought forward when it runs or started again
// through admission; a new one starts with the route its walk chose.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createTaskStart } from '../src/main/taskStart.ts'
import { FALLBACK_OPTION } from '../src/shared/runnerRoute.ts'

const P = 'p1', T = '87000000-0000-4000-8000-0000000000a1', B = '87000000-0000-4000-8000-0000000000b1'
function harness({ task = null, live = null, surface = true, walk = null, managed = { started: true, sessionId: 's-again' } } = {}) {
  const log = []
  const start = createTaskStart({
    walk: async (projectId, launch) => { log.push(['walk', projectId, launch]); return walk ?? { state: 'exhausted', passedOver: [] } },
    bindingRunner: async (id) => { log.push(['binding', id]); return 'claude-code' },
    surfaceUp: () => surface,
    readTask: async () => ({ data: task, error: null }),
    liveSession: () => live,
    launchManaged: async (input) => { log.push(['managed', input]); return managed },
    startTask: async (input) => { log.push(['start', input]); return { task: { id: input.taskId ?? 'new', project_id: P }, session: { sessionId: 's-new' } } },
    oneAtATime: (key, work) => { log.push(['queue', key]); return work() }
  })
  return { start, log }
}
const base = { projectId: P, instruction: 'Write the notes', optionId: 'codex' }

test('the fallback choice becomes the runner before the task exists, with the walk as its route', async () => {
  const h = harness({ walk: { state: 'selected', index: 1, runner: 'claude-code', session: 'spawned', sessionId: null, permissionMode: null, passedOver: [{ index: 0, runner: 'codex', result: 'not-installed' }] } })
  await h.start({ ...base, optionId: FALLBACK_OPTION })
  const started = h.log.find((l) => l[0] === 'start')[1]
  assert.equal(started.optionId, 'claude-code')
  assert.equal(started.route.basis, 'host-order')
  assert.equal(started.route.selected_index, 1)
})

test('an exhausted order starts nothing', async () => {
  const h = harness()
  await assert.rejects(h.start({ ...base, optionId: FALLBACK_OPTION }))
  assert.ok(!h.log.some((l) => l[0] === 'start'))
})

test('a setup preset needs a runner that connects to the surface, and the surface up', async () => {
  await assert.rejects(harness({ surface: false }).start({ ...base, optionId: 'claude-code', preset: 'setup' }), /setup-surface-down/)
  const h = harness()
  await h.start({ ...base, optionId: B, preset: 'setup' })
  assert.ok(h.log.some((l) => l[0] === 'binding' && l[1] === B), 'a created agent is judged by its runner')
  assert.ok(h.log.some((l) => l[0] === 'start'))
})

test('a known id is the same task: brought forward when it runs, admitted again when it does not', async () => {
  const running = harness({ task: { id: T, project_id: P, status: 'running' }, live: 's-live' })
  assert.equal((await running.start({ ...base, taskId: T })).session.sessionId, 's-live')
  assert.ok(running.log.some((l) => l[0] === 'queue' && l[1] === T), 'one start of an id at a time')
  assert.ok(!running.log.some((l) => l[0] === 'start' || l[0] === 'managed'))
  const again = harness({ task: { id: T, project_id: P, status: 'backlog' } })
  assert.equal((await again.start({ ...base, taskId: T, permissionMode: 'ask' })).session.sessionId, 's-again')
  assert.deepEqual(again.log.find((l) => l[0] === 'managed')[1], { taskId: T, trigger: 'operator', permissionMode: 'ask' })
  const refused = harness({ task: { id: T, project_id: P, status: 'backlog' }, managed: { started: false, says: 'a blocker is open' } })
  await assert.rejects(refused.start({ ...base, taskId: T }), /a blocker is open/)
})

test('a new id starts a new task under that id', async () => {
  const h = harness()
  await h.start({ ...base, taskId: T })
  assert.equal(h.log.find((l) => l[0] === 'start')[1].taskId, T)
})
