# Fabric: conversation-led operation contract

Status: target design, 2026-09-26. Governing choice: [ADR-0065](../adr/0065-conversation-led-work-and-context-bundles.md). No native implementation or production safety claim. Builds on [operator interaction](../architecture/operator-interaction.md) and [first-release packets](first-release-strategy.md).

## What the operator meant

The operator states intent, discusses uncertain choices and judges exceptions. Fabric gathers missing information, proposes a structured result and routes it into the existing Project system. Repetitive work should not depend on whether the model remembers to perform a step. Enforce those steps outside the model. A model may still make a poor proposal; the system must reject invalid transitions and contain its effects.

## Division of responsibility

| Layer | Owns | Cannot substitute for |
|---|---|---|
| Flow | Allowed states, transitions, retry and recovery | The observed state of an actual operation |
| Skill | Versioned instructions, examples, required evidence and tools | Host-enforced permission or validation |
| Script / command handler | Typed operation, bounded effect, idempotency and receipt | A model saying it executed the operation |
| Hook | Reaction to a recorded event, with event identity and deduplication | Polling text for a phrase such as “finished” |
| Gate | Schema, scope, policy, revision, readiness, budget, dependencies and evidence | A ceremonial extra confirmation for every harmless operation |
| Agent | Interpret intent, collect material gaps, compare alternatives, propose commands and explain receipts | Authorizing itself or altering the canonical state directly |
| UI | Show state, source, next action and exceptions; accept text/voice | A second state store or an obligatory form for every operation |

## One operation contract

Proposed fields (not a new shipped wire schema): operation name/version; command ID and idempotency key; actor; Estate/Project/Task/question/conversation IDs; expected entity/context revisions; validated arguments; policy and skill/flow versions; input evidence references; budget; result channel.

Sequence: sanitize input → log attributed message → retrieve bounded context → agent proposes → validate schema/scope/revision → apply policy → execute through existing handler → record receipt → project into Board/Plan/Live → return result to conversation. If a material ambiguity remains, ask there. A permitted routine managerial action can execute under existing authority; only new authority, destructive effects, significant ambiguity or an unknown prior effect requires a decision or reconciliation.

States: proposed, needs-input, admitted, running, succeeded, failed, rejected, unknown. “Sent” is not “succeeded”. Timeout reconciles using the same identity, not a new command. Transaction/outbox semantics connect canonical state and events; projection failure retries delivery instead of replaying the effect. An agent cannot manufacture a passed gate by emitting matching text.

## Sources and context at every level

One Project has a stable identity and a source set. A primary source supplies the default working directory; related sources carry canonical references, title/purpose, observed revision/time, access status, coverage and read permissions. The first selected source is primary, visibly changeable. Root discovery is bounded; aliases, symlinks, ignored/secret folders, duplicate paths and inaccessible children need explicit native handling. Selection is not blanket read/write/upload permission.

Packets inherit only permitted context. Estate defaults → Project source index → question purpose/history → Task criteria/decisions → Run immutable packet. Include compact summary, recent relevant detail and provenance links. Fetch full material only when needed and allowed. A related folder can be referenced without loading its content. A source rename or primary switch never relocates an active process. Compare revisions before applying proposals; rebuild stale proposals. Historic Runs remain inspectable as they were executed.

## Board and plan

A question owns a conversation, input references, proposed outcome revisions and accepted outcomes. An outcome records decision/reason, unresolved questions, proposed tasks/criteria/executor and next step. Preserve old versions and attribution. Applying the same outcome twice creates one task at most. Launch is its own admitted command. The original question receives progress/results and may require another review; prior decisions stay intact. Deferral records a return condition. Closing the chat changes no work state.

Plan is a projection. “Спланировать с Fabric” opens the right project conversation; Fabric asks only missing material questions, proposes scope/criteria/dependencies and writes via canonical commands. Direct Stop/Continue remain accessible; forcing conversation for urgent stop would increase operator load.

## Logs, privacy and model budget

Keep safe user-visible messages/transcripts, accepted decisions, command metadata, redacted results, source references, state changes and receipts. All records carry Project/question/Task/Run attribution when applicable. Do not store hidden model reasoning, auth headers, session/access tokens, credentials, secret env values or unbounded raw provider output. Redaction/classification happens before any persistent sink and before summary/context assembly; unknown sensitive payloads are rejected or retained only in a separately authorized protected store. Free text cannot be guaranteed safe by regex alone.

Voice uses the same ingestion boundary after transcript review; audio retention is explicit, separate and bounded. Deletion/retention must propagate to derived summaries and search indexes without quietly falsifying decision provenance. Restrict audit access. Failure diagnostics use safe error types and correlation IDs.

Token economy: use structured state, cached source indexes, incremental summaries and a small recent relevant conversation window; never replay every conversation or entire source tree. Reserve output budget, apply retrieval limits and compaction thresholds, report omitted/stale sources and numeric usage/cost. Budget exhaustion is an explicit recoverable status. Token counts are useful telemetry; access-token strings are secrets.

## Native acceptance packages

| Packet | Deliverable and predecessor | Required negative evidence |
|---|---|---|
| FR-A extension | Persistent persona/style; conversation/ticket IDs; requires existing draft persistence contracts | Restart keeps exact scope, drafts and identity; denied Project hides content |
| FR-C extension | Host picker → bounded candidates → multi-select source set and primary; requires ready observer | Empty selection, duplicate alias, denied child, stale scan, primary change during active Run |
| FR-E extension | Versioned context builder and immutable Run packet; requires source and policy receipts | Related source cannot become writer; stale proposal rejected; interrupted continuation retains exact old packet |
| FR-F extension | Conversation → proposal → command → receipt → same Board question; uses existing canonical task command, no parallel task store | Repeated/out-of-order event and apply, scope swap, unknown effect, projection failure, corrected outcome, result return |
| FR-F logging | Pre-persistence sanitizer, secret references, transcript policy, budgeted retrieval | Seeded secrets absent from every sink, summary, export and context pack; budget bound maintained without false completeness |
| FR-G extension | Real desktop end-to-end and cold restart pilot, after capability-specific receipts | OS picker cancellation/denial, real provider read/stop, exact result attribution and no invented gate pass |

Every packet supplies schema/handler bindings, migration or compatibility handling, tests, trace receipt, docs and rollback. Current mockup can illustrate these states; it does not implement the native gate system. Exact next task remains FR-A plus producer binding for FR-B/C, then FR-F command bindings; see [strategy](first-release-strategy.md#bounded-native-implementation-packets).

## Harness application

agent-stack:agent-harness applied as a design review: choose fixed workflows for named repeatable operations, agent-led exploration for unclear intent. Prefer the smallest static flow until an explicit variable decomposition requires a dynamic one; both need execution records and budget/depth bounds. Skills specify when to call each tool, allowed status vocabulary and safe recovery; the host enforces these boundaries. Installed, loaded and enforced capabilities are separate observations. Native prompt/behavior evals and actual tool-schema bindings remain acceptance work in FR-F/G; this document makes no measured reliability claim.
