// #region home-projects — docs: docs/ux/2026-10-26-simple-fabric.md#2b-в-работе-grouped-by-project
/**
 * «В работе», grouped by project (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §2b): one card per
 * project that has an agent at work (`work.home`'s `live`, a quiet one included and marked) or a task in work
 * (`inWork`), ordered by its newest sign of life; in each card its agents, newest sign first, and the tasks in work that
 * no agent row of the project holds (a claim whose session is quiet or gone), as lines of their own. The projects with
 * nothing at work fold into one quiet line, alphabetically in the locale's collation; an archived project never shows.
 * An agent with no project keeps a card of its own at the end. Abandoned work is not here: the strip counts it. Pure:
 * everything comes from the home's one reading and the projects as read, so no new read is made.
 */
import type { LiveAgent, WorkItem } from './homeLive.ts'
import { nameCollator } from './railProjects.ts'

export interface InWorkProjectInput {
  id: string
  name: string
  status: 'active' | 'archived'
  /** The project profile's one line (`project.profiled@1`, migration 123); null when none was recorded. */
  summary?: string | null
  /** The profile's plan: its next steps name the aim when nothing runs (the operator's second review, R-1). */
  plan?: { done: string[]; next: string[] } | null
}

export interface InWorkCard {
  /** Null for the agents at work in no project. */
  projectId: string | null
  name: string | null
  summary: string | null
  /** What is being done there now (the operator's second review, 2026-10-26, v2 §4.1, R-1): the goal of its running
   *  work, newest sign first, else the profile's next planned step; null when neither is known (R-2: the name alone). */
  aim: { text: string; from: 'goal' | 'plan' } | null
  agents: LiveAgent[]
  /** Tasks in work no agent row of this card holds. */
  orphans: WorkItem[]
  /** Every task in work in the project. */
  inWork: number
  /** The newest sign of life of the card: an agent's, else a task's. */
  at: string
}

export interface InWorkGroups {
  cards: InWorkCard[]
  quiet: Array<{ id: string; name: string }>
  projectsAtWork: number
  agentsAtWork: number
}

const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}
const heard = (a: LiveAgent): string => a.lastSignAt ?? a.startedAt

export function groupInWork(input: {
  live: readonly LiveAgent[]
  inWork: readonly WorkItem[]
  projects: readonly InWorkProjectInput[]
  locale: string
}): InWorkGroups {
  const active = input.projects.filter((p) => p.status !== 'archived')
  const byId = new Map(active.map((p) => [p.id, p]))
  const cards = new Map<string, InWorkCard>()
  const cardOf = (projectId: string | null, fallbackName: string | null): InWorkCard => {
    const key = projectId ?? '\u0000none'
    let c = cards.get(key)
    if (!c) {
      const p = projectId ? byId.get(projectId) : undefined
      const summary = (p?.summary ?? '').trim()
      c = { projectId, name: p?.name ?? fallbackName, summary: summary || null, aim: null, agents: [], orphans: [], inWork: 0, at: new Date(0).toISOString() }
      cards.set(key, c)
    }
    return c
  }
  for (const a of input.live) {
    const c = cardOf(a.projectId, a.projectName)
    c.agents.push(a)
    if (time(heard(a)) > time(c.at)) c.at = heard(a)
  }
  for (const w of input.inWork) {
    const c = cardOf(w.projectId, w.projectName)
    c.inWork++
    const held = c.agents.some((a) => a.sessionId === w.sessionId || a.task?.id === w.taskId)
    if (!held) c.orphans.push(w)
    if (time(w.since) > time(c.at)) c.at = w.since
  }
  for (const c of cards.values()) {
    c.agents.sort((a, b) => time(heard(b)) - time(heard(a)) || (a.sessionId < b.sessionId ? -1 : 1))
    const goal = c.agents.find((a) => a.goal)?.goal
    const next = c.projectId ? (byId.get(c.projectId)?.plan?.next ?? []).map((n) => n.trim()).find(Boolean) : undefined
    c.aim = goal ? { text: goal.text, from: 'goal' } : next ? { text: next, from: 'plan' } : null
  }
  const list = [...cards.values()].sort((a, b) => {
    if ((a.projectId === null) !== (b.projectId === null)) return a.projectId === null ? 1 : -1
    return time(b.at) - time(a.at) || String(a.name ?? '').localeCompare(String(b.name ?? ''))
  })
  const collator = nameCollator(input.locale)
  const quiet = active
    .filter((p) => !cards.has(p.id))
    .sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1))
    .map((p) => ({ id: p.id, name: p.name }))
  return {
    cards: list,
    quiet,
    projectsAtWork: list.filter((c) => c.projectId !== null).length,
    agentsAtWork: input.live.length
  }
}
// #endregion home-projects
