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
import { projectDisplayName, type DisplayNames } from './projectDisplayName.ts'

/** Whether an agent keeps its row in «В работе» once the connected fold out (the mockup parity, home gap D3): it is at
 *  work, or it holds a task and has gone quiet (the mockup's «молчит 14 мин»: its task is still its own, never «a task
 *  without an agent»). A reading that did not judge work keeps every agent. */
export function onWorkRow(a: Pick<LiveAgent, 'atWork' | 'stale' | 'task'>): boolean {
  return a.atWork === undefined || a.atWork || (a.stale && !!a.task)
}

export interface InWorkProjectInput {
  id: string
  name: string
  /** The name screens print, resolved by main (`ProjectRow.displayName`); absent: the slug, or `names`. */
  displayName?: string | null
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
  /** The newest WORK signal of the card (home gap D4: never a keep-alive ping): an agent's `workAt`, a task's time.
   *  Null when none is known. The cards are ordered by it when the agents carry it. */
  workAt: string | null
}

export interface InWorkGroups {
  cards: InWorkCard[]
  quiet: Array<{ id: string; name: string }>
  projectsAtWork: number
  agentsAtWork: number
  /** Of them, the quiet ones (stale): the strip's «агентов работает» counts the others (UX-21). */
  agentsQuiet: number
  /** With `atWorkOnly` (home gap D3): the agents connected but not at work, folded out of the cards into one line.
   *  Without it: those among `live` judged not at work, still on the cards. */
  connectedIdle: number
}

const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}
const heard = (a: LiveAgent): string => a.lastSignAt ?? a.startedAt
/** Whether the reading judged the agents at work (`agentWork.ts`): an older reader did not. */
const judged = (live: readonly LiveAgent[]): boolean => live.some((a) => a.atWork !== undefined)

export function groupInWork(input: {
  live: readonly LiveAgent[]
  inWork: readonly WorkItem[]
  projects: readonly InWorkProjectInput[]
  locale: string
  /** The goals could not be read: no card takes its aim from the plan as if it were current work (ER-20). */
  goalsUnread?: boolean
  /** Home gap D3: only agents at work make cards; the connected ones fold into `connectedIdle`. Needs a reading that
   *  judged them (`LiveAgent.atWork`); otherwise every agent makes its card as before. */
  atWorkOnly?: boolean
  /** Home gap D4: what waits on the person in each project, the order's second key after the newest work. */
  waitingByProject?: Readonly<Record<string, number>>
  /** Every project's display name (`HomeView.displayNames`): the cards and the quiet line print and sort by it. */
  names?: DisplayNames | null
}): InWorkGroups {
  const shown = (p: InWorkProjectInput): string => projectDisplayName(p, input.names)
  const active = input.projects.filter((p) => p.status !== 'archived')
  const byId = new Map(active.map((p) => [p.id, p]))
  const cards = new Map<string, InWorkCard>()
  const cardOf = (projectId: string | null, fallbackName: string | null): InWorkCard => {
    const key = projectId ?? '\u0000none'
    let c = cards.get(key)
    if (!c) {
      const p = projectId ? byId.get(projectId) : undefined
      const summary = (p?.summary ?? '').trim()
      c = { projectId, name: p ? shown(p) : fallbackName, summary: summary || null, aim: null, agents: [], orphans: [], inWork: 0, at: new Date(0).toISOString(), workAt: null }
      cards.set(key, c)
    }
    return c
  }
  const byWork = judged(input.live)
  const folding = !!input.atWorkOnly && byWork
  let connectedIdle = 0
  for (const a of input.live) {
    if (byWork && !a.atWork && !a.stale) connectedIdle++
    // A quiet agent that still holds its task keeps its row (`onWorkRow`); a connected one folds into one line.
    if (folding && !onWorkRow(a)) continue
    const c = cardOf(a.projectId, a.projectName)
    c.agents.push(a)
    if (time(heard(a)) > time(c.at)) c.at = heard(a)
    if (a.workAt && time(a.workAt) > time(c.workAt)) c.workAt = a.workAt
  }
  for (const w of input.inWork) {
    const c = cardOf(w.projectId, w.projectName)
    c.inWork++
    const held = c.agents.some((a) => a.sessionId === w.sessionId || a.task?.id === w.taskId)
    if (!held) c.orphans.push(w)
    if (time(w.since) > time(c.at)) c.at = w.since
    if (byWork && w.live && time(w.since) > time(c.workAt)) c.workAt = w.since
  }
  for (const c of cards.values()) {
    // D4: by the newest work, never by the keep-alive rotation, when the reading judged it.
    c.agents.sort(byWork
      ? (a, b) => Number(!!b.atWork) - Number(!!a.atWork) || time(b.workAt) - time(a.workAt) || String(a.agent ?? '').localeCompare(String(b.agent ?? '')) || (a.sessionId < b.sessionId ? -1 : 1)
      : (a, b) => time(heard(b)) - time(heard(a)) || (a.sessionId < b.sessionId ? -1 : 1))
    // UX-13: a goal is the card's aim only when an agent split it, or the person set it; a task that is its own root is
    // the agent's step, not the project's aim. ER-20: with the goals unread, the aim is unknown: the name alone.
    const goal = c.agents.map((a) => a.goal).find((g) => g && (!g.isTask || g.byPerson))
    const next = c.projectId ? (byId.get(c.projectId)?.plan?.next ?? []).map((n) => n.trim()).find(Boolean) : undefined
    c.aim = input.goalsUnread ? null : goal ? { text: goal.text, from: 'goal' } : next ? { text: next, from: 'plan' } : null
  }
  const collator = nameCollator(input.locale)
  const waiting = (c: InWorkCard): number => (c.projectId ? input.waitingByProject?.[c.projectId] ?? 0 : 0)
  const list = [...cards.values()].sort((a, b) => {
    if ((a.projectId === null) !== (b.projectId === null)) return a.projectId === null ? 1 : -1
    // D4: the newest work, then what waits on the person, then the name; an older reading by the newest sign.
    if (byWork) return time(b.workAt) - time(a.workAt) || waiting(b) - waiting(a) || collator.compare(String(a.name ?? ''), String(b.name ?? ''))
    return time(b.at) - time(a.at) || String(a.name ?? '').localeCompare(String(b.name ?? ''))
  })
  const quiet = active
    .filter((p) => !cards.has(p.id))
    .map((p) => ({ ...p, name: shown(p) }))
    .sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1))
    .map((p) => ({ id: p.id, name: p.name }))
  return {
    cards: list,
    quiet,
    projectsAtWork: list.filter((c) => c.projectId !== null).length,
    // D3: with the connected folded out, the agents on the cards: at work, and the quiet ones that still hold a task.
    agentsAtWork: folding ? input.live.filter(onWorkRow).length : input.live.length,
    // UX-21: how many of them are quiet, so the head says it beside the strip's «агентов работает», which counts the rest.
    agentsQuiet: input.live.filter((a) => a.stale && (!folding || onWorkRow(a))).length,
    connectedIdle
  }
}
// #endregion home-projects
