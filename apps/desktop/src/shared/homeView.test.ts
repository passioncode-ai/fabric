import { describe, expect, it } from 'vitest'
import { eventKind, eventsOfDay, FEED_WINDOW, liveIsFresh, liveRows, resumePoint, rhythmDays, rhythmTotals } from './homeView.ts'

type E = { seq: number; type: string; actor: { kind: string; id: string }; project_id: string | null; occurred_at: string }
const ev = (seq: number, at: string, type = 'task.created@1', project: string | null = 'p1', actor = { kind: 'person', id: 'op' }): E =>
  ({ seq, type, actor, project_id: project, occurred_at: at })
const NOW = new Date('2026-09-29T12:00:00')

describe('the rhythm of work, 28 days', () => {
  it('counts the events of each local day, oldest first, ending today', () => {
    const days = rhythmDays([ev(1, '2026-09-28T10:00:00'), ev(2, '2026-09-29T09:00:00'), ev(3, '2026-09-29T10:00:00')], NOW)
    expect(days).toHaveLength(28)
    expect(days[27]).toMatchObject({ date: '2026-09-29', count: 2, known: true })
    expect(days[26]).toMatchObject({ date: '2026-09-28', count: 1, known: true })
    expect(days[0]).toMatchObject({ date: '2026-09-02', count: 0, known: true })
  })

  it('with the whole history on screen, a quiet day is a measured zero', () => {
    expect(rhythmDays([ev(1, '2026-09-29T09:00:00')], NOW).every((d) => d.known)).toBe(true)
  })

  it('at the display window, a day before the oldest event held is UNKNOWN, and so is the oldest day itself', () => {
    // The feed keeps the newest FEED_WINDOW events. When it is full, older days
    // may have had events it no longer holds — a zero there would be invented.
    const events = Array.from({ length: FEED_WINDOW }, (_, i) => ev(i + 1, i === 0 ? '2026-09-20T10:00:00' : '2026-09-25T10:00:00'))
    const days = rhythmDays(events, NOW)
    const at = (d: string) => days.find((x) => x.date === d)!
    expect(at('2026-09-19').known).toBe(false)
    expect(at('2026-09-20').known, 'partly cut off').toBe(false)
    expect(at('2026-09-21')).toMatchObject({ known: true, count: 0 })
    expect(at('2026-09-25')).toMatchObject({ known: true, count: FEED_WINDOW - 1 })
  })

  it('unread history says nothing about any day', () => {
    expect(rhythmDays(null, NOW).every((d) => !d.known)).toBe(true)
  })

  it('totals only what it can name: decisions and results', () => {
    const events = [ev(1, '2026-09-29T09:00:00', 'question.answered@1'), ev(2, '2026-09-29T09:00:00', 'proposal.decided@1'),
      ev(3, '2026-09-29T09:00:00', 'task.finished@1'), ev(4, '2026-09-29T09:00:00', 'task.created@1'), ev(5, '2026-08-01T09:00:00', 'task.finished@1')]
    expect(rhythmTotals(events, NOW)).toEqual({ decisions: 2, results: 1, events: 4 })
    const done = { ...ev(6, '2026-09-29T09:30:00', 'task.moved@1'), payload: { to: 'done' } }
    const running = { ...ev(7, '2026-09-29T09:31:00', 'task.moved@1'), payload: { to: 'running' } }
    expect(rhythmTotals([done, running], NOW).results, 'a move to done is a result; any other move is not').toBe(1)
  })
})

describe('where you left off', () => {
  it('is the project of the newest event that names one', () => {
    const r = resumePoint([ev(1, '2026-09-28T10:00:00', 'task.created@1', 'p1'), ev(2, '2026-09-29T09:00:00', 'task.finished@1', 'p2'), ev(3, '2026-09-29T10:00:00', 'ceo.message.accepted@1', null)], 1)
    expect(r).toMatchObject({ projectId: 'p2', type: 'task.finished@1', unread: 1 })
  })

  it('counts only that project\'s events past the read position', () => {
    const r = resumePoint([ev(5, '2026-09-28T10:00:00', 'a@1', 'p1'), ev(6, '2026-09-29T09:00:00', 'b@1', 'p1'), ev(7, '2026-09-29T09:00:00', 'c@1', 'p2'), ev(8, '2026-09-29T10:00:00', 'd@1', 'p1')], 5)
    expect(r).toMatchObject({ projectId: 'p1', unread: 2 })
  })

  it('is null when nothing has happened in any project, or nothing was read', () => {
    expect(resumePoint([ev(1, '2026-09-29T09:00:00', 'x@1', null)], 0)).toBeNull()
    expect(resumePoint(null, 0)).toBeNull()
  })
})

describe('live: what the agents did', () => {
  it('lists agent events only, newest first, up to the limit', () => {
    const agent = { kind: 'agent', id: 's1' }
    const rows = liveRows([ev(1, '2026-09-29T09:00:00', 'work.claimed@1', 'p1', agent), ev(2, '2026-09-29T09:05:00', 'task.created@1'),
      ev(3, '2026-09-29T09:10:00', 'task.finished@1', 'p1', agent)], 5)
    expect(rows!.map((r) => r.seq)).toEqual([3, 1])
    expect(rows![0]).toMatchObject({ sessionId: 's1', projectId: 'p1' })
    expect(liveRows(null, 5)).toBeNull()
  })
})

describe('the live indicator', () => {
  const row = (at: string) => ({ seq: 1, type: 'x@1', sessionId: 's', projectId: null, occurredAt: at })
  it('is live only while the newest agent action is under ten minutes old', () => {
    expect(liveIsFresh([row('2026-09-29T11:55:00')], NOW)).toBe(true)
    expect(liveIsFresh([row('2026-09-29T11:49:00')], NOW)).toBe(false)
    expect(liveIsFresh([], NOW)).toBe(false)
    expect(liveIsFresh(null, NOW)).toBe(false)
  })
})

describe('a day of the rhythm, read closer (SCR-42)', () => {
  const done = { ...ev(3, '2026-09-29T10:00:00', 'task.moved@1'), payload: { to: 'done' } }
  const events = [ev(1, '2026-09-29T09:00:00', 'question.answered@1'), ev(2, '2026-09-29T09:30:00', 'task.created@1'), done, ev(4, '2026-09-28T09:00:00', 'proposal.decided@1')]
  it('names each event as a decision, a result or neither', () => {
    expect(events.map(eventKind)).toEqual(['decision', 'other', 'result', 'decision'])
  })
  it('lists one local day, newest first, and filters by kind', () => {
    expect(eventsOfDay(events, '2026-09-29').map((e) => e.seq)).toEqual([3, 2, 1])
    expect(eventsOfDay(events, '2026-09-29', 'decision').map((e) => e.seq)).toEqual([1])
    expect(eventsOfDay(events, '2026-09-29', 'result').map((e) => e.seq)).toEqual([3])
    expect(eventsOfDay(null, '2026-09-29')).toEqual([])
  })
})
