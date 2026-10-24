import { describe, expect, it, vi } from 'vitest'
import { STACK_START_RETRY, dockerIsUnreachable, dockerSocketFrom, nameTheLimit, recoveryStart, stackStartIsTransient, startWithRetry, waitForDocker } from './stackStartRetry'

// The words measured on the operator's Mac, 2026-10-14.
const STARTING = 'Command failed: supabase start -x realtime\nsupabase start is already running.\n\u001b[31msupabase_db_fabric container is not ready: starting\u001b[39m'
const NO_DOCKER = 'Command failed: supabase start\nfailed to connect to the docker API at unix:///Users/x/.orbstack/run/docker.sock: connect: no such file or directory'
const plan = { attempts: 3, waitMs: 5 }
const sleep = vi.fn(async () => {})

describe('stackStartIsTransient', () => {
  it('a container still starting, or a start already in flight, is a moment; unhealthy is not', () => {
    expect(stackStartIsTransient(STARTING)).toBe(true)
    expect(stackStartIsTransient('supabase_db_fabric container is not ready: unhealthy')).toBe(false)
  })
  it('Docker away, a port taken or anything else is not', () => {
    expect(stackStartIsTransient(NO_DOCKER)).toBe(false)
    expect(stackStartIsTransient('port 54322 is already allocated')).toBe(false)
  })
})

describe('startWithRetry', () => {
  it('waits out a starting container and succeeds', async () => {
    let n = 0
    const onRetry = vi.fn()
    await startWithRetry(async () => { if (n++ < 2) throw new Error(STARTING) }, { plan, sleep, onRetry })
    expect(n).toBe(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })
  it('never retries a real refusal: Docker away is said at once', async () => {
    let n = 0
    await expect(startWithRetry(async () => { n++; throw new Error(NO_DOCKER) }, { plan, sleep })).rejects.toThrow(/docker API/)
    expect(n).toBe(1)
  })
  it('gives up after its attempts and throws the stack’s own last words', async () => {
    let n = 0
    await expect(startWithRetry(async () => { n++; throw new Error(STARTING) }, { plan, sleep })).rejects.toThrow(/not ready: starting/)
    expect(n).toBe(3)
  })
  it('a quit during the wait starts no new try', async () => {
    let n = 0, quit = false
    const stopSleep = async () => { quit = true }
    await expect(startWithRetry(async () => { n++; throw new Error(STARTING) }, { plan, sleep: stopSleep, stopped: () => quit })).rejects.toThrow()
    expect(n).toBe(1)
  })
  it('says which try of how many', async () => {
    let n = 0; const tries: string[] = []
    await startWithRetry(async () => { if (n++ < 1) throw new Error(STARTING) }, { plan, sleep, onRetry: (a, of) => tries.push(`${a}/${of}`) })
    expect(tries).toEqual(['2/3'])
  })
})

// 0.3.7 review ER-4, the operator's Mac 2026-10-20: launched at login before OrbStack had its socket, Fabric showed
// the failure window at once. Docker away is now waited for (asked every 2 s, 90 s in all), then the start runs.
describe('Docker that is not there yet (ER-4)', () => {
  const clock = () => { let t = 0; return { now: () => t, sleep: async (ms: number) => { t += ms } } }
  const dockerWait = { totalMs: 90_000, pollMs: 2_000 }

  it('knows Docker away by the words of the CLI and of Docker, and reads the socket they name', () => {
    expect(dockerIsUnreachable(NO_DOCKER)).toBe(true)
    expect(dockerIsUnreachable('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?')).toBe(true)
    expect(dockerIsUnreachable('port 54322 is already allocated')).toBe(false)
    expect(dockerIsUnreachable(STARTING)).toBe(false)
    expect(dockerSocketFrom(NO_DOCKER)).toBe('/Users/x/.orbstack/run/docker.sock')
    expect(dockerSocketFrom('error during connect: open //./pipe/docker_engine: npipe:////./pipe/docker_engine')).toBe('\\\\.\\pipe\\docker_engine')
    expect(dockerSocketFrom('no socket here')).toBeNull()
  })

  it('waits until Docker answers, then starts the stack', async () => {
    const c = clock()
    let starts = 0, pings = 0
    const asked: (string | null)[] = []
    const onDockerWait = vi.fn()
    await startWithRetry(async () => { if (starts++ === 0) throw new Error(NO_DOCKER) }, {
      plan, sleep: c.sleep, now: c.now, dockerWait, onDockerWait,
      pingDocker: async (socket) => { asked.push(socket); return ++pings >= 4 }
    })
    expect(starts).toBe(2)
    expect(pings).toBe(4)
    expect(asked.every((s) => s === '/Users/x/.orbstack/run/docker.sock')).toBe(true)
    expect(onDockerWait).toHaveBeenCalledTimes(3)
    expect(c.now()).toBe(6_000)
  })

  it('gives up after the deadline and names Docker, keeping the stack\'s own words', async () => {
    const c = clock()
    let starts = 0, pings = 0
    await expect(startWithRetry(async () => { starts++; throw new Error(NO_DOCKER) }, {
      plan, sleep: c.sleep, now: c.now, dockerWait, pingDocker: async () => { pings++; return false }
    })).rejects.toThrow(/Docker did not answer within 90 s[\s\S]*docker API/)
    expect(starts).toBe(1)
    expect(pings).toBe(46) // at 0 s, every 2 s, and at 90 s
    expect(c.now()).toBeLessThanOrEqual(90_000)
  })

  it('a quit during the wait starts nothing', async () => {
    const c = clock()
    let starts = 0, pings = 0, quit = false
    await expect(startWithRetry(async () => { starts++; throw new Error(NO_DOCKER) }, {
      plan, sleep: c.sleep, now: c.now, dockerWait, stopped: () => quit,
      pingDocker: async () => { if (++pings === 3) quit = true; return false }
    })).rejects.toThrow(/docker API/)
    expect(starts).toBe(1)
    expect(pings).toBe(3)
  })

  it('waits once: Docker away again after it answered is said, not waited for a second time', async () => {
    const c = clock()
    let starts = 0
    await expect(startWithRetry(async () => { starts++; throw new Error(NO_DOCKER) }, {
      plan, sleep: c.sleep, now: c.now, dockerWait, pingDocker: async () => true
    })).rejects.toThrow(/docker API/)
    expect(starts).toBe(2)
  })

  it('a ping that throws is "not yet"', async () => {
    const c = clock()
    let n = 0
    expect(await waitForDocker(async () => { if (++n < 3) throw new Error('ECONNREFUSED'); return true }, { sleep: c.sleep, now: c.now, plan: dockerWait })).toBe('ready')
  })
})

describe('the socket named by the real words of the docker CLI and the Supabase CLI (0.3.7 i2 ER-1)', () => {
  it('ends the unix path at .sock, whatever punctuation follows', () => {
    expect(dockerSocketFrom('failed to connect to the docker API at unix:///Users/a/.orbstack/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /Users/a/.orbstack/run/docker.sock: connect: no such file or directory')).toBe('/Users/a/.orbstack/run/docker.sock')
    expect(dockerSocketFrom('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?')).toBe('/var/run/docker.sock')
  })
  it('drops a trailing full stop from a Windows pipe name', () => {
    expect(dockerSocketFrom('error during connect: open //./pipe/docker_engine. The system cannot find the file specified.'.replace('open //', 'open npipe:////'))).toBe('\\\\.\\pipe\\docker_engine')
  })
})

describe('the bare Windows pipe form (0.3.7 i3 errors note)', () => {
  it('reads //./pipe/docker_engine without the npipe: prefix', () => {
    expect(dockerSocketFrom('error during connect: open //./pipe/docker_engine: The system cannot find the file specified.')).toBe('\\\\.\\pipe\\docker_engine')
  })
})

// 0.3.9 review ER-3: the runtime watch's try ran the launch's start, which repeats «supabase start is already running»
// four times, 10 s apart, per try. A try while Fabric runs is one `supabase start`: «already running» means there is
// nothing to start, and the watch's own backoff is the retry.
describe('recoveryStart: one start per try of the runtime watch (ER-3)', () => {
  it('«already running» ends the try at once, as nothing to start', async () => {
    let n = 0
    const r = await recoveryStart(async () => { n++; throw new Error(STARTING) }, { sleep })
    expect(r).toBe('already-running')
    expect(n).toBe(1)
  })
  it('a start that works says so; any other refusal is thrown with the stack\'s own words, never retried here', async () => {
    expect(await recoveryStart(async () => {}, { sleep })).toBe('started')
    let n = 0
    await expect(recoveryStart(async () => { n++; throw new Error('supabase_db_fabric container is not ready: starting') }, { sleep })).rejects.toThrow(/not ready: starting/)
    expect(n).toBe(1)
  })
  it('still waits for Docker that is not there yet, once', async () => {
    let n = 0
    let up = false
    const r = await recoveryStart(async () => { n++; if (!up) throw new Error(NO_DOCKER) }, { sleep, pingDocker: async () => (up = true), dockerWait: { totalMs: 100, pollMs: 10 } })
    expect(r).toBe('started')
    expect(n).toBe(2)
  })
})

describe('one deadline for the whole start (CO-311)', () => {
  const STARTING_ = 'supabase_db_fabric container is not ready: starting'
  it('gives each try what is left of the deadline and stops before a try the deadline would cut, saying the deadline', async () => {
    let clock = 0
    const limits: Array<number | null> = []
    const plan = { attempts: 4, waitMs: 10_000, totalMs: 300_000 }
    const sleep = async (ms: number) => { clock += ms }
    await expect(startWithRetry(async (limit) => { limits.push(limit); clock += 140_000; throw new Error(STARTING_) }, { plan, sleep, now: () => clock }))
      .rejects.toThrow(/did not become ready within 5 minutes[\s\S]*not ready: starting/)
    expect(limits).toEqual([300_000, 150_000])
  })
  it('does not count the wait for Docker against it, and a plan without one keeps its old behaviour', async () => {
    let clock = 0, n = 0
    const sleep = async (ms: number) => { clock += ms }
    await startWithRetry(async (limit) => { n++; expect(limit).toBeNull(); if (n < 3) throw new Error(STARTING_) }, { plan: { attempts: 4, waitMs: 10 }, sleep, now: () => clock })
    expect(n).toBe(3)
  })
  it('starts no try with less than a useful minimum left: the deadline is said instead (0.3.12 review ER-5)', async () => {
    // Probe B of the review: tries of 140 s, 130 s and 9 s left 11 s, and the fourth try ran with a 1 s limit.
    let clock = 0
    const limits: Array<number | null> = []
    const spend = [140_000, 130_000, 9_000]
    const plan = STACK_START_RETRY
    const sleep = async (ms: number) => { clock += ms }
    await expect(startWithRetry(async (limit) => { limits.push(limit); clock += spend[limits.length - 1] ?? 0; throw new Error(STARTING_) }, { plan, sleep, now: () => clock }))
      .rejects.toThrow(/did not become ready within 5 minutes/)
    expect(limits).toEqual([300_000, 150_000])
    expect(Math.min(...(limits as number[]))).toBeGreaterThanOrEqual(STACK_START_RETRY.minTryMs ?? 0)
  })
  it('the minimum holds after the wait for Docker too (0.3.12 review i2 ER-7)', async () => {
    // Probe 2 of the review: try 1 spent 295 s and met Docker gone; Docker answered at once; the next try ran with 5 s.
    let clock = 0
    const limits: Array<number | null> = []
    const sleep = async (ms: number) => { clock += ms }
    await expect(startWithRetry(async (limit) => { limits.push(limit); clock += 295_000; throw new Error(NO_DOCKER) }, {
      plan: STACK_START_RETRY, sleep, now: () => clock, pingDocker: async () => true, dockerWait: { totalMs: 90_000, pollMs: 2_000 },
    })).rejects.toThrow(/did not become ready within 5 minutes[\s\S]*docker API/)
    expect(limits).toEqual([300_000])
  })
  it('a try stopped by its limit names that limit, so the window never says four minutes of a shorter one', () => {
    const killed = Object.assign(new Error('Command failed: supabase start -x realtime'), { killed: true, signal: 'SIGTERM' })
    const named = nameTheLimit(killed, 150_000)
    expect(named).toBe(killed)
    expect(named.message).toBe('supabase start was stopped after 150 s, the time it was given.\nCommand failed: supabase start -x realtime')
    expect((named as { killed?: boolean }).killed).toBe(true)
    const refused = new Error('Command failed: supabase start\nport is already allocated')
    expect(nameTheLimit(refused, 150_000).message).toBe(refused.message)
  })
})
