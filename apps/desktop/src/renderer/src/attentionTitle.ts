// The title of an attention row, as the operator reads it. An access request carries FACTS, not a
// sentence (verification iteration 1 for 0.3.1, UX-2), so every list that shows the queue asks here,
// and the request is said in the operator's language: "<name> asks to use <product>".

import { sayQueueTitle, type Say } from '../../shared/accessWords.ts'
import type { PendingRequestFacts } from '../../shared/access.ts'

export function titleOf(item: { title: string; access?: PendingRequestFacts }, t: Say): string {
  return item.access ? sayQueueTitle(t, item.access) : item.title
}
