import { createHash } from 'node:crypto'
import { createProviderObservation, foldProviderObservation, validateProviderBinding, PROVIDER_LIMITS } from '../shared/providerExecution.ts'
import type { ProviderExecutionBinding, ProviderObservationState, ProviderEvent, ProviderWriter, Validation } from '../shared/providerExecution.ts'

// Raw subset of anthropics/claude-agent-sdk-python@36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6.
// The build pin selects a candidate profile, not measured CLI conformance.
// Host attribution is a caller prerequisite, never inferred native evidence.
export interface ClaudeSource { connectionId: string; requestEpoch: string; sequence: number; eventId: string }
export interface ClaudeAttribution {
  binding: ProviderExecutionBinding
  source: ClaudeSource
  kind: 'root-result' | 'task-start'
  messageUuid: string | null
  taskId: string | null
  /** Sanitized host authority reference, never a digest of the raw message. */
  evidenceRef: string
}
interface OwnedTask {
  id: string; taskType: 'local_agent' | 'local_workflow'; kind: ProviderWriter['kind']
  toolUseId: string | null; messageUuid: string; attributionEvidenceRef: string
  terminal: 'completed' | 'failed' | 'interrupted' | null
}
export interface ClaudeProviderState {
  readonly observation: ProviderObservationState
  readonly sourceSequence: number
  readonly receipts: readonly { eventId: string; sequence: number; digest: string }[]
  readonly initialized: boolean
  readonly tasks: readonly OwnedTask[]
  readonly fault: string | null
}
export interface ClaudeNormalized {
  accepted: boolean; repeated: boolean; reasonCode: string
  state: ClaudeProviderState; events: readonly ProviderEvent[]
}
type Fact = { type: 'writer'; writer: ProviderWriter } | { type: 'turn_terminal'; outcome: 'completed' | 'failed' | 'interrupted' }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)
const oneOf = (v: unknown, choices: readonly string[]): boolean => typeof v === 'string' && choices.includes(v)
const evidence = (v: unknown): v is string => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v)
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const optionalId = (v: unknown) => v === undefined || v === null || id(v)
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : obj(v)
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v)
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex')
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) }; return v }
const binding = (s: ClaudeProviderState) => s.observation.binding
const reject = (s: ClaudeProviderState, reasonCode: string, poison = true): ClaudeNormalized => ({ accepted: false, repeated: false, reasonCode, events: [],
  state: poison ? freeze({ ...s, fault: s.fault ?? reasonCode, observation: { ...s.observation, fault: s.observation.fault ?? reasonCode, inventory: null } }) : s })
const taskWriter = (task: OwnedTask, state: ProviderWriter['state']): Fact => ({ type: 'writer', writer: { kind: task.kind, id: `claude-task:${hash(task.id)}`, state } })

/** One serialized host request on one owned connection. Do not recreate this
 * state on reconnect to erase tasks; a supervisor must carry/resync ownership. */
export function createClaudeProviderState(input: unknown): Validation<ClaudeProviderState> {
  const observation = createProviderObservation(input)
  if (!observation.ok) return observation
  const b = observation.value.binding
  if (b.provider.id !== 'claude-code' || b.provider.build !== '2.1.283' || b.provider.runtimeProfile !== 'owned-stdio') return { ok: false, reasonCode: 'unsupported_provider_profile' }
  if (b.native.status !== 'observed') return { ok: false, reasonCode: 'native_identity_unknown' }
  if (b.execution.kind !== 'host-request' || b.native.turnId !== null) return { ok: false, reasonCode: 'host_request_epoch_required' }
  return { ok: true, value: freeze({ observation: observation.value, sourceSequence: 0, receipts: [], initialized: false, tasks: [], fault: null }) }
}
function sourceError(s: ClaudeProviderState, source: ClaudeSource): ClaudeNormalized | null {
  if (!obj(source) || !exact(source, ['connectionId','requestEpoch','sequence','eventId']) || !id(source.connectionId) || !id(source.requestEpoch) || !id(source.eventId) || !natural(source.sequence) || source.sequence === 0) return reject(s, 'invalid_source')
  const b = binding(s)
  if (b.native.status !== 'observed' || source.connectionId !== b.native.connectionId || source.requestEpoch !== b.execution.id) return reject(s, 'foreign_source', false)
  return null
}
function attributionError(s: ClaudeProviderState, source: ClaudeSource, raw: Record<string, unknown>, receipt: unknown, kind: ClaudeAttribution['kind']): string | null {
  if (!obj(receipt) || !exact(receipt, ['binding','source','kind','messageUuid','taskId','evidenceRef']) || !evidence(receipt.evidenceRef)) return 'attribution_required'
  const b = validateProviderBinding(receipt.binding)
  if (!b.ok || canonical(b.value) !== canonical(binding(s)) || !obj(receipt.source) || !exact(receipt.source, ['connectionId','requestEpoch','sequence','eventId']) || canonical(receipt.source) !== canonical(source)) return 'foreign_attribution'
  if (receipt.kind !== kind || receipt.messageUuid !== (raw.uuid ?? null) || receipt.taskId !== (kind === 'task-start' ? raw.task_id : null)) return 'attribution_mismatch'
  return null
}
// Only validated minimal lifecycle facts enter receipts. Raw description,
// summary, result, errors, paths, origin body and patch bodies are never hashed.
function commit(s: ClaudeProviderState, source: ClaudeSource, context: unknown, derive: () => { facts: Fact[]; tasks?: readonly OwnedTask[]; initialized?: boolean } | string): ClaudeNormalized {
  const digest = hash({ binding: binding(s), source, context }), old = s.receipts.find(r => r.eventId === source.eventId)
  if (old) return old.sequence === source.sequence && old.digest === digest ? { accepted: true, repeated: true, reasonCode: 'repeated', state: s, events: [] } : reject(s, 'source_id_conflict')
  if (s.fault) return reject(s, 'resync_required')
  if (source.sequence !== s.sourceSequence + 1) return reject(s, source.sequence <= s.sourceSequence ? 'stale_source' : 'source_gap')
  if (s.receipts.length >= PROVIDER_LIMITS.events) return reject(s, 'source_limit')
  const next = derive()
  if (typeof next === 'string') return reject(s, next)
  let observation = s.observation
  const events: ProviderEvent[] = []
  for (const fact of next.facts) {
    const event: ProviderEvent = { schema: 'ProviderEvent@1', eventId: `claude:${digest}:${events.length}`, cursor: observation.cursor + 1,
      binding: binding(s), evidenceRef: `sha256:${hash({ digest, fact })}`, ...fact }
    const folded = foldProviderObservation(observation, event)
    if (!folded.accepted) return reject(s, folded.reasonCode)
    observation = folded.state; events.push(event)
  }
  return { accepted: true, repeated: false, reasonCode: 'normalized', events: freeze(events), state: freeze({ ...s, observation,
    initialized: next.initialized ?? s.initialized, tasks: next.tasks ?? s.tasks, sourceSequence: source.sequence,
    receipts: [...s.receipts, { eventId: source.eventId, sequence: source.sequence, digest }] }) }
}
export function normalizeClaudeEvent(s: ClaudeProviderState, source: ClaudeSource, input: unknown, attribution?: ClaudeAttribution): ClaudeNormalized {
  const badSource = sourceError(s, source); if (badSource) return badSource
  if (!obj(input) || !oneOf(input.type, ['system','result'])) return reject(s, 'unsupported_event')
  const raw = input, b = binding(s), native = b.native
  if (native.status !== 'observed') return reject(s, 'native_identity_unknown')
  const patchEvent = raw.type === 'system' && raw.subtype === 'task_updated'
  if (!patchEvent || raw.session_id !== undefined && raw.session_id !== null) {
    if (!id(raw.session_id)) return reject(s, 'invalid_session')
    if (raw.session_id !== native.sessionId) return reject(s, 'foreign_session', false)
  }
  if (!optionalId(raw.uuid) || !optionalId(raw.tool_use_id)) return reject(s, 'invalid_message_identity')
  // An attributed human result still needs the host receipt: origin alone is
  // not a turn ID. Unknown/malformed/injected origins never complete this turn.
  const origin = raw.origin
  if (origin !== undefined && origin !== null && (!obj(origin) || !exact(origin, ['kind']) || origin.kind !== 'human')) return reject(s, 'unsupported_origin')
  const base = { type: raw.type, subtype: raw.subtype, sessionId: raw.session_id ?? null, uuid: raw.uuid ?? null,
    toolUseId: raw.tool_use_id ?? null, origin: origin == null ? null : 'human' }
  if (raw.type === 'system' && raw.subtype === 'init') {
    if (attribution !== undefined) return reject(s, 'unexpected_attribution')
    return commit(s, source, base, () => s.initialized ? 'duplicate_init' : { facts: [], initialized: true })
  }
  if (!s.initialized) return reject(s, 'init_required')
  if (raw.type === 'result') {
    if (raw.subtype !== 'success' || typeof raw.is_error !== 'boolean' || !natural(raw.duration_ms) || !natural(raw.duration_api_ms) || !natural(raw.num_turns)) return reject(s, 'unsupported_result')
    if (raw.terminal_reason !== undefined && raw.terminal_reason !== null && !oneOf(raw.terminal_reason, ['completed','max_turns','aborted_streaming','aborted_tools'])) return reject(s, 'unsupported_terminal_reason')
    const error = attributionError(s, source, raw, attribution, 'root-result'); if (error) return reject(s, error)
    const outcome = oneOf(raw.terminal_reason, ['aborted_streaming','aborted_tools']) ? 'interrupted' : raw.is_error || raw.terminal_reason === 'max_turns' ? 'failed' : 'completed'
    const context = { ...base, isError: raw.is_error, terminalReason: raw.terminal_reason ?? null, attribution }
    return commit(s, source, context, () => ({ facts: [{ type: 'turn_terminal', outcome }] }))
  }
  if (raw.subtype === 'task_started') {
    if (!id(raw.task_id) || !id(raw.uuid) || typeof raw.description !== 'string' || !oneOf(raw.task_type, ['local_agent','local_workflow'])) return reject(s, 'unsupported_task_start')
    const error = attributionError(s, source, raw, attribution, 'task-start'); if (error) return reject(s, error)
    const task: OwnedTask = { id: raw.task_id, taskType: raw.task_type as OwnedTask['taskType'], kind: raw.task_type === 'local_agent' ? 'child' : 'background',
      toolUseId: id(raw.tool_use_id) ? raw.tool_use_id : null, messageUuid: raw.uuid, attributionEvidenceRef: attribution!.evidenceRef, terminal: null }
    return commit(s, source, { ...base, taskId: task.id, taskType: task.taskType, attribution }, () => {
      if (s.tasks.some(t => t.id === task.id)) return 'task_already_owned'
      if (s.tasks.length >= PROVIDER_LIMITS.writers) return 'writer_limit'
      return { facts: [taskWriter(task, 'active')], tasks: [...s.tasks, task] }
    })
  }
  if (attribution !== undefined) return reject(s, 'unexpected_attribution')
  if (raw.subtype === 'task_progress') {
    const usage = raw.usage
    if (!id(raw.task_id) || !id(raw.uuid) || typeof raw.description !== 'string' || !obj(usage) ||
        !['total_tokens','tool_uses','duration_ms'].every(k => natural(usage[k])) ||
        raw.last_tool_name !== undefined && raw.last_tool_name !== null && typeof raw.last_tool_name !== 'string') return reject(s, 'invalid_task_progress')
    // Metrics/text are display data, not execution identity or terminal proof.
    // Their values do not enter evidence. Validation precedes dedup, so an
    // invalid replay cannot masquerade as an earlier valid observation.
    return commit(s, source, { ...base, taskId: raw.task_id, progress: true }, () => {
      const task = s.tasks.find(t => t.id === raw.task_id)
      if (!task) return 'unowned_task'
      if (raw.tool_use_id != null && raw.tool_use_id !== task.toolUseId) return 'task_tool_mismatch'
      if (task.terminal) return 'progress_after_terminal'
      return { facts: [] }
    })
  }
  if (raw.subtype === 'task_notification' || raw.subtype === 'task_updated') {
    if (!id(raw.task_id)) return reject(s, 'invalid_task_identity')
    let status: unknown
    if (raw.subtype === 'task_notification') {
      if (!id(raw.uuid) || typeof raw.output_file !== 'string' || typeof raw.summary !== 'string' || !oneOf(raw.status, ['completed','failed','stopped'])) return reject(s, 'invalid_task_notification')
      status = raw.status
    } else {
      if (!obj(raw.patch) || ('status' in raw.patch && !oneOf(raw.patch.status, ['pending','running','paused','completed','failed','killed'])) || 'task_type' in raw.patch) return reject(s, 'unsupported_task_patch')
      status = raw.patch.status
    }
    return commit(s, source, { ...base, taskId: raw.task_id, status: status ?? null }, () => {
      const task = s.tasks.find(t => t.id === raw.task_id)
      if (!task) return 'unowned_task'
      if (raw.tool_use_id != null && raw.tool_use_id !== task.toolUseId) return 'task_tool_mismatch'
      if (status === undefined) return { facts: [] }
      const terminal: OwnedTask['terminal'] = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : oneOf(status, ['stopped','killed']) ? 'interrupted' : null
      if (task.terminal && task.terminal !== terminal) return 'task_terminal_conflict'
      const nextTask = { ...task, terminal }
      return { facts: [taskWriter(nextTask, terminal ? 'terminal' : 'active')], tasks: s.tasks.map(t => t.id === task.id ? nextTask : t) }
    })
  }
  // No snapshot, idle, control ACK or unknown system event can clear writers.
  return reject(s, 'unsupported_system_event')
}
