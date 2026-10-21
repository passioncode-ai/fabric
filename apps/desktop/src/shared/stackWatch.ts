// #region stack-watch — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/**
 * The local stack while Fabric runs (0.3.9 stability audit, ST-1, ST-2, ST-3), decided here so it can be read and
 * tested without Electron, Docker or a database. The main process (`main/stackWatch.ts`) supplies readings and acts on
 * the events; this only says what a reading means.
 *
 * Measured on the operator's Mac, 2026-10-14 to 2026-10-21: about 11 of 17.5 hours of outage were periods with the app
 * alive and the database gone (Docker hung, the disk full), and Fabric said nothing and tried nothing. A start that met
 * Docker or the database not ready quit, and agents found no hub at all instead of a refusal that says to wait.
 *
 * ONE RECORD PER CHANGE OF STATE. A watch that writes a line per tick is the log noise ST-4 measured (59 % of the
 * operations log was polling reads); the events below fire on a transition and on nothing else.
 */
import { dockerIsUnreachable, stackStartIsTransient } from './stackStartRetry.ts'
import { LOW_DISK_BYTES, type StartupFailure } from './startupFailure.ts'

/** How often a running Fabric reads the stack's health. */
export const STACK_WATCH_MS = 30_000
/** One health read (the database and Docker's ping) must answer within this. */
export const STACK_READ_DEADLINE_MS = 3_000
/** Consecutive failed database reads before the stack counts as lost: one slow answer under load is a blip. */
export const STACK_DOWN_AFTER = 2
/** A low disk counts as recovered only above this, so a disk hovering at 3 GB is not recorded every tick. */
export const DISK_RECOVERED_BYTES = LOW_DISK_BYTES + 5e8

export interface BackoffPlan {
  firstMs: number
  maxMs: number
}

/** Between two tries to bring the stack back, at start or while running: 10 s, doubling, held at 2 min. */
export const STACK_BACKOFF: BackoffPlan = { firstMs: 10_000, maxMs: 120_000 }

/** The wait before try `attempt` (1-based). */
export function stackBackoffMs(attempt: number, plan: BackoffPlan = STACK_BACKOFF): number {
  const n = Number.isFinite(attempt) && attempt > 1 ? Math.floor(attempt) : 1
  return Math.min(plan.maxMs, plan.firstMs * 2 ** Math.min(n - 1, 30))
}

/** Causes a start can never heal by waiting: they need a person (install, a path, a migration, a report). */
const NEVER_HEALS: ReadonlySet<StartupFailure['cause']> = new Set([
  'supabase-cli-missing',
  'repository-not-found',
  'schema-missing',
  'active-estate-unreadable',
  'identity-refused',
  'stack-up-but-silent'
])

/**
 * Whether a failed start is Docker or the database not being ready yet, which waiting heals (ST-3): Fabric stays up,
 * keeps its hub answering with a refusal, and tries again. Anything else keeps the startup dialog, which names it.
 */
export function startupHeals(failure: Pick<StartupFailure, 'cause' | 'detail' | 'remedyKey'>): boolean {
  if (NEVER_HEALS.has(failure.cause)) return false
  switch (failure.cause) {
    case 'stack-start-timed-out':
    case 'database-unreachable':
      return true
    case 'schema-not-ready':
      // Only a check the database did not answer in time or could not be reached for: a schema that is behind or
      // ahead, or a check the database answered with an error, is the person's to fix (ST-6 is not this release).
      return failure.remedyKey === 'startup.schema-not-ready.unverified.timeout' || failure.remedyKey === 'startup.schema-not-ready.unverified.transport'
    case 'stack-would-not-start':
    case 'unknown':
      return dockerIsUnreachable(failure.detail) || stackStartIsTransient(failure.detail) || /Docker did not answer within/.test(failure.detail)
    default:
      return false
  }
}

export type StackWhy = 'docker' | 'database'

/** One health reading. `docker` is null when there is no Docker to ask (an external stack, SUPABASE_URL given);
 *  `freeDiskBytes` is null when the volume could not be read. */
export interface StackReading {
  database: boolean
  docker: boolean | null
  freeDiskBytes: number | null
}

export interface StackWatchState {
  stack: 'up' | 'down'
  why: StackWhy | null
  /** Consecutive failed database reads. */
  failures: number
  /** When the stack entered its current state (ms). */
  since: number
  disk: 'ok' | 'low' | 'unknown'
  freeDiskBytes: number | null
  /** Tries to bring it back since it was lost. */
  recoveries: number
  /** When the next try is due; null while the stack is up. */
  nextRecoveryAt: number | null
}

export type StackWatchEvent =
  | { kind: 'stack-lost'; why: StackWhy; freeDiskBytes: number | null }
  | { kind: 'stack-back'; downMs: number; recoveries: number }
  | { kind: 'disk-low'; freeDiskBytes: number }
  | { kind: 'disk-ok'; freeDiskBytes: number }

export function initialStackWatch(now: number): StackWatchState {
  return { stack: 'up', why: null, failures: 0, since: now, disk: 'unknown', freeDiskBytes: null, recoveries: 0, nextRecoveryAt: null }
}

/** The next state and what changed. A reading that changes no state produces no event. */
export function observeStack(state: StackWatchState, reading: StackReading, now: number): { state: StackWatchState; events: StackWatchEvent[] } {
  const events: StackWatchEvent[] = []
  let next: StackWatchState = { ...state }

  if (typeof reading.freeDiskBytes === 'number' && Number.isFinite(reading.freeDiskBytes)) {
    const free = reading.freeDiskBytes
    next.freeDiskBytes = free
    if (free < LOW_DISK_BYTES && next.disk !== 'low') {
      next.disk = 'low'
      events.push({ kind: 'disk-low', freeDiskBytes: free })
    } else if (next.disk === 'low' && free > DISK_RECOVERED_BYTES) {
      next.disk = 'ok'
      events.push({ kind: 'disk-ok', freeDiskBytes: free })
    } else if (next.disk === 'unknown' && free >= LOW_DISK_BYTES) next.disk = 'ok'
  }

  if (reading.database) {
    if (next.stack === 'down') {
      events.push({ kind: 'stack-back', downMs: now - next.since, recoveries: next.recoveries })
      next = { ...next, stack: 'up', why: null, since: now, recoveries: 0, nextRecoveryAt: null }
    }
    next.failures = 0
  } else {
    next.failures = state.failures + 1
    const why: StackWhy = reading.docker === false ? 'docker' : 'database'
    if (next.stack === 'up' && next.failures >= STACK_DOWN_AFTER) {
      events.push({ kind: 'stack-lost', why, freeDiskBytes: next.freeDiskBytes })
      next = { ...next, stack: 'down', why, since: now, recoveries: 0, nextRecoveryAt: now + stackBackoffMs(1) }
    } else if (next.stack === 'down') next.why = why
  }
  return { state: next, events }
}

/** Whether a try to bring the stack back is due now. */
export function recoveryDue(state: StackWatchState, now: number): boolean {
  return state.stack === 'down' && state.nextRecoveryAt !== null && now >= state.nextRecoveryAt
}

/** A try was made at `now`: the next one waits longer. */
export function recoveryTried(state: StackWatchState, now: number): StackWatchState {
  const recoveries = state.recoveries + 1
  return { ...state, recoveries, nextRecoveryAt: now + stackBackoffMs(recoveries + 1) }
}

/** When the watch reads next: every 30 s, sooner while a recovery is due (at least 1 s apart). */
export function watchDelayMs(state: StackWatchState, now: number): number {
  if (state.stack !== 'down' || state.nextRecoveryAt === null) return STACK_WATCH_MS
  return Math.max(1_000, Math.min(STACK_WATCH_MS, state.nextRecoveryAt - now))
}

/** The code a hub refusal carries: the stack is still starting (at launch) or was lost (while running). */
export type StackRefusalCode = 'stack-starting' | 'stack-unavailable'

export interface StackRefusal {
  code: StackRefusalCode
  /** For the agent: what is wrong and that it should wait, in English (the hub's language). */
  reason: string
  retryAfterS: number
}

/** The hub's refusal while the stack is down; null while it is up. */
export function hubRefusalFor(state: StackWatchState, now: number): StackRefusal | null {
  if (state.stack !== 'down') return null
  const wait = state.nextRecoveryAt === null ? STACK_WATCH_MS : state.nextRecoveryAt - now
  return {
    code: 'stack-unavailable',
    reason: `Fabric's ${state.why === 'docker' ? 'Docker engine' : 'database'} is not answering; Fabric is bringing it back. Nothing of this call was done. Wait and call again.`,
    retryAfterS: retryAfterSeconds(wait)
  }
}

/** Retry-After in whole seconds, between 5 s and 2 min. */
export function retryAfterSeconds(ms: number): number {
  return Math.max(5, Math.min(120, Math.ceil((Number.isFinite(ms) ? ms : STACK_WATCH_MS) / 1000)))
}

/** What the window shows about the stack: nothing while it is up and the disk has room. */
export interface StackHealthView {
  stack: 'starting' | 'up' | 'down'
  why: StackWhy | null
  /** ISO time the stack entered this state. */
  since: string
  /** Seconds until the next try, while down or starting. */
  nextTryInS: number | null
  diskLow: boolean
  freeDiskBytes: number | null
  /** The stack is down on a low disk: the disk is the likely cause, and freeing space comes first. */
  diskLikelyCause: boolean
}

export function stackHealthView(state: StackWatchState, now: number): StackHealthView {
  const down = state.stack === 'down'
  const diskLow = state.disk === 'low'
  return {
    stack: state.stack,
    why: state.why,
    since: new Date(state.since).toISOString(),
    nextTryInS: down && state.nextRecoveryAt !== null ? Math.max(0, Math.ceil((state.nextRecoveryAt - now) / 1000)) : null,
    diskLow,
    freeDiskBytes: state.freeDiskBytes,
    diskLikelyCause: down && diskLow
  }
}
// #endregion stack-watch
