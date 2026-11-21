import { describe, expect, it } from 'vitest'
import { bannerAfter, bannerWhenBack, humaniseError, outageFailure } from './errorText.ts'

describe('what a failure looks like to the operator', () => {
  it('strips the transport wrapper Electron adds', () => {
    // The exact shape the row complains about. `Error invoking remote method`
    // names a mechanism the operator has no relationship with, and it is the
    // FIRST thing they read.
    const m = humaniseError(
      "Error: Error invoking remote method 'memory:search': Error: the query was empty"
    )
    expect(m.detail).toBe('the query was empty')
    expect(m.detail).not.toContain('remote method')
  })

  it('strips a stack of Error: prefixes, not just one', () => {
    expect(humaniseError('Error: Error: Error: it broke').detail).toBe('it broke')
  })

  it('names a session that would not start, and keeps which program and where', () => {
    // Measured against the real database: this exact text is what lands in
    // `abandoned_reason` today. The column DOES receive it — the row said it
    // did not, and driving the path proved otherwise. What is wrong is the
    // WORDS, which is this defect, not that one.
    const m = humaniseError('Error: claude could not start in /w/repo: spawn claude ENOENT')
    expect(m.kind).toBe('session-would-not-start')
    expect(m.detail).toContain('claude')
    expect(m.detail).toContain('/w/repo')
  })

  it('reuses the startup classifier rather than keeping a second copy of its patterns', () => {
    // Two copies of a rule is how a rule stops being one, and the copy that
    // drifts is always the one nobody is looking at. A cause added there is
    // named here without touching this file.
    expect(humaniseError('estates read failed: TypeError: fetch failed').kind).toBe(
      'database-unreachable'
    )
    expect(
      humaniseError("Could not find the table 'public.goals' in the schema cache").kind
    ).toBe('schema-missing')
  })

  it('an ordinary refusal keeps its own words and claims no kind', () => {
    const m = humaniseError('Error: a task needs an instruction')
    expect(m.kind).toBeNull()
    expect(m.detail).toBe('a task needs an instruction')
  })

  it('survives anything that can be thrown', () => {
    expect(humaniseError(null).detail.length).toBeGreaterThan(0)
    expect(humaniseError(undefined).detail.length).toBeGreaterThan(0)
    expect(humaniseError({ message: 'from an object' }).detail).toBe('from an object')
    expect(humaniseError('   ').detail.length).toBeGreaterThan(0)
  })

  it('never hides the machine’s words behind our sentence', () => {
    // A named cause without its evidence is undiagnosable the first time the
    // cause is named wrongly — the same rule the startup dialog follows.
    const m = humaniseError('estates read failed: TypeError: fetch failed')
    expect(m.detail).toContain('fetch failed')
  })

  it('does not let one enormous line become the whole screen', () => {
    expect(humaniseError('Error: ' + 'x'.repeat(5000)).detail.length).toBeLessThan(600)
  })
})

// 2026-11-20, the operator's screen: «journal replay failed: TypeError: fetch failed» became a red banner saying the stack
// «is most likely stopped», beside the watch's notice that knew Fabric had stopped it for the disk; it stayed after the
// stack came back.
describe('the banner during and after a stack outage', () => {
  const replay = "Error: Error invoking remote method 'feed:replay': Error: journal replay failed: TypeError: fetch failed"
  it('tells the outage from a refusal the database gave', () => {
    expect(outageFailure(replay)).toBe(true)
    expect(outageFailure(Object.assign(new TypeError('fetch failed'), { cause: new Error('connect ECONNREFUSED 127.0.0.1:54321') }))).toBe(true)
    expect(outageFailure({ message: 'stack-unavailable: the database is not answering' })).toBe(true)
    expect(outageFailure(new Error('permission denied for table tasks'))).toBe(false)
    expect(outageFailure(null)).toBe(false)
  })
  it('keeps an outage failure out of the banner while the watch says the stack is lost', () => {
    expect(bannerAfter(null, replay, true)).toBeNull()
    expect(bannerAfter('the draft was not saved: disk', replay, true)).toBe('the draft was not saved: disk')
    // Any other failure still reaches the person, and so does the outage's when the watch has not said it.
    expect(bannerAfter(null, 'the draft was not saved: disk', true)).toBe('the draft was not saved: disk')
    expect(bannerAfter(null, replay, false)).toBe(replay)
    expect(bannerAfter(replay, null, true)).toBeNull()
  })
  it('takes the outage banner away once the database answers, and nothing else', () => {
    expect(bannerWhenBack(replay)).toBeNull()
    expect(bannerWhenBack('the draft was not saved: disk')).toBe('the draft was not saved: disk')
    expect(bannerWhenBack(null)).toBeNull()
  })
})
