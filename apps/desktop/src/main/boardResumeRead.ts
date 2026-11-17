// #region board-resume-read — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#311-left-work-is-continued-the-board-supervisor
/**
 * The board supervisor's reads (`shared/boardResume.ts`): the claims released in the last week that left work behind,
 * then for those tasks their newest claim, their column and who moved it, whether an open question to a person
 * names them, and (§3.12) the runtime session that left each one and the Observatory workflow its claim named. Bounded: at most `RELEASES_READ` releases a pass, the newest; a read at that bound is said as capped. A
 * read that fails throws: an unread board is never «nothing to continue».
 */
import { parseWait, RESUME_GRACE_MS, RESUME_HOWS, RESUME_WINDOW_MS, resumeStateOf, type ResumeCandidate, type Wait } from '../shared/boardResume.ts'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { createScopedStore } from './scopedStore.ts'

type Store = Pick<ReturnType<typeof createScopedStore>, 'select' | 'selectIn'>

/** The releases one pass reads, the newest first; past it the oldest wait for a later pass. */
export const RELEASES_READ = 500
/** Tasks per request of the chunked reads (`scopedStore.ts#selectIn`). */
const CHUNK = 100
/** The gateway's own bound (`supabase/config.toml` `max_rows`): a chunk read at it may have left rows out. */
const GATEWAY_ROWS = 1000

type ClaimRow = { id?: string; owner_session?: string; work_id: string; claimed_at: string; released_at: string | null; released_how: string | null }
const WORKFLOW = /^wf_[0-9a-f]{16}$/
type TaskRow = { id: string; project_id: string | null; title: string | null; instruction: string | null; status: string; moved_at: string | null; started_at: string | null; moved_by_kind: string | null }

/** The turn-end spec §3: a board request's state through the operator's door, or null when it cannot be read. */
export type RequestStateRead = (requestId: string) => Promise<string | null>
const REQUEST_SETTLED: ReadonlySet<string> = new Set(['completed', 'failed_known', 'answered', 'cancelled', 'expired', 'outcome_unknown'])

/** The waits the newest releases named (`work.released@1`'s `wait`), by claim id; a read that fails throws. */
async function readWaits(store: Store, claimIds: string[]): Promise<Map<string, Wait>> {
  const out = new Map<string, Wait>()
  if (!claimIds.length) return out
  const r = await store.selectIn('journal', 'payload', 'payload->>claim_id', claimIds, CHUNK, undefined, [['type', 'work.released@1']])
  if (r.failed) throw new Error(`the releases' waits could not be read: ${r.failed}`)
  for (const row of r.rows as Array<{ payload?: Record<string, unknown> }>) {
    const id = row.payload?.claim_id
    const wait = parseWait(row.payload?.wait)
    if (typeof id === 'string' && wait) out.set(id, wait)
  }
  return out
}

/** Whether each wait's referenced item reads settled now: a question answered or withdrawn, an access request decided, a
 *  board request settled. A reference that cannot be read is null, never «settled». */
async function readSettled(store: Store, waits: Wait[], requestState?: RequestStateRead): Promise<Map<string, boolean | null>> {
  const out = new Map<string, boolean | null>()
  const refs = (kind: Wait['kind']) => [...new Set(waits.filter((w) => w.kind === kind).map((w) => w.ref!))]
  const questions = refs('question')
  if (questions.length) {
    const q = await store.selectIn('questions', 'id,status', 'id', questions, CHUNK)
    if (!q.failed) for (const row of q.rows as Array<{ id: string; status: string }>) out.set(row.id, row.status !== 'open')
  }
  const grants = refs('grant')
  if (grants.length) {
    const g = await store.selectIn('access_requests', 'id,status', 'id', grants, CHUNK)
    if (!g.failed) for (const row of g.rows as Array<{ id: string; status: string }>) out.set(row.id, row.status !== 'pending')
  }
  for (const id of refs('request')) {
    const state = requestState ? await requestState(id).catch(() => null) : null
    out.set(id, state === null ? null : REQUEST_SETTLED.has(state))
  }
  return out
}

/**
 * When the supervisor began on this machine (0.3.22 review, iteration 2, DA-1): a release before it was made by a Fabric
 * whose let-go meant «back to the queue» and could name no wait, so continuing it would start every task left in the week
 * before the upgrade at once (42 tasks in 30 projects on the operator's board). Kept in `file` from the first read on, and
 * in this process too, so a file that cannot be written still begins once (iteration 3, ER-1: a fresh `now` on every pass
 * read an empty window and silently continued nothing); its failure is said once through `failed`.
 */
const begun = new Map<string, string>()
export function resumeSince(file: string, now: number, failed?: (e: unknown) => void): string {
  const known = begun.get(file)
  if (known) return known
  try {
    const kept = JSON.parse(readFileSync(file, 'utf8')) as { since?: unknown }
    if (typeof kept.since === 'string' && Number.isFinite(Date.parse(kept.since))) { begun.set(file, kept.since); return kept.since }
  } catch {
    // No file yet, or one that does not read: the supervisor begins now, and the file is written below.
  }
  const since = new Date(now).toISOString()
  begun.set(file, since)
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify({ since }) + '\n', { mode: 0o600 })
    renameSync(tmp, file)
  } catch (e) {
    // Unwritten: this process keeps its start (above); the next process begins at its own start, never earlier.
    failed?.(e)
  }
  return since
}

export async function readResumeCandidates(store: Store, now: number, requestState?: RequestStateRead, since?: string): Promise<{ candidates: ResumeCandidate[]; capped: boolean }> {
  const from = Math.max(now - RESUME_WINDOW_MS, since ? Date.parse(since) : Number.NEGATIVE_INFINITY)
  const r = await store.select('work_claims', 'work_id,claimed_at,released_at,released_how')
    .in('released_how', [...RESUME_HOWS])
    .gte('released_at', new Date(from).toISOString())
    .lte('released_at', new Date(now - RESUME_GRACE_MS).toISOString())
    .order('released_at', { ascending: false }).limit(RELEASES_READ)
  if (r.error) throw new Error(`the released claims could not be read: ${r.error.message}`)
  const released = (r.data ?? []) as ClaimRow[]
  const ids = [...new Set(released.map((c) => c.work_id))]
  if (!ids.length) return { candidates: [], capped: false }
  // The newest claim of each task: a later claim, live or released, means the work was taken after this release.
  const claims = await store.selectIn('work_claims', 'id,owner_session,work_id,claimed_at,released_at,released_how', 'work_id', ids, CHUNK, undefined, [],
    { column: 'claimed_at', ascending: false, limit: GATEWAY_ROWS })
  if (claims.failed) throw new Error(`the tasks' claims could not be read: ${claims.failed}`)
  const newest = new Map<string, ClaimRow>()
  for (const c of claims.rows as ClaimRow[]) {
    const prior = newest.get(c.work_id)
    if (!prior || Date.parse(c.claimed_at) > Date.parse(prior.claimed_at)) newest.set(c.work_id, c)
  }
  // §3.12: who left each released newest claim (its runtime session: its end's id, renamed by a /clear, before its
  // enrolment's) and the Observatory workflow it named. Indexed reads by session id and by owner.
  const leftBy = [...new Set([...newest.values()].filter((c) => c.released_at && c.owner_session).map((c) => c.owner_session as string))]
  const runtimeOf = new Map<string, string>()
  const workflowOf = new Map<string, string>()
  if (leftBy.length) {
    const [enrolled, ended, claimed] = await Promise.all([
      store.selectIn('journal', 'payload', 'payload->>session_id', leftBy, CHUNK, undefined, [['type', 'session.enrolled@1']]),
      store.selectIn('journal', 'payload', 'payload->>session_id', leftBy, CHUNK, undefined, [['type', 'session.ended@1']]),
      store.selectIn('journal', 'payload', 'payload->>owner', leftBy, CHUNK, undefined, [['type', 'work.claimed@1']])
    ])
    for (const r of [enrolled, ended, claimed]) if (r.failed) throw new Error(`the sessions that left work could not be read from the journal: ${r.failed}`)
    for (const row of [...enrolled.rows, ...ended.rows] as Array<{ payload: { session_id?: unknown; runtime_session_id?: unknown } }>)
      if (typeof row.payload?.session_id === 'string' && typeof row.payload.runtime_session_id === 'string') runtimeOf.set(row.payload.session_id, row.payload.runtime_session_id)
    for (const row of claimed.rows as Array<{ payload: { claim_id?: unknown; workflow_id?: unknown } }>)
      if (typeof row.payload?.claim_id === 'string' && typeof row.payload.workflow_id === 'string' && WORKFLOW.test(row.payload.workflow_id)) workflowOf.set(row.payload.claim_id, row.payload.workflow_id)
  }
  const tasks = await store.selectIn('project_tasks', 'id,project_id,title,instruction,status,moved_at,started_at,moved_by_kind', 'id', ids, CHUNK)
  if (tasks.failed) throw new Error(`the tasks could not be read: ${tasks.failed}`)
  const questions = await store.selectIn('questions', 'task_id', 'task_id', ids, CHUNK, undefined, [['status', 'open']])
  if (questions.failed) throw new Error(`the open questions could not be read: ${questions.failed}`)
  const asked = new Set((questions.rows as Array<{ task_id: string | null }>).map((q) => q.task_id).filter((id): id is string => !!id))
  // The turn-end spec §3: what each newest release waits for, and whether its referenced item has settled.
  const releasedIds = [...newest.values()].filter((c) => c.released_at && c.id).map((c) => c.id as string)
  const waits = await readWaits(store, releasedIds)
  const settled = await readSettled(store, [...waits.values()], requestState)
  const candidates = (tasks.rows as TaskRow[]).map((t): ResumeCandidate => {
    const c = newest.get(t.id)
    return {
      taskId: t.id, projectId: t.project_id, title: (t.title || t.instruction || '').slice(0, 200), status: t.status,
      movedAt: t.moved_at ?? t.started_at ?? null, movedByKind: t.moved_by_kind ?? null,
      lastClaim: c ? { claimedAt: c.claimed_at, releasedAt: c.released_at, how: c.released_how,
        ...(c.released_at ? { runtimeSessionId: (c.owner_session && runtimeOf.get(c.owner_session)) || null, workflowId: (c.id && workflowOf.get(c.id)) || null } : {}) } : null,
      openQuestion: asked.has(t.id),
      ...(() => {
        const wait = c?.id ? waits.get(c.id) : undefined
        return wait ? { wait, waitSettled: wait.ref ? settled.get(wait.ref) ?? null : null } : {}
      })()
    }
  })
  return { candidates, capped: released.length >= RELEASES_READ }
}

/** A resume item's state now (`shared/boardResume.ts#resumeStateOf`); null when the task cannot be read. */
export async function readResumeState(store: Store, taskId: string, releasedAt: string): Promise<'answered' | 'queued' | null> {
  try {
    const t = await store.select('project_tasks', 'status,moved_at,started_at,moved_by_kind').eq('id', taskId).limit(1)
    if (t.error) return null
    const row = ((t.data ?? []) as Array<{ status: string; moved_at: string | null; started_at: string | null; moved_by_kind: string | null }>)[0]
    if (!row) return null
    const c = await store.select('work_claims', 'claimed_at').eq('work_id', taskId).order('claimed_at', { ascending: false }).limit(1)
    if (c.error) return null
    const lastClaimedAt = ((c.data ?? []) as Array<{ claimed_at: string }>)[0]?.claimed_at ?? null
    return resumeStateOf({ status: row.status, lastClaimedAt, movedAt: row.moved_at ?? row.started_at, movedByKind: row.moved_by_kind }, releasedAt)
  } catch {
    // A read that threw proves nothing: the dispatcher judges the run on a later pass, as for an unreadable request.
    return null
  }
}
// #endregion board-resume-read
