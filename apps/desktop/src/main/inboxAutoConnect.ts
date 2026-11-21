// #region inbox-auto-connect — docs: docs/adr/0204-the-owners-agents-reach-fabric-inbox-with-no-question-on-his-machine.md#decision
/**
 * Fabric connects itself to Fabric Inbox (the owner, 2026-11-20 22:50, through the CEO window: «с фабрик инбокс не
 * работает … вообще это все должно быть автоматически, не надо никакой подключать»). Before this the connection began
 * only when the person pressed Allow in Agent access, so an agent's call to Inbox failed until someone did. Inbox lets a
 * signed Fabric.app of the same team in without its dialog (Fabric Inbox 1.9.1, PR #602).
 *
 * The rules, each a reason not to start: not the operator's own machine; Inbox not in the registry; a connection lives; a
 * connect is waiting; the person said no (a denial is never overridden, and their Disconnect or Deny holds across a
 * restart until they connect again, 0.3.27 review ER-69); a failed try less than RETRY_MS ago.
 */
import type { ConnectOutcome } from './productConnect.ts'

/** A connect that failed is tried again no sooner than this. */
export const INBOX_RETRY_MS = 30 * 60_000

export interface InboxAutoConnectDeps {
  trust(): string | null
  inRegistry(): boolean
  connected(): Promise<boolean>
  last(): ConnectOutcome | null
  /** Whether the person said no in a way that outlives the process (0.3.27 review ER-69): their newest Inbox connection
   *  was disconnected, or the newest answer since it was a Deny, read from the database. A read that fails is a no. */
  saidNo?(): Promise<boolean>
  begin(): Promise<{ ok: boolean }>
  record(op: string, detail: Record<string, unknown>): void
  now?: () => number
}

export type AutoConnectAnswer = 'started' | 'not-mine' | 'absent' | 'connected' | 'waiting' | 'denied' | 'too-soon' | 'busy' | 'failed'

export function createInboxAutoConnect(deps: InboxAutoConnectDeps): () => Promise<AutoConnectAnswer> {
  const now = deps.now ?? Date.now
  let lastTry = 0
  let running = false
  return async () => {
    if (running) return 'busy'
    if (deps.trust() !== 'mine') return 'not-mine'
    if (!deps.inRegistry()) return 'absent'
    running = true
    try {
      if (await deps.connected()) return 'connected'
      const last = deps.last()
      if (last?.outcome === 'waiting') return 'waiting'
      if (last?.outcome === 'denied') return 'denied'
      if (deps.saidNo && await deps.saidNo().catch(() => true /* an unread no is a no: never connect over a refusal we could not read */)) return 'denied'
      if (lastTry && now() - lastTry < INBOX_RETRY_MS) return 'too-soon'
      lastTry = now()
      const r = await deps.begin()
      deps.record('hub.inbox.auto-connect', { started: r.ok })
      return r.ok ? 'started' : 'failed'
    } catch (e) { /* recorded through the hub's ops record (deps.record), with the error's class; the next tick tries again */
      deps.record('hub.inbox.auto-connect', { started: false, error_class: e instanceof Error ? e.constructor.name : typeof e })
      return 'failed'
    } finally {
      running = false
    }
  }
}
// #endregion inbox-auto-connect
