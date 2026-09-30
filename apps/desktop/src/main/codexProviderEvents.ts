import { createHash } from 'node:crypto'
import { createProviderObservation, foldProviderObservation, validateProviderBinding, PROVIDER_LIMITS } from '../shared/providerExecution.ts'
import type { ProviderExecutionBinding, ProviderObservationState, ProviderEvent, ProviderWriter, Validation } from '../shared/providerExecution.ts'

// Protocol subset measured from codex 0.157.1 app-server JSON schemas. This pure
// parser does not authenticate a transport, terminate work, or prove conformance.
// Transport supplies a contiguous lifecycle-channel sequence and unique ids;
// source ordering is host observation ordering, not a vendor-issued cursor.
export interface CodexSource { connectionId: string; sequence: number; eventId: string }
export interface CodexProviderState {
  readonly observation: ProviderObservationState
  readonly sourceSequence: number
  readonly receipts: readonly { eventId: string; sequence: number; digest: string }[]
  readonly ownedProcesses: readonly string[]
  readonly itemProcesses: Readonly<Record<string, string>>
  readonly fault: string | null
}
export interface CodexHostCoverage {
  binding: ProviderExecutionBinding
  throughSourceSequence: number
  admissionClosed: true
  coveredKinds: ['background', 'child', 'remote']
  evidenceRef: string
}
export interface CodexBackgroundPages {
  threadId: string
  pages: readonly { requestCursor: string | null; response: unknown }[]
}
export interface CodexNormalized {
  accepted: boolean; repeated: boolean; reasonCode: string
  state: CodexProviderState; events: readonly ProviderEvent[]
}
type Fact = { type: 'writer'; writer: ProviderWriter } | { type: 'turn_terminal'; outcome: 'completed' | 'failed' | 'interrupted' } |
  { type: 'inventory'; writers: ProviderWriter[]; complete: boolean; admissionClosed: boolean; unknownWriters: boolean }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)
const oneOf = (v: unknown, values: readonly string[]): v is string => typeof v === 'string' && values.includes(v)
const integer = (v: unknown): v is number => Number.isSafeInteger(v)
const evidence = (v: unknown): v is string => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v)
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : obj(v)
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v)
const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex')
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) }; return v }
const linked = (links: Record<string, string>, itemId: string): string | undefined => Object.hasOwn(links, itemId) ? links[itemId] : undefined
const handle = (namespace: string, nativeId: string) => `${namespace}:${hash(nativeId)}`
const writer = (kind: ProviderWriter['kind'], namespace: string, nativeId: string, state: ProviderWriter['state']): Fact =>
  ({ type: 'writer', writer: { kind, id: handle(namespace, nativeId), state } })
const binding = (s: CodexProviderState) => s.observation.binding
const reject = (s: CodexProviderState, reasonCode: string, poison = true): CodexNormalized => ({ accepted: false, repeated: false, reasonCode,
  state: poison ? freeze({ ...s, fault: s.fault ?? reasonCode, observation: { ...s.observation, fault: s.observation.fault ?? reasonCode, inventory: null } }) : s, events: [] })
export function createCodexProviderState(input: unknown): Validation<CodexProviderState> {
  const r = createProviderObservation(input)
  if (!r.ok) return r
  if (r.value.binding.provider.id !== 'codex-cli' || r.value.binding.provider.build !== '0.157.1') return { ok: false, reasonCode: 'unsupported_provider_build' }
  if (r.value.binding.native.status !== 'observed') return { ok: false, reasonCode: 'native_identity_unknown' }
  return { ok: true, value: freeze({ observation: r.value, sourceSequence: 0, receipts: [], ownedProcesses: [], itemProcesses: {}, fault: null }) }
}
function sourceError(s: CodexProviderState, source: CodexSource): CodexNormalized | null {
  if (!obj(source) || Object.keys(source).some(k => !['connectionId','sequence','eventId'].includes(k)) || !id(source.connectionId) || !id(source.eventId) || !integer(source.sequence) || source.sequence < 1) return reject(s, 'invalid_source')
  const native = binding(s).native
  if (native.status !== 'observed' || source.connectionId !== native.connectionId) return reject(s, 'foreign_connection', false)
  return null
}
// Source receipts use only protocol facts independent of mutable projections.
// Text bodies are represented only by their schema type, never their contents.
const scalar = (v: unknown): unknown => v === undefined ? { missing:true } : v === null ? null
  : typeof v === 'number' ? Number.isFinite(v) ? v : { invalidNumber:true }
  : typeof v === 'string' || typeof v === 'boolean' ? v : { invalidScalar:true }
function minimalItem(v: unknown): unknown {
  if (!obj(v)) return {invalidItem:true}
  const out: Record<string,unknown> = {}
  for (const k of ['type','id','status','processId','exitCode','senderThreadId','tool','agentThreadId','kind']) out[k]=scalar(v[k])
  out.commandIsString=typeof v.command==='string'; out.cwdIsString=typeof v.cwd==='string'; out.actionsIsArray=Array.isArray(v.commandActions)
  out.pathIsString=typeof v.agentPath==='string'
  out.receivers=Array.isArray(v.receiverThreadIds) && v.receiverThreadIds.length<=PROVIDER_LIMITS.writers ? v.receiverThreadIds.map(scalar) : null
  out.agents=obj(v.agentsStates) && Object.keys(v.agentsStates).length<=PROVIDER_LIMITS.writers
    ? Object.entries(v.agentsStates).map(([key,value])=>[key,obj(value)?scalar(value.status):null]).sort(([a],[b])=>String(a)<String(b)?-1:String(a)>String(b)?1:0) : null
  return out
}
function minimalNotification(method: string, p: Record<string,unknown>): unknown {
  const out: Record<string,unknown> = {method}
  for(const k of ['threadId','turnId','itemId','processId','processHandle','exitCode','startedAtMs','completedAtMs','stdoutCapReached','stderrCapReached']) out[k]=scalar(p[k])
  out.stdinIsString=typeof p.stdin==='string';out.stdoutIsString=typeof p.stdout==='string';out.stderrIsString=typeof p.stderr==='string'
  out.item=minimalItem(p.item)
  out.turn=obj(p.turn)?{id:scalar(p.turn.id),status:scalar(p.turn.status),itemsView:scalar(p.turn.itemsView),
    items:Array.isArray(p.turn.items)&&p.turn.items.length<=PROVIDER_LIMITS.writers?p.turn.items.map(minimalItem):null}:null
  return out
}
function repeated(s:CodexProviderState,source:CodexSource,context:unknown):CodexNormalized|null {
  const old=s.receipts.find(r=>r.eventId===source.eventId)
  if(!old)return null
  return old.digest===hash({binding:binding(s),source,context}) && old.sequence===source.sequence
    ? {accepted:true,repeated:true,reasonCode:'repeated',state:s,events:[]} : reject(s,'source_id_conflict')
}
function commit(s: CodexProviderState, source: CodexSource, facts: Fact[], context: unknown,
  patch: Partial<Pick<CodexProviderState, 'ownedProcesses' | 'itemProcesses'>> = {}): CodexNormalized {
  const invalid = sourceError(s, source); if (invalid) return invalid
  const digest = hash({ binding: binding(s), source, context })
  const prior = repeated(s,source,context); if (prior) return prior
  if (s.fault) return reject(s, 'resync_required')
  if (source.sequence !== s.sourceSequence + 1) return reject(s, source.sequence <= s.sourceSequence ? 'stale_source' : 'source_gap')
  if (s.receipts.length >= PROVIDER_LIMITS.events) return reject(s, 'source_limit')
  if (facts.length > PROVIDER_LIMITS.writers + 1) return reject(s, 'writer_limit')
  let observation = s.observation
  const events: ProviderEvent[] = []
  for (const fact of facts) {
    const payload = fact.type === 'inventory' ? { ...fact, throughCursor: observation.cursor } : fact
    const event = { schema: 'ProviderEvent@1' as const, eventId: `codex:${digest}:${events.length}`, cursor: observation.cursor + 1,
      binding: binding(s), evidenceRef: `sha256:${hash({ digest, payload })}`, ...payload } as ProviderEvent
    const folded = foldProviderObservation(observation, event)
    if (!folded.accepted) return reject(s, folded.reasonCode)
    observation = folded.state; events.push(event)
  }
  return { accepted: true, repeated: false, reasonCode: 'normalized', events: freeze(events), state: freeze({ ...s, ...patch, observation,
    sourceSequence: source.sequence, receipts: [...s.receipts, { eventId: source.eventId, sequence: source.sequence, digest }] }) }
}
/** Only the trusted host may register handles it actually allocated through
 * process/spawn on this exact connection. PTY processId is a different namespace. */
export function registerCodexOwnedProcess(s: CodexProviderState, source: CodexSource, processHandle: unknown): CodexNormalized {
  const invalid = sourceError(s, source); if (invalid) return invalid
  if (!id(processHandle)) return reject(s, 'invalid_process_handle')
  const owned = [...new Set([...s.ownedProcesses, processHandle])]
  if (owned.length > PROVIDER_LIMITS.writers) return reject(s, 'writer_limit')
  return commit(s, source, [writer('background', 'process', processHandle, 'active')], { operation: 'owned_process', processHandle }, { ownedProcesses: owned })
}
function scoped(s: CodexProviderState, p: Record<string, unknown>, turnId: unknown): boolean {
  const n = binding(s).native
  return n.status === 'observed' && p.threadId === n.threadId && turnId === n.turnId
}
function itemFacts(s: CodexProviderState, item: unknown, phase: 'started' | 'completed' | 'snapshot', links: Record<string, string>): Fact[] | string {
  const ended = phase !== 'started'
  if (!obj(item) || !id(item.id) || typeof item.type !== 'string') return 'invalid_item'
  if (item.type === 'commandExecution') {
    if (!oneOf(item.status, ['inProgress','completed','failed','declined']) || typeof item.command !== 'string' || typeof item.cwd !== 'string' || !Array.isArray(item.commandActions)) return 'invalid_command_item'
    if (item.processId != null && !id(item.processId)) return 'invalid_process_id'
    if (item.exitCode != null && (!integer(item.exitCode) || item.exitCode < -2147483648 || item.exitCode > 2147483647)) return 'invalid_exit_code'
    if (!ended && item.status !== 'inProgress') return 'item_status_mismatch'
    if (phase === 'completed' && item.status === 'inProgress') return 'item_status_mismatch'
    const process = item.processId ?? linked(links,item.id)
    if (id(process)) { if (linked(links,item.id) && linked(links,item.id) !== process) return 'item_process_changed'; links[item.id] = process }
    const terminal = ended && item.status !== 'inProgress' && (integer(item.exitCode) || (item.status === 'declined' && process == null))
    const state = terminal ? 'terminal' : ended ? 'unknown' : 'active'
    const facts = [writer('background','command',item.id,state)]
    if (id(process)) facts.push(writer('background','terminal',process,state))
    return facts
  }
  if (item.type === 'collabAgentToolCall') {
    const n = binding(s).native
    if (n.status !== 'observed' || item.senderThreadId !== n.threadId) return 'foreign_child_sender'
    if (!oneOf(item.status,['inProgress','completed','failed','interrupted']) || !oneOf(item.tool,['spawnAgent','sendInput','resumeAgent','wait','closeAgent','sendMessage','followupTask','interruptAgent','listAgents']) ||
      !Array.isArray(item.receiverThreadIds) || item.receiverThreadIds.length > PROVIDER_LIMITS.writers || !item.receiverThreadIds.every(id) || !obj(item.agentsStates)) return 'invalid_child_item'
    const ids = [...new Set([...item.receiverThreadIds, ...Object.keys(item.agentsStates)])]
    if (ids.length > PROVIDER_LIMITS.writers || !ids.every(id)) return 'writer_limit'
    for (const value of Object.values(item.agentsStates)) if (!obj(value) || !oneOf(value.status,['pendingInit','running','interrupted','completed','errored','shutdown','notFound'])) return 'invalid_child_state'
    // These are last-known statuses, not an exhaustive child writer proof.
    return ids.map(child => writer('child','thread',child,'unknown'))
  }
  if (item.type === 'subAgentActivity') {
    if (!id(item.agentThreadId) || typeof item.agentPath !== 'string' || !oneOf(item.kind,['started','interacted','interrupted','completed'])) return 'invalid_child_item'
    return [writer('child','thread',item.agentThreadId,'unknown')]
  }
  if (oneOf(item.type,['userMessage','hookPrompt','agentMessage','plan','reasoning','enteredReviewMode','exitedReviewMode','contextCompaction'])) return []
  // New/remote/MCP/dynamic/file-change item lifecycles have no termination
  // contract in this packet. Do not silently label their effects read-only.
  return 'unsupported_item_type'
}
export function normalizeCodexNotification(s: CodexProviderState, source: CodexSource, input: unknown): CodexNormalized {
  const invalid = sourceError(s, source); if (invalid) return invalid
  if (!obj(input) || typeof input.method !== 'string' || !obj(input.params) || 'error' in input) return reject(s,'invalid_notification')
  const p = input.params, links = { ...s.itemProcesses }; let facts: Fact[] = []
  const context=minimalNotification(input.method,p),prior=repeated(s,source,context); if(prior)return prior
  if (input.method === 'process/exited') {
    if (!id(p.processHandle) || !integer(p.exitCode) || p.exitCode < -2147483648 || p.exitCode > 2147483647 ||
      typeof p.stdout !== 'string' || typeof p.stderr !== 'string' || typeof p.stdoutCapReached !== 'boolean' || typeof p.stderrCapReached !== 'boolean') return reject(s,'invalid_process_exit')
    if (!s.ownedProcesses.includes(p.processHandle)) return reject(s,'unowned_process',false)
    facts = [writer('background','process',p.processHandle,'terminal')]
  } else if (input.method === 'turn/completed') {
    if (!obj(p.turn) || !id(p.threadId) || !id(p.turn.id)) return reject(s,'invalid_turn_scope')
    if (!scoped(s,p,p.turn.id)) return reject(s,'foreign_turn',false)
    if (!oneOf(p.turn.status,['completed','interrupted','failed']) || !Array.isArray(p.turn.items) || p.turn.items.length > PROVIDER_LIMITS.writers ||
      (p.turn.itemsView !== undefined && p.turn.itemsView !== 'full')) return reject(s,'invalid_turn_terminal')
    for (const item of p.turn.items) { const part = itemFacts(s,item,'snapshot',links); if (typeof part === 'string') return reject(s,part); facts.push(...part) }
    facts.push({ type: 'turn_terminal', outcome: p.turn.status as 'completed' | 'failed' | 'interrupted' })
  } else if (input.method === 'item/commandExecution/terminalInteraction') {
    if (!id(p.threadId) || !id(p.turnId)) return reject(s,'invalid_turn_scope')
    if (!scoped(s,p,p.turnId)) return reject(s,'foreign_turn',false)
    if (!id(p.itemId) || !id(p.processId) || typeof p.stdin !== 'string') return reject(s,'invalid_terminal_interaction')
    if (linked(links,p.itemId) && linked(links,p.itemId) !== p.processId) return reject(s,'item_process_changed')
    links[p.itemId] = p.processId
    facts = [writer('background','command',p.itemId,'active'),writer('background','terminal',p.processId,'active')]
  } else if (input.method === 'item/started' || input.method === 'item/completed') {
    if (!id(p.threadId) || !id(p.turnId)) return reject(s,'invalid_turn_scope')
    if (!scoped(s,p,p.turnId)) return reject(s,'foreign_turn',false)
    const ended = input.method === 'item/completed'
    if (!integer(p[ended ? 'completedAtMs' : 'startedAtMs'])) return reject(s,'invalid_item_time')
    const part = itemFacts(s,p.item,ended ? 'completed' : 'started',links); if (typeof part === 'string') return reject(s,part); facts = part
  } else return reject(s,'unsupported_notification')
  if (Object.keys(links).length > PROVIDER_LIMITS.writers) return reject(s,'writer_limit')
  return commit(s,source,facts,context,{itemProcesses:links})
}
/** The caller correlates every response to this thread's actual request. No
 * terminal status follows from absence in an active-only paginated listing. */
export function normalizeCodexBackgroundInventory(s: CodexProviderState, source: CodexSource, input: CodexBackgroundPages, coverage?: CodexHostCoverage): CodexNormalized {
  const invalid = sourceError(s,source); if (invalid) return invalid
  const n = binding(s).native
  if (!obj(input) || !id(input.threadId)) return reject(s,'invalid_thread_scope')
  if (n.status !== 'observed' || input.threadId !== n.threadId) return reject(s,'foreign_thread',false)
  if (!Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > 64) return reject(s,'invalid_pages')
  let next: string | null = null; const cursors = new Set<string>(), active = new Set<string>(), listed: {itemId:string;processId:string}[] = []
  const links = { ...s.itemProcesses }
  for (let i=0;i<input.pages.length;i++) {
    const page = input.pages[i]
    if (!obj(page) || page.requestCursor !== next || !obj(page.response) || !Array.isArray(page.response.data) || page.response.data.length > PROVIDER_LIMITS.writers) return reject(s,'invalid_page')
    for (const row of page.response.data) {
      if (!obj(row) || !id(row.itemId) || !id(row.processId) || typeof row.command !== 'string' || typeof row.cwd !== 'string') return reject(s,'invalid_background_row')
      if (active.has(row.processId)) return reject(s,'duplicate_process')
      active.add(row.processId); listed.push({itemId:row.itemId,processId:row.processId})
      if (active.size > PROVIDER_LIMITS.writers) return reject(s,'writer_limit')
    }
    const cursor = page.response.nextCursor
    if (cursor !== undefined && cursor !== null && (typeof cursor !== 'string' || !cursor.length || cursor.length > 128)) return reject(s,'invalid_page_cursor')
    next = cursor == null ? null : cursor
    if (next !== null) { if (cursors.has(next)) return reject(s,'page_cycle'); cursors.add(next) }
    if (i < input.pages.length-1 && next === null) return reject(s,'unexpected_page')
  }
  if (next !== null) return reject(s,'partial_inventory')
  let closed = false, unknown = true
  if (coverage !== undefined) {
    if (!obj(coverage) || !validateProviderBinding(coverage.binding).ok || canonical(coverage.binding) !== canonical(binding(s)) || coverage.throughSourceSequence !== source.sequence - 1 || coverage.admissionClosed !== true ||
      !Array.isArray(coverage.coveredKinds) || canonical(coverage.coveredKinds) !== canonical(['background','child','remote']) || !evidence(coverage.evidenceRef)) return reject(s,'invalid_host_coverage')
    closed = true; unknown = false
  }
  const context={operation:'background_inventory',listed,coverage:coverage===undefined?null:{evidenceRef:coverage.evidenceRef,throughSourceSequence:coverage.throughSourceSequence}}
  const prior=repeated(s,source,context);if(prior)return prior
  for(const row of listed){
    if(linked(links,row.itemId)&&linked(links,row.itemId)!==row.processId)return reject(s,'item_process_changed')
    links[row.itemId]=row.processId
  }
  if(Object.keys(links).length>PROVIDER_LIMITS.writers)return reject(s,'writer_limit')
  const writers: ProviderWriter[] = s.observation.writers.map(w => ({ ...w, state: w.state === 'terminal' ? 'terminal' as const : 'unknown' as const }))
  for (const process of active) {
    const id = handle('terminal',process), prior = writers.find(w => w.kind === 'background' && w.id === id)
    if (prior?.state === 'terminal') return reject(s,'writer_reopened')
    if (prior) prior.state = 'active' // active list is live, never terminal
    else writers.push({kind:'background',id,state:'active'})
  }
  return commit(s,source,[{type:'inventory',writers,complete:true,admissionClosed:closed,unknownWriters:unknown}],
    context,{itemProcesses:links})
}
