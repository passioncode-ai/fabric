<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# A0: restore authority boundary

This packet prevents **new legacy restores performed on schema65** from assigning
memberships through archived `estate.created@1` events. It does not implement the
private archive format, verified restore wrapper, private import/export, native
recovery UI or production migration rollout.

## Objective, source and allocation

The [portable private archive contract](ceo-private-archive.md) requires restoration
of history without restoration of authority. Inspection found that
[migration58](../../../supabase/migrations/20260910000058_subject_resolution.sql)
added an owner-producing `estate.created@1` projector arm, retained by the latest
concern projector in [migration59](../../../supabase/migrations/20260910000059_project_configured.sql).
[Migration56 restore](../../../supabase/migrations/20260910000056_restore_estate.sql)
calls that projector for archived events. Source baseline for this packet is
[`5c498ac`](https://github.com/passioncode-ai/fabric/commit/5c498ac).

Root allocated `20260927000065_restore_authority_boundary.sql` under its shared
lease before the file was written. Root moves the unexecuted pipeline reservations
and owns ADR, schema admission, archive/table inventory, shared registers and
publication. This packet does not apply a migration to a live database or change
`schemaContract.json`; readers must qualify exactly65 before rollout, not a floating
range admitting future66.

## Implementation

[Migration65](../../../supabase/migrations/20260927000065_restore_authority_boundary.sql)
adds immutable protected primary `estate_restore_boundaries`, recording:

- target and source Estate;
- `mode: legacy_unverified` (the only allowed mode here);
- archived event count and watermark;
- exact sequence numbers of archived `estate.created@1` events;
- boundary recording timestamp.

The legacy `restore_estate` entry point retains its four arguments and existing
success receipt shape. It delegates to a service-inaccessible internal restore
body. The internal body keeps migration56's new/empty-target checks and rollback
when global Project IDs collide, but inserts the durable marker **before the first
archived event is projected**. The marker and restored history commit/roll back
in one transaction. Event IDs, sequence numbers, payloads and actors are unchanged.
The internal helper is reusable by the later reviewed verified wrapper; no verified
wrapper or arbitrary verification-mode parameter is exposed now.

The concern projector's membership insertion is skipped only for a marker's exact
Estate and archived creation-event sequence. Other arms retain the latest59 bytes.
The focused test compares the whole concern function to migration59 after removing
only this added predicate/comment. There is no dynamic SQL source substitution in
the migration and no replacement of the global projection dispatcher.

The marker survives ordinary rebuild, so archived owner assignment remains
historical on every subsequent replay. Independently established owner/member
roles remain unchanged. Normal trusted fresh Estate creation still appoints its
owner; a caller's payload or mutable GUC cannot make a normal event a restore.
A later independent creation fact outside the marker's sequence set is not
silently classified as archival.

All table read/write privileges, including direct service-role writes, are revoked.
Internal helpers/projector are not exposed as service-role RPCs. Database-owner-level
update/delete of an existing marker also encounters its immutable trigger;
database administrators remain outside the application's security boundary.
An ordinary raw journal event cannot create or alter a marker. Existing generic
append accepts an unknown event type as an unprojected fact; this packet does not
claim such events are rejected or treat them as trusted restore evidence.

`read_estate_restore_boundary(estate, person, heldRevision)` is service-only and
checks current scoped membership/revision with the existing identity predicate:

| Observation | Result |
| --- | --- |
| Recorded new restore | `status: recorded`, `mode: legacy_unverified`, source/target, watermark, event/owner-event counts; `private_import: unavailable` |
| No reliable marker | `status: not_recorded`, `prior_restore: unknown`, `private_import: unavailable` |
| Missing/revoked/stale membership | `ok: false`, `reason_code: unavailable` |

This reader is not a renderer authentication implementation; a future native
consumer must derive identity itself. The legacy restore remains privileged
service-only and does not gain a Person-authorized/owner-authorized wrapper merely
by adding the marker. The future verified wrapper must separately enforce current
owner role and exact archive verification as specified in the portable contract.

## Compatibility and known historical limit

Applied migration56/58/59 bytes are not modified. Legitimate ordinary export rows
already have ascending positive integer sequences; new restores additionally
validate safe-integer/increasing sequence values before recording the marker.
Both JSON numbers and canonical positive decimal strings are accepted: PostgREST
returns numeric sequences, while node-postgres represents PostgreSQL bigint as a
string. Both normalize to the same exact bigint with a maximum of
`9007199254740991`. String whitespace, signs, leading zeros, exponent notation,
fractions and out-of-range values refuse. Malformed, duplicate or reordered
sequences refuse even when their JSON representations differ. Empty archives
are allowed but receive a durable empty marker; retry into that already-marked
empty target refuses rather than reusing or replacing the restore boundary. The
legacy command still has no stable operation-ID recovery API.

**NOT_MIGRATED: pre65 restores cannot be recognized retrospectively.** Their
history has no reliable durable restore marker. The migration does not infer a
restore from a name, actor, timestamp, source-looking payload or current membership,
and it does not revoke any membership or add speculative markers. The status
reader reports absence as unknown; an unmarked normal fresh Estate has the same
status, because absence does not prove a historical restore.

The regression deliberately creates a real restore on full64, removes the archived
membership independently, then installs65. That old restored Estate remains
unmarked; replay still restores the old owner. This is an explicit known historical
risk, not passing retrospective repair. Such Estates require a separately reviewed
inspection/recovery process and a visible operator rollout barrier before relying
on the new authority guarantee. Schema65 installation alone cannot clear that
barrier or claim every historical restore is repaired. No
automatic historical fix or verified private import eligibility is claimed.

A global database owner can bypass application boundaries. This change does not
provide an operating-system sandbox, prove archive authorship, prevent all replay
side effects, or certify provider/native readiness.

## Actual verification

Run from the repository root:

```sh
node apps/desktop/test/run-restore-authority-db.mjs
```

The [runner](../../../apps/desktop/test/run-restore-authority-db.mjs) creates its own
PostgreSQL17 cluster, private Unix socket, database and nonce; it accepts no caller
DB URL and starts no TCP listener. The [test](../../../apps/desktop/test/restore-authority-db.test.mjs)
checks the actual data directory/nonce, applies every migration from disk and an
exact applied ledger, then invokes actual SQL as the relevant roles. Missing
PostgreSQL returns `NOT_RUN`, not PASS. No Supabase auth service, native process,
user data, provider or model is involved.

Observed on 2026-09-27:

- Before migration65, full64/schema_version64: archived owner counts **restore=1,
  removal followed by rebuild=1**. Required-zero assertion failed (red regression).
  Owned cluster/socket/data cleanup passed after that failure.
- With migration65, full actual65/schema_version65: **11 groups PASS**, cleanup
  PASS. New restore/rebuild archival membership counts **0/0**.

Compatibility follow-up on the unreleased candidate65 then found a real old
consumer regression: [restore-disposable.test.mjs](../../../packages/schema/test/restore-disposable.test.mjs):143–152
reads `journal.seq` using node-postgres and serializes its bigint string directly.
Running that actual test inside an owned PostgreSQL17 cluster initially failed
with `23514: Invalid restore sequence`. The helper's number-only type check was
too narrow; the archived sequence value itself was valid. The fix accepts the two
canonical representations above without changing old migrations or weakening the
authority marker, order or integer bound.

After this compatibility correction:

- `node apps/desktop/test/run-restore-authority-db.mjs`: **12 groups PASS / 65
  migrations**, cleanup PASS. Added numeric/string/mixed equivalence through
  `Number.MAX_SAFE_INTEGER`, same normalized marker/journal values, and zero
  archival-owner assignment both after restore and rebuild. Expanded malformed
  string corpus and mixed-representation duplicate/order negatives refuse.
- `node --experimental-strip-types packages/schema/test/restore-disposable.test.mjs`:
  **8 checks PASS**, including restoration twice into separate fresh databases,
  collision rollback, identical projections and no restored authority.
- `node --experimental-strip-types packages/schema/test/membership-roles.test.mjs`:
  **10 checks PASS**, including outsider denial, stale revision and concurrent
  last-owner removal.

The last two commands were invoked with `DATABASE_URL` explicitly set to a newly
created owned PostgreSQL17 Unix-socket cluster, never their default working DB.
The wrapper used `initdb -A trust -U postgres --no-locale -E UTF8`, started only
that data directory with `listen_addresses=''`, verified its exact data directory
and absent TCP listener, created the three application roles/auth shim/installer
ledger and applied all65 migrations to the source DB. The existing restore test
then created and removed its own two destination DBs inside that same cluster.
`pg_ctl -D <owned-data> -m fast -w stop` plus removal of the owned directory ran in
`finally`; cleanup PASS. An existing local `pg` dependency was temporarily linked
into the isolated worktree and the symlink removed; no dependencies were fetched,
no live database was used, and the old test files were not rewritten to hide the
consumer incompatibility. Do not rerun these legacy tests with an unset
`DATABASE_URL`: unlike the A0 runner, they do not own their default source DB.

Independent integration probes on root source `6efe3ce` with root's uncommitted
exact65 CEO expectation update also passed: transcript recovery **16 groups/65**,
command ingress **5 groups/65**, CEO SQL **12 groups/65** plus actual service/SQL
composition **5 groups**, managed launch, managed Stop and delivery/dispatch.
Commands were the corresponding `apps/desktop/test/run-*-db.mjs` owned runners;
all owned clusters cleaned up. These runs preceded the decimal-string compatibility
correction and are integration evidence for A0's ownership change, not a claim
that every probe was rerun against the later candidate bytes. CEO's former exact64
expectations were the only other observed failure and were corrected by root;
future schemas are not accepted by replacing that bound with a floating count.

The passing groups cover boundary existence before first journal projection;
original journal field values/IDs (JSONB and timestamps normalized, not raw
archive whitespace/byte formatting) and independent owner/member roles; exact Estate/seq
scope and normal fresh bootstrap; table/helper permissions, raw event and GUC
non-authority; scoped status/current revision; later-projection rollback and clean
retry; two-connection concurrent restore; same-target refusal, malformed sequences,
Project-ID collision rollback; empty archive; the explicit pre65 historical gap;
and whole-function latest59 preservation outside the owner predicate.

Focused SQL tests are not full application tests. Parent independently reviews
this packet and owns the full-chain integration of other existing DB suites,
schema65 readers, strict build manifest, fast gates and workspace publication.
No live DDL, package build, hosted suite or native release acceptance was run here.

## Exact next task

Root reviews/integrates the additive migration, registers the protected primary
boundary in scope/archive inventories and qualifies schema65. A0's marker cannot
be reconstructed from ordinary archives; the actual target restore command creates
it locally, before projection. It is not private content or transferable authority.

Before native restore activation, review the destination-authority proposal below.
Then reserve the separate private-archive packet's migration. Extend this trusted
boundary with a reviewed verified mode and owner-authorized wrapper, then implement
owner-scoped portable export/import, composite FKs, per-Person import receipts and
native composition from [the contract](ceo-private-archive.md). Never upgrade a
legacy boundary from a renderer assertion or checksum alone. Full CEO activation
continues to require private backup, IPC/UI authority and the other R0 gates.

## Native compatibility follow-up · 2026-09-27

**Measured code boundary: history restored is not a usable destination.** This
follow-up is read-only inspection of the implementation at
[`bea5c064`](https://github.com/passioncode-ai/fabric/commit/bea5c064882695ee15e21b7db50d65b10aef9b5a),
not an implemented wrapper or a new native acceptance result. A0's actual DB tests
above prove suppression of archived memberships; they do not prove successful
operator access to the restored destination.

### Existing path and missing consumer

- [backup.ts](../../../apps/desktop/src/main/backup.ts):143–185 verifies the ordinary
  archive, invokes four-argument `restore_estate`, and returns `ok: true` whenever
  its receipt says `restored: true`. It receives no held Person, membership revision
  or destination-access postcondition. It creates no independent membership.
- A repository search for `createBackups` finds its declaration and direct use in
  [backup-restore.test.mjs](../../../apps/desktop/test/backup-restore.test.mjs),
  but no production caller. `rg -n 'createBackups|restore_estate|intoEstateId'
  apps/desktop/src` finds only `main/backup.ts`. Searching the renderer, preload
  and `main/index.ts` for backup/restore finds unrelated tab/window/transcript
  restoration and explanatory mirror text, not an archive-restore handler. There
  is therefore **no already-wired restore UI regression** established by this
  review. There is a real low-level success/readiness gap before activation.
- The existing backup regression explicitly expects **zero memberships** in an
  empty restored destination (`backup-restore.test.mjs`:169–184), and counts empty
  archive restoration as success (:197–207). Those assertions prove authority is
  absent; they cannot prove the operator can open the restored Estate.
- [index.ts](../../../apps/desktop/src/main/index.ts):235,390–417 scopes the native
  store and identity to hardcoded `ORG1`. Only an absent Estate triggers a fresh
  `estate.created@1` with the host's `LOCAL_OPERATOR_PERSON`. Identity establishes
  later at :533–535 and fails if that Person has no membership. A different
  restored target is not selected; a journal-only restored `ORG1` already exists,
  so that startup skips fresh owner creation and cannot establish the operator.
- [identity.ts](../../../apps/desktop/src/main/identity.ts):40,54–70 derives the
  current single-operator Person and calls `resolve_subject`. It is not a deployed
  external login provider. [Migration58](../../../supabase/migrations/20260910000058_subject_resolution.sql):23–57
  requires both a global Person row and a target Estate membership. A global
  Person UUID, including one present in archive authorship, grants no membership.
- Normal bootstrap cannot simply run **inside the restore target first**: its
  journal event would violate the empty-journal check in migration65:78–87. The
  durable marker at :94–100 must still precede all archived projection.

### Recommended next design · proposed, not implemented

Use a current, independently established **control Estate** to authorize creation
of a different, fresh restore destination. On a new installation the existing
trusted native bootstrap can establish the control Estate and current local
operator first; its journal is separate from the destination's journal. This
avoids an exception that grants ownership merely because an archive names a
Person or because membership resolution failed. It does not claim that the
single-operator seam authenticates a portable archive's author.

The next owner-authorized wrapper should execute one transaction:

1. Derive the Person and held control-Estate membership revision in trusted main;
   accept no renderer-supplied actor/owner. Recheck exact current **owner** role
   and revision in SQL, with a row lock that serializes with membership changes.
   Existing `change_membership` (migration52:121–177) is a privileged low-level
   operation, not an acting-owner authorization check to reuse unguarded.
2. Bind a stable operation ID to the exact owner, authority Estate, fresh target,
   source archive descriptor and digest. Check current authority on retries;
   return the same committed target/receipt for the same operation, and refuse
   conflicting reuse. Mint the target in trusted main; never turn an arbitrary
   pre-existing empty Estate into the caller's property. Lock participating
   Estates in a consistent order, retaining A0's target lock and empty-journal
   check.
3. Create a new target Estate shell and fresh owner membership for that same
   verified Person. This is a new administrative act recorded in a protected
   operation receipt, **not** an imported grant or fabricated archival event.
   Do not append a bootstrap event to the target before replay, change original
   journal field values, or fill a missing Person from archive payloads.
4. Call the reviewed internal restore boundary, recording the marker before
   archived `estate.created` projection. Verify the target's subject resolves as
   the newly established owner and that archive/project postconditions hold.
   Shell, membership, boundary, restored rows and operation receipt must all
   commit or roll back together. No worker, Run, lease or execution grant is
   created. A fresh destination owner gains no access to another Person's
   private companion; those imports keep their separate owner/current-membership
   contract.
5. Native reports structured states: history restored, destination access verified,
   and destination opened are separate facts. Opening needs an explicit persisted
   active-Estate selection and a fresh scope/identity bootstrap. A controlled
   restart into the selected Estate is a smaller initial seam than switching all
   live listeners/PTYs/stores in place, but still needs verification. Do not expose
   an “opened/restored and ready” result while all consumers remain on `ORG1`.

The existing legacy RPC can remain a service-only **journal restoration** tool;
it is not the product's future usable-restore command. `createBackups.restore`
must be composed with the new receipt/authority contract before a user-facing
caller is added. Do not silently grant the archived owner to preserve its current
boolean return shape. A restore into a database still holding the source's global
Project IDs continues to refuse collisions; fresh target ownership does not solve
or waive that separate constraint.

### Alternatives and tradeoffs

- **Atomic wrapper (recommended):** narrowest complete state transition, no orphan
  destination on replay failure, one lost-response recovery receipt. Requires a
  reviewed SQL/native contract and active-Estate selection before activation.
- **Prepare destination, then owner-authorized restore:** useful if an operator
  deliberately prepares an empty Estate for other owners. It needs a protected,
  immutable preparation receipt, operation recovery, explicit prepared/incomplete
  UI state, ownership recheck and a disposal policy. Generic membership plus an
  empty journal is insufficient proof that any arbitrary target is disposable.
- **Direct first-install restore without a control Estate:** requires a separately
  designed trusted identity/bootstrap issuer. Neither the archive's owner UUID,
  a checksum, a missing membership nor a renderer assertion supplies that proof.
  Current bootstrap reuse avoids introducing this additional issuer in the next
  bounded packet. No multi-user identity-provider capability is inferred.

### Required acceptance before native restoration is called usable

These are proposed tests, **not run in this documentation follow-up**:

1. Actual disposable DB: trusted control owner restores a new target; exact same
   Person resolves there as owner, a different archived owner gets no membership,
   and rebuild preserves independently established roles without imported grants.
2. Member-only, revoked/moved held revision, missing Person, forged actor/owner,
   existing target and source=target each refuse before destination mutation.
   Revoke/restore races serialize on the real membership row, not only a local
   cached identity or unrelated advisory lock.
3. Projection collision/malformed archive rolls back target shell, membership,
   marker and operation receipt. Lost response/concurrent repeat returns one
   exact target and receipt; different payload under the same operation refuses.
4. Actual native service composition: the fresh-install control bootstrap occurs
   outside the target; target journal remains eligible for restore. Access failure
   cannot produce a usable-success result. Owner capability creates no worker or
   restored queue. Private import remains separately authorized per Person.
5. Persisted destination/restart fixture: every scoped service opens the selected
   target, re-resolves its Person membership before domain effects and does not
   append an extra bootstrap creation event. Revocation between restore and reopen
   refuses opening and retains the honest history-restored receipt.

Next handoff: root reviews this proposed destination-authority and activation seam
before reserving/implementing any wrapper migration. This follow-up adds no RPC,
table, native/UI binding, schema qualification or migration allocation.

Actual skills: task-pipeline — isolated bounded migration and negative/regression
verification; evidence-docs — source receipt, red/green evidence and explicit
historical limit. Root owns shared coordination and publication; no shared register
was edited in this subordinate packet.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — isolated migration and actual PostgreSQL regression
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — red-green receipts and historical limitation

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
