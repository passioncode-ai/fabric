import { describe, expect, it } from 'vitest'
import { COMMAND_INGRESS_LIMITS, COVERED_INGRESS_EVENTS, prepareAnswerComposition,
  prepareDeclaredImport, prepareDeferralReason, prepareEventPayload, prepareOriginalInstruction, prepareRelease, prepareTopic, prepareVerificationReceipt } from './commandIngress.ts'
import { readIdea } from './idea.ts'

const id = '12345678-1234-5678-9abc-123456789abc'
const other = 'ABCDEFAB-1234-5678-9ABC-ABCDEFABCDEF'
const canary = 'synthetic-opaque-canary-7391'
const secret = `SERVICE_TOKEN=${canary}`
const note = { task_id: id, note_id: other, body_md: secret }
const fixtures: Record<string, Record<string, unknown>> = {
  'task.closed@1': { task_id: id, outcome: 'cancelled', reason: secret },
  'memory.retrieved@1': { id, session_id: null, store: 'facts', query: secret, hits: 0 },
  'project.repo.attached@1': { id, path: '/tmp/project', label: secret },
  'routine.paused@1': { id, reason: secret, window: null, reason_code: 'not-ready' },
  'routine.ran@1': { id, task_id: other, because: secret },
  'cycle.ran@1': { state: 'failed_known', ms: 5, sessions_observed: 0, says: secret, advances: false },
  'chain.dispatch@1': { id, phase: 'intent', task_run_id: other, session_id: id, instruction: secret, key: 'chain:one:two', node: {runId: 'run-1', nodeId: 'node-1', revision: 0} },
  'task.created@1': { id, title: secret, instruction: secret, option_id: 'agent:claude-code',
    preset: 'routine', preset_edited: false, idempotency_key: 'run/node/revision/attempt',
    task_type: 'development', section: secret, origin: {kind: 'document', ref: 'docs/adr/0014.md:22'} },
  'task.note.added@1': note,
  'task.brief.edited@1': { task_id: id, section: 'what', body_md: secret },
  'routine.defined@1': { id, project_id: other, instruction: secret, option_id: 'claude-code', every_minutes: 5, kind: 'backlog' },
  'agent.registered@1': { id, project_id: other, name: secret, instructions: secret,
    runner_id: 'claude-code', mcp_servers: ['fabric', 'github'], permission_mode: 'ask' },
  'project.created@1': { id, name: secret, purpose: secret, repo_path: '/tmp/synthetic-project',
    memory_backend: 'local', default_agent: 'claude-code' },
  'project.updated@1': { id, name: secret, purpose: secret, repo_path: null },
  'project.settings.updated@1': { id, memory_backend: 'cloud', default_agent: 'codex', mcp_servers: [] },
  'project.configured@1': { id, base_revision: 42, name: secret, purpose: secret, default_agent: 'codex', mcp_servers: ['fabric'] },
  'goal.defined@1': { id, title: secret, autonomy: 'safe' },
  'memory.project.recorded@1': { id, claim: secret, source_ref: 'task:' + other, kind: 'finding',
    supersedes: other, category: 'harness', about: {namespace: 'provider', key: 'Claude-Code'},
    occurrence: {system: 'github', source_id: 'issue-42', episode_key: 'run:42'}, valid_from: '2026-09-27T01:02:03.000Z' }
}

describe('explicit event privacy policy', () => {
  it('covers exactly the audited versions and scrubs free text without input mutation', () => {
    expect([...COVERED_INGRESS_EVENTS].sort()).toEqual(Object.keys(fixtures).sort())
    for (const [type, payload] of Object.entries(fixtures)) {
      const before = JSON.stringify(payload)
      const result = prepareEventPayload(type, payload)
      expect(result.state, type).toBe('prepared')
      if (result.state !== 'prepared') continue
      expect(JSON.stringify(result.value), type).not.toContain(canary)
      expect(JSON.stringify(payload), type).toBe(before)
      expect(result.value.id ?? result.value.task_id, type).toBe(type === 'cycle.ran@1' ? undefined : id)
      expect(prepareEventPayload(type, result.value)).toEqual({state: 'prepared', value: result.value, redactions: []})
    }
  })
  it('returns no pass-through for unknown types, future versions and prototype names', () => {
    for (const type of ['task.created@2', 'terminal.closed@1', '__proto__', 'constructor', secret, null]) {
      const input = Object.defineProperty({}, 'x', {get() { throw new Error('must not inspect') }})
      expect(prepareEventPayload(type, input)).toEqual({state: 'not_covered'})
    }
  })
  it('rejects unknown fields without echoing names or values', () => {
    for (const key of ['api_key', canary, '__proto__', 'constructor']) {
      const result = prepareEventPayload('task.note.added@1', {...note, [key]: canary})
      expect(result).toEqual({state: 'rejected', code: 'unknown_field'})
      expect(JSON.stringify(result)).not.toContain(canary)
    }
  })
  it('preserves UUID bytes, human runner/server IDs, correlation keys and revisions', () => {
    const task = prepareEventPayload('task.created@1', {...fixtures['task.created@1'], id: other})
    expect(task.state).toBe('prepared')
    if (task.state === 'prepared') {
      expect(task.value.id).toBe(other)
      expect(task.value.option_id).toBe('agent:claude-code')
      expect(task.value.idempotency_key).toBe('run/node/revision/attempt')
      expect(task.value.origin).toEqual({kind: 'document', ref: 'docs/adr/0014.md:22'})
    }
    expect(prepareEventPayload('project.configured@1', fixtures['project.configured@1']))
      .toMatchObject({state:'prepared',value:{base_revision:42,default_agent:'codex',mcp_servers:['fabric']}})
    expect(prepareEventPayload('memory.project.recorded@1', fixtures['memory.project.recorded@1']))
      .toMatchObject({state:'prepared',value:{about:{namespace:'provider',key:'Claude-Code'},supersedes:other}})
  })
  it('rejects invalid identifiers and enums rather than rewriting them', () => {
    for (const bad of ['claude-code', ` ${id}`, secret])
      expect(prepareEventPayload('goal.defined@1', {id: bad, title: 'goal'})).toEqual({state: 'rejected', code: 'invalid_identifier'})
    for (const [type, changes] of [
      ['project.created@1', {memory_backend: 'other'}], ['goal.defined@1', {autonomy: secret}],
      ['task.brief.edited@1', {section: 'other'}], ['routine.defined@1', {kind: 'other'}],
      ['memory.project.recorded@1', {category: 'other'}]
    ] as const) expect(prepareEventPayload(type, {...fixtures[type], ...changes})).toEqual({state: 'rejected', code: 'invalid_enum'})
  })
  it('refuses secrets in references and configuration without changing authority', () => {
    for (const [type, changes] of [
      ['project.created@1', {repo_path: `postgresql://user:${canary}@localhost/db`}],
      ['project.settings.updated@1', {mcp_servers: [secret]}], ['agent.registered@1', {runner_id: secret}],
      ['agent.registered@1', {permission_mode: secret}], ['task.created@1', {idempotency_key: secret}],
      ['task.created@1', {origin: {kind: 'document', ref: secret}}],
      ['memory.project.recorded@1', {source_ref: secret}],
      ['memory.project.recorded@1', {about: {namespace: 'skill', key: secret}}]
    ] as const) expect(prepareEventPayload(type, {...fixtures[type], ...changes})).toEqual({state: 'rejected', code: 'secret_in_reference'})
  })
  it('retains absence/null/empty-list distinctions and validates required fields', () => {
    expect(prepareEventPayload('project.updated@1', {id, purpose: null})).toMatchObject({state: 'prepared', value: {id, purpose: null}})
    expect(prepareEventPayload('project.settings.updated@1', {id, mcp_servers: []})).toMatchObject({state: 'prepared', value: {id, mcp_servers: []}})
    expect(prepareEventPayload('task.created@1', {id})).toEqual({state: 'rejected', code: 'missing_field'})
    expect(prepareEventPayload('task.brief.edited@1', {task_id: id, section: 'what', body_md: ''}).state).toBe('prepared')
    expect(prepareEventPayload('routine.defined@1', {...fixtures['routine.defined@1'], every_minutes: 4})).toEqual({state: 'rejected', code: 'invalid_shape'})
  })
  it('does not import interactive minimum-length rules into historical binding/event payloads', () => {
    // Migration 21: instructions/provider are nullable; role/name is text not
    // null, with no minimum length. Interactive readSpec is stricter by design.
    for (const payload of [
      {id,project_id:other,name:''},
      {id,project_id:other,name:'',instructions:'',runner_id:'claude-code'},
      {id,project_id:other,name:'old binding',instructions:null,runner_id:null}
    ]) expect(prepareEventPayload('agent.registered@1',payload)).toEqual({state:'prepared',value:payload,redactions:[]})
    for (const [type, payload] of [
      ['project.created@1',{id,name:''}], ['project.updated@1',{id,name:null}],
      ['task.created@1',{id,instruction:''}], ['task.note.added@1',{...note,body_md:''}],
      ['memory.project.recorded@1',{id,claim:'',valid_from:null}]
    ] as const) expect(prepareEventPayload(type,payload)).toEqual({state:'prepared',value:payload,redactions:[]})
  })
})

describe('bounded inert JSON input', () => {
  const check = (input: unknown) => prepareEventPayload('task.note.added@1', input)
  it('never invokes accessors or toJSON, including inherited hooks', () => {
    let calls = 0
    const input = {...note}
    Object.defineProperty(input, 'body_md', {get() { calls++; return canary }, enumerable: true})
    expect(check(input)).toEqual({state: 'rejected', code: 'accessor'})
    expect(check({...note, toJSON() { calls++; return {body_md: canary} }})).toEqual({state: 'rejected', code: 'non_json'})
    expect(check(Object.assign(Object.create({toJSON() { calls++; return canary }}), note))).toEqual({state: 'rejected', code: 'non_json'})
    expect(calls).toBe(0)
  })
  it('rejects cycles, excessive depth and non-JSON values without coercion', () => {
    const cyclic: Record<string, unknown> = {...note}; cyclic.self = cyclic
    expect(check(cyclic)).toEqual({state: 'rejected', code: 'cyclic'})
    let deep: unknown = 'end'; for (let i=0; i<10; i++) deep = {child: deep}
    expect(check({...note, deep})).toEqual({state: 'rejected', code: 'too_deep'})
    for (const value of [undefined, NaN, Infinity, 1n, Symbol('x'), new Date(), () => canary])
      expect(check({...note, body_md: value})).toEqual({state: 'rejected', code: 'non_json'})
    expect(check({...note, [Symbol('x')]: 'value'})).toEqual({state: 'rejected', code: 'non_json'})
  })
  it('bounds arrays before inspecting elements and never clips strings', () => {
    let calls = 0
    const huge = new Array(COMMAND_INGRESS_LIMITS.arrayItems + 1)
    Object.defineProperty(huge, 0, {get() { calls++; return canary }})
    expect(check({...note, huge})).toEqual({state: 'rejected', code: 'too_large'})
    expect(calls).toBe(0)
    expect(prepareOriginalInstruction('a'.repeat(COMMAND_INGRESS_LIMITS.stringChars + 1))).toEqual({state: 'rejected', code: 'too_large'})
    const crowded = Object.fromEntries(Array.from({length: 65}, (_, i) => [`k${i}`, 'x']))
    expect(check(crowded)).toEqual({state: 'rejected', code: 'too_large'})
    const strings = Array.from({length: 5}, () => 'x'.repeat(COMMAND_INGRESS_LIMITS.stringChars))
    expect(check({strings})).toEqual({state: 'rejected', code: 'too_large'})
    const nodes = Array.from({length: 512}, () => Array(9).fill(0))
    expect(check({nodes})).toEqual({state: 'rejected', code: 'too_large'})
  })
  it('rejects sparse arrays and accepts inert null-prototype records', () => {
    expect(check({...note, list: new Array(2)})).toEqual({state: 'rejected', code: 'non_json'})
    expect(check(Object.assign(Object.create(null), note)).state).toBe('prepared')
  })
})

describe('prepare before deriving titles, answers or digests', () => {
  it('cleans the original before task clipping and idea splitting', () => {
    const token = 'sk-' + 'syntheticCanary'.repeat(6)
    const input = 'x'.repeat(145) + ' ' + token + '\nnext'
    const result = prepareOriginalInstruction(input)
    expect(result.state).toBe('prepared')
    if (result.state !== 'prepared') return
    expect(result.value.slice(0,160)).not.toContain('syntheticCanary')
    const idea = readIdea({text: result.value})
    expect(idea.ok).toBe(true)
    expect(JSON.stringify(idea)).not.toContain('syntheticCanary')
    expect(prepareOriginalInstruction(' ordinary\ntext ')).toEqual({state:'prepared',value:' ordinary\ntext ',redactions:[]})
  })
  it('uses the existing label+text composition then scrubs the composed answer', () => {
    const result = prepareAnswerComposition({chosenOption: 'a', answer: secret,
      options: [{id:'a', label:`Authorization: Bearer ${canary}`, consequence:'unused'}]})
    expect(result).toMatchObject({state:'prepared',value:{chosenOption:'a',
      answer:'Authorization: Bearer [redacted: authorization] — SERVICE_TOKEN=[redacted: assignment]'}})
    expect(JSON.stringify(result)).not.toContain(canary)
    expect(prepareAnswerComposition({chosenOption:'',answer:'free',options:[]})).toMatchObject({state:'prepared',value:{answer:'free',chosenOption:null}})
    expect(prepareAnswerComposition({chosenOption:'absent',options:[]})).toEqual({state:'rejected',code:'invalid_answer'})
    expect(prepareAnswerComposition({chosenOption:' a ',options:[{id:'a',label:'A'}]})).toEqual({state:'rejected',code:'invalid_identifier'})
    expect(prepareAnswerComposition({answer:'x'.repeat(4001),options:[]})).toEqual({state:'rejected',code:'invalid_answer'})
  })
  it('preserves original source digest and command ID with all-or-nothing import preparation', () => {
    const sourceDigest = 'ABCDEF12'.repeat(8)
    const input = {commandId:other,inputDigest:sourceDigest,events:[
      {type:'project.created@1',project_id:id,payload:fixtures['project.created@1']},
      {type:'project.settings.updated@1',project_id:id,payload:fixtures['project.settings.updated@1']},
      {type:'agent.registered@1',project_id:other,payload:fixtures['agent.registered@1']}
    ]}
    const result = prepareDeclaredImport(input)
    expect(result).toMatchObject({state:'prepared',value:{commandId:other,inputDigest:sourceDigest}})
    expect(JSON.stringify(result)).not.toContain(canary)
    expect(input.events[0].payload.name).toBe(secret)
    expect(prepareDeclaredImport({...input,inputDigest:secret})).toEqual({state:'rejected',code:'invalid_identifier'})
    expect(prepareDeclaredImport({...input,events:[...input.events,{type:'task.created@1',project_id:id,payload:{id,title:'x'}}]})).toEqual({state:'rejected',code:'unsupported_import_event'})
    expect(prepareDeclaredImport({...input,events:[...input.events,{type:'project.created@1',project_id:other,payload:{id,name:'x'}}]})).toEqual({state:'rejected',code:'invalid_identifier'})
    expect(prepareDeclaredImport({...input,events:[...input.events,{type:'project.created@1',project_id:id,payload:{id,name:'x',repo_path:secret}}]})).toEqual({state:'rejected',code:'secret_in_reference'})
  })
  it('compares import UUID identities case-insensitively while preserving input bytes', () => {
    const event = {type:'agent.registered@1',project_id:other.toLowerCase(),
      payload:{id,project_id:other,name:'legacy',instructions:null,runner_id:null}}
    const input = {commandId:other,inputDigest:'a'.repeat(64),events:[event]}
    expect(prepareDeclaredImport(input)).toEqual({state:'prepared',value:input,redactions:[]})
  })
})

describe('the Board\'s own words (SCR-41, L3b)', () => {
  it('a reason for setting a question aside is scrubbed whole and must say something', () => {
    const r = prepareDeferralReason(`after the pilot ${secret}`)
    expect(r).toMatchObject({ state: 'prepared', value: 'after the pilot SERVICE_TOKEN=[redacted: assignment]' })
    expect(JSON.stringify(r)).not.toContain(canary)
    expect(prepareDeferralReason('   ')).toEqual({ state: 'rejected', code: 'invalid_shape' })
    expect(prepareDeferralReason(null)).toEqual({ state: 'rejected', code: 'invalid_shape' })
    expect(prepareDeferralReason('x'.repeat(2001))).toEqual({ state: 'rejected', code: 'too_large' })
  })

  it('a release keeps its name, environment and optional summary, scrubbed; a name and an environment are required', () => {
    const r = prepareRelease({ name: 'Atlas 0.4.2', environment: 'Demo / local', summary: secret })
    expect(r).toMatchObject({ state: 'prepared', value: { name: 'Atlas 0.4.2', environment: 'Demo / local', summary: 'SERVICE_TOKEN=[redacted: assignment]' } })
    expect(JSON.stringify(r)).not.toContain(canary)
    expect(prepareRelease({ name: 'x', environment: 'y' })).toMatchObject({ state: 'prepared', value: { summary: null } })
    expect(prepareRelease({ name: ' ', environment: 'y' })).toEqual({ state: 'rejected', code: 'invalid_shape' })
    expect(prepareRelease({ name: 'x' })).toEqual({ state: 'rejected', code: 'missing_field' })
    expect(prepareRelease({ name: 'x'.repeat(201), environment: 'y' })).toEqual({ state: 'rejected', code: 'too_large' })
    expect(prepareVerificationReceipt(`checked return ${secret}`)).toMatchObject({ state: 'prepared', value: 'checked return SERVICE_TOKEN=[redacted: assignment]' })
    expect(prepareVerificationReceipt('  ')).toEqual({ state: 'rejected', code: 'invalid_shape' })
  })

  it('a topic keeps its text and an optional note, both scrubbed, and never an empty text', () => {
    const r = prepareTopic({ text: 'Agree the pilot scope', note: secret })
    expect(r).toMatchObject({ state: 'prepared', value: { text: 'Agree the pilot scope', note: 'SERVICE_TOKEN=[redacted: assignment]' } })
    expect(JSON.stringify(r)).not.toContain(canary)
    expect(prepareTopic({ text: 'Only the text' })).toMatchObject({ state: 'prepared', value: { text: 'Only the text', note: null } })
    expect(prepareTopic({ text: '  ', note: 'x' })).toEqual({ state: 'rejected', code: 'invalid_shape' })
    expect(prepareTopic({ text: 'x', extra: 1 })).toEqual({ state: 'rejected', code: 'unknown_field' })
    expect(prepareTopic({ text: 'x'.repeat(501) })).toEqual({ state: 'rejected', code: 'too_large' })
  })
})
