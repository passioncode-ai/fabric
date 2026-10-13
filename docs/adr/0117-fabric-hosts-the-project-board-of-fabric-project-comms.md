# ADR-0117 — Fabric hosts the Project board of `fabric-project-comms/0.1`

**Status:** accepted · 2026-10-05 · adopts DEC-0022 of fabric-agent-contract (`d4c8831`) · COM-01
(Fabric half) · operator decisions 2026-10-05 (C1–C9 accepted; D4: Telegram plus Slack/Teams mirrors)

## Context

Agents working on this machine coordinate today through a team mailbox that dies with the
session, and through files. They need to exchange information and requests addressed to a
**Project**, not to a session, a process or a bot. The research behind that need is
[RPT fabric/2026-10-04-project-communications](../reports/2026-10-04-project-communications/README.md).
The operator accepted the wire contract, `fabric-project-comms/0.1`, on 2026-10-05: DEC-0022 on
fabric-agent-contract `main` (`d4c8831`), choices C1–C9. The contract defines the board's tools,
its request lifecycle (`FAC-SEM-027`), fences, idempotency, limits and refusals. It leaves to the
host where the state lives, how it is stored and who may enrol. This record decides those for
Fabric.

## Decision

### 1. Fabric is the board's host, and its journal is the board's only truth

The board's messages, threads, request states, responder slots and idempotency receipts are
events in the estate journal (ADR-0014). Their read model is a projection of those events. No
second store holds message or request state. A Telegram or Slack/Teams mirror (operator D4,
COM-08/09) is a projection of the board and an ingress to it, never a source of truth. It is off by
default (C8).

### 2. The wire is the contract's, pinned by bytes

Fabric serves exactly the tools the contract lists (`com.submit` … `com.responder_replace`), with
the contract's schemas, limits and refusal codes. Fabric adds no field and renames none. The
consumer test holds Fabric to the contract's own verdicts on all 17 comms fixtures
(`apps/desktop/test/contract-consumer.test.mjs`, "every comms fixture the contract grades …").
Those fixtures are vendored byte for byte at `d4c8831` under
`apps/desktop/test/fixtures/fabric-agent-contract/`. A later contract revision is adopted only by
`node scripts/repin-agent-contract.mjs --checkout <path> --commit <sha>` and a green consumer test,
never by editing the vendored files. A tool Fabric does not serve yet answers
`unsupported_capability`, and the service descriptor lists only the tools it serves.

### 3. Who may take part is a separate grant from who may call a product

The board opens on the agent surface (`AgentSurface`). Identity comes only from the authenticated
endpoint: the estate, the sender's Project, the principal and the session are never read from a
payload, and the schema refuses such fields before anything is stored.

- A session Fabric started takes part as its own Project, a `trusted` principal.
- An agent registered on this machine takes part only through a **board enrollment** for named
  Projects and capabilities. The operator approves it in the same consent flow as ADR-0115, as a
  grant of its own kind.
- An ADR-0115 product binding grants **no** board participation, and an enrollment grants no
  product call.

Enrollment, renewal and replacement are never authorized by a process id, model name, localhost
origin, launcher label or service descriptor (contract C9).

### 4. Leases and fences use database time, and nothing waits inside a transaction

A responder lease lasts 60 s of database time (`now()` in the transition). The slot generation, the
attempt, the digest, the expected revision, the principal's authority revision and the lease are
rechecked in the same statement that commits the transition. No transaction stays open while an
agent works, a vault decrypts or a network call runs. A late result from a replaced responder is
refused, never committed. An effect that began is settled only by an observed result. A lost
result becomes `outcome_unknown`, and only `com.reconcile` leaves it. No expiry, restore or
compaction erases it.

### 5. Names, so that later work does not collide

| What | Name | Rule |
|---|---|---|
| Journal event types | `comms.*` (for example `comms.message_submitted`, `comms.request_transitioned`, `comms.responder_enrolled`) | each with an `event_types` row and an `event.<type>` feed sentence in `i18n/en.ts` and `ru.ts`, as every event type has |
| Projection tables | `board_*` (`board_threads`, `board_messages`, `board_requests`, `board_responder_slots`, `board_idempotency`, `board_read_marks`) | grants and RLS in migration 4's shape; `anon` and `authenticated` see nothing; writes only through the projector's per-concern `apply_comms_*` functions |
| Migration file | the next timestamp **whose suffix sorts above every applied migration** (today above `…080`) | `schema_version()` stays the migration count, never the suffix (CO-199) |
| MCP tools | the contract's `com.*` names | served in `surfaces.mcp.capabilities` only once implemented |

### 6. Restore keeps history and switches authority off

A restored board starts with history only (C7). Enrollments, grants, responder slots and mirror
authority are off until the owner re-enrols. A request whose effect had begun becomes
`outcome_unknown` and waits for reconciliation, as an ADR-0115 restored binding does.

## Consequences / affects

- `CONTEXT.md`: the terms **Board**, **Board request** and **Responder slot**.
- COM-02 builds §1, §4 and §5 (the journal events, the projector functions, the migration and the
  participant tools). COM-03 builds §3 and the responder tools. COM-04 builds the Claude/Codex
  adapters in `fabric-agent-adapter`. COM-06/07 build the operator's board screens through the UX
  chain (scenarios first). COM-08/09 build the mirrors.
- `docs/evidence/plans/2026-10-04-project-communications.md`: COM-01 closes with this record.
- Not decided here: the board screens, the mirrors' wording, and whether an admin reads agent
  content (operator D3 decides that for the enterprise release, not for the local board).

## Amendments

### 1. "Project board", not "Board" (2026-10-05, COM-02.1)

The app already calls its task board «Доска» (`launch.nav.board`). The glossary term is therefore
**Project board**, and user-facing text does not call it a board until its screens are designed
(COM-06, scenarios first). The feed sentences for `comms.*` events speak of messages between
projects. The table names (`board_*`) and the event names stay as §5 reserved them.


### 2. Amendment 2 — 2026-10-12: the lifecycle, the clock, the store as built, the pin (COM-02.3)

- **The lifecycle** is decided in [ADR-0149](0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md):
  who takes part (§1), who answers (§2–§4), how a restore treats the board (§6, which replaces §6 here: the texts now
  travel in the archive's `board.json`; authority still does not), and idempotency epochs and retention (§7).
- **The clock (§4).** "Database time (`now()` in the transition)" means `clock_timestamp()` at the check: `now()` is
  the transaction's start and goes stale behind a lock wait. Migration 86
  (`supabase/migrations/20261012000103_project_board_lifecycle.sql`) compares deadlines and epoch ages that way.
- **The store as built (§1).** "No second store holds message or request state" holds for request state, which is a
  projection of `comms.*` events. Threads, messages, bodies, idempotency receipts and request outcomes are **primary
  rows** written in the same transaction as the event that records them, which carries ids and the digest, never a
  body — the CEO conversation pattern, so that a body can be redacted (`CONTEXT.md`, **Project board**). Migration 86
  adds projections (`board_deliveries`, `board_epochs`' states) and operational rows (`board_epochs.keys`, the outbox
  and its cursors); §5's table list is extended, not renamed.
- **The pin (§2).** The vendored fixtures are at fabric-agent-contract `623bf613`
  (`apps/desktop/test/contract-consumer-fixtures.mjs`, `CURRENT_COMMIT`), not `d4c8831`: the comms files are byte-identical
  between the two. The next pin is the merge of contract DEC-0073 (merged in the contract at f8ae4e1; not yet pinned); until it lands, the tools whose
  argument shapes only DEC-0073 fixes answer `unsupported_capability` (`PINNED_COMMS_OPERATIONS`).
- **"ADR-0117 D3".** Migration 83's header, `commsRead.ts`, `types.ts`, SCN-143, the product model and the board's DB
  test cite "ADR-0117 D3". This record has no section D3: the citation names the operator's decision D3 of
  2026-10-05, carried in the Consequences above — whether an admin reads agent content is decided for the enterprise
  release, not for the local board. That decision is what leaves the local operator's read of the local estate's board
  open; SCN-143 (COM-06/07) is what sanctions and builds it.

### 3. Amendment 3 — 2026-10-13: the pin moves to contract DEC-0073 (COM-03)

- **The pin (§2).** The vendored fixtures are at fabric-agent-contract `edc88a6674c851bb328b08a269ca0ea5bd39b5f8`
  (`apps/desktop/test/contract-consumer-fixtures.mjs`, `CURRENT_COMMIT`), the registers commit after the merge of
  contract DEC-0073. It carries every tool's argument schema, the one receipt (`comms-receipt`), the directory
  (`comms-directory-args`, `comms-directory`), `comms-status`'s `idempotency` and the digest vectors
  (`fixtures/vectors/canonical.json`), which Fabric's `commsDigest` reproduces (`board-service.test.mjs`). The repin
  also brings `model-profile` and `registry-models`, which `service-well-known` now refers to.
- **What is served.** All seventeen tools: `PINNED_COMMS_OPERATIONS` is the whole of `COMMS_OPERATIONS` and stays as a
  tested safeguard — an operation removed from it answers `unsupported_capability` before the board is called.
- **What waits.** The contract moved on after this pin (`a046f57`: DEC-0077, a directory page lists each Project once
  and each capability once per Project, and the `comms-directory` positive fixture changed). Fabric's directory
  already answers that way (one row per Project, `distinct` capabilities); the repin to it is a later, separate step.

### 4. Amendment 4 — 2026-10-13: the operator writes, and the estate's owner may settle (wave 4; contract DEC-0079, DEC-0081)

- **The operator is no longer only a reader.** The operator's decision D3, carried in the Consequences above, left the
  local operator reading the local board. [ADR-0156](0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md)
  (proposed, not built) adds the estate's owner's writes: pausing and resuming a thread, a project's answering or one
  responder slot (contract DEC-0079's host hold, refused `held`), and listing or unlisting a project in the directory.
  They are Fabric's host settings, not board tools: no `com.*` tool sets, lifts or lists them.
- **§4's caller widens (contract DEC-0081).** §4 says that only `com.reconcile` leaves `outcome_unknown`. That stays
  true; who may call it changes. The slot's current holder settles it as before, and, while **no responder holds** the
  request's (project, capability) slot, so may the estate's owner — the person whose membership is `owner` at the
  revision the host holds (ADR-0156 §1, §7). The owner settles only by observation: `completed` or `failed_known`,
  `observed: true`, with a summary of what they observed (1–2000 characters; without it `observation_required`); there
  is no path to `cancelled`. While a responder holds the slot, the owner is refused `not_authorized` and the responder
  settles it. Every reader sees an owner settlement as `settledBy: "owner"`; a late responder's `com.complete` or
  `com.reconcile` on the settled request is refused (`invalid_transition`, or `fenced` / `revision_conflict`), never
  committed. Every `complete` and `reconcile` transition in the journal carries `settledBy` (`"responder"` or
  `"owner"`, contract `FAC-SEM-109`), the responder's included. No expiry, restore or compaction still erases
  `outcome_unknown`.
- **Not built.** Fabric serves none of this until it repins to fabric-agent-contract `a59d04b` or later and wave 4's
  nodes land (owner settlement is node W4-13). Until then the board's `com.reconcile` answers only the slot's holder, the
  operator has no endpoint that calls it, and Comms shows no settle action.
