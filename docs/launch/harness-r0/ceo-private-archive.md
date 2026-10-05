<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# Owner-private portable archive · proposed CW-N1a contract

**Status (2026-09-28): implemented in SQL, the native codec and the app; sources 66 and 67
admitted.** The codec is frozen ([A1-1](#native-codec--frozen-2026-09-28-a1-1)); migration 66
carries the verified restore wrapper, private export, import and receipt ([SQL · as built](#sql--as-built-2026-09-28-a12a15));
the app's native files, IPC and screens followed in first-slice plan A1-6. Migration 67 qualifies schema
67 as a source (ADR-0079 decision 5): it changes no archived table, an export names the schema it
was taken from, and import accepts 66 and 67 and refuses any other — `ceoPrivateArchive.ts#PRIVATE_ARCHIVE_LIMITS`,
`ceo-private-archive-codec.test.mjs`, `private-history-db.test.mjs`. A real app run and cold restart remain
first-slice plan C5 and N1.

## Objective and source ledger

Recover the held Person's complete private CEO conversation history into a **new
Estate in a clean destination database**, alongside its ordinary Estate archive.
Preserve subjects, message order, original input and provenance. Do not recreate
an executable request, imported membership, local offline intent or provider
session. This supports the [vision](../../ux/vision.md): durable Project history
survives changing machine/provider without importing authority.

Read at source [`b18b337caebac2963d5289fec6a3ccfff42aa73f`](https://github.com/passioncode-ai/fabric/tree/b18b337caebac2963d5289fec6a3ccfff42aa73f):

| Existing source | Constraint it establishes |
| --- | --- |
| [ADR-0075](../../adr/0075-private-ceo-content-and-opaque-journal-receipts.md), decisions 2–7 | Protected primary content, opaque public receipts, same owner, backup before activation, no replay-created dispatch or deleted content. |
| [Migration56](../../../supabase/migrations/20260910000056_restore_estate.sql), `restore_estate` | Source and target must differ; target journal must be empty. Original sequence/entity IDs survive. Global projection-ID collisions can make restoring beside the source fail; failure rolls back. No durable source→target restore receipt is currently stored. |
| [Migration64](../../../supabase/migrations/20260927000064_private_ceo_conversations.sql), tables and `ceo_primary_immutable` | Conversation/message/content IDs are global. Primary body/message/operation rows cannot update/delete through ordinary commands. No supported content-deletion/tombstone writer exists. |
| Same migration, `ceo_open_conversation` | Opening an existing subject can add a new operation alias **without a new journal event**; its receipt points to the original opening sequence. |
| Same migration, `ceo_send_canonical`, `ceo_send_message` | Canonical digest includes Estate and Person. Send atomically stores primary content, operation receipt and a pending request. A historical repeat returns before mutable subject checks. |
| Same migration, `apply_ceo_receipt` | Journal replay rebuilds opaque references only; it cannot recover private ownership, body, idempotency or pending requests. |
| [Archive contract](../../../apps/desktop/src/shared/archive.ts), `PRIMARY`/`EXCLUDED` and `digestInput` | Private bodies/ownership/operations are excluded; pending authority is not portable. `FabricArchive@1` digest covers source Estate/watermark/count plus original journal bytes. |
| [Native backup](../../../apps/desktop/src/main/backup.ts), `lineOf`, `take`, `restore` | Ordinary archive consists of `manifest.json` and `journal.ndjson`. The manifest derives its watermark from the actual read. Native restore verifies first and calls migration56; this is not private recovery. |
| [Migration58](../../../supabase/migrations/20260910000058_subject_resolution.sql), `apply_estate_and_projects` | Replaying `estate.created@1` can insert an owner membership from payload for an existing Person. A private recovery wrapper needs an explicit restore/replay authority fence, not an assumption that ordinary replay has no authority effects. |
| [Identity boundary](../../../apps/desktop/src/main/identity.ts) and migration64 `ceo_authorized` | Native code derives held identity; SQL rechecks exact current membership revision under Estate lock. Archive knowledge alone is not identity. |

Root's **“Portable recovery · next contract review”** is now committed at
[`193d9f57f74c5ce756b8d62b20878a82da716d33`](https://github.com/passioncode-ai/fabric/blob/193d9f57f74c5ce756b8d62b20878a82da716d33/docs/launch/harness-r0/ceo-conversations.md).
Its requirements were checked against those committed bytes on 2026-09-27. Service source
[`85b78459684ce9b3185c7303e9e9b446698cbd7d`](https://github.com/passioncode-ai/fabric/commit/85b78459684ce9b3185c7303e9e9b446698cbd7d)
is an independent prerequisite for later native/IPC integration; it is not copied
or changed in this worktree.

## Decisions proposed for review

1. Keep the ordinary archive unchanged. Add a separately labelled private companion
   `ceo-private.json`, containing only the current verified owner's protected data.
   It must never be written into an ordinary shared Estate export automatically.
2. Add an identity-checked **verified restore wrapper** sharing a bounded internal restore body with migration56’s legacy entry point. It
   records exact source→target/archive binding atomically with ordinary restore.
   Private import later requires that durable receipt. A renderer assertion or
   matching-looking projection is insufficient.
3. Export one bounded snapshot in one SQL transaction; import all protected rows
   in one transaction. No chunked partially restored conversations in v1. Oversize
   refuses explicitly before private writes; it does not silently truncate.
4. Copy immutable original envelopes unchanged. Validate source digests, then
   derive new target-Estate digests and idempotency receipts. Record original and
   immediate-source provenance in a protected table, never in a public journal.
5. Recreate **historical** send/open idempotency only, never pending requests.
   `accepted_pending` remains the existing saved-message receipt vocabulary with
   `dispatch: unavailable`; it is not a promise of a restored queue.
6. V1 has an explicit `retention: "no-deletion-v1"`, empty tombstone inventory and
   complete bodies. Unknown/missing/deleted content refuses export/import; do not
   fabricate a tombstone from absence. Any future supported retention writer must
   version/extend this contract before activation with it.

The last choice is deliberately bounded to migration64's immutable store. A fresh
machine cannot learn that somebody deleted data **after** an older backup was
made, without a separately available newer tombstone authority. This proposal
makes no erasure-across-offline-backups claim. A target with existing private data or retention state **for that Person**,
or an earlier different import for that Person, is never merged or repaired by v1.
Other verified Persons may independently import their own companion against the
same ordinary restored prefix; no operator gains access to another’s private data.

## Snapshot consistency and completeness

Native export first verifies an ordinary `FabricArchive@1` directory. It passes
that exact manifest and **original bounded journal bytes** to the dedicated export
RPC, not a caller-computed `complete: true` flag. SQL verifies their existing raw
digest and compares every archived event to the source journal under the source
Estate advisory lock (salt 4242). Comparison uses typed row fields and JSONB
semantic equality for actor/payload, not renderer JSON property order.

At export, the source's current maximum sequence must equal the manifest watermark;
count and every journal row must match. If writers have advanced, refuse
`archive_stale` and take a fresh ordinary archive. This is a scoped R0 choice;
historical exports require a later temporal-operation contract. Events ordered by
`seq` must be unique, strictly increasing, positive safe integers. Do not infer
completeness merely from `max(seq)` or assume a gap is always a valid omission.
Equality with the complete actual source set establishes the export prefix.

With that lock held, capture all owner conversations, all their ordered messages,
all matching content and **all owner open/send operation aliases** visible in the
transaction. Check complete one-to-one receipt relations. Ordinary writer commands
use the same Estate lock; no export page can drift between queries.

Open aliases have no independent journal sequence in migration64. Consequently:

- Watermark bounds messages/public receipts; it does not uniquely timestamp every
  operation alias or prove a global source snapshot by itself.
- The private export snapshot is the full state observed by this transaction at
  that watermark. Two valid exports at the same watermark may contain different
  later-created open aliases. They receive different archive IDs/digests.
- Do not backdate aliases using their conversation's `created_seq` or silently
  exclude them from the promised idempotency inventory.

An export is read-only and needs no durable export operation: losing its reply
permits a new export with a newly minted archive ID. It never promises the exact
same snapshot for a reused export call. Import, which writes state, has a separate
stable operation ID and durable recovery receipt.

Completeness checks include: every owner conversation has its exact opened journal
receipt and subject binding; each ordinal 1…revision has exactly one message and
one body; every message has matching accepted receipt IDs/actor/sequence and one
send operation; all send operations refer to these messages; all open aliases
resolve the same owner/subject; no foreign-owner row or executable request is in
the companion. The exporter separately scans all CEO receipts attributed to this
Person in the prefix and requires complete coverage, mapping literal `operator`
only to migration58's exact local Person. Opaque payload IDs do not establish
ownership on their own.

The exporter can prove it captured its complete primary snapshot under lock. The
importer cannot independently prove a missing **open alias** from public events,
because that alias never had its own event. Import validates all provided framed
inventory, counts, internal relations and public message/opening coverage. An
unchanged digest detects accidental removal from that inventory; a person who
rewrites the inventory and recomputes an unsigned digest can change such aliases.
Do not call checksum validation cryptographic proof of complete source history.
The same limitation applies to proving original private wording: the shared
journal deliberately carries neither text nor its plaintext digest.

## Proposed exact portable format

UTF-8 JSON, no BOM, duplicate keys, NUL, invalid surrogate or non-finite/unsafe
numeric values. Strict known keys at every level. Pretty whitespace is allowed;
it does not affect the canonical companion digest. No arbitrary paths, output,
credentials, membership records, grants, local drafts or pending requests.

```ts
type CeoPrivateArchiveV1 = {
  schema: 'CeoPrivateArchive@1'
  archive_id: UUID
  source_schema_version: SafeInteger
  owner_person_id: UUID
  estate_archive: { // exact ordinary manifest; never retargeted in this file
    schema: 'FabricArchive@1'
    sourceEstateId: UUID
    takenAtUtc: UtcTimestamp
    watermarkSeq: SafeInteger
    eventCount: SafeInteger
    digest: Sha256
  }
  retention: 'no-deletion-v1'
  conversations: ConversationRecord[]
  messages: MessageRecord[]
  operations: OperationRecord[]
  tombstones: []
  archive_digest: Sha256
}
type ConversationRecord = {
  id: UUID; subject_kind: 'global' | 'project' | 'question'
  subject_id: UUID; owner_project_id: UUID | null
  created_seq: SafeInteger; revision: SafeInteger
}
type MessageRecord = {
  id: UUID; conversation_id: UUID; ordinal: SafeInteger
  content_id: UUID; request_id: UUID; accepted_seq: SafeInteger
  envelope: CeoSendV1 // exact prepared original input, not transformed on import
  source_digest: Sha256 // canonical(source Estate, same Person, envelope)
  origin: { estate_id: UUID; canonical_digest: Sha256 }
}
type OperationRecord =
  | { operation_id: UUID; kind: 'send'; message_id: UUID }
  | { operation_id: UUID; kind: 'open'; requested_conversation_id: UUID
      subject_kind: 'global' | 'project' | 'question'; subject_id: UUID
      receipt: { conversation_id: UUID; revision: SafeInteger; receipt_seq: SafeInteger } }
```

Conversation order: bytewise UUID ascending. Message order: conversation UUID then
ordinal ascending. Operation order: operation UUID ascending. Unknown subtype,
wrong order, duplicate IDs, duplicate subject identity or duplicate ordinal refuses;
normalization does not silently discard or reorder an ambiguous archive.

The exporter must validate existing operation `intent`/`receipt` bytes against
these typed records. It does not export arbitrary `intent` text as trusted SQL.
Open aliases retain their **requested** conversation ID, which can differ from
canonical conversation ID for an already-existing Project/question conversation.
Their historical receipt revision is preserved and bounded by snapshot revision.
Send receipt is reconstructed from the validated message and original opaque
journal receipt. Original `repeated` call metadata is not archived; recovered
lookup returns `repeated: true` without manufacturing a new acceptance event.

For a first export, `origin` is source Estate plus `source_digest`. After restore
A→B and later export B→C, `source_digest` is B-bound while origin remains A-bound.
Recompute both from the unchanged envelope to verify them. This is retained
provenance, not an attestation of external authorship or a complete intermediate
migration chain. The protected local import receipt records the immediate A→B or
B→C operation independently.

### Canonicalization and proposed bounds

Companion digest uses SHA-256 over fixed-order **UTF-8 byte-length-prefixed fields**,
reusing migration64 `ceo_frame` semantics (explicit null frame). Domain is
`CeoPrivateArchive@1`. Include all header fields except `archive_digest`, exact
ordinary manifest fields in the order above, then each array length and each row's
fields in the order above. For an envelope include the entire
`ceo_send_canonical(sourceEstateId, ownerPersonId, envelope)` as one framed field;
include both provenance fields separately. Empty tombstone count is included.
No raw JSON.stringify/object-order hashing and no private digest in public events.
Freeze JS/SQL golden vectors before implementation, including Unicode, newlines,
empty arrays, null owner Project, open aliases and A→B→C provenance.

The ordinary archive digest keeps its **existing** algorithm: UTF-8
`FabricArchive@1`, NUL, source Estate, NUL, watermark, NUL, event count, NUL, then
journal lines joined with LF without the final LF. SQL must construct the header
as `bytea` (PostgreSQL text cannot contain NUL). Validate original byte sequence
before JSON parsing. Accepted files are either empty body for zero events or
nonempty LF-separated rows with exactly one final LF, as emitted by `take`.
CRLF/BOM/blank extra rows refuse; do not quietly repair an edited archive.

Proposed initial admission limits, **not measured capacity**:

| Input | Limit |
| --- | --- |
| Ordinary journal text | 32 MiB, at most 65,536 events; one line at most 1 MiB |
| Private companion compact decoded bytes | 8 MiB |
| Conversations / messages / operations | 256 / 4,096 / 8,192 |
| Envelope and text | Existing CeoSend wire 65,536 bytes / body 32,768 bytes |
| Ordinary JSON payload | Depth 32; explicit global node budget during preflight |
| Companion shape | Closed typed nesting, no arbitrary recursive metadata |
| Numeric identity/order/revision | 0…Number.MAX_SAFE_INTEGER, positive where required |
| Native concurrent recovery | One private recovery per `(target Estate, Person)`; SQL Estate lock serializes imports |

The ordinary journal node budget must be frozen and load-tested in packet A; start
with 1,000,000 total primitive/container nodes, deny before recursive validators
or SQL writes. Native transport/file byte limits apply **before parsing**; SQL
also rejects oversized raw text/JSONB parameters. A SQL function cannot undo the
HTTP server's prior JSON parse: configure and qualify request-body admission as a
separate native/transport prerequisite. These caps limit whole-archive v1; no
silent subset export is labelled complete. Larger history requires a reviewed
staged export/import protocol, not bumping a number without a load receipt.

## Native codec · frozen 2026-09-28 (A1-1)

[`ceoPrivateArchive.ts`](../../../apps/desktop/src/main/ceoPrivateArchive.ts) admits a companion
(`decodePrivateArchive`) and preflights the ordinary archive beside it
(`preflightOrdinaryArchive`); [`archiveJson.ts`](../../../apps/desktop/src/main/archiveJson.ts)
is the bounded JSON reader both use. The draft preserved at `archive/wip/ceo-private-archive-codec`
was restored with four decisions from the [plan](../../evidence/plans/2026-09-27-first-slice-plan.md#decisions):

1. No project-context rule: a project conversation may carry `mode:'none'`, as migration 64 accepts.
2. Companion and manifest sequence numbers are safe integers; a decimal string is allowed only for
   the ordinary journal's `seq`.
3. The companion's numbers are canonical safe integers: `1.0`, `1e0`, `-0` and `01` refuse.
   Journal payload numbers are data and are accepted when they decode without loss.
4. One budget definition for JS and SQL: the root value is depth 1, every value is one node,
   object keys are not nodes (`JsonAdmission`).

**Reason codes**, one vocabulary for the codec and SQL (`ARCHIVE_REASON_CODES`): `invalid_json`,
`too_large`, `invalid_archive`, `integrity_mismatch`, `unsupported_schema`, `archive_stale`,
`idempotency_conflict`, `not_found`, `unavailable`. The codec itself produces the first five; the
rest belong to the SQL commands. A wrong archive, source-schema, envelope or preparation version is
`unsupported_schema`; a swapped owner fails its source digest and is `integrity_mismatch`.

**Frozen vectors** in [`test/fixtures/ceo-private-archive/`](../../../apps/desktop/test/fixtures/ceo-private-archive/):
seven companions (empty; global with null owner Project; project with an open alias; question;
Cyrillic, CJK, astral emoji, U+2028 and CRLF in text; A→B→C origin; project with `mode:'none'`) and
four ordinary archives (empty, one line, many lines, decimal-string `seq`). Each `*.expected.json`
holds the canonical string and SHA-256 the bytes must produce; A1-2 holds SQL to the same files.
The first freeze took its expectations from the codec; the empty vector is also framed by hand in
[the codec test](../../../apps/desktop/test/ceo-private-archive-codec.test.mjs), and the envelope
canonical reproduces the SQL-produced `dffdd4f0…` vector of `ceo-conversation-db.test.mjs`.

**Not proven here:** SQL parity (A1-2), any database, native file handling, and authenticity —
an unkeyed digest detects a change, it does not identify who made it.

## SQL · as built 2026-09-28 (A1-2…A1-5)

[Migration 66](../../../supabase/migrations/20260927000066_ceo_private_archive.sql) implements the RPCs
below with these differences from the proposal, each decided in the
[first-slice plan](../../evidence/plans/2026-09-27-first-slice-plan.md#a1-3--verified-restore-wrapper):

- `restore_estate_verified(p_control_estate, p_person_id, p_revision, p_actor, p_operation_id,
  p_target_estate, p_estate_manifest, p_journal_ndjson, p_name)` follows ADR-0079 §2 rather than the
  earlier signature: the caller owns an independently established **control** Estate; the wrapper
  creates the target shell and the same Person's ownership itself. The request digest binds
  control, Person, target, operation, name and manifest; revision and actor are checked, not bound.
- Every refusal is `{ok:false, reason_code}` from `ARCHIVE_REASON_CODES`. A collision or a failed
  landing check is `unavailable`, never quoted.
- A private import receipt references its boundary with `restore_mode = 'verified'` in the foreign
  key, so a legacy boundary cannot carry an import.
- The companion reaches SQL as `jsonb`, after the codec: duplicate keys and spellings such as `1e0`
  are the codec's to refuse, and a too-deep envelope is `invalid_archive` in SQL where the codec says
  `too_large`.
- Question conversations are checked by the codec vectors and the import's subject rule; the DB
  suite writes global and project history only.

Receipts: [verification A1-2…A1-5](../../evidence/verification.md#a1-2a1-5--migration-66-verified-restore-private-export-and-import).

## SQL authority and proposed RPCs

All RPCs: `SECURITY DEFINER SET search_path=public`, service-role execute only;
helpers/tables revoked from public/anon/authenticated/service_role direct access.
Native derives Person/current held revision and Person actor; archive supplies
neither identity nor a membership. SQL locks Estate first and rechecks membership. The ordinary Estate restore
wrapper additionally requires `memberships.role = 'owner'` at the held revision
under lock; the current schema has only `owner`/`member`, not an invented admin
role. Companion export/import requires membership plus ownership of that Person's
private data, never Estate-owner privilege over somebody else's body.
Service role remains a trusted host capability, not proof of a Person by itself.
Returns use fixed reason codes with no body, digest, subject, path or raw SQL error.

### Export

```text
ceo_export_private_archive(
  p_estate_id uuid, p_person_id uuid, p_revision bigint,
  p_estate_manifest jsonb, p_journal_ndjson text
) -> {ok:true, archive:CeoPrivateArchiveV1}
  | {ok:false, reason_code}
```

Read-only source operation. Require current authority even on an empty owner
snapshot. Verify exact ordinary archive as above, capture protected complete
snapshot, generate archive ID, compute companion digest, return only to caller.
Do not write a public export journal event containing the owner or archive digest.

### Establish source→target restore provenance

```text
restore_estate_verified(
  p_target_estate uuid, p_person_id uuid, p_revision bigint, p_actor jsonb,
  p_operation_id uuid, p_estate_manifest jsonb, p_journal_ndjson text,
  p_name text
) -> {ok:true, operation_id, source_estate_id, target_estate_id,
       watermark_seq, event_count, state:'estate_restored', repeated:boolean}
  | {ok:false, reason_code}
```

This new wrapper verifies manifest/raw digest/bounds and invokes the shared
internal restore operation in the **same transaction**. A trusted durable restore
boundary is inserted **before any archived event reaches projection**; the final
verified result is visible only if the whole restore commits. Target has independently created Estate shell and a current **owner** membership
for the verified caller, but no domain journal or prior restore binding. This
caller authors the ordinary restore operation; they need not be the owner of
every later private companion.
Migration56 already allows the empty Estate row to exist. Account/bootstrap flow
must establish this authority without importing Person/membership rows from files.
No matching by email, label or display name. Each later private import separately
requires the archive owner to equal its currently verified calling Person; knowing
the global restore operation ID never grants access to a companion.

Use target Estate lock 4242. Store canonical immutable request identity before
return; exact repeat after current authorization returns original receipt even
though target journal is no longer empty. Changed same operation, reused target
with another archive or partial preexisting history refuses. If migration56 raises
or any postcondition fails, wrapper transaction rolls back restore and receipt.
No source database access is required for disaster recovery. Importing an archive
is an explicit owner action; unkeyed hashes provide integrity, not authenticity.
The wrapper receipt proves this local restore operation validated and inserted
these bytes. It does not authenticate their original author or external provenance.

### Mandatory prerequisite: restore cannot recreate membership

Migration58's `estate.created@1` owner assignment is retained by the latest
[projector in migration59](../../../supabase/migrations/20260910000059_project_configured.sql). It inserts an owner from archived payload
when that Person exists. Calling migration56 unchanged therefore does **not** meet
“archive never recreates authority.” A before/after membership comparison alone
also fails: a later rebuild could re-add a removed membership from the old event.

Before private archive SQL, implement and independently qualify a bounded shared
restore boundary for **both** legacy `restore_estate` and the verified wrapper:

- A protected, durable target/source/watermark marker is created transactionally
  before the first archived event is inserted/projected. It is written only by a
  trusted internal restore helper, with direct table/helper access revoked. No
  mutable session GUC, renderer flag or ordinary journal event can mint it.
- `apply_estate_and_projects` must suppress archival owner-assignment for the
  exact marked target/restored `estate.created@1` sequence on initial projection
  **and every subsequent rebuild**. Do not alter original archived journal bytes.
  Preserve independently established memberships and verify no archive-induced
  membership delta. The guard is not a general ban on normal fresh Estate
  creation: trusted fresh bootstrap remains owner-producing.
- Legacy restore creates `mode: legacy_unverified`; it preserves its service-only
  compatibility boundary but gains no claim of Person authorization, verified
  archive digest, private restore eligibility or automatically created owner.
  A target with no independent owner remains unavailable for application use until
  separately authorized bootstrap establishes one. Do not claim its old path
  already excluded authority; prove the repair with actual regression tests.
- Verified restore requires current target owner at the held revision and creates
  `mode: verified`. Only this mode qualifies companion imports. The shared helper
  cannot upgrade a committed legacy marker based on a supplied checksum or a
  renderer assertion; a private recovery uses a newly verified restore target.
- Any failure rolls back marker, projections and journal together. A committed
  boundary is immutable and not ordinary journal-rebuild data. No future replay
  may infer a new grant from an old owner assignment.

The proposed `estate_restore_boundaries` table below generalizes the previously
named CEO restore receipt; no second marker table is required. Exact helper code
and narrow projector seam require review. This document requires review of a narrow change rather than a
blind replacement of the whole projector or rewriting applied migration58.

Postconditions compare **every** restored journal row to the supplied typed
originals; check all conversation-related Project/question identities against the
prefix, not just migration56's Project count. Record source manifest digest and
verified source prefix facts in protected `estate_restore_boundaries`.
Before marker insertion, derive the expected local `CeoRestoredPrefix@1` SHA-256
fingerprint from validated typed archive rows, in sequence order, with fixed
framed row fields, PostgreSQL JSONB text for actor/payload and UTC-microsecond
timestamps. Store that expected fingerprint in the immutable marker; after
projection, independently recompute it over actual restored rows and require
equality before commit. Thus no successful receipt needs an immutable-row update.
Source Estate/target Estate columns are excluded from that row fingerprint and separately bound in the protected
receipt. Expected fingerprint computation follows raw archive digest validation;
actual row/fingerprint equality must pass before commit. This local SQL fingerprint
is not an alternate portable archive encoding. Import recomputes it in the same supported SQL/schema contract to detect target changes.
A schema/runtime change which cannot reproduce it refuses; never waive the check.
A journal-only restore done through the legacy RPC has only an unverified
boundary, not a qualifying verified receipt; v1 private import refuses it. The
native private recovery flow must use the new wrapper. Legacy callers retain their entry point, but the no-imported-membership guarantee requires the
explicit A0 repair for that path too; this behavior change must be documented.

### Import / receipt recovery

```text
ceo_import_private_archive(
  p_target_estate uuid, p_person_id uuid, p_revision bigint, p_actor jsonb,
  p_operation_id uuid, p_restore_operation_id uuid,
  p_archive jsonb
) -> {ok:true, operation_id, restore_operation_id, archive_id,
       source_estate_id, target_estate_id,
       conversations:int, messages:int, operations:int,
       state:'history_restored', dispatch:'unavailable', repeated:boolean}
  | {ok:false, reason_code}

ceo_private_import_receipt(
  p_target_estate uuid, p_person_id uuid, p_revision bigint,
  p_operation_id uuid
) -> same original import receipt with repeated:true
  | {ok:false, reason_code:'not_found'|'unavailable'}
```

First check current target authority and exact Person equality with archive owner;
then parse bounded closed shape and canonical archive digest. Under the target
Estate lock, identical import operation returns its original receipt before
mutable target-state checks. A different digest/restore binding for the same
operation refuses `idempotency_conflict`. Unknown/lost import reply recovers this
receipt; an explicit retry uses the **same** immutable archive bytes and operation.
No new IDs on timeout or `not_found`. Invalid requests never yield private details.

For a first import, require the verified restore receipt's source Estate, manifest
digest, watermark and event count to equal the companion. The restore receipt's
author is **not** required to equal this companion's owner: current target
membership plus exact archive owner/Person identity and source-journal actor
coverage authorize this private import. The owner-only RPC resolves the matching
global binding internally; no reader exposes another Person's companion or import
receipt through the restore author. Require target journal to remain exactly that restored prefix; no intervening events, running
writers, changed subjects or newer acceptance. **No new imported receipt event is
appended**: original opaque events already exist. Protected import receipt is the
new recovery command's durable evidence, with no public body/owner/digest leak.

Reject private primary collisions, existing subject identities for the importing
Person, existing import/provenance/retention state for that Person or partial
earlier rows for them. Previously restored rows belonging to another Person are
left untouched; they do not by themselves block this owner’s independent import.
Global ID collisions still refuse rather than disclose or overwrite foreign rows.
Shared database entity IDs remain global; v1 does not remap Projects/conversations/messages into new IDs.
Expected destination is clean/fresh for this source, though other unrelated
Estates may exist. A conflict refuses with rollback; do not UPSERT around it.

## Import validation and write set

Validate the **whole** companion before any protected primary insert:

1. Source≠target, current target Person exactly equals archive owner, supported
   archive/source-schema version, byte/shape/count bounds and canonical digest.
2. Exact restored prefix and complete CEO receipts for that Person. `operator`
   maps only to the exact migration58 Person. Receipt IDs/seq/types/actors/schema
   match; no arbitrary actor in the companion can override the actual journal.
3. Conversation subjects exist in the target prefix and preserve owner Project.
   Archived Projects and answered questions can remain readable history. Do not
   require today's active configuration or rewrite historical subject revisions.
4. Per-conversation revision equals message count, ordinals contiguous from 1;
   IDs and public receipt relations are one-to-one. Context references belong to
   copied target Project identities; historical `estate_seq` does not exceed its
   acceptance or the restored watermark. No future sources introduced by import.
5. Every original envelope passes strict CeoSend validation **without preparing,
   trimming or changing its text**. Verify source digest, origin digest, IDs and
   expected_revision+1=ordinal. Target digest is newly derived from target Estate
   and unchanged Person/envelope. An archive with unsupported preparation version
   refuses, rather than re-sanitizing frozen historical input.
6. Typed open/send operations exactly cover expected history. Open aliases retain
   requested ID and historical receipt; send canonical intent is recomputed for
   target Estate. Immutable rows are created once, never patched on collision.
7. Empty tombstones and complete body inventory; all source receipt refs covered.
   Unknown retention markers, missing bodies or target retention blockers refuse.

Atomic inserts: `ceo_conversations`, `ceo_private_contents`, `ceo_messages`,
`ceo_operations`; plus new protected `ceo_content_provenance` and
`ceo_private_import_receipts`. Set conversation revision/created sequence from
validated history. Insert **zero** rows in `ceo_pending_requests`,
`ceo_write_authorizations`, session, grant, dispatch, work lease or local draft
stores. Original request IDs are historical references, not restored queue rows.

Provenance per content records target Estate/Person/content ID, original Estate and
original digest, immediate source Estate/source digest, archive ID/digest and
import operation. These records have the same dedicated-reader privacy boundary,
immutable inserts, no generic table read, no journal projector and no export of
service credentials. No foreign key may depend on a transient operational or
rebuildable projection row. The proposed keys and invariants below are required before packet-A SQL:


| New protected primary table | Proposed key, immutable content and collision rule |
| --- | --- |
| `estate_restore_boundaries` | PK `target_estate_id`; unique `(target_estate_id, operation_id)` for verified references. Immutable `mode` is `legacy_unverified` or `verified`; source Estate and restored watermark/event sequence binding always present before projection. Verified mode additionally requires author Person, operation ID, supported manifest, canonical request digest, prefix fingerprint and typed receipt; legacy mode never fabricates them. One restore boundary per target; author provenance grants no private-content audience. No raw body retained here. |
| `ceo_private_import_receipts` | PK `(target_estate_id, person_id, operation_id)`; unique `(target_estate_id, person_id)`. Composite FK `(target_estate_id, restore_operation_id)` to the global restore boundary; command must require its immutable mode `verified`. Store archive ID/digest, canonical request digest, source Estate, counts and original result. One complete import per Person/target, permitting multiple independent Persons; no same-Person incremental merge. |
| `ceo_content_provenance` | PK `content_id`. Add composite unique `(id, estate_id, person_id)` to `ceo_private_contents`; FK `(content_id, target_estate_id, person_id)` references that exact tuple. FK `(target_estate_id, person_id, import_operation_id)` references the exact private import receipt. Store source/origin facts above. Single-ID lookup plus procedural owner checking is insufficient; both references enforce Estate/Person in SQL. No foreign-source Estate or membership FK. |

All three are protected immutable primary records, explicitly inventoried and
excluded from ordinary Estate archives. Legacy boundary fields must have an
explicit null/unsupported schema; no fake UUID or empty checksum substitutes for
verified provenance. Re-export reads provenance through the
owner-authorized exporter and emits only the defined origin fields. Generic
projection replay cannot create these rows. Import may reuse existing private
write helpers only if they do not append acceptance or create pending rows;
calling `ceo_send_message` to reconstruct history is prohibited.

Ordinary projection rebuild may recreate only `ceo_receipt_refs`; it neither erases
nor creates imported primary/provenance/import receipt rows. Restored historical
same-op `ceo_send_message` returns its target-bound receipt without inserting a
pending request. A **new** explicit send after recovery still requires current
subject/context revision and creates a genuinely new operation under normal rules.
Future workers must consume authenticated pending rows, not infer work from
`ceo_operations` or old journal acceptance events.

## Replay, failure and privacy matrix

| Case | Required outcome |
| --- | --- |
| Export races with new send/event | Source Estate lock serializes; stale ordinary archive refuses, no clipped history. |
| Same W but a new open alias | New valid snapshot/archive ID; complete aliases, no invented sequence date. |
| Wrong Person/revoked membership | Refuse before private data; repeated import/read also requires current authority. |
| Body/inventory changed without matching digest, truncated bytes, missing message ordinal | Integrity/shape/receipt checks refuse with fixed code; all private writes roll back. |
| Owner recomputes unsigned digest after editing otherwise valid private wording/open aliases | Not cryptographically detectable as source tampering from opaque journal; explicit authorized import carries this provenance limit. Foreign Person/actor/ID collisions still refuse. |
| Wrong target or ordinary archive with similar CEO receipts | Verified restore binding and full exact prefix mismatch refuse. |
| Imported Project archived | History readable; import grants no execution or active Project status. |
| Existing source/global entity IDs or partial private target | Collision refusal; never remap/overwrite/merge silently. |
| Lost import reply | Receipt lookup then same-operation retry; one primary copy and one receipt. |
| Old import repeated after later sends | Exact original import receipt after auth, no row replay/overwrite. |
| Different import/archive after existing import for the same Person | Refuse; not a same-Person incremental importer. |
| A second current Person imports their own companion | Allow against the same verified global prefix; preserve the first Person’s content, deny cross-owner reads/import receipts. |
| Member attempts ordinary Estate restore | Refuse without writes: current target owner role is mandatory. |
| Replay/import of opaque journal alone | Private content remains unavailable and pending count remains zero. |
| Missing private body without supported tombstone | Incomplete, not a successful empty message or inferred deletion. |
| Backup predates later erasure in another database | Not discoverable offline from old bytes; no universal erasure claim. |

Native file writer must stage in a new owned private directory (0700), write the
companion 0600 with no symlink traversal, fsync/atomic rename, verify it, then mark
the private export complete. Never overwrite a user's existing archive by default.
On cancel or failure, remove only the newly owned incomplete staging directory
after closing its handles; never delete the original archive or another process’s
files. A failed private import leaves a valid ordinary restored Estate with private
content unavailable; SQL private writes/receipt roll back together. After a lost
reply, retain the caller’s archive and stable operation ID until receipt recovery;
file disposal must not erase the only retry source.
Temporary/export content is itself sensitive; omit text/digests/paths from public
ops logs and errors. Current `backup.ts` raw-error forwarding is **not** the error
policy for this private path. Encryption-at-rest/password archives are a separate
capability; mode0600 and an explicit private-content label do not mean encryption.

## Bounded implementation packets and acceptance

**A0 — restore authority prerequisite.** First test the source-inspected behavior on the actual full64
chain: archived `estate.created@1` appoints an existing foreign Person as owner;
after independently removing that membership, rebuild appoints them again. Then
qualify the narrow shared legacy/verified restore boundary and guarded projector:
no new membership on restore/rebuild, independent owner/member roles preserved,
normal trusted fresh bootstrap still works, raw append/direct table/helper writes
cannot forge a boundary, failure rolls back the boundary, and legacy marker never
qualifies private import. Root reserves an additive migration for this prerequisite
before implementation; the format document itself allocates none.

**A1 — format, verified wrapper and SQL recovery.** Root reserves the next reviewed
additive migration after A0, sharing the protected boundary contract. A0 took slot 65 under [ADR-0077](../../adr/0077-restored-history-does-not-grant-membership.md); A1 is migration
`20260927000066_ceo_private_archive.sql` (ADR-0079), admitted 66–66 on 2026-09-28 and 67–67 since
migration 67; the unexecuted pipeline reservations now sit at 68/69. Never modify applied
migration56/64 bytes. Add protected receipt/provenance tables and dedicated RPCs;
qualify service-only privileges, exact schema admission range and read/export
inventory changes through root. Freeze canonical golden vectors and all limits
before writing implementation. No provider/native model calls.

Use a disposable PostgreSQL source **and separate fresh destination database**,
full actual migration chain plus applied ledger and `schema_version()` receipts.
Acceptance matrix: target owner restores ordinary archive; owner and a second
current member independently import their respective companion, both remain
readable only by their own Person, reversed/concurrent order and lost replies;
non-owner ordinary restore refuses; current/revoked revisions; source→new target
same Person; source present collision; original/global/project/question subjects and
open aliases; concurrent write/export stale watermark; exact Unicode canonical
source/target/origin vectors; A→B→C round trip; archived Project; genuine SQL
message acceptance then missing pending rows after import; send repeat after import
still zero pending; only a new authorized send creates new pending; integrity
failures from edited bytes without a valid recomputed digest, plus explicit
unsigned-authenticity limitation fixtures (no claim that an owner-rehashed
well-formed private body is source-authenticated); truncated/foreign/malformed/
deep/oversize companion; composite FK negatives for foreign Estate/Person content
and import receipt; removed journal row; incorrect source
manifest; wrong target; partial collision; forced failure after the first insert
rolls back; simultaneous import and lost reply; projection rebuild before/after;
raw append/restore cannot forge protected restore/import receipts; no private
payload/hash/owner added to ordinary journal. Test no mutations on every rejection.

**B — trusted native file/RPC boundary and private recovery UX seam.** Integrate
named ports and real private filesystem with service identity, bounded whole-file
reads, preparation-version preservation, cancellation/timeout and stable operations.
Do not treat arbitrary file checksums as accepted SQL recovery. Actual SQL/native
composition must show cold restart/recovery of an unknown import, no raw diagnostic
leak, permission/symlink/partial-write failures and owner-only portable history.
Add renderer IPC only after the service/SQL boundary qualifies. Root owns scenario/
flow/screen changes and discoverable owner export/import labels.

**C — activation acceptance, not another storage redesign.** Run ordinary+private
backup on a synthetic owned multi-Person Estate, restore on a fresh DB and fresh local data
directory with independently established same-Person authority, and read through
the actual conversation service. Confirm every expected message and no executable
request. Native/UI acceptance must visibly distinguish **history restored; no
queued work** from queued delivery or a running agent. When a worker is later
introduced, preserved `accepted_pending` historical receipts must not trigger a
spinner, automatic worker replay or a claim of current execution; require actual
new pending/delivery evidence. Qualify R0 writer activation only after portable
recovery, IPC/private UI authority and current maintenance/schema gates pass. No backup label before
this end-to-end receipt exists.

Proposed future focused entry points (not existing commands, not executed):
`apps/desktop/test/run-ceo-private-archive-db.mjs`, a format golden-vector test and a
native private-archive composition test. Existing baseline commands remain
`node apps/desktop/test/run-ceo-conversation-db.mjs` and the tests around
`apps/desktop/src/shared/archive.ts`. Root owns integration fast/map/publication.

## This packet's verification and exact handoff

Read-only source inspection on 2026-09-27 established the constraints in the source
ledger. No SQL/private export/import/provider/database probe was executed for this
proposal. Document checks resolved **eight relative links and three commit objects**;
proposal/activation markers passed. Staged `git diff --cached --check` is the
whitespace gate recorded with this packet. This is a contract to review, not a
claim those proposed RPCs, limits or format have passed conformance.

Next root decision: accept/refine the verified-restore wrapper and transaction
snapshot semantics, the complete/no-deletion-v1 gate, target-bound historical
receipt behavior and proposed whole-file bounds. Then reserve the first prerequisite migration and
complete allocated packet A0 before private archive SQL. A same-Estate repair or plaintext owner field is not an equivalent
implementation of this portable contract.

Actual skills: task-pipeline — scope, prerequisite analysis and bounded delivery;
evidence-docs — source ledger, measured/proposed distinction and test obligations.
Routes read from repository `AGENTS.md`, `docs/AGENT_SYNC.md` and the installed skill
files. No guarded register or ADR was edited; no UI or visual design was changed.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**


## Schema-78 compatibility qualification — 2026-10-04

This dated qualification extends the native codec allowlist through schema count 78, produced by
migration filename suffix 80; it does not rewrite the earlier frozen codec snapshot. The explicit
66–78 allowlist and type are in `apps/desktop/src/main/ceoPrivateArchive.ts` symbol
`PRIVATE_ARCHIVE_LIMITS`. The next unqualified schema 79 refuses before digest admission.

`FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node apps/desktop/test/run-ceo-private-archive-db.mjs`
completed exit 0 on the I3 correction sources: current SQL export decodes natively, two owners
import without crossing private history, lost replies recover their original receipts, and native
main-process file handling roundtrips on an owned Unix-only cluster. The exact output is in
[the root I3 receipt](../../handoffs/hub-i3-ingress-archive-receipts/archive-green3.log).
The real running app and the operator database remain NOT_RUN. `ceo-private-archive-codec.test.mjs`
also preserves 77 acceptance and 79 refusal; removing 78 is caught by a recorded guard-removal patch.
