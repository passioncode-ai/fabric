import { afterEach, describe, expect, it, vi } from 'vitest'
import { since, until } from './duration'

afterEach(() => { vi.useRealTimers() })
const at = (secondsAgo: number) => new Date(Date.parse('2026-09-29T12:00:00Z') - secondsAgo * 1000).toISOString()

describe('how long ago, in the shortest true unit', () => {
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
