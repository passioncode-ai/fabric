// The title of an attention row, as the operator reads it. An access request carries FACTS, not a
// sentence (verification iteration 1 for 0.3.1, UX-2), so every list that shows the queue asks here,
// and the request is said in the operator's language: "<name> asks to use <product>".

import { sayQueueTitle, type Say } from '../../shared/accessWords.ts'
import type { PendingRequestFacts } from '../../shared/access.ts'
import type { AbandonedKind } from '../../shared/abandonedSweep.ts'
import { pluralForm, type Locale } from './i18n/translate.ts'

export function titleOf(item: { title: string; access?: PendingRequestFacts; swept?: { kind: AbandonedKind; untitled?: true } }, t: Say): string {
  if (item.access) return sayQueueTitle(t, item.access)
  // A finding the read found no title for is named in words, never by its id (0.3.13 review, iteration 1, UX-7).
  if (item.swept?.untitled) return t(UNTITLED[item.swept.kind])
  return item.title
}

const UNTITLED: Record<AbandonedKind, 'attention.untitled.request' | 'attention.untitled.answer' | 'attention.untitled.task'> = {
  'request-unmoved': 'attention.untitled.request',
  'answer-unread': 'attention.untitled.answer',
  'claim-silent': 'attention.untitled.task',
  'claim-lapsed': 'attention.untitled.task',
  'task-unclaimed': 'attention.untitled.task',
  'terminal-stalled': 'attention.untitled.task'
}

/** What a notification says about one row: its title, and for what the sweep found, why it was found (UX-7). */
export function notifyLineOf(item: { kind: string; title: string; detail: string | null; access?: PendingRequestFacts; swept?: { kind: AbandonedKind; untitled?: true } }, t: Say, locale: Locale): string {
  const title = titleOf(item, t)
  return item.swept ? `${title}: ${detailOf(item, t, locale)}` : title
}

/** The board builds a question's detail as fixed English, `blocking N task(s)` (`shared/board.ts#boardEntries`): it is
 *  said here in the interface's language (0.3.12 review, iteration 2, UX-10). Any other detail is the asker's own words. */
const BLOCKING = /^blocking (\d+) tasks?$/

export function detailOf(item: { kind: string; detail: string | null; swept?: { kind: AbandonedKind } }, t: Say, locale: Locale): string | null {
  // SW-9: abandoned work the sweep found carries its kind as a value; it is said here, never shown as the machine's word.
  if (item.swept) return t(`attention.swept.${item.swept.kind}`)
  const blocks = item.kind === 'question' && item.detail ? BLOCKING.exec(item.detail) : null
  if (!blocks) return item.detail
  const count = Number(blocks[1])
  return t(`board.blocks.${pluralForm(locale, count)}`, { count })
}
