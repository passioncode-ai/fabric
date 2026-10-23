// #region announcements — docs: docs/ux/scenarios.md#scn-178-see-which-projects-have-not-answered-an-announcement
// Who has answered an announcement (CO-377; the operator's rule of 2026-10-19 on board thread `c430513b`): every Project
// an announcement touches answers once, with a reply that starts with «adapted», «row» or «not affected». A participant
// has answered when any message of its Project follows the announcement in the thread (a reply to a reminder counts);
// the answer's type is the contract's typed reaction (DEC-0098) when the message carries one, else its first word.
import type { CommsMessage } from './commsRead.ts'

export type AnswerType = 'adapted' | 'row' | 'not-affected' | 'replied'

export interface ParticipantAnswer {
  project: string
  /** Null while the participant has not answered. */
  answer: { type: AnswerType; at: string; messageId: string } | null
}

export interface AnnouncementStatus {
  messageId: string
  thread: string
  from: string
  at: string
  text: string | null
  participants: ParticipantAnswer[]
  answered: number
}

/** The type of an answer: the typed reaction when present, else the first word of the body. */
export function answerTypeOf(message: CommsMessage): AnswerType {
  const typed = (message as { reaction?: { type?: unknown } }).reaction?.type
  if (typed === 'adapted' || typed === 'row' || typed === 'not-affected') return typed
  const head = (message.body?.text ?? '').replace(/^[\s*_`]+/, '').toLowerCase()
  if (/^adapted\b/.test(head)) return 'adapted'
  if (/^row\b/.test(head)) return 'row'
  if (/^not[ -]affected\b/.test(head)) return 'not-affected'
  return 'replied'
}

/** Every announcement of one thread, with each participant's answer; messages in any order. */
export function announcementsOf(thread: { id: string; participants: string[] }, messages: readonly CommsMessage[]): AnnouncementStatus[] {
  const ordered = [...messages].sort((a, b) => a.at.localeCompare(b.at))
  const out: AnnouncementStatus[] = []
  ordered.forEach((m, i) => {
    if (m.kind !== 'announcement') return
    const later = ordered.slice(i + 1)
    const participants = thread.participants
      .filter((p) => p !== m.sender.project)
      .map((project): ParticipantAnswer => {
        const reply = later.find((x) => x.sender.project === project)
        return { project, answer: reply ? { type: answerTypeOf(reply), at: reply.at, messageId: reply.id } : null }
      })
    out.push({
      messageId: m.id, thread: thread.id, from: m.sender.project, at: m.at, text: m.body?.text ?? null,
      participants, answered: participants.filter((p) => p.answer).length
    })
  })
  return out
}
// #endregion announcements
