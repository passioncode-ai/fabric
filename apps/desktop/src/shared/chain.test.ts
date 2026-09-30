import { describe, expect, it } from 'vitest'
import { fillBrief, mayStartStep, type ChainStep } from './chain.ts'

const step: ChainStep = { taskId: 'b', needs: ['report'] }

describe('whether the next step runs', () => {
  it('runs when the one before it finished and handed over what it needs', () => {
    const v = mayStartStep(step, 'done', { report: 'three bugs, one blocked' })
    expect(v).toEqual({ start: true, values: { report: 'three bugs, one blocked' } })
  })

  it('starts NOTHING after a cancelled predecessor', () => {
    // `done` and `cancelled` are different outcomes and only one means the work
    // happened. A chain that runs on either does the second half of work the
    // operator stopped.
    const v = mayStartStep(step, 'cancelled', { report: 'x' })
    expect(v.start).toBe(false)
    if (!v.start) expect(v.why).toContain('cancelled')
  })

  it('starts nothing after an abandoned one either', () => {
    expect(mayStartStep(step, 'abandoned', { report: 'x' }).start).toBe(false)
  })

  it('REFUSES when a named input is missing, and says which', () => {
    // The rule that decides whether this is worth having. Started anyway, B's
    // brief reads "review the report:" with nothing after it, and an agent will
    // either invent the report or review the emptiness.
    const v = mayStartStep({ taskId: 'b', needs: ['report', 'log'] }, 'done', { report: 'x' })
    expect(v.start).toBe(false)
    if (v.start) return
    expect(v.missing).toEqual(['log'])
    expect(v.why).toContain('log')
  })

  it('treats a name present with an EMPTY value as missing', () => {
    // Handing over nothing under the right name is the shape a well-meaning
    // agent produces, and it passes any check that only asks whether the key is
    // there.
    for (const empty of ['', '   ', undefined, null])
      expect(mayStartStep(step, 'done', { report: empty }).start).toBe(false)
  })

  it('needs nothing when it declared nothing', () => {
    expect(mayStartStep({ taskId: 'b', needs: [] }, 'done', {})).toEqual({ start: true, values: {} })
  })
})

describe('filling the brief', () => {
  it('substitutes the names the step declared', () => {
    expect(fillBrief('Read {report} and say what to do.', { report: 'the audit' })).toBe(
      'Read the audit and say what to do.'
    )
  })

  it('LEAVES a name the step did not declare alone, rather than blanking it', () => {
    // Far likelier to be prose the operator wrote than a slot nobody filled, and
    // blanking it edits their words.
    expect(fillBrief('Use {report} and mind the {gap}.', { report: 'x' })).toBe(
      'Use x and mind the {gap}.'
    )
  })

  it('substitutes every occurrence, not only the first', () => {
    expect(fillBrief('{a} then {a}', { a: 'go' })).toBe('go then go')
  })
})
