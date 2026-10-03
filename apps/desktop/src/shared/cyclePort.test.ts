import { describe, expect, it } from 'vitest'
import {
  MAX_STARTS_PER_POLL,
  WINDOW_STATES,
  advancesWatermark,
  planCycle,
  readCycleGap,
  runCyclePasses,
  worstOf
} from './cyclePort.ts'

// Release review 2026-10-03, iteration 3, orchestration finding 6. `index.ts#runCycle` ran the routine
// tick, the chain pass and the observer in ONE `try`, so a throwing tick meant the chain pass never ran
// that cycle — a follower whose predecessor had finished waited for a tick that would also throw.
describe('one pass of the cycle: each step in its own try, the states still composed', () => {
  const failed: unknown[] = []
  const log = { failed: (step: string, e: unknown) => failed.push([step, e]) }
  it('a throwing tick does not stop the chain pass, and the receipt says both', async () => {
    let chainsRan = false
    const got = await runCyclePasses({
      tick: async () => { throw new Error('routines unreadable') },
      advanceChains: async () => { chainsRan = true; return { state: 'completed', says: 'every waiting chain step was judged' } },
      sample: async () => 2
    }, log)
    expect(chainsRan).toBe(true)
    expect(got.state).toBe('failed_known')
    expect(got.observed).toBe(2)
    expect(got.says).toMatch(/routine tick failed: Error: routines unreadable/)
  })
  it('a throwing chain pass is composed with the tick it followed, and the observer still samples', async () => {
    const got = await runCyclePasses({
      tick: async () => ({ state: 'partial', says: '1 routine deferred' }),
      advanceChains: async () => { throw new Error('links unreadable') },
      sample: async () => 1
    }, log)
    expect(got.state).toBe('failed_known')
    expect(got.says).toBe('1 routine deferred; the chain pass failed: Error: links unreadable')
    expect(got.observed).toBe(1)
  })
  it('a quiet cycle stays quiet, and a chain that did nothing adds no words', async () => {
    const got = await runCyclePasses({
      tick: async () => ({ state: 'skipped_no_delta', says: '' }),
      advanceChains: async () => ({ state: 'skipped_no_delta', says: 'nothing waiting' }),
      sample: async () => { throw new Error('ptys gone') }
    }, log)
    expect(got.state).toBe('failed_known')
    expect(got.says).toBe('the observer failed: Error: ptys gone')
    expect(got.observed).toBe(0)
  })
  it('two clean steps compose to the worse of them', async () => {
    const got = await runCyclePasses({
      tick: async () => ({ state: 'completed', says: '1 routine started' }),
      advanceChains: async () => ({ state: 'partial', says: '1 chain step could not be advanced' }),
      sample: async () => 0
    }, log)
    expect(got.state).toBe('partial')
    expect(got.says).toBe('1 routine started; 1 chain step could not be advanced')
  })
})

describe('a poll is bounded, and it says what it deferred', () => {
  it('starts everything when everything fits', () => {
    const got = planCycle(['a', 'b'])
    expect(got.started).toEqual(['a', 'b'])
    expect(got.state).toBe('completed')
  })

  it('caps the starts and defers the rest rather than draining the queue', () => {
    // A day offline with ten due routines would otherwise start ten sessions in
    // the same second — ten agents competing for one machine, for an operator
    // who opened the app to look at one thing.
    const due = ['a', 'b', 'c', 'd', 'e']
    const got = planCycle(due)
    expect(got.started).toHaveLength(MAX_STARTS_PER_POLL)
    expect(got.deferred).toEqual(due.slice(MAX_STARTS_PER_POLL))
  })

  it('calls a poll that deferred work PARTIAL, not completed', () => {
    // Otherwise "the cycle ran" reads as "everything due has been handled".
    expect(planCycle(['a', 'b', 'c', 'd']).state).toBe('partial')
  })

  it('keeps the caller order, so the back of a long queue is not starved', () => {
    expect(planCycle(['z', 'y', 'x', 'w']).started).toEqual(['z', 'y', 'x'])
  })

  it('calls an empty poll SKIPPED, which is not a failure', () => {
    const got = planCycle([])
    expect(got.state).toBe('skipped_no_delta')
    expect(got.started).toEqual([])
  })
})

describe('what may move the watermark', () => {
  it('advances on completed and on nothing-to-do', () => {
    expect(advancesWatermark('completed')).toBe(true)
    expect(advancesWatermark('skipped_no_delta')).toBe(true)
  })

  it('NEVER advances on an unknown outcome', () => {
    // Advancing past work nobody can account for is how work disappears.
    expect(advancesWatermark('outcome_unknown')).toBe(false)
  })

  it('does not advance on partial, because only the committed part is done', () => {
    expect(advancesWatermark('partial')).toBe(false)
    expect(advancesWatermark('failed_known')).toBe(false)
  })

  it('enumerates the window states', () => {
    expect(WINDOW_STATES).toContain('skipped_no_delta')
    expect(WINDOW_STATES).toContain('outcome_unknown')
  })
})

describe('silence has more than one cause, and the product says which it cannot tell', () => {
  const now = 1_000_000_000
  const every = 60_000

  it('reads a recent cycle as running on schedule', () => {
    expect(readCycleGap({ lastCycleAt: now - 60_000, now, expectedEveryMs: every }).says).toMatch(/on schedule/)
  })

  it('names BOTH causes of a long silence rather than asserting one', () => {
    // ADR-0037 stands: Fabric has no always-on process, and saying that by
    // omission reads as a promise the product does not keep. What this case
    // used to assert is the OVERCORRECTION — "this means the app was closed" —
    // and the repository's own code disproves it thirty lines away: `index.ts`
    // logs `cycle.receipt` with the note "the pass ran but left no receipt; a
    // reader will see a gap". A pass that ran and could not record itself
    // produces exactly this silence, so the reader was handed a certainty
    // nobody could support (AX-08).
    const got = readCycleGap({ lastCycleAt: now - 3_600_000, now, expectedEveryMs: every })
    expect(got.says).toMatch(/no always-on process/i)
    expect(got.says, 'the second cause must be named, not implied').toMatch(/could not record itself/i)
    expect(got.says).toMatch(/does not mean\s+nothing needed doing/i)
    // And the absence is marked UNEXPLAINED, so a surface can show it as an
    // open question rather than as a diagnosis.
    expect(got.explained).toBe(false)
  })

  it('but a healthy cycle and a never-run estate are both explained', () => {
    // The other direction: `explained` must not be universally false, or it
    // says nothing at all.
    expect(readCycleGap({ lastCycleAt: now - 60_000, now, expectedEveryMs: every }).explained).toBe(true)
    expect(readCycleGap({ lastCycleAt: null, now, expectedEveryMs: every }).explained).toBe(true)
  })

  it('separates "never ran" from "has not run lately"', () => {
    const got = readCycleGap({ lastCycleAt: null, now, expectedEveryMs: every })
    expect(got.neverRan).toBe(true)
    expect(got.silentForMs).toBe(0)
  })

  it('tolerates one missed poll without crying wolf', () => {
    expect(readCycleGap({ lastCycleAt: now - 90_000, now, expectedEveryMs: every }).says).toMatch(/on schedule/)
  })
})

describe('a pass gets ONE state, and it is the pessimistic one', () => {
  // MEASURED at `4263727`: the outer cycle initialised `state` to `completed`
  // and left it only by throwing. `tick()` returned void, so the `partial`
  // `planCycle` had already computed could not reach the receipt, and a refused
  // routines read early-returned in silence — producing a row that said the
  // pass completed. `advancesWatermark('completed')` is true, so the estate
  // then stepped over a window in which nothing had been read.
  it('lets one unaccounted step decide the whole pass', () => {
    expect(worstOf(['completed', 'outcome_unknown'])).toBe('outcome_unknown')
    expect(worstOf(['completed', 'partial'])).toBe('partial')
    expect(worstOf(['skipped_no_delta', 'failed_known'])).toBe('failed_known')
  })

  it('ranks "nobody knows" above "it failed", because only one of them was seen', () => {
    // A failure that was observed is accounted for. One nobody can account for
    // is the thing the watermark must never step over — the vocabulary says so
    // in its own header, and this is that sentence made executable.
    expect(worstOf(['failed_known', 'outcome_unknown'])).toBe('outcome_unknown')
  })

  it('and a pass of only good steps keeps the good state', () => {
    // The other direction, so the rule is not "always report the worst word in
    // the vocabulary" — which would make every receipt useless in the same way
    // the old default did, only pessimistically.
    expect(worstOf(['completed', 'completed'])).toBe('completed')
    expect(worstOf(['skipped_no_delta'])).toBe('skipped_no_delta')
    expect(worstOf(['completed', 'skipped_no_delta'])).toBe('completed')
  })

  it('and an empty pass is "nothing to do" rather than a guess', () => {
    expect(worstOf([])).toBe('skipped_no_delta')
  })

  it('and every state it can return answers the watermark question', () => {
    // The join between the two functions, asserted rather than assumed: a state
    // `worstOf` can produce and `advancesWatermark` has no opinion about would
    // be a window nobody can classify.
    for (const state of WINDOW_STATES) expect(typeof advancesWatermark(state)).toBe('boolean')
    // And the two that advance are the two that mean the work is accounted for.
    const advancing = WINDOW_STATES.filter((s) => advancesWatermark(s))
    expect([...advancing].sort()).toEqual(['completed', 'skipped_no_delta'])
  })
})
