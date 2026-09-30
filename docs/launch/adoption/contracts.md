# Shared contracts for progressive adoption

**Source-bound design, 2026-09-17.** [ADR-0061](../../adr/0061-project-setup-precedes-managed-activation.md) accepts the ownership/setup boundary. [The producer matrix](contract-bindings.json) binds eight capabilities to inspected source, with missing mechanisms and exact future owner candidates. This is packet context, not a second type implementation or a native readiness receipt. Existing authority: [operator interaction](../../architecture/operator-interaction.md), [ontology](../../../CONTEXT.md), [OX plan](../../ux/plans/2026-09-15-r0-operator.md). Evidence baseline: `bac1f67f295b1b05a5caf914f59aa63ced94d439`; [audits](audit/2026-09-17-entry.md).

## Ownership and boundaries

| Capability | Owns | Reads | Exposes | Failure contract |
|---|---|---|---|---|
| Project creation | draft, immutable create request, result receipt | selected source identity, authority | ProjectCreateReceipt | pending/refused/unknown/committed; reconcile same identity |
| Source observation | scope of read, observation coverage, freshness, source revision | authorised source adapter | SourceObservationReceipt | unread/denied/partial/stale/available; no invented content |
| Context return | checkpoint + projection/cursor, not Task truth | Project/Task/Run/Decision/Board events | ContextCheckpoint, ReturnSnapshot | missing continuation explicit; last good snapshot retains age |
| Conversation | input/original/revision, command identity, outbox | allowed references and destination | MessageEnvelope, typed command receipt | local saved ≠ delivered ≠ executed ≠ checked |
| Attention | personal review cursor and resurfacing preference | canonical obligation/answer/effect | AttentionReviewReceipt | source obligation cannot be closed by a local display flag |
| Execution | provider readiness/binding, Run lifecycle and evidence | Task, authority, limits, context pack | AgentReadyReceipt, RunResultReceipt | unsupported is not queued; unknown is not safe to repeat blindly |
| Cycles | versioned definition, window and attempt | allowed preset, actor, next due, host | CycleWindowReceipt | disabled/paused/overdue/host-offline/result distinct |
| Adoption | personal guide revision, offer/dismiss/experience projection | actual immutable receipts | AdoptionProjection | missing evidence never counts as learned; no business writes from progress |

No new CEO agent competes with the current manager. No guide owns Tasks or grants. A saved Project may leave PM responsibility unconfigured; managed activation requires one admitted PM under ADR-0061. A deferred executor is not a fake provider called `later`. Existing manually admitted capabilities retain their own gates. New types have exactly one source; UI and adapters import them. Existing broad directory write candidates in packets are **not dispatch permission for the directory**: AD01 binds exact file paths and exports in its receipt.

## Proposed port shapes

Names are semantic contracts, not claims about already exported TypeScript symbols.

```ts
import type { Scope } from '../../../apps/desktop/src/shared/scope';
import type { EntityRef } from '../../../apps/desktop/src/shared/entityRef';
// Semantic wrapper proposal; canonical identity and scope stay owned by these modules.
type ScopedRevisionRef<R> = Readonly<{ scope: Scope; ref: EntityRef; revision: R | null }>;
type SourceRef<R> = { ref: ScopedRevisionRef<R> | { sourceId: string; revision: R }; readStatus: 'available'|'unread'|'partial'|'denied'|'missing'; observedAt?: string };
type CommandInput<R> = { requestId: string; actorId: string; destination: Scope; expectedRevision: R; payloadHash: string; inputMessageId?: string };
type CommandOutcome<R> = { requestId: string; state: 'pending'|'refused'|'unknown'|'committed'; effect?: ScopedRevisionRef<R>; reason?: string; receiptId: string };
type ContextCheckpoint<R, B> = { id: string; actorId: string; scope: Scope; revision: R; sourceRefs: SourceRef<R>[]; sourceBoundary: B; purpose: string; nextAction?: ScopedRevisionRef<R>; unknowns: string[]; savedAt: string };
type ReturnSnapshot<R, B> = { id: string; actorId: string; scope: Scope; checkpointId?: string; renderedBoundary: B; observedAt: string; coverage: 'complete-for-selected-sources'|'partial'|'unread'; changes: ScopedRevisionRef<R>[]; pendingDecision?: ScopedRevisionRef<R>; continuation?: ScopedRevisionRef<R>; missingReason?: string };
type ShownSnapshot<B> = { snapshotId: string; boundary: B; actorId: string; scope: Scope; visibleSurface: string };
type GuideRecord<R> = { actorId: string; scope: Scope; guideRevision: string; stepId: string; state: 'eligible'|'offered'|'dismissed'|'experienced'|'retired'; evidenceReceiptIds: string[]; resumeRef?: ScopedRevisionRef<R>; snoozeUntil?: string };
```

`R` and `B` are bound to each actual producer type before implementation; they are not permission to cast or stringify. Project/question revisions and journal seq remain numbers; a ReadEnvelope revision may remain its existing string. Multi-source reads use a typed vector retaining each member’s original type. Null means an explicitly unknown reference revision and cannot satisfy a write precondition.

A source boundary is a producer-owned immutable cursor, **never a list length**. Multi-source boundaries need a versioned vector or equivalent verified representation; The matrix binds the current journal/digest producers; AD06/07 implement the missing full snapshot port and pin its complete read to that boundary. Canonical EntityRef currently lacks Message/TaskRun identities: AD09/11 must extend it and its resolver together before such links are emitted. Acknowledgement references exactly ShownSnapshot; events arriving after that boundary remain unread. Backfill has its own event identity. A snapshot cannot claim coverage beyond selected, read, permitted sources. A missing event stream is unread, not “no changes”.

MessageEnvelope retains original input and correction revisions; attachments are source references, not destination permission. Pending voice pins scope/capture ID; late transcript is ignored or recovered in the original draft. Cancelled unsent input is not attributed to a Task. Raw audio retention is an explicit separate preference; no tutorial opt-in grants audio upload. See the existing [voice contract](../../architecture/operator-interaction.md).

Guide steps consume receipts; they never infer success from route visits, arbitrary counters, heartbeat, token spend or tutorial object existence. A dismissed nudge remains manually accessible. A new guide version migrates progress idempotently; it cannot grant scope, start a cycle or erase previous outcomes.

## State and error rules for every click

| State | Show | Mutation | Recovery |
|---|---|---|---|
| empty | Why empty + one relevant start | only permitted create | add source/intent, or sample explicitly |
| loading | scoped progress, keep entered text | prevent duplicate write | cancel read; safe navigation |
| pending write | saved intent and operation identity | lock that request, not unrelated work | inspect receipt |
| unknown outcome | exact request, no invented failure/success | no new identity retry | reconcile same request |
| partial | known subset + missing source | only valid actions on known data | reread missing source |
| stale | timestamp + prior result | validate version before mutation | refresh/review conflict |
| conflict | own draft + current version differences | refuse stale submission | review and resubmit as explicit update |
| denied | scope and reason without protected content | no write | request access or switch separately |
| missing/archived | requested identity, no substitute | restore only if permitted | archive/parent/search explicit |
| offline | last durable receipt + local draft state | allowed local journal only | reconnect and reconcile |
| success | result, destination, next action | effect already committed | open source/undo only if supported |

Main content and composer maintain separate scopes. Esc closes the right dialog and returns focus to launcher; narrow screen uses full-width dialog. Error/permission/action-needed remains visible, never buried in advanced details. Actual screen-reader and native keyboard behavior requires AD22 testing; this document is not WCAG conformance evidence.

## Dependency and concurrency policy

Packets have a DAG in [plan.json](plan.json), not a runtime scheduler. Each input names the predecessor's output. Before dispatch, an executor records actual input receipt commit, output schema version, required edge proof tier, required status/predicate, exact write files and their hashes. Any missing binding keeps that packet blocked. AD00 and AD02 can begin bounded work now, in isolated branches; their generated/canonical outputs are integrated serially. Shared files (`controller`, `index.ts`, journal/schema, canonical UX, generated report) have one integration owner at a time. A topological dependency does not automatically permit two writers of the same file.

Upstream interface changes invalidate downstream bindings even if tests still pass. Never rebase proof by just updating hashes: re-read the cited symbols, rerun relevant path tests. A proposal becomes a durable architectural choice through the existing append-only ADR process; record its ID in the input receipt. ADR-0061 is the narrow accepted architecture; ADR-0046 remains proposed. Missing native ports are not activated by the matrix.

## Delivery receipt

Receipts live in `receipts/`. [AD00](receipts/AD00.json) passed pure acceptance at its implementation commit; [AD02](receipts/AD02.json) records the native permission blocker. Historical receipts are not rewritten to claim later work. Required fields:

```json
{
  "packet": "AD00", "status": "passed|blocked|failed",
  "sourceCommit": "full commit", "baseCommit": "full commit",
  "inputReceipts": [{"packet":"ADxx","commit":"full commit","schemaVersion":"...","requiredProofTier":"native","observedProofTier":"native","status":"passed","predicate":"acceptance-complete-and-contract-bound"}],
  "contractBindings": [{"name":"port","ownerFile":"path","export":"symbol","revision":"..."}],
  "exactWriteSet": ["path"], "decisionIds": [],
  "checks": [{"command":"actually run","exitCode":0,"proofTier":"source|pure|prototype|native|user","receipt":"tracked path"}],
  "negativeChecks": [{"case":"forbidden transition","failedBefore":true,"passesAfter":true,"receipt":"tracked path"}],
  "notRun": [{"check":"...","reason":"...","requiredBefore":"..."}],
  "migrationAndRollback": "tested approach", "remaining": [], "nextTask": "exact next action"
}
```

Passing old tests alone never closes new acceptance. A structural plan validator cannot certify sensible UX, correctness of a claim, security, actual user value or runtime coverage. A missing runtime environment yields NOT_RUN, not a substituted green mockup test. Keep historical receipts immutable and publish source → snapshot → workspace → parent pin through the existing mechanism.

## Plan review corrections

AD05 owns the minimal no-source/single-source observation port; AD24 owns folder enumeration. AD06 can therefore deliver idea value without waiting for full folder scanning. AD08 intentionally waits for AD09 to integrate Home/Project/CEO consistently. `plan.json` is in actual topological order. Each edge names minimum proof tier, passed status and predicate; an unresolved STT selection is blocked and cannot satisfy AD13.

Native surface ownership is explicit: current CEO entry is `App.tsx` mounting `AttentionPanel.tsx` (the baseline panel says it has no conversation), Task/Run uses `TaskPage.tsx` and `ProjectHome.tsx`, attention uses `BoardPanel.tsx`, cycles use `ProjectHome.tsx`. These are owners to evolve, not claims that prototype behavior already exists there. Every IPC-changing packet binds `preload/index.ts` and `shared/types.ts` along with its main handler; one type definition remains authoritative. Tests have their own write candidates in every packet. A directory candidate must be narrowed to exact new/existing files by AD01 or the packet dispatch receipt; never treat it as blanket source ownership.

Proof tiers are not interchangeable: `pure` = bounded module; `prototype` = report UI/handler; `native` = actual desktop main/renderer boundary and durable dependencies, not a second simulation; `user` = observed human task outcome. A native packet may use controlled adapters but must explicitly retain any required live-provider/STT check as not-run until exercised. Those missing mandatory checks prevent a passed output.

## Exact dispatch prerequisites

The matrix names exact existing and proposed owner files. These preconditions resolve design questions at their owning packet; they do not bypass the DAG or the input receipt gate.

| Packet | Binding needed before runtime edits | Required failure/recovery evidence | What must not be inferred |
|---|---|---|---|
| AD03 | Accepted ADR0061, canonical creation entry and scope/state vocabulary; updated SCN001/031/ST001/JTBD | Same idea/project path; defer PM/developer; no fictional binding | Prototype click is not native creation |
| AD04 | Exact command input/decoder owner, immutable request ID/payload fingerprint, Project id relation, schema registration and transaction receipt; source-attachment partial contract; additive setup reader | Double submit, lost response after commit, changed payload under old key, refused existence read, partial attach, restart | Existing Project id is not a general command receipt; schema unique index is not minimum PM guarantee |
| AD05 | Explicit permitted source adapter and none/single-source receipt with hash/revision, read status, coverage and freshness; FileRoots/Scope reuse | None vs unread; denied root/symlink escape; partial/stale; changed bytes | No repository is not “no project history”; source content grants nothing |
| AD06 | Exact accepted checkpoint event/command schema and persistence owner in existing journal; semantic next-action ref; no-write path until user accepts a proposed checkpoint | Duplicate save, lost response, restart, unread/missing source, explicit unknowns, unconfigured PM | Every navigation becomes business event; a saved Task alone proves context value |
| AD07 | Journal cutoff semantics, external revision vector, canonical snapshot identity and exact continuation, current actor/Estate/Project key, migration of legacy digest mark, durable acknowledgement result | Events after show remain unread; head/content failure; write conflict; actor switch; stale snapshot; missing exact ref | Device-local Project-only mark is cross-device/user truth; current head equals shown boundary |
| AD09 | Single existing-journal command writer, message+outbox atomicity/recovery, stable message/request IDs and payload identity, registered event/projector owners; audience permits original message read | Offline save versus delivery, restart, duplicate submit, unknown commit, read revocation, cross-project destination mismatch | Provider ConversationBinding is CEO history; append_event alone supplies command idempotency |
| AD10 | AD09 actual IPC result contract; separate screen/composer scopes; original draft restoration/replacement rules | A→B→A, pending reply scope, shortcut with nonempty text, close/reopen, focus/keyboard | Context attachment changes destination or authority |
| AD11 | Canonical typed Message/TaskRun/Conversation ref scheme and exhaustive resolver; immutable correction/attribution append; exact audience/excerpt permission | Wrong Project, missing/archived/revoked identity, stale attribution, correction preserving original | Add a duplicate EntityRef union; open some current chat on unresolved link |
| AD12 | Measured STT backend/device/OS, local-vs-network disclosure, capture identity/cancellation and explicit raw-audio retention contract | RU/EN/negation/numbers, denied/no mic, offline/late result/cost bounds | Unresolved STT is consumable passing output |
| AD13 | Passed AD12 selection receipt plus actual native capture boundary and AD09 save semantics | Scope pinned across recording, interrupted/cancelled capture, late transcript, actual selected STT end-to-end | Microphone animation or fixture text is voice acceptance |
| AD14 | Personal review storage keyed actor/Estate/subject revision, exact shown snapshot and explicit defer mode; canonical answer/effect result input | Failed local write, late event, dismissed view but unresolved obligation, next-review/time/no-reminder distinctions | Local close/dismiss settles question or Task |
| AD15 | Exact trusted PM activation/readiness gate, scope/expected revision and real supported provider binding evidence; developer gate separately | 0/2/unread/unsupported PM; stale scope; deferred executor; revoked grant; idempotent activation | PM role label or nonblank runnerId is ready; selecting developer supplies PM |
| AD16 | Existing TaskRun admission identity and Session bind/end path, result evidence and stop receipt linkage | Spawn fail after admission; unknown delivery; stop pending vs stopped; restart; late callback | Retry creates sibling TaskRun without reconcile; transcript proves business outcome |
| AD17 | Exact versioned routine definition command, paused-on-create semantics, separate enable and request reconciliation; supported interval/host contract | Save never starts work; duplicate define; app-off/catch-up bound; unknown receipt; pause vs cancel | Existing default enabled=true is safe preview; explanatory cron schema proves runtime support |
| AD18 | Personal guide schema revision and actor/Estate scope using localState, deterministic receipt-to-step mapping and migration | Missing/foreign receipt; duplicate event; old guide migration; corrupted local file; dismissed does not experienced | Visit/click/task/topic count equals learned value |
| AD19 | Actual AD18 projection plus corresponding native capability receipts; progressive offer triggers and expert manual entry | Skip/resume, exact continuation, no forced lesson, restart, unavailable capability | All7phases must be completed as one tour |
| AD20 | Composed source-backed Home state and explicit fixture isolation, compatible source freshness | Empty personal Estate without foreign activity; stale source; paused Live vs paused execution | Demo statistics become real activity |
| AD21 | Existing membership/invitation authority and exact role/identity statuses; read access stated as currently implemented Estate scope | Wrong identity/expired/revoked invite, no assigned work, source details exact return | Project-private ACL or automatic create from invitation |
| AD22 | Native actual-path outcomes for required predecessor contracts plus provider/STT checks; named target platform | Full return/onboarding/admission/voice negative journey; evidence tied to actual build | Green pure/prototype tests substitute for native evidence |
| AD23 | Real human participant/task protocol and explicit measurements of first useful context and first return | Observe failed or abandoned return as such, record source coverage/confidence | Implementer role-play or analytics counter equals user value |
| AD24 | Bounded folder scanner over selected root, candidate identity and duplicate policy; no implicit imports | Permission/symlink/budget/partial/cancel/duplicate; explicitly select one or more sources for one Project, choose/change primary, then AD04 (ADR-0065) | Directory enumeration is authority to import all or run agents |

All packets retain their DAG and required proof tiers. This table refines dispatch prerequisites, not dependency bypass. Exact SQL migration filenames are allocated by the integration owner under coordination at implementation dispatch; reserving fictitious future sequence numbers in this draft would create a collision rather than a binding.
