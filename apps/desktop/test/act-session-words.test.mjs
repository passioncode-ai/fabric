// 0.3.7 review UX-6: a stopped or restarted console records its runner's id, so the renderer can word it
// (runnerLabel) in the person's language instead of the name main baked from the descriptor or a created agent's uuid.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSessionExecutors, sessionStopOutcome } from '../src/main/actSessionExecutors.ts'

const snapshot = { sessionId: 's1', projectId: 'p1', optionId: 'shell', permissionMode: null, cwd: '/w', label: 'Terminal' }

test('a stop and a start record the runner id beside the name', async () => {
  const stopped = sessionStopOutcome(snapshot, { sessionId: 's1', state: 'stopped', reasonCode: 'ok' }, 'Atlas')
  assert.equal(stopped.said.params.runner, 'shell')
  const ex = createSessionExecutors({
    runnerAvailable: async () => true,
    startAgain: async () => ({ sessionId: 's2', label: 'Terminal' }),
    stop: async (sessionId) => ({ sessionId, state: 'stopped', reasonCode: 'ok' }),
    snapshot: () => snapshot,
    projectName: async () => 'Atlas'
  })
  const started = await ex['session.start'].run(stopped.inverse.args)
  assert.equal(started.said.params.runner, 'shell')
})
