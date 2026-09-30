/** Privacy preparation for the explicitly listed R0 commands, not authorization
 * or a replacement for transactional/domain validation. Nothing here writes.
 * `not_covered` requires caller classification; it is never permission to pass.
 *
 * Field contracts: migrations 21 (created agents), 33 (routines), 50 (memory),
 * 57 (goals), 59 (project configuration), 61 (tasks); workspace.ts import events;
 * answerCommit.ts composition. No recursive field-name heuristic is used.
 */
import { redact, type RedactionCount } from './redact.ts'
import { validateAnswer, type AnswerOption, type ValidatedAnswer } from './answerCommit.ts'
import { ABOUT_NAMESPACES, INSIGHT_CATEGORIES } from './memoryContract.ts'
import { ORIGIN_KINDS } from './origin.ts'

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
export interface JsonObject { [key: string]: JsonValue }
export type IngressRejection = 'invalid_shape' | 'non_json' | 'too_large' | 'too_deep' |
  'cyclic' | 'accessor' | 'unknown_field' | 'missing_field' | 'invalid_identifier' |
  'invalid_enum' | 'secret_in_reference' | 'invalid_answer' | 'unsupported_import_event'
export type PreparedInput<T> = { state: 'prepared'; value: T; redactions: RedactionCount[] } |
  { state: 'rejected'; code: IngressRejection }
export type EventPreparation = PreparedInput<JsonObject> | { state: 'not_covered' }

/** Bounds are for rejection, never clipping. Retained strings are scrubbed whole. */
export const COMMAND_INGRESS_LIMITS = Object.freeze({
  depth: 8, nodes: 4096, arrayItems: 512, objectKeys: 64,
  stringChars: 262_144, totalChars: 1_048_576
})

class Refusal extends Error {
  readonly code: IngressRejection
  constructor(code: IngressRejection) { super(code); this.code = code }
}
function refuse(code: IngressRejection): never { throw new Refusal(code) }

/** Inspect descriptors, never values through getters or JSON serialization.
 * Only ordinary JSON containers enter the policy. Proxy traps cannot be made
 * inert by JavaScript reflection; callers must still use their IPC/JSON boundary.
 */
function snapshot(input: unknown): JsonValue {
  let nodes = 0, chars = 0
  const ancestors = new Set<object>()
  const charge = (s: string): void => {
    chars += s.length
    if (s.length > COMMAND_INGRESS_LIMITS.stringChars || chars > COMMAND_INGRESS_LIMITS.totalChars)
      refuse('too_large')
  }
  const visit = (value: unknown, depth: number): JsonValue => {
    if (++nodes > COMMAND_INGRESS_LIMITS.nodes) refuse('too_large')
    if (depth > COMMAND_INGRESS_LIMITS.depth) refuse('too_deep')
    if (typeof value === 'string') { charge(value); return value }
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'number') return Number.isFinite(value) ? value : refuse('non_json')
    if (typeof value !== 'object') return refuse('non_json')
    if (ancestors.has(value)) refuse('cyclic')
    const array = Array.isArray(value)
    const proto = Object.getPrototypeOf(value)
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) refuse('non_json')
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')?.value
      if (!Number.isSafeInteger(length) || length > COMMAND_INGRESS_LIMITS.arrayItems) refuse('too_large')
    }
    const keys = Reflect.ownKeys(value)
    if (keys.length > (array ? COMMAND_INGRESS_LIMITS.arrayItems + 1 : COMMAND_INGRESS_LIMITS.objectKeys)) refuse('too_large')
    ancestors.add(value)
    const out: JsonObject | JsonValue[] = array ? [] : Object.create(null)
    for (const key of keys) {
      if (typeof key !== 'string') refuse('non_json')
      if (array && key === 'length') continue
      charge(key)
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor)) refuse('accessor')
      if (!descriptor.enumerable) refuse('non_json')
      if (array && !/^(0|[1-9][0-9]*)$/.test(key)) refuse('non_json')
      Object.defineProperty(out, key, { value: visit(descriptor.value, depth + 1), enumerable: true,
        configurable: true, writable: true })
    }
    if (array && keys.length - 1 !== (value as unknown[]).length) refuse('non_json') // sparse array
    ancestors.delete(value)
    return out
  }
  return visit(input, 0)
}

type Counts = Map<string, number>
type Rule = (value: JsonValue, counts: Counts) => JsonValue
type Field = { rule: Rule; optional?: true }
type Fields = Record<string, Field>
const required = (rule: Rule): Field => ({ rule })
const optional = (rule: Rule): Field => ({ rule, optional: true })
const nullable = (rule: Rule): Rule => (v, c) => v === null ? null : rule(v, c)
const string = (v: JsonValue): string => typeof v === 'string' ? v : refuse('invalid_shape')
const add = (counts: Counts, removed: readonly RedactionCount[]): void => {
  for (const { rule, count } of removed) counts.set(rule, (counts.get(rule) ?? 0) + count)
}
const text: Rule = (v, c) => {
  const result = redact(string(v)); add(c, result.redactions); return result.text
}
const nonemptyText: Rule = (v, c) => string(v).trim() ? text(v, c) : refuse('invalid_shape')
const uuid: Rule = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(string(v))
  ? v : refuse('invalid_identifier')
const digest: Rule = v => /^[0-9a-f]{64}$/i.test(string(v)) ? v : refuse('invalid_identifier')
/** Resource and correlation strings are never rewritten. Shape detection is
 * deliberately the same primitive as text scrubbing, not a new secret store.
 */
const reference: Rule = v => {
  const s = string(v)
  if (!s.trim() || /[\x00-\x1f\x7f]/.test(s)) refuse('invalid_identifier')
  if (redact(s).text !== s) refuse('secret_in_reference')
  return s
}
const enumeration = (values: readonly string[]): Rule => v => values.includes(string(v)) ? v : refuse('invalid_enum')
const integer = (min: number): Rule => v => typeof v === 'number' && Number.isSafeInteger(v) && v >= min
  ? v : refuse('invalid_shape')
const boolean: Rule = v => typeof v === 'boolean' ? v : refuse('invalid_shape')
const list = (rule: Rule): Rule => (v, c) => Array.isArray(v) ? v.map(x => rule(x, c)) : refuse('invalid_shape')
const object = (fields: Fields): Rule => (v, c) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return refuse('invalid_shape')
  const out: JsonObject = Object.create(null)
  for (const key of Object.keys(v)) {
    if (!Object.hasOwn(fields, key)) refuse('unknown_field')
    out[key] = fields[key].rule(v[key], c)
  }
  for (const [key, field] of Object.entries(fields))
    if (!field.optional && !Object.hasOwn(v, key)) refuse('missing_field')
  return out
}
const metadata = { redactions: optional(text) }
const origin = object({ kind: required(enumeration(ORIGIN_KINDS)), ref: required(reference) })
const about = object({ namespace: required(enumeration(ABOUT_NAMESPACES)), key: required(reference) })
const occurrence = object({ system: required(reference), source_id: required(reference), episode_key: required(reference) })
const timestamp: Rule = v => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(string(v)) &&
  Number.isFinite(Date.parse(string(v))) ? v : refuse('invalid_shape')

const EVENT_FIELDS: Record<string, Fields> = {
  'task.closed@1': { task_id: required(uuid), outcome: required(enumeration(['done', 'cancelled'])), reason: optional(nullable(text)), ...metadata },
  'memory.retrieved@1': { id: required(uuid), session_id: required(nullable(uuid)), store: required(enumeration(['facts', 'transcripts'])), query: required(text), hits: required(integer(0)), ...metadata },
  'project.repo.attached@1': { id: required(uuid), path: required(reference), label: required(text), ...metadata },
  'routine.paused@1': { id: required(uuid), reason: required(text), window: optional(nullable(reference)), reason_code: optional(nullable(reference)), ...metadata },
  'routine.ran@1': { id: required(uuid), task_id: required(uuid), because: required(text), ...metadata },
  'cycle.ran@1': { state: required(reference), ms: required(integer(0)), sessions_observed: required(integer(0)), says: required(text), advances: required(boolean), ...metadata },
  'chain.dispatch@1': { id: required(reference), phase: required(enumeration(['intent', 'failed'])), task_run_id: required(uuid), session_id: optional(uuid), instruction: optional(text), says: optional(text), key: optional(reference), node: optional(object({ runId: required(reference), nodeId: required(reference), revision: required(integer(0)) })), ...metadata },
  'task.created@1': {
    id: required(uuid), title: optional(nullable(text)), instruction: optional(nullable(text)),
    option_id: optional(nullable(reference)), preset: optional(nullable(reference)),
    preset_edited: optional(boolean), idempotency_key: optional(nullable(reference)),
    task_type: optional(nullable(reference)), section: optional(nullable(text)), origin: optional(nullable(origin)), ...metadata
  },
  'task.note.added@1': { task_id: required(uuid), note_id: required(uuid), body_md: required(text), ...metadata },
  'task.brief.edited@1': { task_id: required(uuid), section: required(enumeration(['what', 'why', 'expected'])), body_md: required(text), ...metadata },
  'routine.defined@1': { id: required(uuid), project_id: required(uuid), instruction: required(text),
    option_id: required(reference), every_minutes: required(integer(5)), kind: optional(enumeration(['fixed', 'backlog'])), ...metadata },
  // Imported historical bindings can have no instructions/provider; the
  // interactive readSpec minimum is a different command's domain constraint.
  'agent.registered@1': { id: required(uuid), project_id: required(uuid), name: required(text),
    instructions: optional(nullable(text)), runner_id: optional(nullable(reference)), mcp_servers: optional(list(reference)),
    permission_mode: optional(nullable(reference)), ...metadata },
  'project.created@1': { id: required(uuid), name: required(text), purpose: optional(nullable(text)),
    repo_path: optional(nullable(reference)), memory_backend: optional(enumeration(['local', 'cloud'])),
    default_agent: optional(reference), ...metadata },
  'project.updated@1': { id: required(uuid), name: optional(nullable(text)), purpose: optional(nullable(text)),
    repo_path: optional(nullable(reference)), ...metadata },
  'project.settings.updated@1': { id: required(uuid), memory_backend: optional(enumeration(['local', 'cloud'])),
    default_agent: optional(reference), mcp_servers: optional(list(reference)), ...metadata },
  'project.configured@1': { id: required(uuid), base_revision: required(integer(0)), name: optional(nullable(text)),
    purpose: optional(nullable(text)), default_agent: optional(reference), mcp_servers: optional(list(reference)), ...metadata },
  'goal.defined@1': { id: required(uuid), title: required(text), autonomy: optional(enumeration(['safe', 'guarded', 'maximum'])), ...metadata },
  'memory.project.recorded@1': { id: required(uuid), claim: required(text), source_ref: optional(nullable(reference)),
    kind: optional(enumeration(['note', 'finding', 'decision', 'trap'])), supersedes: optional(nullable(uuid)),
    category: optional(enumeration(INSIGHT_CATEGORIES)), about: optional(nullable(about)),
    occurrence: optional(nullable(occurrence)), valid_from: optional(nullable(timestamp)), ...metadata }
}
export const COVERED_INGRESS_EVENTS: readonly string[] = Object.freeze(Object.keys(EVENT_FIELDS))

function prepare<T>(input: unknown, transform: (value: JsonValue, counts: Counts) => T): PreparedInput<T> {
  try {
    const counts: Counts = new Map()
    const value = transform(snapshot(input), counts)
    return { state: 'prepared', value, redactions: [...counts].map(([rule, count]) => ({ rule, count })) }
  } catch (error) {
    return { state: 'rejected', code: error instanceof Refusal ? error.code : 'invalid_shape' }
  }
}
function event(type: string, payload: JsonValue, counts: Counts): JsonObject {
  const out = object(EVENT_FIELDS[type])(payload, counts) as JsonObject
  if (type === 'task.created@1' && typeof out.instruction !== 'string' && typeof out.title !== 'string') refuse('missing_field')
  return out
}
export function prepareEventPayload(type: unknown, payload: unknown): EventPreparation {
  if (typeof type !== 'string' || !Object.hasOwn(EVENT_FIELDS, type)) return { state: 'not_covered' }
  return prepare(payload, (v, c) => event(type, v, c))
}

/** Use on the complete source BEFORE title clipping, idea splitting, admission
 * snapshots or delivery hashing. No clipping/trimming/identity derivation here.
 */
export function prepareOriginalInstruction(input: unknown): PreparedInput<string> {
  return prepare(input, (v, c) => nonemptyText(v, c) as string)
}

export function prepareAnswerComposition(input: unknown): PreparedInput<ValidatedAnswer> {
  return prepare(input, (v, c) => {
    const rawText: Rule = x => string(x)
    const option = object({ id: required(reference), label: required(rawText), consequence: optional(rawText) })
    const shaped = object({ answer: optional(rawText), chosenOption: optional(x => x === '' ? '' : reference(x, c)), options: required(list(option)) })(v, c) as JsonObject
    // validateAnswer trims chosenOption. Reject a noncanonical identity rather
    // than silently retargeting it; labels and free text retain its composition.
    if (typeof shaped.chosenOption === 'string' && shaped.chosenOption !== shaped.chosenOption.trim()) refuse('invalid_identifier')
    const checked = validateAnswer(shaped as unknown as { answer?: string; chosenOption?: string; options: AnswerOption[] })
    if (!checked.ok) return refuse('invalid_answer')
    return { answer: text(checked.value.answer, c) as string, chosenOption: checked.value.chosenOption }
  })
}

export interface PreparedDeclaredImport {
  commandId: string
  /** SHA256 of original source files. Preserved, never recomputed from output. */
  inputDigest: string
  events: { type: string; project_id: string; payload: JsonObject }[]
}
export function prepareDeclaredImport(input: unknown): PreparedInput<PreparedDeclaredImport> {
  return prepare(input, (v, c) => {
    const imported: Rule = (item, counts) => {
      const envelope = object({ type: required(x => string(x)), project_id: required(uuid), payload: required(x => x) })(item, counts) as JsonObject
      const type = envelope.type as string
      if (!['project.created@1', 'project.settings.updated@1', 'agent.registered@1'].includes(type)) refuse('unsupported_import_event')
      const payload = event(type, envelope.payload, counts)
      const project = type === 'agent.registered@1' ? payload.project_id : payload.id
      // PostgreSQL UUID comparison ignores hex case. Preserve both original
      // byte strings while comparing identity, never rewrite stored IDs.
      if ((project as string).toLowerCase() !== (envelope.project_id as string).toLowerCase()) refuse('invalid_identifier')
      return { type, project_id: envelope.project_id, payload }
    }
    return object({ commandId: required(uuid), inputDigest: required(digest), events: required(list(imported)) })(v, c) as unknown as PreparedDeclaredImport
  })
}

/** The Board's words have their own bounds: a sentence, not a document. Over the bound is a
 *  refusal, never a clipping — a clipped reason is a different reason. */
const bounded = (max: number): Rule => (v, c) => string(v).length > max ? refuse('too_large') : nonemptyText(v, c)

/** Why an open question waits for next time (SCR-41 «На следующий раз»). */
export function prepareDeferralReason(input: unknown): PreparedInput<string> {
  return prepare(input, (v, c) => bounded(2000)(v, c) as string)
}

/** The words of a release (ADR-0084): its name, where it applies, and an optional summary. */
export function prepareRelease(input: unknown): PreparedInput<{ name: string; environment: string; summary: string | null }> {
  return prepare(input, (v, c) => {
    const shaped = object({ name: required(bounded(200)), environment: required(bounded(200)),
      summary: optional(nullable(x => string(x).trim() ? bounded(4000)(x, c) : null)) })(v, c) as JsonObject
    return { name: shaped.name as string, environment: shaped.environment as string, summary: (shaped.summary as string | null | undefined) ?? null }
  })
}

/** What a verification checked, in which environment — the receipt that backs a release. */
export function prepareVerificationReceipt(input: unknown): PreparedInput<string> {
  return prepare(input, (v, c) => bounded(4000)(v, c) as string)
}

/** A topic the owner writes onto the Board (SCR-41 «+ Добавить тему»). */
export function prepareTopic(input: unknown): PreparedInput<{ text: string; note: string | null }> {
  return prepare(input, (v, c) => {
    const shaped = object({ text: required(bounded(500)), note: optional(nullable(x => string(x).trim() ? bounded(4000)(x, c) : null)) })(v, c) as JsonObject
    return { text: shaped.text as string, note: (shaped.note as string | null | undefined) ?? null }
  })
}
