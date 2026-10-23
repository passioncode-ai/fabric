import { describe, expect, it } from 'vitest'
import { LADDER, TERMINAL, mayMove, type TaskState } from './ladder.ts'
import { PROTOCOL_VERSION, buildProtocol, protocolHash } from './protocol.ts'

const at = new Date('2026-09-08T15:04:05Z')

describe('the protocol is built from the runtime, not written beside it', () => {
  it('enumerates every task state the ladder has', () => {
    const p = buildProtocol({ now: at, timeZone: 'Europe/Berlin' })
    for (const state of Object.keys(LADDER) as TaskState[])
      expect(p.vocabulary.taskStates).toContain(state)
    expect(p.vocabulary.taskStates).toHaveLength(Object.keys(LADDER).length)
  })

  it('names the moves an AGENT may make, and only those', () => {
    // The agent used to learn the allowed set by being refused. `z.enum` refuses
    // a bad status; nothing ever told it what the good ones were.
    const p = buildProtocol({ now: at, timeZone: 'UTC' })
    for (const [from, tos] of Object.entries(LADDER)) {
      const allowed = p.vocabulary.agentMoves[from as TaskState] ?? []
      const truth = (tos as TaskState[]).filter(
        (to) => mayMove('agent', from as TaskState, to).ok
      )
      expect(allowed).toEqual(truth)
    }
  })

  it('does not offer a terminal move to an agent, because the ladder does not', () => {
    const p = buildProtocol({ now: at, timeZone: 'UTC' })
    for (const terminal of TERMINAL) expect(p.vocabulary.agentMoves[terminal]).toEqual([])
    expect(p.vocabulary.agentMoves.running).not.toContain('done')
  })

  it('carries the time the session was told, with its zone', () => {
    // A model answers "is this library current" from a training cutoff unless
    // something in the session says otherwise. This is that something.
    const p = buildProtocol({ now: at, timeZone: 'Europe/Berlin' })
    expect(p.now.utc).toBe('2026-09-08T15:04:05.000Z')
    expect(p.now.timeZone).toBe('Europe/Berlin')
  })

  it('states plainly that the agent must not date anything from memory', () => {
    const p = buildProtocol({ now: at, timeZone: 'UTC' })
    expect(p.rules.join(' ')).toMatch(/today|current date|from memory/i)
  })
})

describe('the hash answers "which rules did this session get"', () => {
  it('is stable for the same protocol', () => {
    const a = buildProtocol({ now: at, timeZone: 'UTC' })
    const b = buildProtocol({ now: at, timeZone: 'UTC' })
    expect(protocolHash(a)).toBe(protocolHash(b))
  })

  it('ignores the clock, because the rules did not change at midnight', () => {
    const a = buildProtocol({ now: at, timeZone: 'UTC' })
    const b = buildProtocol({ now: new Date('2026-12-25T00:00:00Z'), timeZone: 'UTC' })
    expect(protocolHash(a)).toBe(protocolHash(b))
  })

  it('moves when a rule moves', () => {
    const a = buildProtocol({ now: at, timeZone: 'UTC' })
    const b = buildProtocol({ now: at, timeZone: 'UTC', extraRules: ['and one more thing'] })
    expect(protocolHash(a)).not.toBe(protocolHash(b))
  })

  it('moves when the ladder moves, which is the point of deriving it', () => {
    const a = buildProtocol({ now: at, timeZone: 'UTC' })
    // A change an AGENT can feel. `review: ['running']` looked like a change and
    // is not one: done and cancelled are already refused to agents, so the moves
    // offered are identical and the hash was right not to move. Removing
    // `review` from `running` takes away a move the agent actually had.
    const b = buildProtocol({
      now: at,
      timeZone: 'UTC',
      ladder: { ...LADDER, running: ['backlog', 'done', 'cancelled'] as readonly TaskState[] }
    })
    expect(a.vocabulary.agentMoves.running).not.toEqual(b.vocabulary.agentMoves.running)
    expect(protocolHash(a)).not.toBe(protocolHash(b))
  })

  it('carries a version alongside the hash, so a change is nameable', () => {
    expect(PROTOCOL_VERSION).toMatch(/^\d+$/)
    expect(buildProtocol({ now: at, timeZone: 'UTC' }).version).toBe(PROTOCOL_VERSION)
  })
})

describe('what the protocol refuses to claim', () => {
  it('says it was SERVED, and never that it was understood', () => {
    const p = buildProtocol({ now: at, timeZone: 'UTC' })
    // Serving, acknowledging and understanding are three different facts, and
    // an audit that merges them cannot answer what the agent was working from.
    expect(p.served).toBe(true)
    expect(Object.keys(p)).not.toContain('acknowledged')
    expect(Object.keys(p)).not.toContain('understood')
  })
})

describe('the working language (P-24): agents write in the language of Fabric\'s interface', () => {
  it('names the language, natively too, and says so in a rule right after the date', () => {
    const p = buildProtocol({ now: at, timeZone: 'UTC', language: 'ru' })
    expect(p.language).toEqual({ code: 'ru', name: 'Russian', native: 'Русский' })
    expect(p.rules[1]).toMatch(/^\[ADVICE\] Write everything a person will read in Russian \(Русский\)/)
    expect(p.rules[1]).toMatch(/board messages/)
    expect(p.rules[1]).toMatch(/Documents in a project's repository keep the language that project uses/)
  })

  it('is English when the interface is', () => {
    const p = buildProtocol({ now: at, timeZone: 'UTC', language: 'en' })
    expect(p.language?.code).toBe('en')
    expect(p.rules[1]).toMatch(/in English \(English\)/)
  })

  it('is a different protocol in another language, so a session can tell which rules it had', () => {
    const ru = buildProtocol({ now: at, timeZone: 'UTC', language: 'ru' })
    const en = buildProtocol({ now: at, timeZone: 'UTC', language: 'en' })
    expect(protocolHash(ru)).not.toBe(protocolHash(en))
  })

  it('no other rule sends the agent to guess the language from how it is spoken to', () => {
    const p = buildProtocol({ now: at, timeZone: 'UTC', language: 'ru' })
    for (const rule of p.rules) expect(rule).not.toMatch(/language they write to you in|in their language/)
  })
})

describe('the working language can be switched off (the operator\'s walk OF-38)', () => {
  it('names no language and adds no language rule when the person turned it off', () => {
    const p = buildProtocol({ now: at, timeZone: 'UTC', language: null })
    expect(p.language).toBeNull()
    expect(p.rules.some((r) => r.includes('the language of Fabric'))).toBe(false)
    expect(p.rules[1]).toMatch(/^A task is in one of/)
  })
})
