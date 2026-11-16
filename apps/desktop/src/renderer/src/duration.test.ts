import { afterEach, describe, expect, it, vi } from 'vitest'
import { appLocale, heldFor, knownTime, since, untimed, until, whenSaid } from './duration'

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

describe('when something was said, one rule for every screen (W6, ui UI-21)', () => {
  const NOW = Date.parse('2026-11-15T12:00:00Z')
  const t = ((key: string, vars: { time?: string; n?: number }) => (key === 'board.ago' ? `${vars.time} ago` : `${vars.n}${key.slice(-1)}`)) as never
  it('says how long ago within a day, a short date after it, the year only when it is not this year', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(NOW))
    expect(whenSaid(new Date(NOW - 2 * 3600_000).toISOString(), 'en-GB', t, NOW)?.said).toBe('2h ago')
    expect(whenSaid('2026-11-01T09:00:00Z', 'en-GB', t, NOW)?.said).toBe('1 Nov')
    expect(whenSaid('2025-11-01T09:00:00Z', 'en-GB', t, NOW)?.said).toBe('1 Nov 2025')
    expect(whenSaid('2026-11-01T09:00:00Z', 'en-GB', t, NOW)?.exact).toMatch(/2026/)
  })
  it('a time that does not parse says nothing, never a dash', () => {
    expect(whenSaid('not a time', 'en-GB', t, NOW)).toBeNull()
  })
})

describe('the interface language for a formatter outside a component (W6)', () => {
  it('is the html lang the settings set, and nothing before they are read', () => {
    document.documentElement.lang = 'ru'
    expect(appLocale()).toBe('ru')
    expect(new Date('2026-11-15T09:00:00Z').toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', timeZone: 'UTC' })).toBe('15 ноября')
    document.documentElement.lang = ''
    expect(appLocale()).toBeUndefined()
  })
})
