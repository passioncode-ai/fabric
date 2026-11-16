// #region task-tools — docs: docs/evidence/plans/2026-11-16-screens-waves.md#s2--the-boards-protocol-code-next
/**
 * A session's task tools: create, hand off, claim, release, move, close, note, link, brief and accept. Moved out of
 * `agentSurface.ts#serverFor` as one group (the screens waves S2, 2026-11-16); every tool keeps its own comments, and
 * every read is the credential-scoped store's, narrowed to the session's estate and project.
 */
import { briefNext, specGaps, type BriefParts } from '../shared/taskSpec.ts'
import { randomUUID } from 'node:crypto'
import { linkOutcome, linkRefusal, type LinkVerdict } from '../shared/taskLinks.ts'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ScopedStore } from './scopedStore.ts'
import type { SourceResolution } from './backlogSource.ts'
import type { AgentScope, AgentSurfaceDeps } from './agentSurface.ts'
import { ORIGIN_KINDS } from '../shared/origin.ts'
import { DEFAULT_BOUND, mayChain } from '../shared/loopBound.ts'
import { spawnedChainFrom, spawnParentOf, type LiveClaim } from '../shared/spawnParent.ts'
import { fileProposal } from './commands/proposalCommands.ts'
import { TERMINAL, mayMove, type TaskState } from '../shared/ladder.ts'
import { checkRelayedClose } from './relayedClose.ts'
import { assertAgentReference } from './agentReference.ts'
import { refusalAfterWrite, runHoldRefusal } from '../shared/workClaims.ts'
import { readRunHolds } from './workRead.ts'

/** A backlog row by its address (REQ-08; plan R-07: link, don't copy). */
export const SOURCE_SCHEMA = z
  .object({ repository: z.string().min(1).max(300), path: z.string().min(1).max(300), id: z.string().min(1).max(64) })
  .describe('The backlog row this task serves: the repository (its remote — https://github.com/owner/name or owner/name — or its folder), the file\'s path in it, and the row\'s id. Linked, never copied: the row keeps its status in its file.')

/**
 * What a repeated hand-off of one name IS (PF-09.02).
 *
 * "Handing the same name twice replaces it" was written for the producer
 * correcting itself BEFORE anyone read the value. Once a follower has left
 * backlog, the old value is CONSUMED — somebody's work stands on it — and a
 * late edit must not mutate it in place: the correction lands as a NEW
 * REVISION and every follower that consumed the old one is named stale.
 */
export function handoffDisposition(
  hadPrior: boolean,
  followers: ReadonlyArray<{ id: string; status: string }>
): { kind: 'first' } | { kind: 'replace' } | { kind: 'revision'; staleDownstream: string[] } {
  if (!hadPrior) return { kind: 'first' }
  const consumed = followers.filter((f) => f.status !== 'backlog').map((f) => f.id)
  if (consumed.length === 0) return { kind: 'replace' }
  return { kind: 'revision', staleDownstream: consumed }
}

/**
 * Which live neighbours' write scopes overlap the requested ones (PF-09.02).
 *
 * A task lease is exclusivity over the TASK; it never protects a FILE — two
 * tasks legitimately claimed can still write one path, and pretending the
 * lease covers it is the false task-only claim. Overlap is prefix-or-equal
 * in either direction, so `src/auth/` collides with `src/auth/login.ts`.
 */
export function writeScopeConflicts(
  requested: readonly string[],
  neighbours: ReadonlyArray<{ work_id: string; owner_session: string; write_scopes: readonly string[] }>
): Array<{ scope: string; with_task: string; held_by: string; their_scope: string }> {
  const overlaps = (a: string, b: string): boolean =>
    a === b || a.startsWith(b) || b.startsWith(a)
  const out: Array<{ scope: string; with_task: string; held_by: string; their_scope: string }> = []
  for (const mine of requested)
    for (const n of neighbours)
      for (const theirs of n.write_scopes)
        if (overlaps(mine, theirs))
          out.push({ scope: mine, with_task: n.work_id, held_by: n.owner_session, their_scope: theirs })
  return out
}

/**
 * Whether THIS session may publish a result onto THIS task (PF-09.01).
 *
 * fabric_task_handoff used to accept any taskId in the project — no live
 * lease, no attempt check — so a foreign or stale session could publish over
 * the current owner. The rule: a result publishes from the task the session
 * IS (its own task), or from a task whose LIVE lease this session holds. A
 * live lease held by another session refuses with the holder named; the
 * caller's own EXPIRED lease refuses as stale (re-claim, then publish) —
 * an expired attempt writing results is the split-brain this closes.
 */
export function mayPublishHandoff(
  scope: { sessionId: string; taskId: string | null },
  taskId: string,
  lease: { owner_session: string; expires_at: string } | null,
  now: number
): { ok: true } | { ok: false; reason: string; heldBy?: string } {
  if (scope.taskId === taskId) {
    // The session's own task — but not while somebody ELSE holds a live lease
    // on it (a takeover after this session's claim lapsed).
    if (lease && lease.owner_session !== scope.sessionId &&
        new Date(lease.expires_at).getTime() > now)
      return {
        ok: false,
        reason: 'another session holds a live claim on this task — a result publishes only from the live owner',
        heldBy: lease.owner_session
      }
    return { ok: true }
  }
  if (!lease)
    return {
      ok: false,
      reason: 'not your task and no claim held — claim it first: a result publishes only from an authenticated owner'
    }
  if (lease.owner_session !== scope.sessionId) {
    if (new Date(lease.expires_at).getTime() > now)
      return {
        ok: false,
        reason: 'another session holds this task',
        heldBy: lease.owner_session
      }
    return {
      ok: false,
      reason: 'the last claim on this task expired and it was not yours — claim it before publishing'
    }
  }
  if (new Date(lease.expires_at).getTime() <= now)
    return {
      ok: false,
      reason: `your claim expired at ${lease.expires_at} — a stale attempt does not publish; re-claim and re-publish`
    }
  return { ok: true }
}

export interface TaskToolsDeps {
  store: ScopedStore
  db: AgentSurfaceDeps['db']
  journal: AgentSurfaceDeps['journal']
  ptys: AgentSurfaceDeps['ptys']
  /** A task of this project, or null; throws when it could not be read. */
  ownTask(taskId: string): Promise<{ id: string; status: TaskState; title: string | null; instruction: string } | null>
  /** The surface's other ports (policy, access, nudges, work), read where a tool needs one. */
  deps: AgentSurfaceDeps
  /** The surface's journal append, payload scrubbed for an agent (`agentSurface.ts#appendRedacted`). */
  append(input: { estateId: string; type: string; actor: { kind: string; id: string }; projectId?: string | null; payload: Record<string, unknown> }): Promise<{ seq: number }>
  resolveSourceFor(scope: AgentScope, source: { repository: string; path: string; id: string }): Promise<SourceResolution>
  linkSource(scope: AgentScope, taskId: string, s: Extract<SourceResolution, { ok: true }>): Promise<void>
}

function json(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

export function registerTaskTools(server: McpServer, deps: TaskToolsDeps, scope: AgentScope): void {
  const { store, db, journal, ptys, ownTask } = deps
  server.registerTool(
    'fabric_task_create',
    {
      title: 'File a task on this project’s board',
      description:
        'Put work on the board — something you found that should happen, or a piece you are splitting off. It lands in backlog for the operator to see. You must say where it came from: a card with no evidence behind it is noise on someone else’s board.',
      inputSchema: {
        title: z.string().min(3).max(200).describe('What should happen, in a line the project\'s owner understands without context, in the working language fabric_whoami names (or the person\'s own, when it names none) ("Keep the computer awake while an agent works"); an id goes in source, not here'),
        origin: z
          .object({
            // M124 — `document` and `memory` join the list. Before them an
            // agent filing work from a decision somebody WROTE DOWN had to
            // call it an observation, which is the word for something Fabric
            // measured. The enum is imported rather than retyped: `origin.ts`
            // owns it because it also owns how a ref is walked backwards.
            kind: z.enum(ORIGIN_KINDS),
            ref: z
              .string()
              .min(1)
              .max(300)
              .describe(
                'The file and line (docs/adr/0014.md:22), the memory fact id, the command, or the task id. A line or range at the end is the LOCATION; the rest is the document, and other tasks from the same document are shown beside this one.'
              )
          })
          .describe('What this came out of. Required — evidence is what makes it actionable'),
        section: z.string().max(80).optional().describe('Where it belongs, if the project uses sections'),
        source: SOURCE_SCHEMA.optional()
      }
    },
    async ({ title, origin, section, source }) => {
      assertAgentReference(origin.ref)
      assertAgentReference(section)
      // REQ-08: the backlog row it serves is resolved BEFORE anything is filed, so a row that does not resolve files nothing.
      const linked = source ? await deps.resolveSourceFor(scope, source) : null
      if (linked && !linked.ok)
        return json({ created: false, code: 'source-unresolved', part: linked.part, reason: linked.reason })
      // M68 — how far has this hand-off already travelled?
      //
      // The chain parent is the session's OWN task, not whatever the agent
      // named as origin. An agent working task X that files new work produced
      // it from X; `origin` is its claim about why, and `scope.taskId` is what
      // Fabric observed. Counting the claim would let a chain hide itself by
      // naming something else.
      //
      // A session Fabric did not launch on a task (joined from its own
      // terminal, enrolled, the hub) has no `scope.taskId`; its parent is the
      // ONE task it holds a live claim on here (0.3.14 review, iteration 2,
      // PL-1/DA-1). None or several: no link, and the answer says why.
      // CO-466: read for a launched session too: one claimed task other than its own is what it works on now.
      const claimsRead = await store.select('work_claims', 'work_id,project_id').eq('owner_session', scope.sessionId).is('released_at', null)
      const spawn = spawnParentOf(
        scope.taskId,
        scope.projectId,
        claimsRead ? ((claimsRead.data ?? []) as LiveClaim[]) : [],
        claimsRead?.error ? claimsRead.error.message : null
      )
      let parentTask = spawn.parent
      // ER-24, DA-8 (0.3.14 review, iteration 3): the chain is walked up from the parent a task at a time, each read's
      // error kept. A read that failed cannot judge the depth as safe: the piece is filed WITHOUT the spawned link
      // (never a too-deep chain let through, never a failed create), and `spawned_from_why` says why.
      let chainUnread: string | null = null
      let chainFrom: Record<string, string[]> = {}
      if (parentTask) {
        const walk = await spawnedChainFrom(async (taskId) => {
          const r = await store.select('task_links', 'task_id,target_id').eq('rel', 'spawned').eq('target_kind', 'task').eq('task_id', taskId)
          return r.error ? { parents: [], failed: r.error.message } : { parents: ((r.data ?? []) as Array<{ target_id: string }>).map((l) => String(l.target_id)), failed: null }
        }, parentTask, DEFAULT_BOUND + 1)
        if (walk.failed) {
          chainUnread = `the hand-off chain above ${parentTask} could not be read (${walk.failed}), so Fabric could not check the chain bound and filed this piece without its spawned link; link it with fabric_task_link once the chain reads again`
          parentTask = null
        }
        chainFrom = walk.from
      }
      if (parentTask) {
        const verdict = mayChain(chainFrom, parentTask)
        if (!verdict.ok) {
          // M168 — through the ONE door, with the surface's redacting
          // appender handed in. This used to append here, applying `mayChain`
          // and no other rule: a different set from the operator's path, and
          // neither knew about the other.
          const { proposalId } = await fileProposal({
            journal: deps.deps.journal,
            estateId: scope.estateId,
            projectId: scope.projectId,
            actor: { kind: 'agent', id: scope.sessionId },
            title,
            origin,
            fromTaskId: parentTask,
            depth: verdict.depth,
            bound: verdict.bound,
            append: (e) => deps.append(e as Parameters<TaskToolsDeps['append']>[0])
          })
          return json({
            created: false,
            proposed: true,
            proposal_id: proposalId,
            depth: verdict.depth,
            bound: verdict.bound,
            reason: verdict.reason,
            // DA-7 (iteration 3): the proposal answer names the link like every other answer of this tool.
            spawned_from: null,
            spawned_from_why: verdict.reason ?? `the chain bound (${verdict.bound}) was reached`
          })
        }
      }

      const id = randomUUID()
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'task.created@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: { id, title, instruction: title, origin, section: section ?? null, task_type: 'development' }
      })
      await deps.append({
        estateId: scope.estateId,
        type: 'task.assigned@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: { task_id: id, assigned_by: `agent:${scope.sessionId}`, assigned_to: 'operator' }
      })
      if (linked?.ok) await deps.linkSource(scope, id, linked)
      // The link is what MAKES the chain. Without it every hand-off is depth
      // one forever and the bound above can never trip — the failure mode that
      // looks exactly like a bound nobody has hit yet.
      //
      // THROUGH THE SAME DOOR (FA-04). This used to append the edge itself,
      // which made it a second writer of `task.linked@1` with none of the
      // command's rules — no scope floor, no topology, no idempotency. A
      // second door is a second set of rules, and they diverge on the day
      // somebody is in a hurry.
      let chained: LinkVerdict | null = null
      if (parentTask) {
        const { data, error } = await db.rpc('link_tasks', {
          p_estate_id: scope.estateId,
          p_task_id: id,
          p_rel: 'spawned',
          p_target_id: parentTask,
          p_actor: { kind: 'agent', id: scope.sessionId },
          p_project_id: scope.projectId
        })
        // Reported, never swallowed. The task exists either way, and a caller
        // that believes it built a chain when it did not is the failure this
        // link exists to prevent — depth stays one forever and the bound never
        // trips, which looks exactly like a bound nobody has reached.
        chained = linkOutcome(data, error)
      }
      return json({
        created: true,
        id,
        status: 'backlog',
        seq: event.seq,
        ...(linked?.ok ? { source: { repository: linked.repository, path: linked.path, id: linked.rowId, id_checked: linked.idChecked } } : {}),
        ...(chained ? { chained_to: parentTask, chained: chained.linked === true,
                        ...(chained.linked ? {} : { chain_reason: chained.says ?? chained.reason_code }) } : {}),
        // Which task this piece was spawned from, and when none: why (PL-1/DA-1). CO-466: a link from the claimed task
        // rather than the launch task says why too.
        spawned_from: chained?.linked ? parentTask : null,
        ...(chained?.linked ? (spawn.why ? { spawned_from_why: spawn.why } : {}) : { spawned_from_why: chainUnread ?? spawn.why ?? chained?.says ?? chained?.reason_code ?? 'the link was refused' })
      })
    }
  )

  server.registerTool(
    'fabric_task_handoff',
    {
      title: 'Hand something on',
      description:
        'Record a NAMED result of this task, for whatever task follows it. The follower declares which names it needs and does not start without them — so an empty value is the same as no value, and saying nothing here stops the chain rather than starting the next step on a blank. Handing the same name twice replaces it.',
      inputSchema: {
        taskId: z.string().uuid(),
        name: z
          .string()
          .min(1)
          .max(60)
          .describe('What this is, in the follower’s words — the name it asked for'),
        value: z.string().min(1).max(8000).describe('The thing itself, as text a person can read')
      }
    },
    async ({ taskId, name, value }) => {
      assertAgentReference(name)
      const task = await ownTask(taskId)
      if (!task) return json({ recorded: false, reason: 'no such task in this project' })
      // PF-09.01 — publication is authenticated: the session's own task, or a
      // task whose LIVE lease this session holds. Checked before the append…
      const { data: held } = await store
        .select('leases', 'owner_session,expires_at')
        .eq('work_id', taskId)
        .maybeSingle()
      const verdict = mayPublishHandoff(
        { sessionId: scope.sessionId, taskId: scope.taskId },
        taskId,
        (held as { owner_session: string; expires_at: string } | null) ?? null,
        Date.now()
      )
      if (!verdict.ok)
        return json({ recorded: false, reason: verdict.reason,
                      ...(verdict.heldBy ? { held_by: verdict.heldBy } : {}) })
      // PF-09.02 — an accepted output is immutable. A repeat of the same
      // name is a REPLACE only while nothing consumed it; once a follower
      // left backlog, it is a new REVISION and the consumers are named
      // stale rather than silently re-based.
      const [{ data: prior }, { data: followLinks }] = await Promise.all([
        store.select('task_handoffs', 'name').eq('task_id', taskId).eq('name', name),
        store.select('task_links', 'task_id').eq('rel', 'follows')
          .eq('target_kind', 'task').eq('target_id', taskId)
      ])
      let followers: Array<{ id: string; status: string }> = []
      const followerIds = (followLinks ?? []).map((l) => l.task_id as string)
      if (followerIds.length) {
        // Chunked and error-read, the same 414 the chain advancer hit: a list
        // as long as the data becomes a URL the gateway refuses, and
        // `.data ?? []` turned that into "no followers", which here decides
        // the handoff's disposition.
        const read = await store.selectIn('project_tasks', 'id,status', 'id', followerIds)
        if (read.failed) throw new Error(read.failed)
        followers = read.rows.map((r) => ({ id: r.id as string, status: r.status as string }))
      }
      const disposition = handoffDisposition(Boolean(prior?.length), followers)
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'task.handoff@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: { task_id: taskId, name, value,
                   owner: scope.sessionId,
                   disposition: disposition.kind,
                   stale_downstream: disposition.kind === 'revision' ? disposition.staleDownstream : [],
                   fence: (held as { expires_at?: string } | null)?.expires_at ?? null }
      })
      // …and re-read after: append_event serializes per estate, so the lease
      // read back AFTER our write is the arbitrated truth. Ownership that
      // moved mid-publication is reported, not papered over — the projection
      // arbitrates by seq and the loser's write must not read as accepted.
      const { data: settled } = await store
        .select('leases', 'owner_session,expires_at')
        .eq('work_id', taskId)
        .maybeSingle()
      if (settled && settled.owner_session !== scope.sessionId &&
          new Date(settled.expires_at as string).getTime() > Date.now() &&
          scope.taskId !== taskId)
        return json({ recorded: false,
                      reason: 'ownership moved mid-publication — re-claim and re-publish',
                      held_by: settled.owner_session, seq: event.seq })
      if (disposition.kind === 'revision')
        return json({ recorded: true, name, seq: event.seq, revision: true,
                      stale_downstream: disposition.staleDownstream,
                      note: 'the earlier value was already consumed — this lands as a new revision; the named followers ran on the old one and are stale' })
      return json({ recorded: true, name, seq: event.seq })
    }
  )

  server.registerTool(
    'fabric_task_claim',
    {
      title: 'Take a task',
      description:
        'Claim a task before working on it, so another agent does not start the same work. The claim expires: if you are still on it when it does, claim again. Refused when someone else holds it, and it tells you who and until when. When the task\'s brief misses a part, the answer names it (brief_missing) and how to write it (brief_next): write it with fabric_task_brief.',
      inputSchema: {
        taskId: z.string().uuid(),
        minutes: z.number().int().min(1).max(240).optional().describe('How long you expect to need. Default 30'),
        writeScopes: z
          .array(z.string().min(1))
          .optional()
          .describe('What you intend to write — paths or areas, so a neighbour can see the overlap'),
        source: SOURCE_SCHEMA.optional()
      }
    },
    async ({ taskId, minutes, writeScopes, source }) => {
      for (const reference of writeScopes ?? []) assertAgentReference(reference)
      const task = await ownTask(taskId)
      if (!task) return json({ claimed: false, reason: 'no such task in this project' })
      if (TERMINAL.includes(task.status))
        return json({ claimed: false, reason: `that task is ${task.status}` })
      // REQ-08: the task is linked to the backlog row it serves (an address, never a copy), before the claim.
      if (source) {
        const linked = await deps.resolveSourceFor(scope, source)
        if (!linked.ok) return json({ claimed: false, code: 'source-unresolved', part: linked.part, reason: linked.reason })
        await deps.linkSource(scope, taskId, linked)
      }

      const { data: held } = await store
        .select('leases', 'owner_session,expires_at')
        .eq('work_id', taskId)
        .maybeSingle()
      const live = held && new Date(held.expires_at as string).getTime() > Date.now()
      // A run Fabric launched for the task holds it until proved stopped; a lapsed lease is not that proof (CO-323).
      const runHold = (await readRunHolds(store, [taskId])).find((h) => h.sessionId !== scope.sessionId) ?? null
      if (runHold) return json(runHoldRefusal(taskId, runHold, held as { expires_at: string } | null, Date.now()))
      if (live && held.owner_session !== scope.sessionId)
        return json({
          claimed: false,
          reason: 'another session holds this task',
          held_by: held.owner_session,
          until: held.expires_at
        })

      const expiresAt = new Date(Date.now() + (minutes ?? 30) * 60_000).toISOString()
      await deps.append({
        estateId: scope.estateId,
        type: 'work.claimed@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: {
          work: taskId,
          owner: scope.sessionId,
          idempotency_key: `${scope.sessionId}:${taskId}:${expiresAt}`,
          expires_at: expiresAt,
          write_scopes: writeScopes ?? []
        }
      })
      // The read above is a courtesy, not the decision. Two agents that read
      // "free" in the same instant both append, and the PROJECTION arbitrates
      // by seq — so the answer an agent can trust is the one read back after
      // the write. A claim is a command in the contract's own words
      // (`coordination.schema.json` is titled "command or event"), and a
      // command can be refused after it is issued.
      const { data: settled } = await store
        .select('leases', 'owner_session,expires_at')
        .eq('work_id', taskId)
        .maybeSingle()
      if (!settled || settled.owner_session !== scope.sessionId) {
        // Named from what holds the task now — never "the same moment" for a lease that lapsed before the write.
        const holds = await readRunHolds(store, [taskId])
        const { data: holder } = await store.select('work_claims', 'agent,came_in,claimed_at').eq('work_id', taskId).is('released_at', null).maybeSingle()
        return json(refusalAfterWrite({
          taskId, me: scope.sessionId, now: Date.now(),
          lease: settled as { owner_session: string; expires_at: string } | null,
          holder: holder as Parameters<typeof refusalAfterWrite>[0]['holder'],
          hold: holds.find((h) => h.sessionId !== scope.sessionId) ?? null
        }))
      }
      // PF-09.02 — the lease is exclusivity over the TASK, never over a
      // FILE. Overlapping write scopes on other live leases are reported,
      // because the false comfort is believing the task claim covers the
      // path. Reported, not refused: two tasks may legitimately touch one
      // file in sequence — but nobody discovers the overlap at merge time.
      let scopeConflicts: ReturnType<typeof writeScopeConflicts> = []
      if ((writeScopes ?? []).length) {
        const { data: neighbours } = await store
          .select('leases', 'work_id,owner_session,expires_at,write_scopes')
          .eq('project_id', scope.projectId)
        scopeConflicts = writeScopeConflicts(
          writeScopes ?? [],
          (neighbours ?? [])
            .filter((n) => n.work_id !== taskId &&
              new Date(n.expires_at as string).getTime() > Date.now())
            .map((n) => ({ work_id: n.work_id as string,
                           owner_session: n.owner_session as string,
                           write_scopes: (n.write_scopes as string[]) ?? [] }))
        )
      }
      // #region task-claim-brief — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#review-iteration-1
      // The 0.3.14 review, iteration 1, PL-10: the rule every session reads claims with fabric_task_claim, so its
      // answer names the brief's missing parts as fabric_work_claim's does. Advisory: a brief that could not be read
      // adds nothing and refuses nothing.
      const brief = await store.select('project_tasks', 'brief_what,brief_why,brief_expected').eq('id', taskId).maybeSingle()
      const gaps = brief.error || !brief.data ? [] : specGaps(brief.data as BriefParts)
      // #endregion task-claim-brief
      return json({ claimed: true, task_id: taskId, until: settled.expires_at,
                    ...(gaps.length ? { brief_missing: gaps, brief_next: briefNext(gaps) } : {}),
                    ...(scopeConflicts.length
                      ? { scope_conflicts: scopeConflicts,
                          note: 'a task lease does not protect a file — coordinate these paths explicitly' }
                      : {}) })
    }
  )

  server.registerTool(
    'fabric_task_release',
    {
      title: 'Let a task go',
      description:
        'Release your claim when you stop working on a task, so someone else can take it. Say how it ended. This does not change the task’s state on the board — moving it is a separate act.',
      inputSchema: {
        taskId: z.string().uuid(),
        outcome: z.enum(['succeeded', 'failed', 'cancelled', 'abandoned'])
      }
    },
    async ({ taskId, outcome }) => {
      const { data: held } = await store
        .select('leases', 'owner_session')
        .eq('work_id', taskId)
        .maybeSingle()
      if (!held) return json({ released: false, reason: 'you do not hold that task' })
      if (held.owner_session !== scope.sessionId)
        return json({ released: false, reason: 'another session holds that task' })
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'work.released@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: { work: taskId, owner: scope.sessionId, outcome }
      })
      const { data: remaining, error: readError } = await store
        .select('leases', 'owner_session').eq('work_id', taskId).maybeSingle()
      if (readError) return json({ released: false, reason: 'release could not be confirmed', seq: event.seq })
      if (remaining?.owner_session === scope.sessionId)
        return json({ released: false, reason: 'the run is unresolved; stop it and confirm its exit first', seq: event.seq })
      return json({ released: true, seq: event.seq })
    }
  )

  server.registerTool(
    'fabric_task_move',
    {
      title: 'Move a task on the board',
      description:
        'Move a task between backlog, running and review. You cannot mark work done or cancelled on your own: move it to review and say what you concluded; accepting it is the operator’s move. When the operator told you to close or cancel this very task, use fabric_task_close with their words as the decision.',
      inputSchema: {
        taskId: z.string().uuid(),
        to: z.enum(['backlog', 'running', 'review']),
        note: z.string().max(400).optional().describe('One line on why it moved')
      }
    },
    async ({ taskId, to, note }) => {
      const task = await ownTask(taskId)
      if (!task) return json({ moved: false, reason: 'no such task in this project' })
      const verdict = mayMove('agent', task.status, to as TaskState)
      if (!verdict.ok) return json({ moved: false, reason: verdict.reason })
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'task.moved@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: { task_id: taskId, from: task.status, to, note: note ?? null }
      })
      return json({ moved: true, from: task.status, to, seq: event.seq })
    }
  )

  // #region relayed-close-tool — docs: docs/adr/0184-an-agent-closes-a-task-on-the-operators-relayed-decision.md
  // CO-478: the dashboard's close and cancel buttons as an agent's door, only with the operator's relayed words.
  server.registerTool(
    'fabric_task_close',
    {
      title: 'Close or cancel a task on the operator’s word',
      description:
        'Close a task as done or cancelled ONLY when the operator told you to, about this task (fabric-agent-contract DEC-0121 AP-2). ' +
        'Pass their words as decision (or as _meta.decision): {by: "operator", via: "relayed-instruction", action: "task.close", target: the task id or its first 8 characters, ' +
        'instruction: their words verbatim (at most 500 characters), at: when they said it (RFC 3339), source?: {project, session or thread} where they said it}. ' +
        'Without it the answer is operator-decision-required: ask the operator, or move the task to review. Never write words the operator did not say. ' +
        'A cancellation needs a reason. Fabric records the decision with the close.',
      inputSchema: {
        taskId: z.string().uuid(),
        outcome: z.enum(['done', 'cancelled']),
        reason: z.string().max(400).optional().describe('One line on why; required to cancel'),
        decision: z.unknown().optional().describe('The operator’s decision, decision.schema.json')
      }
    },
    async ({ taskId, outcome, reason, decision }, extra) => {
      const relayed = decision ?? (extra as { _meta?: { decision?: unknown } } | undefined)?._meta?.decision
      const verdict = checkRelayedClose(relayed, taskId, Date.now())
      if (!verdict.ok) {
        const error = { code: verdict.code, message: verdict.message, data: verdict.data }
        return { content: [{ type: 'text' as const, text: JSON.stringify({ closed: false, error }) }], structuredContent: { closed: false, error }, isError: true }
      }
      if (outcome === 'cancelled' && (reason ?? '').trim().length === 0)
        return json({ closed: false, reason: 'cancelling needs a reason: say what changed' })
      const task = await ownTask(taskId)
      if (!task) return json({ closed: false, reason: 'no such task in this project' })
      // The decision is the person's move, relayed: the person's ladder applies, never the agent's.
      const move = mayMove('person', task.status, outcome as TaskState)
      if (!move.ok) return json({ closed: false, reason: move.reason })
      const d = verdict.decision
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'task.closed@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: {
          task_id: taskId, outcome, reason: reason ?? null,
          decision: { by: d.by, via: d.via, action: d.action, target: d.target ?? null, instruction: d.instruction, at: d.at, ...(d.source ? { source: d.source } : {}) }
        }
      })
      return json({ closed: true, from: task.status, to: outcome, seq: event.seq })
    }
  )
  // #endregion relayed-close-tool

  server.registerTool(
    'fabric_task_note',
    {
      title: 'Leave a note on a task',
      description:
        'Working notes for one task — what you tried, what you ruled out, where you got to. They are append-only and they are NOT documentation: a note worth keeping past this task gets promoted to project memory, and the task keeps a link to it.',
      inputSchema: {
        taskId: z.string().uuid(),
        body: z.string().min(1).max(4000).describe('Markdown')
      }
    },
    async ({ taskId, body }) => {
      const task = await ownTask(taskId)
      if (!task) return json({ noted: false, reason: 'no such task in this project' })
      const noteId = randomUUID()
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'task.note.added@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: { task_id: taskId, note_id: noteId, body_md: body }
      })
      return json({ noted: true, note_id: noteId, seq: event.seq })
    }
  )

  server.registerTool(
    'fabric_task_link',
    {
      title: 'Link two tasks',
      description:
        'Say how two tasks relate: taskId is the task the link belongs to, targetTaskId the one it points at. rel "spawned" means taskId was split off FROM targetTaskId (the parent spawned the child: taskId is the child, targetTaskId the parent, the task the person set); "blocks" means taskId blocks targetTaskId; "follows" means taskId comes after targetTaskId. Refused when the link would close a cycle, and it names the loop: a board where A waits for B waits for A is one nobody can act on.',
      inputSchema: {
        taskId: z.string().uuid(),
        rel: z.enum(['blocks', 'follows', 'spawned']),
        targetTaskId: z.string().uuid()
      }
    },
    async ({ taskId, rel, targetTaskId }) => {
      // ONE CALL, and that is the fix (FA-04). This used to ask
      // `would_close_cycle` in one round trip and append in another, which
      // failed twice: `error` was destructured away, so a check that could not
      // run waved the write through; and two clients linking A->B and B->A both
      // read "no cycle" before either wrote. Measured against the live stack:
      // both saw false, both wrote, the journal took two events and the board
      // kept one — the projector drops a cyclic edge with a warning, so the
      // estate's history held something its projection did not contain.
      //
      // `link_tasks` takes the estate lock BEFORE it asks, so scope, topology
      // and the append are one indivisible act, and every refusal arrives as a
      // typed reason rather than as an absence.
      const { data, error } = await db.rpc('link_tasks', {
        p_estate_id: scope.estateId,
        p_task_id: taskId,
        p_rel: rel,
        p_target_id: targetTaskId,
        p_actor: { kind: 'agent', id: scope.sessionId },
        p_project_id: scope.projectId
      })
      const verdict = linkOutcome(data, error)
      if (!verdict.linked)
        return json({
          linked: false,
          reason_code: verdict.reason_code,
          reason: linkRefusal(verdict)
        })
      return json({ linked: true, already: verdict.already === true, seq: verdict.seq })
    }
  )

  server.registerTool(
    'fabric_task_brief',
    {
      title: 'Draft what a task is for',
      description:
        'Write the brief of a task you are working on: what should happen, why, and what will be true when it is done. The "what" section is the task\'s summary on the home screen and the project page: write it first, as one or two plain sentences the owner understands without context, in the working language fabric_whoami names (or the person\'s own, when it names none). Yours is a DRAFT — the operator can replace any section, and both versions stay readable. Keep it to the task; anything worth knowing past this task belongs in fabric_memory_remember.',
      inputSchema: {
        taskId: z.string().uuid(),
        section: z.enum(['what', 'why', 'expected']),
        body: z.string().min(1).max(2000).describe('Markdown, a few lines')
      }
    },
    async ({ taskId, section, body }) => {
      const task = await ownTask(taskId)
      if (!task) return json({ written: false, reason: 'no such task in this project' })
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'task.brief.edited@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: { task_id: taskId, section, body_md: body }
      })
      return json({ written: true, section, seq: event.seq })
    }
  )

  server.registerTool(
    'fabric_task_accept',
    {
      title: 'Confirm the instruction you were given',
      description:
        'When you are handed a task instruction, say that you have it — quoting the digest you were given with it. Until you do, Fabric records the instruction as WRITTEN but unconfirmed, because bytes reaching a terminal look identical whether you read them, a pager swallowed them, or the process was wedged. This is what moves the task to running. It is not a promise to succeed; it says the instruction you hold is the one that was sent.',
      inputSchema: {
        deliveryId: z.string().uuid().describe('From the instruction you were handed'),
        inputDigest: z
          .string()
          .min(8)
          .max(128)
          .describe('The digest that came with it. Quote it exactly — it is what proves this is the same instruction')
      }
    },
    async ({ deliveryId, inputDigest }) => {
      assertAgentReference(inputDigest)
      // The trusted session credential supplies the identity; the caller can
      // never acknowledge a different session's instruction in this Project.
      const { data, error } = await db.rpc('acknowledge_delivery', {
        p_estate_id: scope.estateId,
        p_session_id: scope.sessionId,
        p_delivery_id: deliveryId,
        p_digest: inputDigest
      })
      if (error || !data || typeof data.accepted !== 'boolean')
        return json({ accepted: false, reason: 'The acknowledgement could not be recorded. Retry the same delivery.' })
      return json(data)
    }
  )
}
// #endregion task-tools
