import { afterEach, describe, expect, it, vi } from 'vitest'
import { heldFor, knownTime, since, untimed, until } from './duration'

afterEach(() => { vi.useRealTimers() })
const at = (secondsAgo: number) => new Date(Date.parse('2026-09-29T12:00:00Z') - secondsAgo * 1000).toISOString()

describe('how long ago, in the shortest true unit', () => {
  it('a time that does not parse is unknown, never NaN (0.3.6 review i3 ER-6)', () => {
    expect(since('not a time')).toBe('—')
    expect(since('')).toBe('—')
  })
  it('counts seconds, minutes, hours, and days from two days on', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T12:00:00Z'))
    expect(since(at(30))).toBe('30s')
    expect(since(at(600))).toBe('10m')
    expect(since(at(47 * 3600))).toBe('47h')
    expect(since(at(59 * 3600)), '"59h" is arithmetic, not an age').toBe('2d')
    expect(until(new Date(Date.parse('2026-09-29T12:00:00Z') + 3 * 86_400_000).toISOString())).toBe('3d')
  })

  it("speaks the reader's language when given a translator", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T12:00:00Z'))
    const t = ((key: string, vars: { n: number }) => `${vars.n} ${key}`) as never
    expect(since(at(3 * 86_400), t)).toBe('3 duration.d')
  })
})

describe('how long a task has been held (the mockup parity, home gap D9)', () => {
  const NOW = Date.parse('2026-09-29T12:00:00Z')
  it('says hours and minutes under two days, as the mockup does, and whole days after', () => {
    expect(heldFor(at(104 * 60), undefined, NOW)).toBe('1h 44m')
    expect(heldFor(at(38 * 60), undefined, NOW)).toBe('38m')
    expect(heldFor(at(2 * 3600), undefined, NOW)).toBe('2h')
    expect(heldFor(at(20), undefined, NOW)).toBe('20s')
    // UX-10: an unreadable time says nothing, never a dash.
    expect(heldFor('not a date', undefined, NOW)).toBeNull()
    expect(heldFor(at(3 * 86_400), undefined, NOW)).toBe('3d')
    expect(heldFor('nope', undefined, NOW)).toBeNull()
  })
})

describe('knownTime and untimed (the 0.3.15 review, iteration 2, UX-16)', () => {
  it('tells a time that parses, and closes up a sentence whose time is left out', () => {
    expect(knownTime('2026-10-27T10:00:00Z')).toBe(true)
    expect(knownTime('nope')).toBe(false)
    expect(knownTime(null)).toBe(false)
    expect(untimed('сдал ')).toBe('сдал')
    expect(untimed('закончилась , как именно, не записано')).toBe('закончилась, как именно, не записано')
  })
})
