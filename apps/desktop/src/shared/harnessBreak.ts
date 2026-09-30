// Could the observer SEE, and whose fault is the silence (M179, ADR-0040)?
//
// M178 derived liveness from three inputs and assumed a fourth thing that was
// never checked: that the watcher was awake for the interval it is judging. It
// was not always. A laptop that slept for eight hours produces a heartbeat gap
// of eight hours on every session, and `deriveLiveness` would call all of them
// stalled — an alarm on every row, at the moment the operator opens the lid,
// about agents that may be perfectly fine.
//
// SO THE GAP IS CLASSIFIED BEFORE THE AGENT IS. If the observer could not
// observe, the silence is the observer's and agent-specific blame is
// SUPPRESSED until fresh evidence is reacquired. Not softened — suppressed:
// a stall reported from an interval nobody was watching is a guess wearing the
// clothes of a measurement.
//
// AND ORIENTATION IS REQUEST-SIDE EVIDENCE ONLY. M178 read a missing
// `session.oriented@1` as proof the harness was broken. It is not: the append
// can fail while the rules were in fact delivered, and it is written when the
// request arrives rather than when the response completes. The honest verdict
// is UNCONFIRMED — something to look at, not something to assert.

export type GapOwner =
  /** The observer was watching the whole interval. Whatever the silence means,
   *  it is about the thing being watched. */
  | 'observed'
  /** The host slept, or the app was not running. Nothing was watched. */
  | 'host_asleep'
  /** The observer ran but its source of truth did not answer. */
  | 'source_unreachable'
  /** The app restarted inside the interval; what happened before is another
   *  generation's business. */
  | 'observer_restarted'

export interface ObservationGap {
  owner: GapOwner
  /** True only when the silence can be attributed to the agent at all. */
  blameAgent: boolean
  says: string
  /** How much of the interval was actually watched, in ms. Zero when none was. */
  observedMs: number
}

export interface HostWindow {
  /** When this observer generation started watching. */
  watchingSince: number
  /** Intervals the host was suspended for, inside the window. */
  suspended: readonly { from: number; to: number }[]
  /** False when the observer's source (the database) did not answer this pass. */
  sourceHealthy: boolean
}

/**
 * Who owns the silence between `since` and `now`?
 *
 * Order matters: a source outage is checked before sleep, because an observer
 * that is awake and blind is a different problem from one that is not there —
 * and reporting the second when it is the first sends somebody to check the
 * wrong machine.
 */
export function classifyObservationGap(input: {
  since: number
  now: number
  host: HostWindow
}): ObservationGap {
  const { since, now, host } = input
  const total = Math.max(0, now - since)

  if (!host.sourceHealthy)
    return {
      owner: 'source_unreachable',
      blameAgent: false,
      says: 'the observer could not read its own records this pass, so it has nothing to judge silence against',
      observedMs: 0
    }

  if (host.watchingSince > since)
    return {
      owner: 'observer_restarted',
      blameAgent: false,
      says:
        'this observer started after the interval began. What happened before belongs to a generation that ' +
        'is no longer running, and marking those runs failed because the app restarted would be an inference ' +
        'about work nobody watched.',
      observedMs: Math.max(0, now - host.watchingSince)
    }

  const asleep = host.suspended.reduce(
    (n, s) => n + Math.max(0, Math.min(now, s.to) - Math.max(since, s.from)),
    0
  )
  if (asleep > 0)
    return {
      owner: 'host_asleep',
      blameAgent: false,
      says: `the machine was suspended for ${Math.round(asleep / 1000)}s of this interval, so the silence is the observer's`,
      observedMs: Math.max(0, total - asleep)
    }

  return { owner: 'observed', blameAgent: true, says: 'the observer was watching throughout', observedMs: total }
}

export type OrientationVerdict = 'confirmed' | 'unconfirmed' | 'too_early'

/**
 * Did this session read the rules it works under?
 *
 * THREE ANSWERS, and the middle one is the correction M178 needs. A missing
 * `session.oriented@1` is request-side evidence only: the append can fail while
 * the rules were delivered, and it is written when the request arrives rather
 * than when the response completes. "The skill did not load" is a diagnosis;
 * `unconfirmed` is what the evidence supports.
 */
export function classifyOrientation(input: {
  orientedAt: number | null | undefined
  startedAt: number
  producedOutput: boolean
  now: number
  graceMs: number
}): { verdict: OrientationVerdict; says: string } {
  if (input.orientedAt) return { verdict: 'confirmed', says: 'this session asked for its rules and the ask was recorded' }
  if (input.now - input.startedAt <= input.graceMs)
    return { verdict: 'too_early', says: 'it has not been running long enough for that to mean anything' }
  if (!input.producedOutput)
    return { verdict: 'too_early', says: 'it has produced nothing at all, so there is no working session to explain' }
  return {
    verdict: 'unconfirmed',
    says:
      'this session is producing output and Fabric has no record of it reading its rules. That may mean the ' +
      'skill did not load — or it may mean the record failed while the rules were delivered. Worth opening; ' +
      'not proof on its own.'
  }
}
