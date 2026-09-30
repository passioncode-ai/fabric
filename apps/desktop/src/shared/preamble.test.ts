import { describe, expect, it } from 'vitest'
import { NAMED_TOOL, PREAMBLE } from './preamble.ts'

describe('the session preamble', () => {
  it('names fabric_whoami, because that is the whole point of it', () => {
    expect(PREAMBLE).toContain(NAMED_TOOL)
  })

  it('names NO OTHER Fabric tool — a rule in the stub is a rule in two places', () => {
    // The failure this guards is not hypothetical: the rules in `fabric_whoami`
    // are nine sentences an author will feel is safer to "also" put in the
    // system prompt. The moment one of them is here, it can be true here and
    // false there, and nothing would ever compare the two.
    const named = [...PREAMBLE.matchAll(/fabric_[a-z_]+/g)].map((m) => m[0])
    expect([...new Set(named)]).toEqual([NAMED_TOOL])
  })

  it('stays short enough to survive being prepended to somebody else’s prompt', () => {
    // A preamble long enough to compete with the operator's instruction is a
    // preamble that gets truncated, ignored, or edited out by the runner.
    expect(PREAMBLE.length).toBeLessThan(600)
  })

  it('tells the agent what to do when the call fails, rather than leaving it to improvise', () => {
    expect(PREAMBLE).toMatch(/fails/)
  })
})
