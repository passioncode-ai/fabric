# ADR-0190: An agent decides Agent access on the operator's relayed words; answering is granted for a session's own project

**Status:** accepted · 2026-11-05 · carry-over row CO-506 · records the operator's word relayed by fabric-workspace on
2026-11-05 (session `74a9440a`; paraphrased, ADR-0096 §5: give such answering grants automatically and stop asking) and
the coordinator's proposal on the board (refuse another project) · extends
[ADR-0184](0184-an-agent-closes-a-task-on-the-operators-relayed-decision.md) (the operator's relayed decision as an
agent's door) to Agent access · narrows decision 1 of
[ADR-0186](0186-answering-a-projects-requests-is-allowed-at-once-on-the-operators-machine.md) · planned in
[the CO-506 spec](../evidence/specs/2026-11-05-co506-agent-access-door.md).

## Context

Two things were missing on 2026-11-05. The operator's rule of dashboard parity (2026-10-24) makes every button an agent
act too, yet Agent access's «Разрешить», «Отклонить» and «Отозвать» had no agent door, so an approval the operator gave in
another agent's chat waited for his click. And ADR-0186 allowed `board.respond` at once for any project, through the
hub's door, which proves no identity: any process that could read the door token could take another project's
responder slot (a board session can claim, read and complete that project's requests and replace its live responder).
Only a session's bearer proves its project; the hub's ask cannot.

## Decision

1. **A session's own project is granted at its `com.enroll`, with no question.** Before a session's `com.enroll`, Fabric
   grants `board.respond` for that capability on the session's own project, taken from its bearer, never from an
   argument (`AccessService#grantOwnProjectRespond`, the session server's `com.enroll` in `agentSurface.ts`). It goes on
   the session's own credential, or for a launched session on its runner's newest collected credential; with neither,
   nothing is granted and `com.enroll` answers `not_authorized` as before. It is recorded like every immediate lane: the
   request, the agent's own decision, the revocable grant.
2. **`board.respond` asked through the hub waits for the operator.** It leaves the immediate lanes; another project's slot
   is decided in Agent access, by the button or by decision 3. This removes the direct route from the door to another
   project's slot; the two-step route stays (an immediate `session.enroll` through the door, then a session of that
   project, whose `com.enroll` is granted), and the boundary there is the door token's file permissions (the review of
   this change, F3).
3. **An agent decides Agent access on the operator's relayed words.** Three session-surface tools beside
   `fabric_task_close`: `fabric_access_list`, `fabric_access_decide` (allow or deny one request) and
   `fabric_access_revoke` (one grant, or everything an agent holds). The decision has ADR-0184's shape; its action is
   `access.allow`, `access.deny` or `access.revoke`, so words that said deny cannot allow; its target names the id; it is
   refused when dated in the future beyond the clock skew or older than a day (`relayedAccess.ts#checkRelayedAccess`).
   The act is recorded as the session's, with the operator's words scrubbed under the event's own `relayed` key
   (`AccessService#decide`, `#revokeGrant`, `#revokeBinding`); History shows an agent revoked as for the button.
4. **What an agent may never do there**, whatever the words (`relayedAccess.ts#admitAccessAct`): allow a product request
   (its consent and its key are the person's step), allow a capability outside Fabric's own lanes, allow a request its
   own credential asked, or act at all on a machine marked as an organization's. Deny and revoke only restrict. The
   self-decision check compares credentials, not agents: an ask through the door has none, and a launched session holds
   none of its own, so either can be allowed by the same agent's session on words it wrote; the journal is what shows
   it (ADR-0184 §6; the review, F2).
5. **Capabilities are not narrowed.** No project declares capabilities apart from its slots and grants (the board's
   directory showed all 78 projects with empty lists on 2026-11-03 and 2026-11-05), so a «declared capabilities» rule
   would refuse everything.
6. **Machine trust.** Decisions 1 and 3 act unless `machineTrust` is `organization` (there no answering is granted at
   once and no agent decides Agent access; `session.enroll` and `project.resolve` stay immediate as before); an absent setting is the operator's
   own machine, as ADR-0186 was (measured: the operator's Mac has none set). This settles ADR-0186's amendment DO-8.

## Consequences

- An agent that answered through a hub ask under ADR-0186 now enrolls with `com.enroll` and is granted there; the rule
  every session gets (`board.read-at-start`) and the `com.enroll` description say so.
- Fabric cannot prove that the operator spoke the relayed words (ADR-0184 §6); the limits of decision 4, the journal
  with the words and the session, and History are what bound a forgery.
- A launched session's grant goes on its runner's newest collected credential, which another session of the same runner
  may hold; that credential can then join this project's board (decision 7; the review, F5).
- Revoking a session's own-project grant does not stick: its next `com.enroll` grants it again. A standing denial or
  «Отключить» keeps it off (the review, F6).
- The access tools read and act on every project's Agent access, across the board's business wall (CO-368): accepted
  for the operator's own machine; the wall for them is carried in CO-506's row (the review, F7).
- Not built here: «Очистить» a standing denial, «Отключить» and «Впустить» as agent doors; a launched session's own slot
  without any credential of its runner.
