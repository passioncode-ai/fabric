# Claude recovery and project communications — execution spine

Owner: Fabric. Status as of 2026-10-05: recovery done and 0.3.1's release commit on main (steps 1–3 below; tagging is the operator's); COM-01 closed by ADR-0117; COM-02 next.
This source owns `COM-*` task status only. The existing hub verification ledger owns its findings;
private consumer queues stay private. No existing backlog row is duplicated here.
Architecture context: [RPT fabric/2026-10-04-project-communications §Canonical identities and contract](../../reports/2026-10-04-project-communications/README.md#canonical-identities-and-contract).

## One execution order

1. Converge the interrupted hub work in isolated branches; close every iteration-2 finding with
   a code/test/decision receipt in [hub verification](2026-10-04-hub-verification.md). Root owns
   ingress/resource bounds/docs; core owns authority/replay; surface owns product-connect UX.
2. Run the required focused and full disposable-database gates, then fresh independent
   iteration-3 reviews on the converged candidate. Do not run migrations on the installed old app.
3. Prepare the 0.3.1 release candidate/upgrade evidence and the human protected-environment
   approval request. Never represent local tests, pushed branches or a rehearsal as a release.
4. Implement COM-01 → COM-02 → COM-03 → COM-04; research remaining packets in parallel,
   reporting dependencies to the current implementer immediately. COM-05 follows both COM-02 and COM-03.
5. COM-06 and COM-07 produce operator acceptance; COM-08/09 add optional Telegram transport.
   COM-10/11 provide analysis and compatibility; COM-12/13/14 finish ecosystem rollout.
6. Private consumer M0/W0 documentation recovery has its own canonical queue and review;
   its first code packet is consistent SQLite backup/restore. Public delivery uses `example-agent`.

## Coordination during this run

Task-owned isolated worktrees preserve interrupted changes. Claims protect shared registries;
no expired lease is stolen without the tool's ownership proof. `agent-sync` edit leases are
separate from the product's future communication delivery leases. An agent reports a discovered
cross-packet dependency immediately with affected task, evidence, consequence and proposed
change; the root updates this spine and the owning packet, then acknowledges the update.
Current team mailbox handles that coordination now; the future board is not claimed operational.
A cold resume starts here, checks Git refs/current leases, then opens the earliest nonclosed
ready packet. Dependency work may proceed while a release approval or owned-file lease is pending.

## Canonical communication task status

| ID | Packet | Priority | Depends on | Status |
|---|---|---|---|---|
| COM-01 | Contract and source map | P0 | Hub convergence | closed — contract `fabric-project-comms/0.1` is DEC-0022 on fabric-agent-contract `d4c8831` (operator accepted C1–C9, 2026-10-05); Fabric adopts it in [ADR-0117](../../adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md) (names, enrollment, leases, restore); the vendored contract fixture is repinned to `d4c8831` with all 17 comms verdicts checked (`apps/desktop/test/contract-consumer.test.mjs`) |
| COM-02 | Durable board and project mailbox | P0 | COM-01 | partial — COM-02.1, the durable core, landed 2026-10-05: migration `20261005000081_project_board.sql` (79 by count) with `board_submit` / `board_list` / `board_get` / `board_read_ack` / `board_unread`, `comms.message_submitted@1` and `comms.read_acked@1`, checked by `apps/desktop/test/project-board-db.test.mjs` (12 cases: cross-estate refusal first, lost-response retry, concurrent duplicate, FAC-SEM-026, byte limits, seq pagination, explicit read marks, writer gate, immutability, replay). Remaining: COM-02.2, the participant tools `com.*` on the agent surface (host digest and cursor binding, read errors as unavailable); COM-02.3, cancel, expiry, retention and archive history (CO-212) |
| COM-03 | Consumer identity, replacement and fences | P0 | COM-02 | open |
| COM-04 | Claude/Codex consumer adapters | P0 | COM-03 | open |
| COM-05 | Work awareness and dependency findings | P1 | COM-02, COM-03 | open |
| COM-06 | Board scenarios and operator controls | P1 | COM-01 | open |
| COM-07 | Live board, history and chain interface | P1 | COM-03, COM-05, COM-06 | open |
| COM-08 | Telegram transactional mirror | P1 | COM-02, COM-06 | open |
| COM-09 | Telegram replies and agent discussion | P1 | COM-03, COM-04, COM-08 | open |
| COM-10 | Attribution and Observatory analysis | P1 | COM-02, COM-03 | open |
| COM-11 | Service monitoring and provider provenance | P1 | COM-03, COM-07 | open |
| COM-12 | Cross-repository protocol rollout | P1 | COM-04, COM-11; COM-09 only for Telegram-enabled rollout | open |
| COM-13 | Public docs, website and screenshot evidence | P2 | COM-07, COM-12 | open |
| COM-14 | Failure acceptance, builds and installation | P0 release gate | COM-07, COM-10, COM-12; COM-09 only for Telegram-enabled artifacts | open |

The core board/adapters/attribution/monitoring release can pass COM-12/14 with Telegram disabled.
A build that advertises Telegram requires COM-08/09 and their transport-specific acceptance before
that feature is enabled; disabled transport is explicitly recorded, never silently graded green.

## Shared implementation context

Read Fabric AGENTS, knowledge vision/principles/rules, ADR-0115, this report, the hub ledger,
`agentSurface.ts`, `continuationDelivery.ts`, `deliveryQueue.ts` and the relevant migrations.
Use journal append/projectors/ScopedStore and estate-authorized command RPCs. Do not create
an in-memory-only mailbox, mutate projections directly, widen hub grants, or put credentials
in the renderer. No IPC renderer parameter can choose estate/actor identity. All packets
include docs/scenarios with code, focused failure tests, own branch+commit handoff, and
integration checks required by their owner. Migration version is the migration count; never
assume a timestamp suffix is schema_version(). Rehearse against disposable data only.

A completion receipt names candidate commit, actual check command/exit, fixture/live scope,
known exclusions and next ready task. `open` becomes `closed` only with that receipt. A
consumer repo refers to the Fabric contract and queue; it owns only its adapter work row.

## COM-01 — contract and source map

**Owner:** Fabric + fabric-agent-contract. **Context:** current session-scoped task APIs are not
project-addressed messaging. Inventory existing journal types, task/delivery RPCs, hub binding
scopes, registry project identity and provider adapters before selecting extension points.
**Deliver:** versioned message/query/claim/ack/reply schemas and capability negotiation; specify
request versus transport state, dedup scope, limits, cursor semantics, actor provenance,
expiry/cancellation, artifacts and errors. Select migration/API names without conflicting with
active reserved migrations. Add compatibility fixtures and an ADR through reserved ID workflow.
**Acceptance:** old clients retain existing tools; unsupported capability gives typed error;
forged sender/estate/session rejected; same key/different digest conflicts; enum/body limits
fail before journal append. Publish the exact source baseline and dependent owner issue links.
**Resume:** inspect ingress `HubIngress` and task-surface auth before drafting schemas.

## COM-02 — durable board and project mailbox

**Owner:** Fabric storage/main. **Deliver:** append-only communication events and query projections;
transactional submit + delivery eligibility + outbox record, thread reply linkage, monotonic
cursor pagination and project-scoped reads. Reuse task linkages without silently turning every
chat message into a task. Add expiry/cancel commands and bounded retention policy receipts.
**Acceptance:** crash after append/before response returns same message on retry; restart preserves
queued request; two estates cannot enumerate each other; pagination has no lost event across
insert/replay; read errors are unavailable, not empty; restore replays state without credentials.
**Scope:** no Telegram, provider launching or board visuals. **Resume:** first owned disposable-PG
fixture creates two estates and proves cross-estate submit/read refusal before successful submit.

## COM-03 — consumer identity, replacement and fences

**Owner:** Fabric admission/runtime. **Deliver:** project consumer registration under scoped binding;
provider/session provenance, lease renewal, generation CAS, matching by capability, one fenced
claim per delivery, exact-digest acceptance and attributed reply/completion. Explicit replacement
and reconnect need current authority; discovering a PID grants none. Unaccepted safe work can
be reassigned; accepted unknown-effect work needs reconciliation/handoff policy.
**Acceptance:** Claude takes request, dies; Codex registers same project; queued work is claimable;
old Claude generation cannot ack/reply/renew/complete Codex work. Concurrent registrants cannot
both own a delivery. Revocation between claim and effect refuses. Clock skew cannot extend lease
(client clock not authoritative). Show stale/offline and unknown outcome without success wording.
**Resume:** inspect continuation_dispatch/acknowledge_delivery fences and mirror their semantics.

## COM-04 — Claude/Codex consumer adapters

**Owner:** fabric-agent-adapter; Fabric provides CLI/MCP commands. **Deliver:** provider-neutral
consumer client, registration/replacement handshake, startup catch-up, periodic cursor poll with
jitter, claim/ack/reply helpers, explicit safe checkpoint and shutdown lease release. Adapter
prompt explains board-first workflow and separates request admission from arbitrary execution.
Existing local sessions can enroll without being forcibly restarted or receiving private data.
**Acceptance:** real Claude→Codex smoke test on `example-agent`; reconnect/missed notification
catches up; same payload processed once logically; disk-full/checkpoint write failure does not
advance; grant missing is actionable; cancellation during long polling exits cleanly. Record
provider versions and negotiated tool capability. **Resume:** use COM-01 fixtures without secrets.

## COM-05 — awareness and dependency findings

**Owner:** Fabric. **Deliver:** project/current work/claimed file-or-task references, heartbeat claims
with age, structured important finding (`affected_task_ids`, evidence, consequence, severity),
recipient subscriptions and explicit read/ack. Dependencies link canonical owner tasks; no second
editable backlog. Findings may notify current owner even when discovered in a future packet.
**Acceptance:** future research finding reaches current implementer; duplicate notification does
not duplicate finding; unavailable owner leaves visible pending item; heartbeat does not claim
verified health; unauthorized task/file references are redacted. **Resume:** map fabric_heartbeat
and existing registry/tasks projections, then add only missing semantics.

## COM-06 — board scenarios and operator controls

**Owner:** Fabric UX. **Deliver:** scenarios/flow matrix for onboarding a local project, choosing its
responder, observing replacement, submitting/replying, examining pending work/dependencies,
reconciling unknown effect, historical search, Telegram enrollment and stopping discussion loops.
Define role/estate permissions, disclosure preview, all refusal/offline/loading/empty states,
keyboard navigation and reduced motion. Use installed super-ux first; visual work then design,
shipped strings read the brand pack. **Acceptance:** scenario audit traces each state to contract
and each proposed control to actual authority. No button promises unsupported recovery.
**Resume:** update docs/ux source scenarios before implementing any board UI.

## COM-07 — live board, history and chain interface

**Owner:** Fabric renderer/main IPC. **Deliver:** canonical board views, current responder indicator,
request/ack/effect distinction, timeline and related threads, project/provider/status/time filters,
artifact links, pause/stop controls and mirror-lag indicator. Resumable subscription with cursor
poll fallback; bounded virtualized history. Avoid exposing tokens or raw process arguments.
**Acceptance:** two local projects collaborate live; switch provider while pending; reopen app and
history persists; dropped subscription recovers; cross-estate navigation denied; keyboard and
screen-reader workflow passes; screenshots at supported widths in approved theme. **Resume:**
implement one end-to-end scenario using COM-02 query fixtures, then extend by scenario priority.

## COM-08 — Telegram transactional mirror

**Owner:** fabric-agent-adapter optional service + Fabric outbox. **Deliver:** enrolled numeric bot/chat/
topic map and vault slot, one leased intake owner per bot, durable update inbox, transactional
outbox worker, canonical-event/message mapping, bounded backoff/rate handling, sanitation,
capability probe and visible lag/failure. Read current Bot API at implementation; polling and
webhook have separate adapters and cannot both own the same token. launchd is supervisor.
**Acceptance:** board works with Telegram down; crash before intake ack is deduplicated; lost send
response is unknown/reconciled rather than declared delivered; 429 respects retry_after; revoked
chat/bot stops disclosure; malicious payload never puts token in logs; no double mirroring.
**Resume:** fixture-only worker first; live enrollment only with existing authorized vault/rights.

## COM-09 — Telegram replies and agent discussion

**Owner:** adapter + Fabric admission. **Deliver:** reply-parent mapping; allowlisted numeric actors;
bot→project identity; human commands scoped to enrolled roles; discussion budgets/depth/deadline;
mirror origin markers; raw-text prompt isolation; capability diagnostics. Optional distinct bots
represent agents. Bots still use Fabric as task state and message dedup authority.
**Acceptance:** group directed command/reply capability matrix including mode off/on; private both
modes where enabled; spoofed username and foreign chat rejected; echo never reimports; rapid bot
loop terminates; stopped session's bot request reaches project's new responder; revoked grants
block side effects. Exact chat/bot receipt may be private, public fixture uses neutral IDs.
**Resume:** verify current bot-to-bot settings without enabling new privileged modes implicitly.

## COM-10 — attribution and Observatory analysis

**Owner:** Fabric export + project-observatory read-only consumer. **Deliver:** actor/project/provider/
session/generation, message/request/delivery/attempt, correlation/causation and trace IDs; metrics
for lag, unacked work, retries, replacement, unknown effects and discussion budget. Privacy-scoped
export with retention/redaction. Link measured model cost only when a real usage receipt exists.
**Acceptance:** event chain reconstructs after replay/restart; trace context cannot select estate;
missing usage shows unknown; export cannot leak private payloads; deleting external post keeps
tombstone provenance; projection hash reproducible. **Resume:** inventory existing ops/journal fields.

## COM-11 — monitoring and provider provenance

**Owner:** fabric-dashboards + fabric-switchboard. **Deliver:** comms capability/service health/deep link
in Dashboards, provider/account/session replacement provenance in Switchboard. Keep the board
in Fabric. Changes to service descriptors/contract belong to their canonical owner, fixtures pinned.
**Acceptance:** app works standalone without Fabric installed; no listener/token in renderer;
start/stop only launchd; stale provider process never becomes current responder; links fail safely.
**Resume:** inspect each owner's existing capability/link APIs and create canonical owner packets.

## COM-12 — cross-repository protocol rollout

**Owner:** Fabric coordinator + each owning repo. **Deliver:** central manifest of remote/branch/commit/
entrypoint/status/compatibility; owner issues/comments referencing this spine and scoped work;
knowledge architecture guide; adapter instructions for all enrolled agents; canonical backlog source
aggregation and published source-commit receipt. A delivered policy revision is not proof every
already-running session read it: record explicit per-session acknowledgements where supported.
**Acceptance:** fresh checkout resolves all links/pins; plugin installed bytes match delivered version;
Claude and Codex capability receipts; no private consumer names in public artifacts; each module
has one writable task source. **Resume:** inspect org-index/repositories.json and current open issues
before creating duplicates; check active edit claims before owner register changes.

**Delivery snapshot 2026-10-04:** owner issues are published: [Adapter #31](https://github.com/passioncode-ai/fabric-agent-adapter/issues/31),
[Dashboards #26](https://github.com/passioncode-ai/fabric-dashboards/issues/26),
[Switchboard #36](https://github.com/passioncode-ai/fabric-switchboard/issues/36),
[Observatory #146](https://github.com/passioncode-ai/project-observatory-dashboard/issues/146),
[site #37](https://github.com/passioncode-ai/passioncode-ai.github.io/issues/37).
The shared knowledge packet is integrated in [Workspace PR #33](https://github.com/passioncode-ai/fabric-workspace/pull/33),
merge `3f725d37490a753ce5e06673fb3a98395ce9a845`; its issue-body/commit receipts are in
[the owning handoff](https://github.com/passioncode-ai/fabric-workspace/blob/3f725d37490a753ce5e06673fb3a98395ce9a845/docs/handoffs/2026-10-04-hub-com-knowledge.md).
Existing-session read/acknowledgment, runtime implementation, installed adapter bytes and
publication of this final Fabric source are still open. This partial delivery does not close COM-12.

## COM-13 — public product explanation and screenshots

**Owner:** website + Fabric docs, not monitoring-product rebranding. **Deliver:** clarify Fabric creates/
coordinates agents while Dashboards monitors services; correct GitHub/release/download links;
real board/replacement/thread screenshots with safe demo data and descriptive alt text; extractable
public facts and scenario-backed copy. Canonical brand edits occur on website then vendor repin.
**Acceptance:** links resolve to intended repository and released artifact; screenshot matches build
receipt; privacy review; published website served commit identified; unshipped capabilities labelled.
**Resume:** inspect current public pages and product ownership, then route copy/design/SEO appropriately.

## COM-14 — failure acceptance, builds and installation

**Owner:** Fabric coordinator and each release owner. **Deliver:** adversarial test matrix covering DB/
app/adapter/Telegram restarts, two claimers, stale owner, offline project, lost ack, duplicate reply,
out-of-order cursor, clock skew, revoked scope, restore, backlog pressure and bot loops. Focused
owner gates then one required converged full disposable-PG run. Build/install/release receipts
remain separate; never change nightly CI policy or dispatch full suites for every push.
**Acceptance:** each scenario has actual outcome and exclusions; protected release approvals are
human; installed versions/pins verified; docs and website correspond to artifacts; no open blocking
finding. **Resume:** run earliest discriminating test on the merged candidate, not unrelated main.
