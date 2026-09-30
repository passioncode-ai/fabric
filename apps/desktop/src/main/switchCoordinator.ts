/**
 * The switch, phase by phase, and the crash that must not start a second one.
 *
 * M199.resume. Persisted on `localState` and keyed by the caller's own
 * idempotency key, because the card's first failure case is a crash AFTER the
 * stop or AFTER the spawn: a retry then has to resume THE SAME operation, and
 * the only way to know that is to have written the phase down before doing the
 * thing. So each phase is recorded before its side effect, never after.
 *
 * WHAT THIS CANNOT DO ON EITHER INSTALLED BUILD. `native-resume-ack` is
 * `unverified` for Claude Code 2.1.236 and Codex 0.152.1 — M199.probe measured
 * it — so `feasibility` refuses before anything stops, and a switch never gets
 * as far as needing a receipt. That is the design's own invariant reaching the
 * code rather than a limitation discovered late: an unverified capability is
 * never reported as successful continuation.
 */

import { randomUUID } from 'node:crypto'
import { readLocal, writeLocal, type LocalFile } from './localState.ts'
import {
  carryBudget,
  feasibility,
  isTerminal,
  mayAdvance,
  mayCommit,
  oldRunOutcome,
  type Acknowledgement,
  type Budget,
  type Feasibility,
  type FeasibilityVerdict,
  type SwitchOperation,
  type SwitchPhase
} from '../shared/switchOperation.ts'

interface SwitchFile {
  schema: 'SwitchOperations@1'
  operations: SwitchOperation[]
}

const EMPTY: SwitchFile = { schema: 'SwitchOperations@1', operations: [] }

function validate(parsed: unknown): SwitchFile | null {
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Partial<SwitchFile>
  if (o.schema !== 'SwitchOperations@1' || !Array.isArray(o.operations)) return null
  for (const op of o.operations)
    if (!op || typeof op.idempotencyKey !== 'string' || typeof op.phase !== 'string') return null
  return { schema: 'SwitchOperations@1', operations: o.operations }
}

export interface Begun {
  ok: true
  operation: SwitchOperation
  /** True when the key named an operation that already existed. */
  resumed: boolean
  feasibility: FeasibilityVerdict
}

export interface Refused {
  ok: false
  reason: string
  feasibility?: FeasibilityVerdict
}

export interface CoordinatorDeps {
  dir: string
  /** Everything feasibility needs, read at the moment of asking. */
  survey: (conversationId: string, to: string | null) => Feasibility
  /** What the provider says after a resume, or null when it said nothing. */
  acknowledge?: (conversationId: string) => Acknowledgement | null
  now?: () => number
}

export function createSwitchCoordinator(deps: CoordinatorDeps) {
  const spec: LocalFile<SwitchFile> = {
    dir: deps.dir,
    file: 'switch-operations.json',
    empty: EMPTY,
    validate
  }
  const now = deps.now ?? Date.now
  const read = (): SwitchFile => readLocal(spec).value
  const byKey = (key: string): SwitchOperation | null =>
    read().operations.find((o) => o.idempotencyKey === key) ?? null

  const persist = (next: SwitchOperation): { ok: boolean; reason: string } => {
    const file = read()
    const exists = file.operations.some((o) => o.switchId === next.switchId)
    const written = writeLocal(
      spec,
      {
        ...file,
        operations: exists
          ? file.operations.map((o) => (o.switchId === next.switchId ? next : o))
          : [...file.operations, next]
      },
      readLocal(spec).revision
    )
    if (written.status === 'committed') return { ok: true, reason: `phase ${next.phase}` }
    return {
      ok: false,
      reason:
        written.status === 'conflict'
          ? 'the operation log changed under this write; the phase is unchanged'
          : `the phase could not be recorded: ${written.reason}`
    }
  }

  return {
    operation: byKey,
    operations: (): readonly SwitchOperation[] => read().operations,

    /**
     * Begin, or resume the operation this key already named.
     *
     * Feasibility is decided HERE, before anything stops. A switch that stops
     * first and asks afterwards leaves a conversation neither running nor
     * resumable, and that state has no owner.
     */
    begin(input: {
      idempotencyKey: string
      conversationId: string
      from: string | null
      to: string | null
      expectedBinding: number
      oldGeneration: number
      policyRevision?: string
    }): Begun | Refused {
      const existing = byKey(input.idempotencyKey)
      if (existing) {
        // THE CRASH CASE. A retry does not start a second operation, and it does
        // not re-run the phase that may already have happened: it hands back
        // where this one is, and `advance` decides what is next from there.
        if (existing.conversationId !== input.conversationId)
          return {
            ok: false,
            reason: `that idempotency key already names a switch of ${existing.conversationId}`
          }
        return {
          ok: true,
          resumed: true,
          operation: existing,
          feasibility: feasibility(deps.survey(input.conversationId, existing.to))
        }
      }

      // One outstanding operation per conversation. Two switches racing on one
      // conversation is the same defect as two writers on one binding.
      const live = read().operations.find(
        (o) => o.conversationId === input.conversationId && !isTerminal(o.phase)
      )
      if (live)
        return {
          ok: false,
          reason: `${input.conversationId} already has an outstanding switch in phase ${live.phase}`
        }

      const verdict = feasibility(deps.survey(input.conversationId, input.to))
      if (!verdict.feasible)
        // NOTHING IS WRITTEN. An operation recorded and immediately blocked
        // would leave a row an operator has to dismiss, for a switch that never
        // touched anything.
        return { ok: false, reason: verdict.says, feasibility: verdict }

      const operation: SwitchOperation = {
        switchId: randomUUID(),
        idempotencyKey: input.idempotencyKey,
        conversationId: input.conversationId,
        from: input.from,
        to: input.to,
        expectedBinding: input.expectedBinding,
        policyRevision: input.policyRevision,
        phase: 'preparing',
        checkpointRef: null,
        oldGeneration: input.oldGeneration,
        newGeneration: input.oldGeneration + 1,
        receipt: `planned at ${new Date(now()).toISOString()}: ${verdict.says}`
      }
      const written = persist(operation)
      if (!written.ok) return { ok: false, reason: written.reason }
      return { ok: true, resumed: false, operation, feasibility: verdict }
    },

    /**
     * Move one phase, recording it BEFORE the side effect it names.
     *
     * The order is the whole of crash reconciliation: a phase written after its
     * effect leaves a crash between them indistinguishable from a crash before,
     * and a retry then repeats the effect.
     */
    advance(input: {
      idempotencyKey: string
      to: SwitchPhase
      checkpointRef?: string | null
      says?: string
    }): { ok: boolean; reason: string; operation?: SwitchOperation } {
      const operation = byKey(input.idempotencyKey)
      if (!operation) return { ok: false, reason: 'no such operation' }
      const move = mayAdvance(operation.phase, input.to)
      if (!move.ok) return { ok: false, reason: move.reason }
      if (input.to === 'committed')
        return {
          ok: false,
          reason:
            'a commit goes through `commit`, which requires both acknowledgements. Advancing into it directly is how ' +
            'a receipt gets written for something nobody observed'
        }
      const next: SwitchOperation = {
        ...operation,
        phase: input.to,
        checkpointRef: input.checkpointRef === undefined ? operation.checkpointRef : input.checkpointRef,
        receipt: `${operation.receipt} | ${input.to} at ${new Date(now()).toISOString()}${input.says ? `: ${input.says}` : ''}`
      }
      const written = persist(next)
      return written.ok ? { ok: true, reason: written.reason, operation: next } : written
    },

    /**
     * Record the switch as having worked, or refuse and say why.
     *
     * On both installed builds this is unreachable, because `feasibility`
     * refuses at `begin` — the acknowledgement capability is unverified. It
     * exists and is tested anyway: the day a build acknowledges a resume, the
     * rule that decides whether to believe it has already been written and
     * watched refusing the four ways it can be wrong.
     */
    commit(input: {
      idempotencyKey: string
      expectedIdentity: string
      expectedNativeRef: string | null
    }): { ok: boolean; reason: string; operation?: SwitchOperation } {
      const operation = byKey(input.idempotencyKey)
      if (!operation) return { ok: false, reason: 'no such operation' }
      const move = mayAdvance(operation.phase, 'committed')
      if (!move.ok) return { ok: false, reason: move.reason }
      const ack = deps.acknowledge ? deps.acknowledge(operation.conversationId) : null
      const verdict = mayCommit({
        expectedIdentity: input.expectedIdentity,
        expectedNativeRef: input.expectedNativeRef,
        ack
      })
      if (!verdict.allowed) {
        // An honest hold, not a failure of the switch and not a success: the
        // conversation is stopped and the operator is told what was not
        // confirmed, which is the state the card calls needs_reconciliation.
        const held: SwitchOperation = {
          ...operation,
          phase: 'needs_reconciliation',
          receipt: `${operation.receipt} | held at ${new Date(now()).toISOString()}: ${verdict.reason}`
        }
        persist(held)
        return { ok: false, reason: verdict.reason, operation: held }
      }
      const committed: SwitchOperation = {
        ...operation,
        phase: 'committed',
        receipt: `${operation.receipt} | committed at ${new Date(now()).toISOString()}: ${verdict.reason}`
      }
      const written = persist(committed)
      return written.ok
        ? { ok: true, reason: verdict.reason, operation: committed }
        : { ok: false, reason: written.reason }
    },

    /** What the old run becomes: `cancelled` only where the stop was observed. */
    outcomeOfOldRun: oldRunOutcome,

    /** The enclosing budget, unchanged. A new run does not reset it. */
    budgetFor: (before: Budget): Budget => carryBudget(before)
  }
}
