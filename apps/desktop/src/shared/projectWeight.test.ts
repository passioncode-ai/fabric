import { describe, expect, it } from 'vitest'
import {
  projectWeight,
  TIER_WEIGHT,
  PRESSURE_CAP,
  ceoTrustFor,
  type ProjectSignals
} from './projectWeight.ts'

const sig = (over: Partial<ProjectSignals> = {}): ProjectSignals => ({
  tier: 'active',
  blockedTasks: 0,
  daysSinceOldestOpenQuestion: 0,
  goalDueWithinWeek: false,
  ranInLast24h: false,
  ...over
})

describe('project weight — declared tier plus measured pressure', () => {
  it('a project with no pressure weighs exactly its tier', () => {
    expect(projectWeight(sig({ tier: 'active' })).weight).toBe(TIER_WEIGHT.active)
    expect(projectWeight(sig({ tier: 'paused' })).weight).toBe(0)
  })

  it('pressure raises the weight, and its components are shown', () => {
    const w = projectWeight(sig({ tier: 'steady', blockedTasks: 2, goalDueWithinWeek: true }))
    expect(w.weight).toBeGreaterThan(TIER_WEIGHT.steady)
    // The components travel with it, so an order can be explained not trusted.
    expect(w.components.tier).toBe(TIER_WEIGHT.steady)
    expect(w.components.pressure).toBeGreaterThan(0)
  })

  it('pressure can lift a steady project above an IDLE active one', () => {
    // The whole point: attention follows evidence.
    const busySteady = projectWeight(sig({ tier: 'steady', blockedTasks: 3, goalDueWithinWeek: true, ranInLast24h: true }))
    const idleActive = projectWeight(sig({ tier: 'active' }))
    expect(busySteady.weight).toBeGreaterThan(idleActive.weight)
  })

  it('and can NEVER lift it above a critical project — the cap is the guarantee', () => {
    // A steady project at maximum pressure must stay below the lowest a critical
    // project can be. Otherwise a hobby blocker outranks the paying project,
    // which is the thing a declared tier exists to prevent.
    const maxedSteady = projectWeight(sig({
      tier: 'steady', blockedTasks: 999, daysSinceOldestOpenQuestion: 999,
      goalDueWithinWeek: true, ranInLast24h: true
    }))
    const barestCritical = projectWeight(sig({ tier: 'critical' }))
    expect(maxedSteady.weight).toBeLessThan(barestCritical.weight)
  })

  it('pressure is capped, and the cap is reported so a maxed project is legible', () => {
    const maxed = projectWeight(sig({
      tier: 'active', blockedTasks: 999, daysSinceOldestOpenQuestion: 999,
      goalDueWithinWeek: true, ranInLast24h: true
    }))
    expect(maxed.components.pressure).toBe(PRESSURE_CAP)
  })

  it('the system never mutates the tier — it only measures beside it', () => {
    // ADR-0002: declared and observed data are kept apart. `projectWeight`
    // takes the tier as given and returns a weight; it has no way to change the
    // tier, and that is the point rather than an omission.
    const w = projectWeight(sig({ tier: 'steady', blockedTasks: 5 }))
    expect(w.tier).toBe('steady') // unchanged, echoed for the caller
  })
})

describe('CEO trust — inheritance with a ceiling (ADR-0004 shape)', () => {
  it('a project with no override inherits the estate', () => {
    expect(ceoTrustFor('routine', null)).toBe('routine')
  })

  it('a project may lower the trust below the estate', () => {
    expect(ceoTrustFor('routine', 'cited')).toBe('cited')
  })

  it('a project may NEVER exceed the estate — the override is clamped, not obeyed', () => {
    // A sub-goal may never exceed its parent's autonomy; the same rule, so
    // raising trust everywhere is one deliberate act, not four quiet ones.
    expect(ceoTrustFor('cited', 'proposing')).toBe('cited')
  })

  it('an unknown level is treated as the most restrictive, never the most trusting', () => {
    expect(ceoTrustFor('ask', 'nonsense' as never)).toBe('ask')
  })
})
