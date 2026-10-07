// The fallback order's machine side (ADR-0125): the resolver's measurement and probe mapping, the
// ad-hoc launch loop and its failure classes, the record terminal.opened@1 carries, and which held
// sessions a walk may attach to. No real agent runs: detection, spawn and the journal are fakes.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRunnerFallback, describeExhausted, launchRoute, openWithFallback } from '../src/main/runnerFallback.ts'
import { PtyManager, RunnerUnavailable, SpawnFailure, LaunchAuthorityChanged } from '../src/main/pty.ts'
import { LaunchRefusedBeforeSpawn } from '../src/main/launchFailure.ts'

const row = (id, state = 'found', auth = 'authenticated') => ({ id, label: id, connected: true, state, version: '1.0.0', path: `/bin/${id}`, install: null, authentication: { state: auth, method: null, reason: null } })

// ── the resolver: one measurement shared, probe results as the contract names them ─────────────────
{
  let detections = 0
  let clock = 1_000
  const seen = []
  const fallback = createRunnerFallback({
    order: () => [{ runner: 'claude-code', session: 'attach-only' }, { runner: 'codex', session: 'spawn' }, { runner: 'hermes', session: 'spawn' }],
    detect: async (runners) => { detections++; return [row('claude-code'), row('codex', 'missing'), row('hermes', 'found', 'unknown')].filter((r) => runners.some((x) => x.id === r.id)) },
    surfaceUp: () => true,
    attachable: (project, runner, mode, skip) => { seen.push([project, runner, mode, [...skip]]); return null },
    now: () => clock
  })
  const [a, b] = await Promise.all([fallback.walk('p1', { kind: 'terminal', permissionMode: null }), fallback.walk('p1', { kind: 'terminal', permissionMode: null })])
  assert.equal(detections, 1, 'two walks at once share one detection')
  assert.deepEqual(a, b)
  assert.equal(a.state, 'selected')
  assert.equal(a.runner, 'hermes', 'an inconclusive sign-in check is judged by the version answer')
  assert.deepEqual(a.passedOver.map((p) => [p.runner, p.result]), [['claude-code', 'no-held-session'], ['codex', 'refused']], 'Codex has no gate, so an ask launch never falls to it')
  assert.deepEqual(seen[0], ['p1', 'claude-code', 'ask', []], 'the held session is asked for under the mode the launch would apply')
  await fallback.walk('p1', { kind: 'terminal', permissionMode: null })
  assert.equal(detections, 1, 'reused within 30 s')
  clock += 30_001
  await fallback.walk('p1', { kind: 'terminal', permissionMode: null })
  assert.equal(detections, 2, 'measured again after 30 s')
  fallback.invalidate()
  await fallback.walk('p1', { kind: 'task', permissionMode: null })
  assert.equal(detections, 3, 'invalidate forgets the measurement')
  const before = seen.length
  await fallback.walk('p1', { kind: 'task', permissionMode: null })
  assert.equal(seen.length, before, 'a task never looks for a session to attach')
  assert.equal(fallback.configured(), true)
}
{
  const fallback = createRunnerFallback({ order: () => [{ runner: 'claude-code', session: 'spawn' }], detect: async () => [row('claude-code', 'found', 'not-authenticated')], surfaceUp: () => true, attachable: () => null })
  const walk = await fallback.walk('p', { kind: 'terminal', permissionMode: null })
  assert.equal(walk.state, 'exhausted')
  assert.deepEqual(walk.passedOver.map((p) => p.result), ['not-connected'], 'signed out only when the check says so')
  assert.match(describeExhausted(walk), /Claude Code is signed out/)
  assert.match(describeExhausted({ state: 'exhausted', passedOver: [] }), /Settings → Fallback order/)
}
console.log('PASS runner fallback: one shared measurement for 30 s, contract probe results, held sessions asked for under the applied mode, tasks never attach')

// ── the launch loop and its failure classes ─────────────────────────────────────────────────────────
const selected = (runner, index, session = 'spawned', sessionId = null) => ({ state: 'selected', index, runner, session, sessionId, permissionMode: null, passedOver: index ? [{ index: 0, runner: 'claude-code', result: 'no-held-session' }] : [] })
{
  const opened = []
  const walks = []
  const result = await openWithFallback({
    walk: async (failed, skip) => { walks.push([[...failed], [...skip]]); return failed.has('codex') ? selected('hermes', 2) : selected('codex', 1) },
    open: async (runner, route) => { opened.push([runner, route]); if (runner === 'codex') throw new SpawnFailure('codex', '/w', 'boom'); return { sessionId: 's-hermes' } },
    get: () => null,
    unavailable: (e) => e instanceof SpawnFailure || e instanceof RunnerUnavailable
  })
  assert.deepEqual(result, { sessionId: 's-hermes' })
  assert.deepEqual(walks, [[[], []], [['codex'], []]], 'a spawn that started nothing moves the walk on')
  assert.deepEqual(opened[1][1], { basis: 'host-order', requested: 'fallback-order', selected_index: 2, session: 'spawned', probes: [{ index: 0, runner: 'claude-code', result: 'no-held-session' }] })
}
{
  let opens = 0
  await assert.rejects(openWithFallback({
    walk: async () => selected('codex', 0),
    open: async () => { opens++; throw new LaunchAuthorityChanged('s') },
    get: () => null,
    unavailable: (e) => e instanceof SpawnFailure || e instanceof RunnerUnavailable
  }), /authority changed/)
  assert.equal(opens, 1, 'a request that is no longer valid is never retried on another runner')
  assert.ok(new LaunchAuthorityChanged('s') instanceof LaunchRefusedBeforeSpawn, 'the managed launch reads it as "nothing started"')
}
{
  const skips = []
  const result = await openWithFallback({
    walk: async (_f, skip) => { skips.push([...skip]); return skip.has('gone') ? selected('claude-code', 0, 'attached', 'held') : selected('claude-code', 0, 'attached', 'gone') },
    open: async () => { throw Error('must attach, not open') },
    get: (id) => (id === 'held' ? { sessionId: 'held' } : null),
    unavailable: () => false
  })
  assert.deepEqual(result, { sessionId: 'held' })
  assert.deepEqual(skips, [[], ['gone']], 'a held session that vanished is skipped, so the loop cannot spin')
}
{
  const recorded = []
  await assert.rejects(openWithFallback({
    walk: async () => ({ state: 'exhausted', passedOver: [{ index: 0, runner: 'hermes', result: 'not-installed' }] }),
    open: async () => ({}), get: () => null, unavailable: () => false, record: (op, d) => recorded.push([op, d])
  }), /Hermes Agent is not installed/)
  assert.deepEqual(recorded, [['runner.fallback-exhausted', { passed_over: ['hermes:not-installed'] }]])
}
assert.deepEqual(launchRoute(selected('codex', 1)).probes, [{ index: 0, runner: 'claude-code', result: 'no-held-session' }])
console.log('PASS fallback launch: unavailable moves on, a changed authority stops, a vanished session is skipped, exhaustion names every agent')

// ── which held sessions a walk may attach to ────────────────────────────────────────────────────────
{
  const writes = []
  const fake = () => ({ pid: 4242, resize() {}, kill() {}, write(t) { writes.push(t) }, onData() {}, onExit() {} })
  const manager = new PtyManager({ append: async () => ({ seq: 1 }) }, randomUUID(), { onData() {}, onExit() {} }, undefined, fake, undefined, () => ({ kind: 'person', id: 'operator' }))
  const project = randomUUID()
  const plain = await manager.open(project, process.cwd(), 'shell')
  const busy = Date.now
  try {
    assert.equal(manager.attachable(project, 'shell', null, new Set()), null, 'a session with output in the last minute is not idle')
    Date.now = () => busy() + 120_000
    assert.equal(manager.attachable(project, 'shell', null, new Set()), plain.sessionId, 'idle, same runner, same project, same mode')
    assert.equal(manager.attachable(project, 'shell', 'ask', new Set()), null, 'another mode is another execution context')
    assert.equal(manager.attachable(randomUUID(), 'shell', null, new Set()), null, 'another project never')
    assert.equal(manager.attachable(project, 'shell', null, new Set([plain.sessionId])), null, 'a task\'s session is excluded')
    manager.haltInput(plain.sessionId)
    assert.equal(manager.attachable(project, 'shell', null, new Set()), null, 'a session that takes no input is not attached')
  } finally {
    Date.now = busy
  }
}
console.log('PASS attachable: idle, same runner, project and mode, accepting input, not a task\'s')
