# 0.3.13, wave 2: the sweep of abandoned work (CO-427) and «told one is told all» (CO-426)

Status: built in 0.3.13 (2026-10-26), changed by the release review, iteration 1 (below). Plan row P-26, [plan](../plans/2026-10-26-release-0313-plan.md). The operator asked for both
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
| SW-4 | Wake: a Fabric terminal gets one line delivered through `deliverWhenReady`, naming the item and the next step; an enrolled agent gets the finding in its next `fabric_work_list` or `fabric_heartbeat` answer (`nudges[]`; narrowed from every tool answer, see As built) | a terminal test with a fake PTY; a surface test that `fabric_heartbeat` and `fabric_work_list` carry it |
| SW-5 | One telling per finding until it changes: the same item and kind is not told again for 30 minutes, and never twice in one sweep | a test of three sweeps over an unchanged item |
| SW-6 | Every agent's rule: every 3 minutes call `fabric_work_list` or `fabric_heartbeat` and act on `nudges` and `waiting_for_you` first | a new `OBLIGATIONS` row, mode `OBSERVED`, its evidence the sweep's receipt; the protocol hash test |
| SW-7 | A sweep that found something writes one journal receipt naming every finding; an idle sweep writes nothing beyond the cycle's own receipt | journal test |
| SW-8 | A `lapsed` claim found in two sweeps in a row is released as `lapsed` (`RELEASE_OUTCOME.lapsed`) with the reason; its task returns to the backlog when that claim had moved it into running (see As built) | release test |
| SW-9 | The operator sees the findings where abandoned work already shows (attention kind `abandoned`, «На проверке»): no new screen | attention test |
| TO-1 | CO-426: a rule says that an instruction relayed from the operator with the operator's quote and its source is the operator's own; the agent that receives it acts without asking the operator again; an agent relaying writes the quote and the source | a new `OBLIGATIONS` row (`ADVICE`); the protocol hash test; the agent templates carry the same sentence |
| TO-2 | The agent templates carry TO-1 and SW-6. Inside Fabric a session's only standing text is `apps/desktop/src/shared/preamble.ts#PREAMBLE`, which names `fabric_whoami` alone so that no rule lives in two places; the rules reach every Fabric session through `fabric_whoami`, so TO-1 and SW-6 in `OBLIGATIONS` are the template. The templates of agents built outside Fabric (the agent adapter, the `creating-fabric-agents` skill) are their owners': asked through fabric-workspace | `apps/desktop/src/shared/protocolObligations.w2.test.ts` (the rules reach `buildProtocol`) |

## As built, 2026-10-26 (after review round 1)

- SW-2: a request counts as unmoved only while `queued` (claimed and accepted ones are left to the board's deadlines);
  a running task a person moved there by hand is not unclaimed (`moved_by_kind`); no task is judged unclaimed when the
  claims read was cut at 500; a terminal is stalled only when its task is running and it has printed or taken nothing
  for 15 minutes (`TERMINAL_QUIET_MS`), and the write is refused if anything arrived after the read.
- SW-4: nudges ride on `fabric_work_list` and `fabric_heartbeat` only, each given once; the rule names exactly those
  two tools. Queued nudges whose finding is gone are dropped at the next sweep; one line per finding per session.
- SW-8: a lapsed claim is released when this process knew it (claimed or renewed after the process started, or its
  session seen live by an earlier sweep), or when it predates the process and its `expires_at` has passed; in both
  cases only if its task has no unresolved run. The task returns to the backlog only when that claim moved it into
  running.
- After round 2: a person's move exempts a running task only until a claim opens on it after that move; only the
  `terminal-stalled` kind is written into a Fabric terminal, every other kind (a silent claim included) waits as a
  nudge for that session, so a line ending in Enter never lands on a pending prompt for a claim.
- One sweep at a time; nothing is released or written while the app is quitting.
- SW-9, built 2026-10-26: the sweep keeps its latest findings in memory and hands a copy to the attention read
  (`apps/desktop/src/main/abandonedSweepRun.ts#createAbandonedSweep`, `current`); `work.swept@1` is not the source
  because its payload carries counts only, never the items. Each finding is an `abandoned` item keyed by its finding key
  (`apps/desktop/src/shared/attention.ts#attentionKey`), so the notifier's `told` tells it once and it leaves when a
  later sweep no longer finds it; a read that failed keeps that read's last findings; a lapsed claim the sweep released
  leaves at once. Scenario: SCN-173, amendment of 2026-10-26.
- Deferred then, built since: SW-7's journal receipt landed with the release's schema step (`efcf77dc`) and SW-6 moved
  from ADVICE to OBSERVED with it; the release review's changes are the next section. TO-2 outside Fabric was asked of fabric-workspace in a
  cross-session message on 2026-10-26, not on the board.

## As built, the release review, iteration 1 (2026-10-26)

- SW-4 narrowed (ER-2): nothing is typed into any terminal. A line ends in Enter, and a terminal quiet on a running task
  may be a coding agent waiting on a permission prompt, where Enter approves the highlighted option. A stalled
  terminal's finding waits as that session's nudge and shows in «На проверке» (SW-9).
- SW-7 as built: the receipt is `work.swept@1` in the journal (migration 124), with field rules at the app's ingress
  (`shared/commandIngress.ts`; without them every receipt was refused, DA-1). It carries counts by kind and the names of
  the reads that failed or were cut, never an item (DO-11: the requirement's «naming every finding» is the queue's, SW-9,
  not the receipt's). It is appended when a sweep told an agent, released a claim, or read blind or capped; a sweep that
  found only what it had already told writes none (DA-2), nor one that runs into a quit (ER-5).
- SW-3: a stalled terminal is still since its own last output or input, not since the observer marked it (ER-4).
- The running-tasks read stops at 500 rows without saying so; CO-439 records it.

## Out of scope

Waking a coding agent whose process has ended (nothing to wake: SW-8 frees its task instead). A push channel into
`fabric-mcp` beyond the tool answers (the MCP notification Fabric sends today carries no text). Changing the claim
lifetimes.

## Open choices, decided here by the operator's recorded decisions

- Cadence 3 minutes, from the operator's words; the 30-minute quiet period of SW-5 is this spec's choice, so a stuck
  item is not told twenty times an hour; reversible by a constant.
- The receipt of SW-7 is a new event type; it joins 0.3.13's one schema step (its `event_types` row and feed sentence).
