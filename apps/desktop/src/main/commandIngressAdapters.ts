/** Thin persistence adapters for HAR06's explicit pure-policy coverage.
 * These are not wired into bootstrap/IPC here. Identity/domain authorization
 * stays outside; no failure in this module is permission to bypass it.
 */
import type { Actor, Journal, JournalEvent, NewEvent } from '@fabric/journal'
import { prepareAnswerComposition, prepareDeclaredImport, prepareDeferralReason, prepareEventPayload, prepareRelease, prepareTopic,
  prepareVerificationReceipt,
  type IngressRejection } from '../shared/commandIngress.ts'
import { describeRedactions, redact, type RedactionCount } from '../shared/redact.ts'
import { validateAnswer, type AnswerOption } from '../shared/answerCommit.ts'

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error?: unknown }>
export interface IngressCommandDeps { rpc: Rpc; estateId: string; actor: Actor }
export type AdapterRejection = IngressRejection | 'not_covered' | 'invalid_envelope'
export class CommandIngressError extends Error {
  readonly code: AdapterRejection | 'persistence_unconfirmed'
  constructor(code: AdapterRejection | 'persistence_unconfirmed') {
    super(code === 'persistence_unconfirmed' ? 'Persistence could not be confirmed.' : 'Input was refused before persistence.')
    this.name = 'CommandIngressError'
    this.code = code
  }
}
function fail(code: AdapterRejection = 'invalid_envelope'): never { throw new CommandIngressError(code) }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** Small outer envelopes only; nested payloads go through the bounded pure
 * policy. No getter, toJSON, coercion, or spread of an unvalidated input.
 */
function envelope(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail()
  const proto = Object.getPrototypeOf(input)
  if (proto !== Object.prototype && proto !== null) fail()
  const keys = Reflect.ownKeys(input)
  if (keys.length > allowed.length) fail()
  const out: Record<string, unknown> = Object.create(null)
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail()
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail()
    out[key] = descriptor.value
  }
  return out
}
function actor(input: unknown): Actor {
  const a = envelope(input, ['kind', 'id'])
  if (!['person', 'agent', 'system'].includes(a.kind as string) || typeof a.id !== 'string' ||
      !a.id.trim() || a.id.length > 512 || /[\x00-\x1f\x7f]/.test(a.id) || redact(a.id).text !== a.id) fail()
  return { kind: a.kind as Actor['kind'], id: a.id }
}
function commandScope(deps: IngressCommandDeps): { estateId: string; actor: Actor } {
  if (!uuid(deps.estateId)) fail()
  return { estateId: deps.estateId, actor: actor(deps.actor) }
}
function journalEnvelope(input: unknown): NewEvent {
  const e = envelope(input, ['estateId', 'type', 'actor', 'payload', 'schemaRev', 'projectId', 'runId', 'nodeId'])
  if (!uuid(e.estateId) || typeof e.type !== 'string' || !/^[a-z][a-z0-9_.-]*@[1-9][0-9]*$/.test(e.type)) fail()
  const out: NewEvent = { estateId: e.estateId, type: e.type, actor: actor(e.actor), payload: e.payload as NewEvent['payload'] }
  for (const key of ['projectId', 'runId', 'nodeId'] as const) {
    if (e[key] !== undefined && e[key] !== null) {
      if (!uuid(e[key])) fail()
      out[key] = e[key]
    }
  }
  if (e.schemaRev !== undefined) {
    if (typeof e.schemaRev !== 'string' || !/^[1-9][0-9]*$/.test(e.schemaRev)) fail()
    out.schemaRev = e.schemaRev
  }
  return out
}

export function createPreparedJournal(journal: Journal, options: {
  /** Only explicit caller classification can pass an uncovered type. This
   * adapter makes no privacy claim for that externally protected payload. */
  classifyUncovered?: (type: string) => 'external_policy' | 'reject'
} = {}): Journal {
  return {
    replay: (...args) => journal.replay(...args),
    async append(input): Promise<JournalEvent> {
      let e: NewEvent
      try {
        e = journalEnvelope(input)
        const prepared = prepareEventPayload(e.type, e.payload ?? {})
        if (prepared.state === 'rejected') fail(prepared.code)
        if (prepared.state === 'not_covered') {
          if (options.classifyUncovered?.(e.type) !== 'external_policy') fail('not_covered')
        } else {
          // Never relay a caller-supplied removal-count claim as our receipt.
          const { redactions: _untrusted, ...payload } = prepared.value
          const summary = describeRedactions(prepared.redactions)
          e.payload = summary ? { ...payload, redactions: summary } : payload
        }
      } catch (error) {
        throw error instanceof CommandIngressError ? error : new CommandIngressError('invalid_envelope')
      }
      try { return await journal.append(e) }
      catch { throw new CommandIngressError('persistence_unconfirmed') }
    }
  }
}

type Refused = { state: 'refused'; code: AdapterRejection; reason: string }
type Unconfirmed = { state: 'unconfirmed'; reason: string }
function refusal(error: unknown): Refused {
  return { state: 'refused', code: error instanceof CommandIngressError ? error.code as AdapterRejection : 'invalid_envelope',
    reason: 'Input was refused before persistence.' }
}
const unconfirmed = (): Unconfirmed => ({ state: 'unconfirmed', reason: 'Persistence could not be confirmed. No automatic retry was attempted.' })
export interface AnswerCommitReceipt {
  resolution_id: string
  decision_id: string
  repeated: boolean
  answered_seq?: number
  unblocked?: string[]
  still_blocked?: { task_id: string; open_blockers: number }[]
}
export type PreparedAnswerResult<T> = Refused | Unconfirmed | {
  state: 'committed'; receipt: AnswerCommitReceipt
  /** A repeat receipt only proves the earlier decision IDs. It does not prove
   * the current request's text equals that decision; no replacement is claimed. */
  canonicalAnswer: string | null
  /** Counts from preparing this request, not proof of a new persisted answer. */
  redactions: RedactionCount[]
  /** Returned is a callback result, never proof of agent delivery/acceptance. */
  continuations: ({ state: 'returned'; taskId: string; value: T } | { state: 'unconfirmed'; taskId: string })[]
}
function answerReceipt(input: unknown): AnswerCommitReceipt {
  const r = envelope(input, ['resolution_id', 'decision_id', 'repeated', 'answered_seq', 'unblocked', 'still_blocked'])
  if (!uuid(r.resolution_id) || !uuid(r.decision_id) || typeof r.repeated !== 'boolean') fail()
  // The SQL repeated branch deliberately returns only these three fields.
  if (r.repeated) return { resolution_id: r.resolution_id, decision_id: r.decision_id, repeated: true }
  if (typeof r.answered_seq !== 'number' || !Number.isSafeInteger(r.answered_seq) || r.answered_seq < 1 ||
      !Array.isArray(r.unblocked) || r.unblocked.length > 512 || !Array.isArray(r.still_blocked) || r.still_blocked.length > 512) fail()
  // Copy descriptors rather than invoking untrusted response accessors/map.
  const unblocked: string[] = []
  const still_blocked: { task_id: string; open_blockers: number }[] = []
  for (let i = 0; i < r.unblocked.length; i++) {
    const d = Object.getOwnPropertyDescriptor(r.unblocked, String(i))
    if (!d || !('value' in d) || !uuid(d.value)) fail()
    unblocked.push(d.value)
  }
  for (let i = 0; i < r.still_blocked.length; i++) {
    const d = Object.getOwnPropertyDescriptor(r.still_blocked, String(i))
    if (!d || !('value' in d)) fail()
    const item = envelope(d.value, ['task_id', 'open_blockers'])
    if (!uuid(item.task_id) || typeof item.open_blockers !== 'number' || !Number.isSafeInteger(item.open_blockers) || item.open_blockers < 0) fail()
    still_blocked.push({ task_id: item.task_id, open_blockers: item.open_blockers })
  }
  return { resolution_id: r.resolution_id, decision_id: r.decision_id, repeated: false,
    answered_seq: r.answered_seq, unblocked, still_blocked }
}

export async function commitPreparedAnswer<T = never>(deps: IngressCommandDeps & {
  continueAnswer?: (taskId: string, decisionId: string, canonicalAnswer: string) => Promise<T>
}, input: unknown): Promise<PreparedAnswerResult<T>> {
  let args: Record<string, unknown>, canonicalAnswer: string, redactions: RedactionCount[]
  try {
    const scope = commandScope(deps)
    const i = envelope(input, ['commandId', 'questionId', 'projectId', 'expectedRevision', 'answer', 'chosenOption', 'options'])
    if (!uuid(i.commandId) || !uuid(i.questionId) || !uuid(i.projectId) || typeof i.expectedRevision !== 'number' ||
        !Number.isSafeInteger(i.expectedRevision) || i.expectedRevision < 0) fail()
    const dto: Record<string, unknown> = { options: i.options }
    for (const key of ['answer', 'chosenOption']) if (i[key] !== undefined) dto[key] = i[key]
    const prepared = prepareAnswerComposition(dto)
    if (prepared.state === 'rejected') {
      if (prepared.code === 'invalid_answer') {
        // This branch proves the inert JSON/option shape passed already; the
        // existing domain validator's failure is static prose or a length.
        const domain = validateAnswer(dto as unknown as {answer?: string; chosenOption?: string; options: AnswerOption[]})
        if (!domain.ok) return { state: 'refused', code: 'invalid_answer', reason: domain.reason }
      }
      fail(prepared.code)
    }
    canonicalAnswer = prepared.value.answer
    redactions = prepared.redactions
    args = { p_estate_id: scope.estateId, p_project_id: i.projectId, p_question_id: i.questionId,
      p_command_id: i.commandId, p_expected_revision: i.expectedRevision, p_answer: canonicalAnswer,
      p_chosen_option: prepared.value.chosenOption, p_basis: null, p_actor: scope.actor }
  } catch (error) { /* Fixed refusal is returned; offending values stay private. */ return refusal(error) }
  let receipt: AnswerCommitReceipt
  try {
    const result = await deps.rpc('answer_question', args)
    if (result.error) return unconfirmed()
    receipt = answerReceipt(result.data)
  } catch { /* Lost/invalid response becomes explicit uncertainty; no raw backend error or retry. */ return unconfirmed() }
  const continuations = deps.continueAnswer ? await Promise.all((receipt.unblocked ?? []).map(async taskId => {
    try { return { state: 'returned' as const, taskId, value: await deps.continueAnswer!(taskId, receipt.decision_id, canonicalAnswer) } }
    catch { /* The committed answer remains durable; delivery uncertainty is returned separately. */ return { state: 'unconfirmed' as const, taskId } }
  })) : []
  return { state: 'committed', receipt, canonicalAnswer: receipt.repeated ? null : canonicalAnswer, redactions, continuations }
}

export interface ImportCommitReceipt { estateId: string; seq: number; commandId: string; inputDigest: string; events: number }
export type PreparedImportResult = Refused | Unconfirmed | { state: 'committed'; receipt: ImportCommitReceipt; redactions: RedactionCount[] }
export async function commitPreparedImport(deps: IngressCommandDeps, input: unknown): Promise<PreparedImportResult> {
  let args: Record<string, unknown>, redactions: RedactionCount[]
  try {
    const scope = commandScope(deps)
    const prepared = prepareDeclaredImport(input)
    if (prepared.state === 'rejected') fail(prepared.code)
    const p = prepared.value
    redactions = prepared.redactions
    const events = p.events.map(e => {
      const {redactions: _untrusted, ...payload} = e.payload
      return {...e, payload}
    })
    args = { p_estate_id: scope.estateId, p_command_id: p.commandId, p_input_digest: p.inputDigest,
      p_actor: scope.actor, p_events: events }
  } catch (error) { /* Fixed refusal is returned; offending values stay private. */ return refusal(error) }
  try {
    const result = await deps.rpc('import_declared_snapshot', args)
    if (result.error) return unconfirmed()
    const row = envelope(result.data, ['estate_id', 'seq', 'type', 'schema_rev', 'actor', 'project_id', 'run_id', 'node_id', 'occurred_at', 'payload'])
    const p = envelope(row.payload, ['command_id', 'input_digest', 'events', 'coverage_note'])
    if (!uuid(row.estate_id) || row.estate_id.toLowerCase() !== (args.p_estate_id as string).toLowerCase() ||
        row.type !== 'estate.imported@1' || typeof row.seq !== 'number' || !Number.isSafeInteger(row.seq) || row.seq < 1 ||
        !uuid(p.command_id) || p.command_id.toLowerCase() !== (args.p_command_id as string).toLowerCase() ||
        p.input_digest !== args.p_input_digest || p.events !== (args.p_events as unknown[]).length) return unconfirmed()
    return { state: 'committed', receipt: { estateId: row.estate_id, seq: row.seq,
      commandId: p.command_id, inputDigest: p.input_digest as string, events: p.events as number }, redactions }
  } catch { /* Lost/invalid response becomes explicit uncertainty; no raw backend error or retry. */ return unconfirmed() }
}

/**
 * The Board's three commands (SCR-41, L3b): set a question aside, return it, write a topic.
 *
 * The same discipline as the answer: the words are prepared (bounded, scrubbed) before they
 * cross, the actor is the established one, and a lost or unreadable response is uncertainty,
 * never a guess. A DOMAIN refusal is different from a lost response — the command ran and said
 * no — so it comes back as a fixed code the screen can name; the backend's text never does.
 */
import type { BoardCommandResult, BoardRefusal } from '../shared/boardResolved.ts'
export type { BoardCommandResult, BoardRefusal }

/** Which domain refusal the command raised, by its own fixed wording; null for anything else. */
export function boardRefusalOf(error: unknown): BoardRefusal | null {
  const e = error as { code?: unknown; message?: unknown } | null
  if (!e || typeof e.message !== 'string' || !['22023', '02000', 'P0002', '42501'].includes(String(e.code))) return null
  const m = e.message
  if (/already set aside/.test(m)) return 'already_deferred'
  if (/not set aside/.test(m)) return 'not_deferred'
  if (/settled question/.test(m)) return 'settled'
  if (/no such (question|project)/.test(m)) return 'no_such'
  if (/person/.test(m)) return 'not_person'
  if (/different question/.test(m)) return 'command_reused'
  if (/reason|text/.test(m)) return 'invalid_input'
  return null
}

export async function commitBoardCommand(
  deps: IngressCommandDeps,
  action: 'defer' | 'reopen' | 'topic',
  input: unknown
): Promise<BoardCommandResult> {
  let name: string, args: Record<string, unknown>, questionId: string
  try {
    const scope = commandScope(deps)
    const i = envelope(input, action === 'topic' ? ['commandId', 'questionId', 'projectId', 'text', 'note']
      : action === 'defer' ? ['commandId', 'questionId', 'projectId', 'reason'] : ['commandId', 'questionId', 'projectId'])
    if (!uuid(i.commandId) || !uuid(i.questionId) || !uuid(i.projectId)) fail()
    questionId = i.questionId
    const base = { p_estate_id: scope.estateId, p_project_id: i.projectId, p_question_id: i.questionId, p_command_id: i.commandId, p_actor: scope.actor }
    if (action === 'defer') {
      const reason = prepareDeferralReason(i.reason)
      if (reason.state === 'rejected') fail(reason.code)
      name = 'defer_question'; args = { ...base, p_reason: reason.value }
    } else if (action === 'reopen') {
      name = 'reopen_question'; args = base
    } else {
      const topic = prepareTopic(i.note === undefined ? { text: i.text } : { text: i.text, note: i.note })
      if (topic.state === 'rejected') fail(topic.code)
      name = 'ask_topic'; args = { ...base, p_text: topic.value.text, p_note: topic.value.note }
    }
  } catch { /* A fixed refusal before anything crossed; the offending values stay private. */ return { state: 'refused', refusal: 'invalid_input' } }
  try {
    const result = await deps.rpc(name, args)
    if (result.error) {
      const refusal = boardRefusalOf(result.error)
      return refusal ? { state: 'refused', refusal } : { state: 'unconfirmed' }
    }
    const d = result.data as Record<string, unknown> | null
    if (!d || typeof d !== 'object' || typeof d.repeated !== 'boolean') return { state: 'unconfirmed' }
    const seq = [d.deferred_seq, d.reopened_seq, d.asked_seq].find((v) => typeof v === 'number') as number | undefined
    return { state: 'committed', repeated: d.repeated, seq: seq ?? null, questionId: typeof d.question_id === 'string' ? d.question_id : questionId }
  } catch { /* A lost or invalid response is explicit uncertainty; no raw backend error, no retry. */ return { state: 'unconfirmed' } }
}

// ── Releases (ADR-0084): record one, or record its verification ──────────────────────────────
import type { ReleaseCommandResult, ReleaseRefusal } from '../shared/releases.ts'

/** The two commands' own refusals, named by a fixed code; anything else is not a refusal. */
export function releaseRefusalOf(error: unknown): ReleaseRefusal | null {
  const e = error as { code?: unknown; message?: unknown } | null
  if (!e || typeof e.message !== 'string' || !['22023', '02000', 'P0002', '42501'].includes(String(e.code))) return null
  const m = e.message
  if (/different release/.test(m)) return 'command_reused'
  if (/already recorded/.test(m)) return 'already_recorded'
  if (/not a (task|decision) of this project|rolls back/.test(m)) return 'not_in_project'
  if (/no such (release|project)/.test(m)) return 'no_such'
  if (/person/.test(m)) return 'not_person'
  if (/name|environment|outcome|receipt/.test(m)) return 'invalid_input'
  return null
}

const REFERENCES_PER_RELEASE = 200
const references = (v: unknown): string[] => {
  if (v === undefined) return []
  if (!Array.isArray(v) || v.length > REFERENCES_PER_RELEASE || !v.every(uuid)) fail()
  return [...new Set(v as string[])]
}

export async function commitReleaseCommand(
  deps: IngressCommandDeps,
  action: 'record' | 'verify',
  input: unknown
): Promise<ReleaseCommandResult> {
  let name: string, args: Record<string, unknown>, releaseId: string
  try {
    const scope = commandScope(deps)
    const i = envelope(input, action === 'record'
      ? ['commandId', 'releaseId', 'projectId', 'name', 'environment', 'summary', 'taskIds', 'decisionIds', 'rollsBack']
      : ['commandId', 'releaseId', 'projectId', 'outcome', 'receipt'])
    if (!uuid(i.commandId) || !uuid(i.releaseId) || !uuid(i.projectId)) fail()
    releaseId = i.releaseId
    const base = { p_estate_id: scope.estateId, p_project_id: i.projectId, p_release_id: i.releaseId, p_command_id: i.commandId, p_actor: scope.actor }
    if (action === 'record') {
      const words = prepareRelease(i.summary === undefined ? { name: i.name, environment: i.environment } : { name: i.name, environment: i.environment, summary: i.summary })
      if (words.state === 'rejected') fail(words.code)
      if (i.rollsBack !== undefined && i.rollsBack !== null && !uuid(i.rollsBack)) fail()
      name = 'record_release'
      args = { ...base, p_name: words.value.name, p_environment: words.value.environment, p_summary: words.value.summary,
        p_task_ids: references(i.taskIds), p_decision_ids: references(i.decisionIds), p_rolls_back: i.rollsBack ?? null }
    } else {
      if (i.outcome !== 'accepted' && i.outcome !== 'failed') fail()
      const receipt = prepareVerificationReceipt(i.receipt)
      if (receipt.state === 'rejected') fail(receipt.code)
      name = 'verify_release'; args = { ...base, p_outcome: i.outcome, p_receipt: receipt.value }
    }
  } catch { /* A fixed refusal before anything crossed; the offending values stay private. */ return { state: 'refused', refusal: 'invalid_input' } }
  try {
    const result = await deps.rpc(name, args)
    if (result.error) {
      const refusal = releaseRefusalOf(result.error)
      return refusal ? { state: 'refused', refusal } : { state: 'unconfirmed' }
    }
    const d = result.data as Record<string, unknown> | null
    if (!d || typeof d !== 'object' || typeof d.repeated !== 'boolean') return { state: 'unconfirmed' }
    const seq = [d.recorded_seq, d.verified_seq].find((v) => typeof v === 'number') as number | undefined
    return { state: 'committed', repeated: d.repeated, seq: seq ?? null, releaseId: typeof d.release_id === 'string' ? d.release_id : releaseId }
  } catch { /* A lost or invalid response is explicit uncertainty; no raw backend error, no retry. */ return { state: 'unconfirmed' } }
}
