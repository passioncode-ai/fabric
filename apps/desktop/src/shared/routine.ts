// Work that starts without anybody asking (M13, and M132's spine).
//
// THREE RULES, and each is a way for a scheduler to be quietly wrong.
//
// 1. A MISSED WINDOW IS NOT MADE UP. A daily routine on a laptop that was shut
//    for three days runs ONCE when it opens, not three times. A routine says
//    "keep this current", not "produce three reports" — and the catch-up reading
//    turns a week away into a queue of agents all starting at once, which is
//    precisely the shape M94's row warns about.
//
// 2. NOTHING STARTS OVER ITS OWN LAST RUN. If yesterday's is still going, today
//    does not begin: two agents on one backlog is the contention the lease
//    exists for, and a scheduler that creates it every night has made a bug into
//    a schedule.
//
// 3. A REFUSAL IS RECORDED. M94's wording is that automations "pause and SAY SO
//    rather than failing one by one". A routine that did not run and left no
//    trace is indistinguishable from one that ran and did nothing — and the
//    operator finds out days later, from the absence of a report.

export interface Routine {
  id: string
  projectId: string
  /** What to run. A plain instruction, as if typed. */
  instruction: string
  /** Which runner or created agent. */
  optionId: string
  /** Minutes between runs. Daily is 1440; nothing here knows about calendars. */
  everyMinutes: number
  /** ISO of the last START, or null when it has never run. */
  lastRunAt: string | null
  /** Whether its last run is still going. */
  running: boolean
  enabled: boolean
}

export interface DueVerdict {
  routine: Routine
  /** Why it is due — said in the record, so a run has a reason attached. */
  because: string
}

/**
 * Which routines should start now.
 *
 * A routine that has NEVER run is due immediately. That is deliberate: the
 * operator who just created it should see it work, and a first run twenty-four
 * hours later is indistinguishable from one that was never wired up.
 */
export function dueRoutines(routines: readonly Routine[], nowMs: number): DueVerdict[] {
  const out: DueVerdict[] = []
  for (const r of routines) {
    if (!r.enabled) continue
    if (r.running) continue // rule 2
    if (r.lastRunAt === null) {
      out.push({ routine: r, because: 'it has never run' })
      continue
    }
    const last = Date.parse(r.lastRunAt)
    if (Number.isNaN(last)) {
      // An unreadable timestamp is not "a long time ago". Treating it as due
      // would make one corrupt row run every tick, forever.
      continue
    }
    const dueAt = last + r.everyMinutes * 60_000
    if (nowMs >= dueAt)
      out.push({
        routine: r,
        because: `${r.everyMinutes} minutes have passed since it last started`
      })
  }
  return out
}

/**
 * When a routine is next expected, for the operator to read.
 *
 * Null means "as soon as the next tick comes round" — never run, or overdue.
 * That is a different statement from a time, and rendering it as one would be a
 * measurement nobody took.
 */
export function nextDue(r: Routine, nowMs: number): string | null {
  if (!r.enabled || r.lastRunAt === null) return null
  const last = Date.parse(r.lastRunAt)
  if (Number.isNaN(last)) return null
  const dueAt = last + r.everyMinutes * 60_000
  return dueAt <= nowMs ? null : new Date(dueAt).toISOString()
}
