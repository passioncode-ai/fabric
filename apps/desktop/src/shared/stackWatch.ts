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
import { LOW_DISK_BYTES, diskLowLine, dockerWordsSuffix, type StartupFailure } from './startupFailure.ts'

/** How often a running Fabric reads the stack's health. */
export const STACK_WATCH_MS = 30_000
/**
 * One database read must answer within this. At least the hub's own database deadline (`accessStore.ts`
 * HUB_DB_DEADLINE_MS, 5 s) plus a margin: a read the watch gives up on is one the hub's calls would also have given up
 * on, so a slow but working database (5 to 9 s measured, stability audit ST-10) never turns into refusals of calls
 * that would have succeeded (0.3.9 review ER-4).
 */
export const STACK_READ_DEADLINE_MS = 6_000
/** Consecutive failed database reads before the stack counts as lost: one refused or broken answer is a blip. */
export const STACK_DOWN_AFTER = 2
/** Consecutive reads that only ran out of time before the stack counts as lost: a slow database is given longer. */
export const STACK_DOWN_AFTER_SLOW = 3
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
      // CO-389: a query the database was too busy to finish in time (PostgreSQL's statement_timeout, SQLSTATE 57014)
      // heals by waiting; the start reads nothing past its retry point before it fails this way.
      return dockerIsUnreachable(failure.detail) || stackStartIsTransient(failure.detail) || /Docker did not answer within/.test(failure.detail) ||
        /canceling statement due to statement timeout/i.test(failure.detail) || failure.detail.includes(DISK_START_REFUSAL)
    default:
      return false
  }
}

export type StackWhy = 'docker' | 'database'

/** One health reading. `docker` is null when there is no Docker to ask (an external stack, SUPABASE_URL given);
 *  `freeDiskBytes` is null when the volume could not be read. `database` is `'slow'` when the read ran out of time
 *  rather than failing (ER-4). */
export interface StackReading {
  database: boolean | 'slow'
  docker: boolean | null
  freeDiskBytes: number | null
}

/**
 * Why Fabric is not trying to bring a lost stack back (0.3.9 review UX-2, ER-3):
 *  - `external`: SUPABASE_URL names a database Fabric did not start; it waits for it.
 *  - `stopped`: Docker answers and the stack's containers are gone, as after `supabase stop`: a stop someone made on
 *    purpose, which Fabric respects (it starts the stack again at its next launch, not behind the person's back).
 *  - `running`: the containers run but the database does not answer; a `supabase start` would only say «already
 *    running», so Fabric waits for the database (Docker's restart policy, or the database finishing its recovery).
 */
export type StackHold = 'external' | 'stopped' | 'running' | 'disk'

/** CO-594: under this much free space on the data folder's disk Fabric neither starts its stack nor keeps its own
 *  database writing. On 2026-11-17 the disk reached zero while the database wrote; the Docker VM's file system took I/O
 *  errors and needed `e2fsck` by hand. A database stopped in time keeps its data whole. */
export const CRITICAL_DISK_BYTES = 1e9

/** CO-594: a due try waits for the disk: under the critical floor, and after Fabric stopped its stack for the disk until
 *  the disk is back above the recovered mark, so a disk at the floor does not stop, start and stop the stack again.
 *  An unread disk holds nothing. The recovered mark is this process's: a Fabric started again after the stop holds only
 *  at the floor (`startRefusedForDisk`). */
export function diskHoldsRecovery(state: StackWatchState, stoppedForDisk: boolean): boolean {
  const free = state.freeDiskBytes
  if (free === null) return false
  return free < diskMarkBytes(stoppedForDisk)
}

/** The free space a start waits for: the recovered mark after Fabric's own stop for the disk, else the floor. */
export function diskMarkBytes(stoppedForDisk: boolean): number {
  return stoppedForDisk ? DISK_RECOVERED_BYTES : CRITICAL_DISK_BYTES
}

/** 0.3.23 review, iteration 1, ER-4: a stop for the disk that failed is tried again this many times per crossing of the
 *  floor, `DISK_STOP_BACKOFF` apart; a stop that never works is said each time and then left (the notice still warns). */
export const DISK_STOP_ATTEMPTS = 3
export const DISK_STOP_BACKOFF: BackoffPlan = { firstMs: 30_000, maxMs: 300_000 }

/** 0.3.23 review, iteration 1, UX-4: Fabric's own stop for the disk has ended: the stack is down at once, held for the
 *  disk and said as Fabric's stop, rather than an ordinary low-disk warning until two reads fail. */
export function diskStoppedState(state: StackWatchState, now: number): { state: StackWatchState; events: StackWatchEvent[] } {
  const events: StackWatchEvent[] = state.stack === 'up' ? [{ kind: 'stack-lost', why: 'database', freeDiskBytes: state.freeDiskBytes }] : []
  const base = state.stack === 'up'
    ? { ...state, stack: 'down' as const, why: 'database' as const, since: now, recoveries: 0, failures: STACK_DOWN_AFTER, failuresAllSlow: false }
    : state
  return { state: { ...base, diskStopped: true, diskStopFailed: false, trying: false, hold: 'disk', nextRecoveryAt: now + STACK_WATCH_MS }, events }
}

/** 0.3.23 review, iteration 1, DA-4, ER-5: why a start of Fabric's own stack is refused for the disk, or null. The launch,
 *  a Retry and the heal's start read it, as the watch does, so no start makes the database write under the floor; the
 *  refusal waits and is tried again (`startupHeals`). */
export const DISK_START_REFUSAL = 'Fabric does not start its database on a disk this full'
export function startRefusedForDisk(freeDiskBytes: number | null): string | null {
  if (freeDiskBytes === null || freeDiskBytes >= CRITICAL_DISK_BYTES) return null
  return `${DISK_START_REFUSAL}: under ${CRITICAL_DISK_BYTES / 1e9} GB free on the data folder's disk (CO-594). It is started once space is freed.`
}

/** 0.3.23 review, iteration 2, ER-10: what a start of Fabric's own stack does with the disk read. Above the floor (or the
 *  disk unread) it starts. Under it, a stack whose database, rest and kong already run is `running`: nothing is started,
 *  the launch goes on to read it, and the runtime watch stops its database for the disk (`diskStopDue`), so the person is
 *  not held on the splash by a refusal saying it starts once space is freed. Any other state is refused. */
export type DiskStartPlan = { kind: 'start' } | { kind: 'running' } | { kind: 'refused'; why: string }
export function diskStartPlan(freeDiskBytes: number | null, containers: StackContainers): DiskStartPlan {
  const why = startRefusedForDisk(freeDiskBytes)
  if (why === null) return { kind: 'start' }
  if (containers === 'running') return { kind: 'running' }
  return { kind: 'refused', why }
}

/** CO-594: the stack is up on a disk under the critical floor, and Fabric owns it: its database is stopped (its data kept)
 *  before the disk runs out. Once per crossing: a stop already made is not made again. */
export function diskStopDue(state: StackWatchState, stoppedForDisk: boolean): boolean {
  return state.stack === 'up' && state.recovers && !stoppedForDisk && state.freeDiskBytes !== null && state.freeDiskBytes < CRITICAL_DISK_BYTES
}

/** What Docker says of the stack's database container: `stopped` exists and is not running (exited, created, dead),
 *  `absent` does not exist, `unknown` could not be asked (Docker away, no CLI). */
/** What Docker says of the stack: `partial` is the database running while rest or kong, which Fabric calls, is not
 *  (CO-374): a start is the remedy there (it heals a half-up stack, CO-428), not a wait. */
export type StackContainers = 'running' | 'partial' | 'stopped' | 'absent' | 'unknown'

/** Whether a due try starts the stack, or why it holds (ER-3). Docker away or unasked starts: the launch's start path
 *  waits for Docker first. */
export function recoveryPlan(containers: StackContainers): 'start' | Exclude<StackHold, 'external'> {
  if (containers === 'absent') return 'stopped'
  if (containers === 'running') return 'running'
  return 'start'
}

export interface StackWatchState {
  stack: 'up' | 'down'
  why: StackWhy | null
  /** Consecutive failed database reads. */
  failures: number
  /** Whether every one of those failures only ran out of time (ER-4: a slow database is given longer). */
  failuresAllSlow: boolean
  /** Whether Fabric may bring the stack back (false for an external stack). */
  recovers: boolean
  /** A try is running now (UX-2): no countdown while it runs, and the next is due after it ends. */
  trying: boolean
  /** Why no try is made (null while Fabric tries). */
  hold: StackHold | null
  /** CO-594, 0.3.23 review, iteration 1 (UX-1): Fabric's own stop for the disk has ended and no start ran since; only
   *  then is the stop said as Fabric's and the recovered mark held. */
  diskStopped: boolean
  /** 0.3.23 review, iteration 2, UX-10: Fabric's stop for the disk failed its last attempt on this crossing of the floor
   *  and was left; the database still writes. Cleared by a disk back above the floor or a stop that ended. */
  diskStopFailed: boolean
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

export function initialStackWatch(now: number, opts: { recovers?: boolean } = {}): StackWatchState {
  return {
    stack: 'up', why: null, failures: 0, failuresAllSlow: true, recovers: opts.recovers ?? true, trying: false, hold: null, diskStopped: false, diskStopFailed: false,
    since: now, disk: 'unknown', freeDiskBytes: null, recoveries: 0, nextRecoveryAt: null
  }
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

  if (reading.database === true) {
    if (next.stack === 'down') {
      events.push({ kind: 'stack-back', downMs: now - next.since, recoveries: next.recoveries })
      next = { ...next, stack: 'up', why: null, since: now, recoveries: 0, nextRecoveryAt: null, hold: null, diskStopped: false }
    }
    next.failures = 0
    next.failuresAllSlow = true
  } else {
    next.failuresAllSlow = (state.failures === 0 ? true : state.failuresAllSlow) && reading.database === 'slow'
    next.failures = state.failures + 1
    const why: StackWhy = reading.docker === false ? 'docker' : 'database'
    const downAfter = next.failuresAllSlow ? STACK_DOWN_AFTER_SLOW : STACK_DOWN_AFTER
    if (next.stack === 'up' && next.failures >= downAfter) {
      events.push({ kind: 'stack-lost', why, freeDiskBytes: next.freeDiskBytes })
      next = {
        ...next, stack: 'down', why, since: now, recoveries: 0,
        hold: next.recovers ? null : 'external',
        nextRecoveryAt: next.recovers ? now + stackBackoffMs(1) : null
      }
    } else if (next.stack === 'down') next.why = why
  }
  return { state: next, events }
}

/** Whether a try to bring the stack back is due now: never while one runs, never for a stack Fabric does not own. */
export function recoveryDue(state: StackWatchState, now: number): boolean {
  return state.stack === 'down' && state.recovers && !state.trying && state.nextRecoveryAt !== null && now >= state.nextRecoveryAt
}

/** A try begins at `now`: until it ends there is no next one to count down to (UX-2). A hold that stands stays until
 *  Docker has said whether the stack starts (`recoveryStarts`): the re-check is not a try (review iteration 2, UX-1). */
export function recoveryBegun(state: StackWatchState, now: number): StackWatchState {
  void now
  return { ...state, trying: true, nextRecoveryAt: null }
}

/** Docker said the stack's containers are not there to wait for: the try starts it, and a hold that stood is over. */
export function recoveryStarts(state: StackWatchState): StackWatchState {
  return { ...state, hold: null }
}

/**
 * A try ended at `now`. One that ran `supabase start` counts, and the next waits the backoff from its END (a try can
 * outlast the backoff: Docker waited for up to 90 s, then a start bounded at 240 s). One that held (`stopped`,
 * `running`, ER-3) counts nothing and looks again at the next reading.
 */
export function recoveryEnded(state: StackWatchState, now: number, outcome: { tried: true } | { held: Exclude<StackHold, 'external'> }): StackWatchState {
  const down = state.stack === 'down'
  if ('held' in outcome) return { ...state, trying: false, hold: down ? outcome.held : null, nextRecoveryAt: down ? now + STACK_WATCH_MS : null }
  const recoveries = down ? state.recoveries + 1 : state.recoveries
  return { ...state, trying: false, hold: null, recoveries, nextRecoveryAt: down ? now + stackBackoffMs(recoveries + 1) : null }
}

/** A try made and ended at `now`: the next one waits longer. */
export function recoveryTried(state: StackWatchState, now: number): StackWatchState {
  return recoveryEnded(recoveryBegun(state, now), now, { tried: true })
}

/** When the watch reads next: every 30 s, sooner while a recovery is due (at least 1 s apart); a try in flight and a
 *  stack Fabric does not bring back are read every 30 s, never every second (UX-2). */
export function watchDelayMs(state: StackWatchState, now: number): number {
  if (state.stack !== 'down' || state.trying || state.nextRecoveryAt === null) return STACK_WATCH_MS
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
  const what = state.why === 'docker' ? 'Docker engine' : 'database'
  const tail = 'Nothing of this call was done. Wait and call again.'
  const say = (reason: string, retryAfterS: number): StackRefusal => ({ code: 'stack-unavailable', reason: `${reason} ${tail}`, retryAfterS })
  if (state.hold === 'external') return say("Fabric's database is not answering; Fabric does not run this database, so it waits for it to come back.", retryAfterSeconds(STACK_WATCH_MS))
  if (state.hold === 'stopped') return say("Fabric's local database was stopped on this computer (its containers are gone); Fabric does not start it again by itself.", retryAfterSeconds(2 * STACK_WATCH_MS))
  if (state.hold === 'running') return say("Fabric's database is not answering, though its containers are running; Fabric waits for it to answer.", retryAfterSeconds(STACK_WATCH_MS))
  if (state.hold === 'disk') return say(state.diskStopped
    ? "Fabric's database is stopped because this computer's disk is almost full; Fabric starts it again once space is freed."
    : `Fabric's ${what} is not answering and this computer's disk is almost full; Fabric does not start the database until space is freed.`, retryAfterSeconds(2 * STACK_WATCH_MS))
  if (state.trying) return say(`Fabric's ${what} is not answering; Fabric is trying to bring it back now.`, retryAfterSeconds(STACK_WATCH_MS))
  const wait = state.nextRecoveryAt === null ? STACK_WATCH_MS : state.nextRecoveryAt - now
  return say(`Fabric's ${what} is not answering; Fabric is bringing it back.`, retryAfterSeconds(wait))
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
  /** Seconds until the next try, while down and a try is due later; null while a try runs or none will be made. */
  nextTryInS: number | null
  /** A try is running now, and which one (1-based) (UX-2). */
  trying: boolean
  attempt: number | null
  /** Why Fabric makes no try (`external`, `stopped`, `running`), or null. */
  hold: StackHold | null
  /** The platform the words are for: each names its own Docker (UX-4). */
  platform: string
  /** The Docker runtime on this machine when Fabric could tell it (`Colima`, `OrbStack`, `Docker Desktop`), else null:
   *  a Mac on Colima is told about Colima (CO-492). */
  runtime: string | null
  diskLow: boolean
  freeDiskBytes: number | null
  /** The stack is down on a low disk: the disk is the likely cause, and freeing space comes first. */
  diskLikelyCause: boolean
  /** Under the `disk` hold: Fabric stopped the database itself and the stop ended (UX-1); false when it went down by itself. */
  diskStopped: boolean
  /** Under the `disk` hold: the free space the start waits for (UX-9: the words take it from here), else null. */
  diskMarkBytes: number | null
  /** 0.3.23 review, iteration 2, UX-10: the stack is up and Fabric's last stop for the disk failed, so its database still
   *  writes on a disk under the floor: the person is told to free space now. */
  diskStopFailed: boolean
}

export function stackHealthView(state: StackWatchState, now: number, platform: string = typeof process === 'undefined' ? 'darwin' : process.platform, runtime: string | null = null): StackHealthView {
  const down = state.stack === 'down'
  const diskLow = state.disk === 'low'
  const counting = down && !state.trying && state.hold === null && state.nextRecoveryAt !== null
  // While a hold stands (a stop someone made, containers that run, an external stack) Fabric makes no try: its re-check
  // every 30 s asks Docker, and that is not said as «Trying now» beside the hold (review iteration 2, UX-1).
  const trying = down && state.trying && state.hold === null
  return {
    stack: state.stack,
    why: state.why,
    since: new Date(state.since).toISOString(),
    nextTryInS: counting ? Math.max(0, Math.ceil((state.nextRecoveryAt! - now) / 1000)) : null,
    trying,
    attempt: trying ? state.recoveries + 1 : null,
    hold: down ? state.hold : null,
    platform,
    runtime,
    diskLow,
    freeDiskBytes: state.freeDiskBytes,
    diskLikelyCause: down && diskLow,
    diskStopped: down && state.hold === 'disk' && state.diskStopped,
    diskMarkBytes: down && state.hold === 'disk' ? diskMarkBytes(state.diskStopped) : null,
    diskStopFailed: !down && state.diskStopFailed === true
  }
}
/** The key for this platform's words, where they differ by OS: `.win32` names Docker Desktop, `.linux` Docker Engine,
 *  `.colima` Colima on a Mac whose engine is Colima's (CO-492), the plain key OrbStack or Docker Desktop on macOS
 *  (0.3.8 UX-1, 0.3.9 review UX-4; `diskLowLine` does the same). */
export function platformKey(key: string, platform: string, runtime: string | null = null): string {
  return `${key}${dockerWordsSuffix(platform, runtime)}`
}

/**
 * The lines of the startup wait window, in the order shown (0.3.9 review iteration 2). UX-3: a disk under 3 GB comes
 * right after the title, before «Docker is not answering … opens by itself»: a full disk stops Docker, and the wait
 * would not end by itself (SCN-161's 0.3.8 amendment says the same of the failure dialog). UX-8: agents are told they
 * are asked to wait only while the standby holds the hub's port; when it could not take it, agents reach no Fabric at
 * all, and the line says so, with the machine's reason on a line of its own (review iteration 3, UX-2). Every id is
 * always present (an empty text is a line not shown), so the window updates its lines in place by id.
 */
export const STARTUP_WAIT_LINES = ['title', 'disk', 'cause', 'next', 'agents', 'agentsWhy', 'log'] as const
export type StartupWaitLine = (typeof STARTUP_WAIT_LINES)[number]

export function startupWaitLines(input: {
  say: (key: string, vars?: Record<string, string | number>) => string
  failure: Pick<StartupFailure, 'cause'>
  waitsForDocker: boolean
  freeDiskBytes: number | null
  locale: string
  platform: string
  /** The Docker runtime when Fabric could tell it; Colima's is named on a Mac that runs it (CO-492). */
  runtime?: string | null
  /** Seconds to the next try, or null while a try runs. */
  nextInS: number | null
  /** The try running, or the next one (1-based). */
  attempt: number
  /** The hub standby: open while it holds the port; null before it was tried. */
  standby: { open: true } | { open: false; reason: string } | null
  logPath: string
}): Array<{ id: StartupWaitLine; text: string }> {
  const { say } = input
  const low = diskLowLine(input.failure, { freeDiskBytes: input.freeDiskBytes, platform: input.platform, runtime: input.runtime, locale: input.locale })
  const text: Record<StartupWaitLine, string> = {
    title: say('startup.wait.title'),
    disk: low ? say(low.key, { free: low.free }) : '',
    // Each OS names its own Docker (0.3.9 review UX-4, as 0.3.8 UX-1 did for the disk line).
    cause: say(input.waitsForDocker ? platformKey('startup.wait.docker', input.platform, input.runtime) : 'startup.wait.database'),
    next: input.nextInS === null ? say('startup.wait.trying', { attempt: input.attempt }) : say('startup.wait.next', { seconds: input.nextInS, attempt: input.attempt }),
    agents: input.standby === null ? '' : input.standby.open ? say('startup.wait.agents') : say('startup.wait.agentsNoHub'),
    // Review iteration 3, UX-2: the standby's reason is the machine's, in English; it stands on its own quieter line,
    // never inside the reader's sentence (which says once that agents do not reach Fabric).
    agentsWhy: input.standby !== null && !input.standby.open ? say('startup.wait.agentsWhy', { reason: input.standby.reason }) : '',
    log: say('startup.wait.log', { log: input.logPath })
  }
  return STARTUP_WAIT_LINES.map((id) => ({ id, text: text[id] }))
}
// #endregion stack-watch
