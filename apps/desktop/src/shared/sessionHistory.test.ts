import { describe, expect, it } from 'vitest'
import { latestInOrder, mayHaveEarlier, SESSION_HISTORY_WINDOW } from './sessionHistory.ts'

describe('a session history shows its newest events, in order (audit A5-001)', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ seq: n - i })) // newest first, as read

  it('keeps the newest window, oldest of them first', () => {
    const shown = latestInOrder(rows(450))
    expect(shown).toHaveLength(SESSION_HISTORY_WINDOW)
    expect(shown[0].seq).toBe(251)
    expect(shown.at(-1)!.seq).toBe(450)
  })

  it('a short history is shown whole, in order', () => {
    expect(latestInOrder(rows(3)).map((r) => r.seq)).toEqual([1, 2, 3])
  })

  it('a full window says earlier events may exist; a short one does not', () => {
    expect(mayHaveEarlier(rows(SESSION_HISTORY_WINDOW))).toBe(true)
    expect(mayHaveEarlier(rows(SESSION_HISTORY_WINDOW - 1))).toBe(false)
  })
})
