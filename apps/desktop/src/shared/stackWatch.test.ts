// #region stack-watch — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-2, ST-3, ST-1 of the 0.3.9 stability audit: which start failures heal by waiting, how long Fabric waits between
// tries, and the runtime watch's state machine (a record once per change of state, never once per tick).
import { describe, expect, it } from 'vitest'
import { classifyStartupFailure } from './startupFailure.ts'
import { HUB_DB_DEADLINE_MS } from '../main/accessStore.ts'
import { en } from '../renderer/src/i18n/en.ts'
import { ru } from '../renderer/src/i18n/ru.ts'
import { translator as typedTranslator } from '../renderer/src/i18n/translate.ts'
import {
  DISK_RECOVERED_BYTES,
  STACK_DOWN_AFTER,
  STACK_DOWN_AFTER_SLOW,
  STACK_READ_DEADLINE_MS,
  STACK_WATCH_MS,
  platformKey,
  recoveryBegun,
  recoveryEnded,
  recoveryPlan,
  hubRefusalFor,
  initialStackWatch,
  observeStack,
  recoveryDue,
  recoveryTried,
  stackBackoffMs,
  stackHealthView,
  startupHeals,
  startupWaitLines,
  STARTUP_WAIT_LINES,
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

const lost = (opts?: { recovers?: boolean }) => {
  let r = observeStack(initialStackWatch(0, opts), dbGone, 30_000)
  r = observeStack(r.state, dbGone, 60_000)
  return r.state
}

// 0.3.9 review UX-2: a try that ran past its due time (Docker hung: up to 90 s waiting for it, then a 240 s start) left
// the next try in the past, so the notice read «Next try in 0 s», the hub's Retry-After fell to 5 s and the watch read
// every second; an external stack was promised a recovery that never comes.
describe('a try in flight, and a stack Fabric does not bring back (UX-2)', () => {
  it('while a try runs: no countdown, the try is said, the watch reads at its normal pace, agents wait 30 s', () => {
    const s = recoveryBegun(lost(), 70_000)
    expect(recoveryDue(s, 1e9)).toBe(false)
    for (const t of [70_000, 95_000, 400_000]) {
      const v = stackHealthView(s, t)
      expect(v.nextTryInS).toBeNull()
      expect(v).toMatchObject({ trying: true, attempt: 1 })
      expect(watchDelayMs(s, t)).toBe(STACK_WATCH_MS)
      expect(hubRefusalFor(s, t)!.retryAfterS).toBe(30)
    }
    expect(hubRefusalFor(s, 400_000)!.reason).toMatch(/trying to bring it back now/)
  })

  it('the next try is due a backoff after the try ENDS, not after it began', () => {
    const begun = recoveryBegun(lost(), 70_000)
    const ended = recoveryEnded(begun, 400_000, { tried: true })
    expect(ended).toMatchObject({ trying: false, recoveries: 1, nextRecoveryAt: 420_000 })
    expect(stackHealthView(ended, 400_000)).toMatchObject({ trying: false, nextTryInS: 20 })
    expect(recoveryTried(lost(), 70_000).nextRecoveryAt).toBe(90_000)
  })

  it('an external stack: no try is ever due, no countdown, and nobody is told Fabric brings it back', () => {
    const s = lost({ recovers: false })
    expect(s.hold).toBe('external')
    expect(recoveryDue(s, 1e9)).toBe(false)
    expect(watchDelayMs(s, 60_000)).toBe(STACK_WATCH_MS)
    expect(stackHealthView(s, 60_000)).toMatchObject({ nextTryInS: null, hold: 'external', trying: false })
    const refusal = hubRefusalFor(s, 60_000)!
    expect(refusal.reason).not.toMatch(/bringing it back/)
    expect(refusal.reason).toMatch(/does not run this database/)
    expect(refusal.retryAfterS).toBe(30)
  })
})

// 0.3.9 review ER-3: the watch started a stack the operator had stopped (`supabase stop`), and ran `supabase start`
// against containers that were running all along. The decision is made from what Docker reports of the containers.
describe('whether a try starts the stack (ER-3)', () => {
  it('starts only containers that exist and are not running; gone is a stop, running is a wait', () => {
    expect(recoveryPlan('stopped')).toBe('start')
    expect(recoveryPlan('unknown')).toBe('start')
    expect(recoveryPlan('absent')).toBe('stopped')
    expect(recoveryPlan('running')).toBe('running')
  })

  it('a held try counts no attempt, re-checks at the next reading, and says why to the hub and the person', () => {
    const held = recoveryEnded(recoveryBegun(lost(), 70_000), 71_000, { held: 'stopped' })
    expect(held).toMatchObject({ hold: 'stopped', recoveries: 0, trying: false, nextRecoveryAt: 71_000 + STACK_WATCH_MS })
    expect(stackHealthView(held, 71_000)).toMatchObject({ hold: 'stopped', nextTryInS: null })
    expect(hubRefusalFor(held, 71_000)!.reason).toMatch(/was stopped/)
    expect(hubRefusalFor(held, 71_000)!.reason).not.toMatch(/bringing it back/)
    const waiting = recoveryEnded(recoveryBegun(lost(), 70_000), 71_000, { held: 'running' })
    expect(hubRefusalFor(waiting, 71_000)!.reason).toMatch(/containers are running/)
    // A real try after a hold clears it.
    const tried = recoveryEnded(recoveryBegun(held, 101_000), 102_000, { tried: true })
    expect(tried).toMatchObject({ hold: null, recoveries: 1 })
  })
})

// 0.3.9 review ER-4: the watch's read gave up at 3 s while the hub's own database deadline is 5 s, and the audit measured
// 5 to 9 s answers here, so a slow but working database put every agent call into refusal.
describe('a slow database is not a lost one (ER-4)', () => {
  it('the watch waits for the database at least as long as the hub does', () => {
    expect(STACK_READ_DEADLINE_MS).toBeGreaterThanOrEqual(HUB_DB_DEADLINE_MS)
  })
  it('slow answers need more of them in a row than failures do, and one answer resets the count', () => {
    const slow = { database: 'slow' as const, docker: true, freeDiskBytes: 50e9 }
    expect(STACK_DOWN_AFTER_SLOW).toBeGreaterThan(STACK_DOWN_AFTER)
    let r = observeStack(initialStackWatch(0), slow, 30_000)
    r = observeStack(r.state, slow, 60_000)
    expect(r.state.stack).toBe('up')
    r = observeStack(r.state, ok, 90_000)
    r = observeStack(r.state, slow, 120_000)
    r = observeStack(r.state, slow, 150_000)
    expect(r.state.stack).toBe('up')
    r = observeStack(r.state, slow, 180_000)
    expect(r.events[0]).toMatchObject({ kind: 'stack-lost', why: 'database' })
    // A refused connection among them is a failure: two of those in a row are a loss, as before.
    let h = observeStack(initialStackWatch(0), slow, 30_000)
    h = observeStack(h.state, dbGone, 60_000)
    expect(h.state.stack).toBe('down')
  })
})

// 0.3.9 review UX-4: the wait window and the notice named OrbStack on Windows and Linux, as 0.3.8 UX-1 had fixed for
// the disk line. Each OS names its own Docker, in both languages.
describe('each platform names its own Docker (UX-4)', () => {
  it('picks the .win32 and .linux keys, and the macOS one elsewhere', () => {
    expect(platformKey('stack.health.docker', 'win32')).toBe('stack.health.docker.win32')
    expect(platformKey('stack.health.docker', 'linux')).toBe('stack.health.docker.linux')
    expect(platformKey('stack.health.docker', 'darwin')).toBe('stack.health.docker')
  })
  for (const [name, table] of [['en', en], ['ru', ru]] as const) {
    it(`${name}: Windows says Docker Desktop, Linux Docker Engine, and neither says OrbStack`, () => {
      const t = table as Record<string, string>
      for (const key of ['startup.wait.docker', 'stack.health.docker']) {
        expect(t[key]).toMatch(/OrbStack/)
        expect(t[`${key}.win32`]).toMatch(/Docker Desktop/)
        expect(t[`${key}.linux`]).toMatch(/Docker Engine/)
        expect(t[`${key}.win32`]).not.toMatch(/OrbStack/)
        expect(t[`${key}.linux`]).not.toMatch(/OrbStack/)
      }
      for (const key of ['startup.wait.docker', 'stack.health.docker', 'stack.health.external', 'stack.health.stopped', 'stack.health.waitingContainers'].flatMap((k) => [k, `${k}.win32`, `${k}.linux`]))
        if (t[key] !== undefined) expect(t[key]).not.toMatch(/\u2014/)
    })
  }
  it('the view carries the platform the notice speaks for', () => {
    expect(stackHealthView(lost(), 60_000, 'linux').platform).toBe('linux')
  })
})

// 0.3.9 review iteration 2: the startup wait window. UX-3: on a nearly full disk the disk comes first, as SCN-161 says
// of the failure dialog (a full disk stops Docker, which the wait window now covers). UX-8: agents are said to be asked
// to wait only while the standby holds the hub's port; otherwise they reach no Fabric at all, and that is said.
describe('the startup wait window (review iteration 2, UX-3, UX-8)', () => {
  // startupWaitLines takes keys as strings (shared code knows no registry type), as startupDialog's `say` does.
  const translator = (locale: 'en' | 'ru') => typedTranslator(locale) as unknown as (key: string, vars?: Record<string, string | number>) => string
  const failure = classifyStartupFailure('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?')
  const base = { failure, waitsForDocker: true, locale: 'en', platform: 'darwin', nextInS: 20, attempt: 2, logPath: '/tmp/startup-failure.log' }
  const text = (lines: Array<{ id: string; text: string }>) => lines.filter((l) => l.text).map((l) => l.id)

  it('puts the disk line before the cause when the disk is low, and leaves it out otherwise', () => {
    expect(STARTUP_WAIT_LINES.indexOf('disk')).toBeLessThan(STARTUP_WAIT_LINES.indexOf('cause'))
    const low = startupWaitLines({ ...base, say: translator('en'), freeDiskBytes: 1.2e9, standby: { open: true } })
    expect(low.map((l) => l.id)).toEqual([...STARTUP_WAIT_LINES])
    expect(text(low)).toEqual(['title', 'disk', 'cause', 'next', 'agents', 'log'])
    expect(low.find((l) => l.id === 'disk')!.text).toMatch(/1\.2 GB free/)
    const room = startupWaitLines({ ...base, say: translator('en'), freeDiskBytes: 50e9, standby: { open: true } })
    expect(text(room)).toEqual(['title', 'cause', 'next', 'agents', 'log'])
  })

  it('says agents are asked to wait only while the standby holds the port; otherwise that they reach no Fabric, and why', () => {
    for (const locale of ['en', 'ru'] as const) {
      const say = translator(locale)
      const open = startupWaitLines({ ...base, locale, say, freeDiskBytes: 50e9, standby: { open: true } }).find((l) => l.id === 'agents')!.text
      expect(open).toBe(say('startup.wait.agents'))
      const closedLines = startupWaitLines({ ...base, locale, say, freeDiskBytes: 50e9, standby: { open: false, reason: 'EADDRINUSE 127.0.0.1:47070' } })
      const closed = closedLines.find((l) => l.id === 'agents')!.text
      expect(closed).not.toBe(say('startup.wait.agents'))
      // Review iteration 3, UX-2: the reason is the machine's, on its own quieter line, never inside the sentence.
      expect(closedLines.find((l) => l.id === 'agentsWhy')!.text).toContain('EADDRINUSE 127.0.0.1:47070')
      expect(closed).not.toMatch(/\u2014/)
    }
  })

  it('says the try in flight, or the countdown to the next', () => {
    const say = translator('en')
    expect(startupWaitLines({ ...base, say, freeDiskBytes: null, standby: { open: true }, nextInS: null }).find((l) => l.id === 'next')!.text).toBe('Trying now (try 2).')
    expect(startupWaitLines({ ...base, say, freeDiskBytes: null, standby: { open: true } }).find((l) => l.id === 'next')!.text).toBe('Next try in 20 s (try 2).')
  })
})
// 0.3.9 review iteration 3, UX-2: the no-hub line put the standby's English reason inside the Russian sentence, and the
// reason itself repeated that agents cannot reach Fabric. The sentence says it once, in the reader's language; the
// machine's reason stands on its own line, after it, as the machine's words.
describe('the wait window says a hub it could not open once, in the reader\'s language (review iteration 3, UX-2)', () => {
  const translator = (locale: 'en' | 'ru') => typedTranslator(locale) as unknown as (key: string, vars?: Record<string, string | number>) => string
  const failure = classifyStartupFailure('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?')
  const reason = 'port 47070 on 127.0.0.1 is already in use by another program, so agents outside Fabric cannot reach it. Close that program (or choose a free port with FABRIC_HUB_PORT), then quit and reopen Fabric'
  for (const locale of ['en', 'ru'] as const) {
    it(`${locale}: the agents line carries no machine reason; the reason is its own line, right after it`, () => {
      const say = translator(locale)
      const lines = startupWaitLines({ failure, waitsForDocker: true, locale, platform: 'darwin', nextInS: 20, attempt: 2, logPath: '/tmp/l', say, freeDiskBytes: 50e9, standby: { open: false, reason } })
      const agents = lines.find((l) => l.id === 'agents')!.text
      expect(agents).not.toContain(reason)
      expect(agents).not.toMatch(/[()]/)
      // The Russian sentence holds no English words but the product's name.
      if (locale === 'ru') expect(agents.replace(/Fabric/g, '')).not.toMatch(/[A-Za-z]{3,}/)
      const why = lines.find((l) => l.id === 'agentsWhy')!
      expect(why.text).toContain(reason)
      expect(lines.map((l) => l.id).indexOf('agentsWhy')).toBe(lines.map((l) => l.id).indexOf('agents') + 1)
      expect(agents + why.text).not.toMatch(/\u2014/)
      // While the standby holds the port there is no reason to show.
      const open = startupWaitLines({ failure, waitsForDocker: true, locale, platform: 'darwin', nextInS: 20, attempt: 2, logPath: '/tmp/l', say, freeDiskBytes: 50e9, standby: { open: true } })
      expect(open.find((l) => l.id === 'agentsWhy')!.text).toBe('')
    })
  }
})

// 0.3.9 review iteration 3, UX-1: in 0.3.8 a Docker that was away ended in the dialog that said to start it; in 0.3.9
// that cause is waited for, and the wait window and the running notice no longer said what the person can do. Each
// OS says how to start its Docker, in both languages.
describe('when Docker is away, the person is told to start it, per OS (review iteration 3, UX-1)', () => {
  const how: Record<'en' | 'ru', Record<'darwin' | 'win32' | 'linux', RegExp>> = {
    en: { darwin: /If Docker is not running, open OrbStack or Docker Desktop\./, win32: /If Docker is not running, start Docker Desktop\./, linux: /If Docker is not running, start it: sudo systemctl start docker\./ },
    ru: { darwin: /Если Docker не запущен, откройте OrbStack или Docker Desktop\./, win32: /Если Docker не запущен, запустите Docker Desktop\./, linux: /Если Docker не запущен, запустите его: sudo systemctl start docker\./ }
  }
  for (const [name, table] of [['en', en], ['ru', ru]] as const) {
    it(`${name}: the wait window and the notice name the step for this OS`, () => {
      const t = table as Record<string, string>
      for (const key of ['startup.wait.docker', 'stack.health.docker'])
        for (const platform of ['darwin', 'win32', 'linux'] as const) {
          const words = t[platformKey(key, platform)]
          expect(words, `${name} ${key} ${platform}`).toMatch(how[name][platform])
          expect(words).not.toMatch(/\u2014/)
        }
    })
  }
})
// #endregion stack-watch
