---
report:
  id: fabric/2026-10-04-project-communication-architecture
  title: "Project communication: durable addressing, privacy and replacement fences"
  kind: decision-input
  project: fabric
  domains: [architecture, ai-agent]
  as_of: 2026-10-04
  status: draft
  valid_until: 2026-11-04
  summary: >-
    Proposed COM-01 architecture and bounded COM-02/03 implementation packets.
    Fabric owns durable Project-addressed communication; a bearer principal and
    database generation identify the current responder. Participant-only RPCs,
    durable retry receipts and separate execution/transport states are required.
    Twelve executable design checks pass and five removed guards fail; production,
    database, provider and Telegram acceptance remain NOT_RUN.
  sources:
    - name: "Fabric frozen implementation and canonical COM spine"
      url: "https://github.com/passioncode-ai/fabric/tree/2e06e5013595ec96b52b85cae2c486050632565b"
      read_at: 2026-10-04
    - name: "PostgreSQL 17 concurrency documentation"
      url: "https://www.postgresql.org/docs/17/transaction-iso.html"
      read_at: 2026-10-04
    - name: "pg-boss owner and contributor review: lost claims and transactional work"
      url: "https://github.com/timgit/pg-boss/pull/890#issuecomment-5624267303"
      read_at: 2026-10-04
    - name: "MCP specification revision 2026-07-28"
      url: "https://modelcontextprotocol.io/specification/2026-07-28"
      read_at: 2026-10-04
    - name: "Telegram current Bot API and bot communication rules"
      url: "https://core.telegram.org/bots/features#bot-to-bot-communication"
      read_at: 2026-10-04
  produced_by:
    agent: "Codex research author"
    task: "COM-01 architecture and COM-02/03 cold implementation packets"
  supersedes: []
  consumers: [COM-01, COM-02, COM-03, COM-04, COM-08, COM-09, COM-12, COM-14]
---

<sub>ssheleg skills — task-pipeline · agent-interop · project-reports</sub>

# Project communication architecture — proposed slice

## Decision boundary and first task

This is a dated proposal, not the normative contract or a completion receipt. The
[canonical plan](../../evidence/plans/2026-10-04-project-communications.md) owns COM status.
No migration, adapter, application interface, protocol extension, live database or provider
was changed here. First implementation task: take packet **COM-02.A** in the
[cold handoff](../../handoffs/2026-10-04-project-comms-implementation-packets.md), after the
COM-01 owner resolves the acceptance decisions below and reserves migration identifiers
under the existing lease. SQL suffixes 81/82 belong to the parallel PF-06 work; this report
allocates no suffix, schema version, ADR number or editable backlog row.

Fabric is the primary durable communication board. Address a Project, then resolve its
current enrolled Claude/Codex responder. A desktop session, PID, discovered service,
provider display name, Telegram username or account assertion does not confer authority.
Communication has its own entities; `shared/board.ts` remains the derived/authored
obligation model. Rendering communication within Fabric does not create a second dashboard.
Telegram-disabled builds can pass COM-12/14: the frozen canonical table states this at
[lines 50–55](https://github.com/passioncode-ai/fabric/blob/2e06e5013595ec96b52b85cae2c486050632565b/docs/evidence/plans/2026-10-04-project-communications.md#L50).
An earlier observation of COM-14 depending unconditionally on COM-09 referred to an older
baseline and is not an unresolved conflict at this snapshot.

## Method, evidence and limits

Read the frozen Fabric source, the earlier [core research handoff](../../handoffs/2026-10-04-comms-core-research.md),
[RPT fabric/2026-10-04-com-board-ux §proposed paths](../2026-10-04-com-board-ux/proposed-paths.md)
and [RPT fabric/2026-10-04-telegram-board-transport](../2026-10-04-telegram-board-transport/README.md).
Those reports remain their original slices; their UX is proposed and their older adapter
pins are not current acceptance evidence. Independently fetched member main refs without
changing their worktrees, read commit-addressed sources and fetched official documentation
and maintainer comments. The bounded capture script records file/HTTP SHA-256, retrieval
time, exact comment timestamps and repository commits in
[repository-sources.json](raw/repository-sources.json) and [online-sources.json](raw/online-sources.json).
HTTP hashes identify retrieved bytes, not a permanent vendor version or acceptance result.

The stdlib [race model](raw/race_model.py) has 12 passing design checks;
[race-green.json](raw/race-green.json) contains every case. All five
[guard removal variants](raw/race-guard-removal.json) fail assertions. The model exercises
replacement, same-generation reclaim, lease expiry, resumed completion, cancel boundaries,
unknown retention, capacity and retired namespaces. It has no PostgreSQL implementation,
RLS, IPC, PTY, provider or Telegram calls. These are counterexamples supporting the design,
not watched-red production regressions or independent review. Local model/check results,
real-provider acceptance, hosted CI, installed bytes and release approval are separate gates.

Focused documentation structure and report-header checks pass. The required local fast tier
passed workspace types/design gates, then failed at `scripts/sync-product-ux.mjs:80` with
`UX projection stale`. All five projection input files match the frozen source bytes; the
failure is inherited source drift. The separate map gate also requires a new iteration entry
for these report inputs. Root owns UX projection/map integration under its leases; neither
failure is labeled passing here. See [verification.json](raw/verification.json) and sanitized
[fast.log](raw/fast.log). Three private workspace-submodule links were NOT_CHECKED by the
documentation gate. Full/hosted/native/database/provider/Telegram acceptance was NOT_RUN.

## Existing source and exact reuse boundaries

All Fabric file:line references in this section refer to commit
`2e06e5013595ec96b52b85cae2c486050632565b`; the raw source receipt provides hashes and matching
lines. The following are reuse points, not claims that a COM mailbox already exists.

| Existing source | Proven mechanism | COM reuse and gap |
|---|---|---|
| `packages/journal/src/index.ts:49,87,100` | Estate replay; single append RPC; only lock refusal `55P03` is retried | Ordered receipts and wakeups. Generic estate replay cannot safely expose participant message bodies or metadata. |
| `shared/scope.ts:58,70–78`; `main/scopedStore.ts:35,114` | Explicit private table category; project predicate and bounded pagination | Mark every COM primary/operational table private. A sender-or-recipient relation requires dedicated authorized RPCs; do not widen a Project scope to the estate. |
| `main/agentSurface.ts:185,414`; `main/accessService.ts:125–139` | Minted estate/Project/session identity; current binding authentication; known-verifier hints are not authority | Close COM tools over authenticated principal. Existing hub Product grants do not enroll a COM responder or authorize mailbox reads. |
| `main/continuationDelivery.ts:27,52,88–100`; `main/deliveryQueue.ts:26,94–106` | Durable claim/begin/result and readiness generation checked before PTY write; possible partial write becomes unknown | Reuse before-write gate and effect vocabulary. Current routing targets an existing task run, not a stable Project responder. Do not silently turn every message into a task. |
| `20260927000062_managed_stop.sql:369–458` | Current override of continuation dispatch: estate-first lock, DB-clock claim lease, claim UUID, latest run validation, refusal of previously started/unknown work | This override, rather than only migration 60, is the current template. COM must add responder generation plus principal/grant revision on every authorizing mutation. |
| `20260927000064_private_ceo_conversations.sql:12,43–61,123–127,154` | Private content and immutable intent, table access revoked, current membership checked, public journal receives opaque receipt | Reuse the separation between private data and safe receipt. COM has different Project participant authority; do not reuse CEO owner's ACL unchanged. |
| `20260927000065_restore_authority_boundary.sql:28,53,98,303–304` | Protected restore provenance; importing history does not restore authority | COM archival history may restore; enrollment, grants, claims and unsent outbox must not become live by replay. |
| `main/policy.ts:424–449`; `main/authContext.ts:35–42` | Separate effect dispatch fence; provider account auth revision/context | COM acceptance is not permission to publish/pay/delete. Invoke existing policy and current provider account context for effects; Project replacement does not transplant provider history/accounts. |
| `main/hubCall.ts:30–47` | Process-bound hub retry facts and unknown retention; retired binding fences | Durable COM receipts belong in DB. Do not describe current hub's in-memory process-lifetime cache as durable across restart. |
| `shared/board.ts:78–80`; `shared/readEnvelope.ts:26,50,100` | Answer/state-resolved obligations; source availability and default unknown freshness | Separate communication read model. Use existing freshness envelope, do not add mailbox dismissal/seen semantics to obligation resolution. |
| `main/agentRegistry.ts:50–57`; `shared/providerCapabilityMatrix.ts:28–33` | Descriptor/install provenance; measured provider build capabilities | Discovery is informational. Trusted managed-session provenance and externally asserted provider labels must be visibly distinct. Capabilities are build-bound, not universal. |

### Cross-repository owners and pins

The table is a source-map receipt, not proof that any member has adopted COM. Full SHAs
and file hashes are in `raw/repository-sources.json`.

| Owner | Inspected commit | Extension point and required boundary |
|---|---|---|
| [Contract](https://github.com/passioncode-ai/fabric-agent-contract/tree/df55c8c54a23251342a7ee57ba95642b7eb39e61) | `df55c8c5` | `src/extensions.ts`, `schemas/coordination.schema.json`, `schemas/interop-job-handle.schema.json`. Own future versioned COM envelope/capability fixtures. Coordination leases and job handles are not Project messages or responder authority. |
| [Adapter](https://github.com/passioncode-ai/fabric-agent-adapter/tree/907acb286abe55c627bfeb4500906b76d0284e81) | `907acb28` | `fabric-contract.lock.json` already pins `df55c8c5`; `building-fabric-services/scripts/fabric_interop.py` advertises MCP 2026-07-28 plus compatible legacy handshake revisions. Add COM enrollment/poll/ACK client helper and CLI-specific consumer packets; installation alone is not ACK. |
| [Dashboards](https://github.com/passioncode-ai/fabric-dashboards/tree/f7e806919c81f88d0fc7129c355c06c7036387ef) | `f7e80691` | `src/core/monitor.ts`, `packages/service-host/src/links.ts`. Read lifecycle/health and safe service links; launchd remains supervisor. Do not put Fabric mailbox write authority or full message bodies in descriptors. A service deep link is not an invented Fabric Project route. |
| [Switchboard](https://github.com/passioncode-ai/fabric-switchboard/tree/5e275caf50436f6a95eabad9c8e16bedade1ffe5) | `5e275caf` | `crates/switchboard-runtime/src/launch.rs`, `docs/packets/session-supervisor.md`. Managed launch/provenance seam; supervisor packet is planned work, not a present COM consumer. Process birth identity supports supervision, never replaces bearer authority. |
| [Observatory public engine](https://github.com/passioncode-ai/project-observatory-dashboard/tree/fb0350d081f2af53d5a18fa1dae67836774cf047) | `fb0350d0` | `observatory/engine/fabric_service.py` is vendored from Adapter `f31c2b2792f7` with upstream hash; update upstream then repin, never edit copied kit independently. `docs/design/FABRIC-INTEROP.md` owns its integration design. Export privacy-filtered receipts/metrics; no COM control plane here. The local private `project-observatory` registry is a separate owner and not production mailbox authority. |
| [Workspace](https://github.com/passioncode-ai/fabric-workspace/tree/fc19159515e23feee3b9b1438ec92775f0c960ed) | `fc191595` | `knowledge/vision.md`, `principles.md`, `rules.md`. Own product boundaries and generated task aggregation. Publish source commit/last sync; do not create another editable COM status table. |
| [Website](https://github.com/passioncode-ai/passioncode-ai.github.io/tree/25e138ff127bb6b7145ce30914f00178c71560e7) | `25e138ff` | `fabric/index.html`, `fabric/release.json`. Public narrative/screenshots only after real scenario/build receipts. No private estate/thread identifiers, unaccepted feature claims or mockup presented as shipped behavior. |

## COM-01 proposed contract

### Entities and storage

The names below are proposed conceptual names; COM-01/02 must choose canonical names under
lease and generate schema/types together. They do not identify existing RPCs or tables.

| Entity | Key and immutable fields | Mutable operational projection |
|---|---|---|
| Thread | `(estate, thread_id)`; participant Project IDs fixed at creation; initiator; context/artifact refs | Last authorized activity, closure revision; adding an audience requires an explicit new sharing command, never implicit forward |
| Message | `(estate, message_id)`; thread; server-derived sender Project/principal; kind `message/request/finding/reply`; optional reply/request IDs; body digest/private content; context version | Authorized content redaction tombstone; content cannot be edited into a different command |
| Request | `(estate, request_id)`; message; target Project; capability; deadline; command namespace/key/digest | `queued/claimed/accepted/in_progress/completed/failed_known/cancelled/expired/outcome_unknown`; expected revision on transitions |
| Project feed | `(estate, reader_project, ordinal)`; opaque eligible message reference | Dense participant-only ordinal; no estate sequence exposed to a Project reader |
| Read mark | `(estate, reader_subject, project, thread)`; explicit through-message ordinal | Monotonic high-watermark per reader; server confirms visibility and expected reader epoch |
| Consumer enrollment | Server UUID; principal/binding, Project, capability allowlist, trusted session or asserted external provenance, authority revision | Revocation and enrollment revision; credential stored only as existing verifier/reference |
| Responder slot | `(estate, project, capability, slot_key)`; one primary slot for v1 | Current enrollment, monotonically increasing generation, DB lease expiry, retirement |
| Delivery/attempt | Stable delivery ID for one request; attempt UUID, responder generation, principal/enrollment revision, semantic digest | Claim/begin/result state and DB lease; accepted/started work cannot be automatically issued twice |
| Command receipt | Logical Project + operation family + server namespace epoch + client key; full canonical SHA-256 | Immutable result/fact or authorized redaction; durable unknown tombstone |
| Optional transport intent | Stable logical message/destination/config revision/part key | Worker claim, before-send fence, confirmed/failed_before_send/unknown outcome, provider reference |

Use composite estate foreign keys and constraints for every cross-entity reference, including
reply target, artifacts, participant Projects, enrollment and delivery. UUIDs are data, not
ACLs. Reject cross-estate references and replies outside their thread in DB. Fix participants
before assigning feed entries so counts/search/unread summaries and bodies share one visibility
predicate. The trusted operator may have estate authority; agent routes never inherit it.

Private bodies, participants, request details, cursor rows, operational grants and transport
references require dedicated RPCs. Generic journal receipts must expose only opaque receipt
IDs and types whose metadata has passed a deliberate disclosure decision; no Project names,
body, participant set, recipient or error echo that would disclose hidden conversation.
If even existence/timing is sensitive, keep that receipt private too. Public estate journal
must not become a backdoor through search/export/backups. COM-02.A establishes this boundary
before a first message is persisted.

Proposed v1 hard limits, to be confirmed by COM-01: 64 KiB UTF-8 body, eight authorized artifact
refs, structured context depth eight, page size 100, one primary responder per capability,
60-second DB lease renewed around 20 seconds with jitter. Reject excessive inputs before
body hashing/storage; bound decompression, traversal, HTTP/body reads and response encoding.
These numbers are proposed resource bounds, not measured throughput or existing limits.

### Principal, consent and scoped grants

The existing MCP endpoint authenticates the bearer and closes tools over server-derived
estate/Project/session. COM adds explicit enrollment and scoped permissions: `submit`
(recipient Project/capability allowlist), `read_participant_history`, `respond` (capabilities),
`manage_responder` (replace/revoke), `reconcile_unknown`, and optional `transport_mirror`.
An operator's current estate membership revision is checked by protected commands; an agent's
current binding/enrollment/permission revision is checked by DB authorization. Grant revocation
while a vault read, readiness wait or network preparation is pending must be observed again
immediately before begin. Route-specific enrollment does not elevate the credential to
estate-wide table reads or existing publication/money/deletion grants.

V1 `read_participant_history` explicitly covers messages for the enrolled Project that are
within immutable thread participant sets, including their retained history. It is not private
Person/CEO content or every message in the estate. If finer within-Project privacy is needed,
stop and extend audience scopes/RPCs; do not ship an undocumented broadening. Provider/account
name from an external enrollment is asserted unless verified through managed runtime receipts.
Enrollment, renewal and replacement cannot be authorized by a supplied PID, model name,
localhost origin, launcher label or service descriptor.

### Short APIs and consistent cursors

Proposed short tools (names require contract ownership): `com.submit`, `com.list`, `com.get`,
`com.read_ack`, `com.reply`, `com.cancel`, `com.status`; consumer tools
`com.enroll`, `com.responder_replace`, `com.claim`, `com.renew`, `com.accept`,
`com.progress`, `com.effect_begin`, `com.complete`, `com.reconcile`.
Every mutation accepts an explicit idempotency namespace/key, semantic version/digest and
expected entity revision as applicable. Actor/estate/source Project/authority revision are
injected from the trusted endpoint, never accepted as authorizing payload. Reject unknown
fields and conflicting IDs at HTTP/MCP and DB boundaries. Completion references one request,
accepted delivery, generation, attempt and evidence; a reply alone is not completion.

Reads return a typed `ReadEnvelope` with source commit/schema, snapshot/high-watermark,
freshness, current audience policy and continuation cursor. Realtime/NOTIFY only wakes readers;
durable polling recovers missed wakeups. PostgreSQL documents transactional notification;
that mechanism does not durably store the mailbox payload.
[PostgreSQL 17 NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html).

Prefer a server-issued opaque cursor ID backed by a private bounded row: bind estate,
reader principal/Project, enrollment/grant revision, reader epoch, filter digest, page snapshot
upper ordinal and last ordinal. No raw estate sequence or hidden count. Pagination advances
only across visible feed entries; after finishing a snapshot a new refresh includes later
inserts. A revoked grant, restored estate, scope/filter change or expired cursor returns typed
`cursor_reset_required`; it never silently changes audience. Cursor rows may expire and be
bounded per reader because reads are safely repeatable. Effect receipts obey a different
retention policy. `com.read_ack` is explicit; fetching/polling does not mark a human or another
agent as having read. Unread counts are reader-scoped, not a Project-wide claim that everybody
read the thread.

### State distinctions that must survive API and UI

Persist separate facts: message stored, consumer claim, PTY write started, PTY written,
agent acceptance, work progress/completion, effect dispatch/observation, transport send and
human read mark. `accepted` means the current consumer explicitly acknowledged the exact
request/digest, not that an effect succeeded. Telegram confirmation means its API returned a
message reference, not that anyone read it. Cancellation before begin prevents dispatch;
after begin it stops further authorized work while retaining possible external effect as
unknown until observation/reconciliation. Lease expiry/PID death is evidence about ownership,
not proof of no effect. Only positively failed-before-write work may be safely reassigned.
An accepted workflow may be continued by a new responder only through an explicit checkpoint
transfer whose pending effects are known; accepted state alone is insufficient.

UI proposals from the UX report must show these states separately with evidence/freshness,
current trusted-versus-asserted provenance, queue position where authorized, reply/request
relation, transport-disabled/offline/unknown labels and reader state. Only authorized controls
for retry/reconcile/replace may appear, and every control uses expected revision. Raw process
alive status cannot turn a message green. Questions remain answered by answers; derived
obligations leave when their causal state changes, not when a mailbox item is read.

## Database generation, claim and effect fencing

Use short protected transactions in the existing estate-first lock order. Read current
membership/binding/enrollment and slot generation; allocate a claim with a new attempt UUID.
Initial enrollment claims an empty slot using expected generation zero. Replacement compares
the current generation and requires `manage_responder`; one concurrent replacement wins and
the other receives a typed conflict. A renewed expired claim receives a new attempt even if
the responder generation stays the same. Compute leases from DB time, not client wall clocks.
Monotonic generations must survive consumer deletion and restore retirement; do not recreate
an empty slot at generation zero with old claims still valid.

Every authorizing ACK, renew, reply, progress, begin and completion checks exact current
principal, authority/enrollment revision, generation, attempt, digest, applicable entity
revision and DB lease. Current-grant validation and effect-state transition occur atomically.
Do not hold a DB transaction open while an LLM thinks, PTY waits, vault decrypts or HTTP sends.
A claim taken by a second worker does not justify committing the former worker's late result.

This follows both [PostgreSQL's current-row recheck for concurrent updates](https://www.postgresql.org/docs/17/transaction-iso.html)
and the concrete [pg-boss owner review](https://github.com/timgit/pg-boss/pull/890#issuecomment-5624267303)
(2026-09-10): losing the queue claim while handler writes continue can commit effects twice.
The [contributor correction](https://github.com/timgit/pg-boss/pull/890#issuecomment-5625222211)
shows why a requested settle count is not proof of successfully settled IDs. Therefore tests
must resume the former handler through its final commit and check affected rows/effects,
not merely observe that another worker acquired a lease. This report adds no pg-boss dependency.
`SKIP LOCKED` is suitable for bounded queue claim contention, not an authoritative consistent
board reader: [PostgreSQL 17 SELECT](https://www.postgresql.org/docs/17/sql-select.html).

Fences govern Fabric-mediated state/effects. They cannot terminate a former process's thought
or prevent a direct effect using independently held provider credentials. For supported COM
execution, provider calls must pass the existing policy/hub dispatch boundary or a separately
proved adapter boundary with provider idempotency. An unmediated external responder is
informational/respond-only unless its effect authority is separately authorized and measured.
Do not claim exactly-once external execution from a DB lease.

### Durable bounded idempotency

Use the logical Project/operation namespace, not provider/session identity, so a replacement
can retry the same accepted command. Canonicalize semantic fields with an unambiguous framing
and full SHA-256; destination, participant audience, request/reply target, operation version,
artifact content identifiers and deadline are semantic. Same key/digest returns the same
receipt after current authorization; changed semantics conflict. A new key represents a new
command; general idempotency does not deduplicate arbitrary equivalent business actions.
An effect's request/delivery identity and existing policy fence prevent two effect begins.

Finite storage requires refusal, not forgotten authorization. Issue server namespace epochs
with finite key capacity and expiry for admitting new commands. Before admitting, allocate a
receipt slot; when full, refuse before any effect, retaining prior answered/started/unknown
facts. Close an epoch and persist a monotonic retired-epoch floor. A retry from an old epoch
returns `idempotency_window_expired/reconcile_required` even after individual terminal
receipts are compacted; missing old receipt never becomes a fresh write. Unknown effect
facts remain until authorized reconciliation; namespace/Project quota cannot be bypassed
by replacing a bearer or opening fresh epochs. Redacting content preserves identity/digest,
minimal outcome and retirement boundary. All expiry decisions use DB time. Expiration of a
cursor, lease, request or provider retry window is not expiration of effect uncertainty.

## Optional Telegram transport boundary

Telegram is a projection/ingress transport. COM-08/09 must preserve the same current-principal
permissions; chat membership or a bot reply is not Fabric consent. Freeze Bot API **10.3**
(2026-08-24), observed from the [changelog](https://core.telegram.org/bots/api-changelog), and
record actual server/bot-mode evidence at acceptance. Current [bot communication rules](https://core.telegram.org/bots/features#bot-to-bot-communication)
allow direct group commands/replies when at least one bot has the mode; private bot exchange
requires both modes. Ambient group reception additionally requires receiving mode plus admin
or disabled privacy. No implicit admin, privacy or BotFather changes are authorized by COM.

The [API](https://core.telegram.org/bots/api) makes polling/webhook exclusive, retains updates
at most 24 hours, may randomize update IDs after a week idle, limits text to 4096 characters
after parsing, and supplies flood retry delay. Its IDs require lossless storage. Dedupe
per-bot updates separately from cross-bot `(chat,message,event kind,edit revision)` inputs;
authorize stable numeric identities, not usernames. The [maintainer comment](https://github.com/tdlib/telegram-bot-api/issues/837#issuecomment-4141729842)
(2026-03-27) distinguishes duplicate updates from payment/business idempotency.

Atomic board commands create transport intents in the same DB transaction. Claim each intent
with current config revision/generation/attempt and a before-send fence; recheck mirror grant
after vault reads. Send outside the transaction; lost response after send becomes durable
unknown, never automatic resend. Confirmed message IDs prove only transport confirmation.
Record part identities for splitting; never forward arbitrary inbound formatting/attachments
as executable commands. Bound loops by causal origin, depth, deadline, per-bot/chat rate and
cost budgets. Optional transport drain/restart, token rotation, gap detection and reconciliation
have their own acceptance. Never log token-bearing Telegram URLs, token values or private chat
payloads. Disabling transport stops new sends while preserving outstanding uncertain effects.

## Protocol version and bootstrap/adoption contract

The official [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
is stateless and uses per-request capability metadata; the
[Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview) is explicitly
opt-in. Those are transport semantics, not Project addressing/ACL. Use short COM submit/status
calls and Fabric durable request IDs first. If a long operation is exposed, use an advertised
interop job handle fallback until actual clients prove Tasks support; do not infer capability
from SDK dependency version or a successful legacy `initialize` alone. Cancellation remains
cooperative and may race completion. Do not broaden the current hub/P08 wire during COM research.
Adapter's declared revision and compatibility list are source facts, not a real current client
exchange receipt; test actual installed Claude and Codex revisions independently in COM-04.

Bootstrap order: install compatible contract/types and DB private storage with feature off;
install read-only capability discovery; explicitly enroll principals/capabilities; register
current managed session; enable one bounded Project pair; prove current-client ACK and restart;
then activate more Projects/modules with recorded version/hash/revision receipts. Legacy
consumers without COM stay unsupported, not silently enrolled. A skill hook or config file
copy is not acknowledgement. A real adoption receipt names authenticated consumer/session,
contract revision/digest, capability set, current policy/enrollment revision, explicit accepted
probe message, source/build hash and observed time. Published docs and monitor service
health are separate receipts.

Rollout ownership follows the member table. Fabric owns durable data, RPCs, lifecycle,
operator controls and read projections; Contract owns interoperable schema fixtures; Adapter
owns helpers/provider instructions and measured provider lanes; Dashboards owns service status;
Switchboard owns supervised launches; Observatory owns privacy-safe analysis; Workspace owns
knowledge/derived aggregation; site owns only evidence-backed public claims. Existing service
kits remain vendored/pinned. Telegram may use a launchd-managed worker if packaging calls for
one; it must not become a mandatory second daemon for the core board. No service process is
started directly by Dashboards.

On shutdown, stop claiming, deny new begin after the shutdown/authority revision, and release
only positively unstarted claims. Persist pending send/write as unknown before exit where
possible; a crash recovery pass must conservatively classify started-without-result. On
restart, poll durable state, acquire fresh current enrollment/slot and reconcile uncertain
work without reissuing. Do not import a service kit's drain duration as a measured Fabric
shutdown guarantee. Restored history starts with consumer/grant/transport authority disabled;
owner re-enrollment and explicit reconciliation are prerequisites to activation.

## Acceptance decisions and bounded next work

The [implementation packets](../../handoffs/2026-10-04-project-comms-implementation-packets.md)
define ordered write ownership, red regressions, handoff artifacts, stop and rollback for
COM-02/03. COM-01 still needs a normative owner decision for extension name/version; whole
Project-history read grant; audience sharing/redaction/retention; namespace capacity and retired
floor; slot capability/lease defaults; checkpoint transfer after acceptance; mediated external
effects and optional transport exposure. Proposed defaults above make those decisions reviewable;
they are not silently approved migrations. COM-06/07 scenarios and visual design remain their
owner's work, and actual installation/native/provider/Telegram qualification stays open.

COM-14 core acceptance must cover authorized two-Project conversation, replacement and old
handler resumption, same-generation reclaim, current-grant revocation during async waits,
lost DB/PTY/provider response, shutdown/restart, restore isolation, bounded idempotency,
participant-only bodies/counts/cursors/artifacts and exact installed-build evidence. Telegram
adds separate opt-in bot exchanges and transport failure tests. Metrics distinguish queue delay,
write/accept/complete latency, unknown effects, unsupported consumers and stale sources. Actual
cost/token observations identify provider/session/command and source; absence is unavailable,
not zero. Trace IDs correlate evidence and never grant authority.

## Reproduction and corrections

Run `python3 docs/reports/2026-10-04-project-communication-architecture/raw/race_model.py`.
Each `--mutant generation|attempt|expiry|epoch|unknown` invocation must exit one. The source
capture is read-only but intentionally performs online fetches; do not mistake rerunning it
for extending this immutable report's as-of date. A changed implementation/protocol needs a
new report slice with supersedes/source commits, not rewriting this slice into a live status page.

This task intentionally leaves canonical plan, map, shared registers, UX, ADRs, migrations and
wiki index unchanged. Parent integration must claim any guarded publication/index update.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — cold implementation packets and evidence boundaries
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — versioned MCP capability boundaries
- `project-reports` — dated report with raw receipts — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
