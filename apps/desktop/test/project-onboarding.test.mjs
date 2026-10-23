// W2-7 (0.3.12, OF-31, SCN-171): the onboarding task a new project files: one id per project, a whole brief, and an
// instruction that records through the hub and changes nothing in the repository.
// #region project-onboarding — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

const { onboardingTask, onboardingTaskId, agentProfilePayload } = await import(path.resolve(import.meta.dirname, '../src/main/projectOnboarding.ts'))
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
// #endregion project-onboarding
