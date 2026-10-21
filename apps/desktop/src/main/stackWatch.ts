// #region stack-watch — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/**
 * The runtime stack watch (ST-2 and ST-1 of the 0.3.9 stability audit). While Fabric runs, every 30 s: one cheap read
 * of the database (bounded at 3 s), Docker's `/_ping` when that read fails, and the free space of the volume that
 * holds Fabric's data. What a reading means is `shared/stackWatch.ts`; this supplies the readings and acts:
 *
 *   - a lost stack and its return are recorded ONCE each (`stack.lost`, `stack.back`), never per tick;
 *   - while it is lost the hub refuses every call `stack-unavailable` with Retry-After (`onChange`);
 *   - Fabric tries to bring it back through the same start path as at launch (`recover`), with backoff from 10 s to
 *     2 min, one try at a time, never for an external stack it did not start;
 *   - a low disk (under 3 GB) is recorded once per crossing and goes with the stack's state to the window, naming the
 *     disk as the likely cause when the stack is down.
 *
 * Electron-free: every reading and action is passed in, so the probe drives it with a clock and a fake stack.
 */
import { ops } from './opsSink.ts'
import { freeDiskGb } from '../shared/startupFailure.ts'
import {
  STACK_READ_DEADLINE_MS,
  hubRefusalFor,
  initialStackWatch,
  observeStack,
  recoveryDue,
  recoveryTried,
  stackHealthView,
  watchDelayMs,
  type StackHealthView,
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
  /** Bring the stack back (the launch's start path, bounded); null when Fabric does not own the stack. */
  recover: (() => Promise<void>) | null
  /** Called when the state changed, and on every tick while the stack is down (the refusal's wait shortens). */
  onChange: (view: StackHealthView, refusal: StackRefusal | null) => void
  now?: () => number
}

export interface StackWatch {
  start(): void
  stop(): void
  /** One reading, and what follows from it. Exposed for the probe; the timer calls it. */
  tick(): Promise<void>
  view(): StackHealthView
  refusal(): StackRefusal | null
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
    case 'stack-back':
      ops.record({ op: 'stack.back', outcome: 'ok', level: 'warn', detail: { down_s: Math.round(e.downMs / 1000), tries: e.recoveries }, ctx })
      return
    case 'disk-low':
      ops.record({ op: 'stack.disk-low', outcome: 'ok', level: 'warn', detail: { free_disk_gb: freeDiskGb(e.freeDiskBytes), note: 'under 3 GB free: Docker stops when the disk runs out, and the stack with it' }, ctx })
      return
    case 'disk-ok':
      ops.record({ op: 'stack.disk-ok', outcome: 'ok', level: 'info', detail: { free_disk_gb: freeDiskGb(e.freeDiskBytes) }, ctx })
  }
}

export function createStackWatch(deps: StackWatchDeps): StackWatch {
  const now = deps.now ?? Date.now
  let state: StackWatchState = initialStackWatch(now())
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let reading = false
  let recovering: Promise<void> | null = null

  const readDatabase = async (): Promise<boolean> => {
    const ac = new AbortController()
    const deadline = setTimeout(() => ac.abort(), STACK_READ_DEADLINE_MS)
    deadline.unref?.()
    try {
      return await Promise.race([
        deps.readDatabase(ac.signal),
        new Promise<boolean>((resolve) => ac.signal.addEventListener('abort', () => resolve(false), { once: true }))
      ])
    } catch (e) {
      // A read that threw is a database that did not answer: the state machine counts it, and records the loss once.
      void e
      return false
    } finally {
      clearTimeout(deadline)
    }
  }

  const tryRecover = (): void => {
    if (!deps.recover || recovering) return
    state = recoveryTried(state, now())
    const attempt = state.recoveries
    const begun = now()
    recovering = (async () => {
      try {
        await deps.recover!()
        ops.record({ op: 'stack.recover', outcome: 'ok', level: 'warn', ms: now() - begun, detail: { attempt }, ctx: { correlationId: ops.correlate() } })
      } catch (e) {
        // Bounded by the backoff: at most one record per try, and the tries are 10 s to 2 min apart.
        ops.record({ op: 'stack.recover', outcome: 'failed', level: 'warn', ms: now() - begun, detail: { attempt, why: (e instanceof Error ? e.message : String(e)).split('\n').slice(-2).join(' ').slice(0, 300) }, ctx: { correlationId: ops.correlate() } })
      } finally {
        recovering = null
      }
    })()
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
      if (recoveryDue(state, t)) tryRecover()
      if (observed.events.length > 0 || state.stack === 'down') deps.onChange(stackHealthView(state, t), hubRefusalFor(state, t))
    } catch (e) {
      ops.failed('stack.watch.tick', e)
    } finally {
      reading = false
    }
  }

  const schedule = (): void => {
    if (!running) return
    timer = setTimeout(() => {
      void tick().finally(schedule)
    }, watchDelayMs(state, now()))
    timer.unref?.()
  }

  return {
    start() {
      if (running) return
      running = true
      schedule()
    },
    stop() {
      running = false
      if (timer) clearTimeout(timer)
      timer = null
    },
    tick,
    view: () => stackHealthView(state, now()),
    refusal: () => hubRefusalFor(state, now())
  }
}
// #endregion stack-watch
