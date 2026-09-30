// Telling the operator when they are not looking (M8, first transport).
//
// The estate now works while nobody watches: routines fire, the nightly agent
// takes the backlog, a hand-off reaches its bound and stops. Everything that
// needs a person lands in the attention queue — and the queue is a screen, so
// the operator learns about it when they next open the app. For work that ran at
// three in the morning that is the wrong latency.
//
// THIS IS ONE TRANSPORT OF THE FOUR M8 NAMES, and it is the one that needs no
// provider, no key and no configuration: the operating system's own
// notification. The others — mail, a chat channel, a phone — each need a
// credential, a budget and somewhere to put a failure, and none of that is
// scheduled. Naming them is not building them.
//
// THE RULE THAT MAKES OR BREAKS IT: the attention queue is DERIVED, so it
// recomputes on every read. Notified naively, one refusal rings every minute
// until it is granted — and a product that does that gets its notifications
// switched off, after which it can never tell the operator anything again. So
// each item is told about ONCE, and a burst is one notification rather than
// twelve.

export interface Notifiable {
  /** Stable for as long as the thing it names is waiting. */
  id: string
  title: string
  projectName: string | null
}

export interface NotifyDecision {
  notify: boolean
  title: string
  body: string
  /** What was told about, to be remembered so it is not told again. */
  ids: string[]
}

const SILENT: NotifyDecision = { notify: false, title: '', body: '', ids: [] }

/**
 * What to say, if anything.
 *
 * `focused` is the whole of the "should we interrupt" question: with the window
 * in front the queue is already on screen, and a notification about something
 * the operator is looking at is noise that teaches them to dismiss the next one.
 */
export function decideNotification(
  waiting: readonly Notifiable[],
  alreadyTold: ReadonlySet<string>,
  focused: boolean
): NotifyDecision {
  if (focused) return SILENT
  const fresh = waiting.filter((w) => !alreadyTold.has(w.id))
  if (fresh.length === 0) return SILENT

  if (fresh.length === 1) {
    const one = fresh[0]
    return {
      notify: true,
      title: one.projectName ?? 'Fabric',
      body: one.title,
      ids: [one.id]
    }
  }
  // A burst is ONE notification. Twelve at once is twelve dismissals and a
  // decision to turn the whole thing off.
  return {
    notify: true,
    title: 'Fabric',
    body: `${fresh.length} things are waiting for you`,
    ids: fresh.map((f) => f.id)
  }
}

/**
 * What happened when the notification was handed to the operating system.
 *
 * THREE ANSWERS, because the notifier had two and the missing one is where the
 * loss lived. `'unknown'` is not a failure: the process may have shown it and
 * died before saying so, and treating that as either certainty is a claim
 * nobody observed.
 */
export type ShowOutcome =
  | { shown: true }
  | { shown: false; why: string }
  | { shown: 'unknown'; why: string }

/**
 * Which ids may be remembered as told (AX-16).
 *
 * MEASURED at `dbe7255`: the notifier marked every id told BEFORE showing the
 * notification, inside a try whose catch reports to `ops.failed`. A show that
 * threw therefore left the ids marked told, and the operator was NEVER told
 * about those obligations for the life of the process — a silent loss of the
 * one thing this module exists to deliver, and the exact inverse of the
 * duplication the card warns about.
 *
 * THE ASYMMETRY DECIDES IT, and it is the one AX-07 used for the read cursor:
 * telling twice costs a glance, and never telling costs the thing it was about.
 * So anything short of an observed show remembers NOTHING, and an unknown
 * outcome says out loud that a repeat may follow rather than leaving a reader
 * to discover it.
 */
export function rememberTold(
  decision: NotifyDecision,
  outcome: ShowOutcome
): { told: string[]; says: string } {
  if (!decision.notify) return { told: [], says: 'nothing was said, so there is nothing to remember' }
  if (outcome.shown === true)
    return { told: decision.ids, says: 'the operator was told, and will not be told again while it waits' }
  if (outcome.shown === false)
    return { told: [], says: `nothing was shown (${outcome.why}), so the next pass tells about it again` }
  return {
    told: [],
    says:
      `nobody can say whether this was shown (${outcome.why}), so it is not recorded as told — ` +
      `the operator may hear about it again, which is the cheaper of the two mistakes`
  }
}
