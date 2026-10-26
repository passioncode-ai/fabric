// What needs the operator (M146 step 8 · SCR-30's CEO panel).
//
// WHAT THIS IS NOT, AND WHY THE HONEST VERSION IS BETTER. The mockup drew a
// conversational CEO: "two are waiting for you — dev asks about the overwrite,
// and I need a grant for the research MCP". There is no model behind this
// product, and a chat that echoes would be a notepad pretending to be a
// colleague. But the SUBSTANCE of what that panel did needs no model at all:
// what is waiting, and the act that resolves it. That is derived from state
// this repository already keeps, and it is the half that is actually useful.
//
// THE RULE: this queue is DERIVED, so nothing can be dismissed. An item leaves
// when the thing it names is resolved and not before — accept the work, take
// the lease, issue the grant. A queue you can mark as read is a queue that
// lies, and the lie is worst exactly when the list is long.
//
// The conversational layer waits for a model, and what it would need is named
// rather than implied: a provider, a key, a budget the wallet meters, and a
// place for the transcript that is not the estate's journal (§4). None of that
// is scheduled, so none of it is half-built here.

import type { AbandonedKind, Finding } from './abandonedSweep.ts'
import type { PendingRequestFacts } from './access.ts'
import { obligationRef, type EntityRef } from './entityRef.ts'
import { refusedBy, type ReadEnvelope, type SourceReceipt } from './readEnvelope.ts'
import { legacyTaskLine } from './projectPath.ts'

export type AttentionKind = 'access' | 'refused' | 'review' | 'abandoned' | 'proposal'

export interface AttentionItem {
  kind: AttentionKind
  /**
   * WHAT this obligation is about, in the estate's one ref vocabulary
   * (`entityRef.ts`). Stable across reads, so the list does not reshuffle under
   * the pointer — and parseable, which the old prefixed string only looked
   * like: `board.ts` prefixed it a second time and produced `review:review:t1`
   * for every derived row on the Board.
   *
   * The KIND of the obligation and the kind of its subject are not the same
   * thing: an expired `lease` is `abandoned`, and its subject is a `task` only
   * when the work it holds is one.
   */
  ref: EntityRef
  projectId: string | null
  projectName: string | null
  title: string
  detail: string | null
  /** When it started waiting. */
  since: string
  /**
   * What the operator can DO about it from here (M140). Present only on a
   * refusal, and it carries exactly what the grant would authorise — a queue
   * that names a problem and offers no act is a list of complaints.
   */
  grantable?: { floorClass: string; target: string; askedBecause: string | null }
  /**
   * A hand-off that reached the loop bound (M68). Present only on a proposal,
   * and it carries the two acts: make it a task, or let the chain end. A queue
   * that names a problem and offers no act is a list of complaints — and a
   * proposal with no decision is a task that was stopped and then forgotten,
   * which is worse than not stopping it.
   */
  proposal?: { id: string; depth: number; bound: number }
  /**
   * An external agent waiting on the operator's consent (ADR-0115 §2). Present only on an `access`
   * item, and it carries the act: allow or deny that request. It leaves the queue when it is answered
   * or expires — derived, like everything here.
   */
  access?: PendingRequestFacts
  /**
   * Abandoned work the latest sweep found (0.3.13 SW-9). Present only on an `abandoned` item that came from the sweep,
   * never on an expired lease: it carries the finding's key, which is the obligation's address (one item per key, see
   * `attentionKey`), and its kind, which the screens say in the operator's language.
   */
  swept?: { key: string; kind: AbandonedKind }
}

/**
 * What the native consent prompt states, so an Allow given in the queue says the same (security review
 * of PR #7): who the registry says is asking, what it asks, its reason as its own one-line claim, the
 * same-user floor, whether this adds to access it already holds and whether Allow also connects the
 * product — as FACTS the queue phrases in the operator's language (verification 0.3.1, UX-2).
 */
export type AccessFacts = PendingRequestFacts

export interface AttentionSources {
  /** Tasks an agent moved to review: it says it is done and cannot say so. */
  /** `brief_what` is the task's plain summary when an agent or the operator wrote one (2026-10-14). */
  reviews: { id: string; project_id: string; title: string | null; brief_what?: string | null; instruction: string; started_at: string }[]
  /** Claims whose holder is gone; the work is neither running nor free. */
  expired: {
    work_id: string
    project_id: string
    owner_session: string
    expires_at: string
    title: string | null
    /** Whether `work_id` names a row in `project_tasks`. The caller already
     *  asks, to find a title; the answer decides whether this is navigable. */
    is_task: boolean
  }[]
  /** Policy refusals — somebody is blocked right now for want of a grant. */
  refusals: {
    seq: number
    project_id: string | null
    floor_class: string
    target: string
    reason: string
    /** Why the ASKER said they needed it (M140). */
    asked_because?: string | null
    occurred_at: string
  }[]
  /**
   * What resolved a refusal after it was made: a grant the operator issued, or a later decision that
   * allowed the same act. Absent means none was read, and every refusal stays open.
   */
  resolutions?: { seq: number; project_id: string | null; floor_class: string; target: string }[]
  /** Hand-offs stopped at the bound and still waiting on a person (M68). */
  proposals: {
    id: string
    project_id: string
    title: string
    depth: number
    bound: number
    created_at: string
  }[]
  /** Access requests from registered agents, waiting on the operator and not yet expired (ADR-0115). */
  access?: PendingRequestFacts[]
  /**
   * What the latest sweep of abandoned work found (0.3.13 SW-9, `abandonedSweepRun.ts#createAbandonedSweep`), one row
   * per finding key. Absent before the first sweep. A finding leaves when a later sweep no longer finds it.
   */
  swept?: {
    key: string
    kind: AbandonedKind
    project_id: string | null
    task_id: string | null
    request_id: string | null
    /** Since when it has stood still: the sweep's time less how long it stood still (SW-3). */
    still_since: string
    /** The task's title or instruction, when the finding names a task the read found. */
    title: string | null
    /** Whether `task_id` names a row in `project_tasks`, measured the way an expired lease's is. */
    is_task: boolean
  }[]
  names: Record<string, string>
}

/** Refusals first: somebody is blocked NOW. Then work waiting on a person, then
 *  work nobody is doing. Within a kind, oldest first — the thing that has been
 *  waiting longest is the most neglected, not the least interesting. */
// A PROPOSAL ranks between a refusal and a review, and the order is an argument.
// A refusal is somebody blocked right now. A proposal is a chain that has already
// STOPPED — nothing is burning, but the work is held and will stay held until a
// person moves, which is more urgent than a review an agent finished and can wait
// on. Ranked below review it would sit under a growing list and be the thing
// nobody reaches, which is how a bound turns into a place work goes to die.
// An ACCESS request ranks with a refusal: an agent is blocked right now, and the request expires in ten
// minutes, so it is the one item here that is lost by waiting.
const RANK: Record<AttentionKind, number> = { access: 0, refused: 0, proposal: 1, review: 2, abandoned: 3 }

/**
 * The refusals still waiting on the operator (audit 2026-10-05 A1-001).
 *
 * A refusal leaves when what it asked for has been given: a grant, or a later decision allowing the
 * same act, with a higher seq, for the same floor class and target, in the same project or estate-wide.
 * Until this, a granted refusal stayed in the queue with "Allow once" still offered, each click minted
 * another grant, and the card stayed red until fifty newer decisions pushed it out. Repeated refusals of
 * one act are one obligation: the newest is kept, dated from the first, because it has waited that long.
 */
/** A journal row as the attention read takes it: `grant.issued@1` or a policy decision. */
export interface JournalActRow { seq: number; project_id: string | null; payload: Record<string, unknown> }

/**
 * What resolves a refusal (A1-001): every grant issued for an act, and every later policy decision that
 * ALLOWED it. Both carry the act as `floor_class` and `target` in their payload (`policy.ts` writes them);
 * a row without them resolves nothing it could be confused with ("unknown" matches no real act).
 */
export function resolutionsOf(grants: readonly JournalActRow[], decisions: readonly JournalActRow[]): NonNullable<AttentionSources['resolutions']> {
  return [...grants, ...decisions.filter((row) => row.payload.verdict === 'allow')].map((row) => ({
    seq: row.seq,
    project_id: row.project_id ?? null,
    floor_class: typeof row.payload.floor_class === 'string' ? row.payload.floor_class : 'unknown',
    target: typeof row.payload.target === 'string' ? row.payload.target : 'unknown'
  }))
}

/**
 * The sweep's findings as the queue's source (SW-9), one row per finding key. `titles` and `isTask` are the task read the
 * attention read already makes for expired leases: a finding over a task it did not find is unnavigable, never wrongly
 * navigable.
 */
export function sweptSources(
  findings: readonly (Finding & { stillSince: number })[],
  titles: Readonly<Record<string, string>>,
  isTask: ReadonlySet<string>
): NonNullable<AttentionSources['swept']> {
  const seen = new Set<string>()
  const out: NonNullable<AttentionSources['swept']> = []
  for (const f of findings) {
    if (seen.has(f.key)) continue
    seen.add(f.key)
    out.push({
      key: f.key,
      kind: f.kind,
      project_id: f.projectId,
      task_id: f.taskId,
      request_id: f.requestId,
      still_since: new Date(f.stillSince).toISOString(),
      title: f.taskId ? (titles[f.taskId] ?? null) : null,
      is_task: f.taskId !== null && isTask.has(f.taskId)
    })
  }
  return out
}

export function openRefusals(
  refusals: AttentionSources['refusals'],
  resolutions: AttentionSources['resolutions'] = []
): AttentionSources['refusals'] {
  const resolved = (r: AttentionSources['refusals'][number]): boolean =>
    resolutions.some((x) => x.seq > r.seq && x.floor_class === r.floor_class && x.target === r.target &&
      (x.project_id === null || x.project_id === r.project_id))
  const byAct = new Map<string, AttentionSources['refusals'][number]>()
  for (const r of refusals) {
    if (resolved(r)) continue
    const key = JSON.stringify([r.project_id, r.floor_class, r.target])
    const held = byAct.get(key)
    if (!held) { byAct.set(key, r); continue }
    const [newer, older] = r.seq > held.seq ? [r, held] : [held, r]
    const first = Date.parse(older.occurred_at) < Date.parse(newer.occurred_at) ? older.occurred_at : newer.occurred_at
    byAct.set(key, { ...newer, occurred_at: first })
  }
  return [...byAct.values()]
}

export function attentionOf(sources: AttentionSources): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const row of sources.access ?? [])
    items.push({
      kind: 'access',
      ref: { kind: 'access-request', id: row.requestId },
      // An external agent belongs to the estate, not to a project.
      projectId: null,
      projectName: null,
      // A VALUE, not a sentence: every screen phrases an access row through `sayQueueTitle` (UX-2).
      title: row.agent.name ?? row.agent.agentId,
      detail: null,
      since: row.requestedAt,
      access: row
    })
  for (const row of openRefusals(sources.refusals, sources.resolutions))
    items.push({
      kind: 'refused',
      ref: { kind: 'refusal', id: String(row.seq) },
      projectId: row.project_id,
      projectName: row.project_id ? (sources.names[row.project_id] ?? null) : null,
      title: row.target,
      // What the ASKER said, when they said anything. The policy's own reason
      // explains why it refused; this explains why it was asked, and that is
      // the half the operator is deciding on.
      detail: row.asked_because ?? row.reason,
      since: row.occurred_at,
      grantable: {
        floorClass: row.floor_class,
        target: row.target,
        askedBecause: row.asked_because ?? null
      }
    })
  for (const row of sources.reviews)
    items.push({
      kind: 'review',
      ref: { kind: 'task', id: row.id },
      projectId: row.project_id,
      projectName: sources.names[row.project_id] ?? null,
      // Its plain summary — the brief, the title, else the instruction's first line cut at a word: never the prompt whole.
      title: legacyTaskLine({ title: row.title, brief_what: row.brief_what ?? null, instruction: row.instruction }),
      detail: null,
      since: row.started_at
    })
  for (const row of sources.proposals)
    items.push({
      kind: 'proposal',
      ref: { kind: 'proposal', id: row.id },
      projectId: row.project_id,
      projectName: sources.names[row.project_id] ?? null,
      title: row.title,
      detail: null,
      since: row.created_at,
      proposal: { id: row.id, depth: row.depth, bound: row.bound }
    })
  for (const row of sources.expired)
    items.push({
      kind: 'abandoned',
      // MEASURED, not assumed. `taskIdOf` used to slice `lease:` off and hand
      // the remainder over as a task id, so an expired lease over work that is
      // not a task opened a task page for a task that does not exist. The
      // caller looked the id up in `project_tasks` to find a title; whether it
      // found one is the same question, and it is now carried rather than
      // discarded.
      ref: { kind: row.is_task ? 'task' : 'work', id: row.work_id },
      projectId: row.project_id,
      projectName: sources.names[row.project_id] ?? null,
      title: row.title ?? row.work_id,
      detail: row.owner_session,
      since: row.expires_at
    })
  // #region attention-swept — docs: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md#requirements
  // SW-9: the sweep's findings are abandoned work like an expired lease, on the same queue, «На проверке» and notifier.
  // The subject is the task when the finding names one (navigable when the read found it), else the project: a board
  // request has no page of its own, and its project is where it is answered.
  for (const row of sources.swept ?? []) {
    const ref: EntityRef = row.task_id
      ? { kind: row.is_task ? 'task' : 'work', id: row.task_id }
      : { kind: 'project', id: row.project_id ?? row.request_id ?? row.key }
    items.push({
      kind: 'abandoned',
      ref,
      projectId: row.project_id,
      projectName: row.project_id ? (sources.names[row.project_id] ?? null) : null,
      title: row.title ?? row.task_id ?? row.request_id ?? row.key,
      // The kind, as a value: every screen says it through `detailOf` in the operator's language.
      detail: row.kind,
      since: row.still_since,
      swept: { key: row.key, kind: row.kind }
    })
  }
  // #endregion attention-swept
  return items.sort((a, b) =>
    RANK[a.kind] !== RANK[b.kind]
      ? RANK[a.kind] - RANK[b.kind]
      : Date.parse(a.since) - Date.parse(b.since)
  )
}

/** What is waiting, per project. */
export interface ProjectAttention {
  access: number
  refused: number
  proposal: number
  review: number
  abandoned: number
  total: number
}

/**
 * Group the queue by project, for the estate cards (M147).
 *
 * DERIVED FROM THE SAME ITEMS THE PANEL SHOWS, and that is the whole design.
 * A card counting "what needs me" by its own query would drift from the panel
 * the first time either changed — and two numbers describing the same thing,
 * on two surfaces, is worse than one surface having none: the operator cannot
 * tell which is wrong, so neither is usable.
 *
 * Items with no project are counted by nobody. A refusal that names no project
 * belongs to the estate, and putting it on an arbitrary card would be inventing
 * a home for it.
 */
export function attentionByProject(
  items: readonly AttentionItem[]
): Record<string, ProjectAttention> {
  const out: Record<string, ProjectAttention> = {}
  for (const item of items) {
    if (!item.projectId) continue
    const row = (out[item.projectId] ??= { access: 0, refused: 0, proposal: 0, review: 0, abandoned: 0, total: 0 })
    row[item.kind] += 1
    row.total += 1
  }
  return out
}

/**
 * The one string form, for a React key or a "told about it already" set.
 *
 * The OBLIGATION's address, not the subject's — a review and an expired lease
 * over the same task are two things waiting, and one key for both would tell
 * the operator about only the first of them, forever.
 */
export function attentionKey(item: Pick<AttentionItem, 'kind' | 'ref' | 'swept'>): string {
  // A finding's key is its own address (SW-9): two findings over one task (a silent claim and a stalled terminal), or
  // a finding and an expired lease over it, are separate obligations and are told separately, each once.
  return item.swept ? `${item.kind}/${item.swept.key}` : obligationRef(item.kind, item.ref)
}

/**
 * What the estate may SAY about what is waiting (UXA-C01, widened by UXA-C02).
 *
 * MEASURED at `2e4b25e`: the home's effect was written
 * `.catch(() => setWaiting({}))`, so a read that could not be made became
 * "nothing is waiting on any project" — on every card at once, with nothing
 * said anywhere. The two other readers of this same query, `AttentionPanel` and
 * the `BoardPanel` ten lines above the cards, both keep the failure and render
 * it. The third did neither.
 *
 * That path also breaks M147, which is the reason the cards and the panel share
 * one query at all: the panel raised a banner and the cards showed calm, so the
 * operator was given two accounts of one fact and no way to tell which was
 * wrong — arrived at through the error path rather than through a second query.
 *
 * UXA-C02 WIDENED IT, and the wider case is the one that RESOLVES. The main
 * process reads five sources for this queue; when one refuses the others still
 * answer, so the promise keeps its word and hands over a queue missing an
 * entire class of obligation. A bare list cannot say that, so the answered arm
 * carries the whole envelope (S14) and the screen asks it what it may claim.
 *
 * THREE ARMS, in the shape `QuotaReading` already uses for the same class of
 * mistake (AX-14):
 *
 * - `read: false` — nobody has looked yet. It is NOT a count of zero, and it is
 *   deliberately rendered as silence rather than as a qualification: the read
 *   fires on mount and settles in milliseconds, so a chip saying "unknown" on
 *   every card on every paint would be noise, and the estate makes no claim in
 *   the meantime. `waitingProblem` is what separates it from the third arm.
 * - `read: true, envelope` — the read happened and reports on itself. Complete,
 *   partial or unavailable is the envelope's own derivation, and a caller has
 *   no way to be told otherwise.
 * - `read: true, failed` — the call never arrived. Distinct from an envelope
 *   that says `unavailable`: that one answered and named its sources, this one
 *   did not answer at all. Both produce the same sentence and differ in reason.
 */
export type WaitingReading =
  | { read: false }
  | { read: true; envelope: ReadEnvelope<AttentionItem[]> }
  | { read: true; failed: string }

/**
 * Why the counts on screen are not totals, or null because they are.
 *
 * ONE shape for two causes, because the screen's decision is one: a source that
 * refused and a window that was cut both mean "this is less than everything",
 * and `why` is where they differ. `envelope()` already makes an omission
 * produce `partial`, so this reads that derivation rather than repeating it.
 */
export interface WaitingProblem {
  kind: 'unreadable' | 'partial'
  why: string
}

export function waitingProblem(reading: WaitingReading): WaitingProblem | null {
  if (!reading.read) return null
  if ('failed' in reading) return { kind: 'unreadable', why: reading.failed }
  const e = reading.envelope
  const refused = refusedBy(e)
  if (refused !== null) return { kind: 'unreadable', why: refused }
  if (e.availability === 'complete') return null
  const said = [
    ...e.sources.filter((x) => x.status !== 'ok').map((x) => `${x.name} (${x.errorCode ?? x.status})`),
    ...e.omitted.map((o) => o.reason)
  ]
  // A partial answer with nothing to say about why is still partial. Saying so
  // without a reason beats letting the counts read as totals.
  return { kind: 'partial', why: said.length > 0 ? said.join('; ') : 'part of this read did not arrive' }
}

/**
 * What is waiting, per project, or null when there is nothing to count from.
 *
 * Null on both silent arms and on an unavailable envelope, and that is the
 * point: there is NO path from a read that did not answer to a number, so a
 * card cannot render an outage as a calm count by forgetting a branch.
 */
export function waitingCounts(
  reading: WaitingReading
): Record<string, ProjectAttention> | null {
  if (!reading.read || 'failed' in reading) return null
  const e = reading.envelope
  return e.data === null ? null : attentionByProject(e.data)
}

/**
 * One receipt per source consulted, ANSWERED OR NOT (UXA-C02).
 *
 * Lives here rather than in the main process because `index.ts` cannot be
 * imported — anything defined there is reachable only by launching the app, and
 * this derivation is the one a plant has to be able to reach.
 *
 * IT USED TO BE A LIST OF FAILURES, and a list of failures cannot describe a
 * partial read. `envelope()` derives availability by comparing what answered
 * against what was consulted, so a source it never hears about is a source that
 * did not answer: handing it only the refusals turns "one of five refused" into
 * `unavailable`, which would hide the four that worked. The card's own
 * acceptance is that an outage in one source does not hide the other projects,
 * and naming every source either way is what makes that true by construction.
 */
export function obligationReceipts(
  reads: readonly { source: string; error: { message?: string } | null }[],
  stamp: string
): SourceReceipt[] {
  return reads.map(({ source, error }) =>
    error
      ? {
          name: `obligations/${source}`,
          status: 'error' as const,
          asOf: null,
          errorCode: error.message ?? 'unknown'
        }
      : { name: `obligations/${source}`, status: 'ok' as const, asOf: stamp }
  )
}
