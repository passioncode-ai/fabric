// The one operations log this process writes to (M81).
//
// A SINGLETON, and that is a decision rather than a convenience. The sink is
// called from inside `catch` blocks in eight modules that have no business
// taking a logger as a constructor argument, and threading one through them
// would make the failure path the most heavily wired code in the app. The thing
// it replaces — `console.error` — is a global too; this one just goes somewhere
// a person can read.
//
// BEFORE BOOTSTRAP it is a no-op rather than a crash. Something failing before
// `app.whenReady()` has nowhere to write anyway, and a logger that throws when
// it is not ready would take out the startup it exists to explain.

import type { Ops, OpsContext } from './ops.ts'
import type { OpsLevel, OpsOutcome } from '../shared/opsLog.ts'

let sink: Ops | null = null

/** Called once at bootstrap, when `userData` is known. */
export function useOps(instance: Ops): void {
  sink = instance
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
    sink?.record(input)
  },
  begin(op: string, ctx: OpsContext) {
    return sink?.begin(op, ctx) ?? ((): void => {})
  },
  /** Shorthand for the commonest call: something failed and there was nowhere
   *  to say so. Replaces a `console.error` or, worse, a bare `catch {}`. */
  failed(op: string, error: unknown, detail?: Record<string, unknown>): void {
    sink?.record({ op, outcome: 'failed', error, detail, ctx: { correlationId: sink.correlate() } })
  },
  read(query?: { level?: OpsLevel; correlationId?: string; limit?: number }) {
    return sink?.read(query) ?? []
  },
  file: (): string | null => sink?.file() ?? null,
  /** Null before bootstrap: no sink means nothing was even attempted, which is
   *  a different statement from "zero records were lost" (S05). */
  lost: (): number | null => sink?.lost() ?? null
}
