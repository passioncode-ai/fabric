// #region work-claims-rules — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
/**
 * Claims (REQ-38, SCN-140; CONTEXT.md "Claim"): the rules both sides read — the agent's tools
 * (`main/workTools.ts`) and the operator's screens (the project page's «Who is working on what», SCR-78
 * «Where work is»). Pure: no database, no clock of its own, so the same input reads the same on both sides.
 *
 * A claim WARNS, it does not lock — except that one task is never held by two agents at once, which the lease
 * (migration 16) decides, first in the journal. Related work is the same backlog row, a linked task (blocks,
 * follows, spawned), or an overlapping folder or file.
 */

/** How long a claim lasts unless the agent says otherwise, and the most it may ask for (minutes). */
export const CLAIM_DEFAULT_MINUTES = 30
export const CLAIM_MAX_MINUTES = 240
/** A session that has called Fabric for nothing for this long reads «no sign for N min», never "running" (CO-256). */
export const SESSION_STALE_MS = 10 * 60_000
/** At most this many things a claim may say it touches, each at most this long. */
export const TOUCHES_MAX = 32
export const TOUCH_MAX_CHARS = 300

export type CameIn = 'launched' | 'enrolled' | 'handed-off' | 'hub' | 'unknown'
export const CAME_IN: readonly CameIn[] = ['launched', 'enrolled', 'handed-off', 'hub', 'unknown']
/** How a claim ended. The first three are the agent's words (`fabric_work_release`); the rest are Fabric's. */
export type ReleaseHow = 'done' | 'handed-over' | 'let-go' | 'operator' | 'session-ended' | 'lapsed'
export const AGENT_RELEASES = ['done', 'handed-over', 'let-go'] as const
export type AgentRelease = (typeof AGENT_RELEASES)[number]
/** The contract's `work.released@1` outcome for each way a claim ends (operating-surfaces.md, the coordination claim). */
export const RELEASE_OUTCOME: Record<ReleaseHow, 'succeeded' | 'abandoned' | 'cancelled' | 'expired'> = {
  done: 'succeeded',
  'handed-over': 'abandoned',
  'let-go': 'abandoned',
  operator: 'cancelled',
  'session-ended': 'abandoned',
  lapsed: 'expired'
}

/** A backlog row, by its address (R-07: link, don't copy). */
export interface BacklogSource {
  repository: string
  path: string
  id: string
}

/** A row of `task_sources`. */
export interface SourceRow {
  task_id: string
  repository: string
  repo_path: string
  path: string
  row_id: string
}

/** A live row of `work_claims`, with its task's title and its link, as both sides read it. */
export interface ClaimRow {
  id: string
  work_id: string
  owner_session: string
  agent: string | null
  came_in: CameIn
  touches: string[]
  claimed_at: string
  expires_at: string
  renewed_at: string | null
  handover_requested_by: string | null
  handover_requested_at: string | null
  handover_note: string | null
}

/** A `task_links` edge between two tasks. */
export interface TaskEdge {
  task_id: string
  rel: string
  target_id: string
}

export type RelatedWhy =
  | { kind: 'same-row'; row: string }
  | { kind: 'linked'; rel: string; direction: 'from' | 'to' }
  | { kind: 'overlap'; mine: string; theirs: string }

export interface Related {
  claimId: string
  taskId: string
  heldBy: string
  agent: string | null
  since: string
  why: RelatedWhy[]
}

/** One touch, in the form two touches are compared in: no leading `./`, no trailing `/`, no repeated `/`. */
export function normaliseTouch(touch: string): string {
  return touch.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '')
}

/** The literal part of a pattern — what comes before its first wildcard, cut back to a whole segment. */
function literalPrefix(touch: string): { prefix: string; pattern: boolean } {
  const at = touch.search(/[*?[{]/)
  if (at < 0) return { prefix: touch, pattern: false }
  const head = touch.slice(0, at)
  const cut = head.lastIndexOf('/')
  return { prefix: cut < 0 ? '' : head.slice(0, cut), pattern: true }
}

/**
 * Whether two touches can name the same file. A folder overlaps everything inside it, in either direction
 * (`src/auth` and `src/auth/login.ts`); a pattern overlaps through its literal folder (`src/**​/*.ts` and
 * `src/auth`). Segment-wise, so `src/auth` does not overlap `src/authors`. An empty prefix (a pattern at the
 * root, `**​/*.md`) overlaps everything — said, never hidden.
 */
export function touchesOverlap(a: string, b: string): boolean {
  const x = literalPrefix(normaliseTouch(a))
  const y = literalPrefix(normaliseTouch(b))
  if (x.prefix === '' && x.pattern) return true
  if (y.prefix === '' && y.pattern) return true
  const within = (inner: string, outer: string): boolean => inner === outer || inner.startsWith(outer + '/')
  return within(x.prefix, y.prefix) || within(y.prefix, x.prefix)
}

const rowKey = (s: Pick<SourceRow, 'repo_path' | 'path' | 'row_id'>): string => `${s.repo_path}\u0000${s.path}\u0000${s.row_id}`
export const describeRow = (s: Pick<SourceRow, 'path' | 'row_id'>): string => `${s.row_id} (${s.path})`

/**
 * What related work other agents hold, for one claim (the agent's warning) — never a refusal. `others` are the
 * project's other live claims; `sources` the links of every task involved; `edges` the task links of the project.
 */
export function relatedTo(
  mine: { claimId?: string | null; taskId: string; owner: string; touches: readonly string[] },
  others: readonly ClaimRow[],
  sources: ReadonlyMap<string, SourceRow>,
  edges: readonly TaskEdge[]
): Related[] {
  const out: Related[] = []
  const myRow = sources.get(mine.taskId)
  for (const o of others) {
    if (o.id === mine.claimId || o.owner_session === mine.owner) continue
    const why: RelatedWhy[] = []
    const theirRow = sources.get(o.work_id)
    if (o.work_id !== mine.taskId && myRow && theirRow && rowKey(myRow) === rowKey(theirRow))
      why.push({ kind: 'same-row', row: describeRow(myRow) })
    for (const e of edges) {
      if (e.task_id === mine.taskId && e.target_id === o.work_id) why.push({ kind: 'linked', rel: e.rel, direction: 'from' })
      else if (e.task_id === o.work_id && e.target_id === mine.taskId) why.push({ kind: 'linked', rel: e.rel, direction: 'to' })
    }
    for (const m of mine.touches)
      for (const t of o.touches) if (touchesOverlap(m, t)) why.push({ kind: 'overlap', mine: m, theirs: t })
    if (why.length) out.push({ claimId: o.id, taskId: o.work_id, heldBy: o.owner_session, agent: o.agent, since: o.claimed_at, why })
  }
  return out
}

/** For the operator's views: each live claim with the others it is related to (both rows carry «related»). */
export function relatedPairs(
  claims: readonly ClaimRow[],
  sources: ReadonlyMap<string, SourceRow>,
  edges: readonly TaskEdge[]
): Map<string, Related[]> {
  const out = new Map<string, Related[]>()
  for (const c of claims)
    out.set(c.id, relatedTo({ claimId: c.id, taskId: c.work_id, owner: c.owner_session, touches: c.touches }, claims, sources, edges))
  return out
}

/** One sentence for one reason, for the agent's answer. The screens say the same with their own strings. */
export function sayWhy(w: RelatedWhy): string {
  if (w.kind === 'same-row') return `the same backlog row, ${w.row}`
  if (w.kind === 'linked')
    return w.direction === 'from' ? `your task ${w.rel} theirs` : `their task ${w.rel} yours`
  return `you touch ${w.mine} and they touch ${w.theirs}`
}

export type ClaimLife = 'live' | 'silent' | 'lapsed'

/**
 * How a live claim reads. `session` is what Fabric holds of the claiming session right now: null when it holds
 * nothing (the session ended, or Fabric restarted since) — then the claim has «lapsed — the session ended».
 * A claim past its expiry with its session still there is silent: «no sign since <time>», never "working".
 */
export function claimLife(
  claim: Pick<ClaimRow, 'expires_at' | 'claimed_at' | 'renewed_at'>,
  now: number,
  session: { lastSignAt: number | null } | null
): { life: ClaimLife; lastSignAt: string } {
  const own = Math.max(Date.parse(claim.claimed_at), claim.renewed_at ? Date.parse(claim.renewed_at) : 0)
  const sign = Math.max(own, session?.lastSignAt ?? 0)
  const lastSignAt = new Date(sign).toISOString()
  if (session === null) return { life: 'lapsed', lastSignAt }
  if (Date.parse(claim.expires_at) <= now) return { life: 'silent', lastSignAt }
  return { life: 'live', lastSignAt }
}

// ── a task held by its run (CO-323) ─────────────────────────────────────────────────────────────────────────

/** A row of `task_runs`, as the claim reads it. */
export interface RunRow {
  task_run_id: string
  task_id: string
  session_id: string | null
  state: string
  outcome: string | null
  ended_seq: number | string | null
  created_at: string
}
/** A row of `run_stop_commands` (migration 62): the durable Stop of one run. */
export interface StopRow {
  task_run_id: string
  session_id: string
  state: 'requested' | 'outcome_unknown' | 'stopped'
  reason: string
}
/** A row of `run_launch_compensations` (migration 62): a launch proved never to have spawned. */
export interface CompensationRow {
  task_run_id: string
  session_id: string
  receipt_seq: number | string
}
/** Where a run's Stop stands: never asked, asked and not observed yet, or asked and not proved. */
export type RunStop = 'not-requested' | 'requested' | 'outcome_unknown'
/** A run that still holds its task: Fabric launched it and has not proved it stopped. */
export interface RunHold {
  taskId: string
  runId: string
  sessionId: string | null
  /** When Fabric admitted the run — the hold's "since". */
  since: string
  stop: RunStop
  /** Why the Stop was asked (`natural_exit`, `operator_stop`, …), when it was. */
  stopReason: string | null
}

/**
 * The runs that still hold their tasks — the same rule the claim projector applies (`task_has_unresolved_run_at`,
 * migration 62): a run holds its task until a VERIFIED stop of its own session, or a never-spawned compensation
 * matching its failed end, says it is over. A lapsed lease, a process exit or an unproved stop is not that proof
 * (HAR-R0-04 invariant 2). One hold per task, the latest run's. This explains a refusal; the projector decides it.
 */
export function unresolvedRuns(runs: readonly RunRow[], stops: readonly StopRow[], compensations: readonly CompensationRow[]): RunHold[] {
  const holds = new Map<string, { hold: RunHold; at: number }>()
  for (const r of runs) {
    const stopped = stops.some((s) => s.task_run_id === r.task_run_id && s.session_id === r.session_id && s.state === 'stopped')
    const compensated = r.outcome === 'failed_known' && r.ended_seq !== null &&
      compensations.some((c) => c.task_run_id === r.task_run_id && c.session_id === r.session_id && Number(c.receipt_seq) === Number(r.ended_seq))
    if (stopped || compensated) continue
    const stop = stops.find((s) => s.task_run_id === r.task_run_id)
    const at = Date.parse(r.created_at)
    const prior = holds.get(r.task_id)
    if (prior && prior.at >= at) continue
    holds.set(r.task_id, {
      at,
      hold: {
        taskId: r.task_id,
        runId: r.task_run_id,
        sessionId: r.session_id,
        since: r.created_at,
        stop: stop ? (stop.state === 'requested' ? 'requested' : 'outcome_unknown') : 'not-requested',
        stopReason: stop?.reason ?? null
      }
    })
  }
  return [...holds.values()].map((h) => h.hold)
}

/** Who holds a task, in the words a refusal carries. */
export interface HeldBy {
  session_id: string | null
  agent: string | null
  came_in: CameIn | null
  since: string | null
  until: string | null
  run_id?: string
  stop?: RunStop
}

/** The holder named from its live claim (null when the lease stands on none) and its lease. */
export function heldByClaim(
  c: Pick<ClaimRow, 'agent' | 'came_in' | 'claimed_at'> | null,
  lease: { owner_session: string; expires_at: string }
): HeldBy {
  return { session_id: lease.owner_session, agent: c?.agent ?? null, came_in: c?.came_in ?? null, since: c?.claimed_at ?? null, until: lease.expires_at }
}

const RUN_STOP_WORDS: Record<RunStop, string> = {
  'not-requested': 'no stop was asked for it',
  requested: 'its stop was asked and is not observed yet',
  outcome_unknown: 'its stop could not be proved'
}

/**
 * The refusal of a task its run holds. A lease still live: the session Fabric launched for it is working
 * (`held`). A lease that lapsed: the run is not proved stopped, and a lapsed lease is not that proof
 * (`unresolved-run`). Either way the answer names the session, the run, since and until when — never a race.
 */
export function runHoldRefusal(taskId: string, hold: RunHold, lease: { expires_at: string } | null, now: number): Record<string, unknown> {
  const until = lease?.expires_at ?? null
  const held_by: HeldBy = { session_id: hold.sessionId, agent: null, came_in: 'launched', since: hold.since, until, run_id: hold.runId, stop: hold.stop }
  const session = hold.sessionId ? `session ${hold.sessionId.slice(0, 8)}` : 'a session'
  if (until && Date.parse(until) > now)
    return {
      claimed: false, code: 'held', task_id: taskId, held_by,
      reason: `the ${session} Fabric launched for this task holds it, since ${hold.since}, until ${until}`,
      next: 'choose another task, or file a linked one'
    }
  return {
    claimed: false, code: 'unresolved-run', task_id: taskId, held_by,
    reason: `the task's last run (${session}, launched by Fabric at ${hold.since}) has not been proved stopped — ${RUN_STOP_WORDS[hold.stop]}` +
      (until ? `; its lease lapsed at ${until}, and a lapsed lease is not proof that the run ended` : ''),
    next: 'the task stays held until Fabric can prove that run stopped; choose another task, or file a linked one'
  }
}

/**
 * The answer to a claim the projection did not take, read back after the write (`fabric_work_claim`,
 * `fabric_task_claim`). Its run holds the task → that run is named. Another session's lease is live now → it
 * claimed the task in the same moment, named. Neither → the claim is unconfirmed; nothing is guessed.
 */
export function refusalAfterWrite(input: {
  taskId: string
  me: string
  now: number
  lease: { owner_session: string; expires_at: string } | null
  holder: Pick<ClaimRow, 'agent' | 'came_in' | 'claimed_at'> | null
  hold: RunHold | null
}): Record<string, unknown> {
  const { taskId, me, now, lease, holder, hold } = input
  if (hold) return runHoldRefusal(taskId, hold, lease, now)
  if (lease && lease.owner_session !== me && Date.parse(lease.expires_at) > now)
    return { claimed: false, code: 'held', task_id: taskId, reason: 'another agent claimed it in the same moment', held_by: heldByClaim(holder, lease) }
  return { claimed: false, code: 'unconfirmed', task_id: taskId, reason: 'the claim could not be confirmed; read fabric_work_list before claiming again' }
}

/** Whether a session's last sign of life is older than its window (CO-256). Never "running" past it. */
export function sessionStale(lastSignAt: number | null, startedAt: number, now: number, staleMs = SESSION_STALE_MS): boolean {
  return now - (lastSignAt ?? startedAt) > staleMs
}

// ── the backlog row's address ──────────────────────────────────────────────────────────────────────────────

const ROW_ID = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/

export type SourceCheck =
  | { ok: true; source: BacklogSource }
  | { ok: false; part: 'repository' | 'path' | 'id'; reason: string }

/** The address's own shape, before anything is looked up: a repository, a relative path inside it, a row id. */
export function checkSourceShape(input: { repository?: unknown; path?: unknown; id?: unknown }): SourceCheck {
  const repository = typeof input.repository === 'string' ? input.repository.trim() : ''
  if (!repository || repository.length > 300 || /[\x00-\x1f\x7f]/.test(repository))
    return { ok: false, part: 'repository', reason: 'repository must name one of this project’s repositories: its remote (https://github.com/owner/name or owner/name) or its folder' }
  const raw = typeof input.path === 'string' ? input.path.trim() : ''
  const p = raw.replace(/\\/g, '/')
  if (!p || p.length > 300 || p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.split('/').some((s) => s === '..') || /[\x00-\x1f\x7f]/.test(p))
    return { ok: false, part: 'path', reason: 'path must be the backlog file’s path inside the repository, such as docs/evidence/backlog.md' }
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  if (!ROW_ID.test(id)) return { ok: false, part: 'id', reason: 'id must be the row’s id as the file writes it, such as CO-256' }
  return { ok: true, source: { repository, path: p.replace(/^(\.\/)+/, ''), id } }
}

/**
 * A remote, reduced to what names the repository: `host/owner/name`, lower case, without `.git` — so
 * `git@github.com:o/n.git`, `https://github.com/o/n` and `ssh://git@github.com/o/n.git` are one repository,
 * and `o/n` names it on github.com. Null for anything that is not a remote.
 */
export function remoteKey(remote: string): string | null {
  const s = remote.trim()
  let host: string
  let rest: string
  let m: RegExpExecArray | null
  if ((m = /^(?:https?|ssh|git):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(s))) [host, rest] = [m[1], m[2]]
  else if ((m = /^[^@\s/]+@([^:/\s]+):(.+)$/.exec(s))) [host, rest] = [m[1], m[2]]
  else if ((m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(s))) [host, rest] = ['github.com', `${m[1]}/${m[2]}`]
  else return null
  const path = rest.replace(/\.git$/i, '').replace(/\/+$/, '')
  if (!/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/.test(path)) return null
  return `${host.toLowerCase()}/${path.toLowerCase()}`
}

/** Which of the project's repositories an address names: by its folder, or by its `origin` remote. */
export function resolveRepository(
  repository: string,
  repos: ReadonlyArray<{ path: string; remote: string | null }>
): { path: string } | null {
  const byPath = repos.find((r) => r.path === repository || r.path.replace(/\/+$/, '') === repository.replace(/\/+$/, ''))
  if (byPath) return { path: byPath.path }
  const key = remoteKey(repository)
  if (!key) return null
  const byRemote = repos.find((r) => r.remote !== null && remoteKey(r.remote) === key)
  return byRemote ? { path: byRemote.path } : null
}

/** Whether a row id appears in a file's text as a whole token (`CO-256`, not `CO-2560`). */
export function rowAppears(text: string, id: string): boolean {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-z0-9_-])${esc}(?![A-Za-z0-9_])`, 'm').test(text)
}

// ── agent-sync's lease refs (REQ-08), read-only ────────────────────────────────────────────────────────────

export interface LeaseRef {
  /** What the lease is on, decoded: a guarded file (`CONTEXT.md`) or a task key. */
  key: string
  ref: string
  sha: string
  /** TR-7: read from the lease's own commit (its `ts` + `ttl`): live until `expiresAt`, expired, or unknown when the
   *  commit is not in the local repository or is not a lease. Absent: not read. */
  state?: 'live' | 'expired' | 'unknown'
  expiresAt?: string | null
}

export const LEASE_REF_PREFIX = 'refs/agent-sync/leases/'
export const LEASE_REFS_MAX = 200

/** `git ls-remote` output → the lease refs, at most `LEASE_REFS_MAX`; anything else in it is ignored. */
export function parseLeaseRefs(stdout: string): { leases: LeaseRef[]; truncated: boolean } {
  const leases: LeaseRef[] = []
  let truncated = false
  for (const line of stdout.split('\n')) {
    const m = /^([0-9a-f]{40}|[0-9a-f]{64})\t(refs\/agent-sync\/leases\/(\S+))$/.exec(line.trim())
    if (!m) continue
    if (leases.length >= LEASE_REFS_MAX) {
      truncated = true
      break
    }
    let key = m[3]
    try {
      key = decodeURIComponent(m[3])
    } catch {
      // A key that is not percent-encoding is shown as the ref names it.
    }
    leases.push({ key, ref: m[2], sha: m[1] })
  }
  return { leases, truncated }
}

/**
 * A remote `git ls-remote` may be pointed at: https or ssh only — never a local path, `file://` or `ext::`, which
 * would run a program or read this machine — and never something that reads as an option.
 */
export function isListableRemote(url: string): boolean {
  const s = url.trim()
  if (!s || s !== url || s.startsWith('-') || /[\s\x00-\x1f\x7f]/.test(s)) return false
  if (/^https:\/\/[^/\s]+\/.+/i.test(s)) return true
  if (/^ssh:\/\/[^/\s]+\/.+/i.test(s)) return true
  return /^[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+:[^/].*$/.test(s)
}
// ── what the operator's screens read (SCR-31 «Who is working on what», SCR-78 «Where work is») ─────────────────

export interface WorkSessionView {
  sessionId: string
  projectId: string | null
  agent: string | null
  cameIn: CameIn
  /** Fabric holds a console (a terminal it runs) for this session. False for an agent enrolled from its own terminal
   *  or reaching Fabric through the hub: «Open session» would only say "This session is gone" (0.3.5 review UX-3). */
  console: boolean
  /** The folder the session works in, when Fabric knows it (its own terminals; 0.3.5 i2 UX-3, SCN-141). */
  folder?: string | null
  startedAt: string
  lastSignAt: string | null
  stale: boolean
}

export interface WorkClaimView {
  claimId: string
  projectId: string
  taskId: string
  title: string
  status: string
  source: BacklogSource | null
  sessionId: string
  agent: string | null
  cameIn: CameIn
  /** Fabric holds a console for the claim's session (see `WorkSessionView.console`). */
  console: boolean
  touches: string[]
  since: string
  until: string
  lastSignAt: string
  life: ClaimLife
  related: Array<{ claimId: string; taskId: string; title: string; why: RelatedWhy[] }>
}

export interface WorkHeldView {
  projectId: string
  taskId: string
  title: string
  sessionId: string
  until: string
}

/** Why agent-sync's leases were not read, as a code each window says in its own language (0.3.5 review UX-5).
 *  `not-used`: the repository carries no `.claude/agent-sync.json`, so no remote is read and no block is shown. */
export type LeaseReadCode = 'not-used' | 'no-origin' | 'not-listable' | 'remote-unreadable' | 'timeout' | 'too-large' | 'refused'

export type WorkLeasesView =
  | { read: true; repository: string; readAt: string; leases: Array<{ key: string }>; truncated: boolean; /** Expired leases, counted, not listed (TR-7). */ expired?: number }
  | { read: false; code: Exclude<LeaseReadCode, 'not-used'> }

export interface ProjectWorkView {
  claims: WorkClaimView[]
  held: WorkHeldView[]
  sessions: WorkSessionView[]
  /** agent-sync's leases on the primary repository, read-only; null when the project has no repository or its
   *  repository does not use agent-sync. */
  leases: WorkLeasesView | null
  readAt: string
}

export interface WhereWorkRow {
  projectId: string
  name: string
  sessions: WorkSessionView[]
  claims: WorkClaimView[]
  /** Tasks in review; null when that count could not be read (the column says so, never a zero). */
  review: number | null
  lastSignAt: string | null
}

export interface WhereWorkView {
  rows: WhereWorkRow[]
  /** Projects with nothing in flight, counted in one line. */
  idle: number
  /** Sessions reporting from no project Fabric holds — the last row, always shown. */
  unowned: WorkSessionView[]
  /** Why the review counts could not be read, when they could not. */
  reviewUnread: string | null
  readAt: string
  /** The reads that stopped at their limit (CO-310); absent when none did. */
  capped?: Array<'claims' | 'leases' | 'projects'>
}

/** SCR-78's rows: a project is in flight when it has a live session, a live claim, or tasks in review. */
export function whereWorkRows(input: {
  projects: ReadonlyArray<{ id: string; name: string }>
  sessions: readonly WorkSessionView[]
  claims: readonly WorkClaimView[]
  review: ReadonlyMap<string, number> | null
}): { rows: WhereWorkRow[]; idle: number; unowned: WorkSessionView[] } {
  const known = new Set(input.projects.map((p) => p.id))
  const rows: WhereWorkRow[] = []
  let idle = 0
  for (const p of input.projects) {
    const sessions = input.sessions.filter((s) => s.projectId === p.id)
    const claims = input.claims.filter((c) => c.projectId === p.id)
    const review = input.review === null ? null : (input.review.get(p.id) ?? 0)
    if (!sessions.length && !claims.length && !review) {
      idle++
      continue
    }
    const signs = [...sessions.map((s) => s.lastSignAt ?? s.startedAt), ...claims.map((c) => c.lastSignAt)].sort()
    rows.push({ projectId: p.id, name: p.name, sessions, claims, review, lastSignAt: signs.at(-1) ?? null })
  }
  rows.sort((a, b) => (b.lastSignAt ?? '').localeCompare(a.lastSignAt ?? ''))
  const unowned = input.sessions.filter((s) => s.projectId === null || !known.has(s.projectId))
  return { rows, idle, unowned }
}
// #endregion work-claims-rules
