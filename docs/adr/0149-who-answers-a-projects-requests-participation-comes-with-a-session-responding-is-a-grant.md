# ADR-0149 — Who answers a Project's requests: board participation comes with a project session, responding is a grant of its own, and a restored board keeps its texts but not its authority

**Status:** accepted · 2026-10-12 · COM-02.3 and COM-03 of
[the comms plan](../evidence/plans/2026-10-04-project-communications.md) · amends
[ADR-0117](0117-fabric-hosts-the-project-board-of-fabric-project-comms.md) §3, §4 (the clock) and §6, and
[ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md) (the consent words) ·
resolves CO-212 · relates to contract DEC-0073 of fabric-agent-contract (pending merge), which fixes the argument
shapes this record's tools take.

## Context

ADR-0117 §3 asks for a **board enrollment** of its own kind before an agent registered on this machine takes part
in the project board. ADR-0134 §4 and the 0.4.0 canvas give an enrolled session the same catalogue a launched one
has, `com.*` included, and the code hands every session the board's tools as a `trusted` principal
(`apps/desktop/src/main/agentSurface.ts`, the `registerBoardTools` call). The contract defines "an enrollment" as a
trusted principal (`project-comms.md`, "provenance"). A service agent (`fabric-service/0.1`) is a server, not a
session, and has no surface of its own to take part through.

Three gaps were measured on `main` before this record (the spec of 2026-10-12, §0):

- **Estate seq reached agents.** `board_submit` and `board_read_ack` returned the journal seq in their receipts,
  which the contract forbids ("a reader is never shown an estate-wide sequence number", C3).
- **The idempotency epoch was the constant 1** and never rotated (audit A7-019), so a Project's receipts grew
  without bound and `capacity_exceeded` was a dead end.
- **A restore lost the board's texts (CO-212).** Threads, messages, bodies and receipts are primary rows written
  beside their journal events (migration 79), and no journal event rebuilds them; the archive inventory still
  labelled them "rebuilt from the journal".

## Decision

### 1. Participation comes with a project session

`com.submit`, `com.list`, `com.get`, `com.read_ack`, `com.reply`, `com.cancel` and `com.status` come with a
project session, whichever way it came in: launched by Fabric; enrolled through the hub per ADR-0134, whose grant
**is** the board enrollment for that one Project; or handed off per ADR-0140 — or with a **board session** (§4).
The principal is `{kind: 'agent', id: <session id>, label}`. Provenance is `trusted` for all of these, because the
board verified the endpoint; `asserted` is reserved for mirror ingress (COM-09). An ADR-0115 product binding
still grants no participation, and participation grants no product call.

### 2. Responding is a standing grant of its own

Answering a Project's requests — enrolling into its responder slot and moving its requests — is a grant with
callee `fabric`, capability `board.respond` and resource `board:<project>/<capability>`. It is asked through
`fabric.access.request`, shown by ADR-0115's presenter, revocable in Agents & access, and journalled by the access
events. It is never derived from a process id, a model name, an origin, a launcher label or a service descriptor
(contract C9).

### 3. Which grant a session uses

An enrolled session or a board session uses its own binding's grant. A launched or handed-off session uses a live
grant held by a binding of its runner. The grant is rechecked inside every transition, in the statement that
commits it. Known limit: a launched session can respond only once its runner holds a grant on a binding, which
happens when `fabric-mcp` is registered.

### 4. Service agents join with a board session

A service agent joins with `fabric.board.join {projectId}` on its binding and receives a board session that
carries only the `com.*` tools. A service that only serves and runs no client loop cannot respond yet: Fabric
driving a service's capability as the responder under an internal principal is decided later, together with the
workflow `call` step of canvas C7, and is not built under this record.

### 5. Leases, fences and the clock

ADR-0117 §4 stands: a 60-second lease, the fence rechecked in the committing statement, no transaction held open
while an agent works. **The clock is clarified:** "database time" means `clock_timestamp()` at the check — not
`now()`, which is the transaction's start and goes stale behind a lock wait. Board functions wait at most
`lock_timeout = '3s'`; a command takes its own lock first (an advisory key lock, or the row it changes,
`FOR UPDATE`) and only then `append_event`'s estate lock. Renewals are operational and not journalled;
transitions and enrollments are journalled. The slot generation is projected and survives a restore; holders and
leases never travel.

### 6. A restore keeps the texts and switches authority off (amends ADR-0117 §6)

An estate archive carries `board.json` beside its journal: every thread, message, body and request outcome at or
below the archive's watermark, bound to that archive's manifest digest and to its own SHA-256. A restore checks
the file before anything is written, then puts each row back only where it matches the restored journal event at
its seq, field for field; a message the journal names and the file lacks is counted as missing, never invented. The
board restore appends nothing to the journal and runs after an owner's private-history import: the restored journal
stays exactly the archive's prefix, which that import requires (ADR-0079, migration 66). A
body redacted before the export is absent from the file; a redaction made after the export cannot reach a file
already written, and the archive inventory says so beside Backup. Idempotency receipts, responder slots, attempts,
the outbox and its cursors never travel.

On restore, claimed requests return to queued, in-progress ones become `outcome_unknown`, accepted ones are held,
every open epoch rotates and every enrollment is released (the responders' restore settle, COM-03).

### 7. Idempotency epochs and retention

Each Project's idempotency epochs move open → closed → retired, one open at a time. An epoch holds 100,000 keys;
it rotates at 90 % of that or after 30 days, and a full epoch refuses with `capacity_exceeded` (retryable) in the
same call that rotates it. A closed epoch still answers a repeated key with its receipt and refuses a new one
(`idempotency_window_expired`). Thirty days after it closed its receipts are compacted and it is retired for ever.
Outbox entries go after 7 days once every consumer has read past them. Bodies are kept until they are redacted,
never deleted by age. Each pass that changes something leaves one `comms.retention_applied@1` receipt; an idle
pass writes nothing.

## Consequences

- **COM-02.3** (migration 86, `supabase/migrations/20261012000103_project_board_lifecycle.sql`) builds §5's clock
  and lock order for the participant commands, §6's history export and restore, and §7: `board_requests` keyed by
  (estate, message) (A7-024); the active-Project check on every read (A7-018); receipts without seq (C3);
  `board_epochs` and one idempotency gate for every mutation (A7-019); `board_reply`, `board_cancel` and deadline
  expiry; `board_status` in place of `board_unread`; the delivery-eligibility record `board_deliveries`; a
  transactional outbox with compare-and-swap consumer cursors; `board_tick` on the app's 60-second cycle; the
  private-archive schema list through 86 (A7-045). The service answers a lost write as "may have been stored",
  maps SQLSTATE class 22 to `invalid_arguments` (A7-035, the A7-017 residual) and registers every board tool,
  answering `unsupported_capability` for one the vendored contract pin does not carry yet (A7-039).
- **COM-03** (migration 87, the responders) builds §2–§4 and §6's restore settle: the `board.respond` ask and its
  words, the responder slots, enrollments and attempts, the fence, the responder transitions, `fabric.board.join`,
  release on session end and on revocation, and `com.status` responders.
- ADR-0117 Amendment 2 and ADR-0134 Amendment 5 record the pointers; `CONTEXT.md` gains **Idempotency epoch** and
  **Board outbox** and says how an archive carries the board's history; **Responder grant**, **Board session** and
  **Attempt** arrive with COM-03.
- Contract DEC-0073 (pending merge) fixes the argument shapes; until Fabric repins to it, `com.reply`,
  `com.cancel`, `com.directory` and the responder tools answer `unsupported_capability` through
  `PINNED_COMMS_OPERATIONS` (`apps/desktop/src/main/boardService.ts`).
- The adapter (FAA-12) can start: Switchboard (SB-47) reads a generation from the `com.enroll` receipt and from
  `com.status`, because Fabric assigns no generation at launch.
- Dashboards' viewer `com.status` (FD-12) still needs the contract's viewer principal (C9). Only a session's
  `com.status` carries `idempotency.epoch`; a viewer submits nothing and gets none.
