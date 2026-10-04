---
report:
  id: fabric/2026-10-04-project-communications
  title: "Project-addressed agent communication and Telegram mirror"
  kind: research
  project: fabric
  domains: [ai-agent, orchestrator, mcp, automation]
  as_of: 2026-10-04
  status: draft
  valid_until: 2026-11-04
  summary: >-
    Design proposal: Fabric owns a durable, estate-scoped project communication board.
    Sessions claim work with fencing; a provider change preserves the project address.
    Telegram mirrors admitted board events and imports authenticated replies through
    the same command boundary. Implementation and live bot acceptance remain open.
  sources:
    - name: "Fabric source baseline"
      url: "https://github.com/passioncode-ai/fabric/tree/41f994a7"
      read_at: 2026-10-04
    - name: "Telegram bot-to-bot features"
      url: "https://core.telegram.org/bots/features#bot-to-bot-communication"
      read_at: 2026-10-04
    - name: "Telegram Bot API"
      url: "https://core.telegram.org/bots/api"
      read_at: 2026-10-04
    - name: "MCP transport specification"
      url: "https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/basic/transports.mdx"
      read_at: 2026-10-04
    - name: "MCP host validation maintainer discussion"
      url: "https://github.com/modelcontextprotocol/typescript-sdk/issues/2489"
      read_at: 2026-10-04
    - name: "A2A specification snapshot"
      url: "https://github.com/a2aproject/A2A/blob/fe182ee3c053d2e6a3ad2576c959fa5f7d8b5d07/docs/specification.md"
      read_at: 2026-10-04
    - name: "A2A idempotency developer discussion"
      url: "https://github.com/a2aproject/A2A/discussions/1857"
      read_at: 2026-10-04
    - name: "W3C Trace Context"
      url: "https://www.w3.org/TR/trace-context/"
      read_at: 2026-10-04
  produced_by:
    agent: "Codex"
    task: "Claude recovery and operator-requested communication architecture"
  supersedes: []
  consumers: [fabric, fabric-agent-contract, fabric-agent-adapter, fabric-dashboards, fabric-switchboard, project-observatory, fabric-workspace]
---

<sub>ssheleg skills — task-pipeline · agent-sync · project-reports · agent-interop · agent-orchestrator · telegram-bots · claude-history-ingest · copywriting</sub>

# Project communication: research and architecture proposal

This is a design snapshot, not a claim that the communication feature is shipped.
The canonical implementation queue is [the execution plan](../../evidence/plans/2026-10-04-project-communications.md).
Private consumer projects are intentionally absent from this public artifact.

## Operator intent

An agent asks a **project** for work or a decision. Claude ending and Codex starting must
not lose that request or silently give an old session write authority. Agents inspect a
shared board at startup, periodically and before taking dependent work. The operator can
see assignments, pending questions, event chains, transport receipts and historical runs.
Telegram is a supplemental shared discussion channel; each agent may have its own bot.
The Fabric board remains authoritative even when Telegram is absent.

## Existing foundations and their limits

At baseline `41f994a7`, `apps/desktop/src/main/agentSurface.ts#fabric_task_handoff` defines
`fabric_task_handoff`, `fabric_task_accept` invokes `acknowledge_delivery` with the trusted session identity,
and `fabric_heartbeat` defines `fabric_heartbeat`. A heartbeat phase is a self-report, not a health proof.
`apps/desktop/src/main/continuationDelivery.ts#createContinuationDelivery` distinguishes agent acceptance from terminal
write, and `dispatch` fences writes before declaring their result. Those are reusable semantics.
They do not themselves establish a durable cross-project mailbox or a provider-neutral
project consumer. Existing task ownership and continuation delivery must remain intact.

Reproduce these observations with `rg -n 'fabric_task_handoff|acknowledge_delivery|fabric_heartbeat'
apps/desktop/src/main/agentSurface.ts` and read `continuationDelivery.ts`. Source references are
baseline-relative; the new implementation must publish its own checked commit and tests.

## Ownership proposal

| Owner | Responsibility | Boundary |
|---|---|---|
| Fabric | Estate/project addressing, admission, journal/projectors, queue, ownership fences, board and history | The sole canonical message and request state |
| fabric-agent-contract | Versioned envelope, state meanings, compatibility fixtures | No transport or private session inventory |
| fabric-agent-adapter | Claude/Codex consumer registration, safe polling, project request/reply client; optional Telegram worker | No second board or independent task authority |
| fabric-dashboards | Service health, communication capability and deep link to Fabric board | Monitor; does not start agents outside launchd |
| fabric-switchboard | Provider/account/process provenance and replacement signal | A provider identity is not Fabric project authority |
| project-observatory | Vault, attributed telemetry and read-only analysis export | Metrics are not message state or an alternate task scheduler |
| fabric-workspace | Shared architecture/operator guide and derived cross-repository backlog | Task status stays in each owner's canonical source |
| passioncode-ai.github.io | Accurate product explanation, repository links, verified screenshots | Planned capabilities must not masquerade as released ones |
| fabric-inbox | Optional external human inbox references | Email is not the internal agent communication board |

The Telegram transport should run as an optional service under the existing service
contract and launchd lifecycle, consuming Fabric's command API. A long-lived cloud relay,
if later needed, is a separate deployment packet: do not require it for local board delivery.
A2A is an optional external interoperability adapter, not a prerequisite for local sessions.
MCP exposes scoped board commands/queries while the journal defines their durable meaning.

## Canonical identities and contract

Address = `(estate_id, project_id, capability?)`; never cwd, PID, bot username or session ID.
A registered `consumer_id` has server-authenticated `session_id`, project and lease. Managed provider provenance comes from the owned runtime; an external provider label remains an assertion until adapter evidence verifies it. Each registration has lease
expiry and monotonically increasing generation. Session replacement is an explicit CAS
transition. Multiple sessions may be visible, but a delivery has one current fenced owner.
An expired owner can neither acknowledge nor complete the next owner's delivery.

A proposed envelope contains `message_id`, schema version, sender project/actor, recipient
project, kind (`request`, `reply`, `finding`, `announcement`, `cancel`), thread/parent IDs,
correlation/causation IDs, idempotency key, body or artifact reference, timestamps, optional
expiry, priority and expected capability. Server supplies sender identity and sequence.
Callers cannot impersonate another project by filling envelope fields. Validate size, enum,
artifact URI and nesting limits before journalling. Private artifact access does not widen
when a thread has public participants. Do not embed keys, environment dumps or hidden reasoning.

Request state and transport state are separate. Proposed request lifecycle:
`queued → claimed → accepted → working → completed|failed|cancelled|expired`.
A claim is a lease, acceptance proves reading the payload digest, and completion requires
an attributed result/artifact receipt. Delivery attempt states preserve `written`,
`failed_before_write`, and `outcome_unknown`. Timeout after an external side effect never
proves no effect. Safe replay means same logical identity plus durable deduplication;
unknown non-idempotent effects require reconciliation rather than blind resending.

Queue queries are cursor-based and paginated, with bounded page/body limits. Cross-project messages require participant-authorized readers or participant-edge projections: neither an estate-wide table exemption nor one project_id equality provides sender/recipient privacy. Generic estate journal replay cannot be exposed unchanged to project consumers. Notifications
are a latency optimization; persisted polling is the recovery path. Default proposed poll
interval is 30 seconds with jitter/backoff, immediately on startup and before dependent work.
An agent doing a long tool call need not interrupt it; expiry and operator visibility must
make delayed service explicit. Checkpoints only advance after durable handling/acknowledgement.
Discovery provides no consent to execute requests. Current hub bindings grant product-call authority, not project communication participation: COM requires separately enrolled project communication capabilities. Existing acknowledge_delivery validates session/digest but does not supply the new consumer-generation fence; it must not be reused unchanged for replacement.

## A2A boundary and durable delivery

The [A2A specification snapshot](https://github.com/a2aproject/A2A/blob/fe182ee3c053d2e6a3ad2576c959fa5f7d8b5d07/docs/specification.md)
permits implementations to make SendMessage idempotent; this is not an unconditional
exactly-once effect guarantee. The [maintainer-hosted developer discussion](https://github.com/a2aproject/A2A/discussions/1857)
raises duplicate delivery and cancellation semantics as protocol gaps; proposals there
are not normative requirements. Fabric must retain its own transactional deduplication,
accepted-work generation fences and explicit unknown-effect reconciliation.

The [task lifecycle snapshot](https://github.com/a2aproject/A2A/blob/fe182ee3c053d2e6a3ad2576c959fa5f7d8b5d07/docs/topics/life-of-a-task.md)
distinguishes messages from committed tasks and keeps terminal tasks terminal. A follow-up
can create another task in the same context. Our design consequence: board thread identity,
request identity, delivery attempt and runtime session remain separate; replacing a responder
cannot restart a terminal request or relabel an unknown external effect as safe to repeat.
COM-01 must document a future A2A mapping against a named version, with unsupported
semantics explicit. Local Claude/Codex consumers first use Fabric's admitted command API;
an A2A peer bridge is optional and cannot choose estate authority through context IDs.

## Telegram findings and design consequences

The current [features page](https://core.telegram.org/bots/features#bot-to-bot-communication)
describes conditional bot-to-bot delivery: group commands/replies can work with the mode
on at least one bot; private bot messaging requires it on both. Broader group reception
also depends on receiver settings. The older FAQ's blanket prohibition therefore cannot
be the integration contract. Test each participating bot and its actual group configuration.
The page requires loop safeguards; treat bot visibility as a capability, not assumed delivery.

The [Bot API](https://core.telegram.org/bots/api) specifies mutually exclusive polling and
webhook intake, offset-based polling confirmation and `update_id`. Persist intake under
`(bot_id, update_id)` before advancing the offset or acknowledging a webhook. Use a single
consumer owner per token. Handle throttling with `retry_after`, and sanitize HTTP errors
because the Bot API path contains the token. The method contract is mutable: verify it
again at implementation and record capability receipts without recording tokens.

**Our design**, rather than a Telegram guarantee: board commit creates an outbox entry in
the same transaction. The transport records `(board_event_id, bot_id, chat_id, topic_id,
telegram_message_id, attempt_id)` and maps replies back to the canonical thread. A Telegram
send timeout is unknown; it cannot roll back the board or imply exactly-once visible posting.
Bot API provides neither a general sent-history query nor a send idempotency key: an unknown
visible post blocks automatic retry until explicit reconciliation. Multiple participating bots
may receive the same external message; deduplicate by chat/message identity in addition to
per-bot update_id. [Detailed transport packet](../2026-10-04-telegram-board-transport/README.md).
Use stable event markers, reconciliation and explicit duplicate visibility where the API
cannot prove send identity. The inbound body is untrusted content. Actor authorization uses
numeric IDs and an enrolled chat/topic mapping; display names and mentions grant no rights.
Shared-chat enrollment specifies allowed disclosure and allowed actions. Revoke/delete of
an external message never silently erases an audit event; append a tombstone/redaction receipt.

Agents may discuss in the group, but autonomous bot turns are admitted by Fabric with
thread budget, depth and deadline. A mirrored reply is marked and never re-imported as new
work. First implementation proposals: maximum 8 autonomous turns per thread, 60-second
minimum unsolicited turn interval per agent, and 10-minute discussion deadline; these are
configurable product limits, not Telegram API rate limits. Human-directed replies may extend
a thread explicitly. A transport outage leaves board work actionable and exposes mirror lag.

## Observability and interface acceptance

Every event records trusted actor/project/session/provider, request/delivery/attempt IDs,
UTC time, canonical sequence, correlation/causation and optional validated trace context.
[W3C Trace Context](https://www.w3.org/TR/trace-context/) standardizes propagated trace IDs;
trace headers must not become authentication or tenant selectors. Use event IDs for business
state and trace IDs for diagnostics. Never infer model cost from a message count.

The board must show current project responder, provider replacement history, stale heartbeat,
pending/claimed work, unread findings, dependencies and exact acknowledgement versus effect
status. Drill down into an event chain, filter live/history by project/actor/request/time and
compare transport status with canonical state. Show offline, access denied, empty, expired,
unknown outcome and cursor recovery states. Keyboard/screen-reader and reduced-motion
acceptance are required. Scenarios, visual tokens and shipped strings go through the project
UX/design/brand routes before UI implementation. No fabricated live screenshots.

## Research gaps and next evidence

Project communication persistence and admission, adapter enrollment, actual bot capability,
retention/redaction projection, UI workflow and cross-module rollout are **not implemented**
by this report. The first implementation packet follows hub convergence and schema readiness.
Each packet names a discriminating failure test, not only a successful demo. Real Telegram
acceptance requires enrolled bots/chat rights; code may be tested with deterministic fixtures
before credentials exist. Release approval and installed build proof are separate gates.

The SDK maintainer [host validation thread](https://github.com/modelcontextprotocol/typescript-sdk/issues/2489)
reports userinfo parsing pitfalls. The local ingress therefore uses exact raw loopback Host
and rejects browser Origin, rather than treating parsed hostnames as a trust boundary. This
finding applies immediately to hub recovery, not only future communication work.

Core implementation inventory: [dated source map and COM-01–03 packet](../../../docs/handoffs/2026-10-04-comms-core-research.md).

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded the recovery and COM task packets
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — protected shared registers with Git leases
- `project-reports` — created versioned research reports — not a skill this family ships
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — defined protocol and authority boundaries
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — separated orchestration ownership
- [`telegram-bots`](https://github.com/ssheleg/telegram-dev) — checked current bot transport semantics
- `claude-history-ingest` — recovered the interrupted Claude context — not a skill this family ships
- [`copywriting`](https://github.com/ssheleg/super-ux) — reviewed schema recovery and connection messages

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
