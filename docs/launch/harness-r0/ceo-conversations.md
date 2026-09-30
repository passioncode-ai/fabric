<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# CW-N1a · Durable operator conversation: accepted architecture and implementation contract

**Status: architecture accepted by [ADR-0075](../../adr/0075-private-ceo-content-and-opaque-journal-receipts.md); bounded storage/authorization packet implemented and tested; native drafts/send-service core is implemented; IPC, UI and full CEO runtime remain unactivated.** Inspected
2026-09-27 at source [`8dde15bff86b4f20d2edb5bdaa1159fa27a9cd9c`](https://github.com/passioncode-ai/fabric/tree/8dde15bff86b4f20d2edb5bdaa1159fa27a9cd9c).
The original document-only packet is followed by reviewed storage implementation
`10b6fefde71d630ffe2c350d0f0b8a9408476866`. Root integration owns schema64
admission, private scope/archive classification, source gates and publication.

The first value is returning to the same question with the original discussion,
unsent draft and exact saved context after restart, even if the agent changes.
This serves the Project operating loop in [the vision](../../ux/vision.md#9-the-alignment-test),
not a second cockpit for provider sessions. This packet specifies durable input;
provider dispatch, answer generation, voice, attachments and autonomous effects
remain separate capabilities with their own acceptance.

## 1. Existing decisions and accepted refinements

| Source | Constraint retained | Refinement accepted by ADR-0075 |
|---|---|---|
| [ADR-0065, decision 3](../../adr/0065-conversation-led-work-and-context-bundles.md) | Each Board question opens an addressable CEO discussion; only an explicit validated command resolves the question | One stable conversation **per operator and subject**, rather than assuming one shared transcript for everyone viewing a question |
| [ADR-0067](../../adr/0067-conversation-context-and-typed-chat-widgets.md) | Conversation identity is independent of selected knowledge; sent snapshots immutable; selected Projects confer no authority | Operator-private audience is fixed at creation. A separate explicit New action creates a global conversation; reopening a Project/question selects its stable private conversation |
| [Operator interaction, sections 5/6 and AD01](../../architecture/operator-interaction.md) | Private notes do not become team transcripts; permitted excerpts and explicit outcomes can be published; journal is the canonical business record, drafts use localState | Option B below stores message content behind an authoritative journal reference, rather than plaintext in the Estate-readable payload. ADR-0075 accepts this journal/content split |
| [AD09–11](../adoption/contracts.md#exact-dispatch-prerequisites) | Atomic message/request recovery, exact audience, exhaustive references, offline save distinct from delivery | No inferred conversation authority from provider bindings, membership labels, Project selection or UI visibility |
| [CW-N1/N2](../chat-workspace.md) | Durable draft/history first; bounded multi-source compiler follows | N1a accepts explicit none/single-Project reference snapshots only; unsupported many/all/attachments refuse, not silently downgrade. Full CW-N2 remains open |

**Resolved architecture:** ADR-0075 fixes operator-private per-subject identity,
option B, visible ordinary participation metadata and mandatory owner-portable
backup before activation. ADR-0067's conversation/context separation is retained.
N1a limits New to global conversations; additional conversations for one ticket are
outside this packet. These are accepted target contracts, **not an existing
security guarantee**. No historical ADR is rewritten; implementation acceptance
remains per packet below.

## 2. Measured seams and the privacy gap

Paths and line numbers below refer to the inspected commit above, not a claim that
future code keeps identical line numbers. Repository-relative links resolve from
this document; each source can be inspected at that commit with `git show`.

| Existing seam | Evidence | Reuse / limit |
|---|---|---|
| Journal append and replay | [packages/journal/src/index.ts](../../../packages/journal/src/index.ts), `createJournal` line 71, replay line 113 | Keep the existing writer/order. Append alone is not command idempotency |
| Prepared ingress | [desktopIngress.ts](../../../apps/desktop/src/main/desktopIngress.ts):34; [commandIngressAdapters.ts](../../../apps/desktop/src/main/commandIngressAdapters.ts):70; [commandIngress.ts](../../../apps/desktop/src/shared/commandIngress.ts):188 | Add explicit coverage for the new input/event shapes; never use an external-owner exemption as preparation |
| Held authority | [identity.ts](../../../apps/desktop/src/main/identity.ts):54, `guard`; [shared/identity.ts](../../../apps/desktop/src/shared/identity.ts), `Subject` / `actorOf` | Principal is trusted `Subject.personId`. Actor label `operator` is not a UUID or permission proof |
| Draft CAS/recovery | [localState.ts](../../../apps/desktop/src/main/localState.ts):115,197; [onboardingDrafts.ts](../../../apps/desktop/src/main/onboardingDrafts.ts):51 | Reuse primitives in a separate conversation-draft schema; do not reuse onboarding keys |
| Question outcome | [index.ts](../../../apps/desktop/src/main/index.ts):2240,2253; `commitPreparedAnswer` | Publishing an outcome is a distinct existing canonical command, not an effect of saving text |
| Current context builder | [contextPack.ts](../../../apps/desktop/src/main/contextPack.ts):78,148 | Existing input requires one Project; borrow bounded/source-aware mechanics, not a claim of many/all chat support |
| Existing reference grammar | [entityRef.ts](../../../apps/desktop/src/shared/entityRef.ts):36 | Missing Message/Conversation/TaskRun kinds; extend this union and resolver together when emitted |
| Current UI/provider store | `AttentionPanel.tsx`:8 (retired 2026-09-29; its acts now live in [ObligationActs.tsx](../../../apps/desktop/src/renderer/src/launch/ObligationActs.tsx), rendered by the Board screen); [conversationRegistry.ts](../../../apps/desktop/src/main/conversationRegistry.ts):1 | Panel explicitly has no dialogue; registry is local provider/account routing, not CEO history |
| Existing operational outbox | [migration 60](../../../supabase/migrations/20260927000060_continuation_dispatch.sql):3 | TaskRun/claim-specific; reuse recovery principles, not its rows as a generic CEO request queue |

The concrete privacy gap is [migration 1](../../../supabase/migrations/20260831000001_migration_one.sql):280–296:
`member_journal_read` permits Estate members to read every journal row. Service-role
readers bypass RLS; [scopedStore.ts](../../../apps/desktop/src/main/scopedStore.ts):35
and [scope.ts](../../../apps/desktop/src/shared/scope.ts) scope journal by Estate/Project,
not person. `IPC.feedReplay` in `index.ts`:3184 forwards the complete payload from
`journal.replay`. [backup.ts](../../../apps/desktop/src/main/backup.ts):71 reads and
exports the entire Estate journal. Therefore **adding owner_person_id to a payload
cannot make its text private**, and redaction of recognizable credentials does not
remove private discussion or confidential business content.

## 3. Storage alternatives and smallest safe choice

| Alternative | Required boundary and blast radius | Restore / risks |
|---|---|---|
| A. Private event family containing text in the journal | Restrict authenticated journal RLS; prevent private-family reads through every service-role feed, replay, search, export, backup, diagnostics, context reader and future generic consumer. Private metadata, not only body, needs filtering. Unknown private event versions must fail closed | Existing journal-only archive includes private text unless split/authorized. Restore must preserve audience and cannot reinterpret operator labels as the restoring operator. Broad existing-reader change, including generic full-payload feed |
| B. Journal records opaque receipts; private content in an explicitly protected canonical store | New service-only immutable content rows plus dedicated owner-authorized reader and commands. No generic ScopedStore access. Journal carries opaque references, never body, title, excerpt, context source IDs, attachment paths or private digest. Same-DB transaction can join content, receipt and pending request without an object-store saga | Existing journal archive does not contain content; readers must report unavailable content after metadata-only restore. Private backup/retention and restore ownership are explicit, not silently delegated to projection rebuild |

**Accepted choice (ADR-0075): B, using protected PostgreSQL primary content.**
It avoids teaching every current Estate feed how to hide plaintext and permits one
transaction. This requires implementation; it is not an existing blob service: migration 8's
transcript table contains content-addressing preparation, not a reusable private
CEO blob store. Do not reuse its Estate-readable policy. No new cloud object store,
encryption key service or provider-native conversation database is required by N1a.

B preserves the journal as authority that a message was accepted; the referenced
immutable content is primary data, **not a rebuildable projection**. The proposed
journal receipt includes only a schema version, generated opaque conversation,
message/request/content IDs and commit identity. Put the subject, principal mapping,
selected refs, canonical digest, body and detailed reason in protected storage.
Standard journal actor/time/sequence still disclose that an operator made an event;
B promises content privacy, not invisible participation. If that metadata is also
private, choose A or a separately reviewed envelope policy; do not claim B solves it.
A public plaintext hash permits dictionary guessing of short messages, so it stays
inside the protected store; an opaque reference is not an authorized download URL.

Local privileged host/service-role code and database administrators remain trusted.
The single-operator identity mode is not independent multi-user OS authentication.
No claim of secrecy against the host administrator or possession of service keys
is made. Backend code must not expose arbitrary protected-table queries via MCP/IPC.

**Backup/retention activation gate:** classify the new primary store explicitly in
`shared/archive.ts` and backup/export UI. A standard Estate archive must exclude
private content and state that exclusion. An owner-scoped private export/restore
must validate owner, Estate, referenced receipts and content digests before writing;
no automatic reassignment to the restoring operator. Different-Estate restore
requires an explicit reviewed mapping or refuses. Ordinary projection rebuild
preserves existing primary content; empty restore without a private companion
returns `content_unavailable`, never an invented empty conversation or a ready
request. R0 activation requires a tested owner-portable backup/recovery path.
ADR-0075 permits no local-only waiver.
Retention/delete choices must preserve safe journal tombstones, revoke derived
excerpts/indexes, and never restore deleted text from summaries or an old import.

## 4. Proposed identity and port contract

These are service-level port names. The dispatched storage packet fixes four SQL RPCs: `ceo_open_conversation`, `ceo_send_message`, `ceo_read_conversation`, `ceo_send_receipt`; code and transaction acceptance are separate from this contract.
All IDs are typed UUIDs; revisions are validated nonnegative integers, not strings.
Trusted main derives Estate and principal from its established identity; renderer
and agent inputs cannot nominate another principal. SQL still checks held membership
and revision transactionally. Rejoining with the same Person does not bypass current
membership checks; a new Person does not inherit the old Person's private discussion.

```text
Subject = { kind: question | project, id: UUID }
        | { kind: global, id: conversationId }
PrivateKey = (estateId, principalPersonId, subject.kind, subject.id)
Conversation = { id, PrivateKey, ownerProjectId: UUID | null, revision }
```

Unique `(estate, principal, kind, subjectId)` ensures concurrent open from Board and
Project returns the same question conversation for that operator. `ownerProjectId`
is resolved from the question/project in the same Estate, not accepted from renderer.
Global New supplies a freshly minted stable conversation ID plus operation ID;
retrying that operation returns the original conversation. Explicit history reopens
by exact ID. Project rename does not change identity. A missing/archived subject is
not auto-recreated: existing authorized history is read-only with an unavailable
subject marker; new send requires an active subject. No foreign existence detail
is returned to unauthorized callers. A question resolved elsewhere retains its
history; send reports the changed subject state/revision for deliberate resubmission.

| Proposed port | Input and result | Failure / repeat rule |
|---|---|---|
| `openSubject` / `newGlobal` | Subject or new global ID, stable operation ID → exact conversation ID, revision, subject read status | Reopen returns same row; same operation with another subject conflicts |
| `readConversation` | Exact conversation ID, opaque page cursor → bounded authorized messages, next cursor, content/read status | Current membership and owner checked on every page; unknown ID/foreign owner give uniform unavailable |
| `readDraft` / `saveDraft` | Conversation ID, expected local revision, prepared draft → saved local revision | Null expected revision means create only if absent; stale CAS never overwrites another window; corruption is quarantined, not treated as empty |
| `sendMessage` | Envelope below → accepted receipt or typed refusal / commit unknown | Retry/reconcile uses the frozen original operation; explicit same-input SQL retry is idempotent and creates no model effect, while receipt not-found alone proves no absence. Never mint a replacement operation to hide an unknown result |
| `getSendReceipt` | Exact conversation and operation IDs → original receipt, not-found, unavailable | Current authorization applies even to repeats; not-found does not prove no in-flight transaction can still commit |

```text
Conceptual service envelope (storage wire uses CeoSend@1 snake_case fields) = {
  conversationId, operationId, messageId, expectedConversationRevision,
  subjectRevision, inputChannel: text,
  preparedBody, preparationVersion,
  contextSnapshot: CeoContext@1
}
AcceptedReceipt@1 = {
  conversationId, messageId, requestId, operationId,
  conversationRevision, journalSeq, canonicalDigest,
  state: accepted_pending, dispatch: unavailable, repeated
}
```

`requestId` is deterministically bound one-to-one to the operation in the trusted
transaction, never regenerated on a transport retry. Receipt fields are validated
against the caller's expected identities. Detailed receipts and digest are private.
Refusals use fixed reason codes (`unavailable`, `stale_revision`, `idempotency_conflict`,
`unsupported_context`, `invalid_input`, `persistence_unconfirmed`), not raw text,
paths or database errors. No `delivered`, `processing` or successful assistant
response is emitted until a later worker has evidence for that state.

## 5. Draft, send and recovery state table

| State / action | Durable effect | Result and next permitted transition |
|---|---|---|
| Open subject | Idempotent conversation creation/lookup; no task or provider launch | Ready or authorized read-only history |
| Edit / autosave | Prepared local draft under `(Estate, principal, conversation)` CAS | `saved_locally`; no implication of server acceptance |
| Send while offline | Freeze a prepared local send intent with original IDs and snapshot; do not claim a server request exists | `saved_locally`, waiting for deliberate retry; no automatic provider dispatch |
| Send online | Revalidate authority/subject; transaction creates protected content, accepted event, receipt and pending request exactly once | `accepted_pending`; this slice keeps worker dispatch disabled |
| Authority/source/revision changed | No accepted message or request is created | Keep local draft/intent; show precise safe refusal; edited resubmission gets a new operation ID |
| Commit response lost | Keep the frozen intent; query original receipt | `commit_unknown` is local knowledge, not a second business outcome; bounded retry of the identical command is safe through transactional idempotency |
| Retry after confirmed acceptance | Read original receipt before expected-revision conflict evaluation, but after current authority check | `repeated:true`; no new journal event/content/request |
| Accepted receipt, then local draft cleanup fails | Accepted message survives; local send intent retains exact operation ID | Restart reconciles and clears only matching saved draft revision; newer typing must survive |
| Minimize / navigate / restart | No resolution, cancellation or deletion | Reopen same conversation and local draft; late receipt updates only its original conversation |
| Revoked ownership/membership | No read/send/export; clear in-memory rendering and stop future draft autosave for that identity | Local retained bytes remain protected by host policy; revocation cannot retract already read text or promise filesystem erasure |

Pending requests are recoverable queue records, not permission to dispatch. Future
workers require a separate operational claim/attempt with authority, exact packet,
budget and native readiness checks. A write whose external outcome is unknown cannot
be replayed from a message or projection rebuild. No worker is activated in N1a.

## 6. Immutable context and canonical preparation

The storage packet freezes `CeoContext@1` with exact fields:
`schema`, `mode: none|one`, `selection_revision`, `project_id`,
`project_revision`, `estate_seq`. None requires null Project ID/revision; one
requires an authorized same-Estate Project ID and current configuration revision.
The Estate cursor is a journal read boundary, **not source completeness** and never
a permission grant. Conversation subject/command destination remains separate:
Question revision comes from `questions.revision`, Project revision from
`projects.config_revision`, global revision is zero. Future cursors refuse. An
exact operation repeat is authorized first, then reconciled before mutable-state
checks; new sends require current subject and selected-Project revisions.

The first storage packet accepts text only and none/single selection; unsupported
many/all/file/voice inputs refuse, preserving the draft. The complete R0 target
still requires these later capabilities. CW-N2 adds bounded compiled source bytes;
old selections are never silently expanded. Prior authorized conversation history
is independent of optional knowledge mode none.

Preparation must run on the original text before clipping, splitting, titles,
telemetry or hashes, using [HAR06](ingress.md). Repeat preparation is idempotent.
Reject unsupported fields, secret-bearing authority values, invalid refs, accessors,
non-JSON data, unknown versions, excessive depth/bytes/ref count, not partial truncation.
Drafts and frozen local send intents also cross this boundary. No raw voice audio,
credentials, hidden reasoning, provider logs or attachment bytes belong in N1a.

The storage packet freezes `CeoSend@1` as fixed-order UTF-8 length-prefixed
fields (`byteLength:value`; null uses `-1:`), including Estate and Person identity,
operation/conversation/message IDs, revisions, prepared text, preparation version
and the context selection. SQL and JavaScript must share golden vectors with
Unicode, newlines and delimiters. JSON renderer output is not the canonical hash.
Transient transport timestamps, retry count and renewed membership revision are
excluded. Different prepared intent under an existing operation key conflicts;
original secret-bearing text is deliberately not retained to distinguish inputs
that prepare identically.

Frozen bounds: original **and** prepared body ≤32,768 UTF-8 bytes; wire envelope
≤65,536 bytes; pages ≤50 messages; revisions/cursors are nonnegative safe integers
≤9,007,199,254,740,991. Overflows refuse before persistence rather than truncate.
Exact wire measurement and SQL/JavaScript boundary parity are implementation
acceptance requirements. Typed SQL fields reject null/wrong shape without NULL
fallthrough. SQL is service-role-only and trusts the prepared producer's version;
that is not a claim of independent universal secret detection in SQL. Packet2's
trusted preparation binding is mandatory before activation.

## 7. SQL authorization and replay boundary for option B

Proposed schema responsibilities (names illustrative until packet allocation):

- Protected primary records: conversation ownership/subject, immutable message body
  and snapshot, private operation receipt. Unique keys cover owner/source and
  `(Estate, principal, operationId)` across operations; foreign conversation/message
  identity reuse refuses. These tables deny anon/authenticated direct access and
  service-role direct mutations; purpose-built service-role-only functions own writes.
- A pending request is created atomically with message acceptance. Operational worker
  claims/attempts are separate from projections and cannot be reconstructed as fresh
  grants. Since N1a has no worker, every request remains visibly dispatch-unavailable.
- Registered opaque journal receipt events are appended through the existing writer.
  No title, subject link or content digest is smuggled into their public envelope.
  Registered projector branches reconstruct only safe reference/status projections.
  The trusted command links its event to the already inserted private record in the
  same transaction; direct raw append/import cannot impersonate that accepted command.
- Acquire the existing Estate advisory lock before narrower conversation/operation
  locks. Check held Person membership revision under lock; authorize current subject
  and selected refs; enforce expected conversation/source revisions. Repeat lookup
  runs before mutable revision checks but after current authority and identity checks.
- Use explicit `search_path`, exact event/schema version and strict typed UUID fields;
  reject null/wrong-type/mismatched actor, Estate, identity, receipt or digest. An agent
  `system` label must not be accepted as an operator-private write capability.
- Owner-scoped readers, receipt lookups and exports recheck current identity. The
  public event's opaque ID never bypasses this check. Service-role possession alone
  is not proof that a renderer/agent is the owner; main must derive principal, not
  accept a person ID from the input. SQL can verify a trusted main's assertion but
  cannot authenticate a human merely from a service-role RPC parameter.

**Replay:** a projector cannot call provider/PTY, insert a dispatch claim, regrant a
consumed attempt, recreate deleted private content, or consult the current operator
as historical owner. Replay validates receipt structure without requiring current
membership, which may legitimately be revoked after the event. Historical authority
is the accepted transaction; current authority governs reads. Existing private rows
survive projection-only rebuild. Metadata-only restore produces unavailable-content
references and no dispatchable pending records. A private companion restore verifies
content identity/digest, tombstones, owner mapping and provenance before atomic import;
rebuild must work before/after private-content availability without inventing messages.

Never make primary content a projection merely to fit a generic rebuild utility.
Event-time meaning cannot depend on today's Project name, latest source revision,
membership, default provider or private content that has since been deleted.

## 8. Bounded implementation packets and proof

Storage packet1 is **implemented and tested in an owned PostgreSQL fixture**;
packet2a service/draft core is implemented; IPC and packet3 remain planned and are not runtime acceptance. Packet1 uses ADR-0075
and migration64. Exact write sets and serialization
limits are frozen at each dispatch; existing files below name seams, not blanket ownership.

| Packet | Inputs / exact seams | Required output / negative acceptance |
|---|---|---|
| 1. Privacy, identity and durable SQL | Accepted audience/storage ADR; coordinated new migration; `schemaContract.json`, schema readers/projector registry and HAR06 schema coverage | Owned disposable PostgreSQL full-chain tests: same-subject concurrent open; double send; changed payload under same key; lost receipt; revoked/changed membership; wrong Estate/person/source; raw append/import forgery; JSON null/type/schema mismatch; two authenticated principals cannot read each other's content; public journal contains only approved metadata; service-role direct table writes denied; rebuild and metadata-only restore do not create content or dispatch rights |
| 2. Native service, draft and IPC | Packet 1 receipt; `identity.ts`, `localState.ts`, `commandIngress.ts`/adapters; authoritative `shared/types.ts`, `preload/index.ts`, `index.ts` bootstrap/handlers | Actual service/IPC fixture: CAS collision, corrupted local file, failed write, offline intent, restart before/after server commit, slow/late response after context switch, accepted send versus newer draft, current authorization on repeats/reads, sanitized bytes equal persisted digest. No model/native launch; no bare database errors in renderer |
| 3. Minimal conversation entry and recovery acceptance | Packets 1/2; current `App.tsx`/`AttentionPanel.tsx`/`BoardPanel.tsx`, canonical SCN-042/FLW-24 and ref resolver; owner archive inventory/export/restore boundary | Question→same private chat, explicit global New/history, compact draft/status, keyboard/focus, switching and cold restart; subject resolved elsewhere; missing/revoked source; another principal never sees raw discussion. Tested owner-private portable backup/restore is mandatory before activation. UI states accepted-pending, unavailable and unknown remain distinct; no simulation claims CEO replied |

CW-N2 compiler, CW-N3 typed outcomes/widgets and the HAR05 CEO loop follow their own
receipts. Publishing a reviewed result uses the existing question/task command and
only an explicitly permitted excerpt/reference; it never shares the raw conversation.
A team member may read the published result without permission to open its private
source, in which case the link reports unavailable instead of leaking an excerpt.

Existing focused regression commands, **not run by this documentation packet**:

```sh
node --experimental-strip-types apps/desktop/test/command-ingress-adapters.test.mjs
node --experimental-strip-types apps/desktop/test/desktop-ingress.test.mjs
node --experimental-strip-types apps/desktop/test/context-privacy.test.mjs
node apps/desktop/test/local-state.test.mjs
node --experimental-strip-types apps/desktop/test/onboarding-drafts.test.mjs
node apps/desktop/test/run-command-ingress-db.mjs
python3 test/audit_regressions/fix-pf-06.03.py
```

New packet tests must import real modules/use real isolated transactions and actual
IPC adapters, not only reproduce a reducer in test code. Demonstrate each new guard
rejects the prohibited transition, including empty projection restore and late replies.
The existing `agent-surface.test.mjs` discovers a running Supabase stack and mutates
fixture data: **it is not an owned disposable runner**. Remaining HTTP/MCP HAR06
acceptance must instead bind actual transport to explicitly owned disposable storage.
No paid/model calls, user database, native agent sessions or real credentials belong
to storage/IPC acceptance. Hosted/full gates and final native UX checks are separate.

## 9. Allocation, checks and handoff

Current [schema contract](../../../apps/desktop/src/shared/schemaContract.json) is
64–64 after the full64-chain storage check and focused schema admission checks. [Pipeline reservations](../../evidence/plans/task-pipeline-persistence-contract.md)
retain unexecuted migrations 65/66 and ADR-0076 after the private-CEO allocation. Migration64 is shipped in source; no live database was migrated by this iteration.
Allocation is recorded by the integration owner; this document does not run DDL.
The integration owner must qualify an explicit schema range with upgrade/restore/readers tests; do not widen
maximum from migration count or let a new writer bypass the startup gate.

Completed here: source inventory, contract/state table, option A/B comparison,
privacy finding, proposed transaction/replay boundary and three implementation seams.
Checks actually run on 2026-09-27: a Python link/source check resolved **28 relative
links including fragments**, **7 existing command paths**, and **3 critical source
files at the baseline commit**; proposal/allocation/unrun-status assertions passed.
`git diff --no-index --check /dev/null docs/launch/harness-r0/ceo-conversations.md`
reported no whitespace errors. These are document checks; no SQL, IPC, provider,
backup or runtime acceptance is claimed. Full fast/map/publication are parent
integration work, not silently waived for the completed product iteration.

**Exact next task:** implement packet2 native service/drafts using the repaired
local state primitive, derived identity and prepared input; qualify the actual
IPC boundary before UI wiring. Storage packet1 and schema64 are integrated with
focused receipts below. Do not activate a conversation writer before its
private audience and read/backup boundaries are proven. Full CEO remains open.

Actual skills: task-pipeline — bounded scope/dependencies/resume handoff;
evidence-docs — source addresses, measured-versus-proposed distinction and unrun
checks. Routes read from repository `AGENTS.md` and `docs/AGENT_SYNC.md`; no UI/design
or shared-register edits were made. No model or plugin change.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**


Integration decision: ADR-0075 accepts option B, operator-private per-subject conversations, visible ordinary participation metadata and mandatory owner-portable backup before activation. The alternatives above preserve the rationale; the ADR resolves these choices. Full none/one/many/all remains the R0 target; N1a limits are staged implementation only.


## Integrated storage receipt and activation boundary

[Storage source 10b6fef](https://github.com/passioncode-ai/fabric/commit/10b6fefde71d630ffe2c350d0f0b8a9408476866)
adds [migration64](../../../supabase/migrations/20260927000064_private_ceo_conversations.sql)
and [shared CeoSend contract](../../../apps/desktop/src/shared/ceoConversation.ts).
Root independently ran `node apps/desktop/test/run-ceo-conversation-db.mjs`:
**schema_version64, twelve groups across all64 migrations, owned cleanup PASS**.
This includes two principals, concurrent open/send, lost-response repeat, revoked
membership, exact UTF-8/compact-JSON limits, null/deep malformed input, safe-integer
saturation, stale Project/question context, rollback, raw append/import refusal,
private content absence from shared receipts and metadata-only restore with no
content/dispatch reconstruction. The runner has no TCP listener or caller database
URL; its auth schema is an isolated fixture, not a Supabase login acceptance test.

Root private scope/archive/storage inventory tests: **three files,52 tests PASS**.
The actual generic store refuses all seven CEO tables before query construction;
only dedicated SQL functions may expose permitted private rows. Ordinary Estate
archives explicitly exclude private primary content and pending authority; only
opaque receipt projections rebuild. This is exclusion, **not completed private
backup support**. Root schema readiness **ten scenarios PASS** qualifies64, refuses63
and65, malformed artifacts and unavailable DB. No writer is activated by this packet.

[Local prerequisite b6ec455](https://github.com/passioncode-ai/fabric/commit/b6ec455cb07a0928d720b0277bad31aab586c355)
repairs `localState.ts`: unreadable data cannot be overwritten from defaults, both
live and recovery bytes survive invalid proposals, errors omit private fragments
and paths, and valid recovery stays writable. **22 actual filesystem/ops checks
PASS**, independently repeated in root. This is synchronous single-main-process
CAS, not a multiprocess lock or an existing CEO draft service.

An independent reviewer found no blocking storage or root scope/archive issue and
ran the pure contract plus33 scope/archive tests. SQL still trusts host-derived
identity and prepared text; packet2 must bind them. UI, owner export/restore,
provider dispatch, many/all context, typed outcomes, voice and complete R0 remain
open. Full fast and source/workspace receipts are recorded in [checks](checks.md).


## Portable recovery · next contract review

This is a **planned packet**, not a backup capability claim. The current
[migration56 restore command](../../../supabase/migrations/20260910000056_restore_estate.sql)
rejects restoring into the source Estate and requires a new empty target. Therefore
same-Estate private repair alone cannot satisfy ADR-0075's portable recovery gate.
The following explicit mapping must be reviewed and exercised before activation:

1. Export only the held Person's private records under current membership. Bind
   the companion to the source Estate, exact journal watermark/digest, original
   Person and schema. A watermark bounds the data snapshot: later messages cannot
   leak into an earlier archive. Preserve each original envelope and its
   source-Estate/Person canonical digest. Archive integrity is not proof of an
   external author's identity; import remains an explicit authorized action.
2. Restore the ordinary Estate archive through its existing empty-target contract.
   The companion is a separate owner-authorized operation. Require the same
   verified Person in the target; no name/email matching or imported membership.
   Explicitly bind source Estate to that new target and match the corresponding
   opaque journal receipts, IDs, sequence numbers and actors. Do not infer this
   mapping from the currently selected Project.
3. Check all shapes, sizes, duplicate IDs, contiguous message ordinals, subjects,
   original content digests and receipt relations before private writes. Refuse
   incomplete history, cross-owner records and collisions. A restored Project may
   be archived; its history remains readable without granting new execution.
4. The canonical send digest includes Estate ID. Preserve source provenance while
   producing an explicitly target-bound canonical digest/operation receipt; never
   pass a source digest off as valid in the new Estate. Exactly how provenance is
   stored is frozen in the migration/format contract before coding. No silent
   mutation of existing immutable primary rows.
5. Import conversation/content/message/idempotency history atomically. Do **not**
   recreate pending requests, provider sessions, grants, work leases, or local
   frozen send intents. Saved historical acceptance grants no right to dispatch.
   A repeated identical import returns its receipt; a changed import or partial
   collision refuses without writes. Ordinary journal-only restore keeps private
   content unavailable until this separate operation succeeds.
6. Before activation, prove cross-device/fresh-database restore with actual SQL
   and private files; revoked identity, wrong Estate mapping, edited body/digest,
   truncated files, foreign owner, missing journal prefix, duplicate import,
   collision, rollback and loss of the import response. Neither original nor
   restored Estate may gain an executable request from archive import. File
   picker/export labels must say that the companion contains private text.

Exact next deliverable: a reviewed format/RPC contract and bounded write set,
then an additive migration in a newly reserved slot, full-chain owned SQL
acceptance and native export/import integration. Pipeline slots65/66 are already
reserved; this packet cannot claim them or renumber applied migrations. Private
archive UI and recovery discovery join the conversation activation gate. No
private archive or production IPC is implemented by this plan.


## Packet2a root integration · 2026-09-27

Reviewed service member `85b78459684ce9b3185c7303e9e9b446698cbd7d` is integrated;
[service API, limits, recovery and remaining bindings](ceo-conversation-service.md).
Root independently ran its draft validator and22 actual-filesystem service groups,
then composed that real service with the complete64-migration PostgreSQL fixture.
The five additional service/SQL groups verify stable subject open, prepared body
and private digest/history agreement, lost-commit-response reconciliation after
restart without resend, offline intent restart, and revoked membership. No model,
production DB, worker, IPC or renderer was involved.

Review fixed blank composer persistence, nonreused edit IDs, late-first-refusal
versus newer attempt, prospective atomic-save capacity, explicit terminal-cache
cleanup, response pagination and in-flight limits. Source tests preserve these
regressions. The first composition attempt hit the existing last-owner protection
because the test tried to remove its only owner; a retained second fixture owner
corrected the test, without changing the product guard. Final12 SQL +5 composition
groups and owned cleanup pass. This is input durability evidence, not CEO replies
or task execution. Next: trusted RPC/IPC binding plus private portable recovery,
then actual UI/cold-restart acceptance before activation.
