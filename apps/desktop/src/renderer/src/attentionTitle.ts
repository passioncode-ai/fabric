// The title of an attention row, as the operator reads it. An access request carries FACTS, not a
// sentence (verification iteration 1 for 0.3.1, UX-2), so every list that shows the queue asks here,
// and the request is said in the operator's language: "<name> asks to use <product>".

import { sayQueueTitle, type Say } from '../../shared/accessWords.ts'
import type { PendingRequestFacts } from '../../shared/access.ts'
import type { AbandonedKind } from '../../shared/abandonedSweep.ts'
import { pluralForm, type Locale } from './i18n/translate.ts'

export function titleOf(item: { title: string; access?: PendingRequestFacts }, t: Say): string {
  return item.access ? sayQueueTitle(t, item.access) : item.title
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
