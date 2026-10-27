// The board's waiting requests as a list beside the count (the mockup parity, 2026-10-27, home gap D11).
import { describe, expect, it } from 'vitest'
import { composeWaitingList } from './commsWaitingList'

const sub = (id: string, at: string, to: string, capability = 'question', subject: string | null = null, thread = 'th-' + id) => ({
  occurred_at: at,
  payload: { kind: 'request', message_id: id, thread_id: thread, sender_project_id: 'fab', request: { target_project_id: to, capability }, ...(subject ? { thread_new: { subject } } : {}) }
})
const moved = (id: string, to: string, seq: number) => ({ seq, payload: { request_id: id, to } })

describe('composeWaitingList', () => {
  it('lists the open requests no active responder holds, oldest first, with who asked whom and the subject', () => {
    const r = composeWaitingList({
      count: 2,
      submitted: [sub('r3', '2026-10-27T09:00:00Z', 'dash', 'question', 'Newer'), sub('r1', '2026-10-25T09:00:00Z', 'dash', 'question', 'Old'), sub('r2', '2026-10-26T09:00:00Z', 'site'), sub('r4', '2026-10-26T10:00:00Z', 'obs', 'website.change')],
      submittedCapped: false,
      transitions: [moved('r2', 'claimed', 1), moved('r2', 'answered', 2), moved('r1', 'queued', 3)],
      responders: [{ project: 'obs', capability: 'website.change', state: 'active', generation: 1 }],
      subjects: new Map([['th-r3', 'Newer, from the board']])
    })
    expect(r.list.map((x) => x.requestId)).toEqual(['r1', 'r3'])
    expect(r.list[0]).toMatchObject({ from: 'fab', to: 'dash', subject: 'Old', at: '2026-10-25T09:00:00Z' })
    expect(r.list[1].subject).toBe('Newer, from the board')
    expect(r.listComplete).toBe(true)
  })
  it('more candidates than the count (a capability the project lists) or a capped read: the list is not complete', () => {
    const one = [sub('r1', '2026-10-25T09:00:00Z', 'dash'), sub('r2', '2026-10-25T10:00:00Z', 'dash')]
    expect(composeWaitingList({ count: 1, submitted: one, submittedCapped: false, transitions: [], responders: [], subjects: new Map() }).listComplete).toBe(false)
    expect(composeWaitingList({ count: 2, submitted: one, submittedCapped: true, transitions: [], responders: [], subjects: new Map() }).listComplete).toBe(false)
  })
  it('holds at most ten', () => {
    const many = Array.from({ length: 14 }, (_, i) => sub('r' + String(i).padStart(2, '0'), `2026-10-2${i % 7}T09:00:00Z`, 'dash'))
    expect(composeWaitingList({ count: 14, submitted: many, submittedCapped: false, transitions: [], responders: [], subjects: new Map() }).list).toHaveLength(10)
  })
})
