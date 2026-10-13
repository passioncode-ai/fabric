# Fabric run assignment correlation

## Contract

N028 provides a bounded local **correlation** producer, not admission or ownership authority.
`createResourceRunAssignmentManager` in `apps/desktop/src/main/resourceRunAssignment.ts`
reads an approved manifest's exact bytes, task/project membership through an existing
estate-scoped `ScopedStore`, installed agent-sync function identity, and immutable local
mapping files. Every outcome has `executionAuthorized:false` and `ownership:unproven`.
There is no numeric fence, R1 held verdict, acquire/renew/release, database mutation or spawn.
The internal assignment includes private configured paths solely to feed N026; it must not
be exported to telemetry or public receipts. Refusals carry bounded reason codes only.

The constructor fixes estate/project, installation ID, **app invocation** ID, canonical
repository and owned storage roots, approved HTTPS remote/repository label, manifest path
and exact SHA256, installed script path and finite limits. Invocation is not OS boot.
Only an estate-scoped store with the matching estate is accepted; membership rereads use
actual `project_tasks` and `projects` rows and match exact task/project/repository root.
This establishes membership, not subject authorization, which stays with admission/guard.

Manifest fields are `selectionRevision`, `scopeMappingRevision`, `configuredKey`,
`expectedHead`, `selectedInputs`, `mutableScope`, and N026 `bounds`. Selection comes from
trusted reviewed configuration, not task touches or renderer digests. It must exclude
credentials. The producer invokes the **actual N026 constructor validator** before
persisting an assignment and when reading existing records, avoiding a second path/HEAD
contract. The snapshot itself remains N026's job; this module does not read selected bytes
or establish complete closure. A manifest byte change refuses prior mapping use.

## API and lifecycle

- `allocate({taskId,sessionId})` performs real reads and pinned function readback, mints an
  attempt UUID and records an assignment. Success returns an opaque in-process handle,
  immutable N026-compatible assignment and configured lease target. Only trusted main
  composition supplies task/session IDs; the method has no renderer or tool route.
- `readIdentity(handle)` rereads the immutable record, approved manifest, installed source
  digest and actual membership. It emits N026's five identity fields, accepts no expected
  identity argument and refuses foreign/copied handles.
- `observeLease(handle, expectedTip?)` invokes N023 with stored remote/key/derived run/repo.
  The optional exact tip is a trusted caller constraint, not acquisition evidence. Even a
  matching current lease is explicitly `attribution:unattributed`; there is no acquired state.
  Default transport is N023's hardened HTTPS Git; trusted injected transport is only an
  infrastructure seam. This module neither reads local lease-note files nor takes a lease.
- `childEnvironment(handle)` refreshes mapping validity and returns **only** the nonsecret
  `{AGENT_SYNC_RUN_ID:key}` patch. It does not accept/return the parent's whole environment.
  Later trusted PTY composition must match requested session to the handle's assignment and
  apply this patch last, after sanitized parent, descriptor and bundle environment. N028 does not wire this
  identity patch into PtyManager; no actual child environment delivery is claimed.

Opaque handles exist only in the creating manager. A restart loads records for collision
and corruption checks, never as live handles. The same recorded session cannot be allocated
again, even after restart; unresolved evidence stays unknown. Recovery/record deletion is
outside this packet. There is no inference from matching journal text or parent run identity.
Returned SQL task_run_id/run_ordinal and actual prepared instruction/context bytes remain
future composition bindings; neither is invented before admission.

## Installed-function readback

`scripts/resourceAgentSyncIdentity.py` reads at most2MB from a regular no-follow source,
checks before/after file identity and exact SHA256
`fba3e2d99cad3982b3d81cab9c2ae7a255265ddddcd249aee81dca866e457ee1`
(agent-sync1.22.2), then AST-extracts only `_rid_from`, `_session_key` and `run_id`.
It evaluates those actual installed function bodies with their audited standard-library
names and an explicit key in an owned empty scratch directory. It does not import the
module, execute main/Sync, load project config/vault or call whoami (which can migrate
local notes). Unknown source bytes refuse; this is intentionally a bounded version seam.

Keys are exactly12 lowercase alphanumeric characters. The installed explicit-env branch
returns `r-<key>` without reading a marker and without the long-key six-hex hash truncation.
The producer validates actual helper output, not a callback echo. It invokes Python with
`-I`, minimal environment, bounded output and child timeout; paths/keys are not credentials.
Packaged helper delivery, full agent-sync CLI invocation and native child behavior are
NOT_RUN. No installed plugin file changes. The helper path is a source-tree seam until
packaging/composition is implemented.

## Immutable storage and bounds

The caller supplies an existing canonical0700 owned directory. Records are exclusive-created
0600 `r-<key>.json` files, fsynced with the containing directory before success. Allocation
holds one exclusive no-follow `.allocate.lock`, scans a bounded number of regular files,
validates every full record and refuses duplicate session/key/derived run ID, corruption,
unknown directory entries or the configured cap. A failed/partial write is retained; it is
never overwritten or recycled. Only the operation's own inode-matched lock is removed.
A prior crash lock is not stolen, repaired or deleted automatically. Parent/root replacement
by an arbitrary hostile filesystem writer is not claimed impossible; this is cooperative
local storage, not a security sandbox against the account owning the directory.

Default key randomness reduces collision probability; persisted refusal is the guarantee.
It covers this retained installation registry, not global authentication or uniqueness
against another machine/self-reported writer. Foreign existing lease labels cannot prove
that this assignment acquired anything. Storage exhaustion explicitly refuses new records;
no unbounded cache or automatic expiry/reuse is introduced.

One manager operation is admitted at a time. Caller timeout retains occupancy until actual
membership calls, helper process and owned cleanup settle. Both membership reads settle
before releasing occupancy even if one rejects. Nested N023 caller timeout retains the
actual Git transport too, across different handles. N023 retains its own bounded scratch
cleanup; this is not a claim of one physical filesystem request globally. Cached readers
and immutable records are bounded by the configured record cap. Late outcomes do not
satisfy timed-out callers. Accidental ordinary rejected Promise clocks/keys are consumed;
hostile dependency objects and exotic Promise constructors are outside trusted DI.

## Verification and remaining work

Run `node --experimental-strip-types --test apps/desktop/test/resource-run-assignment.test.mjs`.
Installed-function cases use `N028_AGENT_SYNC_SCRIPT`, or the installed1.22.2 Codex plugin
path when present; absence explicitly skips those cases as NOT_RUN, never installs code.
A portable helper refusal case still tests that unsupported source cannot execute its body.
Real temporary filesystem/Git cases exercise immutable records, manifest drift, collisions,
partial record/restart refusal, two managers, actual N023 observations, timeout occupancy
and downstream N026 contract agreement. Scoped database transport is a fixture; actual DB
membership transport is NOT_RUN. Installed-function bodies execute; full CLI remains NOT_RUN.

Independent early review reproduced failed-query/hung-sibling accumulation, incomplete
retained record acceptance and cross-handle nested Git accumulation. Builder focused checks
also caught record-cap off-by-one. Preserve original sources/logs and unchanged negative
controls; corrected focused receipts name actual hashes/counts outside this contract.

No production composition, active migration, real lease acquisition or global enforcement
is shipped. A Fabric-owned ownership/fence semantic decision, coherent N027 accounting,
complete chosen-pool inventory and once-prepared input/dispatch remain separate. COM is
not a prerequisite for these local modules; foreign protocol changes require their owners.
