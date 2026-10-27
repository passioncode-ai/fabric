import { describe, expect, it } from 'vitest'
import { composeRhythm, handedInTask, isPersonDecision, localDateKey, MACHINE_TICKS, rhythmWindow, type RhythmEvent } from './workRhythm'

const now = new Date(2026, 9, 27, 15, 0).getTime()
const at = (day: number, hour = 10): string => new Date(2026, 9, day, hour).toISOString()
const ev = (type: string, occurredAt: string, payload: Record<string, unknown> = {}, actor = 'agent'): RhythmEvent => ({ type, occurred_at: occurredAt, actor: { kind: actor, id: 'x' }, payload })

describe('rhythmWindow', () => {
  it('28 local days, oldest first, ending today, each from its midnight to the next', () => {
    const w = rhythmWindow(now)
    expect(w).toHaveLength(28)
    expect(w.at(-1)!.date).toBe(localDateKey(now))
    expect(w[0].date).toBe(localDateKey(new Date(2026, 8, 30).getTime()))
    for (const d of w) expect(new Date(d.from).getHours()).toBe(0)
    for (let i = 1; i < w.length; i++) expect(w[i].from).toBe(w[i - 1].to)
  })
})

describe('the one definition of results and decisions (home gap D2)', () => {
  it('a result is a task moved to review or closed as done; a move to done or running is not', () => {
    expect(handedInTask(ev('task.moved@1', at(27), { task_id: 't1', to: 'review' }))).toBe('t1')
    expect(handedInTask(ev('task.closed@1', at(27), { id: 't2', outcome: 'done' }))).toBe('t2')
    expect(handedInTask(ev('task.moved@1', at(27), { task_id: 't3', to: 'running' }))).toBeNull()
    expect(handedInTask(ev('task.closed@1', at(27), { id: 't4', outcome: 'cancelled' }))).toBeNull()
  })
  it("a decision is the person's: access allowed by the standing rule for an agent is not one", () => {
    expect(isPersonDecision(ev('access.decided@1', at(27), {}, 'person'))).toBe(true)
    expect(isPersonDecision(ev('question.answered@1', at(27), {}, 'person'))).toBe(true)
    expect(isPersonDecision(ev('access.decided@1', at(27), {}, 'agent'))).toBe(false)
    expect(isPersonDecision(ev('task.created@1', at(27), {}, 'person'))).toBe(false)
  })
  it('machine ticks are named, so the read can leave them out', () => {
    expect(MACHINE_TICKS).toEqual(expect.arrayContaining(['cycle.ran@1', 'work.swept@1']))
  })
})

describe('composeRhythm (home gap D1)', () => {
  it('a read day with no work is zero, a day not read is unknown, never zero', () => {
    const counts = new Map<string, number | null>([[localDateKey(now), 12], [localDateKey(new Date(2026, 9, 26).getTime()), 0], [localDateKey(new Date(2026, 9, 25).getTime()), null]])
    const r = composeRhythm({ now, counts, marks: [] })
    expect(r.days.at(-1)).toMatchObject({ events: 12, today: true, results: 0, decisions: 0 })
    expect(r.days.at(-2)!.events).toBe(0)
    expect(r.days.at(-3)!.events).toBeNull()
    expect(r.days.at(-4)!.events).toBeNull()
    expect(r.totals.events).toBe(12)
  })
  it('counts each task handed in once a day and the person\'s decisions; the totals and today agree with the days', () => {
    const marks = [
      ev('task.moved@1', at(27, 11), { task_id: 't1', to: 'review' }),
      ev('task.moved@1', at(27, 12), { task_id: 't1', to: 'review' }),
      ev('task.closed@1', at(26, 9), { id: 't2', outcome: 'done' }),
      ev('access.decided@1', at(27, 9), {}, 'person'),
      ev('access.decided@1', at(27, 9), {}, 'agent'),
      ev('question.answered@1', at(20, 9), {}, 'person')
    ]
    const r = composeRhythm({ now, counts: new Map(), marks })
    expect(r.today).toMatchObject({ results: 1, decisions: 1 })
    expect(r.totals).toMatchObject({ results: 2, decisions: 2 })
  })
  it('a capped marks read leaves the days before its oldest event unknown, not zero', () => {
    const marks = [ev('task.moved@1', at(26, 9), { task_id: 't1', to: 'review' })]
    const r = composeRhythm({ now, counts: new Map(), marks, marksCapped: true })
    expect(r.days.at(-1)!.results).toBe(0)
    expect(r.days.at(-2)!.results).toBeNull()
    expect(r.days[0].results).toBeNull()
    expect(r.marksCapped).toBe(true)
  })
  it('marks that could not be read are unknown everywhere', () => {
    const r = composeRhythm({ now, counts: new Map(), marks: null, unread: ['away'] })
    expect(r.days.every((d) => d.results === null && d.decisions === null)).toBe(true)
    expect(r.totals.results).toBeNull()
    expect(r.unread).toEqual(['away'])
  })
})
