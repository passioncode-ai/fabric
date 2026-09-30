import { describe, expect, it } from 'vitest'
import { chainReach, DEFAULT_BOUND, mayChain, type SpawnedFrom } from './loopBound.ts'

/** a ← b ← c ← d: d is four hand-offs from a. */
const chain: SpawnedFrom = { b: 'a', c: 'b', d: 'c' }

describe('how far a hand-off has travelled', () => {
  it('an origin is depth zero', () => {
    expect(chainReach(chain, 'a').depth).toBe(0)
  })

  it('counts the chain back to what started it', () => {
    expect(chainReach(chain, 'b').depth).toBe(1)
    expect(chainReach(chain, 'd').depth).toBe(3)
  })

  it('counts ONE chain, not everything in the project', () => {
    // The failure that stops a busy project working for a reason that has
    // nothing to do with looping. Two independent chains of two are not a chain
    // of four.
    const two: SpawnedFrom = { b: 'a', y: 'x' }
    expect(chainReach(two, 'b').depth).toBe(1)
    expect(chainReach(two, 'y').depth).toBe(1)
  })

  it('stops on a cycle rather than hanging, AND SAYS IT WAS A CYCLE', () => {
    // THIS CASE USED TO ASSERT THE DEFECT. It expected `chainDepth` to answer 1
    // for a two-node cycle and called that "defence rather than expectation",
    // on the belief that "the DAG trigger refuses this at the write boundary".
    // It does not: ADR-0053 splits the vocabulary, and the trigger returns early
    // for a provenance edge in as many words — `spawned` is never refused for
    // topology, because "this child was spawned by that parent" must stay
    // recordable even when the parent blocks the child.
    //
    // So the cycle is writable, the walk returned a small number, and the bound
    // read it as a short chain. Rewritten rather than deleted: deleting it would
    // hide that it once passed while describing a guard that was not there.
    const reach = chainReach({ a: 'b', b: 'a' }, 'a')
    expect(reach.depth, 'the walk still terminates').toBe(1)
    expect(reach.cyclic, 'and the number is not a length').toBe(true)
  })
})

describe('whether a result may become another task', () => {
  it('lets work with no parent start a chain', () => {
    expect(mayChain(chain, null).ok).toBe(true)
  })

  it('allows a hand-off inside the bound', () => {
    const v = mayChain(chain, 'b')
    expect(v.ok).toBe(true)
    expect(v.depth).toBe(2)
  })

  it('REFUSES at the bound and says it is the bound working, not a failure', () => {
    // A refusal an agent reads as an error is one it routes around by filing the
    // same card another way — which defeats the only thing standing between a
    // hand-off and a runaway.
    const v = mayChain(chain, 'd')
    expect(v.ok).toBe(false)
    expect(v.depth).toBe(DEFAULT_BOUND)
    expect(v.reason).toContain('not a failure')
    expect(v.reason).toContain('proposal')
  })

  it('does not trip one hand-off early', () => {
    // Off by one here means the bound is really three, and nobody would know:
    // the product would just be quietly stricter than it says.
    expect(mayChain(chain, 'c').ok).toBe(true)
    expect(mayChain(chain, 'c').depth).toBe(3)
  })

  it('honours a bound the caller declared', () => {
    expect(mayChain(chain, 'b', 2).ok).toBe(false)
    expect(mayChain(chain, 'b', 9).ok).toBe(true)
  })
})

describe('a cycle in provenance is not a short chain', () => {
  // MEASURED at `d9a38f6`, and it defeats the one thing this module exists for.
  // Its own header calls the bound "the only thing standing between a hand-off
  // and a runaway".
  //
  // `spawned` is a PROVENANCE edge, and ADR-0053 refuses it for topology
  // deliberately — the command and the trigger both say so in as many words,
  // because "this child was spawned by that parent" is a true statement about
  // the past and must stay recordable even when the parent blocks the child.
  // So a spawned CYCLE can exist in `task_links`.
  //
  // `chainDepth` walks spawned links with a `seen` guard and returns the depth
  // it had reached when it met one. For A spawned B spawned C spawned A that is
  // 2 — comfortably under the bound of 4 — so `mayChain` says yes, and keeps
  // saying yes. The runaway M68 names is reachable through the guard built to
  // stop it.
  const cyclic = { a: 'c', c: 'b', b: 'a' }

  it('the fixture is a real cycle, or nothing below is about one', () => {
    // Every task in it names a parent, and following them returns to the start.
    expect(Object.keys(cyclic).every((k) => cyclic[k as keyof typeof cyclic])).toBe(true)
  })

  it('reports the chain as unbounded rather than as a number', () => {
    const reach = chainReach(cyclic, 'a')
    expect(reach.cyclic, 'a chain that returns to itself has no length').toBe(true)
  })

  it('and the bound REFUSES it, however few links were walked', () => {
    const verdict = mayChain(cyclic, 'a')
    expect(verdict.ok, 'a task that descends from itself may not hand off again').toBe(false)
    expect(verdict.reason).toMatch(/descends from itself|cycle/i)
  })

  it('but an ordinary short chain still hands off', () => {
    // The other direction, and it is what keeps the refusal meaningful: if any
    // repeated id refused, a legitimate two-step chain would stop working.
    expect(mayChain({ b: 'a' }, 'b').ok).toBe(true)
    expect(chainReach({ b: 'a' }, 'b').cyclic).toBe(false)
  })

  it('and a long-but-acyclic chain still trips the bound on its length', () => {
    const deep = { e: 'd', d: 'c', c: 'b', b: 'a' }
    const verdict = mayChain(deep, 'e')
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/hand-off/i)
  })
})
