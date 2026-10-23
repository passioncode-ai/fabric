import { describe, expect, it } from 'vitest'
import type { CommsMessage } from './commsRead.ts'
import { announcementsOf, answerTypeOf } from './announcements.ts'

const m = (id: string, project: string, kind: string, text: string, at: string, extra: Record<string, unknown> = {}): CommsMessage =>
  ({ id, thread: 't', kind, sender: { project, principal: null }, at, digest: 'd', body: { text }, ...extra }) as CommsMessage

describe('announcements and who has answered (CO-377)', () => {
  const thread = { id: 't', participants: ['ws', 'fabric', 'contract', 'obs'] }
  const msgs = [
    m('a1', 'ws', 'announcement', 'Announce and answer.', '2026-10-19T15:43:00Z'),
    m('r1', 'contract', 'reply', '**adapted**: in DEC-0098.', '2026-10-19T16:00:00Z', { replyTo: 'a1' }),
    m('n1', 'ws', 'reply', 'Asking once more.', '2026-10-20T15:46:00Z', { replyTo: 'a1' }),
    m('r2', 'obs', 'reply', 'Observatory: adapted.', '2026-10-21T00:32:00Z', { replyTo: 'n1' })
  ]
  it('lists the participants other than the announcer, and who has answered, a reply to a reminder included', () => {
    const [a] = announcementsOf(thread, msgs)
    expect(a.participants.map((p) => p.project)).toEqual(['fabric', 'contract', 'obs'])
    expect(a.answered).toBe(2)
    expect(a.participants.find((p) => p.project === 'fabric')!.answer).toBeNull()
    expect(a.participants.find((p) => p.project === 'contract')!.answer!.type).toBe('adapted')
    expect(a.participants.find((p) => p.project === 'obs')!.answer!.type).toBe('replied')
  })
  it('reads the typed reaction first, then the first word', () => {
    expect(answerTypeOf(m('x', 'p', 'reply', 'row CT-81, 2026-10-24', 'z'))).toBe('row')
    expect(answerTypeOf(m('x', 'p', 'reply', '**Not affected**: no API', 'z'))).toBe('not-affected')
    expect(answerTypeOf(m('x', 'p', 'reply', 'thanks', 'z', { reaction: { type: 'adapted' } }))).toBe('adapted')
    expect(answerTypeOf(m('x', 'p', 'reply', 'ok', 'z'))).toBe('replied')
  })
  it('an answer before the announcement does not count', () => {
    const [a] = announcementsOf(thread, [m('r0', 'fabric', 'message', 'hello', '2026-10-18T00:00:00Z'), ...msgs])
    expect(a.participants.find((p) => p.project === 'fabric')!.answer).toBeNull()
  })
})
