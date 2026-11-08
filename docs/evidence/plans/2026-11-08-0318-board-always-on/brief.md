# 0.3.18: the board that is always there (task-pipeline brief)

Task `296b88c5` on the Fabric board, claimed by session `70b535c6` (the coordinator session `5d9bed98`).
Stage 0 of the task-pipeline run, written 2026-11-08.

## The request, in one line

The operator, 2026-11-08: the project board the agents talk through must exist whatever happens to the Fabric
window, and stop only when the person turns its service off in Settings; and, in the same message, three more asks
about the agent page, the project page and the right-hand session pane (split below).

## Preflight

- **Model:** the most capable available in this session (Claude Opus 5.5, 1M context), inherited by every stage and
  subagent.
- **Run mode:** loop off; the coordinator's 15-minute cycle runs beside the run, not inside it.
- **Profile:** the default ten-stage profile; gates `auto`. Deploy (stage 7) is a Fabric release with no outside
  users beyond the operator's machines, under the operator's standing delegation (`~/.claude/CLAUDE.md`, "Full
  delegation, maximum autonomy").
- **Constraint now:** the operator's Mac is short of disk and memory (3.5 GB free, swap 38 GB, `fseventsd` at 8 GB
  on 2026-11-08 14:28 UTC). Until that clears, no full local test tier, build or package on this Mac: design and spec
  first, checks in hosted CI.

## Asks (intake split)

| Ask | What | Ranked | Where it lives |
|---|---|---|---|
| ASK-1 | The board (the hub's agent surface and the project board) stays alive independent of the Fabric window: a service that starts with the session, comes back after a crash, and stops only by an explicit switch in Settings | 1, kept (the operator: «И главное, чтобы работала всегда доска») | this run |
| ASK-2 | The agent page's «Сейчас» says «Задачи не взял» and a stage 33 hours old for an agent working right now: say what the agent does now, mark a stale stage as stale, show its tasks from its claims | 2 | CO-542 |
| ASK-3 | The project page mixes backlog, board and plans: show directions of work apart (where work came from, where it goes), one row per direction, scrolling cards; the same treatment for the agent page | 3 | CO-543 |
| ASK-4 | The right-hand session pane: data that does not refresh, recovery and loss of data, errors in logging; read the operations log for loops and failures and fix what it shows | 4 | CO-544 |
| (follow-up) | The hub in a process of its own, apart from the window's process, so a fault in one never takes the other | after ASK-1 | CO-545 |

The operator asked for all four; ASK-2 to ASK-4 run as the next waves of the same 0.3.18 iteration, each through its
own stages (ASK-3 starts at scenarios, through super-ux).

## Source ledger

| Source | What it says for this task | State |
|---|---|---|
| `AGENTS.md#lifecycle` | Fabric.app starts at login on macOS and Windows (CO-322), closing the last window keeps the main process on macOS, Cmd+Q ends it within 10 s | current, read 2026-11-08 |
| `apps/desktop/src/shared/loginItem.ts#loginItemFor` | macOS registers the app as `mainAppService` (SMAppService), Windows a Run entry with `--background` | current |
| `apps/desktop/src/main/index.ts#applyLoginItem`, the `AgentSurface` construction in `index.ts` | the hub is built inside the main process from closures over terminals, the registry, the sweep and settings | current; reach measured by reading, no code graph for this repository |
| the machine broker's log on the operator's Mac | the broker held Fabric `on_demand` with a 15-minute idle stop and stopped it 54 times; set `always_on` on 2026-11-08 (CO-322's row) | observed 2026-11-08 |
| Fabric's operations log, 2026-11-08 14:25 UTC | Fabric ended without a quit record under memory pressure; the broker started it again in about one second | observed 2026-11-08 |
| CO-322, CO-536, CO-537 rows (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) | the lifecycle rule, the Docker probe off the main thread, the reviews accepted by default | current |
| `docs/evidence/retro.md` | standing instructions read; the budget script's `check` takes no path argument here, so the floor's bytes were not printed by it | partial |
| Code graph | none built for this repository | none |
| Projects wiki | not consulted for this stage | not read |

Contradictions: `AGENTS.md#lifecycle` says Cmd+Q ends Fabric; ASK-1 asks that only the Settings switch stops the
board. ASK-1 wins (the operator's latest word); the lifecycle table changes in the same change.

## REQ spine (ASK-1)

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-1 | On macOS, Fabric registers a service that launchd starts at login in the background and starts again after the process ends abnormally | a unit test over the registration shape; on the operator's Mac, a killed main process comes back by itself within 10 s with no broker involved |
| REQ-2 | Closing every window, or the person's Quit from the menu, leaves the hub and the board answering while the service switch is on | a test of the quit path's decision; on the Mac, `com.status` answers after Quit |
| REQ-3 | Settings carries one switch, «Служба доски», on by default; off unregisters the service and lets Quit end the process as today | a renderer test of the switch; the switch's state read back from the system, not the stored wish |
| REQ-4 | The person sees, in Settings and on the board when the service is off, that agents cannot reach the board, in plain words | scenario and string checks |
| REQ-5 | Windows keeps its Run entry with `--background`; Linux registers nothing and Settings shows no switch there | unit test over `loginItemFor` per platform |
| REQ-6 | Docs, scenarios and the design map in the same change: `AGENTS.md#lifecycle`, an ADR for the service, the scenario for the switch | the documentation gate, the design map's check |

## Decisions taken at intake

- **D-1: the service is Fabric's own main process, not a second program.** The hub is woven into the main process
  (see the ledger); carving it out is CO-545. For 0.3.18 the main process becomes the service: launchd keeps it,
  the window is something it shows. Reversible: CO-545 replaces the process boundary without changing the switch.
- **D-2: Quit hides, the switch stops.** With the switch on, Quit closes the windows and keeps the process; the
  switch's off position is the one way to end the service on purpose (besides a shutdown or a logout).
- **D-3: the machine's broker stays a second supervisor, not the first.** Fabric must not depend on a broker the
  person may not have; on the operator's Mac the broker's `always_on` remains as a fallback.

## Not in this run

The hub in its own process (CO-545); the stack's own availability (Docker or Colima down still stops the board's
reads, already handled by the runtime stack watch and `stack-unavailable`).

## Stage 1: the contracts, from current documentation

Read 2026-11-08 from Electron's own docs at tag `v44.9.3` (`docs/api/app.md`, `app.setLoginItemSettings` and
`app.getLoginItemSettings`; `docs/breaking-changes.md`, the removal of the pre-macOS 13 attributes), through the
context7 index of `electron/electron`:

- `app.setLoginItemSettings({ openAtLogin, type: 'agentService', serviceName })` registers a launch agent whose
  property list is `Contents/Library/LaunchAgents/<serviceName>` inside the app bundle; `serviceName` is required for
  any type other than `mainAppService`.
- `app.getLoginItemSettings({ type: 'agentService', serviceName }).status` reads the system's state: `not-registered`,
  `enabled`, `requires-approval` or `not-found`. `loginItem.ts#loginItemState` already maps these four for the main
  app service; the agent service reads the same four.
- The app should be code signed and notarized for login item settings to work reliably; Fabric's release is
  (`scripts/release-mac.mjs`). A development build registers nothing (`loginItemFor` returns null), as today.
- Electron 44 dropped macOS 12, so SMAppService (macOS 13) is always present.

What the documentation does not settle, and the spec must test on the Mac: whether a second launch of `Fabric.app`
from Finder while the agent's instance runs reaches it through `requestSingleInstanceLock` (expected: yes, one
binary, one user, one lock), and how launchd's `KeepAlive` treats an exit the person asked for once the agent is
unregistered (expected: unregistering stops the job first, so the exit is not restarted).

## Next stage

Stage 2: the design and the work graph (the service's property list, the quit path, the switch, the migration from
`mainAppService`, Windows unchanged), with an ADR for the service.
