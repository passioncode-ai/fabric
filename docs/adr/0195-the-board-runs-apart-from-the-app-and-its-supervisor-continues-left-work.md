# ADR-0195: The board runs apart from the app, and its supervisor continues left work

**Status:** accepted · 2026-11-16 · task `bbf5d017` · records the operator's word of 2026-11-16 in session `5273c136`
(quoted in [the on-demand spec §3.11](../evidence/specs/2026-11-04-on-demand-sessions.md#311-left-work-is-continued-the-board-supervisor):
the board must live whether Fabric is alive or restarting so agents are not stopped, an agent watches the board and the
tasks, reminds sessions and manages them, handing processes to the lifecycle module, merged with Switchboard; and work
that can go on starts by itself instead of waiting) · extends [ADR-0192](0192-the-board-is-a-service-launchd-keeps.md)
decision 5 (CO-545, the hub in a process of its own) · first wave built in the spec's §3.11.

## Context

On 2026-11-16 a session finished the first of the UI waves the operator had ordered, ended its turn, and the second
wave waited for him to come back. Nothing on this machine continues work its own session left: the dispatcher wakes a
project for a board request (§3.1) or an unread message (§3.8), the sweep reminds a live session (CO-427) and returns a
task nobody holds to backlog, and Switchboard's duty officer closes idle and restarts stalled sessions it can see. A
task in backlog with a next step written in its notes waits for a person.

Separately, the board still shares its process with the window (ADR-0192 decision 5): «Перезапустить Fabric», an
update or a crash of the window takes the hub, the board and every console Fabric started, and the agents in those
consoles stop with them. Three supervisors already exist and must not grow a fourth: the dispatcher and sweep inside
Fabric decide what needs a session; Switchboard starts, continues, ends and watches coding sessions (`switchboard
dispatch`, its session host, its duty officer, its accounts and limits); the lifecycle broker starts, stops and restarts
enrolled apps and launchd services.

## Decision

1. **One supervisor of the board, and it is Fabric's.** What the operator calls the agent that watches the board is the
   dispatcher, the sweep and, from this record, the continuation of left work, one set of rules over one board. It
   decides; it never starts or kills a process itself.
2. **Left work is continued** (§3.11, built in this record's wave). A task whose last session let it go unfinished, that
   nobody holds and no person moved since, gets a run that claims it and continues from its next step, 10 minutes after
   the release, under the dispatcher's limits; three runs that never take it give it to the operator for that release.
   «Продолжать начатую работу без меня» in Settings turns it off; on by default.
3. **Switchboard runs sessions; Fabric asks.** Every session the supervisor wants (a request, an inbox, left work) is a
   `switchboard dispatch`. Reminding a live session is the sweep's nudge; ending or restarting a stalled one is
   Switchboard's duty officer; Fabric never signals a coding agent's process.
4. **The lifecycle broker keeps processes.** Fabric.app and the board's service are enrolled targets of the broker;
   launchd keeps the board's service (ADR-0192); nothing else starts or stops them.
5. **The board leaves the window's process, in waves** (CO-545):
   - **W1, the boundary.** The hub's dependencies on the window's process (the terminals, the agent registry, the sweep,
     the settings, read today as closures in `main/index.ts`) are named as interfaces with one implementation each.
   - **W2, `fabric-board`.** A headless Node process runs the hub, the agent surface, the board's reads and writes, the
     dispatcher, the sweep and the supervisor against the same stack; the app reads it through the loopback hub like any
     client. The window's process keeps the screens and nothing an agent needs.
   - **W3, sessions outside Fabric.** Consoles start through Switchboard's session host, which holds a session past the
     viewer that opened it; Fabric attaches to them. A restart of Fabric then closes viewers, never sessions.
   - **W4, the service.** `fabric-board` gets its own launchd job in the bundle and its own enrolment in the lifecycle
     broker; ADR-0192's main-process service is retired, and «Перезапустить Fabric» restarts the window only.
   Each wave lands on its own, behind the gates, with nothing that works today broken by it.

## Consequences

- The operator no longer has to come back for work that can go on; a task he leaves half done for a reason should be
  moved by him (a person's move holds) or carry an open question, and the supervisor leaves it.
- A run may continue a task the last session meant to drop with `let-go`; the three empty runs bound the cost, and the
  sweep's own return of such a task to backlog is not a person's move.
- Sessions that release `done` while their order is not finished stop the chain: the agents' rule stays that a release
  says `done` only when the whole task is, and otherwise names the next step.
- Until W2 to W4 land, a restart of Fabric still takes the board and its consoles with it, as ADR-0192 says.

## Evidence

The dispatcher's existing items and limits (`shared/boardDispatch.ts#decideDispatch`, `main/boardDispatchRun.ts`); the
sweep's return of a released task to backlog (`shared/abandonedSweep.ts#releasedLeftRunning`); Switchboard's MCP tools
as installed on 2026-11-16 (`switchboard_session_end`: «End a session a session host holds»; `switchboard_duty`: the duty
officer closes finished and restarts stalled Claude Code sessions); CO-545's row in the carry-over ledger (the hub is
built from closures over terminals, the registry, the sweep and settings).
