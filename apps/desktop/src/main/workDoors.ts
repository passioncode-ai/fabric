// #region work-doors — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * ADR-0195 W2c.2b, the second group: the twelve work doors of the window (`FabricApi['work']`) as plain functions
 * over what the process that serves them holds (its stores, its sessions, its sweep, History's acts). The window's
 * IPC doors call them (`index.ts`, region `work-ipc`), and `workDoorTable` names the same functions for the board's
 * operator door (`operatorDoor.ts#startOperatorDoor`), so the window and a board process answer alike. Nothing here
 * imports Electron; every answer is the one `index.ts` gave before the move.
 */
import { randomUUID } from 'node:crypto'
import { OVERLAP_CHOICES, overlapPair, type OverlapChoice } from '../shared/abandonedSweep.ts'
import { launchOverlap } from '../shared/launchOverlap.ts'
import { linkOutcome, linkRefusal } from '../shared/taskLinks.ts'
import type { FabricApi } from '../shared/types.ts'
import type { createActs } from './acts.ts'
import type { OperatorDoorHandler } from './operatorDoor.ts'
import { readProjectSources } from './projectRequests.ts'
import type { createScopedStore } from './scopedStore.ts'
import { readProjectWork, readSessionTasks, readTaskBoard, readWhereWork, readWork, type HeldSession, type SessionSign } from './workRead.ts'

type Store = ReturnType<typeof createScopedStore>
type Work = FabricApi['work']
type Answer<K extends keyof Work> = Awaited<ReturnType<Work[K]>>
type Operator = { kind: 'person'; id: string }

const UUID = /^[0-9a-f-]{36}$/

export interface WorkDoorsDeps {
  /** The estate's store of the process that serves the doors. */
  store(): Store
  /** One project's store: a project's reading never sees another project's rows. */
  projectStore(projectId: string): Store
  /** A database function by name (`link_tasks`), with the caller's own client. */
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
  /** The journal: the person's decision on an overlap is a note on both tasks. */
  journal(): { append(event: { estateId: string; type: 'task.note.added@1'; actor: Operator; projectId: string; payload: Record<string, unknown> }): Promise<unknown> }
  estateId: string
  /** The person, as the actor of every decision made through these doors. */
  operator(): Operator
  /** A claim's session as the screens read it (`index.ts#sessionSignOf`). */
  sessionSign: SessionSign
  /** Every session the screens show, of one project or of all (`index.ts#heldSessions`). */
  heldSessions(projectId?: string): HeldSession[]
  /** agent-sync's lease refs of one project's repository (`projectReads.ts`). */
  leaseRefs(projectId: string): ReturnType<Parameters<typeof readProjectWork>[1]['leases']>
  /** Whether the serving process can open that session's console. */
  consoleOpen(sessionId: string): boolean
  /** The sweep of abandoned work once it runs (`boardState.ts`); null before. */
  sweep(): { decideOverlap(pairKey: string, choice: OverlapChoice): void; say(sessionId: string, text: string): { id: string }; messages(sessionId: string): Answer<'messages'> } | null
  /** The home's reading, shared between its readers by the process that serves it (`sharedReading.ts`). */
  home(): Promise<Answer<'home'>>
  /** The machine's coding agents and their versions, kept by the serving process. */
  executors: NonNullable<NonNullable<Parameters<typeof readSessionTasks>[2]>['executors']>
  /** «Ритм работы», kept by the serving process (`workRhythm.ts#createRhythmReader`). */
  rhythm(now: number): Promise<Answer<'rhythm'>>
  /** History's acts: a claim the person ends is an act with its inverse. */
  acts(): Pick<ReturnType<typeof createActs>, 'perform'>
  now?: () => number
}

export interface WorkDoors {
  project(projectId: unknown): Promise<Answer<'project'>>
  estate(): Promise<Answer<'estate'>>
  launchCheck(input: unknown): Promise<Answer<'launchCheck'>>
  overlapDecide(input: unknown): Promise<Answer<'overlapDecide'>>
  say(input: unknown): Promise<Answer<'say'>>
  messages(sessionId: unknown): Promise<Answer<'messages'>>
  home(): Promise<Answer<'home'>>
  board(projectId?: unknown, doneLimit?: unknown): Promise<Answer<'board'>>
  session(sessionId: unknown, aliases?: unknown): Promise<Answer<'session'>>
  sources(projectId: unknown): Promise<Answer<'sources'>>
  rhythm(): Promise<Answer<'rhythm'>>
  release(claimId: unknown): Promise<Answer<'release'>>
}

/** The names the operator door serves this group under, in the order of the window's doors. */
export const WORK_DOOR_NAMES = ['work.project', 'work.estate', 'work.launchCheck', 'work.overlapDecide', 'work.say', 'work.messages', 'work.home', 'work.board', 'work.session', 'work.sources', 'work.rhythm', 'work.release'] as const

export function createWorkDoors(d: WorkDoorsDeps): WorkDoors {
  const now = (): number => (d.now ?? Date.now)()
  const field = (input: unknown, key: string): unknown =>
    input !== null && typeof input === 'object' ? (input as Record<string, unknown>)[key] : undefined
  return {
    async project(projectId) {
      const id = String(projectId)
      return readProjectWork(d.projectStore(id), { now: now(), session: d.sessionSign, sessions: d.heldSessions(id), leases: () => d.leaseRefs(id) })
    },
    async estate() {
      return readWhereWork(d.store(), { now: now(), session: d.sessionSign, sessions: d.heldSessions() })
    },
    // CO-522 wave A: the live claims a new start would run into, read as fabric_work_claim reads them (`readWork`).
    async launchCheck(input) {
      const store = d.store()
      const rawTask = field(input, 'taskId')
      const projectId = String(field(input, 'projectId') ?? ''), taskId = typeof rawTask === 'string' && rawTask ? rawTask : null
      const snap = await readWork(store, { now: now(), session: d.sessionSign, projectId })
      const sources = new Map(snap.claims.filter((c) => c.source).map((c) => [c.work_id, c.source!]))
      const ids = [...new Set([...(taskId ? [taskId] : []), ...snap.claims.map((c) => c.work_id)])]
      const [from, to] = await Promise.all([
        store.selectIn('task_links', 'task_id,rel,target_id,target_kind', 'task_id', ids),
        store.selectIn('task_links', 'task_id,rel,target_id,target_kind', 'target_id', ids)
      ])
      if (from.failed || to.failed) throw new Error(`the task links could not be read: ${from.failed ?? to.failed}`)
      const edges = [...from.rows, ...to.rows].filter((e) => e.target_kind === 'task')
        .map((e) => ({ task_id: String(e.task_id), rel: String(e.rel), target_id: String(e.target_id) }))
      if (taskId && !sources.has(taskId)) {
        const own = await store.select('task_sources', 'task_id,repository,repo_path,path,row_id').eq('task_id', taskId).maybeSingle()
        if (own.data) sources.set(taskId, own.data as never)
      }
      const found = launchOverlap({ taskId, text: String(field(input, 'text') ?? '') }, snap.claims, sources, edges)
      const console = [...found.overlaps, ...found.alsoWorking].map((h) => h.heldBy).filter((s) => d.consoleOpen(s))
      return { ...found, console: [...new Set(console)] }
    },
    // CO-522 wave B part 2: the person decides two sessions that overlap. Both tasks get the decision as the person's
    // note; «The other waits» links the later task after the first (`link_tasks`, follows); the sweep tells both sessions.
    async overlapDecide(input) {
      const m = /^overlap-unsettled:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(String(field(input, 'key') ?? ''))
      const choice = String(field(input, 'choice') ?? '') as OverlapChoice
      if (!m || !OVERLAP_CHOICES.includes(choice)) return { ok: false, reason: 'unknown overlap or choice' }
      const { data: rows, error } = await d.store().select('work_claims', 'id,work_id,project_id,owner_session,claimed_at,released_at').in('id', [m[1]!, m[2]!])
      if (error) return { ok: false, reason: `the claims could not be read: ${error.message}` }
      const claims = (rows ?? []) as Array<{ id: string; work_id: string; project_id: string; owner_session: string; claimed_at: string; released_at: string | null }>
      if (claims.length !== 2 || claims.some((c) => c.released_at)) return { ok: false, reason: 'one of the two sessions no longer holds its task' }
      const [first, second] = [...claims].sort((a, b) => Date.parse(a.claimed_at) - Date.parse(b.claimed_at) || (a.id < b.id ? -1 : 1)) as [typeof claims[0], typeof claims[0]]
      const actor = d.operator()
      if (choice === 'wait') {
        const { data: link, error: linkError } = await d.rpc('link_tasks', { p_estate_id: d.estateId, p_task_id: second.work_id, p_rel: 'follows',
          p_target_id: first.work_id, p_actor: actor, p_project_id: second.project_id })
        const verdict = linkOutcome(link, linkError)
        if (!verdict.linked) return { ok: false, reason: linkRefusal(verdict) || 'the tasks could not be linked' }
      }
      const said = choice === 'wait' ? `Decided: this task waits for task ${first.work_id} (session ${first.owner_session}), which goes first.`
        : choice === 'handover' ? `Decided: session ${second.owner_session} hands its task to session ${first.owner_session}.`
          : 'Decided: both sessions go on, each keeping to its own paths.'
      for (const c of [first, second])
        await d.journal().append({ estateId: d.estateId, type: 'task.note.added@1', actor, projectId: c.project_id,
          payload: { task_id: c.work_id, note_id: randomUUID(), body_md: `${said} (overlap of sessions ${first.owner_session} and ${second.owner_session})` } })
      d.sweep()?.decideOverlap(overlapPair(first.id, second.id), choice)
      return { ok: true }
    },
    // CO-522 wave C: the person's words to a running session, through the queue its fabric-mcp reads (never typed into
    // a terminal, where a line's Enter could answer a waiting permission prompt).
    async say(input) {
      const sessionId = String(field(input, 'sessionId') ?? '').trim(), text = String(field(input, 'text') ?? '').trim().slice(0, 4000)
      if (!sessionId || !text) return { ok: false, reason: 'say what the agent should read' }
      const sweeper = d.sweep()
      if (!sweeper) return { ok: false, reason: 'Fabric is still starting; try again in a moment' }
      return { ok: true, ...sweeper.say(sessionId, text) }
    },
    async messages(sessionId) {
      return d.sweep()?.messages(String(sessionId ?? '')) ?? []
    },
    home() {
      return d.home()
    },
    async board(projectId, doneLimit) {
      return readTaskBoard(d.store(), {
        now: now(), session: d.sessionSign, sessions: d.heldSessions(), projectId: typeof projectId === 'string' && UUID.test(projectId) ? projectId : null,
        // «Готово» pages by 20 up to 500 (0.3.14); anything else reads the first page.
        doneLimit: typeof doneLimit === 'number' && Number.isInteger(doneLimit) ? Math.min(500, Math.max(20, doneLimit)) : 20
      })
    },
    // 0.3.14: one agent's tasks for its page, newest first; a failed read rejects (`workRead.ts#readSessionTasks`).
    async session(sessionId, aliases) {
      return readSessionTasks(d.store(), sessionId, { runner: typeof sessionId === 'string' ? d.heldSessions().find((s) => s.sessionId === sessionId)?.agent ?? null : null, executors: d.executors, aliases })
    },
    // SCN-181 (CO-543): one project's backlog rows for «Из бэклога»; a failed read rejects (`projectRequests.ts`).
    sources(projectId) {
      return readProjectSources(d.store() as never, projectId)
    },
    async rhythm() {
      return d.rhythm(now())
    },
    async release(claimId) {
      if (typeof claimId !== 'string' || !UUID.test(claimId)) return { released: false, reason: 'not-found' }
      // One press, no question (ADR-0160 §1); the act is recorded with «take it again» as its inverse.
      const r = await d.acts().perform('claim.release', { claim_id: claimId })
      if (r.ok) return { released: true, claimId }
      return { released: false, reason: r.reason === 'claim_gone' ? 'not-found' : r.reason === 'already_released' ? 'already-released' : 'unconfirmed' }
    }
  }
}

/**
 * The group as the operator door serves it: a call's `args` are the positional arguments the window's door takes
 * (`callOperatorDoor(root, 'work.board', [projectId, 40])`). Anything but an array is refused before a door runs,
 * since a door reading `undefined` for every argument would answer as if the person had asked for nothing.
 */
export function workDoorTable(doors: WorkDoors): ReadonlyMap<(typeof WORK_DOOR_NAMES)[number], OperatorDoorHandler> {
  const positional = (args: unknown): unknown[] => {
    if (!Array.isArray(args)) throw new Error('a work door takes its arguments as a list')
    return args
  }
  return new Map<(typeof WORK_DOOR_NAMES)[number], OperatorDoorHandler>([
    ['work.project', (a) => doors.project(positional(a)[0])],
    ['work.estate', (a) => (positional(a), doors.estate())],
    ['work.launchCheck', (a) => doors.launchCheck(positional(a)[0])],
    ['work.overlapDecide', (a) => doors.overlapDecide(positional(a)[0])],
    ['work.say', (a) => doors.say(positional(a)[0])],
    ['work.messages', (a) => doors.messages(positional(a)[0])],
    ['work.home', (a) => (positional(a), doors.home())],
    ['work.board', (a) => { const [projectId, doneLimit] = positional(a); return doors.board(projectId, doneLimit) }],
    ['work.session', (a) => { const [sessionId, aliases] = positional(a); return doors.session(sessionId, aliases) }],
    ['work.sources', (a) => doors.sources(positional(a)[0])],
    ['work.rhythm', (a) => (positional(a), doors.rhythm())],
    ['work.release', (a) => doors.release(positional(a)[0])]
  ])
}
// #endregion work-doors
