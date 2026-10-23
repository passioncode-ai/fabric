// W2-7 (0.3.12, OF-31, SCN-171): the onboarding task a new project files: one id per project, a whole brief, and an
// instruction that records through the hub and changes nothing in the repository.
// #region project-onboarding — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

const { onboardingTask, onboardingTaskId, agentProfilePayload, createOnboardingFiler, writePersonBusiness } = await import(path.resolve(import.meta.dirname, '../src/main/projectOnboarding.ts'))
const { specGaps } = await import(path.resolve(import.meta.dirname, '../src/shared/taskSpec.ts'))
const P = '00000000-0000-4000-8000-000000000011'

test('the onboarding task\'s id is one per project, in the journal\'s canonical spelling', () => {
  const id = onboardingTaskId(P)
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(onboardingTaskId(P), id, 'the same project names the same task')
  assert.equal(onboardingTaskId(P.toUpperCase()), id, 'whatever the spelling')
  assert.notEqual(onboardingTaskId('00000000-0000-4000-8000-000000000012'), id)
})

test('its brief is whole in either language, so the intake rule is met before anyone starts it (ADR-0176)', () => {
  for (const locale of ['ru', 'en', null]) {
    const t = onboardingTask('fabric', locale)
    assert.deepEqual(specGaps({ brief_what: t.brief.what, brief_why: t.brief.why, brief_expected: t.brief.expected }), [])
  }
  assert.equal(onboardingTask('fabric', 'ru').title, 'Познакомиться с проектом fabric')
  assert.equal(onboardingTask('fabric', 'en').title, 'Get to know the project fabric')
  assert.equal(onboardingTask('fabric', 'de').title, 'Get to know the project fabric', 'an unknown locale is English')
})

test('the instruction records through the hub and changes nothing in the repository', () => {
  const { instruction } = onboardingTask('fabric', 'ru')
  assert.match(instruction, /fabric_project_profile/)
  assert.match(instruction, /Change nothing in the repository/)
  assert.match(instruction, /business/)
  assert.match(instruction, /leave that field out rather than guess/)
  assert.match(instruction, /The business is the person's: record it only while the project has none/)
})

test('DA-2: an agent cannot clear or change the business the person set; the person\'s correction stands after an agent run', () => {
  const person = { business: 'Appvillis' }
  const cleared = agentProfilePayload({ business: '  ' }, person)
  assert.equal(cleared.ok, false)
  assert.match(cleared.reason, /cannot clear/)
  const changed = agentProfilePayload({ goal: 'g', business: 'PassionCode' }, person)
  assert.equal(changed.ok, false, 'a different business is refused, and the rest of the call with it, so nothing is half written')
  assert.match(changed.reason, /only the person changes it: the person sets the business on the project page/)
  // The person corrected an agent's guess; the next agent run, naming its guess again, leaves the correction standing.
  const corrected = { business: 'PassionCode' }
  assert.equal(agentProfilePayload({ business: 'Appvillis', summary: 's' }, corrected).ok, false)
  // The same business (any case) is dropped, so the person's spelling stays; the rest is written.
  assert.deepEqual(agentProfilePayload({ summary: 's', business: ' passioncode ' }, corrected), { ok: true, payload: { summary: 's' } })
  // Nobody set one yet: the agent may record it.
  assert.deepEqual(agentProfilePayload({ business: ' Appvillis ' }, { business: null }), { ok: true, payload: { business: 'Appvillis' } })
  // An empty business is refused even when none is set: an agent never writes an empty one.
  assert.equal(agentProfilePayload({ business: '' }, { business: null }).ok, false)
  // A business that could not be read is not written over.
  assert.equal(agentProfilePayload({ business: 'X' }, null).ok, false)
  // A call without a business is not judged by it, and a call naming nothing writes nothing.
  assert.deepEqual(agentProfilePayload({ goal: 'g' }, person), { ok: true, payload: { goal: 'g' } })
  assert.equal(agentProfilePayload({}, person).ok, false)
})

// DA-5 / ER-6: filing is one act. A fake host: a task table the appends project into, and a journal that can refuse.
const host = ({ failAt = -1, readFails = false, slowRead = 0 } = {}) => {
  const tasks = new Map()
  const journal = []
  const failures = []
  const deps = {
    async readTask(taskId) {
      if (readFails) throw new Error('the onboarding task could not be read: stack lost')
      if (slowRead) await new Promise((r) => setTimeout(r, slowRead))
      const t = tasks.get(taskId)
      return t ? { brief: { ...t } } : null
    },
    async append(event) {
      // A real gap, so a second press's read can land between the first's read and its creation.
      if (slowRead) await new Promise((r) => setTimeout(r, 5))
      if (journal.length === failAt) throw new Error('journal refused')
      journal.push(event)
      if (event.type === 'task.created@1' && !tasks.has(event.payload.id)) tasks.set(event.payload.id, { what: null, why: null, expected: null })
      if (event.type === 'task.brief.edited@1') tasks.get(event.payload.task_id)[event.payload.section] = event.payload.body_md
    },
    locale: () => 'en',
    failed: (e, detail) => failures.push([e.message, detail.projectId])
  }
  return { deps, tasks, journal, failures }
}

test('DA-5: a filing stopped after the creation is completed by the next press, which writes only the missing parts', async () => {
  const h = host({ failAt: 2 })
  const file = createOnboardingFiler(h.deps)
  await assert.rejects(file(P, 'fabric'), /journal refused/)
  assert.deepEqual(h.failures, [['journal refused', P]], 'the failure is recorded before it is thrown')
  assert.deepEqual(h.journal.map((e) => e.type), ['task.created@1', 'task.brief.edited@1'])
  const ok = host()
  ok.tasks.set(onboardingTaskId(P), { what: h.tasks.get(onboardingTaskId(P)).what, why: null, expected: '  ' })
  const again = await createOnboardingFiler(ok.deps)(P, 'fabric')
  assert.deepEqual(again, { taskId: onboardingTaskId(P), filed: false })
  assert.deepEqual(ok.journal.map((e) => e.payload.section), ['why', 'expected'], 'only the empty parts are written')
  const brief = ok.tasks.get(onboardingTaskId(P))
  assert.deepEqual(specGaps({ brief_what: brief.what, brief_why: brief.why, brief_expected: brief.expected }), [])
  assert.equal((await createOnboardingFiler(ok.deps)(P, 'fabric')).filed, false)
  assert.equal(ok.journal.length, 2, 'a whole task writes nothing')
})

test('DA-5: two presses at once for one project journal the creation and the brief once', async () => {
  const h = host({ slowRead: 20 })
  const file = createOnboardingFiler(h.deps)
  const [a, b] = await Promise.all([file(P, 'fabric'), file(P.toUpperCase(), 'fabric')])
  assert.deepEqual([a.filed, b.filed].sort(), [false, true])
  assert.deepEqual(h.journal.map((e) => e.type), ['task.created@1', 'task.brief.edited@1', 'task.brief.edited@1', 'task.brief.edited@1'])
})

test('ER-6: a refused read is recorded before it is thrown, never swallowed silently', async () => {
  const h = host({ readFails: true })
  await assert.rejects(createOnboardingFiler(h.deps)(P, 'fabric'), /could not be read/)
  assert.deepEqual(h.failures, [['the onboarding task could not be read: stack lost', P]])
  assert.equal(h.journal.length, 0)
})

test('DA-9: the person\'s business for a project this estate does not hold is refused in plain words, and nothing is journaled', async () => {
  const appended = []
  const rows = new Map([[P, { id: P, business: null }]])
  const deps = {
    readProject: async (id) => ({ row: rows.get(id) ?? null, error: null }),
    append: async (payload) => { appended.push(payload); rows.get(P).business = payload.business || null }
  }
  await assert.rejects(writePersonBusiness(deps, '00000000-0000-4000-8000-0000000000ff', 'Appvillis'), /not in this estate/)
  assert.equal(appended.length, 0)
  // The person's write always applies, whatever an agent recorded before (DA-2).
  rows.get(P).business = 'AgentGuess'
  assert.equal((await writePersonBusiness(deps, P, ' Appvillis ')).business, 'Appvillis')
  assert.deepEqual(appended, [{ business: 'Appvillis' }])
  await assert.rejects(writePersonBusiness({ ...deps, readProject: async () => ({ row: null, error: 'stack lost' }) }, P, 'X'), /could not be read: stack lost/)
  await assert.rejects(writePersonBusiness(deps, P, 'x'.repeat(81)), /at most 80/)
})
// #endregion project-onboarding
