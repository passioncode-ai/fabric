import { validateProviderBinding, validateProviderStopCommand, PROVIDER_LIMITS } from '../shared/providerExecution.ts'
import type { ProviderExecutionBinding, ProviderStopCommand, Validation } from '../shared/providerExecution.ts'
import type { ClaudeProviderState } from './claudeProviderEvents.ts'
import type { ClaudeControlRequest } from './claudeControlTransport.ts'

// Candidate 2.1.283 owned-stdio profile. These are control receipts, not native
// conformance or quiescence. The SDK task ledger cannot enumerate every writer.
export const CLAUDE_STOP_LIMITS = Object.freeze({ tasks: PROVIDER_LIMITS.writers, requests: 1 + PROVIDER_LIMITS.writers })
export interface ClaudeControlPorts {
  binding: ProviderExecutionBinding
  /** Obtained from the event normalizer, including separately attributed task starts.
   * Captured and frozen at construction: create one controller per canonical
   * Stop operation from its latest observed roster, not once at launch. Tasks
   * born after this snapshot remain unaddressed/unknown; never rebuild merely
   * to retry an ambiguous command. Durable recovery belongs to the supervisor. */
  ownership: ClaudeProviderState
  currentState(): ClaudeProviderState | null
  transport: {
    /** Check the supplied fence at the actual write, including deferred writes.
     * A timed-out request must never enqueue an unfenced later effect. */
    requestControl(request: ClaudeControlRequest, stillAllowed: () => boolean): Promise<unknown>
  }
  timeoutMs?: number
}
export interface ClaudeStopRequestResult {
  status: 'request_ack' | 'refused' | 'outcome_unknown'
  reasonCode: string
  binding: ProviderExecutionBinding
  commandId: string
  interruptAcknowledged: boolean
  /** Always partial: neither this ledger nor any control ACK proves coverage. */
  inventoryComplete: false
  unknownWriters: true
  taskRequests: readonly { taskId: string; acknowledged: boolean }[]
  /** Owned tasks observed after the captured roster; never silently targeted. */
  unaddressedTaskIds: readonly string[]
}
export interface ClaudeProviderControl {
  requestStop(command: ProviderStopCommand, stillAllowed: () => boolean): Promise<ClaudeStopRequestResult>
}
type Task = { id: string; identity: string; terminal: string | null }
type Snapshot = { source: number; cursor: number; tasks: Task[] }
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) }; return v }
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v)
// Ports are trusted native code, but unreadable/accessor input still refuses
// without calling getters, toJSON or putting private exceptions in a receipt.
function dataObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype) return null
  const descriptors = Object.getOwnPropertyDescriptors(v)
  if (Reflect.ownKeys(v).some(k => typeof k !== 'string') || Object.values(descriptors).some(d => !('value' in d))) return null
  return Object.fromEntries(Object.entries(descriptors).map(([k, d]) => [k, d.value]))
}
function inertSmall(v: unknown, depth = 0, budget = { nodes: 128 }): unknown {
  if (--budget.nodes < 0 || depth > 8) throw new Error('invalid_input')
  if (v === null || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.length <= 256) return v
  const object = dataObject(v)
  if (!object) throw new Error('invalid_input')
  return Object.fromEntries(Object.entries(object).map(([k, value]) => [k, inertSmall(value, depth + 1, budget)]))
}
function snapshot(value: unknown, expected: ProviderExecutionBinding): Snapshot | null {
  const state = dataObject(value), observation = dataObject(state?.observation)
  if (!state || !observation || state.initialized !== true || state.fault !== null || observation.fault !== null ||
      !natural(state.sourceSequence) || state.sourceSequence < 1 || !natural(observation.cursor)) return null
  const binding = validateProviderBinding(inertSmall(observation.binding))
  if (!binding.ok || canonical(binding.value) !== canonical(expected)) return null
  if (!Array.isArray(state.tasks) || state.tasks.length > CLAUDE_STOP_LIMITS.tasks) return null
  const descriptors = Object.getOwnPropertyDescriptors(state.tasks), tasks: Task[] = []
  for (let i = 0; i < state.tasks.length; i++) {
    const descriptor = descriptors[String(i)]
    const task = descriptor && 'value' in descriptor ? dataObject(descriptor.value) : null
    if (!task || !id(task.id) || !id(task.messageUuid) || !(task.toolUseId === null || id(task.toolUseId)) ||
        !['local_agent','local_workflow'].includes(task.taskType as string) ||
        task.kind !== (task.taskType === 'local_agent' ? 'child' : 'background') ||
        typeof task.attributionEvidenceRef !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(task.attributionEvidenceRef) ||
        !(task.terminal === null || ['completed','failed','interrupted'].includes(task.terminal as string))) return null
    const { id: taskId, taskType, kind, toolUseId, messageUuid, attributionEvidenceRef } = task
    tasks.push({ id: taskId, terminal: task.terminal as string | null,
      identity: canonical({ taskId, taskType, kind, toolUseId, messageUuid, attributionEvidenceRef }) })
  }
  if (new Set(tasks.map(t => t.id)).size !== tasks.length) return null
  return { source: state.sourceSequence, cursor: observation.cursor, tasks }
}
const discardAsync = (value: unknown) => {
  if (value && (typeof value === 'object' || typeof value === 'function')) void Promise.resolve(value).catch(() => undefined)
}

export function createClaudeProviderControl(ports: ClaudeControlPorts): Validation<ClaudeProviderControl> {
  let binding: ProviderExecutionBinding, held: Snapshot
  try {
    const parsed = validateProviderBinding(inertSmall(ports.binding))
    if (!parsed.ok) return parsed
    binding = parsed.value
    if (binding.provider.id !== 'claude-code' || binding.provider.build !== '2.1.283' || binding.provider.runtimeProfile !== 'owned-stdio' ||
        binding.native.status !== 'observed' || binding.native.turnId !== null || binding.execution.kind !== 'host-request')
      return { ok: false, reasonCode: 'unsupported_control_profile' }
    const initial = snapshot(ports.ownership, binding)
    if (!initial) return { ok: false, reasonCode: 'invalid_ownership_snapshot' }
    held = freeze(initial)
  } catch { return { ok: false, reasonCode: 'invalid_ownership_snapshot' } }
  if (typeof ports.currentState !== 'function' || typeof ports.transport?.requestControl !== 'function') return { ok: false, reasonCode: 'invalid_ports' }
  const timeoutMs = ports.timeoutMs ?? 10_000
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) return { ok: false, reasonCode: 'invalid_timeout' }
  let latest = held, checking = false, scopeFault = false
  let canonicalCommand: ProviderStopCommand | null = null, pending: Promise<ClaudeStopRequestResult> | null = null, cached: ClaudeStopRequestResult | null = null
  const base = (commandId: string, status: ClaudeStopRequestResult['status'], reasonCode: string): ClaudeStopRequestResult => freeze({
    status, reasonCode, commandId, binding, interruptAcknowledged: false, inventoryComplete: false, unknownWriters: true, taskRequests: [], unaddressedTaskIds: [] })
  function scopedAllowed(authority: () => boolean, minimumCursor: number): boolean {
    if (checking || scopeFault) return false
    checking = true
    try {
      const allowed: unknown = authority()
      if (allowed !== true) { discardAsync(allowed); return false }
      const current = ports.currentState()
      if (!current) { scopeFault = true; return false }
      const next = snapshot(current, binding)
      if (!next) discardAsync(current)
      if (!next || next.source < latest.source || next.cursor < Math.max(latest.cursor, minimumCursor) ||
          latest.tasks.some(prior => { const task = next.tasks.find(t => t.id === prior.id)
            return !task || task.identity !== prior.identity || prior.terminal !== null && task.terminal !== prior.terminal })) {
        scopeFault = true; return false
      }
      latest = freeze(next)
      return true
    } catch { /* Scope read failure becomes a fixed refused/unknown result; raw input is not logged. */ scopeFault = true; return false } finally { checking = false }
  }
  async function execute(command: ProviderStopCommand, authority: () => boolean, deadline: number): Promise<ClaudeStopRequestResult> {
    let expired = false, attempted = false, interruptAcknowledged = false, requests = 0
    const taskRequests: { taskId: string; acknowledged: boolean }[] = []
    const result = (status: ClaudeStopRequestResult['status'], reasonCode: string): ClaudeStopRequestResult => freeze({
      status, reasonCode, commandId: command.commandId, binding, interruptAcknowledged, inventoryComplete: false, unknownWriters: true,
      taskRequests: taskRequests.map(t => ({ ...t })), unaddressedTaskIds: latest.tasks.filter(t => t.terminal === null && !held.tasks.some(h => h.id === t.id)).map(t => t.id) })
    const allowed = (taskId?: string) => {
      if (expired || performance.now() >= deadline) { expired = true; return false }
      const permit = scopedAllowed(authority, command.issuedCursor)
      if (performance.now() >= deadline) { expired = true; return false }
      return permit && (taskId === undefined || latest.tasks.some(t => t.id === taskId && t.terminal === null))
    }
    let timer!: ReturnType<typeof setTimeout>
    const elapsed = new Promise<null>(resolve => { timer = setTimeout(() => { expired = true; resolve(null) }, Math.max(1, deadline - performance.now())) })
    async function send(request: ClaudeControlRequest): Promise<ClaudeStopRequestResult | null> {
      const taskId = request.subtype === 'stop_task' ? request.task_id : undefined
      if (!allowed(taskId)) return result(attempted ? 'outcome_unknown' : 'refused', expired ? 'deadline' : 'scope_changed')
      if (++requests > CLAUDE_STOP_LIMITS.requests) return result('outcome_unknown', 'request_limit')
      attempted = true
      const taskReceipt = taskId === undefined ? null : { taskId, acknowledged: false }
      if (taskReceipt) taskRequests.push(taskReceipt)
      let response: unknown
      try { response = await Promise.race([ports.transport.requestControl(request, () => allowed(taskId)), elapsed]) }
      catch { /* The typed result carries failure; provider text must remain private. */ return result('outcome_unknown', 'transport_failure') }
      // Recheck the execution scope after replies, but a concurrently terminal
      // task may acknowledge its request without remaining active.
      if (!allowed()) return result('outcome_unknown', expired ? 'deadline' : 'scope_changed')
      const reply = dataObject(response)
      if (!reply) return result('outcome_unknown', 'invalid_transport_reply')
      const fields = reply.status === 'ack' ? ['status','requestId'] : reply.status === 'error' ? ['status','requestId','code'] : ['status','reason', ...(Object.hasOwn(reply,'requestId') ? ['requestId'] : [])]
      if (Object.keys(reply).some(k => !fields.includes(k)) || fields.some(k => !Object.hasOwn(reply,k)) ||
          reply.requestId !== undefined && !id(reply.requestId)) return result('outcome_unknown', 'invalid_transport_reply')
      if (reply.status === 'not_sent' && typeof reply.reason === 'string') return result(interruptAcknowledged ? 'outcome_unknown' : 'refused', 'request_not_sent')
      if (reply.status === 'outcome_unknown' && typeof reply.reason === 'string') return result('outcome_unknown', reply.reason === 'deadline' ? 'request_timeout' : 'request_outcome_unknown')
      if (reply.status === 'error' && reply.code === 'provider_control_error') return result('outcome_unknown', 'provider_error')
      if (reply.status !== 'ack' || !id(reply.requestId)) return result('outcome_unknown', 'invalid_transport_reply')
      if (taskReceipt) taskReceipt.acknowledged = true
      return null
    }
    try {
      const interrupt = await send({ subtype: 'interrupt' })
      if (interrupt) return interrupt
      interruptAcknowledged = true
      for (const task of held.tasks) {
        if (!allowed()) return result('outcome_unknown', expired ? 'deadline' : 'scope_changed')
        if (latest.tasks.find(t => t.id === task.id)?.terminal !== null) continue
        const failure = await send({ subtype: 'stop_task', task_id: task.id })
        if (failure) return failure
      }
      if (!allowed()) return result('outcome_unknown', expired ? 'deadline' : 'scope_changed')
      if (latest.tasks.some(t => t.terminal === null && !held.tasks.some(h => h.id === t.id))) return result('outcome_unknown', 'new_owned_tasks')
      return result('request_ack', 'requests_acknowledged')
    } finally { clearTimeout(timer); expired = true }
  }
  function requestStop(input: ProviderStopCommand, authority: () => boolean): Promise<ClaudeStopRequestResult> {
    const deadline = performance.now() + timeoutMs
    let command: ProviderStopCommand
    try {
      const parsed = validateProviderStopCommand(inertSmall(input))
      if (!parsed.ok) return Promise.resolve(base('invalid', 'refused', parsed.reasonCode))
      command = parsed.value
    } catch { /* Invalid input is reported as a fixed refusal, never serialized into diagnostics. */ return Promise.resolve(base('invalid', 'refused', 'invalid_stop_command')) }
    const conflict = () => canonicalCommand !== null && canonical(canonicalCommand) !== canonical(command)
    if (conflict()) return Promise.resolve(base(command.commandId, 'refused', 'canonical_command_conflict'))
    if (!scopedAllowed(authority, command.issuedCursor)) return Promise.resolve(base(command.commandId, 'refused', 'scope_changed'))
    if (performance.now() >= deadline) return Promise.resolve(base(command.commandId, 'refused', 'deadline'))
    if (conflict()) return Promise.resolve(base(command.commandId, 'refused', 'canonical_command_conflict'))
    if (cached) return Promise.resolve(cached)
    if (pending) return pending
    canonicalCommand = command
    let settle!: (result: ClaudeStopRequestResult) => void
    pending = new Promise(resolve => { settle = resolve })
    const joined = pending
    void execute(command, authority, deadline).then(value => { cached = value; pending = null; settle(value) }, () => {
      cached = base(command.commandId, 'outcome_unknown', 'control_failure'); pending = null; settle(cached)
    })
    return joined
  }
  return { ok: true, value: { requestStop } }
}
