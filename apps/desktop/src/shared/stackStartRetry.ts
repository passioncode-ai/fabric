// #region stack-start-retry — docs: docs/ux/scenarios.md#scn-161-fabric-opens-while-its-stack-is-still-starting
/**
 * Which refusals of `supabase start` are a moment rather than a fault (2026-10-14). Measured on the operator's Mac:
 * after Docker (OrbStack) came back, the next launch failed with «supabase start is already running.» and
 * «supabase_db_fabric container is not ready: starting» — the containers were healthy a minute later, but Fabric had
 * already shown «The local stack refused to start». Those two are waited out and retried; a port taken or a broken
 * config is the person's to see at once, so it is never retried.
 *
 * Docker that does not answer yet is a wait too (0.3.7 review ER-4, the operator's Mac, 2026-10-20): with launch at
 * login on by default Fabric often starts before OrbStack or Docker Desktop has its socket, and «failed to connect to
 * the docker API … no such file or directory» went straight to the failure window. Now Docker is asked every
 * `DOCKER_WAIT.pollMs` until it answers or `DOCKER_WAIT.totalMs` has passed; only then is the failure shown, naming
 * Docker.
 */
const TRANSIENT = [
  /supabase start is already running/i,
  // «starting» only: an «unhealthy» container is a fault to show, not a moment to wait out (0.3.6 review DA-10).
  /container is not ready:\s*starting/i
]

/** The words with which the Supabase CLI and Docker say the Docker daemon cannot be reached. */
const DOCKER_UNREACHABLE = [
  /failed to connect to the docker API/i,
  /Cannot connect to the Docker daemon/i,
  /Is the docker daemon running/i,
  /docker(?:_engine|\.sock)\b.*(?:no such file or directory|connection refused|cannot find the file)/i,
  /error during connect:.*docker/i
]

/** Whether the stack's own words say Docker is not there (yet). */
export function dockerIsUnreachable(message: string): boolean {
  return DOCKER_UNREACHABLE.some((r) => r.test(message))
}

/** The socket the stack's words name (`unix:///…/docker.sock`, `npipe:////./pipe/docker_engine`), so the wait asks the
 *  same Docker the stack asked; null when the words name none. */
export function dockerSocketFrom(message: string): string | null {
  // The real words put punctuation right after the path («…/docker.sock; check…», «…/docker.sock. Is the docker daemon
  // running?»): the path ends at `.sock` when it has one, and trailing punctuation is never part of it (0.3.7 i2 ER-1).
  const unix = /unix:\/\/(\/[^\s'"]*?\.sock)(?![A-Za-z0-9_-])/.exec(message) ?? /unix:\/\/(\/[^\s:;,'"]+)/.exec(message)
  if (unix) return unix[1].replace(/[.;,:]+$/, '')
  // `npipe:////./pipe/docker_engine` from the CLI, or the bare `//./pipe/docker_engine` Docker Desktop prints.
  const pipe = /(?:npipe:)?\/\/\/*\.\/pipe\/([A-Za-z0-9_.-]+)/.exec(message)
  return pipe ? `\\\\.\\pipe\\${pipe[1].replace(/[.]+$/, '')}` : null
}

export interface DockerWaitPlan {
  /** How long Docker is waited for in all. */
  totalMs: number
  /** Between two questions to Docker. */
  pollMs: number
}

export const DOCKER_WAIT: DockerWaitPlan = { totalMs: 90_000, pollMs: 2_000 }

/**
 * Asks `ping` every `plan.pollMs` until it answers true, `plan.totalMs` has passed, or a quit (`stopped`). `onWait`
 * hears the seconds waited so far, for the splash.
 */
export async function waitForDocker(
  ping: () => Promise<boolean>,
  opts: {
    plan?: DockerWaitPlan
    sleep?: (ms: number) => Promise<void>
    now?: () => number
    stopped?: () => boolean
    onWait?: (waitedMs: number) => void
  } = {}
): Promise<'ready' | 'timeout' | 'stopped'> {
  const plan = opts.plan ?? DOCKER_WAIT
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = opts.now ?? Date.now
  const t0 = now()
  for (;;) {
    if (opts.stopped?.()) return 'stopped'
    if (await ping().catch(() => false)) return 'ready'
    if (opts.stopped?.()) return 'stopped'
    const waited = now() - t0
    if (waited + plan.pollMs > plan.totalMs) return 'timeout'
    opts.onWait?.(waited)
    await sleep(plan.pollMs)
  }
}

/** Whether the stack's own words say it is still coming up. */
export function stackStartIsTransient(message: string): boolean {
  return TRANSIENT.some((r) => r.test(message))
}

export interface RetryPlan {
  /** How many tries in all, the first included. */
  attempts: number
  /** Waited between tries, so a starting container has time to become healthy. */
  waitMs: number
}

export const STACK_START_RETRY: RetryPlan = { attempts: 4, waitMs: 10_000 }

/**
 * Runs `start` until it succeeds, retrying only a transient refusal, at most `plan.attempts` times. The last failure
 * is thrown as it was, so the startup sheet still shows the stack's own words.
 */
export async function startWithRetry(
  start: () => Promise<void>,
  opts: {
    plan?: RetryPlan
    sleep?: (ms: number) => Promise<void>
    /** Called before each new try: `attempt` is the try about to run, of `attempts`. */
    onRetry?: (attempt: number, attempts: number, message: string) => void
    /** A quit during the wait: no new try is started after it (LC-02; 0.3.6 review DO-5, ER-6). */
    stopped?: () => boolean
    /** Asks Docker whether it answers; given, a start refused because Docker is away waits for it (ER-4). The socket
     *  is the one the refusal named, or null. */
    pingDocker?: (socket: string | null) => Promise<boolean>
    dockerWait?: DockerWaitPlan
    now?: () => number
    /** Called while Docker is waited for, with the time waited so far. */
    onDockerWait?: (waitedMs: number) => void
  } = {}
): Promise<void> {
  const plan = opts.plan ?? STACK_START_RETRY
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let dockerWaited = false
  for (let attempt = 1; ; attempt++) {
    try {
      await start()
      return
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // Docker away: one wait for it, not counted against the tries; then the start runs again.
      if (opts.pingDocker && !dockerWaited && dockerIsUnreachable(message) && !opts.stopped?.()) {
        dockerWaited = true
        const socket = dockerSocketFrom(message)
        const waited = await waitForDocker(() => opts.pingDocker!(socket), { plan: opts.dockerWait, sleep, now: opts.now, stopped: opts.stopped, onWait: opts.onDockerWait })
        if (waited === 'stopped') throw e
        if (waited === 'timeout') {
          const total = Math.round((opts.dockerWait ?? DOCKER_WAIT).totalMs / 1000)
          throw new Error(`Docker did not answer within ${total} s, so the local stack could not start.\n${message}`)
        }
        attempt--
        continue
      }
      if (attempt >= plan.attempts || !stackStartIsTransient(message) || opts.stopped?.()) throw e
      await sleep(plan.waitMs)
      if (opts.stopped?.()) throw e
      opts.onRetry?.(attempt + 1, plan.attempts, message)
    }
  }
}
// #endregion stack-start-retry
