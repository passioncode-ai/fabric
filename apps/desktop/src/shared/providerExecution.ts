// Internal P05.1/P05.2 contract. Only trusted host adapters may produce these
// observations. Validation proves consistency of scoped evidence, not vendor
// conformance, absence of external effects, or a universal process sandbox.
export const PROVIDER_LIMITS = Object.freeze({ events: 256, writers: 128, connections: 64, idLength: 128, eventChars: 32_768 })
export type ProviderRuntimeProfile = 'owned-pty' | 'owned-stdio' | 'owned-loopback' | 'shared-daemon' | 'remote'
/** ADR-0081: the Fabric-started backend a loopback execution runs in. Present on the
 * `owned-loopback` profile and on no other — a loopback backend is never labelled `owned-stdio`
 * to pass the older validators. No token or address: the listener's secret stays in main. */
export interface LoopbackBackend { listener: 'loopback-ws'; epoch: string; processRef: string }
export type NativeIdentity = { status: 'unknown'; reason: 'not_observed' | 'connection_lost' } | {
  status: 'observed'; connectionId: string; sessionId: string | null; threadId: string | null; turnId: string | null
}
export interface ProviderExecutionBinding {
  schema: 'ProviderExecution@1'
  fabric: { estateId: string; taskId: string; runId: string; sessionId: string }
  provider: { id: 'claude-code' | 'codex-cli'; build: string; runtimeProfile: ProviderRuntimeProfile; backend?: LoopbackBackend }
  native: NativeIdentity
  /** Host correlation is explicit when the provider exposes no native turn id.
   * The adapter must fence/serialize that request; a Session is not a turn. */
  execution: { kind: 'native-turn' | 'host-request'; id: string }
  manifestDigest: string
  policyDigest: string
}
export interface ProviderWriter { kind: 'background' | 'child' | 'remote'; id: string; state: 'active' | 'terminal' | 'unknown' }
interface Envelope { schema: 'ProviderEvent@1'; eventId: string; cursor: number; binding: ProviderExecutionBinding; evidenceRef: string }
export type ProviderEvent = Envelope & (
  { type: 'request_ack'; commandId: string } |
  { type: 'turn_terminal'; outcome: 'completed' | 'failed' | 'interrupted' } |
  { type: 'writer'; writer: ProviderWriter } |
  { type: 'inventory'; writers: ProviderWriter[]; throughCursor: number; complete: boolean; admissionClosed: boolean; unknownWriters: boolean } |
  { type: 'load_ack'; manifestDigest: string; policyDigest: string }
)
export interface ProviderObservationState {
  readonly binding: ProviderExecutionBinding
  readonly cursor: number
  /** Non-evicting transport history prevents an old connection ABA replay. */
  readonly retiredConnections: readonly string[]
  readonly seen: readonly { eventId: string; cursor: number; canonical: string }[]
  readonly writers: readonly ProviderWriter[]
  readonly terminal: { outcome: 'completed' | 'failed' | 'interrupted'; evidenceRef: string } | null
  readonly inventory: { cursor: number; admissionClosed: boolean; unknownWriters: boolean; evidenceRef: string } | null
  readonly load: { manifestDigest: string; policyDigest: string; evidenceRef: string } | null
  /** A same-scope stream inconsistency requires a new connection + resync. */
  readonly fault: string | null
}
export type Validation<T> = { ok: true; value: T } | { ok: false; reasonCode: string }
export type ProviderFold = { accepted: boolean; repeated: boolean; reasonCode: string; state: ProviderObservationState }
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k)) && allowed.every(k => k in v)
const id = (v: unknown): v is string => typeof v === 'string' && v.length <= PROVIDER_LIMITS.idLength && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v)
const oneOf = (v: unknown, values: readonly string[]): v is string => typeof v === 'string' && values.includes(v)
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const evidence = (v: unknown): v is string => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v)
const cursor = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (plain(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) }; return v }
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const fail = (reasonCode: string): { ok: false; reasonCode: string } => ({ ok: false, reasonCode })

/** Strict allowlist: payloads, logs, credentials, paths and arbitrary metadata
 * have no place here. Opaque native ids still require trusted-adapter hygiene. */
export function validateProviderBinding(input: unknown): Validation<ProviderExecutionBinding> {
  if (!plain(input) || !keys(input, ['schema','fabric','provider','native','execution','manifestDigest','policyDigest']) || input.schema !== 'ProviderExecution@1') return fail('invalid_binding')
  const { fabric, provider, native, execution } = input
  if (!plain(fabric) || !keys(fabric, ['estateId','taskId','runId','sessionId']) || !Object.values(fabric).every(id)) return fail('invalid_fabric_identity')
  if (!plain(provider) || !oneOf(provider.id, ['claude-code','codex-cli']) || !id(provider.build) ||
      !oneOf(provider.runtimeProfile, ['owned-pty','owned-stdio','owned-loopback','shared-daemon','remote'])) return fail('invalid_provider_identity')
  // The backend block belongs to the loopback profile alone, in both directions.
  if ('backend' in provider && provider.runtimeProfile !== 'owned-loopback') return fail('profile_mismatch')
  if (provider.runtimeProfile === 'owned-loopback') {
    const b = provider.backend
    if (!keys(provider, ['id','build','runtimeProfile','backend']) || !plain(b) || !keys(b, ['listener','epoch','processRef']) || b.listener !== 'loopback-ws' ||
        !id(b.epoch) || typeof b.processRef !== 'string' || !/^process:[a-f0-9]{16,64}$/.test(b.processRef)) return fail('loopback_backend_required')
  } else if (!keys(provider, ['id','build','runtimeProfile'])) return fail('invalid_provider_identity')
  if (!digest(input.manifestDigest) || !digest(input.policyDigest)) return fail('invalid_digest')
  if (!plain(execution) || !keys(execution, ['kind','id']) || !oneOf(execution.kind, ['native-turn','host-request']) || !id(execution.id)) return fail('execution_boundary_required')
  if (!plain(native)) return fail('invalid_native_identity')
  if (native.status === 'unknown') {
    if (!keys(native, ['status','reason']) || !oneOf(native.reason, ['not_observed','connection_lost'])) return fail('invalid_native_identity')
  } else if (native.status === 'observed') {
    if (!keys(native, ['status','connectionId','sessionId','threadId','turnId']) || !id(native.connectionId) ||
        !['sessionId','threadId','turnId'].every(k => native[k] === null || id(native[k]))) return fail('invalid_native_identity')
    // A view (the operator's TUI) observes an execution; it is never the connection one binds to.
    if ((native.connectionId as string).startsWith('view:')) return fail('view_cannot_bind_execution')
    if (provider.id === 'claude-code' && (!id(native.sessionId) || native.threadId !== null)) return fail('claude_session_required')
    if (provider.id === 'codex-cli' && (!id(native.threadId) || !id(native.turnId))) return fail('codex_thread_turn_required')
    if (native.turnId !== null && (execution.kind !== 'native-turn' || execution.id !== native.turnId)) return fail('turn_boundary_mismatch')
    if (native.turnId === null && execution.kind !== 'host-request') return fail('request_epoch_required')
  } else return fail('invalid_native_identity')
  return { ok: true, value: freeze(copy(input as unknown as ProviderExecutionBinding)) }
}
export function createProviderObservation(input: unknown): Validation<ProviderObservationState> {
  const binding = validateProviderBinding(input)
  if (!binding.ok) return binding
  return { ok: true, value: freeze({ binding: binding.value, cursor: 0, retiredConnections: [], seen: [], writers: [], terminal: null, inventory: null, load: null, fault: null }) }
}
const writerKey = (w: ProviderWriter) => `${w.kind}/${w.id}`
function validWriter(w: unknown): w is ProviderWriter {
  return plain(w) && keys(w, ['kind','id','state']) && oneOf(w.kind, ['background','child','remote']) && id(w.id) && oneOf(w.state, ['active','terminal','unknown'])
}
function validEvent(input: unknown): Validation<ProviderEvent> {
  if (!plain(input)) return fail('invalid_event')
  const common = ['schema','eventId','cursor','binding','evidenceRef','type']
  const extra: Record<string, string[]> = { request_ack:['commandId'], turn_terminal:['outcome'], writer:['writer'],
    inventory:['writers','throughCursor','complete','admissionClosed','unknownWriters'], load_ack:['manifestDigest','policyDigest'] }
  if (typeof input.type !== 'string' || !Object.hasOwn(extra, input.type) || !keys(input, [...common,...extra[input.type]]) ||
      input.schema !== 'ProviderEvent@1' || !id(input.eventId) || !cursor(input.cursor) || input.cursor === 0 || !evidence(input.evidenceRef)) return fail('invalid_event')
  const binding = validateProviderBinding(input.binding)
  if (!binding.ok) return binding
  if (input.type === 'request_ack' && !id(input.commandId)) return fail('invalid_command')
  if (input.type === 'turn_terminal' && !oneOf(input.outcome, ['completed','failed','interrupted'])) return fail('invalid_terminal')
  if (input.type === 'writer' && !validWriter(input.writer)) return fail('invalid_writer')
  if (input.type === 'inventory') {
    if (!Array.isArray(input.writers) || input.writers.length > PROVIDER_LIMITS.writers) return fail('writer_limit')
    if (!input.writers.every(validWriter) || !cursor(input.throughCursor) ||
        !['complete','admissionClosed','unknownWriters'].every(k => typeof input[k] === 'boolean')) return fail('invalid_inventory')
    if (new Set(input.writers.map(writerKey)).size !== input.writers.length) return fail('duplicate_writer')
  }
  if (input.type === 'load_ack' && (!digest(input.manifestDigest) || !digest(input.policyDigest))) return fail('invalid_digest')
  if (canonical(input).length > PROVIDER_LIMITS.eventChars) return fail('event_limit')
  return { ok: true, value: copy(input as unknown as ProviderEvent) }
}

/** Cursors are contiguous in the adapter's normalized stream, scoped to one
 * connection epoch. Dropped records cannot be papered over by a later snapshot. */
export function foldProviderObservation(state: ProviderObservationState, input: unknown): ProviderFold {
  const rejected = (reasonCode: string, poison = false): ProviderFold => ({ accepted: false, repeated: false, reasonCode,
    state: poison ? freeze({ ...state, fault: state.fault ?? reasonCode, inventory: null }) : state })
  const parsed = validEvent(input)
  if (!parsed.ok) {
    const envelopeBinding = plain(input) ? validateProviderBinding(input.binding) : fail('invalid_binding')
    return rejected(parsed.reasonCode, envelopeBinding.ok && canonical(envelopeBinding.value) === canonical(state.binding))
  }
  const e = parsed.value
  if (canonical(e.binding) !== canonical(state.binding)) return rejected('foreign_binding')
  if (state.binding.native.status !== 'observed') return rejected('native_identity_unknown')
  const previous = state.seen.find(r => r.eventId === e.eventId)
  const bytes = canonical(e)
  if (previous) return previous.canonical === bytes
    ? { accepted: true, repeated: true, reasonCode: 'repeated', state } : rejected('event_id_conflict', true)
  if (state.fault) return rejected('resync_required')
  if (e.cursor !== state.cursor + 1) return rejected(e.cursor <= state.cursor ? 'stale_cursor' : 'cursor_gap', true)
  if (state.seen.length >= PROVIDER_LIMITS.events) return rejected('event_limit', true)
  let writers = [...state.writers], terminal = state.terminal, inventory = state.inventory, load = state.load
  if (e.type === 'turn_terminal') {
    if (terminal && terminal.outcome !== e.outcome) return rejected('terminal_conflict', true)
    terminal = { outcome: e.outcome, evidenceRef: e.evidenceRef }
  } else if (e.type === 'writer') {
    const prior = writers.find(w => writerKey(w) === writerKey(e.writer))
    if (prior?.state === 'terminal' && e.writer.state !== 'terminal') return rejected('writer_reopened', true)
    if (state.inventory?.admissionClosed && !prior && e.writer.state !== 'terminal') return rejected('writer_after_closure', true)
    writers = [...writers.filter(w => writerKey(w) !== writerKey(e.writer)), e.writer]
    if (writers.length > PROVIDER_LIMITS.writers) return rejected('writer_limit', true)
    // Keep the closure fence even though its older cursor is no longer a
    // current inventory proof. Writer updates cannot erase closed admission.
  } else if (e.type === 'inventory') {
    if (!e.complete) return rejected('partial_inventory', true)
    if (e.throughCursor !== state.cursor) return rejected('inventory_watermark', true)
    if (state.inventory?.admissionClosed && (!e.admissionClosed || (!state.inventory.unknownWriters && e.unknownWriters) ||
        e.writers.some(next => next.state !== 'terminal' && !writers.some(prior => writerKey(prior) === writerKey(next)))))
      return rejected('scope_reopened', true)
    if (writers.some(w => !e.writers.some(next => writerKey(w) === writerKey(next)))) return rejected('inventory_omits_writer', true)
    if (writers.some(w => w.state === 'terminal' && e.writers.some(next => writerKey(w) === writerKey(next) && next.state !== 'terminal'))) return rejected('writer_reopened', true)
    writers = e.writers
    inventory = { cursor: e.cursor, admissionClosed: e.admissionClosed, unknownWriters: e.unknownWriters, evidenceRef: e.evidenceRef }
  } else if (e.type === 'load_ack') {
    if (e.manifestDigest !== state.binding.manifestDigest || e.policyDigest !== state.binding.policyDigest) return rejected('load_digest_mismatch', true)
    load = { manifestDigest: e.manifestDigest, policyDigest: e.policyDigest, evidenceRef: e.evidenceRef }
  }
  return { accepted: true, repeated: false, reasonCode: 'observed', state: freeze({ ...state, cursor: e.cursor, writers, terminal, inventory, load,
    seen: [...state.seen, { eventId: e.eventId, cursor: e.cursor, canonical: bytes }] }) }
}

/** A new transport invalidates all cursor proofs. Known writer identities are
 * retained as unknown until the adapter obtains an exhaustive resync snapshot. */
export function reconnectProviderObservation(state: ProviderObservationState, input: unknown): Validation<ProviderObservationState> {
  const parsed = validateProviderBinding(input)
  if (!parsed.ok) return parsed
  const next = parsed.value, before = state.binding
  if (next.native.status !== 'observed' || before.native.status !== 'observed' || next.native.connectionId === before.native.connectionId) return fail('new_connection_required')
  if (state.retiredConnections.includes(next.native.connectionId)) return fail('retired_connection')
  if (state.retiredConnections.length >= PROVIDER_LIMITS.connections - 1) return fail('connection_limit')
  const withoutEpoch = (b: ProviderExecutionBinding) => ({ ...b, native: { ...b.native, connectionId: null } })
  if (canonical(withoutEpoch(next)) !== canonical(withoutEpoch(before))) return fail('foreign_binding')
  return { ok: true, value: freeze({ binding: next, cursor: 0, retiredConnections: [...state.retiredConnections, before.native.connectionId], seen: [], writers: state.writers.map(w => ({ ...w, state: 'unknown' as const })),
    terminal: null, inventory: null, load: null, fault: null }) }
}
export function assessProviderQuiescence(state: ProviderObservationState, throughCursor: number):
  { quiescent: true; binding: ProviderExecutionBinding; cursor: number; evidenceRef: string } | { quiescent: false; reasonCode: string } {
  const no = (reasonCode: string) => ({ quiescent: false as const, reasonCode })
  if (state.binding.native.status !== 'observed') return no('native_identity_unknown')
  if (state.fault) return no('resync_required')
  if (!cursor(throughCursor) || throughCursor !== state.cursor) return no('cursor_mismatch')
  if (!state.terminal) return no('turn_unresolved')
  if (!state.inventory || state.inventory.cursor !== state.cursor) return no('inventory_required')
  if (!state.inventory.admissionClosed) return no('writer_admission_open')
  if (state.inventory.unknownWriters || state.writers.some(w => w.state !== 'terminal')) return no('writers_unresolved')
  return { quiescent: true, binding: state.binding, cursor: state.cursor, evidenceRef: state.inventory.evidenceRef }
}

export interface ProviderCommand { commandId: string; issuedCursor: number }
export interface ProviderStopCommand extends ProviderCommand { reason: 'operator_stop' | 'app_shutdown' | 'natural_exit' | 'launch_failure' }
export interface ProviderResumeCommand extends ProviderCommand { checkpointDigest: string }
export interface ProviderRequestAck { binding: ProviderExecutionBinding; commandId: string; accepted: boolean; evidenceRef: string }
export interface ProviderResumeAck {
  binding: ProviderExecutionBinding; commandId: string; cursor: number; checkpointDigest: string; restored: boolean
  loadedManifestDigest: string; loadedPolicyDigest: string; evidenceRef: string
}
export function validateProviderStopCommand(input: unknown): Validation<ProviderStopCommand> {
  if (!plain(input) || !keys(input, ['commandId','issuedCursor','reason']) || !id(input.commandId) || !cursor(input.issuedCursor) ||
      !oneOf(input.reason, ['operator_stop','app_shutdown','natural_exit','launch_failure'])) return fail('invalid_stop_command')
  return { ok: true, value: freeze(copy(input as unknown as ProviderStopCommand)) }
}
export function validateProviderResumeCommand(input: unknown): Validation<ProviderResumeCommand> {
  if (!plain(input) || !keys(input, ['commandId','issuedCursor','checkpointDigest']) || !id(input.commandId) || !cursor(input.issuedCursor) ||
      !digest(input.checkpointDigest)) return fail('invalid_resume_command')
  return { ok: true, value: freeze(copy(input as unknown as ProviderResumeCommand)) }
}
export function validateProviderRequestAck(binding: ProviderExecutionBinding, command: ProviderCommand, input: unknown): Validation<ProviderRequestAck> {
  const expected = validateProviderBinding(binding)
  if (!expected.ok) return expected
  if (binding.native.status !== 'observed') return fail('native_identity_unknown')
  if (!id(command.commandId) || !cursor(command.issuedCursor)) return fail('invalid_command')
  if (!plain(input) || !keys(input, ['binding','commandId','accepted','evidenceRef']) || typeof input.accepted !== 'boolean' || !evidence(input.evidenceRef)) return fail('invalid_request_ack')
  const actual = validateProviderBinding(input.binding)
  if (!actual.ok || canonical(actual.value) !== canonical(binding)) return fail('foreign_binding')
  if (input.commandId !== command.commandId) return fail('command_mismatch')
  return { ok: true, value: freeze(copy(input as unknown as ProviderRequestAck)) }
}
// Implementations preserve the supplied command identity across lost replies,
// check stillAllowed immediately before every effect, and bound transport waits.
// These declarations do not perform cancellation or grant execution authority.
export interface ProviderLifecycle {
  requestStop(binding: ProviderExecutionBinding, command: ProviderStopCommand, stillAllowed: () => boolean): Promise<ProviderRequestAck>
  observeQuiescence(binding: ProviderExecutionBinding, throughCursor: number): Promise<readonly ProviderEvent[]>
  /** Never substitute latest-session lookup, a fork, or a fresh conversation. */
  resumeExact(binding: ProviderExecutionBinding, command: ProviderResumeCommand, stillAllowed: () => boolean): Promise<ProviderRequestAck>
  observeResumeAck(binding: ProviderExecutionBinding, command: ProviderResumeCommand): Promise<ProviderResumeAck | null>
}
/** A control ACK is intentionally not an input to this restoration gate. */
export function validateProviderResumeAck(binding: ProviderExecutionBinding, command: ProviderResumeCommand, input: unknown): Validation<ProviderResumeAck> {
  const bound = validateProviderBinding(binding)
  if (!bound.ok) return bound
  if (binding.native.status !== 'observed') return fail('native_identity_unknown')
  const requested = validateProviderResumeCommand(command)
  if (!requested.ok) return requested
  if (!plain(input) || !keys(input, ['binding','commandId','cursor','checkpointDigest','restored','loadedManifestDigest','loadedPolicyDigest','evidenceRef'])) return fail('invalid_resume_ack')
  const actual = validateProviderBinding(input.binding)
  if (!actual.ok || canonical(actual.value) !== canonical(binding)) return fail('foreign_binding')
  if (input.commandId !== command.commandId || input.checkpointDigest !== command.checkpointDigest) return fail('resume_target_mismatch')
  if (!cursor(input.cursor) || input.cursor <= command.issuedCursor) return fail('stale_resume_ack')
  if (input.restored !== true) return fail('restore_unproved')
  if (input.loadedManifestDigest !== binding.manifestDigest || input.loadedPolicyDigest !== binding.policyDigest) return fail('load_digest_mismatch')
  if (!evidence(input.evidenceRef)) return fail('invalid_evidence')
  return { ok: true, value: freeze(copy(input as unknown as ProviderResumeAck)) }
}
