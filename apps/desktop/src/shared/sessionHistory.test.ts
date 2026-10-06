import { describe, expect, it } from 'vitest'
import { latestInOrder, mayHaveEarlier, readSessionHistory, SESSION_HISTORY_WINDOW, shownHistory } from './sessionHistory.ts'

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

  it('earlier events exist only when the reading holds one beyond the window; exactly a window is all there is', () => {
    expect(mayHaveEarlier(rows(SESSION_HISTORY_WINDOW + 1))).toBe(true)
    expect(mayHaveEarlier(rows(SESSION_HISTORY_WINDOW))).toBe(false)
    expect(shownHistory(rows(SESSION_HISTORY_WINDOW + 1))).toHaveLength(SESSION_HISTORY_WINDOW)
  })
})

describe('the history read itself (0.3.2 verification DA-5, UX-11)', () => {
  const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
  /** A query builder that really orders and limits, over 450 events of one session. */
  function table(fail: string | null = null) {
    const calls: string[] = []
    const all = Array.from({ length: 450 }, (_, i) => ({ seq: i + 1 }))
    let ascending = true
    const q = {
      eq(c: string, v: string) { calls.push(`eq ${c}=${v}`); return q },
      or(f: string) { calls.push(`or ${f}`); return q },
      order(_c: string, o: { ascending: boolean }) { ascending = o.ascending; return q },
      limit(n: number) {
        const sorted = [...all].sort((a, b) => (ascending ? a.seq - b.seq : b.seq - a.seq)).slice(0, n)
        return Promise.resolve(fail ? { data: null, error: { message: fail } } : { data: sorted, error: null })
      }
    }
    return { select: () => q, calls }
  }

  it('returns the newest 200 events of the session, oldest of them first', async () => {
    const t = table()
    const read = await readSessionHistory(t.select, 'estate-1', ID)
    expect(read).toHaveLength(201)
    expect(mayHaveEarlier(read)).toBe(true)
    const shown = shownHistory(read)
    expect(shown).toHaveLength(200)
    expect(shown[0].seq).toBe(251)
    expect(shown.at(-1)!.seq).toBe(450)
    expect(t.calls).toEqual(['eq estate_id=estate-1', `or payload->>session_id.eq.${ID},payload->>owner.eq.${ID}`])
  })

  it('refuses anything but a session id before it builds a filter', async () => {
    const t = table()
    for (const bad of ['x,payload->>owner.neq.0', '', 42, null])
      await expect(readSessionHistory(t.select, 'estate-1', bad)).rejects.toThrow('Invalid session identity')
    expect(t.calls).toEqual([])
  })

  it('a failed read throws instead of showing an empty history', async () => {
    await expect(readSessionHistory(table('permission denied').select, 'estate-1', ID)).rejects.toThrow('the session history could not be read: permission denied')
  })
})
