# ADR-0186: Answering a project's requests is allowed at once on the operator's own machine

**Status:** accepted · 2026-11-04 · carry-over row CO-494 · records the operator's word relayed by fabric-workspace from
traffic-growth-agent's session `1d031d27` (about 09:50 UTC): «дай гранты всеем и передай фабрику чтобы давай и не лочил
по дороге, всем апрув» · amends [ADR-0160](0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)
(its immediate local lanes) and [ADR-0149](0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md)
§2 (responding is a grant the operator decides) · part of wave 1 of
[the on-demand sessions spec](../evidence/specs/2026-11-04-on-demand-sessions.md) §2.

## Context

A project answers board requests only through a live `board.respond` grant (ADR-0149 §2), and the grant was made only
when the operator pressed Allow on an agent's request: the decision is reachable from Fabric's window alone
(`apps/desktop/src/main/index.ts`, the `IPC.hubDecide` handler). On 2026-11-03 fabric-workspace measured no capability on
any of the 78 projects ([the board delivery report](../reports/2026-11-03-board-delivery-and-delegation/README.md) §1),
so every request waited for a person. ADR-0160 already made two local lanes immediate on the operator's own machine,
enrollment and folder attribution, recorded as the asking agent's own revocable act, and kept board grants out of them.
On 2026-11-04 the operator asked for grants to every project with no stop on the way.

## Decision

1. `board.respond` asked of Fabric itself joins the immediate local lanes (`apps/desktop/src/main/accessService.ts`,
   `IMMEDIATE_LOCAL_LANES`): on the operator's own machine the request is allowed at once, with no prompt, and recorded
   as the asking agent's own act: `access.requested@1`, `access.decided@1` with the agent as actor, and the grant.
2. Every check before the prompt stays: the asker must be a coding agent of the catalogue or a registered service, not
   disconnected by the person; the ask names one existing project and at most eight capabilities; a standing denial
   still holds.
3. The grant stays revocable as every other, in Settings → Agent access today and on the permissions screen of the
   spec's §6.1 when it lands; a revoked grant releases the responder slots it admitted (COM03-10).
4. Machines that are not the operator's own (organization machines) are not changed by this record: their lane is
   decided with the organization slice (CO-494's second half, P-27).

## Consequences

- An agent that answers a project's requests takes the slot on its first `com.enroll` after asking, without a person.
  `com.enroll`'s refusal now says to ask, not to wait for a setting.
- The person no longer sees a prompt for these grants; the journal and the grants list show each one with its agent and
  time, and each can be revoked.
- The on-demand session of the spec takes the slot the same way.

Tests: `apps/desktop/test/session-enroll-request.test.mjs`, «CO-494: board.respond is allowed at once on the operator's
own machine, recorded as the agent's own revocable act» and «board.respond: a coding agent or a registered service asks
once, with the project named in the snapshot, and is allowed at once (CO-494)»; a planted defect (board.respond removed
from the lanes) fails both.
