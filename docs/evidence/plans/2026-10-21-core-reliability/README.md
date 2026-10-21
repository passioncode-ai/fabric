# Fabric 0.3.9: the core holds (plan, 2026-10-21)

**Objective (the operator, 2026-10-21).** «трекинг, автотрекинг проектов, определение кто над чем работает, трекинг
задач, доска, обмен сообщениями, стабильность или запуск, чтобы служба всегда была доступна, не крешилась ... это
все должно максимально быть стабильно и работоспособно, остальное уже хер с ним». The core of Fabric is the hub being
up, knowing which agent works on what in which project, the tasks, and the project board. This release makes that
core hold; the simple plan's wave 4 moves to 0.3.10.

**Evidence.** Three read-only audits of the installed system on 2026-10-21, each finding with its receipt:
[stability](stability.md) (ST-1 to ST-13), [tracking](tracking.md) (TR-1 to TR-15), [board](board.md) (BD-1 to BD-10).
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

## Not in this release

ST-6 (schema steps applied at upgrade), ST-7 (a real reboot test of the login item), ST-9 (disk writes), TR-10 (work in
repositories without a project), BD-7 (a wall between unrelated businesses on the board), BD-8 and TR-12 (duplicate
project names), BD-9, BD-10: carried to the backlog with their evidence.
