import assert from 'node:assert/strict'
import { createClaudeProviderState, normalizeClaudeEvent } from '../src/main/claudeProviderEvents.ts'
import { assessProviderQuiescence, PROVIDER_LIMITS } from '../src/shared/providerExecution.ts'

const binding = { schema: 'ProviderExecution@1', fabric: { estateId: 'estate', taskId: 'task', runId: 'run', sessionId: 'fabric-session' },
  provider: { id: 'claude-code', build: '2.1.283', runtimeProfile: 'owned-stdio' },
  native: { status: 'observed', connectionId: 'connection', sessionId: 'native-session', threadId: null, turnId: null },
  execution: { kind: 'host-request', id: 'request-epoch' }, manifestDigest: 'a'.repeat(64), policyDigest: 'b'.repeat(64) }
const source = sequence => ({ connectionId: 'connection', requestEpoch: 'request-epoch', sequence, eventId: `source-${sequence}` })
const init = () => ({ type: 'system', subtype: 'init', session_id: 'native-session', cwd: '/PRIVATE' })
const start = (task = 'child') => ({ type: 'system', subtype: 'task_started', task_id: task, task_type: 'local_agent', uuid: `started-${task}`, session_id: 'native-session', description: 'PRIVATE prompt', tool_use_id: 'tool' })
const result = () => ({ type: 'result', subtype: 'success', session_id: 'native-session', uuid: 'result', is_error: false, duration_ms: 1, duration_api_ms: 1, num_turns: 1, origin: { kind: 'human' }, result: 'PRIVATE output', errors: ['PRIVATE'] })
const update = (status, task = 'child') => ({ type: 'system', subtype: 'task_updated', task_id: task, patch: status === undefined ? { result: 'PRIVATE' } : { status, result: 'PRIVATE' } })
const notification = (status = 'completed', task = 'child') => ({ type: 'system', subtype: 'task_notification', task_id: task, status, uuid: `end-${task}`, session_id: 'native-session', output_file: '/PRIVATE', summary: 'PRIVATE', tool_use_id: 'tool' })
const progress = () => ({ type: 'system', subtype: 'task_progress', task_id: 'child', uuid: 'progress', session_id: 'native-session',
  description: 'PRIVATE', usage: { total_tokens: 12, tool_uses: 1, duration_ms: 100 }, tool_use_id: 'tool', last_tool_name: 'PRIVATE-tool' })
const receipt = (raw, seq, kind = raw.type === 'result' ? 'root-result' : 'task-start') => ({ binding, source: source(seq), kind, messageUuid: raw.uuid ?? null, taskId: kind === 'task-start' ? raw.task_id : null, evidenceRef: `sha256:${'c'.repeat(64)}` })
const fresh = () => { const r = createClaudeProviderState(binding); assert.equal(r.ok, true); return r.value }
function fixture() {
  let state = fresh()
  return { get state() { return state }, feed(raw, attr, seq = state.sourceSequence + 1) { const r = normalizeClaudeEvent(state, source(seq), raw, attr); state = r.state; return r },
    initialized() { const r = this.feed(init()); assert.equal(r.accepted, true); return this },
    owned() { this.initialized(); const raw = start(); assert.equal(this.feed(raw, receipt(raw, 2)).accepted, true); return this } }
}
{
  const f = fixture().owned(), raw = result(), r = f.feed(raw, receipt(raw, 3))
  assert.equal(r.accepted, true); assert.equal(f.state.observation.terminal.outcome, 'completed')
  assert.equal(f.state.observation.writers[0].state, 'active', 'root result never completes its child')
  assert.equal(assessProviderQuiescence(f.state.observation, f.state.observation.cursor).quiescent, false)
  assert.equal(f.feed(update('killed')).accepted, true); assert.equal(f.state.observation.writers[0].state, 'terminal')
  assert.equal(f.state.tasks[0].terminal, 'interrupted'); assert.equal(f.state.observation.inventory, null)
  assert.equal(assessProviderQuiescence(f.state.observation, f.state.observation.cursor).quiescent, false, 'task ledger is not complete writer coverage')
  assert.equal(JSON.stringify(f.state).includes('PRIVATE'), false); assert.equal(JSON.stringify(r.events).includes('PRIVATE'), false)
}
for (const [status, outcome] of [['completed', 'completed'], ['failed', 'failed'], ['stopped', 'interrupted']]) {
  const f = fixture().owned(); assert.equal(f.feed(notification(status)).accepted, true); assert.equal(f.state.tasks[0].terminal, outcome)
  const terminalPatch = status === 'stopped' ? 'killed' : status
  assert.equal(f.feed(update(terminalPatch)).accepted, true, 'both terminal forms agree')
}
for (const status of ['pending', 'running', 'paused', undefined]) {
  const f = fixture().owned(); assert.equal(f.feed(update(status)).accepted, true); assert.equal(f.state.observation.writers[0].state, 'active')
}
{
  const f = fixture().owned(), before = f.state.observation, raw = progress()
  const r = f.feed(raw); assert.equal(r.accepted, true); assert.deepEqual(r.events, []); assert.equal(f.state.observation, before)
  assert.equal(f.state.sourceSequence, 3); assert.equal(f.feed(notification()).accepted, true)
  const ended = f.state; assert.equal(f.feed(raw, undefined, 3).repeated, true); assert.equal(f.state, ended)
  assert.equal(f.feed({ ...raw, uuid: 'new-progress' }).reasonCode, 'progress_after_terminal')
  assert.equal(f.state.observation.writers[0].state, 'terminal', 'a new progress event never reopens a terminal writer')
}
for (const patch of [{ task_id: 'foreign' }, { tool_use_id: 'wrong' }, { description: null }, { uuid: [] }, { session_id: null },
  { usage: null }, { usage: {} }, { usage: { total_tokens: -1, tool_uses: 1, duration_ms: 1 } },
  { usage: { total_tokens: 1, tool_uses: 1, duration_ms: Infinity } }, { last_tool_name: [] }]) {
  const f = fixture().owned(); assert.equal(f.feed({ ...progress(), ...patch }).accepted, false)
  assert.equal(f.state.observation.writers[0].state, 'active')
}
{
  const a = fixture().owned(), b = fixture().owned(), raw = progress()
  a.feed(raw); b.feed({ ...raw, description: 'OTHER', last_tool_name: 'OTHER-tool', usage: { total_tokens: 99, tool_uses: 2, duration_ms: 500 } })
  assert.deepEqual(a.state, b.state, 'display text/usage values never enter lifecycle fingerprints')
  a.feed(notification()); assert.equal(a.feed({ ...raw, usage: null }, undefined, 3).reasonCode, 'invalid_task_progress')
}
{
  const f = fixture().owned(); assert.equal(f.feed({ ...update('completed'), session_id: null }).accepted, true)
  const unknown = fixture().initialized(); assert.equal(unknown.feed({ ...update('completed'), session_id: null }).reasonCode, 'unowned_task')
}
for (const [reason, isError, outcome] of [[undefined, false, 'completed'], [null, true, 'failed'], ['completed', true, 'failed'], ['max_turns', false, 'failed'], ['aborted_streaming', false, 'interrupted'], ['aborted_tools', true, 'interrupted']]) {
  const f = fixture().initialized(), raw = { ...result(), terminal_reason: reason, is_error: isError }
  assert.equal(f.feed(raw, receipt(raw, 2)).accepted, true); assert.equal(f.state.observation.terminal.outcome, outcome)
}
for (const mutate of [b => b.provider.build = '2.1.other', b => b.provider.runtimeProfile = 'owned-pty', b => b.provider.id = 'codex-cli',
  b => b.native = { status: 'unknown', reason: 'not_observed' }, b => { b.native.turnId = 'invented'; b.execution = { kind: 'native-turn', id: 'invented' } }]) {
  const b = structuredClone(binding); mutate(b); assert.equal(createClaudeProviderState(b).ok, false)
}
// Same native session is insufficient: caller must bind every source to the
// serialized request epoch and supply an event-addressed attribution receipt.
{
  const f = fixture().initialized(), raw = result()
  assert.equal(f.feed(raw).reasonCode, 'attribution_required'); assert.equal(f.state.observation.terminal, null)
}
for (const mutate of [r => r.source.requestEpoch = 'prior', r => r.source.sequence = 1, r => r.source.eventId = 'another',
  r => r.binding.execution.id = 'prior', r => r.binding.fabric.runId = 'other-run', r => r.kind = 'task-start',
  r => r.messageUuid = 'prior-turn-result', r => r.taskId = 'unexpected', r => r.evidenceRef = 'PRIVATE', r => r.raw = 'PRIVATE']) {
  const f = fixture().initialized(), raw = result(), r = structuredClone(receipt(raw, 2)); mutate(r)
  assert.equal(f.feed(raw, r).accepted, false); assert.equal(f.state.observation.terminal, null)
}
{
  const state = fixture().initialized().state, raw = result(), prior = { ...source(2), requestEpoch: 'prior-epoch' }
  const r = normalizeClaudeEvent(state, prior, raw, receipt(raw, 2))
  assert.equal(r.reasonCode, 'foreign_source'); assert.equal(r.state, state)
  const wrong = normalizeClaudeEvent(state, { ...source(2), connectionId: 'old-connection' }, raw, receipt(raw, 2))
  assert.equal(wrong.reasonCode, 'foreign_source'); assert.equal(wrong.state, state)
}
for (const raw of [{ ...result(), session_id: 'other' }, { ...notification(), session_id: 'other' }, { ...update('completed'), session_id: 'other' }]) {
  const f = fixture().owned(); assert.equal(f.feed(raw, raw.type === 'result' ? receipt(raw, 3) : undefined).reasonCode, 'foreign_session')
  assert.equal(f.state.observation.writers[0].state, 'active')
}
for (const origin of [{ kind: 'task-notification' }, { kind: 'channel', server: 'PRIVATE' }, { kind: 'peer', body: 'PRIVATE' },
  { kind: 'future-origin' }, { kind: ['human'] }, {}, [], 'human', { kind: 'human', body: 'PRIVATE' }]) {
  const f = fixture().initialized(), raw = { ...result(), origin }
  assert.equal(f.feed(raw, receipt(raw, 2)).reasonCode, 'unsupported_origin'); assert.equal(f.state.observation.terminal, null)
}
for (const origin of [undefined, null]) {
  const f = fixture().initialized(), raw = { ...result(), origin, uuid: undefined }
  assert.equal(f.feed(raw, receipt(raw, 2)).accepted, true, 'explicit host attribution covers absent native UUID/origin; parser does not infer them')
}
for (const raw of [update('completed', 'foreign'), notification('completed', 'foreign')]) {
  const f = fixture().owned(); assert.equal(f.feed(raw).reasonCode, 'unowned_task'); assert.equal(f.state.observation.writers[0].state, 'active')
}
for (const taskType of [undefined, null, 'shell', 'remote_agent', 'monitor', ['local_agent']]) {
  const f = fixture().initialized(), raw = { ...start(), task_type: taskType }
  assert.equal(f.feed(raw, receipt(raw, 2)).reasonCode, 'unsupported_task_start'); assert.ok(f.state.observation.fault)
}
{
  const f = fixture().initialized(), raw = { ...start(), task_type: 'local_workflow' }
  assert.equal(f.feed(raw, receipt(raw, 2)).accepted, true); assert.equal(f.state.observation.writers[0].kind, 'background')
}
for (const raw of [update(['completed']), update('future-status'), { ...update('completed'), patch: { status: 'completed', task_type: 'remote_agent' } },
  { ...update('completed'), patch: null }, { ...notification(), status: ['completed'] },
  { ...notification(), tool_use_id: 'wrong-tool' }, { ...result(), terminal_reason: 'future-terminal' }, { ...result(), subtype: 'future-result' },
  { ...result(), is_error: 0 }, { ...result(), num_turns: Infinity }, { ...result(), uuid: [] }]) {
  const f = fixture().owned(); assert.equal(f.feed(raw, raw.type === 'result' ? receipt(raw, 3) : undefined).accepted, false)
  assert.equal(f.state.observation.writers[0].state, 'active')
}
for (const raw of [{ type: 'control_response', response: { subtype: 'success' } },
  { type: 'system', subtype: 'session_state_changed', session_id: 'native-session', state: 'idle' },
  { type: 'system', subtype: 'background_tasks_changed', session_id: 'native-session', tasks: [] },
  { type: 'system', subtype: 'new_writer_event', session_id: 'native-session' }]) {
  const f = fixture().owned(), r = f.feed(raw); assert.equal(r.accepted, false)
  assert.ok(f.state.observation.fault); assert.equal(f.state.observation.writers[0].state, 'active'); assert.equal(f.state.observation.terminal, null)
}
// Dedup is based on stateless validated facts, before task ownership/state checks.
{
  const f = fixture().owned(), before = start(), receiptBefore = receipt(before, 2)
  f.feed(notification()); const finished = f.state
  assert.equal(f.feed(before, receiptBefore, 2).repeated, true); assert.equal(f.state, finished)
  assert.equal(f.feed(init(), undefined, 1).repeated, true)
  assert.equal(f.feed(notification(), undefined, 3).repeated, true)
  assert.equal(f.feed({ ...notification(), status: ['completed'] }, undefined, 3).accepted, false)
}
{
  const f = fixture().owned(); f.feed(notification()); const r = f.feed(update('running'))
  assert.equal(r.reasonCode, 'task_terminal_conflict'); assert.equal(f.state.observation.writers[0].state, 'terminal')
}
{
  const f = fixture().owned(); f.feed(notification('completed'))
  assert.equal(f.feed(update('killed')).reasonCode, 'task_terminal_conflict')
}
{
  const a = fixture().owned(), b = fixture().initialized(), raw = { ...start(), description: 'OTHER SECRET' }
  b.feed(raw, receipt(raw, 2)); assert.deepEqual(a.state, b.state, 'raw prompt is not retained or hashed')
  const ra = result(), rb = { ...result(), result: 'OTHER RESULT', errors: ['OTHER ERROR'], structured_output: { token: 'OTHER' } }
  a.feed(ra, receipt(ra, 3)); b.feed(rb, receipt(rb, 3)); assert.deepEqual(a.state, b.state)
  a.feed(notification()); b.feed({ ...notification(), summary: 'OTHER SUMMARY', output_file: '/OTHER/PATH' }); assert.deepEqual(a.state, b.state)
}
{
  const f = fixture().owned(), raw = start(); assert.equal(f.feed(raw, receipt(raw, 3)).reasonCode, 'task_already_owned')
}
{
  const f = fixture().initialized(), raw = result(); assert.equal(f.feed(raw, receipt(raw, 3), 3).reasonCode, 'source_gap')
  assert.equal(f.feed(raw, receipt(raw, 2), 2).reasonCode, 'resync_required')
}
{
  const f = fixture().initialized(); for (let i = 0; i < PROVIDER_LIMITS.writers; i++) {
    const raw = start(`task-${i}`); assert.equal(f.feed(raw, receipt(raw, i + 2)).accepted, true)
  }
  const raw = start('extra'); assert.equal(f.feed(raw, receipt(raw, 130)).reasonCode, 'writer_limit')
  assert.equal(f.state.tasks.length, PROVIDER_LIMITS.writers)
}
{
  const f = fixture().owned(); while (f.state.sourceSequence < PROVIDER_LIMITS.events) assert.equal(f.feed(update()).accepted, true)
  assert.equal(f.feed(update()).reasonCode, 'source_limit')
}
assert.equal(fixture().feed(result(), receipt(result(), 1)).reasonCode, 'init_required')
console.log('PASS Claude lifecycle fixtures: exact host attribution, raw origin guards, owned task terminal forms, replay before projection, bounded sanitized evidence; no native conformance or writer coverage')
