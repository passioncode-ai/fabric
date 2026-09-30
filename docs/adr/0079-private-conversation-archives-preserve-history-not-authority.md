# ADR-0079 — Private conversation archives preserve history, not authority

**Status:** accepted architecture for the authorized R0 implementation; format and SQL/native implementation remain separately gated.
**Date:** 2026-09-27. **Extends:** ADR-0075 and ADR-0077. Refines the destination-authority proposal in [restore authority](../launch/harness-r0/restore-authority.md#native-compatibility-follow-up--2026-09-27).

## Decision

1. Accept `CeoPrivateArchive@1` as a separate, explicitly private owner companion
   to the unchanged ordinary `FabricArchive@1`. The [format and recovery contract](../launch/harness-r0/ceo-private-archive.md)
   owns its exact fields, order, byte limits, completeness checks and negative
   corpus. It is not silently included in an Estate/team export. One current
   Person can export/import their own private data; owning the Estate confers no
   right to another Person's discussion.
2. Restore an ordinary archive into a **different fresh Estate** through a new
   atomic wrapper authorized by the current owner of an independently established
   control Estate. Trusted main derives that Person and held control-Estate
   revision. SQL rechecks owner role/revision with a membership row lock and
   deterministic Estate locks; creates the destination shell and fresh same-Person
   ownership; records the protected boundary before archived projection; verifies
   the resulting prefix and destination access. Any failure rolls all of this
   back. A missing membership is never a request to create one. Archive authors,
   labels and emails confer no authority.
3. The operation binds control Estate, Person/revision, fresh target, original
   manifest/raw journal digest, name and stable operation ID. Exact retry requires
   current control-Estate owner authority and returns the same receipt; a changed
   request conflicts. Timeout/receipt-not-found never authorizes a newly minted
   operation or another target. Independent destination selection/restart wiring
   is required before a successful low-level restore is shown as a usable workspace.
4. Private import requires that verified ordinary restore and fresh current target
   membership for the archive's exact Person. Other Persons can independently
   import their companions against the same unchanged prefix. Import inserts only
   immutable historical content, provenance and historical operation receipts:
   no pending requests, leases, sessions, grants, model work or automatic dispatch.
   Existing primary collisions refuse with rollback; IDs are not remapped.
5. Freeze UTF-8 byte-length framing and JS/SQL golden vectors before implementing
   SQL commands. Preserve original supported-version envelopes verbatim; historical
   validation and encoding must not invoke today's text sanitizer or silently
   rewrite a source digest. A→B→C recomputes target-bound digests and retains the
   original provenance. Unsupported preparation/source-schema versions refuse.
   The initial implementation supports source schema 66 only; admission of later
   schemas requires explicit qualification.
6. Whole-file v1 limits: raw private file and compact decoded private JSON at most
   8 MiB; ordinary raw journal at most 32 MiB, 65536 events, 1 MiB per line,
   depth 32 and 1000000 total JSON nodes. Private inventory caps remain 256
   conversations/4096 messages/8192 operations. Duplicate keys, invalid Unicode,
   ambiguous order, invalid IDs, unsafe numbers, incomplete bodies and unknown
   fields refuse. Canonical positive decimal journal sequence strings remain
   supported alongside safe integer numbers, as required by the existing
   node-postgres consumer. No partial import or silent truncation.
7. `retention: no-deletion-v1` and empty tombstones describe the present immutable
   store. Missing content refuses; absence is not an erasure receipt. Future
   deletion/retention requires a versioned supported writer before activation.
   Unsigned hashes prove integrity of the supplied inventory, not authorship,
   original wording, missing non-journalled aliases or erasure across old offline
   backups. Imported private history must not be interpreted as new authority.

## Evidence and alternatives

At [34dd994](https://github.com/passioncode-ai/fabric/commit/34dd994ba9b4ce6c51bdd9a451b86275ee57f582),
A0/65 suppresses archival owner assignment on restore and replay, with actual
PostgreSQL receipts in [checks](../launch/harness-r0/checks.md#restore-boundary-and-native-pty--2026-09-27).
`backup.restore()` only reports journal restoration; the native bootstrap remains
ORG 1-scoped. The [source review](../launch/harness-r0/restore-authority.md#native-compatibility-follow-up--2026-09-27)
shows why a destination can be restored yet unavailable to the operator.

A preparatory destination-owner command would leave an intermediate shell requiring
separate recovery/disposal. A first-install exception based on archive identity or
failed membership would weaken ADR-0077. The atomic current-control-owner wrapper
uses existing current authority and leaves no partial destination on failure.
The control Estate is an authorization prerequisite, not a second private-content
store or an assertion of external authentication. Existing single-operator identity
remains explicitly single-operator.

## Delivery and consequences

Migration `20260927000066_ceo_private_archive.sql` is allocated for A1; it is not
applied by this record. Applied migrations 64/65 remain unchanged. The runtime
schema contract stays 65 until the complete 66 chain/readers/actual SQL checks pass.

**Delivery, 2026-09-28.** Migration 66 is written and the runtime schema contract admits 66–66:
the codec (A1-1), the verified restore wrapper (A1-3), private export, import and receipt (A1-4)
and the inventories (A1-5), with actual PostgreSQL receipts in
[checks](../launch/harness-r0/checks.md#owner-private-archive-sql--2026-09-28). Decisions 2–6 are
implemented in SQL; native file handling, IPC, active-Estate selection and restart (decision 3's
last sentence) remain for A1-6, so no private recovery is yet reachable from the app.
Unexecuted pipeline reservations move to 67/68 and ADR-0080. Agent-sync returned
ADR-0079 for key `private-archive-contract-20260927`, ADR-0080 for key
`pipeline-reservation-after-private-archive-20260927`, run `r-1d9cd5615`.

Affected homes: [private archive](../launch/harness-r0/ceo-private-archive.md),
[development](../launch/harness-r0/development.md), [release admission](../launch/harness-r0/release-admission.md),
[checks](../launch/harness-r0/checks.md), protected scope/mirror/archive inventories
when SQL is integrated, and the scenario/flow/screen chain before product activation.
No meaning of Project, Person, TaskRun or membership changes. CO-168 remains open.

Acceptance requires actual separate source/destination PostgreSQL databases,
revocation/concurrency/rollback/lost-reply cases, multiple private owners,
A→B→C provenance, complete history through the actual conversation service,
zero restored executable work, and native file/IPC/UI authority checks. A parser,
golden vector, checksum or successful source test alone cannot close this capability.
No production database, private export or native provider is activated by this ADR.
