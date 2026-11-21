// #region hub-doors — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * ADR-0195 W2c.2b, the first group: the nine Agent access doors of the window (`FabricApi['hub']`) as plain
 * functions over what the hub is handed back as (`board.ts#BoardHub`). The window's IPC doors call them
 * (`index.ts`, region `hub-ipc`), and `hubDoorTable` names the same functions for the board's operator door
 * (`operatorDoor.ts#startOperatorDoor`), so the window and a board process answer alike. Nothing here imports
 * Electron; every answer is the one `index.ts` gave before the move.
 */
import { homedir } from 'node:os'
import { CONNECTABLE_PRODUCTS, FABRIC_SELF, agentFacts, askLines, pendingFacts, productName, type ConnectProblem, type HubActResult, type HubOverview } from '../shared/access.ts'
import type { ActAnswer } from '../shared/acts.ts'
import { AGENTS } from '../shared/agents.ts'
import { answerOf } from './actIpc.ts'
import type { createActs } from './acts.ts'
import type { BoardHub } from './board.ts'
import type { OperatorDoorHandler } from './operatorDoor.ts'
import { FABRIC_INBOX } from './productConnect.ts'

type ConnectAnswer = { ok: true } | { ok: false; problem: ConnectProblem; reason: string }

export interface HubDoorsDeps {
  /** The hub once it is built; null before, and a door then says so by throwing as the IPC door did. */
  hub(): BoardHub | null
  /** The agent surface's origin, said in the overview while the hub listens. */
  origin(): string
  /** The person, as the actor of every decision made through these doors. */
  operator(): { kind: 'person'; id: string }
  keptOut: { readable(): boolean; list(): NonNullable<HubOverview['keptOut']>['agents'] }
  /** The person's marks (`boardState.ts`): what the person revoked is not continued by the supervisor. */
  personEnded: { markGrant(grantId: string): void; markBinding(bindingId: string): void }
  /** History's acts: the note of a revocation, and the disconnect with its undo. */
  acts(): Pick<ReturnType<typeof createActs>, 'note' | 'perform'>
  /** The operations log of the process that serves the doors. */
  ops: { failed(op: string, e: unknown, fields: Record<string, unknown>): void }
  home?: () => string
}

export interface HubDoors {
  overview(): Promise<HubOverview>
  decide(requestId: unknown, decision: unknown): Promise<HubActResult>
  revokeGrant(grantId: unknown): Promise<HubActResult>
  revokeAgent(bindingId: unknown): Promise<HubActResult>
  disconnectAgent(agentId: unknown): Promise<ActAnswer>
  letAgentIn(agentId: unknown): Promise<ActAnswer>
  clearDenial(requestId: unknown): Promise<HubActResult>
  connect(product: unknown, opts?: { reconnect?: unknown }): Promise<HubActResult>
  disconnect(product: unknown): Promise<HubActResult>
}

/** The names the operator door serves this group under, in the order of `FabricApi['hub']`. */
export const HUB_DOOR_NAMES = ['hub.overview', 'hub.decide', 'hub.revokeGrant', 'hub.revokeAgent', 'hub.disconnectAgent', 'hub.letAgentIn', 'hub.clearDenial', 'hub.connect', 'hub.disconnect'] as const

export function createHubDoors(d: HubDoorsDeps): HubDoors {
  const ready = (): BoardHub => {
    const h = d.hub()
    if (!h) throw new Error('agent access is not ready yet')
    return h
  }
  /** The product's connect flow, by name; a product without one is a code, not a sentence. */
  const beginConnect = async (h: BoardHub, product: string, reconnect = false): Promise<ConnectAnswer> => {
    if (product !== FABRIC_INBOX.product) return { ok: false, problem: { code: 'no-flow' }, reason: `${product} has no connect flow` }
    const r = await h.connector.begin(FABRIC_INBOX, { reconnect })
    return r.ok ? { ok: true } : r
  }
  return {
    async overview() {
      const h = ready()
      const ov = await h.access.overview()
      const products: HubOverview['products'] = []
      const connected = new Map<string, boolean>()
      for (const product of CONNECTABLE_PRODUCTS) {
        const c = await h.accessStore.liveConnection(product)
        connected.set(product, c !== null)
        const last = h.connector.lastOutcome(product)
        products.push({
          product,
          name: productName(product),
          connection: c ? { server: c.server, level: c.level, connectedAt: c.connected_at, keyExpiresAt: c.key_expires_at } : null,
          lastAttempt: !last ? null
            : last.outcome === 'waiting' ? { outcome: 'waiting', at: last.since, reconnect: last.reconnect }
            : last.outcome === 'connected' ? { outcome: 'connected', at: last.at, reconnect: last.reconnect }
            : last.outcome === 'failed' ? { outcome: 'failed', at: last.at, problem: last.problem }
            : { outcome: 'denied', at: last.at }
        })
      }
      const home = (d.home ?? homedir)()
      // FACTS, never sentences (UX-2): the renderer phrases every line in the operator's language.
      return {
        hub: h.doorToken ? { listening: true, origin: d.origin() } : { listening: false, reason: h.down ?? 'the hub is not listening', code: h.downCode, fact: h.downFact },
        products,
        pending: ov.pending.map((r) => pendingFacts(r, connected.get(r.callee) ?? false, home)),
        agents: ov.bindings.map((b) => ({
          bindingId: b.id,
          agent: agentFacts(b.agent_id, b.registry),
          since: b.created_at,
          grants: b.grants.map((g) => ({ grantId: g.id, callee: g.callee, capability: g.capability, resource: g.resource, line: askLines({ capabilities: [g.capability], resources: [g.resource], registry: g.registry ?? b.registry })[0], expiresAt: g.expires_at }))
        })),
        denials: ov.denials.map((r) => ({ requestId: r.id, agent: agentFacts(r.agent_id, r.registry), callee: r.callee, ask: askLines(r), deniedAt: r.decided_at })),
        keptOut: { readable: d.keptOut.readable(), agents: d.keptOut.list() }
      }
    },
    async decide(requestId, decision) {
      const h = ready()
      if (decision !== 'allowed' && decision !== 'denied') return { ok: false, reason: 'a decision is allowed or denied' }
      const row = await h.accessStore.request(String(requestId))
      const done: HubActResult = await h.access.decide(String(requestId), decision, d.operator())
      // Fabric itself (ADR-0134, a coding agent's enrollment) is not a product: there is nothing to connect.
      if (done.ok && decision === 'allowed' && row && row.callee !== FABRIC_SELF && !(await h.accessStore.liveConnection(row.callee))) {
        // The Allow is recorded either way; a product that could not be opened is said beside it (UX-5).
        const started = await beginConnect(h, row.callee)
        if (!started.ok) return { ok: true, connect: { problem: started.problem } }
      }
      return done
    },
    async revokeGrant(grantId) {
      d.personEnded.markGrant(String(grantId))
      return ready().access.revokeGrant(String(grantId), d.operator())
    },
    async revokeAgent(bindingId) {
      const h = ready()
      // The agent's name, read before the revocation, so История can say which agent it was (CO-353): the name its
      // request was registered under, else the catalogue's, else its id; an unreadable binding leaves the act unnamed.
      const named = await (async (): Promise<string | null> => {
        try {
          const b = await h.accessStore.binding(String(bindingId))
          if (!b) return null
          const asked = await h.accessStore.request(b.request_id)
          return asked?.registry?.name ?? AGENTS.find((a) => a.id === b.agent_id)?.label ?? b.agent_id
        } catch (e) {
          d.ops.failed('hub.access.revoke-name-unreadable', e, { binding_id: String(bindingId) })
          return null
        }
      })()
      d.personEnded.markBinding(String(bindingId)) // PL-1 run two, UX-1: the person revoked it; its tasks are not continued
      const done = await h.access.revokeBinding(String(bindingId), d.operator())
      // The credential is gone and cannot be revived: the agent asks again and gets a new one (ADR-0160 §2: said, not hidden).
      if (done.ok) await d.acts().note({ kind: 'agent.disconnect', projectId: null, subject: { type: 'agent', id: String(bindingId), label: named },
        said: { key: 'act.agent.disconnect', params: { agent: named } }, inverse: null, whyNot: 'credential_gone' })
      return done
    },
    async disconnectAgent(agentId) {
      return answerOf(await d.acts().perform('agent.disconnect', { agent_id: typeof agentId === 'string' ? agentId : '' }))
    },
    async letAgentIn(agentId) {
      return answerOf(await d.acts().perform('agent.let_in', { agent_id: typeof agentId === 'string' ? agentId : '' }))
    },
    async clearDenial(requestId) {
      return ready().access.clearDenial(String(requestId), d.operator())
    },
    async connect(product, opts) {
      // Replacing a live connection's key is the operator's explicit Reconnect, never a side effect of Connect.
      return beginConnect(ready(), String(product), opts?.reconnect === true)
    },
    async disconnect(product) {
      return ready().connector.disconnect(String(product))
    }
  }
}

/**
 * The group as the operator door serves it: a call's `args` are the positional arguments the window's door takes
 * (`callOperatorDoor(root, 'hub.decide', [requestId, 'allowed'])`). Anything but an array is refused before a door
 * runs, since a door reading `undefined` for every argument would answer as if the person had asked for nothing.
 */
export function hubDoorTable(doors: HubDoors): ReadonlyMap<(typeof HUB_DOOR_NAMES)[number], OperatorDoorHandler> {
  const positional = (args: unknown): unknown[] => {
    if (!Array.isArray(args)) throw new Error('a hub door takes its arguments as a list')
    return args
  }
  const reconnect = (v: unknown): { reconnect?: unknown } | undefined =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? { reconnect: (v as { reconnect?: unknown }).reconnect } : undefined
  return new Map<(typeof HUB_DOOR_NAMES)[number], OperatorDoorHandler>([
    ['hub.overview', (a) => (positional(a), doors.overview())],
    ['hub.decide', (a) => { const [id, decision] = positional(a); return doors.decide(id, decision) }],
    ['hub.revokeGrant', (a) => doors.revokeGrant(positional(a)[0])],
    ['hub.revokeAgent', (a) => doors.revokeAgent(positional(a)[0])],
    ['hub.disconnectAgent', (a) => doors.disconnectAgent(positional(a)[0])],
    ['hub.letAgentIn', (a) => doors.letAgentIn(positional(a)[0])],
    ['hub.clearDenial', (a) => doors.clearDenial(positional(a)[0])],
    ['hub.connect', (a) => { const [product, opts] = positional(a); return doors.connect(product, reconnect(opts)) }],
    ['hub.disconnect', (a) => doors.disconnect(positional(a)[0])]
  ])
}
// #endregion hub-doors
