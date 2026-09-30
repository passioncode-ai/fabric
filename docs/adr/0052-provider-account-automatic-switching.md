# ADR-0052 — Optional automatic account switching is in scope

- **Status:** operator requirement accepted on 2026-09-09; detailed policy proposed for review.
- **Source:** the operator's request that automatic switching be available, as in cswap, made while requesting detailed current-backlog tasks.
- **Supersedes:** the no-automatic-rotation scope clause of proposed [ADR-0051](0051-provider-accounts-and-conversation-continuity.md). Other identity, history, isolation and execution guarantees stand. The older record is retained unchanged.
- **ID:** agent-sync reservation `ADR-0052`, run `r-90bf1cfd8`.

## Decision

Automatic switching must be available as an opt-in mode with an explicit account pool,
provider/runtime/project scope and conversation enrollment. Enabling it authorizes later
eligible switches without asking for confirmation each time. Existing conversations do
not enroll silently when a default changes; new conversations can inherit a configured
policy at admission. A user may pause automation, remove an account from rotation or pin
a conversation. Disabling auto before stop cancels queued transitions; after stop, finish
only safe recovery, never start another automatic switch.

Model cswap's useful controls: usage threshold, best/consume-first strategies, selected
model windows, cooldown and hysteresis, disabled accounts, quarantined credentials,
bounded polling and dry-run. “Next available” is an explicit selector/manual strategy in
the studied revision; do not falsely label it a cswap auto strategy.

Automatic selection goes through the same verified switch coordinator as manual selection.
It preserves the Project, open Task and native conversation, creates a new Session/TaskRun,
retains the enclosing budget, and never replays effects. No compatible checkpoint/resume
receipt means automatic continuation is unavailable; a context handoff to a new conversation
requires its own explicit admission. No cross-provider fallback is implied.

## Boundaries

Start disabled, with a preview of eligible accounts and affected conversations. Only the
approved same-provider/runtime/data scope is eligible. Unknown identity, stale candidate
quota, unconfirmed native resume, unresolved effects and revoked authority hold the switch.
An expired token awaiting normal refresh is not enough to move work to another account.
A provider-confirmed exhausted window may trigger at the next certified boundary; cooldown
may not erase the global switch cap or refresh/dispatch ownership.

Full pool exhaustion pauses further dispatch and reports the next known reset; polling backs
off and resumes without treating a stale reset timestamp as refreshed quota. 429, 5xx,
network failure, invalid auth and provider quota exhaustion are distinct typed reasons.
Application shutdown stops local polling; restart reconciles persisted state before dispatch.
There is no implicit always-on daemon.

## Source and delivery

[cswap source findings and comparison](../evidence/plans/2026-09-09-provider-accounts-backlog.md#cswap),
[updated provider account contract](../architecture/provider-accounts.md#automatic-switching),
[current backlog M199](../evidence/backlog.md#work-m199),
[detailed automatic-switch task](../reports/system.html#task-M199-auto).

The requirement to offer auto mode is accepted. Default values and implementation claims
are not validated merely by this ADR. M199.auto owns policy and scheduling; M199.resume owns
safe execution; M199.acceptance proves both together on authorized provider test accounts.
