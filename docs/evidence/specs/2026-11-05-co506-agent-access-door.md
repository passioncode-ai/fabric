# CO-506: an agent's door to Agent access, and answering granted for the session's own project

Carry-over row CO-506 (due 2026-11-12). Planned 2026-11-05 from a read of `main` at `3eebde01`; the decisions below
are taken under the operator's rule that an open question is decided by the recorded decisions, then the project's
goal, then the safest reversible option, and each says why. A new ADR records them in the change that builds them.

## 1. What the code does today

- **The precedent (ADR-0184).** `fabric_task_close` (`apps/desktop/src/main/agentSurface.ts`, region
  `relayed-close-tool`) takes the operator's relayed decision as `decision` or `_meta.decision`, checks it with
  `relayedClose.ts#checkRelayedClose` against `hubAuthority.ts#decisionSchema` (by `operator`, via
  `relayed-instruction`, `action`, `target`, `instruction`, `at`, `source`), refuses words dated in the future beyond
  `CLOCK_SKEW_MS`, and writes the event with actor `{kind:'agent', id: sessionId}` and the words in the payload. It is
  on the session surface only; the hub's servers carry no `fabric_*` tool (`hubTools.ts#HUB_TOOLS`).
- **The operator's buttons.** `IPC.hubDecide`, `IPC.hubRevokeGrant`, `IPC.hubRevokeAgent` (`index.ts`) call
  `AccessService.decide`, `revokeGrant`, `revokeBinding` with `{kind:'person'}`; the service writes
  `access.decided@1`, `access.grant.revoked@1`, `access.binding.revoked@1`. These `access.*` events are
  `external_policy` in `desktopIngress.ts#EXTERNAL_INGRESS_OWNERS`, so relayed words must be scrubbed by the service.
- **A `board.respond` ask** carries `capabilities: ['board.respond']` and 1 to 8 resources
  `board:<project uuid>/<capability>`, one project (`shared/access.ts#normaliseRespondAsk`). Since CO-494 it is in
  `IMMEDIATE_LOCAL_LANES` (`accessService.ts`): allowed at once through the door (no identity) or a binding.
- **The asker's own project cannot be read from a hub ask.** A door ask has no identity, and a binding is shared: one
  per runner on the machine, holding `session.enroll` grants for every project that runner enrolled in. Only a
  session's bearer proves its project (`AgentScope.projectId`), and `com.enroll` already passes it
  (`boardService.ts#responderCall`).
- **What the grant opens.** A `board.respond` grant for another project lets a board session of that project claim,
  read and complete its requests and replace a live responder (`com.responder_replace`). So today any process that can
  read the door token can become another project's responder.
- **Machine trust.** `machineTrust` (ADR-0176 §3, `appSettings.ts`) is absent on the operator's Mac (read 2026-11-05).

## 2. Decisions

1. **The session's own project is granted at `com.enroll`, with no question.** A session (not a board session) whose
   `com.enroll` names a capability it has no live `board.respond` grant for, in its own project (from its bearer, never
   from an argument), is granted at once and recorded like CO-494's grants (`access.requested@1`, then
   `access.decided@1` by the agent, then the revocable grant). This is the operator's word of 2026-11-05 as CO-506's row
   reads it (give such grants automatically, never ask).
2. **A `board.respond` asked through the hub waits for the operator.** Through the door or a binding the ask no longer
   proves whose it is, so another project's slot is decided in Agent access, by the button or by an agent relaying
   the operator's words (decision 4). Why: it is the coordinator's proposal on the board, it keeps decision 1's
   promise, and it removes the direct route from the door token to another project's slot (the two-step route through
   `session.enroll` remains, bounded by the door token's file permissions). Reversible by putting the lane back.
3. **Capabilities are not narrowed.** No project declares capabilities apart from its slots and grants; the board's
   directory showed all 78 projects with empty lists (2026-11-03 and 2026-11-05), so a «declared capabilities» rule
   would refuse everything. The capability stays what the session names, within `CAPABILITY_PATTERN`.
4. **An agent decides Agent access on the operator's relayed words.** Three session-surface tools beside
   `fabric_task_close`: `fabric_access_list` (pending requests, live agents and grants, standing denials; never a
   verifier), `fabric_access_decide` (`requestId`, `verdict` allow or deny) and `fabric_access_revoke` (`grantId` or
   `credentialId`). The decision's `action` is `access.allow`, `access.deny` or `access.revoke` (the verdict is bound
   into the action, so words that said deny cannot allow), `target` names the id, `at` is not in the future beyond
   `CLOCK_SKEW_MS` and not older than 24 hours. The actor is the session (Fabric cannot prove the person spoke); the
   words, scrubbed, are in the payload; History shows the act. Why: the operator's dashboard parity rule (2026-10-24)
   and ADR-0184's shape.
5. **What an agent may not do there.** Allow a product request (a product grant reaches the cloud and «Allow and
   connect» is the product's consent with a vault secret: a human step, `human-step-required`); allow a capability
   outside Fabric's own lanes (`board.respond`, `session.enroll`, `project.resolve`); allow a request its own binding
   asked (`self-decision`). Deny and revoke only restrict, so they are allowed for any request.
6. **Machine trust.** Decisions 1 and 4 act unless `machineTrust` is `organization`; an absent setting is the
   operator's own machine, as ADR-0186 is today. Why: gating on `mine` would take the operator's own automatic
   grants away on this Mac, where the setting was never set; an organization machine is refused, as ADR-0186's
   amendment DO-8 asked.
7. **Launched and on-demand sessions** (no binding of their own) are granted on the newest live binding of their runner
   whose credential was collected; with none, `com.enroll` stays `not_authorized` (SCN-145's known limit). A database
   change that lets a launched session hold its own project's slot without a grant is left for a later row.
8. **No hub-side decide tool** for registered services: it would widen who speaks for the operator from a session the
   operator works in to any registered service.
9. CO-507's refusal text in the board's SQL stays with CO-507.

## 3. The change

- `apps/desktop/src/main/relayedAccess.ts` (new, pure): `checkRelayedAccess(decision, {action, targetId}, now)` and
  `admitAccessAct(...)`, beside `relayedClose.ts`.
- `accessService.ts`: an optional relayed record on `decide`, `revokeGrant`, `revokeBinding` (payload `decision`,
  scrubbed with the rule `task.closed@1` uses); `BOARD_RESPOND` out of `IMMEDIATE_LOCAL_LANES`;
  `grantOwnProjectRespond(proof)` on the agent lane; a `machineTrust` reader.
- `agentSurface.ts`: the three tools (region `relayed-access-tools`) and `com.enroll` on the session server wrapped to
  grant the own project first; `AgentSurfaceDeps.access`.
- `index.ts`: the wiring, and `revokeAgentAs` shared by the button and the tool.
- Texts: `boardTools.ts` (`com.enroll`), `protocolObligations.ts` (`board.read-at-start`), `hubTools.ts`
  (`fabric.access.request`), `shared/surfaceTools.ts`, `harness.tool.*` and act keys in en and ru.
- Tests: `test/relayed-access.test.mjs` (new), `test/agent-surface.test.mjs`, `test/session-enroll-request.test.mjs`
  (the two CO-494 tests rewritten; a planted `BOARD_RESPOND` in the lanes must fail the pending test),
  `test/hub-access-service.test.mjs`, `test/board-surface.test.mjs`, `test/hub-access-db.test.mjs`,
  `test/ingress-owners.test.mjs`, `shared/protocolObligations.test.ts`, `test/harness-read.test.mjs`.
- Docs in the same change: a new ADR (extends ADR-0184, amends ADR-0186 decision 1), `AGENTS.md`'s hub paragraph,
  `CHANGELOG.md`, SCN-132, SCN-133 and SCN-145, the on-demand spec §2, CO-506's row.

## 4. Left for later rows

«Очистить» a standing denial, «Отключить» and «Впустить» have no agent door yet; a launched session's own slot without
a grant (decision 7).
