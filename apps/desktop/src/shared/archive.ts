// What a backup of this estate IS, and what it deliberately is not (FA-06).
//
// THE MIRROR IS NOT A BACKUP AND SAYS SO. `storageContract.ts` already computes
// that: two of thirty-odd tables are carried, `restorability()` refuses the word,
// and the screen names the absences. This file is the other half — an archive
// that CAN be called one, and an inventory that says, per category, who owns it,
// how long it is kept and where a restore gets it back from.
//
// ADR-0014 DECIDES THE SHAPE. The journal is the spine and every projection is
// derived from it except explicitly protected primary content (ADR-0075).
// An archive of ordinary projection tables would be an archive of one
// table and twenty-nine copies of conclusions drawn from it — twenty-nine more
// things to disagree with each other on the way back. The archive carries the
// journal, the estate it belongs to, and the categories a replay CANNOT
// reproduce. Everything else is recovered by rebuilding, which is what the
// projector is for.
//
// AND THE EXCLUSIONS ARE THE POINT, not the apology. Authority does not travel:
// a grant carried into a file is quotable and carried back is forgeable, and an
// archive that restored memberships would restore access. Machine-local
// preferences are about a laptop, not an estate. Live facts — who holds a lease
// right now — are true for minutes. Every one of those is listed BESIDE the
// restore rather than discovered after it.

import { TABLE_SCOPE } from './scope.ts'

export const ARCHIVE_SCHEMA = 'FabricArchive@1'

/** Where a restore gets this category back from. */
export type Recovery =
  /** Carried in the archive itself. */
  | 'archive'
  /** Rebuilt by replaying the archived journal. */
  | 'journal'
  /** Deliberately not recoverable. The reason is not an apology. */
  | 'excluded'

export interface ArchiveCategory {
  name: string
  kind: 'table' | 'disk'
  recovery: Recovery
  /** Who decides what this holds. */
  owner: string
  retention: string
  /** Why, in a sentence an operator reads BEFORE restoring rather than after. */
  reason: string
}

/** Thrown when the estate grows a table this inventory has not been told about. */
export class UninventoriedCategory extends Error {
  constructor(name: string) {
    super(
      `${name} is in the estate and in no archive category. A backup that silently omits a table ` +
        `is the one nobody checks — declare it, with where a restore gets it back from.`
    )
    this.name = 'UninventoriedCategory'
  }
}

/** Carried verbatim: the spine, and the estate it is the spine of. */
const CARRIED: Readonly<Record<string, string>> = {
  journal:
    'the spine. Every projection is derived from it, so carrying it carries them — and carrying THEM instead would be carrying conclusions that can disagree with the record they came from'
}

/**
 * Never carried, and why. These are decisions, not gaps.
 *
 * Authority does not travel because a restored grant is a forged one. Live facts
 * do not travel because they are false by the time the file is read. Machine
 * preferences do not travel because they are about a machine.
 */
const PRIVATE_CEO_PRIMARY: Readonly<Record<string, string>> = {
  ceo_conversations: 'private ownership and subject identity are excluded from the Estate archive; owner-portable recovery requires its dedicated authorized archive',
  ceo_private_contents: 'private primary text is excluded from the Estate archive and cannot be rebuilt from opaque journal receipts; a dedicated owner archive is required',
  ceo_messages: 'private message order and content references are excluded from the Estate archive; replay must not invent missing discussion',
  ceo_operations: 'private accepted input and detailed receipts are excluded from the Estate archive; restore must validate them through the owner recovery contract'
}
const EXCLUDED: Readonly<Record<string, string>> = {
  ...PRIVATE_CEO_PRIMARY,
  estate_restore_boundaries: 'protected local restore provenance created before projection; never transferred from an archive or reconstructed from its journal',
  ceo_pending_requests: 'private pending work is not dispatch authority and is not reconstructed by Estate journal restore',
  ceo_write_authorizations: 'transaction-only command authority must never survive in a portable archive',
  // Release review iteration 3: these two are transaction-only too, and an unlisted table falls through
  // to `journal` recovery, which no journal event rebuilds them from.
  transcript_recovery_authorizations: 'transaction-only recovery authority must never survive in a portable archive',
  declared_import_authorizations: 'transaction-only import exemption (migration 73) must never survive in a portable archive',
  ceo_private_import_receipts: 'a private import receipt is local evidence of one command in one Estate; the owner-private companion carries history, never this receipt (ADR-0079)',
  ceo_content_provenance: 'private provenance of imported text travels only inside the owner-private companion, as its origin fields; an Estate archive never carries it (ADR-0079)',

  estates: 'a restore creates a NEW estate. Carrying the old row back would make the copy claim to be the original',
  event_types: 'the vocabulary ships with the migrations. An archive that carried it could restore an estate onto a schema that does not speak it',
  persons: 'identity belongs to the auth plane; an archive that carried it would carry people',
  memberships: 'who may enter. Restoring access from a file is how a revoked membership comes back',
  membership_commands: 'the receipts of authority changes. Replaying one re-grants what somebody revoked',
  grants: 'a live permission. Quotable in a file, forgeable on the way back',
  grant_reservations: 'the live half of an authority decision; meaningless outside the run that took it',
  leases: 'who holds a file right now. True for minutes',
  session_heartbeats: 'what an agent said while it ran; about a session that has ended by the time anyone reads the archive',
  estate_settings: 'machine-local preference, not estate content',
  project_repos: 'paths on one machine. Evidence, not content, and they rebind per machine'
}

/** On-disk categories: not tables, and not journal-derived. */
const DISK: readonly ArchiveCategory[] = [
  {
    name: 'transcripts',
    kind: 'disk',
    recovery: 'excluded',
    owner: 'M45 · transcripts.ts',
    retention: 'until the operator deletes them',
    reason:
      'what was said in a session, on disk under userData. Large, and full of whatever the session touched — including anything a repository or a person put in front of an agent. Carried only when the operator asks for it explicitly, and never by default'
  },
  {
    name: 'operations-log',
    kind: 'disk',
    recovery: 'excluded',
    owner: 'M81 · opsSink.ts',
    retention: 'rotated on disk',
    reason: 'what the PROGRAM did, not what happened to the estate. It describes one machine and one process'
  },
  {
    name: 'session-bundles',
    kind: 'disk',
    recovery: 'excluded',
    owner: 'M127 · sessionBundle.ts',
    retention: 'discarded when the session ends',
    reason: 'a credential on disk for a session that is over. An archive carrying one is an archive carrying a key'
  }
]

/**
 * Every category the estate has, with nothing silently absent.
 *
 * Computed against `TABLE_SCOPE` for the same reason `declaredCoverage` is: a
 * table added tomorrow must break this rather than quietly become an omission.
 */
export function archiveInventory(): ArchiveCategory[] {
  const tables = Object.keys(TABLE_SCOPE).map((name): ArchiveCategory => {
    if (name in CARRIED)
      return {
        name,
        kind: 'table',
        recovery: 'archive',
        owner: 'ADR-0014 · the journal',
        retention: 'for the life of the estate',
        reason: CARRIED[name]
      }
    if (name in EXCLUDED)
      return {
        name,
        kind: 'table',
        recovery: 'excluded',
        owner: name in PRIVATE_CEO_PRIMARY ? 'ADR-0075 · private CEO content' : 'the plane that writes it',
        retention: name in PRIVATE_CEO_PRIMARY ? 'owner retention policy; not a rebuildable projection' : name === 'estate_restore_boundaries' ? 'for the life of the restored estate; retained across rebuild' : 'live, or machine-local',
        reason: EXCLUDED[name]
      }
    return {
      name,
      kind: 'table',
      recovery: 'journal',
      owner: 'the projector',
      retention: 'rebuilt on demand',
      reason: 'a projection. Replaying the archived journal reproduces it exactly, and a second copy in the archive could disagree with the record it came from'
    }
  })
  return [...tables, ...DISK].sort((a, b) => a.name.localeCompare(b.name))
}

/** The categories a restore will NOT bring back, for the screen beside Restore. */
export function notRestored(): ArchiveCategory[] {
  return archiveInventory().filter((c) => c.recovery === 'excluded')
}

export interface ArchiveManifest {
  schema: typeof ARCHIVE_SCHEMA
  /** The estate this was taken FROM. A restore never writes back into it. */
  sourceEstateId: string
  takenAtUtc: string
  /** The journal seq this archive is consistent AS OF. Everything derived is
   *  reproducible by replaying up to here and no further. */
  watermarkSeq: number
  eventCount: number
  /** Over the journal bytes AND the identity above, so a body swapped between
   *  two archives of two estates is caught rather than replayed. */
  digest: string
}

export type ArchiveProblem =
  | 'unreadable'
  | 'wrong_schema'
  | 'incomplete'
  | 'truncated'
  | 'corrupt'

export type ArchiveRead =
  | { ok: true; manifest: ArchiveManifest }
  | { ok: false; why: ArchiveProblem; says: string }

const REQUIRED: (keyof ArchiveManifest)[] = [
  'schema',
  'sourceEstateId',
  'takenAtUtc',
  'watermarkSeq',
  'eventCount',
  'digest'
]

/** What the digest is taken over. One definition, so the writer and the reader
 *  cannot disagree about what was signed. */
export function digestInput(manifest: {
  sourceEstateId: string
  watermarkSeq: number
  eventCount: number
}): string {
  return `${ARCHIVE_SCHEMA}\0${manifest.sourceEstateId}\0${manifest.watermarkSeq}\0${manifest.eventCount}\0`
}

/**
 * Read an archive, refusing anything that cannot be restored from.
 *
 * Every refusal happens BEFORE a restore touches anything, which is the point:
 * a corrupt archive must leave the working estate exactly as it was, and the way
 * to guarantee that is to never begin.
 */
export function readArchive(
  raw: unknown,
  body: { lines: number; digest: string }
): ArchiveRead {
  if (!raw || typeof raw !== 'object')
    return { ok: false, why: 'unreadable', says: 'the archive manifest is not an object' }
  const m = raw as Record<string, unknown>
  if (m.schema !== ARCHIVE_SCHEMA)
    return {
      ok: false,
      why: 'wrong_schema',
      says: `the archive says ${String(m.schema)}, and this build restores ${ARCHIVE_SCHEMA}`
    }
  const missing = REQUIRED.filter((k) => m[k] === undefined || m[k] === null)
  if (missing.length)
    return {
      ok: false,
      why: 'incomplete',
      says: `the manifest is missing ${missing.join(', ')} — a partial manifest describes a partial archive`
    }
  if (!Number.isInteger(m.eventCount) || (m.eventCount as number) < 0)
    return { ok: false, why: 'incomplete', says: 'the manifest does not say how many events it holds' }

  // TRUNCATION IS ITS OWN ANSWER. A short file with a correct-looking manifest is
  // the failure a digest alone reports as corruption, and the two want different
  // sentences: one says the copy was interrupted, the other that it was altered.
  if (body.lines !== m.eventCount)
    return {
      ok: false,
      why: 'truncated',
      says: `the manifest claims ${m.eventCount} events and the archive holds ${body.lines}. The copy did not finish`
    }
  if (body.digest !== m.digest)
    return {
      ok: false,
      why: 'corrupt',
      says: 'the archive does not match its own digest, so something changed after it was written'
    }
  return { ok: true, manifest: raw as ArchiveManifest }
}
