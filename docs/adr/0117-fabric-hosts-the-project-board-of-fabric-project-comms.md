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

