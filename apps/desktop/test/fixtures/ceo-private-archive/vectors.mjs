// Builders for the CeoPrivateArchive@1 golden vectors (first-slice plan A1-1).
//
// The builders are shared by `generate.mjs`, which wrote the frozen files beside this
// one, and by the codec test, which mutates valid archives into negatives. The test
// never regenerates the frozen expectations: a codec change that moves a canonical byte
// fails against the committed files, and SQL (A1-2) is held to the same files.
import { createHash } from 'node:crypto'
import { historicalCeoSendCanonical, computePrivateArchiveDigest } from '../../../src/main/ceoPrivateArchive.ts'
import { digestInput } from '../../../src/shared/archive.ts'

export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const sha = s => createHash('sha256').update(s, 'utf8').digest('hex')
export const A = id(9001), B = id(9002), C = id(9003) // Estates
export const OWNER = id(9100), OTHER_PERSON = id(9101)
export const PROJECT = id(9200), QUESTION = id(9300)

export function envelope({ operation, conversation, message, ordinal, text = 'Что изменилось в Atlas за неделю?', context }) {
  return { schema: 'CeoSend@1', operation_id: operation, conversation_id: conversation, message_id: message,
    expected_revision: ordinal - 1, subject_revision: 1, input_channel: 'text', text, preparation_version: 'har06-ceo-v1',
    context: context ?? { schema: 'CeoContext@1', mode: 'none', selection_revision: 0, project_id: null, project_revision: null, estate_seq: 0 } }
}

/** A manifest for an ordinary archive whose journal body is `lines` (original bytes). */
export function ordinary(estate, lines, { watermarkSeq, takenAtUtc = '2026-09-28T09:00:00.000Z' } = {}) {
  const eventCount = lines.length
  const watermark = watermarkSeq ?? (eventCount ? Number(JSON.parse(lines.at(-1)).seq) : 0)
  const digest = createHash('sha256').update(digestInput({ sourceEstateId: estate, watermarkSeq: watermark, eventCount })).update(lines.join('\n')).digest('hex')
  return { manifest: { schema: 'FabricArchive@1', sourceEstateId: estate, takenAtUtc, watermarkSeq: watermark, eventCount, digest },
    journal: eventCount ? lines.join('\n') + '\n' : '' }
}
export const line = (seq, extra = {}) => JSON.stringify({ seq, type: 'estate.created@1', schema_rev: '1', actor: { kind: 'operator' },
  project_id: null, run_id: null, node_id: null, payload: {}, occurred_at: '2026-09-28T08:00:00.000000+00:00', ...extra })

/** A message row whose digests are derived, never typed. */
export function message({ source, owner = OWNER, origin = source, conversation, n, ordinal, seq, text, context }) {
  const env = envelope({ operation: id(4000 + n), conversation, message: id(3000 + n), ordinal, text, context })
  return { id: id(3000 + n), conversation_id: conversation, ordinal, content_id: id(5000 + n), request_id: id(6000 + n),
    accepted_seq: seq, envelope: env, source_digest: sha(historicalCeoSendCanonical(source, owner, env)),
    origin: { estate_id: origin, canonical_digest: sha(historicalCeoSendCanonical(origin, owner, env)) } }
}
export const send = m => ({ operation_id: m.envelope.operation_id, kind: 'send', message_id: m.id })
export const open = (c, requested = c.id, revision = 0) => ({ operation_id: id(70000 + Number(requested.slice(-4))), kind: 'open',
  requested_conversation_id: requested, subject_kind: c.subject_kind, subject_id: c.subject_id,
  receipt: { conversation_id: c.id, revision, receipt_seq: c.created_seq } })

/** Rows sorted as the contract orders them; the digest is computed by the codec over
 * everything but itself, then sealed into the header. */
export function archive({ source = A, owner = OWNER, watermark = 20, conversations = [], messages = [], operations = [], archiveId = id(8000) }) {
  const m = ordinary(source, Array.from({ length: watermark }, (_, i) => line(i + 1))).manifest
  const draft = { schema: 'CeoPrivateArchive@1', archive_id: archiveId, source_schema_version: 66, owner_person_id: owner,
    estate_archive: m, retention: 'no-deletion-v1',
    conversations: [...conversations].sort((x, y) => (x.id < y.id ? -1 : 1)),
    messages: [...messages].sort((x, y) => (x.conversation_id < y.conversation_id ? -1 : x.conversation_id > y.conversation_id ? 1 : x.ordinal - y.ordinal)),
    operations: [...operations].sort((x, y) => (x.operation_id < y.operation_id ? -1 : 1)),
    tombstones: [], archive_digest: '0'.repeat(64) }
  return seal(draft)
}
export const bytes = obj => new TextEncoder().encode(JSON.stringify(obj, null, 2))
/** Recompute the header digest after a mutation, so a structural negative reaches its
 * structural check instead of stopping at the digest. Left unchanged when the mutated
 * archive cannot be digested at all — that refusal is then the one under test. */
export function seal(obj) {
  try { return { ...obj, archive_digest: computePrivateArchiveDigest(bytes({ ...obj, archive_digest: '0'.repeat(64) })) } }
  catch { return obj }
}

const conv = (n, kind, subject, ownerProject, created, revision) => ({ id: id(2000 + n), subject_kind: kind,
  subject_id: kind === 'global' ? id(2000 + n) : subject, owner_project_id: ownerProject, created_seq: created, revision })

/** The seven golden vectors named by the plan, plus the ordinary-digest corpus. */
export function goldenVectors() {
  const global = conv(1, 'global', null, null, 2, 1)
  const gm = message({ source: A, conversation: global.id, n: 1, ordinal: 1, seq: 3 })
  const projectAlias = conv(2, 'project', PROJECT, PROJECT, 4, 1)
  const pm = message({ source: A, conversation: projectAlias.id, n: 2, ordinal: 1, seq: 5,
    context: { schema: 'CeoContext@1', mode: 'one', selection_revision: 1, project_id: PROJECT, project_revision: 2, estate_seq: 4 } })
  const question = conv(3, 'question', QUESTION, PROJECT, 6, 1)
  const qm = message({ source: A, conversation: question.id, n: 3, ordinal: 1, seq: 7 })
  const unicode = conv(4, 'global', null, null, 8, 2)
  const u1 = message({ source: A, conversation: unicode.id, n: 4, ordinal: 1, seq: 9, text: 'Привет, 雪 и 😀\nвторая строка' })
  const u2 = message({ source: A, conversation: unicode.id, n: 5, ordinal: 2, seq: 10, text: 'разделитель\u2028строк и\r\nCRLF' })
  const relay = conv(5, 'global', null, null, 2, 1)
  const rm = message({ source: C, origin: A, conversation: relay.id, n: 6, ordinal: 1, seq: 3 })
  const none = conv(6, 'project', PROJECT, PROJECT, 2, 1)
  const nm = message({ source: A, conversation: none.id, n: 7, ordinal: 1, seq: 3 })
  return {
    'empty': archive({ watermark: 0 }),
    'global-null-owner-project': archive({ conversations: [global], messages: [gm], operations: [open(global, global.id, 0), send(gm)] }),
    'project-open-alias': archive({ conversations: [projectAlias], messages: [pm], operations: [open(projectAlias, id(2999), 0), open(projectAlias), send(pm)] }),
    'question': archive({ conversations: [question], messages: [qm], operations: [open(question), send(qm)] }),
    'unicode-newlines': archive({ conversations: [unicode], messages: [u1, u2], operations: [open(unicode), send(u1), send(u2)] }),
    'origin-a-b-c': archive({ source: C, conversations: [relay], messages: [rm], operations: [open(relay), send(rm)] }),
    'project-mode-none': archive({ conversations: [none], messages: [nm], operations: [open(none), send(nm)] }),
  }
}
export function ordinaryVectors() {
  return {
    'journal-empty': ordinary(A, []),
    'journal-one-line': ordinary(A, [line(1)]),
    'journal-many-lines': ordinary(A, [line(1), line(2, { type: 'project.created@1', project_id: PROJECT, payload: { name: 'Atlas', cost: 0.5 } }), line(3)]),
    'journal-decimal-seq': ordinary(A, [line('1'), line('9007199254740991')]),
  }
}
