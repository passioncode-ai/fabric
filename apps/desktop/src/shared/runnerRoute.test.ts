// The fallback order's walk (ADR-0125; contract DEC-0029). Pure, so every rule the main process relies
// on is checked here without a machine: what passes a runner over, in which order, and what is never
// walked at all.

import { describe, expect, it } from 'vitest'
import { appliedMode, cleanOrder, walkFallback, type FallbackEntry, type RunnerProbe } from './runnerRoute.ts'

const ready: RunnerProbe = { install: 'found', signedIn: 'yes', surfaceUp: true, heldSession: null }
const probeOf = (overrides: Record<string, Partial<RunnerProbe>>, seen: Array<[string, string | null]> = []) => (runner: string, mode: string | null): RunnerProbe => {
  seen.push([runner, mode])
  return { ...ready, ...(overrides[runner] ?? {}) }
}
const terminal = { kind: 'terminal' as const, permissionMode: null }
const order = (...entries: Array<[string, FallbackEntry['session']]>): FallbackEntry[] => entries.map(([runner, session]) => ({ runner, session }))

describe('the operator\'s fallback order', () => {
  it('answers from Hermes when no Claude Code session is open — the operator\'s own example', () => {
    const walk = walkFallback(order(['claude-code', 'attach-only'], ['hermes', 'spawn']), terminal, probeOf({}))
    expect(walk).toMatchObject({ state: 'selected', runner: 'hermes', session: 'spawned', index: 1 })
    expect(walk.passedOver).toEqual([{ index: 0, runner: 'claude-code', result: 'no-held-session' }])
  })

  it('attaches to the Claude Code session Fabric holds when there is one, and starts nothing', () => {
    const walk = walkFallback(order(['claude-code', 'attach-only'], ['hermes', 'spawn']), terminal, probeOf({ 'claude-code': { heldSession: 's-1' } }))
    expect(walk).toMatchObject({ state: 'selected', runner: 'claude-code', session: 'attached', sessionId: 's-1', passedOver: [] })
  })

  it('never attaches for a managed task: its admission minted a new session', () => {
    const walk = walkFallback(order(['claude-code', 'attach-or-spawn']), { kind: 'task', permissionMode: null }, probeOf({ 'claude-code': { heldSession: 's-1' } }))
    expect(walk).toMatchObject({ state: 'selected', session: 'spawned', sessionId: null })
  })

  it('passes over a missing, a silent and a signed-out runner with the contract\'s results, in order', () => {
    const walk = walkFallback(order(['claude-code', 'spawn'], ['kilo', 'spawn'], ['hermes', 'spawn']), terminal,
      probeOf({ 'claude-code': { install: 'missing' }, kilo: { install: 'unresponsive' }, hermes: { signedIn: 'no' } }))
    expect(walk.state).toBe('exhausted')
    expect(walk.passedOver.map((p) => [p.runner, p.result])).toEqual([['claude-code', 'not-installed'], ['kilo', 'not-responding'], ['hermes', 'not-connected']])
  })

  it('does not start a surface-connected ACP runner while the surface is down', () => {
    const walk = walkFallback(order(['hermes', 'spawn'], ['claude-code', 'spawn']), terminal, probeOf({ hermes: { surfaceUp: false } }))
    expect(walk).toMatchObject({ state: 'selected', runner: 'claude-code' })
    // A surface that is down is a reason this launch cannot run Hermes; `not-connected` is the sign-in check's word only.
    expect(walk.passedOver[0]).toMatchObject({ runner: 'hermes', result: 'refused' })
  })

  it('never trades a gate for none: an ask launch does not fall to a runner without modes', () => {
    const walk = walkFallback(order(['claude-code', 'spawn'], ['codex', 'spawn']), { kind: 'terminal', permissionMode: 'ask' }, probeOf({ 'claude-code': { install: 'missing' } }))
    expect(walk.state).toBe('exhausted')
    expect(walk.passedOver[1]).toMatchObject({ runner: 'codex', result: 'refused' })
  })

  it('refuses a runner that has no mode of the chosen name', () => {
    const walk = walkFallback(order(['claude-code', 'spawn'], ['hermes', 'spawn']), { kind: 'terminal', permissionMode: 'plan' }, probeOf({ 'claude-code': { install: 'missing' } }))
    expect(walk.passedOver[1]).toMatchObject({ runner: 'hermes', result: 'refused' })
  })

  it('keeps a task on runners that can return its result the way the first choice would', () => {
    const walk = walkFallback(order(['hermes', 'spawn'], ['kimi-code', 'spawn']), { kind: 'task', permissionMode: null }, probeOf({ hermes: { install: 'missing' } }))
    expect(walk.state).toBe('exhausted')
    expect(walk.passedOver[1]).toMatchObject({ runner: 'kimi-code', result: 'refused' })
  })

  it('passes over a runner whose spawn already failed, so the caller can move on without walking again', () => {
    const walk = walkFallback(order(['claude-code', 'spawn'], ['hermes', 'spawn']), terminal, probeOf({}), new Set(['claude-code']))
    expect(walk).toMatchObject({ state: 'selected', runner: 'hermes' })
    expect(walk.passedOver).toEqual([{ index: 0, runner: 'claude-code', result: 'spawn-failed' }])
  })

  it('walks only the order: never a plain shell or a runner twice; a runner this build does not know is named, not lost', () => {
    expect(cleanOrder(order(['shell', 'spawn'], ['some-new-agent', 'spawn'], ['codex', 'spawn'], ['codex', 'attach-only'], ['Bad Id', 'spawn']))).toEqual(order(['some-new-agent', 'spawn'], ['codex', 'spawn']))
    expect(walkFallback(order(['shell', 'spawn']), terminal, probeOf({}))).toEqual({ state: 'exhausted', passedOver: [] })
    const walk = walkFallback(order(['some-new-agent', 'spawn'], ['claude-code', 'spawn']), terminal, probeOf({}))
    expect(walk).toMatchObject({ state: 'selected', runner: 'claude-code' })
    expect(walk.passedOver).toEqual([{ index: 0, runner: 'some-new-agent', result: 'not-catalogued' }])
  })

  it('asks for a held session under exactly the mode the launch would apply to that runner', () => {
    const seen: Array<[string, string | null]> = []
    walkFallback(order(['claude-code', 'attach-only'], ['codex', 'spawn']), { kind: 'terminal', permissionMode: 'plan' }, probeOf({}, seen))
    expect(seen[0]).toEqual(['claude-code', 'plan'])
    const seenDefault: Array<[string, string | null]> = []
    walkFallback(order(['claude-code', 'attach-only']), terminal, probeOf({}, seenDefault))
    expect(seenDefault[0]).toEqual(['claude-code', 'ask'])
  })

  it('a task passes over an open-session-only entry as refused, never as "no held session"', () => {
    const walk = walkFallback(order(['claude-code', 'attach-only'], ['hermes', 'spawn']), { kind: 'task', permissionMode: null }, probeOf({ 'claude-code': { heldSession: 's-1' } }))
    expect(walk).toMatchObject({ state: 'selected', runner: 'hermes' })
    expect(walk.passedOver[0]).toMatchObject({ runner: 'claude-code', result: 'refused' })
  })

  it('records the mode the runner actually receives: none for a runner without modes', () => {
    expect(appliedMode('codex', 'ask')).toBeNull()
    expect(appliedMode('claude-code', null)).toBe('ask')
    expect(appliedMode('kimi-code', 'bypass')).toBe('bypass')
  })
})

describe('a task that records through Fabric\'s tools (0.3.3 verification, iteration 2)', () => {
  it('passes over a runner that does not connect to the surface, and takes the next that does', () => {
    const walk = walkFallback(order(['codex', 'spawn'], ['claude-code', 'spawn']), { kind: 'task', permissionMode: null, needsSurface: true }, probeOf({}))
    expect(walk.state).toBe('selected')
    if (walk.state === 'selected') expect(walk.runner).toBe('claude-code')
    expect(walk.passedOver.map((p) => [p.runner, p.result])).toEqual([['codex', 'refused']])
  })
  it('without the need, the first installed runner is taken as before', () => {
    const walk = walkFallback(order(['codex', 'spawn'], ['claude-code', 'spawn']), { kind: 'task', permissionMode: null }, probeOf({}))
    if (walk.state === 'selected') expect(walk.runner).toBe('codex')
  })
})

