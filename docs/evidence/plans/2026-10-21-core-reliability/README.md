# Fabric 0.3.9: the core holds (plan, 2026-10-21)

**Objective (the operator, 2026-10-21).** «трекинг, автотрекинг проектов, определение кто над чем работает, трекинг
задач, доска, обмен сообщениями, стабильность или запуск, чтобы служба всегда была доступна, не крешилась ... это
все должно максимально быть стабильно и работоспособно, остальное уже хер с ним». The core of Fabric is the hub being
up, knowing which agent works on what in which project, the tasks, and the project board. This release makes that
core hold; the simple plan's wave 4 moves to 0.3.10.

**Evidence.** Three read-only audits of the installed system on 2026-10-21, each finding with its receipt:
[stability](2026-10-21-stability.md) (ST-1 to ST-13), [tracking](2026-10-21-tracking.md) (TR-1 to TR-15), [board](2026-10-21-board.md) (BD-1 to BD-10).
Measured: Fabric was available about 89.6 % of the last 7 days (21 outages, 17.5 h); 25 of 41 running Claude Code
sessions lost their session hooks after `/clear`; all 6 board requests ever sent are still queued.

## Stability

The hub stays reachable and says what is wrong; the stack is watched and recovered while Fabric runs; a start that
finds Docker or the database not ready keeps trying instead of quitting; the log keeps days, not hours.
Findings: ST-1 (disk), ST-2 (runtime stack watch), ST-3 (start does not quit), ST-4 (log retention), ST-5 (refusal
levels, done in 0.3.8), ST-11 (workspace-sync job, repaired 2026-10-21 by reinstalling it).

## Tracking

A session keeps its identity across `/clear` and a Fabric restart; an end observed before a session enrolled does not
end it; liveness follows the agent's process and turns, not only its Fabric calls, and live work keeps its claims; a
claim and a release move the task on the board; the agents list shows every session; expired agent-sync leases are
not shown as current. Findings: TR-1 to TR-7, TR-11, TR-14, TR-15.

## Board

An agent reads what is new to it and marks it read in one call; a reply from the asked project answers a request; a
request nobody can answer is said so at once and expires; waiting requests reach the operator's home. Findings: BD-1
to BD-6.

## What landed

Each part was built on its own branch, test first, every new test watched failing against the old code, then merged:
[stability notes](2026-10-21-notes-stability.md) (37 tests), [tracking notes](2026-10-21-notes-tracking.md) (29 tests),
[board notes](2026-10-21-notes-board.md) (the board database suite and unit tests). The notes name every change by
`file#symbol`.

- **Stability.** A start that meets Docker or the database not ready waits and tries again (10 s growing to 2 min) in
  a small window, instead of the failure window and a quit; the hub's port and `hub.json` are up from the start and
  answer 503 `stack-starting` with Retry-After until the database is ready (`main/hubStandby.ts`). While Fabric runs,
  `main/stackWatch.ts` reads the database every 30 s, pings Docker when that fails, says a lost stack on every screen,
  answers agents 503 `stack-unavailable` and brings the stack back; a disk under 3 GB is named first. The operations
  log rotates into segments within 96 MB and keeps at least 7 days; `startup-failure.log` appends.
- **Tracking.** fabric-mcp names the agent process it serves; a rejoin whose session id changed (after `/clear`) is
  matched by that process and the session takes the new id; an end with reason `clear`, an end observed before the
  session enrolled and a hook's end while the agent's own fabric-mcp still signs do not end it. A connected
  fabric-mcp signs every 2 minutes (claims renew), re-reads `hub.json` and enrolls again after a Fabric restart. A
  claim moves its task to running and a `done` release to review; `fabric_agents_list` lists enrolled sessions too;
  expired agent-sync leases are counted, not listed.
- **Board.** A reply from the asked project answers a request (state `answered`, journalled); a request with no
  deadline gets 7 days; a request no project serves is accepted with `noResponder` in its receipt. `com.list` takes
  `unread` and `since` and says `read` per message; cursors survive a restart; `com.read_ack` marks up to 100 messages
  or a thread up to a message in one call. The home shows requests nobody can answer and unread board messages. The
  Comms reads record their failures. Schema 95 (`20261021000120_board_core_holds.sql`).

## Not in this release

ST-6 (CO-364), ST-7 (CO-365), ST-9 (CO-366), TR-10 (CO-367), BD-7 (CO-368), BD-8 and TR-12 (CO-369), the reply fan-out
of BD-4, BD-9 and BD-10 (CO-370), the halves in fabric-agent-adapter and fabric-agent-contract (CO-371): all 0.3.10, in
the [carry-over ledger](../../specs/2026-08-16-software-fabric-carryover.md). TR-13 (an enrolled session's exit in the
journal) stays with TR-11's record in the tracking notes. A coding agent picks up the new fabric-mcp when it restarts.
