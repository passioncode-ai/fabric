// #region stack-watch — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-2, ST-3, ST-1 of the 0.3.9 stability audit: which start failures heal by waiting, how long Fabric waits between
// tries, and the runtime watch's state machine (a record once per change of state, never once per tick).
import { describe, expect, it } from 'vitest'
import { classifyStartupFailure } from './startupFailure.ts'
import {
  DISK_RECOVERED_BYTES,
  STACK_DOWN_AFTER,
  hubRefusalFor,
  initialStackWatch,
  observeStack,
  recoveryDue,
  recoveryTried,
  stackBackoffMs,
  stackHealthView,
  startupHeals,
  watchDelayMs
} from './stackWatch.ts'

const ok = { database: true, docker: true, freeDiskBytes: 50e9 }
const dbGone = { database: false, docker: true, freeDiskBytes: 50e9 }
const dockerGone = { database: false, docker: false, freeDiskBytes: 50e9 }

describe('startupHeals: a start that waits instead of quitting (ST-3)', () => {
  it('waits for Docker that does not answer, a stack still starting, a slow start and an unreachable database', () => {
    const docker = classifyStartupFailure({ message: 'Docker did not answer within 90 s, so the local stack could not start.\nCommand failed: supabase start -x a,b\nfailed to connect to the docker API at unix:///Users/x/.orbstack/run/docker.sock; check if the path is correct and if the daemon is running' })
    expect(startupHeals(docker)).toBe(true)
    expect(startupHeals(classifyStartupFailure({ message: 'Command failed: supabase start\nsupabase_db_fabric container is not ready: starting' }))).toBe(true)
    expect(startupHeals(classifyStartupFailure({ message: 'spawnSync supabase ETIMEDOUT', code: 'ETIMEDOUT' }))).toBe(true)
    expect(startupHeals(classifyStartupFailure({ message: 'estates read failed: TypeError: fetch failed' }))).toBe(true)
    expect(startupHeals(classifyStartupFailure(Object.assign(new Error('the schema version could not be read in time'), { code: 'FABRIC_SCHEMA_NOT_READY', why: 'unverified', check: 'timeout' })))).toBe(true)
    expect(startupHeals(classifyStartupFailure(Object.assign(new Error('transport'), { code: 'FABRIC_SCHEMA_NOT_READY', why: 'unverified', check: 'transport' })))).toBe(true)
  })

  it('keeps the dialog for what a retry cannot fix', () => {
    expect(startupHeals(classifyStartupFailure({ message: 'spawnSync supabase ENOENT', code: 'ENOENT' }))).toBe(false)
    expect(startupHeals(classifyStartupFailure({ message: 'Cannot locate the fabric repository' }))).toBe(false)
    expect(startupHeals(classifyStartupFailure(Object.assign(new Error('behind'), { code: 'FABRIC_SCHEMA_NOT_READY', why: 'behind', facts: { found: 89, min: 94, max: 94 } })))).toBe(false)
    expect(startupHeals(classifyStartupFailure(Object.assign(new Error('backend'), { code: 'FABRIC_SCHEMA_NOT_READY', why: 'unverified', check: 'backend-error' })))).toBe(false)
    expect(startupHeals(classifyStartupFailure({ message: "estates read failed: Could not find the table 'public.estates' (PGRST205)" }))).toBe(false)
    expect(startupHeals(classifyStartupFailure({ message: 'Command failed: supabase start\nfailed to start docker container: Bind for 0.0.0.0:54322 failed: port is already allocated' }))).toBe(false)
    expect(startupHeals(classifyStartupFailure({ message: 'supabase status did not yield API_URL/SERVICE_ROLE_KEY (got: )' }))).toBe(false)
    expect(startupHeals(classifyStartupFailure({ message: 'identity could not be established: that person is not a member' }))).toBe(false)
    expect(startupHeals(classifyStartupFailure({ message: 'something nobody predicted' }))).toBe(false)
  })
})

describe('stackBackoffMs: 10 s growing to 2 min', () => {
  it('doubles from ten seconds and holds at two minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 50].map((n) => stackBackoffMs(n))).toEqual([10_000, 20_000, 40_000, 80_000, 120_000, 120_000, 120_000])
    expect(stackBackoffMs(0)).toBe(10_000)
    expect(stackBackoffMs(Number.NaN)).toBe(10_000)
  })
})

describe('observeStack: one record per change of state (ST-2)', () => {
  it('a healthy stack says nothing, tick after tick', () => {
    let s = initialStackWatch(0)
    for (let t = 1; t <= 20; t++) {
      const r = observeStack(s, ok, t * 30_000)
      expect(r.events).toEqual([])
      s = r.state
    }
    expect(s.stack).toBe('up')
  })

  it('one failed read is a blip; consecutive failures are a lost stack, said once', () => {
    let s = initialStackWatch(0)
    let r = observeStack(s, dbGone, 30_000)
    expect(STACK_DOWN_AFTER).toBe(2)
    expect(r.events).toEqual([])
    expect(r.state.stack).toBe('up')
    r = observeStack(r.state, dbGone, 60_000)
    expect(r.events).toEqual([{ kind: 'stack-lost', why: 'database', freeDiskBytes: 50e9 }])
    expect(r.state.stack).toBe('down')
    s = r.state
    for (let t = 3; t < 10; t++) {
      r = observeStack(s, dbGone, t * 30_000)
      expect(r.events).toEqual([])
      s = r.state
    }
  })

  it('a blip that heals before the second read is never a loss', () => {
    const a = observeStack(initialStackWatch(0), dbGone, 30_000)
    const b = observeStack(a.state, ok, 60_000)
    const c = observeStack(b.state, dbGone, 90_000)
    expect([...a.events, ...b.events, ...c.events]).toEqual([])
    expect(c.state.stack).toBe('up')
  })

  it('names Docker when Docker does not answer, and records the return once', () => {
    let r = observeStack(initialStackWatch(0), dockerGone, 30_000)
    r = observeStack(r.state, dockerGone, 60_000)
    expect(r.events[0]).toMatchObject({ kind: 'stack-lost', why: 'docker' })
    r = observeStack(r.state, ok, 400_000)
    expect(r.events).toEqual([{ kind: 'stack-back', downMs: 340_000, recoveries: 0 }])
    expect(r.state.stack).toBe('up')
    r = observeStack(r.state, ok, 430_000)
    expect(r.events).toEqual([])
  })

  it('an external stack (no Docker to ask) is named as the database', () => {
    let r = observeStack(initialStackWatch(0), { database: false, docker: null, freeDiskBytes: null }, 30_000)
    r = observeStack(r.state, { database: false, docker: null, freeDiskBytes: null }, 60_000)
    expect(r.events[0]).toMatchObject({ kind: 'stack-lost', why: 'database' })
  })

  it('a low disk is recorded once per crossing, with room to stop flapping (ST-1)', () => {
    let r = observeStack(initialStackWatch(0), { ...ok, freeDiskBytes: 2.9e9 }, 30_000)
    expect(r.events).toEqual([{ kind: 'disk-low', freeDiskBytes: 2.9e9 }])
    r = observeStack(r.state, { ...ok, freeDiskBytes: 2.8e9 }, 60_000)
    expect(r.events).toEqual([])
    // Just over 3 GB is still low: the way back is DISK_RECOVERED_BYTES.
    r = observeStack(r.state, { ...ok, freeDiskBytes: 3.1e9 }, 90_000)
    expect(r.events).toEqual([])
    r = observeStack(r.state, { ...ok, freeDiskBytes: DISK_RECOVERED_BYTES + 1 }, 120_000)
    expect(r.events).toEqual([{ kind: 'disk-ok', freeDiskBytes: DISK_RECOVERED_BYTES + 1 }])
    // An unreadable disk changes nothing.
    r = observeStack(r.state, { ...ok, freeDiskBytes: null }, 150_000)
    expect(r.events).toEqual([])
    expect(r.state.disk).toBe('ok')
  })
})

describe('recovery: bounded, with backoff', () => {
  it('is due 10 s after the loss, then waits longer after each try', () => {
    let r = observeStack(initialStackWatch(0), dbGone, 30_000)
    r = observeStack(r.state, dbGone, 60_000)
    let s = r.state
    expect(recoveryDue(s, 69_999)).toBe(false)
    expect(recoveryDue(s, 70_000)).toBe(true)
    s = recoveryTried(s, 70_000)
    expect(s.recoveries).toBe(1)
    expect(recoveryDue(s, 80_000)).toBe(false)
    expect(recoveryDue(s, 90_000)).toBe(true)
    s = recoveryTried(s, 90_000)
    expect(s.nextRecoveryAt).toBe(130_000)
    const back = observeStack(s, ok, 140_000)
    expect(back.events).toEqual([{ kind: 'stack-back', downMs: 80_000, recoveries: 2 }])
    expect(back.state.recoveries).toBe(0)
    expect(back.state.nextRecoveryAt).toBeNull()
    expect(recoveryDue(back.state, 1e9)).toBe(false)
  })

  it('ticks sooner while a recovery is due, and every 30 s otherwise', () => {
    expect(watchDelayMs(initialStackWatch(0), 0)).toBe(30_000)
    let r = observeStack(initialStackWatch(0), dbGone, 30_000)
    r = observeStack(r.state, dbGone, 60_000)
    expect(watchDelayMs(r.state, 60_000)).toBe(10_000)
    expect(watchDelayMs(r.state, 75_000)).toBe(1_000)
  })
})

describe('what the hub and the person are told', () => {
  it('the hub refuses with stack-unavailable and a Retry-After while the stack is down, and not otherwise', () => {
    expect(hubRefusalFor(initialStackWatch(0), 0)).toBeNull()
    let r = observeStack(initialStackWatch(0), dbGone, 30_000)
    r = observeStack(r.state, dbGone, 60_000)
    const refusal = hubRefusalFor(r.state, 60_000)
    expect(refusal).toMatchObject({ code: 'stack-unavailable', retryAfterS: 10 })
    expect(refusal!.reason).toMatch(/database/)
    expect(hubRefusalFor(recoveryTried(recoveryTried(recoveryTried(recoveryTried(recoveryTried(r.state, 0), 0), 0), 0), 0), 0)!.retryAfterS).toBe(120)
  })

  it('the view names the disk as the likely cause when the stack is down on a low disk', () => {
    let r = observeStack(initialStackWatch(0), { database: false, docker: false, freeDiskBytes: 1e9 }, 30_000)
    r = observeStack(r.state, { database: false, docker: false, freeDiskBytes: 1e9 }, 60_000)
    const v = stackHealthView(r.state, 60_000)
    expect(v).toMatchObject({ stack: 'down', why: 'docker', diskLow: true, freeDiskBytes: 1e9, diskLikelyCause: true })
    expect(v.nextTryInS).toBe(10)
    const up = stackHealthView(initialStackWatch(0), 0)
    expect(up).toMatchObject({ stack: 'up', why: null, diskLow: false, diskLikelyCause: false, nextTryInS: null })
  })
})
// #endregion stack-watch
