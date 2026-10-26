// #region agent-roster — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * Агенты as an agents screen (CO-419, the operator 2026-10-24): one list of every agent on this computer, grouped by
 * state: «Работают сейчас», «Ждут вас», «Простаивают», «Отключены». Composed here from the reads that already exist,
 * with no new read: who works now (`work.home`), the consoles Fabric holds (`terminal.list`, with their state), the
 * coding agents that joined from a terminal and the ones the person disconnected (`hub.overview`), and the coding
 * agents installed on this machine (`start.executors`, plus Switchboard's catalogue for agents Fabric does not detect).
 *
 * One agent is one row: a session is listed once, by its session; an installed coding agent that also works now is its
 * session's row, not a second «свободен» row (SX-3: the same console in two lists with two states).
 *
 * Pure: nothing here reads, renders or knows the clock.
 */
import type { LiveAgent, Doing } from '../../../shared/homeLive'
import type { TerminalSession } from '../../../shared/types'
import type { ExecutorRow } from '../../../shared/startPaths'
import type { CatalogAgent } from '../../../shared/agentCatalog'
import { FABRIC_SELF, SESSION_ENROLL, type HubOverview } from '../../../shared/access.ts'

export const AGENT_GROUPS = ['working', 'waiting', 'idle', 'off'] as const
export type AgentGroup = (typeof AGENT_GROUPS)[number]

/**
 * What a row says it is, in one word the screen translates:
 * working (it signs and its console, if any, produces), waiting (Fabric's console has printed nothing for a minute:
 * observed silence, which may or may not be the agent waiting for the person; no runner reports that it waits, so the
 * screen says the silence and the possibility, never that it waits, 0.3.13 review, iteration 1, UX-3), quiet (it stopped signing: «давно не отзывался»), ended (its console ended and is still held), free (installed, no
 * session), joined (joined from a terminal, no session now), out (the person disconnected it), signin (installed, not
 * signed in), missing (not installed), unresponsive (installed, did not answer).
 */
export type AgentState = 'working' | 'waiting' | 'quiet' | 'ended' | 'free' | 'joined' | 'out' | 'signin' | 'missing' | 'unresponsive'

const GROUP_OF: Record<AgentState, AgentGroup> = {
  working: 'working',
  waiting: 'waiting',
  quiet: 'idle', ended: 'idle', free: 'idle', joined: 'idle',
  out: 'off', signin: 'off', missing: 'off', unresponsive: 'off'
}

export interface RosterRow {
  /** Stable across reads: `session:<id>` for a session, `joined:`, `out:`, `runner:` otherwise. The selection keys on it. */
  key: string
  group: AgentGroup
  state: AgentState
  /** The runner id (or a created agent's id) the screen names through `runnerLabel`. */
  runner: string | null
  /** A name the source gives (the hub's, Switchboard's), for an agent `runnerLabel` does not know. */
  name: string | null
  projectId: string | null
  projectName: string | null
  /** The other projects a joined agent may work in, by name. */
  projectNames: string[]
  sessionId: string | null
  /** Fabric holds a console for this session: the «Консоль» tab draws it. */
  console: boolean
  /** The `work.home` row, when the agent works now: the agent page reads its task, its stage and its history. */
  live: LiveAgent | null
  task: { id: string; summary: string } | null
  doing: Doing | null
  /** When it was last heard from (its last sign, its console's last output, when it joined); null when it never was. */
  heardAt: string | null
  /** A coding agent that joined from a terminal: «Отключить» and the proof line apply to it (SCN-167, SX-26). */
  joinedAgentId: string | null
  /** When the person disconnected it («Пустить снова»). */
  outSince: string | null
  version: string | null
  /** The vendor's install command, for an agent that is not installed. */
  install: string | null
}

export interface RosterInput {
  /** `work.home`'s agents; null while unread or unreadable. */
  live: readonly LiveAgent[] | null
  /** The consoles Fabric holds; null while unread. */
  sessions: readonly TerminalSession[] | null
  projects: ReadonlyArray<{ id: string; name: string }> | null
  executors: readonly ExecutorRow[] | null
  /** Switchboard's catalogue, when it answered. */
  catalog: readonly CatalogAgent[] | null
  hub: HubOverview | null
}

export type Roster = Record<AgentGroup, RosterRow[]>

/** The launch option of a plain login shell (`shared/agents.ts`, «Терминал»): a console, not an agent. Агенты lists
 *  agents, so a shell is left out: a shell at its prompt is not an agent waiting for the person (0.3.13 review,
 *  iteration 1, UX-3). Its console stays one press away along the top. */
export const PLAIN_SHELL = 'shell'

const blank = (over: Partial<RosterRow> & Pick<RosterRow, 'key' | 'state'>): RosterRow => ({
  group: GROUP_OF[over.state], runner: null, name: null, projectId: null, projectName: null, projectNames: [], sessionId: null,
  console: false, live: null, task: null, doing: null, heardAt: null, joinedAgentId: null, outSince: null, version: null,
  install: null, ...over
})

/** The coding agents that joined from a terminal (a grant to enroll into a project) and the projects each may work in. */
export function joinedAgents(hub: HubOverview | null): Map<string, { name: string | null; projectIds: string[]; since: string }> {
  const out = new Map<string, { name: string | null; projectIds: string[]; since: string }>()
  for (const a of hub?.agents ?? []) {
    const enrolled = a.grants.filter((g) => g.callee === FABRIC_SELF && g.capability === SESSION_ENROLL)
    if (enrolled.length === 0) continue
    const ids = enrolled.map((g) => (g.resource.startsWith('project:') ? g.resource.slice('project:'.length) : '')).filter(Boolean)
    const found = out.get(a.agent.agentId)
    if (found) {
      for (const id of ids) if (!found.projectIds.includes(id)) found.projectIds.push(id)
      if (a.since < found.since) found.since = a.since
    } else out.set(a.agent.agentId, { name: a.agent.name, projectIds: ids, since: a.since })
  }
  return out
}

export function composeRoster(input: RosterInput): Roster {
  const nameOf = (id: string | null): string | null => (id ? input.projects?.find((p) => p.id === id)?.name ?? null : null)
  const joined = joinedAgents(input.hub)
  const keptOut = new Set((input.hub?.keptOut?.agents ?? []).map((o) => o.agentId))
  const rows: RosterRow[] = []
  const seenSessions = new Set<string>()

  for (const l of input.live ?? []) {
    const held = input.sessions?.find((s) => s.sessionId === l.sessionId) ?? null
    seenSessions.add(l.sessionId)
    if (held?.optionId === PLAIN_SHELL || l.agent === PLAIN_SHELL) continue
    const state: AgentState = held?.state === 'ended' ? 'ended' : held?.state === 'idle' ? 'waiting' : l.stale ? 'quiet' : 'working'
    const joinedId = !l.console && l.agent && joined.has(l.agent) ? l.agent : null
    rows.push(blank({
      key: `session:${l.sessionId}`, state, runner: l.agent, projectId: l.projectId, projectName: l.projectName ?? nameOf(l.projectId),
      sessionId: l.sessionId, console: l.console || held !== null, live: l, task: l.task, doing: l.doing,
      // A quiet console is dated by its last output: «молчит 10 мин» counts the console's silence (UX-3).
      heardAt: state === 'waiting' && held ? held.lastActivityAt : (l.lastSignAt ?? l.startedAt), joinedAgentId: joinedId
    }))
  }
  // A console Fabric holds that `work.home` does not list (it ended, or the reading is out): its own row, never none.
  for (const s of input.sessions ?? []) {
    if (seenSessions.has(s.sessionId)) continue
    seenSessions.add(s.sessionId)
    if (s.optionId === PLAIN_SHELL) continue
    const state: AgentState = s.state === 'ended' ? 'ended' : s.state === 'idle' ? 'waiting' : 'working'
    rows.push(blank({
      key: `session:${s.sessionId}`, state, runner: s.optionId, projectId: s.projectId, projectName: nameOf(s.projectId),
      sessionId: s.sessionId, console: true, heardAt: s.lastActivityAt
    }))
  }
  const represented = (runner: string): boolean => rows.some((r) => r.runner === runner)
  // Joined from a terminal and not working now: still the person's to see and to disconnect (SCN-167).
  for (const [agentId, j] of joined) {
    if (keptOut.has(agentId) || rows.some((r) => r.joinedAgentId === agentId)) continue
    const names = j.projectIds.map((id) => nameOf(id)).filter((n): n is string => n !== null)
    rows.push(blank({
      key: `joined:${agentId}`, state: 'joined', runner: agentId, name: j.name, projectId: j.projectIds[0] ?? null,
      projectName: names[0] ?? null, projectNames: names, heardAt: j.since, joinedAgentId: agentId
    }))
  }
  for (const o of input.hub?.keptOut?.agents ?? []) {
    rows.push(blank({ key: `out:${o.agentId}`, state: 'out', runner: o.agentId, name: o.name, outSince: o.at, joinedAgentId: o.agentId }))
  }
  // Installed coding agents with no session (SX-20), and the ones that cannot start: not installed, not signed in,
  // not answering. An agent already on the list by its session or its disconnect is not listed again.
  for (const e of input.executors ?? []) {
    if (represented(e.id)) continue
    const state: AgentState = e.state === 'missing' ? 'missing' : e.state === 'unresponsive' ? 'unresponsive'
      : e.authentication?.state === 'not-authenticated' ? 'signin' : 'free'
    rows.push(blank({ key: `runner:${e.id}`, state, runner: e.id, name: e.label, version: e.version, install: state === 'missing' ? e.install : null }))
  }
  for (const c of input.catalog ?? []) {
    // Null is Switchboard not saying whether it is installed: that is not «не установлен» (0.3.6 review UX-8).
    if (represented(c.id) || c.installed === null) continue
    rows.push(blank({ key: `runner:${c.id}`, state: c.installed ? 'free' : 'missing', runner: c.id, name: c.name, install: c.installed ? null : c.install }))
  }

  const roster: Roster = { working: [], waiting: [], idle: [], off: [] }
  for (const r of rows) roster[r.group].push(r)
  const heard = (r: RosterRow): string => r.heardAt ?? ''
  const label = (r: RosterRow): string => (r.name ?? r.runner ?? '').toLowerCase()
  // Working: the freshest first. Waiting: the one that has waited longest first (`sessionOrder.ts`'s rule). Idle: what
  // was at work (quiet, ended, joined) before what is merely installed. Off: by name. Ties by key, so rows never swap.
  const byKey = (a: RosterRow, b: RosterRow): number => a.key.localeCompare(b.key)
  roster.working.sort((a, b) => heard(b).localeCompare(heard(a)) || byKey(a, b))
  roster.waiting.sort((a, b) => heard(a).localeCompare(heard(b)) || byKey(a, b))
  const idleRank = (r: RosterRow): number => (r.state === 'free' ? 1 : 0)
  roster.idle.sort((a, b) => idleRank(a) - idleRank(b) || heard(b).localeCompare(heard(a)) || label(a).localeCompare(label(b)) || byKey(a, b))
  roster.off.sort((a, b) => label(a).localeCompare(label(b)) || byKey(a, b))
  return roster
}

/** Every row of the roster, in the order the list shows them. */
export function rosterRows(r: Roster): RosterRow[] {
  return AGENT_GROUPS.flatMap((g) => r[g])
}
// #endregion agent-roster
