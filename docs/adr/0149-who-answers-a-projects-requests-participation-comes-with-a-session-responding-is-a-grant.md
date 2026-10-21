# ADR-0149 — Who answers a Project's requests: board participation comes with a project session, responding is a grant of its own, and a restored board keeps its texts but not its authority

**Status:** accepted · 2026-10-12 · COM-02.3 and COM-03 of
[the comms plan](../evidence/plans/2026-10-04-project-communications.md) · amends
[ADR-0117](0117-fabric-hosts-the-project-board-of-fabric-project-comms.md) §3, §4 (the clock) and §6, and
[ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md) (the consent words) ·
resolves CO-212 · relates to contract DEC-0073 of fabric-agent-contract (merged at f8ae4e1; not yet pinned), which fixes the argument
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
  answering `unsupported_capability` for one the vendored contract pin does not carry yet (A7-039). What contract
  DEC-0073 fixes for the tools already served holds before the repin: a stored receipt of migration 81's shape is
  replayed in the new one (CT-41); a second `com.read_ack` of a message answers `repeated: true` with the first
  mark's `at`, and `com.read_ack` takes no idempotency key; `com.status` naming another Project answers as an
  unknown one does (`not_authorized`), and a viewer principal is never told an epoch; a `com.submit` of kind
  `reply` outside `replyTo`'s own thread is `invalid_arguments`.
- **COM-03** (migration 87, the responders) builds §2–§4 and §6's restore settle: the `board.respond` ask and its
  words, the responder slots, enrollments and attempts, the fence, the responder transitions, `fabric.board.join`,
  release on session end and on revocation, and `com.status` responders.
- ADR-0117 Amendment 2 and ADR-0134 Amendment 5 record the pointers; `CONTEXT.md` gains **Idempotency epoch** and
  **Board outbox** and says how an archive carries the board's history; **Responder grant**, **Board session** and
  **Attempt** arrive with COM-03.
- Contract DEC-0073 (merged in the contract at f8ae4e1; not yet pinned) fixes the argument shapes; until Fabric repins to it, `com.reply`,
  `com.cancel`, `com.directory` and the responder tools answer `unsupported_capability` through
  `PINNED_COMMS_OPERATIONS` (`apps/desktop/src/main/boardService.ts`).
- The adapter (FAA-12) can start: Switchboard (SB-47) reads a generation from the `com.enroll` receipt and from
  `com.status`, because Fabric assigns no generation at launch.
- Dashboards' viewer `com.status` (FD-12) still needs the contract's viewer principal (C9). Only a session's
  `com.status` carries `idempotency.epoch`; a viewer submits nothing and gets none.

## Amendments

### Amendment 1 — 2026-10-13: COM-03 as built (migration 87)

Migration 87 (`supabase/migrations/20261012000104_project_board_responders.sql`) builds §2–§4 and §6's restore settle,
with contract DEC-0073 pinned (fabric-agent-contract `edc88a6`). Where it had to choose, it chose this:

1. **The restore settle appends nothing.** A verified restore checks, before it commits, that the restored journal is
   exactly the archive's prefix (`restore_estate_verified`, migration 66), and an owner's later private-history import
   checks the event count and the watermark again. A settle written as journal events after the boundary would refuse
   every such restore. So §6's settle is a **projection rule**, migration 77's for the hub: at or below the target's
   restore watermark a `claimed` request projects as `queued`, an `in_progress` one as `outcome_unknown` with effect
   `unknown`, an accepted one is held, an enrollment projects released (cause `restore`) and holds no slot, an attempt
   projects ended, and an epoch the source opened projects closed; a restored Project's first lazily opened epoch is 2
   or above, because the source's epoch 1 left no event. The slot generation still projects and only grows. A rebuild
   replays the same rule. `restore_estate_events` is unchanged.
2. **A release is not an operation** (DEC-0073 §5). A session's end and a revoked grant append
   `comms.responder_released@1` and end the enrollment's live attempts; no request moves. A fresh `com.enroll` on a slot
   a release left empty still turns every `in_progress` request of an older generation into `outcome_unknown`
   (op `lost_result`, cause `replaced`); a released `claimed` request stays claimed and the next `com.claim` takes it as
   a lapsed claim; accepted work is held. A lapsed holder replaced, or `com.responder_replace`, also returns `claimed`
   requests to `queued` (op `replace`).
3. **A transferred attempt is read back with `com.claim`.** `com.responder_replace` answers `slot` only, and DEC-0073
   gives a transfer's new attempts no other way to reach the new holder. `com.claim` naming an accepted request whose
   live attempt belongs to the caller's enrollment answers that request and attempt, moves nothing and stores nothing.
   This is Fabric's reading; the contract owner is asked to decide it (row text in the COM-03 handoff).
4. **The directory.** A Project lists the capabilities an operator granted `board.respond` on (live grants); its
   responder state is `com.status`'s. Readers are Project sessions and board sessions the board verified; a viewer or
   an asserted principal is refused before the door. The cursor binds the reader, its grant (how it came in and its
   binding), the filter and — through the estate id a restore replaces — the restore epoch. Unlisting is
   `board_set_listing`, an operator-only SQL door that journals `comms.directory_listing_set@1`, so it survives a
   restore; no tool reaches it. Its Settings control is a declared stub until **COM-06 operator controls**, which
   removes the stub by calling that door.
5. **`com.status`'s epoch.** DEC-0073 says a session should be told `idempotency.epoch` once its kit is pinned at or
   after DEC-0073; no per-kit signal exists. Fabric tells every Project and board session and never a viewer. Measured
   on fabric-agent-adapter `fe45cc7`: the session hooks read `com.status` through `board_unread`
   (`skills/working-with-fabric/scripts/fabric_session.py`), which reads `board.state` and `unread` and ignores any
   other member, so the added member breaks no installed kit.
6. **Messages a responder writes.** A fenced reply, a progress note, an effect summary and a transfer checkpoint are
   reply messages on the request's thread whose journal payload carries the fence (generation, attempt, enrollment);
   their digest is the call's. A progress note's at-most-once record is `board_progress_notes`, a receipt that never
   travels.
7. **Consent words** for `board.respond` are recorded in ADR-0134 Amendment 7; the pin in ADR-0117 Amendment 3.


### Amendment 2 — 2026-10-13: the wave-2 fix round — a board session is respond-only; DEC-0078 replaces the read-back

Three blind readings of COM-03 (unit, seam and product tiers over `e09ad8fb..3d7e7752`) found what follows. Each
decision below is recorded here; each fix carries its test, named in the COM-03 row of
[the comms plan](../evidence/plans/2026-10-04-project-communications.md).

1. **A board session is respond-only** (amends §1 and §4; from [ADR-0117](0117-fabric-hosts-the-project-board-of-fabric-project-comms.md)
   §3, where a board enrollment is a respond-only participation). The `board.respond` consent promises that the agent
   may take and answer the requests other projects send to the project; the board session `fabric.board.join` mints
   (surface `board`) is given exactly that: `com.status`; `com.list` and `com.get` (the threads its Project takes part
   in, to read the requests); `com.reply` in the responder's fenced form only; and `com.enroll`, `com.claim`,
   `com.renew`, `com.accept`, `com.progress`, `com.effect_begin`, `com.complete`, `com.reconcile`,
   `com.responder_replace` — thirteen tools (`BOARD_SESSION_OPERATIONS`, `apps/desktop/src/main/boardService.ts`). It is
   NOT given `com.submit` (it never writes as the Project), `com.cancel`, `com.read_ack` (read marks are shared per
   Project: a service must not clear the unread its coding agents rely on) or `com.directory`. The tools outside the
   set are not registered, and the service refuses them for a board caller before the door as well. Amendment 1 §4's
   directory readers are therefore Project sessions only, which also matches the contract's managed-or-enrolled reader
   rule. A project session's participation is unchanged (all seventeen).
2. **A board session is told its idempotency epoch.** Amendment 1 §5 said Fabric tells every Project and board
   session; `com.status` told only surface `session`. Every surface but a viewer is now told it.
3. **A board session's life.** Its client leaving ends it like an enrolled session's (its slots are released,
   `comms.responder_released@1`, and it is no longer listed as held). A grant that EXPIRES fires no revocation, so the
   session carries its grants' earliest expiry and ends at its first call past it, told why. A join hands out an
   unspent board session of the same binding, Project and grants instead of minting another; a binding holds at most
   four board sessions, counted apart from its coding agent's enrollments (neither evicts the other), and an evicted one
   is told what to do in a board session's own tools (`fabric.board.join`, `com.enroll`); the grants are read again
   after the mint (ADR-0134's read-then-mint).
4. **A launched session of a created agent answers as its runner** (clarifies §3): the holder's `agent` is the
   runner's catalogue id, which `board_grant_for` compares with the binding's agent, never the created agent's id.
5. **The consent words** (amends the words [ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)
   Amendment 7 recorded): the detail line keeps the contract's caveat — "This grant itself lets it spend, publish or
   delete nothing; it still has its own tools, and a request is never an approval." (Russian: «Само это разрешение не
   даёт ему ни тратить деньги, ни публиковать, ни удалять; свои инструменты у него остаются, а запрос никогда не
   одобрение.») — and in Russian the project requests are sent TO takes its own dative form («присылают проекту
   «{name}»» / «этому проекту»), not the enrollment's locative.
6. **Contract DEC-0078 replaces Amendment 1 §3.** `com.responder_replace`'s receipt carries `transferred`: 1–64 items
   `{request, revision, attempt}` (attempt = `{id, generation, digest, leaseExpiresAt}`), each transferred request once,
   and only `com.responder_replace` answers it. The contract defines no `com.claim` read-back, and `com.claim` never
   moves or reads back an accepted request: Amendment 1 §3 is withdrawn. Built by migration 88 with the repin to
   fabric-agent-contract `f00a768` (which includes DEC-0076 and DEC-0077); until that migration lands — it lands only
   with its database tier, CO-287 — main serves Amendment 1 §3 as before.
7. **The SQL half of the round**, also migration 88 (CO-287): `com.status` counts as unread only deliveries whose
   message the board holds (a restore without board history no longer leaves unread that can never be read); the
   epoch gate refuses `com.renew` and `com.progress` under a closed epoch; enroll and replace take the request rows they
   will move before the journal's estate lock, and a release takes every slot lock in a stable order before its first
   append (ADR-0149 §5's order); a fenced call on a request that became `outcome_unknown` from the slot's current
   holder answers `reconcile_required`, not `fenced`; a replay of another session's key needs a live grant when the
   caller holds no enrollment; and `com.enroll`'s refusal names the operator's Settings → Agent access.
8. **Comms names its source Comms** («Переписка»), never "the board" / «доска» (SCN-143's preamble, corrected).


### Amendment 3 — 2026-10-13: the listing control and pauses over responders (wave 4; designed, not built)

1. **The listing control is designed** (amends Amendment 1 §4). The Settings control Amendment 1 §4 calls a declared
   stub does not exist in the app: there is nothing to remove. Wave 4 builds the real control, the project directory
   (SCR-83, SCN-149, FLW-92), and `board_set_listing` gains the estate owner's check and becomes target-state — a
   repeat records nothing ([ADR-0156](0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md)
   §5–§6). Before a change the owner sees exactly the entry other projects read: the name and each capability with its
   responder state. CO-286 closes when SCR-83 is built.
2. **A pause sits over responders** (contract DEC-0079; ADR-0156 §2–§3). The owner may pause one (project, capability)
   slot or a whole project's answering. Under it, `com.enroll`, `com.responder_replace`, `com.claim`, `com.accept` and
   `com.effect_begin` on paused work are refused `held` (retryable; `not_authorized` for a kit pinned before DEC-0079);
   `com.complete`, `com.reconcile`, `com.progress`, `com.renew` and the fenced `com.reply` never are, so the slot's
   current holder always settles what it started. A pause is checked at commit like a lease and bumps no generation, attempt or
   revision. If the holder's session ends under a slot or project pause, the next enroll waits for the resume, and its
   accepted work stays held (contract C4). `com.status` answers `responders[].held`, and the directory `held` per capability,
   only to readers pinned at or after DEC-0079.
3. **A pause is not a revocation** (§2). The `board.respond` grant stands under a pause; stopping an agent for good is
   revoking that grant in Agents & access, which releases its slots as §2 already says. Comms' pause sheet links there.
4. **The owner may settle what no responder can** (contract DEC-0081; ADR-0117 Amendment 4): ADR-0117 §4's "settled only by an
   observed result" holds, and with no responder holding the slot the estate's owner may give that observed result.
5. **A restore keeps pauses** as §6 keeps the directory's listings: a pause takes authority away and grants none.

**2026-10-21: a request is answered by a reply (0.3.9, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#board)).** No agent had ever asked for a
Responder grant, so every request stayed `queued` (6 of 6 in three days). A non-request message from the target
Project naming the request moves it from `queued` to `answered` (Fabric's own state, outside the pinned contract,
journalled; a request a responder already holds is not changed). A request without a deadline gets one 7 days out; a
request to a capability no Project serves is accepted with `noResponder` in its receipt, because a reply can still
answer it and a grant may come later. `com.list` takes `unread` and `since` and says of each message whether it is `read`; its cursor
key lives in the database per estate, so cursors survive a restart; `com.read_ack` marks up to 100 messages, or a
thread up to a message, in one call and one journal event. The reading filters and the bulk mark are optional: a list or a mark that uses none of them gets the
contract's bytes. `noResponder` in a submit receipt and the `answered` state reach every caller, as additions a strict
client of the pinned schemas must tolerate. Proposing them to fabric-agent-contract is CO-371.
