// The one door a proposal decision goes through (M168).
//
// `shared/proposals.ts` holds the rules and knows nothing about a database, so
// every one of them is testable without one. This file is the half that touches
// the world: it reads the facts, asks the checker, and — if the checker said yes
// — REVALIDATES at commit before appending anything.
//
// WHY REVALIDATE. The check ran against a row read a moment ago. Between that
// read and the append, the same proposal can be decided from another window. The
// old path had no second look at all: two windows both read `decided_at = null`
// and both appended, producing two tasks from one proposal and a second
// `proposal.decided@1` the projection quietly applied over the first.
//
// AND NOTHING ELSE MAY APPEND THESE EVENTS. `scripts/check-checker.mjs` refuses
// a `proposal.filed@1` or `proposal.decided@1` written anywhere but here. A
// second entry point that forgets the checker is the failure this module exists
// to prevent, and a rule kept by intention is one that holds until somebody is
// busy (ADR-0049).

import { randomUUID } from 'node:crypto'
import type { Journal } from '@fabric/journal'
import {
  REJECTION_CODES,
  checkProposalDecision,
  checkerUnavailable,
  type RejectionCode,
  type CheckResult,
  type DecideCommand,
  type ProposalFacts,
  type Rejection
} from '../../shared/proposals.ts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScopedStore } from '../scopedStore.ts'
import { ops } from '../opsSink.ts'
import type { ProposalDecideResult } from '../../shared/types.ts'

/**
 * What a decision answers with.
 *
 * ONE declaration (R-005, UX28-12). This was declared here AND in
 * `shared/types.ts` as `ProposalDecideResult`, field for field — and the shared
 * copy is the one on the wire and the one carrying the reason the type exists:
 * "present when it was refused, and it is the whole point of the type". Two
 * names for one contract is how a reader comes to believe the main process and
 * the renderer are being told different things.
 */
export type DecideOutcome = ProposalDecideResult

export async function decideProposal(input: {
  store: ScopedStore
  journal: Journal
  db: SupabaseClient
  estateId: string
  actor: { kind: string; id: string }
  proposalId: string
  decision: unknown
}): Promise<DecideOutcome> {
  const { store, journal } = input

  let facts: ProposalFacts
  try {
    const { data: proposal, error } = await store
      .select('proposals', 'id,project_id,title,decided_at,decision')
      .eq('id', input.proposalId)
      .maybeSingle()
    if (error) throw new Error(error.message)

    const projectId = (proposal as { project_id?: string } | null)?.project_id ?? null
    let projectExists = false
    if (projectId) {
      const { data: project, error: projectError } = await store
        .select('projects', 'id')
        .eq('id', projectId)
        .maybeSingle()
      if (projectError) throw new Error(projectError.message)
      projectExists = project !== null
    }
    facts = { id: input.proposalId, proposal: proposal as ProposalFacts['proposal'], projectExists }
  } catch (e) {
    // FAIL CLOSED. Nothing was written, the draft survives, and the caller is
    // told this is worth another try — which is a different sentence from "no".
    ops.failed('proposal.check', e, { proposal_id: input.proposalId })
    return { ok: false, rejection: checkerUnavailable(e instanceof Error ? e.message : String(e)) }
  }

  const checked: CheckResult<DecideCommand> = checkProposalDecision({ facts, decision: input.decision })
  if (!checked.ok) {
    // A refusal is EVIDENCE, not an exception. It is recorded so "why did this
    // not go through" is answerable later, and returned so the surface can show
    // the reason beside the draft instead of a bridge error string.
    ops.record({
      op: 'proposal.rejected',
      outcome: 'ok',
      level: 'warn',
      detail: { proposal_id: input.proposalId, reason: checked.reasonCode, retryable: checked.retryable },
      ctx: { correlationId: ops.correlate(), estateId: input.estateId }
    })
    return { ok: false, rejection: checked }
  }

  const command = checked.command
  // Accepting mints the task id HERE and hands it in, so the transaction that
  // records the decision is the one that creates the task. Deliberately no
  // `spawned` link: a person deciding is what makes this a new beginning rather
  // than round five, and reattaching it would trip the chain bound again for a
  // chain already looked at.
  const taskId = command.decision === 'accepted' ? randomUUID() : null

  // THE RECHECK IS THE DATABASE'S, under a row lock, in the same transaction as
  // both appends. The check above ran against a row read a moment earlier —
  // which two windows can both do — and the two events must land together or a
  // crash between them leaves a task with no record of the decision behind it.
  const { data, error } = await input.db.rpc('decide_proposal', {
    p_estate_id: input.estateId,
    p_proposal_id: command.proposalId,
    p_decision: command.decision,
    p_actor: input.actor,
    p_task_id: taskId,
    p_checker_version: checked.checkerVersion
  })
  if (error) {
    // The database's refusals carry the SAME reason codes as the checker's, as
    // a prefix, so a race lost at the lock reads to the operator exactly like
    // one caught a moment earlier.
    const code = /^([a-z_]+):/.exec(error.message)?.[1]
    ops.record({
      op: 'proposal.rejected',
      outcome: 'ok',
      level: 'warn',
      detail: { proposal_id: input.proposalId, reason: code ?? 'unknown', at: 'commit' },
      ctx: { correlationId: ops.correlate(), estateId: input.estateId }
    })
    return {
      ok: false,
      rejection: isRejectionCode(code)
        ? {
            ok: false,
            reasonCode: code,
            says: error.message.slice(code.length + 2),
            remedy: 'Refresh the board — this was decided somewhere else while you were looking at it.',
            retryable: false,
            checkerVersion: checked.checkerVersion
          }
        : checkerUnavailable(error.message)
    }
  }
  return { ok: true, taskId, seq: (data as { seq: number } | null)?.seq }
}

const isRejectionCode = (v: string | undefined): v is RejectionCode =>
  v !== undefined && (REJECTION_CODES as readonly string[]).includes(v)

/**
 * File a proposal, when the chain bound stopped a hand-off (M68).
 *
 * The agent surface used to append this itself. It applied `mayChain` and no
 * other rule — a different set from the one the operator's path applied, and
 * neither knew about the other. Moved here so both live behind one door, and
 * `check-checker.mjs` refuses a third.
 */
export async function fileProposal(input: {
  journal: Journal
  estateId: string
  projectId: string | null
  actor: { kind: string; id: string }
  title: string
  origin: Record<string, unknown>
  fromTaskId: string | null
  depth: number
  bound: number
  /** The surface's redacting appender (M195). Passed in rather than reached
   *  for: the redaction door belongs to the surface that owes the estate the
   *  guarantee, and this module must not become a second way past it. */
  append: (event: {
    estateId: string
    type: string
    actor: { kind: string; id: string }
    projectId?: string | null
    payload: Record<string, unknown>
  }) => Promise<{ seq: number }>
}): Promise<{ proposalId: string; seq: number }> {
  const proposalId = randomUUID()
  const event = await input.append({
    estateId: input.estateId,
    type: 'proposal.filed@1',
    actor: input.actor,
    projectId: input.projectId,
    payload: {
      id: proposalId,
      project_id: input.projectId,
      title: input.title,
      origin: input.origin,
      from_task_id: input.fromTaskId,
      depth: input.depth,
      bound: input.bound
    }
  })
  return { proposalId, seq: event.seq }
}
