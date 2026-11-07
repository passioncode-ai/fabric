// The one operations log this process writes to (M81).
//
// A SINGLETON, and that is a decision rather than a convenience. The sink is
// called from inside `catch` blocks in eight modules that have no business
// taking a logger as a constructor argument, and threading one through them
// would make the failure path the most heavily wired code in the app. The thing
// it replaces — `console.error` — is a global too; this one just goes somewhere
// a person can read.
//
// BEFORE BOOTSTRAP it is never a crash: a logger that throws when it is not ready
// would take out the startup it exists to explain. What is recorded before the
// log is installed is held, at most PRE_BOOTSTRAP_MAX records, and written when it
// is (CO-508: the start record of CO-365 is written at `whenReady`, before the
// log, and was lost); past the bound the rest are counted and said once.

import type { Ops, OpsContext } from './ops.ts'
import type { OpsLevel, OpsOutcome } from '../shared/opsLog.ts'

let sink: Ops | null = null

type RecordInput = Parameters<Ops['record']>[0]
/** The records held before the log is installed; the first ones are kept, a start's own records come first. */
export const PRE_BOOTSTRAP_MAX = 50
let held: RecordInput[] = []
let heldOver = 0

/** Called once at bootstrap, when `userData` is known; what was recorded before is written now, in order. */
export function useOps(instance: Ops | null): void {
  sink = instance
  // A test may take the log away again (`useOps(null)`): nothing is flushed, and later records are held again.
  if (!instance) return
  const early = held
  const over = heldOver
  held = []
  heldOver = 0
  for (const r of early) instance.record(r)
  if (over > 0) instance.record({ op: 'ops.pre-bootstrap-dropped', outcome: 'failed', level: 'warn', detail: { dropped: over, kept: early.length }, ctx: { correlationId: instance.correlate() } })
}

const hold = (input: RecordInput): void => {
  if (held.length < PRE_BOOTSTRAP_MAX) held.push(input)
  else heldOver++
}

/** The log, or a silent stand-in before bootstrap. Never null, so a caller
 *  never needs a null check inside a catch block. */
export const ops = {
  correlate: (): string => sink?.correlate() ?? 'pre-bootstrap',
  record(input: {
    op: string
    outcome: OpsOutcome
    level?: OpsLevel
    ms?: number
    detail?: Record<string, unknown>
    error?: unknown
    ctx: OpsContext
  }): void {
    if (sink) sink.record(input)
    else hold(input)
  },
  begin(op: string, ctx: OpsContext) {
    return sink?.begin(op, ctx) ?? ((): void => {})
  },
  /** Shorthand for the commonest call: something failed and there was nowhere
   *  to say so. Replaces a `console.error` or, worse, a bare `catch {}`. */
  failed(op: string, error: unknown, detail?: Record<string, unknown>): void {
    if (sink) sink.record({ op, outcome: 'failed', error, detail, ctx: { correlationId: sink.correlate() } })
    else hold({ op, outcome: 'failed', error, detail, ctx: { correlationId: 'pre-bootstrap' } })
  },
  read(query?: { level?: OpsLevel; correlationId?: string; limit?: number }) {
    return sink?.read(query) ?? []
  },
  file: (): string | null => sink?.file() ?? null,
  /** Null before bootstrap: no sink means nothing was even attempted, which is
   *  a different statement from "zero records were lost" (S05). */
  lost: (): number | null => sink?.lost() ?? null
}
