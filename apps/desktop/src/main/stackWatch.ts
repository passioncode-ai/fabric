// #region stack-watch — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/**
 * The runtime stack watch (ST-2 and ST-1 of the 0.3.9 stability audit). While Fabric runs, every 30 s: one cheap read
 * of the database (bounded at 6 s, past the hub's own 5 s deadline: review ER-4), Docker's `/_ping` when that read
 * fails, and the free space of the volume that holds Fabric's data. What a reading means is `shared/stackWatch.ts`;
 * this supplies the readings and acts:
 *
 *   - a lost stack and its return are recorded ONCE each (`stack.lost`, `stack.back`), never per tick;
 *   - while it is lost the hub refuses every call `stack-unavailable` with Retry-After (`onChange`);
 *   - Fabric tries to bring it back through the launch's start path, run once per try (`recover`), with backoff from
 *     10 s to 2 min counted from the END of a try, one try at a time, never for an external stack it did not start;
 *     a try first asks Docker for the stack's containers (`containers`): gone is a stop someone made, which Fabric
 *     respects, and running is a database still coming up, which a start cannot help (review ER-3);
 *   - a low disk (under 3 GB) is recorded once per crossing and goes with the stack's state to the window, naming the
 *     disk as the likely cause when the stack is down;
 *   - CO-594: under the critical floor (1 GB) Fabric stops its own stack keeping its data (`stopForDisk`), once per
 *     crossing, and makes no try to start it until the disk is back above 3.5 GB (`diskHoldsRecovery`).
 *
 * Electron-free: every reading and action is passed in, so the probe drives it with a clock and a fake stack.
 */
import { ops } from './opsSink.ts'
import { freeDiskGb } from '../shared/startupFailure.ts'
import {
  CRITICAL_DISK_BYTES,
  DISK_RECOVERED_BYTES,
  DISK_STOP_ATTEMPTS,
  DISK_STOP_BACKOFF,
  STACK_READ_DEADLINE_MS,
  diskHoldsRecovery,
  diskSoonBand,
  diskStopDue,
  diskStoppedState,
  hubRefusalFor,
  initialStackWatch,
  observeStack,
  recoveryBegun,
  recoveryDue,
  recoveryEnded,
  recoveryPlan,
  recoveryStarts,
  stackBackoffMs,
  stackHealthView,
  watchDelayMs,
  type StackContainers,
  type StackHealthView,
  type StackHold,
  type StackRefusal,
  type StackWatchEvent,
  type StackWatchState
} from '../shared/stackWatch.ts'

export interface StackWatchDeps {
  /** Whether the database answers one cheap read; the signal ends it at the deadline. */
  readDatabase: (signal: AbortSignal) => Promise<boolean>
  /** Docker's ping, or null when there is no Docker to ask (an external stack). */
  pingDocker: (() => Promise<boolean>) | null
  /** Free bytes on the volume that holds Fabric's data, or null when it cannot be read. */
  freeDisk: () => number | null
  /** Bring the stack back (the launch's start path, once, bounded); null when Fabric does not own the stack. */
  recover: (() => Promise<'started' | 'already-running' | void>) | null
  /** CO-594: stop the stack keeping its data (`env.ts#stopStackKeepingData`); null when Fabric does not own the stack. */
  stopForDisk?: (() => Promise<void>) | null
  /** What Docker says of the stack's database container (ER-3); absent, every due try starts the stack. */
  containers?: (() => Promise<StackContainers>) | null
  /** The database read's deadline; the probe shortens it. */
  readDeadlineMs?: number
  /** Whose words the view is for (UX-4); the process's own platform unless given. */
  platform?: string
  /** The Docker runtime as the person knows it, read each time the view is made; a Mac on Colima is told about Colima
   *  (CO-492). Absent or null: the platform's usual words. */
  runtime?: (() => string | null) | null
  /** Called when the state changed, and on every tick while the stack is down (the refusal's wait shortens). */
  onChange: (view: StackHealthView, refusal: StackRefusal | null) => void
  now?: () => number
  /** The watch's own timers (its chain of reads); the probe holds them to count what is pending. */
  timers?: { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }
}

export interface StackWatch {
  start(): void
  stop(): void
  /** One reading, and what follows from it. Exposed for the probe; the timer calls it. */
  tick(): Promise<void>
  view(): StackHealthView
  refusal(): StackRefusal | null
  /** Whether the stack is lost now: the operations log counts the failures this causes instead of writing each one. */
  isDown(): boolean
}

function recordEvent(e: StackWatchEvent): void {
  const ctx = { correlationId: ops.correlate() }
  switch (e.kind) {
    case 'stack-lost':
      ops.record({
        op: 'stack.lost', outcome: 'failed', level: 'error',
        detail: {
          why: e.why,
          ...(e.freeDiskBytes !== null ? { free_disk_gb: freeDiskGb(e.freeDiskBytes), disk_low: e.freeDiskBytes < 3e9 } : {}),
          note: 'the database stopped answering while Fabric runs; agents are told to wait and Fabric is bringing it back'
        },
        ctx
      })
      return
    case 'stack-back': {
      // 2026-11-20: what failed while it was down, counted by operation (`ops.ts` quietWhile), said once here.
      const quiet = ops.takeQuiet()
      ops.record({ op: 'stack.back', outcome: 'ok', level: 'warn', detail: { down_s: Math.round(e.downMs / 1000), tries: e.recoveries, ...(quiet ? { failed_while_down: quiet } : {}) }, ctx })
      return
    }
    case 'disk-low':
      ops.record({ op: 'stack.disk-low', outcome: 'ok', level: 'warn', detail: { free_disk_gb: freeDiskGb(e.freeDiskBytes), note: 'under 3 GB free: Docker stops when the disk runs out, and the stack with it' }, ctx })
      return
    case 'disk-ok':
      ops.record({ op: 'stack.disk-ok', outcome: 'ok', level: 'info', detail: { free_disk_gb: freeDiskGb(e.freeDiskBytes) }, ctx })
  }
}

export function createStackWatch(deps: StackWatchDeps): StackWatch {
  const now = deps.now ?? Date.now
  const platform = deps.platform ?? process.platform
  const readDeadlineMs = deps.readDeadlineMs ?? STACK_READ_DEADLINE_MS
  let state: StackWatchState = initialStackWatch(now(), { recovers: deps.recover !== null })
  const timers = deps.timers ?? {
    set: (fn: () => void, ms: number): unknown => {
      const handle = setTimeout(fn, ms)
      handle.unref?.()
      return handle
    },
    clear: (handle: unknown): void => clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
  let timer: unknown = null
  /**
   * The one chain of reads (0.3.9 review iteration 2, ER-1). A try that ends reschedules the chain to read again in a
   * second; when it ends while a read of the chain is in flight, that read's own reschedule is stale and must not run,
   * or a second chain starts and every later try ending mid-read adds one more. Each schedule takes a new generation,
   * and only a read of the current generation schedules the next.
   */
  let generation = 0
  let running = false
  /**
   * Set by `stop()` (a quit) and never cleared (0.3.9 review iteration 3, ER-1): `running` only stops the chain, while
   * a read already in flight would go on to a try and launch `supabase start` after the quit began. No try begins
   * once this is set, and a try that was asking Docker when it was set launches nothing.
   */
  let stopped = false
  let reading = false
  let recovering: Promise<void> | null = null
  /** The hold last recorded, so a hold is recorded once per change, not once per re-check. */
  let heldRecorded: StackHold | null = null
  /**
   * CO-594: Fabric's own stop for the disk. The stop is said as Fabric's (and the recovered mark held) only once it has
   * ended (`state.diskStopped`, 0.3.23 review, iteration 1, UX-1); while it runs no start is made beside it (ER-4); one
   * that failed is tried again, `DISK_STOP_BACKOFF` apart, at most `DISK_STOP_ATTEMPTS` times per crossing of the floor,
   * and a disk back above the floor is a new crossing.
   */
  let diskStopping: Promise<void> | null = null
  let diskStopFails = 0
  let diskStopRetryAt: number | null = null
  /** The whole gigabytes left under the early warning's mark when the window was last told (2026-11-20). */
  let soonBand: number | null = null

  const stopForDisk = (): void => {
    if (!deps.stopForDisk) return
    const free = state.freeDiskBytes
    const begun = now()
    const attempt = diskStopFails + 1
    diskStopping = deps.stopForDisk()
      .then(() => {
        diskStopFails = 0
        diskStopRetryAt = null
        ops.record({ op: 'stack.disk-stop', outcome: 'ok', level: 'error', ms: now() - begun,
          detail: { free_disk_gb: free === null ? null : freeDiskGb(free), attempt,
            note: `under ${freeDiskGb(CRITICAL_DISK_BYTES)} GB free: Fabric stopped its database keeping its data, so a full disk cannot break it; it starts again above ${freeDiskGb(DISK_RECOVERED_BYTES)} GB` },
          ctx: { correlationId: ops.correlate() } })
        if (stopped) return
        // UX-4: said at once as Fabric's stop, not as an ordinary low-disk warning until two reads fail.
        const after = diskStoppedState(state, now())
        state = after.state
        for (const e of after.events) recordEvent(e)
        publish()
      }, (e: unknown) => {
        diskStopFails = attempt
        const gaveUp = attempt >= DISK_STOP_ATTEMPTS
        diskStopRetryAt = gaveUp ? null : now() + stackBackoffMs(attempt, DISK_STOP_BACKOFF)
        ops.record({ op: 'stack.disk-stop', outcome: 'failed', level: 'error', ms: now() - begun,
          detail: { free_disk_gb: free === null ? null : freeDiskGb(free), attempt, gave_up: gaveUp,
            why: (e instanceof Error ? e.message : String(e)).split('\n').slice(-2).join(' ').slice(0, 300) },
          ctx: { correlationId: ops.correlate() } })
        // 0.3.23 review, iteration 2, UX-10: the last attempt left the database writing; the person is told, not only the log.
        if (gaveUp && !stopped) {
          state = { ...state, diskStopFailed: true }
          publish()
        }
      })
      .finally(() => { diskStopping = null })
  }

  /** Whether a stop for the disk is due on this reading (ER-4): not while one runs or after one ended, and a failed one
   *  only at its back-off and within its attempts. */
  const diskStopNow = (t: number): boolean => {
    const free = state.freeDiskBytes
    if (free !== null && free >= CRITICAL_DISK_BYTES) {
      diskStopFails = 0
      diskStopRetryAt = null
      // UX-10: a new crossing; the warning that the stop failed goes with it, said at once.
      if (state.diskStopFailed) {
        state = { ...state, diskStopFailed: false }
        publish()
      }
    }
    if (stopped || diskStopping || !deps.stopForDisk || !diskStopDue(state, state.diskStopped)) return false
    if (diskStopFails >= DISK_STOP_ATTEMPTS) return false
    return diskStopRetryAt === null || t >= diskStopRetryAt
  }

  /** CO-594: a due try held for the disk, recorded once per change as the other holds are. */
  const holdForDisk = (t: number): void => {
    state = recoveryEnded(recoveryBegun(state, t), t, { held: 'disk' })
    if (heldRecorded !== 'disk') {
      heldRecorded = 'disk'
      ops.record({ op: 'stack.recover.held', outcome: 'ok', level: 'warn',
        detail: { hold: 'disk', free_disk_gb: state.freeDiskBytes === null ? null : freeDiskGb(state.freeDiskBytes), stopped_for_disk: state.diskStopped,
          note: 'the disk is almost full: Fabric starts its database again once space is freed' },
        ctx: { correlationId: ops.correlate() } })
    }
  }

  const view = (): StackHealthView => stackHealthView(state, now(), platform, deps.runtime?.() ?? null)
  const publish = (): void => deps.onChange(view(), hubRefusalFor(state, now()))

  /** True when the database answered, false when it refused or broke, `'slow'` when it ran out of time (ER-4). */
  const readDatabase = async (): Promise<boolean | 'slow'> => {
    const ac = new AbortController()
    const deadline = setTimeout(() => ac.abort(), readDeadlineMs)
    deadline.unref?.()
    try {
      return await Promise.race<boolean | 'slow'>([
        deps.readDatabase(ac.signal).then((answered) => (answered ? true : ac.signal.aborted ? 'slow' : false)),
        new Promise<'slow'>((resolve) => ac.signal.addEventListener('abort', () => resolve('slow'), { once: true }))
      ])
    } catch (e) {
      // A read that threw is a database that did not answer (or ran out of time, when the deadline ended it): the state
      // machine counts it, and records the loss once.
      void e
      return ac.signal.aborted ? 'slow' : false
    } finally {
      clearTimeout(deadline)
    }
  }

  const askContainers = async (): Promise<StackContainers> => {
    if (!deps.containers) return 'unknown'
    try {
      return await deps.containers()
    } catch (e) {
      // Docker could not be asked: the try starts the stack, which waits for Docker first; the reason is recorded with it.
      void e
      return 'unknown'
    }
  }

  const tryRecover = (): void => {
    if (!deps.recover || recovering || stopped) return
    state = recoveryBegun(state, now())
    const attempt = state.recoveries + 1
    const down = state.why
    recovering = (async () => {
      const containers = await askContainers()
      if (stopped) {
        // ER-1 (i3): the watch was stopped (a quit) while Docker was asked: nothing is started after it, and nothing is
        // recorded, since the quit itself is (quit.ts) and the stack's state is read afresh at the next launch.
        state = { ...state, trying: false }
        return
      }
      const plan = recoveryPlan(containers)
      if (plan !== 'start') {
        // ER-3: a stop someone made (containers gone), or a database whose containers run: no `supabase start`.
        state = recoveryEnded(state, now(), { held: plan })
        if (heldRecorded !== plan) {
          heldRecorded = plan
          ops.record({
            op: 'stack.recover.held', outcome: 'ok', level: 'warn',
            detail: {
              hold: plan, containers, down,
              note: plan === 'stopped'
                ? 'the stack\'s containers are gone, as after supabase stop: Fabric does not start it again by itself'
                : 'the stack\'s containers are running and the database does not answer: a start would only say «already running», so Fabric waits'
            },
            ctx: { correlationId: ops.correlate() }
          })
        }
        return
      }
      heldRecorded = null
      // UX-1 (i2): a hold that stood is over; the start is said as the try it is, at once.
      if (state.hold !== null) {
        state = recoveryStarts(state)
        if (state.stack === 'down') publish()
      }
      const begun = now()
      // Why this try was made, with its record (ER-3): what was down, and what Docker said of the containers.
      const because = containers === 'stopped' ? 'the stack\'s containers exist and are not running'
        : containers === 'partial' ? 'the database container runs while rest or kong does not (CO-374)'
          : 'Docker could not say whether the stack\'s containers run'
      // CO-594: a start runs, so the stop made for the disk is over whatever this try's outcome.
      state = { ...state, diskStopped: false }
      try {
        const result = await deps.recover!()
        ops.record({ op: 'stack.recover', outcome: 'ok', level: 'warn', ms: now() - begun, detail: { attempt, down, containers, because, result: result ?? 'started' }, ctx: { correlationId: ops.correlate() } })
      } catch (e) {
        // Bounded by the backoff: at most one record per try, and the tries are 10 s to 2 min apart.
        ops.record({ op: 'stack.recover', outcome: 'failed', level: 'warn', ms: now() - begun, detail: { attempt, down, containers, because, why: (e instanceof Error ? e.message : String(e)).split('\n').slice(-2).join(' ').slice(0, 300) }, ctx: { correlationId: ops.correlate() } })
      }
      state = recoveryEnded(state, now(), { tried: true })
    })()
      .catch((e) => {
        // Not reachable by design (each step above records its own failure); a defect here must not leave `trying` set.
        ops.failed('stack.watch.recover', e)
        if (state.trying) state = recoveryEnded(state, now(), { tried: true })
      })
      .finally(() => {
        recovering = null
        // The try's end changes what the person and the agents are told (UX-2): said at once, and the stack is read
        // again soon rather than at the backoff, so a start that worked is seen within a second.
        if (state.stack === 'down') publish()
        if (running) {
          if (timer) timers.clear(timer)
          schedule(1_000)
        }
      })
  }

  const tick = async (): Promise<void> => {
    if (reading) return
    reading = true
    try {
      const database = await readDatabase()
      const docker = database || !deps.pingDocker ? (deps.pingDocker ? true : null) : await deps.pingDocker().catch(() => false)
      let free: number | null = null
      try {
        free = deps.freeDisk()
      } catch (e) {
        // An unreadable volume names nothing; the reading goes on without it.
        void e
        free = null
      }
      const t = now()
      const observed = observeStack(state, { database, docker, freeDiskBytes: free }, t)
      state = observed.state
      for (const e of observed.events) recordEvent(e)
      if (state.stack === 'up') heldRecorded = null
      if (diskStopNow(t)) stopForDisk()
      // ER-4: no `supabase start` beside a `supabase stop` still running for the disk; the try waits for it to end.
      if (!stopped && !diskStopping && recoveryDue(state, t)) {
        if (diskHoldsRecovery(state, state.diskStopped)) holdForDisk(t)
        else tryRecover()
      }
      const band = diskSoonBand(state.freeDiskBytes)
      const bandMoved = band !== soonBand
      soonBand = band
      if (observed.events.length > 0 || state.stack === 'down' || bandMoved) publish()
    } catch (e) {
      ops.failed('stack.watch.tick', e)
    } finally {
      reading = false
    }
  }

  const schedule = (delayMs?: number): void => {
    if (!running) return
    const mine = ++generation
    timer = timers.set(() => {
      timer = null
      void tick().finally(() => { if (mine === generation) schedule() })
    }, delayMs ?? watchDelayMs(state, now()))
  }

  return {
    start() {
      if (running) return
      running = true
      schedule()
    },
    stop() {
      running = false
      stopped = true
      generation++
      if (timer) timers.clear(timer)
      timer = null
    },
    tick,
    isDown: () => state.stack === 'down',
    view,
    refusal: () => hubRefusalFor(state, now())
  }
}
// #endregion stack-watch
