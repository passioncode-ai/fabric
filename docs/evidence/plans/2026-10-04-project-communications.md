# Claude recovery and project communications — execution spine

Owner: Fabric. Status as of 2026-10-13: recovery done and 0.3.1's release commit on main (steps 1–3 below); COM-01 closed by ADR-0117; COM-02 partial in the registers only — COM-02.1–02.3 and the repin to contract DEC-0073 (fabric-agent-contract `edc88a6`, with COM-03) have all landed, and the row closes when lane 13 drops it; COM-03 partial — built and checked on owned clusters on 2026-10-13 (ADR-0149 Amendment 1), its real-client smoke (COM03-14) NOT_RUN; COM-04/COM-05 are the ready tasks; COM-06, COM-07 and COM-12 partial.
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
| COM-02 | Durable board and project mailbox | P0 | COM-01 | partial — COM-02.1, the durable core, landed 2026-10-05: migration `20261005000081_project_board.sql` (79 by count) with `board_submit` / `board_list` / `board_get` / `board_read_ack` / `board_unread`, `comms.message_submitted@1` and `comms.read_acked@1`. COM-02.2, the participant tools, landed the same day: `com.submit`, `com.list`, `com.get`, `com.read_ack`, `com.status` on a session's surface (`boardService.ts`, `boardTools.ts`), with the contract's digest, a run-bound cursor and contract-shaped refusals. **COM-02.3, the lifecycle, landed 2026-10-13** ([ADR-0149](../../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md); merge recorded in `docs/MERGES.md`): migration `20261012000103_project_board_lifecycle.sql` (86 by count) — `board_requests` keyed by (estate, message) (A7-024), the active-Project check on every read (A7-018), receipts without seq (C3), idempotency epochs with rotation and retention (A7-019), `board_reply`, `board_cancel`, deadline expiry, `board_status` for `board_unread`, `board_deliveries`, the transactional outbox and its cursors, `board_tick` on the 60 s cycle, `board.json` in the estate archive (CO-212), the private-archive list through 86 (A7-045); the service answers a lost write as "may have been stored", maps SQLSTATE 22 to `invalid_arguments` (A7-035, A7-017's residual) and registers all 17 board tools, answering `unsupported_capability` outside the pin (A7-039). Checks: `node apps/desktop/test/run-project-board-db.mjs` (30 cases, exit 0; red without migration 86 and under four planted defects), `node --experimental-strip-types --test apps/desktop/test/board-service.test.mjs` (19 tests, exit 0), `backup-paging.test.mjs`, `private-history-service.test.mjs` and the owned `run-ceo-private-archive-db.mjs` (the archive's board history, end to end). Scope: owned PostgreSQL clusters and fakes; the real-client smoke is COM-03's (COM03-14). The repin to contract DEC-0073 (COM02.3-01, `edc88a6`) and epoch rotation on restore landed with COM-03 on 2026-10-13 (see COM-03), so every part of COM-02 has landed. The row reads done once lane 13 of the general plan stops scheduling COM-02 — that lane belongs to the backlog's owner, and the change is handed to them. |
| COM-03 | Consumer identity, replacement and fences | P0 | COM-02 | partial — **built 2026-10-13** ([ADR-0149](../../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) Amendment 1; merge recorded in `docs/MERGES.md`): contract DEC-0073 pinned at fabric-agent-contract `edc88a6` (ADR-0117 Amendment 3), all seventeen board tools served; migration `20261012000104_project_board_responders.sql` (87 by count) — responder slots with a generation that only grows, enrollments, one live attempt per request, the fence rechecked in the committing statement (request, slot lock, grant, key, digest, generation and holder, attempt, both leases, revision), `board_enroll`/`board_claim`/accept/renew/progress/effect_begin/complete/reconcile/`board_responder_replace` with checkpoint transfer/fenced reply, release on session end and on grant revocation (no request moves; a fresh enroll on an empty slot turns older in-progress work into outcome_unknown), `com.status` responders, `board_responders_operator`, the project directory with operator-only unlisting (`board_set_listing`), and the restore settle as a projection rule that appends nothing; the `board.respond` grant asked in its own words (ADR-0134 Amendment 7); `fabric.board.join` board sessions; schema contract 87/87. Checks (exit 0 each): `node apps/desktop/test/run-project-board-responders-db.mjs` (19 cases; red without migration 87 and under planted defects 1, 2, 3, 6 and 8), `node apps/desktop/test/run-project-board-db.mjs` (33), `node --experimental-strip-types --test apps/desktop/test/board-service.test.mjs` (28; red under plant 9), `board-surface.test.mjs` (4), `contract-consumer.test.mjs` (69 graded comms fixtures), `src/shared/accessWords.test.ts`, `session-enroll-request.test.mjs`, the owned `run-function-privileges-db`, `run-restore-authority-db`, `run-write-rules-db` (fresh and upgraded schemas equal at 87) and `run-ceo-private-archive-db`. Scope: owned PostgreSQL clusters and fakes; the disposable-stack probes (`agent-surface.test.mjs`, `probe-fresh-vs-upgraded.mjs`) and the real-client smoke COM03-14 are NOT_RUN — no disposable built app or second stack fits this machine's disk; the commands are in the COM-03 packet below. **Wave-2 fix round, 2026-10-13** ([ADR-0149](../../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) Amendment 2; three blind readings of `e09ad8fb..3d7e7752`). Fixed on main, each test seen red first: a board session is told its epoch (`board-service.test.mjs` "a board session reads its idempotency epoch…", `board-surface.test.mjs` "a board session is told its idempotency epoch…"); a board session's leave ends it and releases its slots ("a board session's client leaving ends the session…"); a board session is respond-only, thirteen tools ("a board session lists exactly the thirteen respond-only com.* tools…", "a board session is respond-only (ADR-0149 Amendment 2)…"); an expired grant ends a board session at its next call ("a board session whose board.respond grant expired…"); `fabric.board.join` reuses an unspent bearer, caps board sessions apart, reads the grants again after the mint (`session-enroll.test.mjs` "a board join mints one board session…", "board joins are capped per binding on their own…", "the read-then-mint race: a board.respond grant…"); a launched created-agent session answers as its runner ("a launched session of a created agent responds as its runner…"); keyless calls say it is safe to resend ("a call that takes no idempotency key…"); the analytics count classifies by capability (`analytics.test.mjs` "a board.respond grant is neither…"); the archive inventory gives board authority its true class (`archive.test.ts` "epochs, slots, enrollments and attempts never claim…"); `board.read-at-start` says how to answer and `board.cross-project` names `idempotency {epoch, key}` (`protocolObligations.test.ts`); `com.enroll` names Settings → Agent access ("com.enroll's description names only routes a session has…"); the consent caveat and the Russian dative (`accessWords.test.ts`); Comms names its source Comms / «Переписка» and says the texts did not come back after such a restore (`CommsScreen.test.tsx` "after a restore whose board history did not come back…", `comms-operator-read.test.mjs` "an empty board over a journal that records messages…"). The SQL half — migration 88 (unread counts only readable deliveries, closed epochs refuse renew/progress, lock order, `reconcile_required`, replay authority) with the repin to contract DEC-0078 at `f00a768` (`transferred` in the replace receipt, the read-back withdrawn) — is on `agent/com-w2-fixes-db`, held from main until its owned-cluster DB tier runs (disk under 3 GB; CO-287). Left: CO-288 (board sessions get no board rules); CO-289 (fabric-workspace pages: PRs #195 `129ccdb`, #196 `37cd42f`), CO-290 (adapter directory wording: fabric-agent-adapter 0.28.0, PR #99 `96defa2`) and CO-291 (the 0.3.6 onboarding plan's `note` kind: `agent/onboarding-036-w1` `5ad30a04`) were fixed elsewhere the same day and are written as resolved. CO-287…CO-291 and the updates to CO-283…CO-285 are in the carry-over ledger since the registers landing that followed the round (another run held the ledger's claim through it; the applied text is [`2026-10-13-com03-w2-fixes.carryover.patch`](../../handoffs/2026-10-13-com03-w2-fixes.carryover.patch)). The DB tier of the SQL half ran in part on `agent/com-w2-fixes-db` (`299b8a6c`): responders 23/23, project-board 33/33, restore-authority exit 0; write-rules, ceo-private-archive and function-privileges and the planted defects wait for disk (CO-287). Remaining: COM03-14 and the operator-visible E2E walk; the responder indicator on SCR-81 and unlisting in Settings (COM-07/COM-06, wave 4). Next ready: COM-04 (FAA-12b), COM-05 |
| COM-04 | Claude/Codex consumer adapters | P0 | COM-03 | open |
| COM-05 | Work awareness and dependency findings | P1 | COM-02, COM-03 | open |
| COM-06 | Board scenarios and operator controls | P1 | COM-01 | partial — the operator's read screen and its scenario (SCN-143, FLW-83, SCR-81) landed in `3bba5412`; operator controls (pause, stop) are approved for a later wave (operator decision D9, 2026-10-12) |
| COM-07 | Live board, history and chain interface | P1 | COM-03, COM-05, COM-06 | partial — slices landed: the live read with history paging (`3bba5412`), filters by participant, kind and open request (`bbaec717`), the operator's own unread marks (`e4318bf2`), time filters (`50cb3b18`, `2edc2242`). Remaining: participant read marks, artifact links, virtualized history, responder state per request, the chain interface |
| COM-08 | Telegram transactional mirror | P1 | COM-02, COM-06 | open |
| COM-09 | Telegram replies and agent discussion | P1 | COM-03, COM-04, COM-08 | open |
| COM-10 | Attribution and Observatory analysis | P1 | COM-02, COM-03 | open |
| COM-11 | Service monitoring and provider provenance | P1 | COM-03, COM-07 | open |
| COM-12 | Cross-repository protocol rollout | P1 | COM-04, COM-11; COM-09 only for Telegram-enabled rollout | partial — fabric-workspace PR #182 merged: `knowledge/agents-first.md` "The project board" and `docs/evidence/com-12-rollout.md`. Remaining: the adapters, Dashboards and Switchboard rollout after COM-04/COM-11 |
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
**Built 2026-10-13 (see the COM-03 row).** The real-client smoke (COM03-14, R-010) is owed, against a disposable built
app and stack only — never the operator's live estate:
`claude mcp add --scope user fabric -- "<Fabric>/bin/fabric-mcp" --runner claude-code` and
`codex mcp add fabric -- "<Fabric>/bin/fabric-mcp" --runner codex` (ADR-0134 Amendment 2); the operator allows
`session.enroll` and `board.respond` (`board:<example-agent project>/<capability>`) for both; `claude -p
--output-format stream-json` submits a request; `codex exec` calls `com.enroll`, `com.claim`, `com.accept`,
`com.complete`; Claude is then killed mid-claim and Codex takes over (`com.enroll` on the lapsed slot, `com.claim`).
Receipt: both transcripts, the CLI versions and the negotiated tool list. First check: tool names with `.` must be
callable in both CLIs; if either refuses them, stop and raise it with the contract owner.

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
