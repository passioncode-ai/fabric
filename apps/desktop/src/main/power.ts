// Keeping the machine awake while agents work (M73).
//
// A session that runs for an hour dies when the laptop suspends, and the
// operator finds out much later — the terminal is gone, the task is still open,
// and nothing says why. Since M43 and M45 the aftermath is at least honest (the
// task closes as "not accounted for", the transcript survives), but the honest
// aftermath of a preventable loss is still a loss.
//
// THE DISTINCTION THAT DECIDES WHETHER THIS WORKS AT ALL. Electron offers two
// blockers and they are not degrees of the same thing:
//
//   prevent-app-suspension  the SYSTEM stays awake; the DISPLAY sleeps normally
//   prevent-display-sleep   also burns the screen for as long as it is held
//
// We want the first. Nobody needs the screen lit for four hours to let a build
// finish, and holding the display awake is the difference between a considerate
// background app and one that flattens a battery for no reason.
//
// WHAT IT CANNOT DO, stated here and in the interface rather than discovered:
// on macOS, closing the lid on battery suspends the machine regardless of any
// blocker. The setting describes what it does; it does not promise what the
// operating system will not do.

// Electron is resolved LAZILY, not imported at module scope: this module is
// probed outside Electron (`apps/desktop/test/power.test.mjs`), and a top-level
// import would make the policy untestable without launching an app — which is
// how a policy ends up shipped on the strength of an argument.
import { createRequire } from 'node:module'

interface PowerSaveBlocker {
  start(type: 'prevent-app-suspension'): number
  stop(id: number): void
  isStarted(id: number): boolean
}

function electronBlocker(): PowerSaveBlocker {
  const require = createRequire(import.meta.url)
  return (require('electron') as { powerSaveBlocker: PowerSaveBlocker }).powerSaveBlocker
}

export type { KeepAwake } from '../shared/types'
import type { KeepAwake } from '../shared/types'
import { ops } from './opsSink.ts'

/**
 * `while-working` is the default because the other two both choose something
 * the operator did not ask for: `always` turns a laptop into a server, and
 * `never` means a long session will one day die in its sleep.
 */
export const DEFAULT_KEEP_AWAKE: KeepAwake = 'while-working'

export interface PowerKeeper {
  /** Change the policy. Idempotent; safe to call with the same value. */
  setPolicy(policy: KeepAwake): void
  /** Tell the keeper how many sessions are running. */
  setActiveSessions(count: number): void
  /** For the interface and for tests: is the machine being held awake, and why. */
  state(): { policy: KeepAwake; blocking: boolean; activeSessions: number }
  /** Release on quit. */
  stop(): void
}

export interface PowerDeps {
  /** Injected so the policy can be probed without a running Electron app. */
  start?: (type: 'prevent-app-suspension') => number
  stop?: (id: number) => void
  isStarted?: (id: number) => boolean
}

export function createPowerKeeper(deps: PowerDeps = {}): PowerKeeper {
  const start = deps.start ?? ((type: 'prevent-app-suspension') => electronBlocker().start(type))
  const stop = deps.stop ?? ((id: number) => electronBlocker().stop(id))
  const isStarted = deps.isStarted ?? ((id: number) => electronBlocker().isStarted(id))

  let policy: KeepAwake = DEFAULT_KEEP_AWAKE
  let activeSessions = 0
  let blockerId: number | null = null

  const shouldBlock = (): boolean =>
    policy === 'always' || (policy === 'while-working' && activeSessions > 0)

  const reconcile = (): void => {
    const want = shouldBlock()
    const have = blockerId !== null && isStarted(blockerId)
    if (want === have) return
    if (want) {
      blockerId = start('prevent-app-suspension')
      ops.record({
        op: 'power.hold',
        outcome: 'ok',
        detail: { policy, sessions: activeSessions },
        ctx: { correlationId: ops.correlate() }
      })
    } else if (blockerId !== null) {
      stop(blockerId)
      blockerId = null
      ops.record({ op: 'power.release', outcome: 'ok', detail: { policy }, ctx: { correlationId: ops.correlate() } })
    }
  }

  return {
    setPolicy(next: KeepAwake): void {
      policy = next
      reconcile()
    },
    setActiveSessions(count: number): void {
      activeSessions = Math.max(0, count)
      reconcile()
    },
    state() {
      return {
        policy,
        blocking: blockerId !== null && isStarted(blockerId),
        activeSessions
      }
    },
    stop(): void {
      if (blockerId !== null) {
        stop(blockerId)
        blockerId = null
      }
    }
  }
}
