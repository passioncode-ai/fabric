/**
 * Native admission of an owner-private CEO archive (`CeoPrivateArchive@1`) and preflight of
 * the ordinary archive it rides beside ([contract](../../../../docs/launch/harness-r0/ceo-private-archive.md),
 * ADR-0079). Admission only: no identity, no SQL completeness and no authenticity claim —
 * an unkeyed digest detects change, it does not prove who wrote the file. Historical input
 * is validated and hashed WITHOUT today's sanitizer; imported text is never trimmed,
 * scrubbed or reinterpreted.
 *
 * Plan defaults applied here (first-slice plan, "Codec defaults for A1-1"):
 *  1. No project-context rule: migration 64 accepts `mode:'none'` in a project
 *     conversation, so an archive of real history carries it.
 *  2. Companion and manifest sequence numbers are safe integers; decimal strings are
 *     allowed for the ordinary journal's `seq` only (ADR-0079 §6).
 *  3. Non-canonical integer spellings refuse (`parseArchiveJson` numbers: 'integers').
 *  4. One depth/node definition, shared with SQL (see `archiveJson.ts`).
 */
import { createHash } from 'node:crypto'
import type { CeoSend } from '../shared/ceoConversation.ts'
import { CEO_LIMITS, CEO_PREPARATION, historicalCeoSendCanonical } from '../shared/ceoConversation.ts'
import { ARCHIVE_SCHEMA, digestInput } from '../shared/archive.ts'
import { archiveFail as fail, decodeArchiveUtf8, parseArchiveJson } from './archiveJson.ts'

export const PRIVATE_ARCHIVE_SCHEMA = 'CeoPrivateArchive@1' as const
export const PRIVATE_ARCHIVE_LIMITS = Object.freeze({ sourceSchemas: Object.freeze([66, 67, 68, 69, 70, 71, 72, 73, 74] as const), privateBytes: 8 * 1024 * 1024,
  journalBytes: 32 * 1024 * 1024, journalLineBytes: 1024 * 1024, manifestBytes: 4096, events: 65536,
  conversations: 256, messages: 4096, operations: 8192, depth: 32, nodes: 1_000_000 })
export type JournalSeq = number | string
export interface PrivateEstateManifest { schema: typeof ARCHIVE_SCHEMA; sourceEstateId: string; takenAtUtc: string; watermarkSeq: number; eventCount: number; digest: string }
export interface PrivateConversation { id: string; subject_kind: 'global'|'project'|'question'; subject_id: string; owner_project_id: string|null; created_seq: number; revision: number }
export interface PrivateMessage { id: string; conversation_id: string; ordinal: number; content_id: string; request_id: string; accepted_seq: number; envelope: CeoSend; source_digest: string; origin: { estate_id: string; canonical_digest: string } }
export type PrivateOperation = { operation_id: string; kind: 'send'; message_id: string } | { operation_id: string; kind: 'open'; requested_conversation_id: string; subject_kind: PrivateConversation['subject_kind']; subject_id: string; receipt: { conversation_id: string; revision: number; receipt_seq: number } }
export interface CeoPrivateArchive { schema: typeof PRIVATE_ARCHIVE_SCHEMA; archive_id: string; source_schema_version: 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74; owner_person_id: string; estate_archive: PrivateEstateManifest; retention: 'no-deletion-v1'; conversations: PrivateConversation[]; messages: PrivateMessage[]; operations: PrivateOperation[]; tombstones: []; archive_digest: string }
export interface PrivateArchiveAdmission { archive: CeoPrivateArchive; canonical: string; digest: string }

type Obj = Record<string, unknown>
const bytes = (s: string): number => Buffer.byteLength(s, 'utf8')
const hash = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex')
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)
const sha = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x)
const integer = (x: unknown, min = 0): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= min
/** The ordinary journal only: a safe integer, or its canonical decimal string. */
const journalSeq = (x: unknown): boolean => integer(x, 1) || typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x) && Number.isSafeInteger(Number(x))
const check = (ok: unknown): void => { if (!ok) fail() }
const obj = (x: unknown, keys: readonly string[]): Obj => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return fail()
  const p = x as Obj
  check(Object.keys(p).length === keys.length && keys.every(k => Object.hasOwn(p, k)))
  return p
}
const array = (x: unknown, max: number): unknown[] => { if (!Array.isArray(x)) return fail(); if (x.length > max) fail('too_large'); return x }
const subject = (x: unknown): boolean => x === 'global' || x === 'project' || x === 'question'
const nullableUuid = (x: unknown): boolean => x === null || uuid(x)
const MANIFEST_KEYS = ['schema','sourceEstateId','takenAtUtc','watermarkSeq','eventCount','digest'] as const

/** UTC only; Gregorian calendar checked without Date's rollover or precision loss. */
function timestamp(x: unknown): boolean {
  if (typeof x !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(x)
  if (!m) return false
  const [y, mon, d, h, min, s] = m.slice(1, 7).map(Number)
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31,30,31,30,31,31,30,31,30,31]
  return y >= 1 && mon >= 1 && mon <= 12 && d >= 1 && d <= days[mon - 1] && h < 24 && min < 60 && s < 60
}
function manifest(x: unknown): PrivateEstateManifest {
  const m = obj(x, MANIFEST_KEYS)
  if (m.schema !== ARCHIVE_SCHEMA) fail('unsupported_schema')
  check(uuid(m.sourceEstateId) && timestamp(m.takenAtUtc) && integer(m.watermarkSeq) && integer(m.eventCount) && sha(m.digest))
  if ((m.eventCount as number) > PRIVATE_ARCHIVE_LIMITS.events) fail('too_large')
  check(m.eventCount === 0 ? m.watermarkSeq === 0 : (m.watermarkSeq as number) >= (m.eventCount as number))
  return m as unknown as PrivateEstateManifest
}
/** migration 64 `ceo_frame`: UTF-8 byte length, a colon, the value; null is `-1:`. */
const frame = (v: string|number|null): string => v === null ? '-1:' : `${bytes(String(v))}:${v}`

/** Keep this historical validator aligned with migration 64, NOT with prepareCeoSend:
 * it must never scrub, trim or reinterpret imported text. */
function historicalEnvelope(x: unknown): CeoSend {
  const p = obj(x, ['schema','operation_id','conversation_id','message_id','expected_revision','subject_revision','input_channel','text','preparation_version','context'])
  if (p.schema !== 'CeoSend@1' || p.preparation_version !== CEO_PREPARATION) fail('unsupported_schema')
  const c = obj(p.context, ['schema','mode','selection_revision','project_id','project_revision','estate_seq'])
  if (c.schema !== 'CeoContext@1') fail('unsupported_schema')
  check(p.input_channel === 'text' && uuid(p.operation_id) && uuid(p.conversation_id) && uuid(p.message_id) &&
    integer(p.expected_revision) && integer(p.subject_revision) &&
    typeof p.text === 'string' && /[^\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u.test(p.text) &&
    integer(c.selection_revision) && integer(c.estate_seq) &&
    (c.mode === 'none' ? c.project_id === null && c.project_revision === null : c.mode === 'one' && uuid(c.project_id) && integer(c.project_revision)))
  if (bytes(p.text as string) > CEO_LIMITS.bodyBytes || bytes(JSON.stringify(p)) > CEO_LIMITS.wireBytes) fail('too_large')
  return p as unknown as CeoSend
}
/** migration 64 `ceo_send_canonical`, byte for byte: the one definition lives in the shared module. */
export { historicalCeoSendCanonical }
/** The companion's canonical form: every header field except `archive_digest`, the exact
 * manifest, then each array's length and each row's fields in contract order. */
export function privateArchiveCanonical(a: CeoPrivateArchive): string {
  const m = a.estate_archive
  const fields: (string|number|null)[] = [a.schema,a.archive_id,a.source_schema_version,a.owner_person_id,
    m.schema,m.sourceEstateId,m.takenAtUtc,m.watermarkSeq,m.eventCount,m.digest,a.retention,a.conversations.length]
  for (const c of a.conversations) fields.push(c.id,c.subject_kind,c.subject_id,c.owner_project_id,c.created_seq,c.revision)
  fields.push(a.messages.length)
  for (const r of a.messages) fields.push(r.id,r.conversation_id,r.ordinal,r.content_id,r.request_id,r.accepted_seq,
    historicalCeoSendCanonical(m.sourceEstateId,a.owner_person_id,r.envelope),r.source_digest,r.origin.estate_id,r.origin.canonical_digest)
  fields.push(a.operations.length)
  for (const r of a.operations) {
    fields.push(r.operation_id,r.kind)
    if (r.kind === 'send') fields.push(r.message_id)
    else fields.push(r.requested_conversation_id,r.subject_kind,r.subject_id,r.receipt.conversation_id,r.receipt.revision,r.receipt.receipt_seq)
  }
  fields.push(a.tombstones.length)
  return fields.map(frame).join('')
}

function inspect(raw: Uint8Array): PrivateArchiveAdmission {
  const L = PRIVATE_ARCHIVE_LIMITS
  const p = obj(parseArchiveJson(decodeArchiveUtf8(raw, L.privateBytes), { budget: { nodes: L.nodes }, maxDepth: L.depth, numbers: 'integers' }),
    ['schema','archive_id','source_schema_version','owner_person_id','estate_archive','retention','conversations','messages','operations','tombstones','archive_digest'])
  if (p.schema !== PRIVATE_ARCHIVE_SCHEMA || !(L.sourceSchemas as readonly unknown[]).includes(p.source_schema_version)) fail('unsupported_schema')
  check(uuid(p.archive_id) && uuid(p.owner_person_id) && sha(p.archive_digest) && p.retention === 'no-deletion-v1')
  const m = manifest(p.estate_archive)
  const conversations = array(p.conversations, L.conversations), messages = array(p.messages, L.messages), operations = array(p.operations, L.operations)
  // v1 has no retention writer: a tombstone is not "too many", it is a format this codec does not have.
  check(Array.isArray(p.tombstones) && p.tombstones.length === 0)
  const cs = new Map<string, PrivateConversation>(), subjects = new Set<string>(), accepted = new Set<number>()
  let lastId = ''
  for (const x of conversations) {
    const c = obj(x, ['id','subject_kind','subject_id','owner_project_id','created_seq','revision'])
    check(uuid(c.id) && c.id > lastId && subject(c.subject_kind) && uuid(c.subject_id) && nullableUuid(c.owner_project_id) &&
      integer(c.created_seq, 1) && (c.created_seq as number) <= m.watermarkSeq && integer(c.revision) && (c.revision as number) <= L.messages)
    check(c.subject_kind === 'global' ? c.subject_id === c.id && c.owner_project_id === null :
      c.subject_kind === 'project' ? c.owner_project_id === c.subject_id : uuid(c.owner_project_id))
    const identity = `${c.subject_kind}:${c.subject_id}`
    check(!subjects.has(identity) && !accepted.has(c.created_seq as number)); subjects.add(identity); accepted.add(c.created_seq as number)
    lastId = c.id as string; cs.set(lastId, c as unknown as PrivateConversation)
  }
  const ms = new Map<string, PrivateMessage>(), contents = new Set<string>(), requests = new Set<string>(), counts = new Map<string,number>(), lastSeq = new Map<string,number>()
  lastId = ''
  for (const x of messages) {
    const r = obj(x, ['id','conversation_id','ordinal','content_id','request_id','accepted_seq','envelope','source_digest','origin'])
    const o = obj(r.origin, ['estate_id','canonical_digest']); const e = historicalEnvelope(r.envelope)
    check(uuid(r.id) && uuid(r.conversation_id) && integer(r.ordinal, 1) && uuid(r.content_id) && uuid(r.request_id) && integer(r.accepted_seq, 1) && sha(r.source_digest) && uuid(o.estate_id) && sha(o.canonical_digest))
    const c = cs.get(r.conversation_id as string); if (!c) return fail()
    const seq = r.accepted_seq as number
    check((r.conversation_id as string) >= lastId && r.ordinal === (counts.get(c.id) ?? 0) + 1 &&
      seq > (lastSeq.get(c.id) ?? c.created_seq) && seq <= m.watermarkSeq &&
      !ms.has(r.id as string) && !contents.has(r.content_id as string) && !requests.has(r.request_id as string) && !accepted.has(seq))
    check(e.conversation_id === c.id && e.message_id === r.id && e.expected_revision + 1 === r.ordinal && e.context.estate_seq <= seq)
    if (hash(historicalCeoSendCanonical(m.sourceEstateId,p.owner_person_id as string,e)) !== r.source_digest ||
      hash(historicalCeoSendCanonical(o.estate_id as string,p.owner_person_id as string,e)) !== o.canonical_digest) fail('integrity_mismatch')
    lastId = c.id; counts.set(c.id, r.ordinal as number); lastSeq.set(c.id, seq); accepted.add(seq)
    ms.set(r.id as string, r as unknown as PrivateMessage); contents.add(r.content_id as string); requests.add(r.request_id as string)
  }
  for (const c of cs.values()) check(c.revision === (counts.get(c.id) ?? 0))
  const sent = new Set<string>(), opened = new Set<string>(); lastId = ''
  for (const x of operations) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return fail()
    const kind = (x as Obj).kind
    check(kind === 'send' || kind === 'open')
    const r = obj(x, kind === 'send' ? ['operation_id','kind','message_id'] : ['operation_id','kind','requested_conversation_id','subject_kind','subject_id','receipt'])
    check(uuid(r.operation_id) && r.operation_id > lastId); lastId = r.operation_id as string
    if (kind === 'send') {
      check(uuid(r.message_id)); const msg = ms.get(r.message_id as string); if (!msg) return fail()
      check(!sent.has(msg.id) && msg.envelope.operation_id === r.operation_id); sent.add(msg.id)
    } else {
      check(uuid(r.requested_conversation_id) && subject(r.subject_kind) && uuid(r.subject_id))
      const receipt = obj(r.receipt, ['conversation_id','revision','receipt_seq'])
      check(uuid(receipt.conversation_id) && integer(receipt.revision) && integer(receipt.receipt_seq, 1))
      const c = cs.get(receipt.conversation_id as string); if (!c) return fail()
      check(c.subject_kind === r.subject_kind && c.subject_id === r.subject_id && receipt.receipt_seq === c.created_seq &&
        (receipt.revision as number) <= c.revision && (c.subject_kind !== 'global' || r.requested_conversation_id === c.id))
      opened.add(c.id)
    }
  }
  check(sent.size === ms.size && opened.size === cs.size)
  const archive = p as unknown as CeoPrivateArchive, wire = privateArchiveCanonical(archive)
  return { archive, canonical: wire, digest: hash(wire) }
}

/** For an authorized exporter assembling a candidate: every typed relation and
 * source/origin hash is checked; only `archive_digest` itself is not compared. */
export function computePrivateArchiveDigest(raw: Uint8Array): string { return inspect(raw).digest }

/** Admission from raw file bytes. The returned text and IDs remain exactly as decoded. */
export function decodePrivateArchive(raw: Uint8Array): PrivateArchiveAdmission {
  const result = inspect(raw)
  if (result.digest !== result.archive.archive_digest) fail('integrity_mismatch')
  return result
}

/** The ordinary archive beside it: original bytes are checked against the existing
 * `FabricArchive@1` digest BEFORE any line is parsed, and are never re-encoded. */
export function preflightOrdinaryArchive(manifestRaw: Uint8Array, journalRaw: Uint8Array): { manifest: PrivateEstateManifest; events: Obj[]; journal: string } {
  const L = PRIVATE_ARCHIVE_LIMITS
  const m = manifest(parseArchiveJson(decodeArchiveUtf8(manifestRaw, L.manifestBytes), { maxDepth: 2, numbers: 'integers' }))
  const journal = decodeArchiveUtf8(journalRaw, L.journalBytes)
  check(!journal.includes('\r') && (m.eventCount === 0 ? journal === '' : journal.endsWith('\n')))
  const body = journal === '' ? '' : journal.slice(0, -1)
  if (createHash('sha256').update(digestInput(m)).update(body).digest('hex') !== m.digest) fail('integrity_mismatch')
  const lines = journal === '' ? [] : body.split('\n'); check(lines.length === m.eventCount)
  const events: Obj[] = [], budget = { nodes: L.nodes }; let previous = 0
  for (const line of lines) {
    if (bytes(line) > L.journalLineBytes) fail('too_large')
    check(line.length > 0)
    const r = obj(parseArchiveJson(line, { budget, maxDepth: L.depth, numbers: 'lossless' }), ['seq','type','schema_rev','actor','project_id','run_id','node_id','payload','occurred_at'])
    check(journalSeq(r.seq) && Number(r.seq) > previous && typeof r.type === 'string' && r.type.length > 0 && typeof r.schema_rev === 'string' && r.schema_rev.length > 0 &&
      nullableUuid(r.project_id) && nullableUuid(r.run_id) && nullableUuid(r.node_id) && timestamp(r.occurred_at))
    previous = Number(r.seq); events.push(r)
  }
  check(previous === m.watermarkSeq)
  return { manifest: m, events, journal }
}
