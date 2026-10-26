# 0.3.13, wave 2: the sweep of abandoned work (CO-427) and «told one is told all» (CO-426)

Status: spec, 2026-10-26. Plan row P-26, [plan](../plans/2026-10-26-release-0313-plan.md). The operator asked for both
in the nearest update (2026-10-26, in the audit session): «Надо раз в три минуты проверять все брошенные задачи и
будить агентов, направлять … Раз в три минуты обязательный чек для всех агентов, чтобы у нас никогда задачи никакие
не было»; «Когда я говорю одному агенту, это равно я сказал всем … другой агент уже не спрашивает».

Vision: it serves [§4 The user's role](../../ux/vision.md#4-the-users-role), the operator does not carry «every prompt,
session, handoff and status in their head»: an abandoned task finds its agent without the operator. No new screen.

## What exists (read 2026-10-26, symbols)

- One 60-second cycle in the main process: `apps/desktop/src/main/index.ts` `TICK_MS`, its passes in
  `apps/desktop/src/shared/cyclePort.ts#runCyclePasses` (routines, chains, the runtime observer), then `board_tick`.
- A claim's life: `apps/desktop/src/shared/workClaims.ts#claimLife` (`live`, `silent` past its expiry with a session,
  `lapsed` with no session), `SESSION_STALE_MS` 10 minutes; open claims and leases: `apps/desktop/src/main/workRead.ts#readWork`.
- Fabric's own terminals: `liveness` states `stalled` and `gone` from the runtime observer; one fenced write into a
  terminal: `PtyManager.deliverWhenReady`.
- Board requests: states and `board_tick` in migration `20261021000120_board_core_holds.sql`; the operator's waiting
  count `board_waiting_operator`.
- The rules `fabric_whoami` serves: `apps/desktop/src/shared/protocol.ts#buildProtocol` from
  `apps/desktop/src/shared/protocolObligations.ts#OBLIGATIONS`.
- Missing: nothing wakes an agent. An agent enrolled from its own terminal through `fabric-mcp` gets nothing pushed;
  it learns only by calling a tool.

## Requirements

| REQ | What | Verified by |
|---|---|---|
| SW-1 | Every 3 minutes (every third pass of the 60-second cycle, not a new timer) Fabric sweeps abandoned work | a cycle test: passes 1 and 2 sweep nothing, pass 3 sweeps |
| SW-2 | Abandoned is any of: a claim `silent` with no sign for `SESSION_STALE_MS`; a claim `lapsed`; a task in running with no live claim; a board request open past 3 minutes whose target has not moved it; a board request answered whose requester has not read the answer for 3 minutes; a Fabric terminal whose liveness is `stalled` while it holds a task | one test per kind, each with its negative twin |
| SW-3 | Each finding names the task or request, its owner (session, agent, project), the kind and how long it has been still | the finding's shape in the test |
| SW-4 | Wake: a Fabric terminal gets one line delivered through `deliverWhenReady`, naming the item and the next step; an enrolled agent gets the finding in its next tool answer (`nudges[]` on every Fabric tool answer for that session) | a terminal test with a fake PTY; a surface test that `fabric_heartbeat` and `fabric_work_list` carry it |
| SW-5 | One telling per finding until it changes: the same item and kind is not told again for 30 minutes, and never twice in one sweep | a test of three sweeps over an unchanged item |
| SW-6 | Every agent's rule: every 3 minutes call `fabric_work_list` (or any Fabric tool) and act on `nudges` and `waiting_for_you` first | a new `OBLIGATIONS` row, mode `OBSERVED`, its evidence the sweep's receipt; the protocol hash test |
| SW-7 | A sweep that found something writes one journal receipt naming every finding; an idle sweep writes nothing beyond the cycle's own receipt | journal test |
| SW-8 | A `lapsed` claim found in two sweeps in a row is released as `lapsed` (`RELEASE_OUTCOME.lapsed`) and its task returns to the backlog with the reason, so another agent can take it | release test |
| SW-9 | The operator sees the findings where abandoned work already shows (attention kind `abandoned`, «На проверке»): no new screen | attention test |
| TO-1 | CO-426: a rule says that an instruction relayed from the operator with the operator's quote and its source is the operator's own; the agent that receives it acts without asking the operator again; an agent relaying writes the quote and the source | a new `OBLIGATIONS` row (`ADVICE`); the protocol hash test; the agent templates carry the same sentence |
| TO-2 | The agent templates Fabric writes when it creates or adapts an agent carry TO-1 and SW-6 | a template test |

## Out of scope

Waking a coding agent whose process has ended (nothing to wake: SW-8 frees its task instead). A push channel into
`fabric-mcp` beyond the tool answers (the MCP notification Fabric sends today carries no text). Changing the claim
lifetimes.

## Open choices, decided here by the operator's recorded decisions

- Cadence 3 minutes, from the operator's words; the 30-minute quiet period of SW-5 is this spec's choice, so a stuck
  item is not told twenty times an hour; reversible by a constant.
- The receipt of SW-7 is a new event type; it joins 0.3.13's one schema step (its `event_types` row and feed sentence).
