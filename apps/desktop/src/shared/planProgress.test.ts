import { describe, expect, it } from 'vitest'
import { coverageOfList, drawable, goalProgress } from './planProgress.ts'

describe('a goal has a denominator', () => {
  it('counts done against the whole, not just what is left', () => {
    // The measured defect: PlanSection showed the OPEN count as a bare figure,
    // so a goal with three open and forty done read "3".
    const got = goalProgress({ goalId: 'g', open: 3, closed: 40, closedTruncated: false })
    expect(got.done).toBe(40)
    expect(got.total).toBe(43)
    expect(got.says).toBe('40 of 43 done')
  })

  it('says NOTHING PLANNED rather than zero per cent', () => {
    // A goal with nothing under it has not started badly — nobody has said what
    // it involves, and those two need different next acts.
    const got = goalProgress({ goalId: 'g', open: 0, closed: 0, closedTruncated: false })
    expect(got.kind).toBe('nothing_planned')
    expect(got.says).toMatch(/nothing planned/)
  })

  it('reports completion as completion', () => {
    expect(goalProgress({ goalId: 'g', open: 0, closed: 5, closedTruncated: false }).kind).toBe('complete')
  })
})

describe('a truncated source never becomes a total', () => {
  it('reports a floor, and says both numbers are floors', () => {
    // A count computed from a capped read is a silent removal of rows —
    // arithmetic instead of a missing entry (ADR-0042).
    const got = goalProgress({ goalId: 'g', open: 2, closed: 20, closedTruncated: true })
    expect(got.kind).toBe('at_least')
    expect(got.says).toMatch(/at least 20 of 22/)
    expect(got.says).toMatch(/floors/)
  })

  it('refuses to draw a bar from a floor', () => {
    expect(drawable(goalProgress({ goalId: 'g', open: 2, closed: 20, closedTruncated: true }))).toBe(false)
  })

  it('refuses to draw a bar for a goal with nothing planned', () => {
    expect(drawable(goalProgress({ goalId: 'g', open: 0, closed: 0, closedTruncated: false }))).toBe(false)
  })

  it('draws one for a real fraction', () => {
    expect(drawable(goalProgress({ goalId: 'g', open: 1, closed: 1, closedTruncated: false }))).toBe(true)
  })
})

describe('a list says whether it was cut short', () => {
  it('names both numbers when the total is known', () => {
    expect(coverageOfList({ returned: 20, available: 200, cap: 20 })).toEqual({
      truncated: true,
      says: 'showing 20 of 200'
    })
  })

  it('says ALL when everything fits', () => {
    expect(coverageOfList({ returned: 5, available: 5, cap: 20 }).truncated).toBe(false)
  })

  it('treats a full page with no count as truncated', () => {
    const got = coverageOfList({ returned: 20, available: null, cap: 20 })
    expect(got.truncated).toBe(true)
    expect(got.says).toMatch(/there may be more/)
  })

  it('says UNKNOWN rather than complete when nobody counted', () => {
    // `available === null` is not "nothing was cut". Reporting it as complete
    // is how a capped read becomes a total one screen along.
    const got = coverageOfList({ returned: 3, available: null, cap: 20 })
    expect(got.truncated).toBe('unknown')
    expect(got.says).toMatch(/nobody counted/)
  })
})
