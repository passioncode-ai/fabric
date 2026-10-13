# Durable logical-worker intents

## Contract

N031 implements crash-gap-safe local **registration**. The separate N032 extension stores
constrained admission and process attachments; neither provides a complete worker inventory.
One configured Fabric-controlled logical unit is intended to charge one worker slot in
future composition. Nothing here inventories every OS process, foreign CLI, helper,
provider job or sibling application. Every API result carries `complete:false` and
`executionAuthorized:false`, including an empty directory. A successfully recorded intent
is not admission, a live worker, a reservation, a spawn permission or a retirement proof.

`createResourceWorkerInventory` fixes estate, installation host, pool, human policy revision,
app invocation, existing canonical0700 storage and the exact bytes/digest of a reviewed
adapter coverage manifest. It accepts the actual trusted N028 assignment producer and
existing `stopHostIdentity` object from main composition. The producer object, its
`readIdentity` method and host object are captured; substitutions and changed host/invocation
refuse before and after asynchronous boundaries. These dependencies are trusted main code,
not renderer/tool arguments; structural TypeScript typing is not authentication of arbitrary
JavaScript objects. No callback takes an expected identity and returns `held` or `ended`.

The host `bootId` denotes the **app invocation**, not OS boot. N022's existing `resourceId`
validator owns host/pool/policy/adapter identifier shape. Human `localPolicyRevision` is not
N025's full-policy SQL binding revision; this module never derives a SQL reservation or
configuration generation from that string.

The manifest shape is `{schema:1,hostId,poolId,localPolicyRevision,adapters:[{id,sourceSha256}]}`,
with distinct adapter IDs and at most32 declarations. Its SHA is checked on every use.
Adapter source hashes are approved **declarations**, not measurements of installed/runtime
code. A matching manifest does not prove every launch path passes an adapter. It therefore
cannot produce `complete:true`, even if every listed unit were known.

## API and durable format

- `register(assignmentHandle, adapterId)` independently calls actual N028 `readIdentity`
  before and after persistence. N028 validates its own opaque handle, immutable mapping,
  manifest, installed function source and actual scoped membership. The returned unit ID
  is its attempt UUID; its agent-sync run ID remains distinct from SQL `task_run_id`.
  Success has `state:recorded` and returns an opaque intent handle, event ID and exact
  record digest. It grants no permission to materialize a process.
- `readIntent(intentHandle)` accepts only handles created by this manager, rereads exact
  bytes, validates the full retained registry, rechecks coverage/host and original N028
  provenance. It returns the immutable event and digest. A copied or restarted handle
  cannot restore authority from identifiers alone.
- `snapshot()` validates bounded retained records and returns `knownActive:[]` plus
  unresolved events/digests. The empty known-active list means **no active evidence was
  produced**, never zero observed worker slots. Valid earlier-invocation/policy records
  remain classified `prior_binding_unresolved`; current intents are `intent_unresolved`.
  Both the result and its payload remain `complete:false`. Invalid/corrupt storage instead
  returns structured unknown; no raw paths, errors or credentials leave the API.

An immutable schema1 `intent.registered` event binds unit/event IDs, estate/host/pool/human
policy/invocation, adapter declaration/source digest, coverage digest, actual N028 run ID
and all five assignment identity fields. File name is `<unit UUID>.<event UUID>.json`.
Registration invents no timestamp, numeric fence, lifecycle state, SQL run/reservation or
prepared-content digest. N032 adds only schema1 `admission.attached` and `process.attached`
events. Each inherits every registration binding, has a new event UUID and chains the exact
predecessor bytes through `parentRecordSha256`. One unit has at most one registration, one
admission and one process attachment, in that order. Orphans, duplicate kinds, changed
parents/bindings and other unknown kinds/versions refuse the entire registry. The original
registration format remains unchanged; an older N031-only reader refuses the new kinds.

An exact current-invocation retry returns original bytes/event ID/digest; it neither refreshes
an age nor creates another event. A retry reopens the exact retained bytes without following
links, verifies descriptor/path identity, and fsyncs the event and directory before returning;
surviving complete bytes after a failed sync alone never prove durability. Conflicting unit, session, run, event or adapter identities
refuse. Changed manifest or earlier invocation prevents new registration from bypassing
retained uncertainty. A restarted manager can inspect retained events; it cannot restore an
old opaque handle. No stale lock stealing, automatic deletion, record reuse or retirement exists.


## N032 constrained attachment storage

`attachAdmission(intentHandle, value)` accepts exactly `taskRunId` (UUID), `runOrdinal`
(positive safe integer), `reservationId` (resource identifier), `fence` (positive safe integer),
`inputDigest`, `scopeDigest`, `contentDigest` (SHA256), and `bindingRevision`
(`policy-sha256-v1:<SHA256>`). This SQL binding remains distinct from the intent's human
`localPolicyRevision`. The separate managed-unit consumer must obtain and compare actual
scoped reservation/launch-binding facts before calling storage; this writer checks shape,
provenance and durable correlation, never whether caller-supplied attachment facts are true.

`attachProcess(intentHandle, {pid,group,start})` requires an admission predecessor, safe
`pid>1`, `group===pid` and nonempty printable ASCII start identity at most128characters.
The managed-unit consumer obtains these facts from its actual owned-process handle. This
storage API alone cannot authenticate a PID, prove spawning, prove provider quiescence or
retire a unit. Only trusted main composition may invoke these attachment methods.

Both methods return the immutable `{event,recordSha256}` in a recorded result. Attachment
payload is `event.attachment`. Exact retry preserves original bytes/UUID/digest; conflicting
payload refuses. In this ordinary managed-unit scope, each retained unit has a distinct
SQL task-run ID and reservation ID. Reusing either across units refuses before write and
during scans. Exact host/invocation/PID/group/start reuse also refuses; a different start
identity is distinct but its truth still requires actual owned capture by the consumer.
File and directory durability are reestablished for the full predecessor
chain, including complete bytes left by an earlier failed sync. A failure retains every
written record as uncertain, with no overwrite, cleanup or silent adoption.

`readAttachments(intentHandle)` returns nullable `{admission,process}` receipts after actual
N028/host/coverage validation and durable readback of the full chain. These are persisted
storage facts, not live SQL/process validation. It never upgrades execution authority.
`snapshot()` reports attachments alongside each unresolved registration and still returns
`complete:false`, `knownActive:[]`. Prior-invocation valid chains remain unresolved; they
cannot restore handles or imply a retired/live process. `maxRecords` counts all retained
files including attachments; byte limits include the full chain.

The focused suite names N032 ordering, conflict, exact-retry, malformed tuple, orphan/parent,
total-file bound, fsync/readback, postwrite membership drift and restart controls. It uses
synthetic attachment facts deliberately: native/SQL truth verification belongs to the
separately reviewed consumer. N031's earlier acceptance does not certify this extension.

## Storage and asynchronous bounds

Registration takes an exclusive no-follow `.register.lock`, fully validates retained files,
and creates its event with exclusive no-follow0600 semantics. The event and directory are
fsynced before a receipt can return. A partial write or later validation failure leaves its
evidence in place. Cleanup closes descriptors and removes only the operation's same-inode
lock; a prior/crashed/replaced lock remains unresolved. This is cooperative owned storage,
not a sandbox against arbitrary same-account filesystem interference.

Reads refuse symlinks, hardlinks, replaced files, incomplete JSON, wrong file modes,
unknown names and duplicate immutable identities. Configured limits cap records at1024,
each record/manifest at64KiB, the aggregate registry at8MiB and operation time at30seconds.
Actual settings can be smaller. Scans bound entries and bytes before accumulating results.
One manager operation stays occupied until every started read/write and owned cleanup
actually settles. Caller timeout never frees uncertain I/O; late work checks its deadline
before later mutations and cannot return a usable receipt. No sibling Promise fan-out is
introduced. The monotonic clock is the actual process clock; no injectable clock callback
or periodic scheduler is added.

## Verification and next adapter

Run `node --experimental-strip-types --test apps/desktop/test/resource-worker-inventory.test.mjs`.
The suite drives actual N028 plus real owned filesystem/Git and pinned installed-function
execution. Scoped membership transport is a fixture; DB/native/provider acceptance is not
claimed. Existing `N028_AGENT_SYNC_SCRIPT` selects the pinned installed source; missing
installation yields explicit skips, never an installation action. Receipt counts/hashes and
original RED controls live with the source delivery evidence, not as timeless doc assertions.

The next contract is **N032 concrete launcher adapter** (design/implementation status is
owned by the parent graph, not this document). It must own the managed-required logical pool,
exclusive writer/entry coverage, durable registration before any possible spawn, actual
SQL admission/reservation identity and prepared content binding, actual session/native process
identity and independent provider/process retirement observations. All admitted units must
stay conservatively charged until genuine never-spawn or retirement evidence exists. That
conservative unretired set is distinct from an exact observed-live count. Existing
`PtyManager.observeProcess` supplies owned local process observations, while
`nativeStopRuntime` treats provider quiescence separately; root exit alone is insufficient.
N031 does not connect those producers, count unobserved units as live or claim the future
coverage protocol already exists. Restart/unknown provider outcomes remain retained.

Retrospective lessons applied: preserve exact source receipts; exercise actual production
readers and filesystem refusals; keep mutable scope closure bound across awaits; retain
all started I/O through settlement. No active DDL, native launch, installed wiring, generic
completion callback, scheduler or public protocol is introduced.
