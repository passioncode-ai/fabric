// #region home-live — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#главная-scr-30
/**
 * The home screen's one reading of "who is doing what" (operator request 2026-10-14): every working session with what
 * it says it is doing now, the claimed and in-review tasks across projects, and each project's headline — composed
 * from projections only, with no model. Plain language comes from the agents themselves: the session's last
 * `fabric_stage_report` (its `stage`, then `note`), and a task's `brief_what`; a task's `instruction` is the prompt and
 * is never shown as its summary.
 */
import { specMissing } from './taskSpec.ts'
import type { WhereWorkView, WorkClaimView, WorkSessionView } from './workClaims.ts'

export interface StageRow {
  session_id: string
  project_id: string
  task_id: string | null
  stage: string
  step: number | null
  of_steps: number | null
  note: string | null
  reported_at: string
}

export interface TaskBrief {
  id: string
  project_id: string
  title: string | null
  brief_what: string | null
  /** The brief's other two parts, where the read asked for them (ADR-0176 §1); absent is not read, never empty. */
  brief_why?: string | null
  brief_expected?: string | null
  status: string
  updated_at?: string | null
  /** The session a Fabric-launched task runs in, when it has one. */
  session_id?: string | null
}

/** What a session says it is doing, in its own words; null when it has said nothing. */
export interface Doing {
  text: string
  note: string | null
  step: number | null
  ofSteps: number | null
  at: string
}

export interface LiveAgent {
  sessionId: string
  projectId: string | null
  projectName: string | null
  agent: string | null
  console: boolean
  startedAt: string
  lastSignAt: string | null
  stale: boolean
  doing: Doing | null
  /** What it works on now (0.3.14): its newest live claim whose task is still running, else the running task Fabric
   *  launched in its session, else the task its newest stage report names. `summary` is empty for a task with no
   *  title or brief: the screens say «untitled», the task is never dropped. `projectId` is the task's own project. */
  task: {
    id: string
    projectId: string
    summary: string
    /** The task's own title and the brief's «what», apart (the mockup parity, agent gaps «Сейчас»): the screen heads with
     *  the title and puts the «what» under it. Null when the task has none. Absent from an older reader. */
    title?: string | null
    what?: string | null
    /** When the agent took it (home gap D9): the claim's time, else when Fabric launched it in this session, else the
     *  stage report that names it. Null when not known. */
    /** When its claim was taken; null for a task it was launched with or a stage report names, whose `updated_at` or
     *  report time moves with every edit (the 0.3.15 review, iteration 1, DA-2). */
    heldSince?: string | null
    /** It came from an earlier session id of the same coding-agent session (home gaps D5, D6; `agentIdentity.ts`):
     *  that agent restarted or re-enrolled, and it still works on this running task. */
    fromEarlierSession?: boolean
  } | null
  /** Its earlier Fabric session ids of the same coding-agent session (`agentIdentity.ts`): its turns under them count
   *  as its own (the 0.3.15 review, iteration 1, ER-5). */
  aliases?: string[]
  /** At work, not merely connected (home gaps D3, D4; `agentWork.ts`): it holds a task, or reported a stage, a working
   *  heartbeat or a turn within `AT_WORK_MS`, or its Fabric console printed within it. A keep-alive ping keeps an agent
   *  connected, never at work. Absent: not judged (an older reader). */
  atWork?: boolean
  /** Its newest WORK signal (claim, stage report, heartbeat, turn, console output), never a keep-alive ping; the home
   *  sorts by it. Null when none is known. */
  workAt?: string | null
  /** The git branch of the folder a console Fabric holds works in (0.3.14, the simple Fabric; `main/agentBranches.ts`).
   *  Absent or null: not known (a terminal-joined agent shares no folder, or git did not answer). */
  branch?: string | null
  /** Its goal (the operator's second review, R-3; `main/agentGoals.ts`): the root of its task's `spawned` links, else
   *  the task itself. Null: it holds no task, so no goal is named. Absent: not read. */
  goal?: { taskId: string; projectId: string; text: string; what: string | null; byPerson: boolean; isTask: boolean } | null
  /** Its newest heartbeat (`main/agentHeartbeats.ts`): the agent's own word, judged fresh or not by `sessionStatus`.
   *  Absent: none sent, or not read. */
  heartbeat?: { phase: string; at: string; waitingOn: string | null }
}

export interface WorkItem {
  taskId: string
  projectId: string
  projectName: string
  summary: string
  agent: string | null
  sessionId: string | null
  console: boolean
  since: string
  doing: Doing | null
  /** Someone is working on it now: a live claim, or a running session Fabric holds. A silent or lapsed claim is
   *  still listed — it is the record — but never as current work (0.3.6 review UX-2). */
  live: boolean
  /** ADR-0176 §1: the task's brief lacks a part (what, why, expected). Absent when the brief was not read. */
  specMissing?: boolean
}

export interface ReviewItem {
  taskId: string
  projectId: string
  projectName: string
  summary: string
  since: string | null
}

export interface ProjectPulse {
  projectId: string
  /** The agents' current work in plain language: a working session's stage, else a claimed task's summary. */
  now: { text: string; agent: string | null; at: string } | null
  live: number
  inWork: number
  review: number
  lastActivityAt: string | null
  /** Of `live`, the agents at work (home gap D3); absent: not judged. */
  atWork?: number
  /** The newest work signal of the project's agents (home gap D4); absent: not judged, null: none. */
  workAt?: string | null
}

export interface HomeView {
  live: LiveAgent[]
  inWork: WorkItem[]
  /** 0.3.14: tasks in work with no live claim and no live session, newest first; not in `inWork` and not counted
   *  there. Absent from an older reader. */
  abandoned?: WorkItem[]
  review: ReviewItem[]
  /** Finished tasks, newest first (the operator's walk OF-18: «В работе» and «Закончили»). */
  done: ReviewItem[]
  /** The finished read stopped at its limit. */
  doneCapped?: boolean
  /** The finished tasks could not be read: said in «Закончили», never as none (0.3.11 review ER-7). */
  doneUnread?: string
  /** The review read stopped at its limit: the count is a floor, said as «50+» (0.3.6 review UX-4, ER-5). */
  reviewCapped?: boolean
  /** The read of Fabric-launched running tasks stopped at its limit. */
  inWorkCapped?: boolean
  /** The reads behind «who is doing what» that stopped at their limit (CO-310): claims, leases, projects, the agents'
   *  stage reports. Past them an agent can read as silent or a project as missing; the screens say so. */
  capped?: Array<'claims' | 'leases' | 'projects' | 'stages'>
  projects: ProjectPulse[]
  readAt: string
  /** 0.3.14, the simple Fabric: the tasks in review moved there more than three days ago (all of them, not only the newest
   *  50 the list holds); absent from an older reader. */
  reviewOld?: number
  /** The read behind `reviewOld` stopped at the gateway's 1 000 rows: the count is a floor, said «N+». */
  reviewOldCapped?: boolean
  /** «Сдано сегодня» (`main/homeStrip.ts`): the count, or why it could not be read. Absent from an older reader. */
  handedIn?: { today: number; capped: boolean } | { unread: string }
  /** «Работают без задачи»: the latest sweep's sessions changing files with no claim; null while it is not known. */
  unclaimed?: number | null
  /** Those sessions, so the number opens where it is counted (the 0.3.14 review, iteration 2, UX-16). */
  unclaimedSessions?: string[]
  /** The goals could not be read (`main/agentGoals.ts`): every agent's goal is unknown, never «not named». */
  goalsUnread?: string
  /** Agents at work apart from those merely connected (home gaps D3, D7; `agentWork.ts`). `noTask` is «работают без
   *  задачи»: at work, holding no task. Absent: not judged. */
  atWork?: { agents: number; connectedIdle: number; noTask: number; noTaskSessions: string[]; turnsUnread?: boolean }
  /** The earlier session ids of re-enrolled agents could not be read (`main/agentIdentity.ts`): each agent shows only what
   *  its current id holds, said on the home's «работают» number (the 0.3.15 review, iteration 2, ER-7). */
  identityUnread?: boolean
  /** Every project's display name (`projectDisplayName.ts`), by project id. Absent: not resolved. */
  displayNames?: Record<string, import('./projectDisplayName.ts').ResolvedDisplayName>
}

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length ? t : null
}

/** ADR-0176 §1: `specMissing` for a task whose brief was read with all three parts' columns; nothing otherwise. */
export function specFlag(t: TaskBrief | undefined): { specMissing?: boolean } {
  if (!t || !('brief_why' in t) || !('brief_expected' in t)) return {}
  return { specMissing: specMissing(t) }
}

/** A task's summary: what the agent wrote it is for, else its title. Never the instruction (the prompt). */
export function taskSummary(t: Pick<TaskBrief, 'title' | 'brief_what'> | null | undefined, fallbackTitle?: string): string {
  return clean(t?.brief_what) ?? clean(t?.title) ?? clean(fallbackTitle) ?? ''
}

/** A task's title and the brief's «what», each cleaned, apart (the mockup parity: the title heads, the «what» explains). */
export function titleAndWhat(t: Pick<TaskBrief, 'title' | 'brief_what'> | null | undefined): { title: string | null; what: string | null } {
  return { title: clean(t?.title), what: clean(t?.brief_what) }
}

function doingOf(s: StageRow | undefined): Doing | null {
  const text = clean(s?.stage)
  if (!s || !text) return null
  return { text, note: clean(s.note), step: s.step, ofSteps: s.of_steps, at: s.reported_at }
}

export function composeHome(input: {
  where: WhereWorkView
  projects: ReadonlyArray<{ id: string; name: string }>
  stages: readonly StageRow[]
  briefs: readonly TaskBrief[]
  reviewTasks: readonly TaskBrief[]
  /** Tasks in work that no agent has claimed — those Fabric launched itself; claimed ones come from `where`. */
  runningTasks?: readonly TaskBrief[]
  /** Finished tasks, newest first; absent reads as none. */
  doneTasks?: readonly TaskBrief[]
  /** The limits the reads above were asked with; reaching one makes the count a floor. */
  limits?: { review?: number; running?: number; done?: number }
  /** Every task in review, by project — the list above holds only the newest `limits.review`, and a project's own count
   *  must not depend on whether its tasks are among them (0.3.6 review i2 ER-2). Absent: counted from the list. */
  reviewProjectIds?: readonly string[]
  activity: ReadonlyMap<string, string | null>
  now: string
}): HomeView {
  const names = new Map(input.projects.map((p) => [p.id, p.name]))
  const stageBySession = new Map<string, StageRow>()
  for (const s of input.stages) {
    const prev = stageBySession.get(s.session_id)
    if (!prev || prev.reported_at < s.reported_at) stageBySession.set(s.session_id, s)
  }
  /** The newest stage that names its task: a Fabric-launched task's words when its session is not the one held. */
  const stageByTask = new Map<string, StageRow>()
  const heldNow = new Set([...input.where.rows.flatMap((r) => r.sessions), ...input.where.unowned].filter((x) => !x.stale).map((x) => x.sessionId))
  for (const s of input.stages) {
    // Only a session still held and signing: an ended session's last stage is not what anyone is doing (DA-9).
    if (!s.task_id || !heldNow.has(s.session_id)) continue
    const prev = stageByTask.get(s.task_id)
    if (!prev || prev.reported_at < s.reported_at) stageByTask.set(s.task_id, s)
  }
  const briefById = new Map(input.briefs.map((b) => [b.id, b]))
  const sessions: WorkSessionView[] = [...input.where.rows.flatMap((r) => r.sessions), ...input.where.unowned]
  const claims: WorkClaimView[] = input.where.rows.flatMap((r) => r.claims)
  // 0.3.14: the NEWEST live claim whose task still runs. `readWork` orders claims oldest first, so taking the first
  // per session named the oldest; a lapsed or silent claim, or one whose task moved on, is not what it works on now.
  const claimBySession = new Map<string, WorkClaimView>()
  for (const c of claims) {
    if (c.life !== 'live' || (briefById.get(c.taskId)?.status ?? c.status) !== 'running') continue
    const prev = claimBySession.get(c.sessionId)
    if (!prev || prev.since < c.since) claimBySession.set(c.sessionId, c)
  }
  /** The running task Fabric launched in a session (`project_tasks.session_id`), newest first. */
  const launchedBySession = new Map<string, TaskBrief>()
  for (const t of input.runningTasks ?? []) {
    if (t.status !== 'running' || !t.session_id) continue
    const prev = launchedBySession.get(t.session_id)
    if (!prev || (prev.updated_at ?? '') < (t.updated_at ?? '')) launchedBySession.set(t.session_id, t)
  }
  /** The newest stage report of a session that names its task. */
  const namedStageBySession = new Map<string, StageRow>()
  for (const st of input.stages) {
    if (!st.task_id) continue
    const prev = namedStageBySession.get(st.session_id)
    if (!prev || prev.reported_at < st.reported_at) namedStageBySession.set(st.session_id, st)
  }
  const anyTask = new Map<string, TaskBrief>()
  for (const t of [...(input.doneTasks ?? []), ...input.reviewTasks, ...(input.runningTasks ?? []), ...input.briefs]) anyTask.set(t.id, t)
  const currentTask = (sessionId: string): LiveAgent['task'] => {
    const claim = claimBySession.get(sessionId)
    if (claim) {
      const b = briefById.get(claim.taskId)
      return { id: claim.taskId, projectId: claim.projectId, summary: taskSummary(b, claim.title), ...titleAndWhat(b), heldSince: claim.since }
    }
    const launched = launchedBySession.get(sessionId)
    if (launched) return { id: launched.id, projectId: launched.project_id, summary: taskSummary(launched), ...titleAndWhat(launched), heldSince: null }
    // The 0.3.14 review, iteration 1, DA-6, ER-11: a stage report names the current task only while that task is running.
    const named = namedStageBySession.get(sessionId)
    if (named?.task_id && anyTask.get(named.task_id)?.status === 'running') {
      const t = anyTask.get(named.task_id)
      return { id: named.task_id, projectId: named.project_id, summary: taskSummary(t), ...titleAndWhat(t), heldSince: null }
    }
    return null
  }

  const live: LiveAgent[] = sessions.map((s) => {
    return {
      sessionId: s.sessionId,
      projectId: s.projectId,
      projectName: s.projectId ? (names.get(s.projectId) ?? null) : null,
      agent: s.agent,
      console: s.console,
      startedAt: s.startedAt,
      lastSignAt: s.lastSignAt,
      stale: s.stale,
      doing: doingOf(stageBySession.get(s.sessionId)),
      task: currentTask(s.sessionId)
    }
  })
  // Working first (fresh before stale), newest sign first: who is doing something now leads.
  live.sort((a, b) => Number(a.stale) - Number(b.stale) || (b.lastSignAt ?? b.startedAt).localeCompare(a.lastSignAt ?? a.startedAt))

  // A claim outlives its task's move to review or done (moving does not release it), so only a task still in work is
  // in «В работе»; otherwise it showed in two columns and was counted twice (0.3.11 review, iteration 1, ER-3).
  const working = (taskId: string): boolean => { const s = briefById.get(taskId)?.status; return s !== 'review' && s !== 'done' && s !== 'cancelled' && s !== 'backlog' }
  const inWork: WorkItem[] = claims.filter((c) => working(c.taskId)).map((c) => ({
    taskId: c.taskId,
    projectId: c.projectId,
    projectName: names.get(c.projectId) ?? '',
    // Not the claim's title: where-work falls back to the instruction for a task with no title (i3 DA-1).
    summary: taskSummary(briefById.get(c.taskId)),
    agent: c.agent,
    sessionId: c.sessionId,
    console: c.console,
    since: c.since,
    doing: c.life === 'live' ? doingOf(stageBySession.get(c.sessionId)) : null,
    live: c.life === 'live',
    ...specFlag(briefById.get(c.taskId))
  }))
  const claimed = new Set(inWork.map((w) => w.taskId))
  const held = new Map(sessions.map((s) => [s.sessionId, s]))
  for (const t of input.runningTasks ?? []) {
    // A paused or archived project's task is not on the home: it would show with no project and a link to nowhere (i2 DA-4).
    if (t.status !== 'running' || claimed.has(t.id) || !names.has(t.project_id)) continue
    const s = t.session_id ? held.get(t.session_id) : undefined
    inWork.push({
      taskId: t.id,
      projectId: t.project_id,
      projectName: names.get(t.project_id) ?? '',
      summary: taskSummary(t),
      agent: s?.agent ?? null,
      sessionId: s ? s.sessionId : null,
      console: s?.console ?? false,
      since: t.updated_at ?? input.now,
      doing: s && !s.stale ? doingOf(stageBySession.get(s.sessionId) ?? stageByTask.get(t.id)) : doingOf(stageByTask.get(t.id)),
      live: (!!s && !s.stale) || stageByTask.has(t.id),
      ...specFlag(t)
    })
  }
  // Current work first, then the record of claims nobody is signing for.
  inWork.sort((a, b) => Number(b.live) - Number(a.live) || b.since.localeCompare(a.since))
  // 0.3.14: work with no live claim and no live session is abandoned. It leaves «В работе» for its own list, so the home
  // and the board count the same «В работе» (SCN-158) and neither counts dead work in it. A claim nobody signs for while
  // its session still signs stays: the agent is there.
  const sessionLive = (id: string | null): boolean => { const s = id ? held.get(id) : undefined; return !!s && !s.stale }
  const abandoned = inWork.filter((w) => !w.live && !sessionLive(w.sessionId))
  const current = inWork.filter((w) => w.live || sessionLive(w.sessionId))

  const review: ReviewItem[] = input.reviewTasks
    .filter((t) => t.status === 'review' && names.has(t.project_id))
    .map((t) => ({ taskId: t.id, projectId: t.project_id, projectName: names.get(t.project_id) ?? '', summary: taskSummary(t), since: t.updated_at ?? null }))

  const done: ReviewItem[] = (input.doneTasks ?? [])
    .filter((t) => t.status === 'done' && names.has(t.project_id))
    .map((t) => ({ taskId: t.id, projectId: t.project_id, projectName: names.get(t.project_id) ?? '', summary: taskSummary(t), since: t.updated_at ?? null }))
    .sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''))

  const projects: ProjectPulse[] = input.projects.map((p) => {
    const mine = live.filter((l) => l.projectId === p.id && !l.stale)
    const withDoing = mine.find((l) => l.doing)
    const work = inWork.filter((w) => w.projectId === p.id && w.live)
    const now = withDoing?.doing
      ? { text: withDoing.doing.text, agent: withDoing.agent, at: withDoing.doing.at }
      : work[0]
        ? { text: work[0].summary, agent: work[0].agent, at: work[0].since }
        : null
    const signs = [input.activity.get(p.id) ?? null, ...mine.map((l) => l.lastSignAt), now?.at ?? null].filter((x): x is string => !!x).sort()
    return {
      projectId: p.id,
      now: now && now.text ? now : null,
      live: mine.length,
      inWork: work.length,
      review: input.reviewProjectIds ? input.reviewProjectIds.filter((id) => id === p.id).length : review.filter((r) => r.projectId === p.id).length,
      lastActivityAt: signs.at(-1) ?? null
    }
  })
  const reviewCapped = !!input.limits?.review && input.reviewTasks.length >= input.limits.review
  const inWorkCapped = !!input.limits?.running && (input.runningTasks?.length ?? 0) >= input.limits.running
  const doneCapped = !!input.limits?.done && (input.doneTasks?.length ?? 0) >= input.limits.done
  return { live, inWork: current, abandoned, review, done, projects, readAt: input.now, ...(reviewCapped ? { reviewCapped } : {}), ...(inWorkCapped ? { inWorkCapped } : {}), ...(doneCapped ? { doneCapped } : {}) }
}

/** Home order: favourites first in the operator's own order, then the rest by latest activity, newest first. */
export function orderProjects<T extends { id: string }>(projects: readonly T[], favourites: readonly string[], activity: (id: string) => string | null): T[] {
  const fav = new Map(favourites.map((id, i) => [id, i]))
  const pinned = projects.filter((p) => fav.has(p.id)).sort((a, b) => fav.get(a.id)! - fav.get(b.id)!)
  const rest = projects.filter((p) => !fav.has(p.id)).sort((a, b) => (activity(b.id) ?? '').localeCompare(activity(a.id) ?? ''))
  return [...pinned, ...rest]
}
// #endregion home-live
