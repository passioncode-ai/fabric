// #region kept-out — docs: docs/ux/scenarios.md#scn-167-a-coding-agent-opened-outside-fabric-is-let-in-and-the-person-disconnects-it-with-one-press
/**
 * «Отключить» and «Пустить снова» (ADR-0160 §3, SCN-167; 0.3.7 wave 3). A coding agent is let in at once (ADR-0164's
 * admission); disconnecting it revokes every credential it holds (its consoles end through the revocation listeners)
 * AND keeps it out of every project until the person lets it back in. The hub reads `has` before any admission write
 * (`accessService.ts`, `keptOut`). The two are one pair of acts, each the other's inverse, recorded with the person as
 * actor (`acts.ts`) — so the wave-2 refusal `credential_gone` on a disconnect became a real undo.
 *
 * A file that cannot be read keeps NO agent out (fail-open) and says so through `readable()`; the acts that put an
 * agent here stay in История, so the person can see and repeat them. Failing closed would lock every coding agent
 * out of every project over one damaged file on the person's own machine.
 */
import type { ActArgs, ActOutcome } from '../shared/acts.ts'
import type { KeptOutFile } from '../shared/keptOut.ts'
import type { LocalRead } from './localStore.ts'
import type { ActCheck, ActExecutor } from './acts.ts'

export interface KeptOutStore {
  read(): LocalRead<KeptOutFile>
  update(change: (current: KeptOutFile) => KeptOutFile): { status: string }
}

export interface KeptOut {
  has(agentId: string): boolean
  readable(): boolean
  list(): Array<{ agentId: string; name: string | null; at: string }>
  add(agentId: string, name: string | null): void
  remove(agentId: string): void
}

const usable = (r: LocalRead<KeptOutFile>): boolean => r.status === 'ready' || r.status === 'default_missing' || r.status === 'recovered'

export function createKeptOut(store: KeptOutStore, now: () => string = () => new Date().toISOString()): KeptOut {
  const value = (): KeptOutFile => { const r = store.read(); return usable(r) ? r.value : {} }
  const write = (change: (c: KeptOutFile) => KeptOutFile, what: string): void => {
    const w = store.update(change)
    if (w.status !== 'committed') throw new Error(`the list of disconnected agents could not be written (${what}: ${w.status})`)
  }
  return {
    has: (agentId) => Object.prototype.hasOwnProperty.call(value(), agentId),
    readable: () => usable(store.read()),
    list: () => Object.entries(value()).map(([agentId, e]) => ({ agentId, name: e.name, at: e.at })).sort((a, b) => b.at.localeCompare(a.at)),
    add: (agentId, name) => write((c) => ({ ...c, [agentId]: { name, at: now() } }), 'add'),
    remove: (agentId) => write((c) => { const next = { ...c }; delete next[agentId]; return next }, 'remove')
  }
}

export interface AgentActDeps {
  keptOut: KeptOut
  /** The live credentials (bindings) this agent holds now. */
  liveBindingsOf(agentId: string): Promise<string[]>
  /** Revoke one: its sessions end, its next call is refused (`accessService.ts#revokeBinding`). */
  revoke(bindingId: string): Promise<{ ok: boolean; reason?: string }>
  /** The agent's name as the person reads it («Codex»), never its key. */
  nameOf(agentId: string): string | null
}

const idOf = (args: ActArgs): string | null => (typeof args.agent_id === 'string' && args.agent_id ? args.agent_id : null)

export function createAgentExecutors(d: AgentActDeps): { 'agent.disconnect': ActExecutor; 'agent.let_in': ActExecutor } {
  const outcome = (kind: 'agent.disconnect' | 'agent.let_in', agentId: string): ActOutcome => {
    const name = d.nameOf(agentId)
    return {
      kind, projectId: null,
      subject: { type: 'agent', id: agentId, label: name },
      said: { key: kind === 'agent.disconnect' ? 'act.agent.disconnect' : 'act.agent.let_in', params: { agent: name } },
      inverse: { kind: kind === 'agent.disconnect' ? 'agent.let_in' : 'agent.disconnect', args: { agent_id: agentId } }
    }
  }
  return {
    'agent.disconnect': {
      async check(args): Promise<ActCheck> {
        const id = idOf(args)
        if (!id) return { ok: false, why: 'invalid' }
        return d.keptOut.has(id) ? { ok: false, why: 'already_out' } : { ok: true }
      },
      async run(args) {
        const id = idOf(args) as string
        // Kept out FIRST, so a call racing the revocation is refused at the door rather than enrolled again.
        d.keptOut.add(id, d.nameOf(id))
        const failed: string[] = []
        for (const b of await d.liveBindingsOf(id)) {
          const r = await d.revoke(b)
          if (!r.ok && r.reason !== 'not-live') failed.push(r.reason ?? 'refused')
        }
        // Nothing half-revoked is called done (SCN-167 errors): the act fails, the agent stays out, and the person
        // can press again; the credentials revoked so far stay revoked.
        if (failed.length) throw new Error(`some of its access could not be revoked: ${failed.join(', ')}`)
        return outcome('agent.disconnect', id)
      }
    },
    'agent.let_in': {
      async check(args): Promise<ActCheck> {
        const id = idOf(args)
        if (!id) return { ok: false, why: 'invalid' }
        return d.keptOut.has(id) ? { ok: true } : { ok: false, why: 'already_in' }
      },
      async run(args) {
        const id = idOf(args) as string
        d.keptOut.remove(id)
        return outcome('agent.let_in', id)
      }
    }
  }
}
// #endregion kept-out
