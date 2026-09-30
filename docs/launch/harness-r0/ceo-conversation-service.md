<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# CW-N1a packet 2a: private conversation service and recoverable drafts

Status: bounded core implementation; no production binding or CEO activation.
The service accepts prepared operator input into the existing private SQL contract.
It does not call a model, dispatch work, publish a decision, or mark a task complete.

## Entry point and prerequisites

- [Service](../../../apps/desktop/src/main/ceoConversationService.ts): `createCeoConversationService`.
- [Draft contract](../../../apps/desktop/src/shared/ceoConversationDraft.ts): local recovery schema and bounds.
- [Conversation contract](ceo-conversations.md): audience, SQL authority and staged context contract.
- [SQL storage](../../../supabase/migrations/20260927000064_private_ceo_conversations.sql)
  and [canonicalization](../../../apps/desktop/src/shared/ceoConversation.ts):
  source commit `10b6fefde71d630ffe2c350d0f0b8a9408476866`.
- [Local state](../../../apps/desktop/src/main/localState.ts): prerequisite source
  `b6ec455cb07a0928d720b0277bad31aab586c355`, cherry-picked in this worktree as
  `5f982f5`. Parent integration should reuse its original reviewed prerequisite,
  not apply the same patch twice.
- Root owns accepted ADR-0075 and schema-64 admission/registration. This subordinate
  branch does not independently activate or broaden either contract.

This serves the context-recovery objective: losing a response or changing projects
must not lose the prepared question, create another message, clear newer typing,
expose another operator's draft, or confuse an offline save with server acceptance.

## Ports and authority

The service is Electron-free. Inject `rootDir`, `identity.held`, `identity.guard`,
`online` and four named RPC ports: `open`, `send`, `read`, `receipt`. No generic
query, table mutation, service credential, or renderer-supplied principal is exposed.

`held` is a synchronous trusted identity snapshot. `guard` must refresh and validate
that held membership against the authority source; echoing a local snapshot is not
an implementation of the guard. Identity consists of Estate UUID, Person UUID,
held membership revision and Person actor. The literal `operator` actor is accepted
only for the exact migration-58 local Person UUID. Each operation rechecks the
captured identity before and after asynchronous boundaries. Its monotonic deadline
is sticky; a timer delayed by synchronous work does not extend authority.

Each named RPC receives exact `p_estate_id`, `p_person_id`, `p_revision`, method
arguments and a synchronous `stillAllowed` fence. A production port which defers
its network write must check the fence at that write. SQL remains transactional
membership authority. A timed-out or lost send reply does not prove rollback.

Decoded replies have bounded depth, node count, bytes and message count. Accessor
properties are not evaluated. Foreign IDs, digest mismatches, unknown shapes and
raw error bodies are refused. Returned diagnostic identifiers are validated UUIDs;
raw input cannot be reflected as a correlation ID. Structured-cloned/JSON inputs
are required at the future IPC boundary; this module is not a sandbox for hostile
JavaScript Proxy traps.

## API and state transitions

| Method | Contract |
| --- | --- |
| `open(input)` | Stable operation/conversation IDs and global/project/question subject; SQL may return the already-canonical conversation for a subject. A lost reply returns the original IDs for explicit same-operation recovery. |
| `read(conversationId, afterOrdinal, limit)` | Owner-authorized history, ordered messages, strict envelope/digest validation, at most 50 messages. JSONB property order is immaterial. |
| `readDraft(conversationId)` | Current scoped local revision, recovery status, draft and frozen intents; missing and unreadable are distinct. |
| `saveDraft(conversationId, expectedLocalRevision, input)` | Prepare text before persistence. CAS refuses stale typing. Empty/whitespace text is valid local draft state and preserves original whitespace. |
| `freezeSend(conversationId, expectedLocalRevision, IDs)` | Freeze prepared text, immutable context, revision, operation/message IDs and draft edit UUID. Empty text cannot freeze. One unresolved intent per conversation. |
| `send(conversationId, operationId)` | First send persists `commit_unknown` and attempt count before the RPC. Reopening an unknown send performs read-only receipt recovery. |
| `reconcile(conversationId, operationId)` | Read receipt by original IDs. `not_found` remains unknown; it neither resends nor changes context. |
| `retrySavedInput(conversationId, operationId)` | Explicit retry of the identical saved SQL envelope after fresh authority, maximum three durable attempts. No new IDs or reconstructed context. |
| `forgetSettled(conversationId, operationId, expectedLocalRevision)` | Explicitly remove an accepted/refused local recovery record. Authoritative accepted history remains in SQL. Saved/unknown records cannot be removed. |
| `discardDraft(conversationId, expectedLocalRevision)` | Explicitly discard local draft text and free its slot; refuses while that conversation has an unresolved send. |

Success states are `ready`, `saved_locally`, `accepted_pending`. Failure states are
`refused` and `commit_unknown`, with fixed reason codes. SQL acceptance retains
`dispatch: unavailable`: it is not a worker execution receipt.

A draft edit has a fresh UUID, not a resettable counter. An old acceptance clears
only its matching edit identity. A newer draft after a previous clear therefore
cannot be erased by another service's late acceptance (the ABA regression).
Concurrent same-operation calls in one service join one in-flight promise. A late
first-attempt refusal cannot settle a newer attempt or overwrite an accepted
receipt. Successful matching acceptance may settle the immutable intent while
preserving the maximum durable attempt count. The caller may receive conservative
unknown after a late conflicting response and reconcile the stored acceptance.

Explicit retry is safe only because this RPC is idempotent private-message
acceptance with no external dispatch. This is not a policy for retrying arbitrary
agent actions. `not_found` while an earlier request is still in flight is not a
reason to mint a new operation. After forgetting a terminal local intent, stale
`send`/retry refuses `missing_intent` and does not recreate it.

## Persistence and limits

Owned layout: `rootDir/ceo-conversations/<Estate UUID>/<Person UUID>/drafts.json`.
The injected root is a trusted existing application data directory. Each owned
subdirectory must be current-user-owned mode 0700; every namespace file must be a
regular current-user-owned single-link mode-0600 file. Symlinks, unexpected files,
unsafe modes and oversized data refuse access. Unsafe paths are not normalized by
following them. Validation precedes reads of oversized files. No credentials or
original unprepared text are included in errors.

`localState` provides atomic replacement, validated last-good recovery and content
revision CAS. This contract requires a serialized main-process writer; it is **not
an interprocess or host-wide locking guarantee**. The two-service tests exercise
asynchronous operation races on one JS event loop. An already executing synchronous
filesystem operation cannot be cancelled by a deadline; `local_save_unknown` means
reread the namespace, not report success or overwrite using defaults.

| Bound | Value |
| --- | --- |
| Draft records / total intent records | 32 / 32 |
| Unresolved intents | 8, at most one per conversation |
| Send attempts per frozen operation | 3 |
| Concurrent service operations | 32, duplicate same-operation joins reuse the existing request |
| Prepared body / compact input wire | Existing 32,768 / 65,536 byte SQL contract |
| Serialized local file | 4 MiB |
| Namespace files / bytes | 8 / 16 MiB |
| RPC history page | 50 messages |
| Service deadline | Default 10 seconds; configurable integer 1–60,000 ms |

Prospective save capacity includes both atomic-write phases, replacement live and
last-good files, and temporary-file headroom. Exceeding either the byte or file
count cap refuses before mutating acknowledged bytes.

No record is silently evicted. Explicit cleanup frees settled intent/draft slots;
unknown sends remain recoverable. Validation also enforces structural bounds, so
nominal byte capacity is not an entitlement to arbitrarily deep or wide input.
Unreadable files refuse saving; recovered last-good content is explicitly labelled.
Quarantine cleanup requires a separate recovery flow and is not automatic here.

The context schema supports staged `none`/`one` only. This does not waive the full
R0 `none`/`many`/`all` requirement or imply `estate_seq` proves source completeness.

## Focused verification receipts

Run from repository root:

```sh
node --experimental-strip-types apps/desktop/test/ceo-conversation-draft.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-conversation-service.test.mjs
node apps/desktop/test/local-state.test.mjs
```

Observed 2026-09-27: draft contract PASS; **22 actual filesystem/service groups
PASS**, cleanup PASS; local-state actual filesystem regression PASS. Tests use
injected fake RPC, no Electron process, provider, model or database. The service
test imports the real service and writes only owned disposable temporary folders.

Covered negatives include lost replies and cold restart; in-flight receipt
`not_found` followed by identical explicit retry and one acceptance; duplicate
calls; edit UUID ABA; late first refusal after a newer committed/lost attempt;
authority movement/revocation including cached acceptance; prepared text/digest
and JSONB ordering; malformed/accessor replies; blank composer persistence;
unsafe permissions/symlinks/oversize/corruption/fallback; deadline starvation;
bounded attempts and explicit cache cleanup preserving unknown sends; prospective
namespace byte/file caps; bounded in-flight guards; strict contiguous history and
complete pagination (unavailable bodies retain their ordinal as explicit rows).

Targeted strict TypeScript compilation of the two modules also passed (`tsc
--noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext
--allowImportingTsExtensions --skipLibCheck`, using the repository's installed
Node type roots). No dependency installation or native account/configuration
change was needed. Parent's separately owned full-64 PostgreSQL/service composition
is a further integration gate, not claimed by these fake-RPC receipts.

## Next implementation seam and activation gates

1. Root integrates this packet with the reviewed localState and SQL/schema-64
   prerequisites. Wire named RPC adapters to the actual current-identity guard;
   run the separately owned disposable PostgreSQL/service composition.
2. Add typed IPC/preload and request-bound renderer integration. Renderer cannot
   choose principal, supply generic SQL, or receive late content after changing
   identity/context. Draft CAS conflict, recovered, offline, unknown, explicit
   retry and cleanup states need distinct UX. Blank drafts must remain saveable.
3. Owner-portable private export/restore, including completeness and current
   authorization, is still mandatory before activation; generic Estate archive is
   not a backup of protected private content. UI, model/worker ingress, full R0
   multi-project context and voice attribution are not implemented by this packet.

No native/provider conformance, whole-harness readiness, deployed migration or
public feature activation follows from this core service implementation. Root
owns shared registry/map changes, fast gates and workspace publication.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded core-service packet and focused verification
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — recorded API boundaries and test receipts

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
