// The screens waves S3 (2026-11-16): the person's launch of a console, moved out of `index.ts`'s `terminal.open` into
// `consoleOpen.ts`. The folder lock refuses a second agent and lets a shell through (CO-236); the agent starts in the
// repository or, with none, in the home folder (UXA-C04); the fallback order attaches to a held session it can claim
// and spawns past a runner that could not serve (ADR-0125); the first instruction is delivered trimmed, and the attach
// claim lasts until it is (CO-229).
import assert from 'node:assert/strict'
import test from 'node:test'
import { createConsoleOpen } from '../src/main/consoleOpen.ts'
import { FOLDER_HELD_SAYS } from '../src/main/launchFolderLock.ts'
import { FALLBACK_OPTION } from '../src/shared/runnerRoute.ts'

class Unavailable extends Error {}

function harness({ repo = '/work/atlas', held = false, walks = [], openFails = new Set() } = {}) {
  const log = []
  let delivered = () => {}
  const sessions = new Map([['held-1', { sessionId: 'held-1' }]])
  const deps = {
    readProject: async () => ({ repo_path: repo }),
    folderHeld: () => held,
    home: () => '/Users/example',
    ptys: {
      open: async (projectId, cwd, optionId, taskId, mode, _a, _r, _p, route) => {
        if (openFails.has(optionId)) throw new Unavailable(optionId)
        log.push(['open', projectId, cwd, optionId, mode, route?.basis ?? null])
        return { sessionId: `s-${optionId}` }
      },
      get: (id) => sessions.get(id) ?? null,
      claimAttach: (id) => { log.push(['claim', id]); return true },
      releaseAttach: (id) => log.push(['release', id]),
      deliverWhenReady: (id, text) => { log.push(['deliver', id, text]); return new Promise((ok) => { delivered = ok }) }
    },
    walk: async (_p, _m, failed, skip) => {
      const w = walks.shift()
      log.push(['walk', [...failed], [...skip]])
      return w ?? { state: 'exhausted', passedOver: [] }
    },
    unavailable: (e) => e instanceof Unavailable,
    record: (op) => log.push(['record', op]),
    failed: (op) => log.push(['failed', op]),
    syncPower: () => log.push(['power'])
  }
  return { open: createConsoleOpen(deps), log, deliver: () => delivered() }
}
const tick = () => new Promise((r) => setImmediate(r))

test('a held folder refuses a second agent and lets a plain shell through', async () => {
  const h = harness({ held: true })
  await assert.rejects(h.open('p1', 'claude-code'), (e) => e.message === FOLDER_HELD_SAYS)
  assert.equal((await h.open('p1', 'shell')).sessionId, 's-shell')
})

test('the agent starts in the repository, or in the home folder when none is attached', async () => {
  const a = harness()
  await a.open('p1', 'codex', undefined, 'manual')
  assert.deepEqual(a.log.find((l) => l[0] === 'open'), ['open', 'p1', '/work/atlas', 'codex', 'manual', null])
  const b = harness({ repo: null })
  await b.open('p1', 'codex')
  assert.equal(b.log.find((l) => l[0] === 'open')[2], '/Users/example')
  assert.ok(b.log.some((l) => l[0] === 'power'), 'the power blocker follows the new console')
})

test('the first instruction is delivered trimmed; nothing is claimed for a direct launch', async () => {
  const h = harness()
  await h.open('p1', 'claude-code', '  Run the tests  ')
  assert.deepEqual(h.log.find((l) => l[0] === 'deliver'), ['deliver', 's-claude-code', 'Run the tests'])
  assert.ok(!h.log.some((l) => l[0] === 'release'))
})

test('the fallback order attaches to a held session and keeps its claim until the instruction is delivered', async () => {
  const h = harness({ walks: [{ state: 'selected', index: 0, runner: 'claude-code', session: 'attached', sessionId: 'held-1', permissionMode: null, passedOver: [] }] })
  const s = await h.open('p1', FALLBACK_OPTION, 'Go on')
  assert.equal(s.sessionId, 'held-1')
  assert.ok(h.log.some((l) => l[0] === 'claim' && l[1] === 'held-1'))
  await tick()
  assert.ok(!h.log.some((l) => l[0] === 'release'), 'still claimed while the instruction waits')
  h.deliver(); await tick(); await tick()
  assert.ok(h.log.some((l) => l[0] === 'release' && l[1] === 'held-1'), 'released once delivered')
})

test('the fallback order spawns past a runner that could not serve', async () => {
  const sel = (runner, index) => ({ state: 'selected', index, runner, session: 'spawned', sessionId: null, permissionMode: null, passedOver: [] })
  const h = harness({ walks: [sel('codex', 0), sel('claude-code', 1)], openFails: new Set(['codex']) })
  const s = await h.open('p1', FALLBACK_OPTION)
  assert.equal(s.sessionId, 's-claude-code')
  assert.deepEqual(h.log.filter((l) => l[0] === 'walk')[1], ['walk', ['codex'], []], 'the second walk excludes the runner that failed')
  assert.equal(h.log.find((l) => l[0] === 'open')[5], 'host-order', 'the spawn records its route')
})

// 2026-11-20, the owner's «what blocks work first»: a CEO-started session sat 40 minutes on an empty prompt. The first
// instruction is now followed to its end, and its end is written.
function follow({ results, screen = () => '', runner = 'claude-code', echo = '❯ [Pasted text #1 +12 lines]', enterStarts = true, turnTaken } = {}) {
  const log = []
  let text = ''
  const queue = [...results]
  const session = { sessionId: 's1', optionId: runner }
  const deps = {
    readProject: async () => ({ repo_path: '/work/atlas' }),
    folderHeld: () => false,
    home: () => '/Users/example',
    ptys: {
      open: async () => session,
      get: () => session,
      claimAttach: () => true,
      releaseAttach: () => {},
      deliverWhenReady: async (_id, _text, options) => { log.push(['deliver', options ?? null]); const r = queue.shift(); text += echo; return r },
      scrollbackOf: () => ({ text: text + screen() }),
      // The extra Enter sends the paste, and Claude Code then starts its turn (unless the test says it does not).
      write: (_id, data) => { log.push(['write', data]); if (data === '\r' && enterStarts) text += '\n✻ Working… (\x1b[1mesc\x1b[1Cto\x1b[1Cinterrupt\x1b[0m)' }
    },
    walk: async () => ({ state: 'exhausted', passedOver: [] }),
    unavailable: () => false,
    record: () => {},
    failed: (op) => log.push(['failed', op]),
    syncPower: () => {},
    delivered: (d) => log.push(['delivered', d]),
    sleep: async () => {},
    ...(turnTaken ? { turnTaken } : {})
  }
  const open = createConsoleOpen(deps)
  return { open, log }
}

test('a first instruction whose readiness lapsed waits once more, and the log says how it ended', async () => {
  const h = follow({ results: [{ state: 'failed_before_write', reason: 'readiness_timeout' }, { state: 'written' }], runner: 'codex' })
  const s = await h.open('p1', 'codex', 'Do it')
  const o = await h.open.firstInstruction(s.sessionId)
  assert.deepEqual(o, { state: 'delivered', attempts: 2 })
  assert.equal(h.log.filter((l) => l[0] === 'deliver').length, 2)
  assert.deepEqual(h.log.find((l) => l[0] === 'delivered')[1], { session_id: 's1', runner: 'codex', state: 'delivered', attempts: 2 })
})

test('a first instruction never written is said as not delivered, never as success', async () => {
  const h = follow({ results: [{ state: 'failed_before_write', reason: 'readiness_timeout' }, { state: 'failed_before_write', reason: 'readiness_timeout' }] })
  const s = await h.open('p1', 'claude-code', 'Do it')
  const o = await h.open.firstInstruction(s.sessionId)
  assert.equal(o.state, 'not_delivered')
  assert.equal(o.reason, 'readiness_timeout')
  assert.ok(!h.log.some((l) => l[0] === 'write'), 'nothing is typed blind')
})

test('a paste left waiting in Claude Code\'s box gets one more Enter; a turn that started gets none', async () => {
  const waiting = follow({ results: [{ state: 'written' }] })
  await waiting.open('p1', 'claude-code', 'Long task')
  assert.equal((await waiting.open.firstInstruction('s1')).state, 'resubmitted')
  assert.deepEqual(waiting.log.filter((l) => l[0] === 'write'), [['write', '\r']])
  const working = follow({ results: [{ state: 'written' }], screen: () => '\n✻ Thinking… (esc to interrupt)' })
  await working.open('p1', 'claude-code', 'Long task')
  assert.equal((await working.open.firstInstruction('s1')).state, 'delivered')
  assert.ok(!working.log.some((l) => l[0] === 'write'), 'no Enter once a turn started: it could answer the agent\'s question')
})

test('0.3.27 review PL-2: a short task written to Claude Code with no turn started is unconfirmed, never «delivered»', async () => {
  const silent = follow({ results: [{ state: 'written' }], echo: '❯ go' })
  await silent.open('p1', 'claude-code', 'go')
  assert.deepEqual(await silent.open.firstInstruction('s1'), { state: 'written_unconfirmed', reason: 'no_turn_started', attempts: 1 })
  assert.ok(!silent.log.some((l) => l[0] === 'write'), 'no blind Enter: it could accept a trust or update screen')
  const started = follow({ results: [{ state: 'written' }], echo: '❯ go\n✻ Working… (esc to interrupt)' })
  await started.open('p1', 'claude-code', 'go')
  assert.equal((await started.open.firstInstruction('s1')).state, 'delivered')
})

test('a plain shell is never typed a task in words; the end says why (2026-11-20, «parse error near )»)', async () => {
  const h = follow({ results: [{ state: 'written' }], runner: 'shell' })
  const s = await h.open('p1', 'shell', 'Сделай обзор (кратко)')
  assert.equal(h.log.filter((l) => l[0] === 'deliver').length, 0, 'nothing reaches the shell')
  assert.deepEqual(await h.open.firstInstruction(s.sessionId), { state: 'not_delivered', reason: 'shell_takes_no_task', attempts: 0 })
  assert.equal(h.log.find((l) => l[0] === 'delivered')[1].reason, 'shell_takes_no_task')
})

test('0.3.27 review ER-20, DO-6: an Enter after which no turn starts is unconfirmed; the first task waits for quiet', async () => {
  const lost = follow({ results: [{ state: 'written' }], enterStarts: false })
  await lost.open('p1', 'claude-code', 'Long task')
  assert.deepEqual(await lost.open.firstInstruction('s1'), { state: 'written_unconfirmed', reason: 'no_turn_after_enter', attempts: 1 })
  assert.deepEqual(lost.log.find((l) => l[0] === 'deliver')[1], { quietOnly: true }, 'a first instruction never takes the busy path')
})

// 2026-11-20 (0daa75f1, e150fe59): the paste written before Claude Code drew its box left no trace on the screen; its
// transcript held no turn from the person. Then the task is typed once more; an unknown transcript never retypes.
test('a first task dropped without a trace is typed once more when the transcript holds no turn', async () => {
  const turns = [false, true]
  const h = follow({ results: [{ state: 'written' }, { state: 'written' }], echo: '', turnTaken: async () => turns.shift() ?? null })
  const s = await h.open('p1', 'claude-code', 'Do it')
  const o = await h.open.firstInstruction(s.sessionId)
  assert.deepEqual(o, { state: 'resubmitted', reason: 'retyped', attempts: 2 })
  assert.equal(h.log.filter((l) => l[0] === 'deliver').length, 2, 'typed once more, never twice more')
  assert.equal(h.log.filter((l) => l[0] === 'write').length, 0, 'no bare Enter that could answer a screen')
})

test('an unknown transcript never retypes; a turn in the transcript is delivered', async () => {
  const unknown = follow({ results: [{ state: 'written' }], echo: '', turnTaken: async () => null })
  const s1 = await unknown.open('p1', 'claude-code', 'Do it')
  assert.deepEqual(await unknown.open.firstInstruction(s1.sessionId), { state: 'written_unconfirmed', reason: 'no_turn_started', attempts: 1 })
  assert.equal(unknown.log.filter((l) => l[0] === 'deliver').length, 1)
  const taken = follow({ results: [{ state: 'written' }], echo: '', turnTaken: async () => true })
  const s2 = await taken.open('p1', 'claude-code', 'Do it')
  assert.deepEqual(await taken.open.firstInstruction(s2.sessionId), { state: 'delivered', reason: 'turn_in_transcript', attempts: 1 })
  assert.equal(taken.log.filter((l) => l[0] === 'deliver').length, 1)
})

test('a retype that still makes no turn is said as unconfirmed, with why', async () => {
  const h = follow({ results: [{ state: 'written' }, { state: 'written' }], echo: '', turnTaken: async () => false })
  const s = await h.open('p1', 'claude-code', 'Do it')
  assert.deepEqual(await h.open.firstInstruction(s.sessionId), { state: 'written_unconfirmed', reason: 'no_turn_after_retype', attempts: 2 })
})
