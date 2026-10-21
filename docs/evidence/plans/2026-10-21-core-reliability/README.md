# Fabric 0.3.9: the core holds (plan, 2026-10-21)

**Objective (the operator, 2026-10-21).** «трекинг, автотрекинг проектов, определение кто над чем работает, трекинг
задач, доска, обмен сообщениями, стабильность или запуск, чтобы служба всегда была доступна, не крешилась ... это
все должно максимально быть стабильно и работоспособно, остальное уже хер с ним». The core of Fabric is the hub being
up, knowing which agent works on what in which project, the tasks, and the project board. This release makes that
core hold; the simple plan's wave 4 moves to 0.3.10.

**Evidence.** Three read-only audits of the installed system on 2026-10-21, each finding with its receipt:
[stability](2026-10-21-stability.md) (ST-1 to ST-13), [tracking](2026-10-21-tracking.md) (TR-1 to TR-15), [board](2026-10-21-board.md) (BD-1 to BD-10).
Measured: Fabric was available about 86.9 % of the last 7 days (22 outages, 22.0 h; the stability audit's 89.6 % left out the outage the window starts inside, recomputed by the 0.3.9 review, DA-3); 25 of 41 running Claude Code
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
  expired agent-sync leases are counted, not listed. The review's iteration 1 added: fabric-mcp enrolls without
  `agentPid` against an older hub; agents hear the hub's 503 reason through fabric-mcp; an enrolled session's end is
  recorded when its agent's fabric-mcp leaves (TR-13); a claim let go takes its task back to backlog. After a Fabric
  restart an agent rejoins by itself, as a new Fabric session.
- **Board.** A reply from the asked project answers a request (state `answered`, journalled); a request with no
  deadline gets 7 days; a request no project serves is accepted with `noResponder` in its receipt. `com.list` takes
  `unread` and `since` and says `read` per message; cursors survive a restart; `com.read_ack` marks up to 100 messages
  or a thread up to a message in one call. The home shows the requests between projects no agent can answer, and how long the oldest has waited. On the
  operator's data the first tick answers 4 of the 6 queued requests (those a target replied to; the migration's header
  says six); the other 2 expire on 2026-10-26. The
  Comms reads record their failures. Schema 95 (`20261021000120_board_core_holds.sql`).

## Every audit finding, where it went

| Finding | Where |
|---|---|
| ST-1 to ST-4, ST-11 | fixed in 0.3.9 (above); ST-11 repaired 2026-10-21 by reinstalling the job |
| ST-5 | fixed in 0.3.8 (refusal levels by code, CO-335) |
| ST-6, ST-7, ST-9 | CO-364, CO-365, CO-366 (0.3.10) |
| ST-8 (a quit past its deadline with OrbStack hung) | not a defect: the 10 s hard deadline worked as designed (exit code 3) |
| ST-10 (one hub refusal for a slow database) | not a defect: the 503 with Retry-After is the designed answer |
| ST-12 (44 resident fabric-mcp, about 1.6 GB) | not a defect of this release: one per open coding agent, each ends with its agent; the 2-minute sign is sampled in the log |
| ST-13 (`ipc.stack:exposure` 2.4 s median) | carried with CO-366 (0.3.10): it runs off the main loop and freezes nothing |
| TR-1 to TR-7, TR-11, TR-14 | fixed in 0.3.9 (above); the adapter's half of TR-1, TR-2 and TR-11 is CO-371 |
| TR-8 (Hermes in the home folder) | fixed in 0.3.8 for the log flood and the backoff; the folder itself stays too broad by design |
| TR-9 (0.3.8 installed, 0.3.7 running) | resolved: the operator restarted Fabric into 0.3.8 at 15:01 local, 2026-10-21 |
| TR-10, TR-12 | CO-367, CO-369 (0.3.10) |
| TR-13 (an enrolled session's exit in the journal) | fixed in 0.3.9's review iteration 1: `session.ended@1` with reason `agent-left` |
| TR-15 (three tasks in review) | the operator's acceptance: a task in review is accepted by a person |
| BD-1 to BD-5 | fixed in 0.3.9 (above) |
| BD-3's second half (com.status listing requests addressed to the caller) | not done: the contract fixes com.status's shape; `com.list {unread: true}` covers the need (CO-371 asks the contract) |
| BD-4's fan-out, BD-9, BD-10 | CO-370 (0.3.10) |
| BD-6 | fixed with ST-4 |
| BD-7, BD-8 | CO-368, CO-369 (0.3.10) |

## How we will know it holds

After 0.3.9 runs on the operator's machine, the release close measures, with the same queries the audits used: the
gaps in `cycle.ran@1` over the following days (availability), the sessions whose hooks reach Fabric against the coding
agents running, the sessions shown silent while their agents work, the board requests left queued, and whether the
workspace-sync job ran on schedule (ST-11).

**Steps that need a person:** none for the release itself (Fabric is upgraded and restarted through the lifecycle
broker; a restart it refuses because the person holds the app waits for the person's own quit and open). The coding
agents pick up the new fabric-mcp when each is restarted. CO-365 needs a real reboot.

## Not in this release

ST-6 (CO-364), ST-7 (CO-365), ST-9 (CO-366), TR-10 (CO-367), BD-7 (CO-368), BD-8 and TR-12 (CO-369), the reply fan-out
of BD-4, BD-9 and BD-10 (CO-370), the halves in fabric-agent-adapter and fabric-agent-contract (CO-371): all 0.3.10, in
the [carry-over ledger](../../specs/2026-08-16-software-fabric-carryover.md). TR-13 (an enrolled session's exit in the
journal) stays with TR-11's record in the tracking notes. A coding agent picks up the new fabric-mcp when it restarts.
