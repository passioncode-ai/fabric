import { describe, expect, it, vi } from 'vitest'
import { stackStartIsTransient, startWithRetry } from './stackStartRetry'

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

