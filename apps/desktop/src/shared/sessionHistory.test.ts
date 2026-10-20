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

describe('the history read itself (0.3.2 verification DA-5, UX-11; 0.3.7 review DA-6)', () => {
  const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
  type Ev = { seq: number; payload: Record<string, string>; actor: { id: string } }
  /** A journal of 450 events naming the session in three ways, and a query builder that really filters by one key,
   *  orders and limits. It has no `or`: the read must not filter by OR, which no index can serve in seq order (DA-6). */
  function table(fail: string | null = null) {
    const calls: string[][] = []
    const all: Ev[] = Array.from({ length: 450 }, (_, i) => {
      const seq = i + 1
      const by = seq % 3
      return {
        seq,
        payload: (by === 0 ? { session_id: ID } : by === 1 ? { owner: ID } : { other: 'x' }) as Record<string, string>,
        actor: { id: by === 2 ? ID : 'operator' }
      }
    })
    // Two events that name the session twice (as payload and as actor) must be read once.
    all[9].actor.id = ID
    all[20].actor.id = ID
    const value = (e: Ev, c: string): string | undefined =>
      c === 'estate_id' ? 'estate-1' : c === 'actor->>id' ? e.actor.id : c.startsWith('payload->>') ? e.payload[c.slice(10)] : undefined
    function select() {
      const mine: string[] = []
      calls.push(mine)
      const filters: [string, string][] = []
      let ascending = true
      const q = {
        eq(c: string, v: string) { mine.push(`eq ${c}=${v}`); filters.push([c, v]); return q },
        order(_c: string, o: { ascending: boolean }) { ascending = o.ascending; return q },
        limit(n: number) {
          const sorted = all.filter((e) => filters.every(([c, v]) => value(e, c) === v))
            .sort((a, b) => (ascending ? a.seq - b.seq : b.seq - a.seq)).slice(0, n)
          return Promise.resolve(fail ? { data: null, error: { message: fail } } : { data: sorted, error: null })
        }
      }
      return q
    }
    return { select, calls }
  }

  it('returns the newest 200 events of the session, oldest of them first, each once', async () => {
    const t = table()
    const read = await readSessionHistory(t.select, 'estate-1', ID)
    expect(read).toHaveLength(201)
    expect(new Set(read.map((r) => r.seq)).size).toBe(201)
    expect(mayHaveEarlier(read)).toBe(true)
    const shown = shownHistory(read)
    expect(shown).toHaveLength(200)
    expect(shown[0].seq).toBe(251)
    expect(shown.at(-1)!.seq).toBe(450)
  })

  it('reads by each key on its own, so an index serves each read in seq order (DA-6)', async () => {
    const t = table()
    await readSessionHistory(t.select, 'estate-1', ID)
    // OF-09: what the agent itself wrote (a task moved, a decision recorded) names the session as its actor, not in its payload.
    expect(t.calls).toEqual([
      ['eq estate_id=estate-1', `eq payload->>session_id=${ID}`],
      ['eq estate_id=estate-1', `eq payload->>owner=${ID}`],
      ['eq estate_id=estate-1', `eq actor->>id=${ID}`]
    ])
  })

  it('an event the session wrote as its actor is in its history', async () => {
    const read = await readSessionHistory(table().select, 'estate-1', ID)
    expect(read.map((r) => r.seq)).toContain(449)
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
