# COM-01 research handoff and COM-02/03 cold implementation packets

Objective: implement durable Project-addressed communication inside Fabric, preserving current
hub authority, participant privacy and unknown-effect facts through responder replacement.
This file supplies proposed implementation context; it is not another task/status register.
The [canonical spine](../evidence/plans/2026-10-04-project-communications.md) owns COM IDs/status.
Entry: [architecture report](../reports/2026-10-04-project-communication-architecture/README.md).
Frozen source is `2e06e5013595ec96b52b85cae2c486050632565b`; verify drift before implementation.

Completed here: commit-addressed source map, official/maintainer research, proposed entity/RPC/
permission/cursor/retention design, twelve passing pure design tests and five failing guard
removal variants. NOT_RUN: production implementation, database/RLS/integration/provider/Telegram
acceptance, native qualification, hosted CI, wiki publication. No COM task is closed by this handoff.

## Common context every implementing agent must carry

Read Fabric AGENTS and org contribution rules, canonical spine, report §Existing source and
§Principal/consent, ADR-0115, `main/agentSurface.ts`, `shared/scope.ts`, `main/scopedStore.ts`,
`packages/journal/src/index.ts`, latest continuation override migration 62, private CEO migration
64, restore boundary 65, authority guard 74/80 and current migration catalog. Never assume file
suffix equals applied schema version or allocate a number from a filename guess. PF-06 suffixes
81/82 are reserved; root owns authoritative migration/ADR/register leases. Ordinary implementation
files may be owned by the packet, but shared register/map/UX edits require explicit claims.

COM writes need dedicated private RPCs. A single Project predicate or estate-wide generic
journal replay cannot express sender-or-recipient visibility. Main service-role queries are
trusted application code, not a complete security boundary if main itself is compromised.
DB revoke/RPC boundary must prevent accidental generic access. Existing hub binding/Product
consent does not grant COM read/respond/manage/effect permissions. Managed credentials carry
server-derived estate/Project/session; external provider labels remain asserted. PID/service
presence/config-copy proves neither identity nor acceptance.

Use canonical types/test vectors owned by Contract. Proposed names in the report and packets
are placeholders until COM-01 names/version decisions are accepted. Do not expose a fake
implemented API in public docs. Keep requests/messages independent of task ownership: only an
explicit authorized command may attach/create work, and that path uses current task lifecycle
admission. Communication read marks must not resolve `shared/board.ts` obligations.

Serialize overlapping edits in this order: COM-02.A private schema/authorization skeleton;
COM-02.B command persistence; COM-02.C participant feed/read states; COM-02.D terminal state/
restore/retention; COM-03.A enrollment/slot; COM-03.B claims/replacement; COM-03.C effect/ACK;
COM-03.D protocol integration; COM-03.E qualification. Independent test research may run in
parallel, but do not concurrently rewrite the same migration, private table registry or tool
surface. Send findings affecting an active predecessor immediately to its author and root,
with finding ID, exact source/test, impacted packet and proposed correction. Root records
canonical plan changes under lease; this file does not duplicate mutable status.

For each packet, leave a tracked handoff with source and output commit, touched contracts,
executed/skipped checks, discovered dependencies and exact next packet. Prove a meaningful
red regression before the fix when implementing safety behavior; run focused tests and required
static/doc gates. Do not run a full tier while another owner holds it. Commit/push task-owned
files, verify remote SHA and fresh-checkout artifact access. No force push or unrelated staging.

## COM-02.A — protected participant boundary and schema skeleton

**Prerequisites:** COM-01 approves extension/version, Project-history read grant, immutable
participant sharing rules and resource defaults. Root reserves SQL ID/schema target and lock
order. Input source: `shared/scope.ts:58,70–78`, `main/scopedStore.ts:35`, migration64 private
content/RPC authorization, migration74 append canonical/private guard, migration80 hub boundary.

**Own write set:** one newly reserved migration, generated DB/contract type fixtures, new
`main/projectCommunications.ts` authorization facade and separate COM privacy integration tests.
The filename is proposed; choose the canonical module name before creating it. Root coordinates
any shared scope table registry and contract extension files. Do not modify CEO ACLs, grant
broad table selection, rewrite journal replay, or allocate ADR numbers.

**Steps:** define composite estate-keyed thread/message/private-body/request/command-receipt
entities; stable participant set; explicit permission/enrollment references. Revoke primary and
operational table read/write from generic roles and mark them private. Implement protected
`get/list` skeleton using authenticated principal and current revisions, returning no body or
metadata to nonparticipants. Route artifacts through the same visibility predicate. Decide
which opaque public receipt can safely exist; deny generic append of raw COM private content.
Apply unknown-field/type/size/cross-reference constraints in DB as well as ingress.

**Watched red and DoD:** fixture two estates and four Projects; sender A and recipient B see
one authorized message, C and foreign-estate A see no body/title/participant count/artifact/
existence oracle. Direct service-role table select/write and generic append spoof fail. Same
UUID-looking reference across estates fails FK/command authorization. Revoked membership and
self-supplied Project/actor are refused. List count/search/export use the same predicate.
The source receipt resolves current function overrides rather than assuming migration64 alone
is authoritative. Green real local disposable DB tests, not the pure design model, are required.

**Stop/rollback:** stop if within-Project roles need finer visibility than the approved history
grant, or private metadata can leak through generic replay/export. Do not broaden the scope to
make tests pass. Keep feature disabled; rollback runtime activation, retain additive audit data
and coordinate schema rollback with root. Next output: protected schema/types and tested RPC
boundary for COM-02.B.

## COM-02.B — atomic submit, semantic idempotency and durable outbox intent

**Prerequisite:** COM-02.A private authorization and constraint fixtures. Input: journal append
RPC, private immutable command pattern, report §Durable bounded idempotency. Current continuation
digest length is not a mandate for new COM canonical digest; use approved full SHA-256 framing.

**Own write set:** COM persistence RPC/helper/tests in the reserved migration/module, message/
receipt type fixtures, no transport worker. Establish one write owner for the shared migration.

**Steps:** derive actor/source Project from endpoint context; validate recipient permissions,
participants/reply target/artifacts/deadline before writes. Issue server namespace epoch with
finite capacity; command semantic hash covers all approved fields. One short transaction stores
command receipt, private message/request, participant feed rows and optional enabled transport
intent. Return durable IDs/result. Namespace capacity must be reserved before an effect or
admitted command. Same current-authorized key/digest replays; changed semantic payload conflicts.
A response lost after commit is resolved by querying the same durable key, not a fresh key.
Generate transport intent only under explicit mirror grant/config revision; disabled transport
adds no required outbox work. Effect dispatch remains separate from storing an intent.

**Watched red and DoD:** simultaneous same key commits one command/message/request/intent;
same key changed audience/recipient/body/deadline/artifact conflicts; lost commit response
replays same receipt. Inject transaction rollback between every write: either all rows/receipt
commit or none. Full namespace refuses before writes; neither fresh binding nor epoch bypasses
Project quota. A private body never enters safe journal payload. Disabled/unconfigured Telegram
core submission succeeds without transport. Reject deeply nested/oversized context before expensive
traversal; canonical framing distinguishes delimiter/case/UUID normalization test vectors.

**Stop/rollback:** ambiguous existing writes must be recorded/reconciled rather than resent.
No polling/sending external provider in this packet. Feature off on failure, preserve receipts;
never delete idempotency records to regain capacity. Output: atomic command and replay contract
for COM-02.C; separate intent contract consumed later by COM-08.

## COM-02.C — participant feed, cursors and explicit read states

**Prerequisite:** COM-02.B stable participant feed rows. Input: `shared/readEnvelope.ts:26,50,100`,
existing bounded store pagination, report §Short APIs. No visual decisions in this packet.

**Own write set:** dedicated list/get/read-ACK RPCs, private cursor/readmark schema additions,
shared COM read types, focused pagination/privacy tests; root handles IPC envelope registration.

**Steps:** dense ordinal per authorized reader Project; stable snapshot upper bound and
continuation ordinal. Issue opaque cursor row bound to principal/Project/grant revision/reader
epoch/filter/snapshot. Bound cursor creation/storage and expiry independently of effect receipts.
Fetch returns source/freshness and never marks read. Explicit read ACK validates visible ordinal
and monotonically advances only that reader's mark. Implement authorized unread/count/search
consistency. Durable polling catches missed events; wakeups expose no hidden body/count.

**Watched red and DoD:** inserts during page traversal neither disappear from subsequent refresh
nor duplicate an existing snapshot; foreign messages do not create visible sequence gaps/counts.
Cross-Project cursor reuse, changed filter, revocation and restore return reset-required; no
silent rescope. Two readers retain separate marks; poll/read fetch leaves both unchanged. Lower
read ACK cannot roll back high-watermark; hidden target ACK refused. Cursor expiry safely rereads
while a request/effect remains unchanged. Stale/unavailable source does not become an empty
successful board. Database BigInt/count values stay lossless and bounded.

**Stop/rollback:** do not expose estate-global sequence as a cheap cursor. Stop on pagination/
metadata leakage; disable communication reader while preserving store. Output: complete source-
stamped read projection for COM-06/07 scenario/UI owners, not a UI completion claim.

## COM-02.D — cancel, expiry, retention and restore safety

**Prerequisites:** COM-02.B/C private lifecycle. Input: migration65 protected restore, existing
archive/schema handling, report §State distinctions and §Durable bounded idempotency.

**Own write set:** authorized cancel/expiry/redaction/namespace-close commands and tests,
restore/export integration with root's schema contract owner. No automatic provider replay.

**Steps:** explicit expected revision; before-effect cancellation/expiry prevents begin;
after begin records unresolved effect plus stopped future work. Close bounded namespace epochs
and persist monotonic retired floor; compact only eligible terminal receipts with floor retained.
Keep unknown facts until authorized observed reconciliation. Redaction removes authorized content
while preserving minimal identity/digest/outcome. Restore preserves history but retires old
operational enrollment/generations/claims/grants and all imported unsent intents. New enrollment
cannot reactivate old pending work without explicit checkpoint/reconciliation.

**Watched red and DoD:** deadline/cancel races begin with one serializable ordering; not two
effects. Retry old key after row compaction/TTL returns reconcile-required, never a fresh submit.
Unknown survives multiple lease/request/idempotency expirations and new-key pressure. Restore
and old cursor/enrollment replay grant no read/effect/transport authority; authorized archival
history remains available with correct privacy. Redacted reply references remain valid opaque
references without body reconstruction. Body/receipt deletion privileges cannot bypass floor.

**Stop/rollback:** destructive retention requires its own approved policy and dry-run; do not
implement speculative deletion from this proposal. Feature off and keep receipts/uncertain effects.
Output: durable lifecycle guarantees required by COM-03, including accepted-state transfer rules.

## COM-03.A — enrollment, capability and stable responder slot

**Prerequisite:** COM-02 protected entities and accepted permissions. Input: `agentSurface.ts:185,414`,
`accessService.ts:125–139`, `agentRegistry.ts:57`, `authContext.ts:35–42`, provider capability matrix.

**Own write set:** server-side COM enrollment/slot RPCs/types/tests and auth facade. Root owns any
shared agentSurface edit; agree sequencing before writing. Consumer adapters belong to COM-04.

**Steps:** trusted endpoint maps bearer to principal, Project/session and enrollment revision.
Explicit respond/manage grants. Slot `(estate,Project,capability,slot_key)` has durable monotonic
generation. Empty-slot compare generation zero; replacement compare expected current generation
and permission. DB-clock lease/renewal, revoked enrollment floor and trusted/asserted provenance.
No automatic enrollment from CLI discovery/installation/PID/descriptor/provider label.

**Watched red and DoD:** simultaneous replacements yield one winner; expected stale generation
refused. Expired credential/grant refuses renewal; wrong Project/capability cannot register.
An external caller spoofing managed provider/session/provenance is visibly asserted or refused.
Project replacement does not mutate chosen provider account/history. Recreating a removed slot
cannot reset generation and resurrect old claims. Client clock skew cannot extend lease.

**Stop/rollback:** unknown provider capability is unsupported, never optimistic. Stop if authority
would rely on UI-supplied IDs or service discovery. Revoke activation and leave generation floor;
no restoring old bearer authority. Output: current authorized enrollment/slot to COM-03.B.

## COM-03.B — delivery claim and replacement fencing

**Prerequisite:** COM-03.A and COM-02.D checkpoint/unknown rules. Input: current migration62
`continuation_dispatch:369–458` and report §Database generation. Avoid long DB transactions.

**Own write set:** delivery/attempt claim, renew and replacement handling RPC/tests. Optional
queue index uses SKIP LOCKED only for claims, not consistent readers.

**Steps:** short estate-first transaction checks current principal/grant/enrollment/slot generation
and deadline; allocates attempt UUID and DB lease. Same-generation reclaim always gets new attempt.
Replacement grants only unaccepted, positively unstarted work to the new consumer; accepted or
started work requires explicit checkpoint/reconciliation. Current slot/generation and attempt are
mandatory on every state mutation, not only initial claim. Return typed conflict/fenced/unknown.

**Watched red and DoD:** pause G1/C1 after claim, replace G2/C2, then resume G1 through renew,
accept/reply/progress/begin/complete: every authorizing write refused with zero new effects.
Pause C1, let lease expire, reclaim C2 without changing generation; resumed C1 still refused.
Revoke while pending vault/readiness wait; begin refuses. Stop/restart paused worker and delayed
completion retain unknown where begin occurred. Row-affected count and committed effects asserted,
not just successful takeover. Guard-removal variants must fail meaningful assertions.

**Stop/rollback:** if old workers can direct effects with independent credentials, stop claiming
fenced execution; expose respond-only or define separately authorized boundary. Disable claims,
retain all receipt/attempt floors and classify begun-without-observation unknown. Output: proven
ownership/claim fence for COM-03.C.

## COM-03.C — explicit acceptance, effect begin and observed completion

**Prerequisites:** COM-03.B, current policy/hub effect boundaries. Input: `policy.ts:424–449`,
`continuationDelivery.ts:88–100`, `deliveryQueue.ts:94–106`, `hubCall.ts:30–47`.

**Own write set:** authenticated consumer ACK/progress/reply/completion commands and mediated
before-effect gate integration/tests; shared effect-policy edits coordinated with root.

**Steps:** explicit exact-message/digest ACK records accepted independently of PTY written or
human read. Reply is a participant-visible message, never implicit request completion. Before
PTY/network effect, fresh DB gate consumes live permission/claim and records started atomically;
then perform effect outside transaction. Existing publication/deletion/money policy still applies.
Known refusal before write permits safe retry; any unproved partial write/network send/exception/
result-encoding failure after begin is unknown. Completion requires current exact fences and
admissible observation/evidence. Old consumer completion cannot mutate new generation; an operator's
separate reconcile command validates observation under current reconcile authority.

**Watched red and DoD:** written-but-unacknowledged is distinct from accepted; auto-read/poll does
not ACK. Wrong request/digest/attempt/principal cannot reply or complete. Lost PTY/provider/result
reply cannot reissue one command. Cancellation after begin preserves uncertainty; attempted
completion after revocation/fence fails. Capacity refuses fresh effects while unknown facts remain.
Surface scrub/bounded error/success behavior cannot echo credentials or client identity into body,
ops or evidence. Assert actual mediated dispatch count, not merely API response text.

**Stop/rollback:** never claim exactly-once external effect from one lease. Provider idempotency
windows and observation acceptance are explicit contracts. Disable effect begin, retain existing
unknowns/receipts and reconcile with authorized evidence. Output: state/effect semantics for
COM-04/05/07/10 and optional COM-09.

## COM-03.D — versioned tools and backward-compatible bootstrap

**Prerequisites:** COM-03.C plus Contract-approved schema fixture/pin. Input: Contract `df55c8c5`,
Adapter `907acb28`, report §Protocol version. Proposed RPC names become real only in this packet.

**Own write set:** COM tool registration/IPC typing, discovery capability envelope and tests;
Adapter/Contract updates go to their owners' branches, not unreviewed submodule pin changes.

**Steps:** short submit/status APIs using Fabric durable IDs. Negotiate advertised revision and
capability; plain/interop job-handle fallback when Tasks unsupported. No unsolicited conversion
of current legacy initialize clients. Feature off by default until DB schema/permission compatible.
Separate unsupported client from empty queue. Enrollment/run-specific explicit test ACK records
version/digest/policy/source/build, not config hook/install counts. Cross-module adoption matrix
stays in root's canonical plane; each owner supplies real receipts.

**Watched red and DoD:** unsupported client gets deterministic fallback/refusal; installed helper
without enrollment cannot consume. Actual pinned Claude and Codex exchange is a separate COM-04
provider qualification, not satisfied by stub MCP. Stale contract/schema fails closed before write;
feature-disabled old clients remain compatible. Discovery service presence cannot grant COM scopes.
Every private mutation still uses trusted principal context; ingress accepts no actor escalation.

**Stop/rollback:** broader MCP revision migration is separate work; stop on unsupported semantics.
Disable feature, preserve store and existing non-COM tools. Output: compatible activation contract,
owner branches and exact current commits for COM-12.

## COM-03.E — cold acceptance and lifecycle evidence

**Prerequisites:** preceding packets green on actual disposable DB/runtime tests; COM-04 adapters
and COM-06/07 scenarios when testing full board. Root coordinates full tier/native locks.

**Own write set:** bounded acceptance fixtures/receipts and dated report; no status closure on
model-only evidence. Installed package, source hash, migration count/schema contract, runtime
versions and authority revision are recorded separately.

**Tests/DoD:** real local two-Project exchange and explicit agent ACK; replacement of current
Claude/Codex sessions; stale worker resumption through final commit; restart/missed wakeups;
restore authority rejection; current-grant revocation during async work; unknown effect/no resend
under pressure; participant-only search/count/cursor/artifact access; shutdown/drain admission
refusal; exact installed-build health and supported-client evidence. Optional Telegram has its
own enabled bot/cross-bot/loop/gap/token-rotation/unknown-send receipts and never blocks disabled
core acceptance. Real paid/provider operations require their existing bounded authorization.
Hosted nightly, local focused, build, install and provider checks remain separate receipt fields.

**Stop/rollback:** any duplicate effect, privacy leak, invented authority or lost unknown fact
blocks feature activation. Keep feature off, revoke only COM enrollment, preserve records and
rollback runtime to compatible build under normal policy; do not revert data blindly or resend
pending work. Exact next task after this packet is root's independent COM-14 review of the frozen
candidate and evidence gaps, not automatic release.

## Root integration and research verification

This handoff/report changes unguarded files only. Root decides normative plan/ADR/schema updates
under leases; no wiki index or hosted dispatch was run. Source collection observed member main
refs without resetting/stashing dirty worktrees. The first task is COM-02.A; unresolved COM-01
choices are listed in report §Acceptance decisions. Research author is not an independent reviewer.

Executed checks are persisted in report `raw/verification.json`; source/model files are repeatable
from a cold checkout. Own branch delivery SHA is supplied to root after commit/push; the report's
source baseline remains frozen. Commit or branch delivery does not imply merge/install/release.
