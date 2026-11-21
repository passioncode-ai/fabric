# The board apart from the window: target state, today, and the waves to it

- Date: 2026-11-17. Board tasks: W1 `0647986c` (in review), W2 `8b86adf3`, W3 `dbeb4fcd`, W4 `4e0976c6`.
- Decision: [ADR-0195](../../adr/0195-the-board-runs-apart-from-the-app-and-its-supervisor-continues-left-work.md)
  decision 5 (CO-545). Design of W1 and W2: [the on-demand spec §3.13 and §3.14](../specs/2026-11-04-on-demand-sessions.md#313-the-hubs-boundary-wave-w1).
- The operator, 2026-11-17: «Анализируй тот вид, который должен быть в конце, все функции, которые должны работать
  корректно, и в каком они вида должны быть. Смотри на то, как и сейчас, и как корректно это работает, и составь план
  рефакторинга, и волнами все до конца закрой.»
- Inventory: read on `458bb92b` plus the W2a.1 edit (the `HubLinks` port, landed as `11b1391e`), by a read-only pass over
  `apps/desktop/src/main/index.ts` and the modules it wires. The agent architect's consult (2026-11-17) names the
  `agent-host` template and the `fail-closed-door` pattern (a loopback door checks its owner); Fabric's hub has that
  check already (`peerAccount.ts#createPeerCheck`, CO-514).

## 1. The end state

When W4 has landed, Fabric is two programs on the operator's Mac.

| Program | Kept by | Holds | Never holds |
|---|---|---|---|
| `fabric-board`, a headless Node process from the Fabric bundle | its own launchd job and an enrolment in the lifecycle broker | the hub and its port, the agent surface, Agent access, session enrolment, the board's reads and writes, the sweep of abandoned work, the dispatcher and its supervisor, the people-ask bridge, session holds, the routine and chain cycle, the runtime stack watch, the operations log and its digests | a window, a dialog, a notification, a terminal |
| `Fabric.app`, the window | the person, the system at login, the broker | the screens, the consent queue's native prompt, notifications, the stack's start (`env.ts`), viewers of sessions | anything an agent needs to keep working |

Coding sessions are held by Switchboard's session host (W3); the window attaches viewers to them.

### 1.1 What must work, and how

Every row is a promise the end state keeps; the last column is the check that proves it.

| Function | Behaviour in the end state | Proof |
|---|---|---|
| Agent tools (the surface) | Every tool answers as today: the same tools, the same answers, the same refusals. A window that is closed, crashed or restarting changes no answer. | `hub-surface`, `board-surface`, `tracking-surface`, `agent-surface` tests against the board process; a live call while the window is quit |
| The hub's port and `hub.json` | Taken by `fabric-board`; the stable port per user (CO-505); `hub.json` rewritten at its start, removed at its stop. Standby answers 503 with Retry-After until the stack is ready (`hubStandby.ts`). | `hub-door-db`, `hub-standby`, `startup-wait` tests; `lsof` names the board process on the port |
| Agent access and products | Requests, decisions, grants and revocations as today. A relayed decision from an agent works with the window closed. The consent queue's native prompt shows only when the window runs; a request still waits on the board without it (ADR-0160 §4: an agent's ask is a question on Главная). | `hub-access-*`, `hub-products`, `consent-presenter` tests |
| Session enrolment | A coding agent enrols through `fabric-mcp` and keeps its session across a restart of the window. | `session-enroll*`, `resumed-claims` tests |
| Claims and the board | Claims, briefs, moves, releases and the person's marks (a session the person ended, a grant the person revoked) are written by the board; the window's buttons reach them through the board's operator door. | `work-*` tests; the window's buttons walked on the screens stand |
| The sweep | Every three minutes, with the window open or not; its nudges ride on the agents' answers. | `abandoned-sweep-run` test |
| The dispatcher and supervisor | Every 30 s, with the window open or not; the same limits; time asleep judged by the board's own clock. | `board-dispatch-run`, `board-resume-read` tests; a live request answered with the window quit |
| People-ask bridge | Applies a person's answer through the board's own decision functions, not through window IPC doors. | `people-ask-run` test |
| Session holds | Set and cleared by the board when claims are taken and released. | `session-holds` test |
| Routine and chain cycle | Every 60 s in the board. | `routine-tick`, `chain*` tests |
| Stack watch | Every 30 s in the board; the window shows its state by reading the board. | `stack-watch` test |
| Operations log and digests | The board writes its own log and hourly and daily digests under the same data folder; the window keeps its own log for screens. | `ops-digest-*` tests |
| Terminals the board reads | Through the `HubTerminals` port: from the window until W3, from Switchboard's session host after it. Unknown is said as unknown, never as an empty list (`AgentSurfaceDeps.ptys`). | `hub-ports` test; `fabric_agents_list` with the window quit |
| Quit and restart | Quitting the window stops nothing an agent uses (after W4). «Перезапустить Fabric» restarts the window only. A signal to the board's job stops it within its deadline. | `quit`, `background-launch` tests; the launchd job read with `launchctl print` |

## 2. Today

Measured on `458bb92b` plus the W2a.1 edit. None of the board's modules imports Electron; every Electron dependency
reaches them through closures in `index.ts`. The board is built in two functions of `index.ts`: the hub in
`bootstrapReady`, the cycle, the sweep, the dispatcher and the people-ask bridge inside `registerIpc`, mixed with the
156 lines that register IPC doors (`grep -c "handle(IPC\.\|listen(IPC\." index.ts`).

### 2.1 What is already right

- The board's modules take their dependencies as arguments; each has its own tests (the table in §1.1).
- W1: the hub's reads of the window (terminals, sweep nudges, settings, registry) are ports with one implementation
  (`hubPorts.ts`). W2b: the local stores take their folder from the process's entry (`localStore.ts#setLocalStoreDir`).
  W2a.1: a product connection's desktop acts are the `HubLinks` port.

### 2.2 What ties the board to the window

| Tie | Where | Why it blocks a second process |
|---|---|---|
| Shared memory both sides write | `index.ts#personEndedSessions` and its markers, `reportedBranches`, `dispatchWake`, `dispatchHolder`, `abandonedSweep`, `opsDigest`, `taskBySession`, `keptOutAgents`, `stackHealthNow`, `hubState` | a window door writes what the board reads (or the other way); in two processes each holds its own copy |
| The window's doors read board objects | 9 `hub*` doors, 13 `work*` doors, the attention read behind `boardQuery`, `stackHealth`, `estateSummary` (about 45 of the 156 `handle` and `listen` doors) | they call `hubReady()`, `surface.*`, `abandonedSweep`, `dispatchHolder` in process |
| The board applies decisions through window doors | the people-ask bridge's `callDoor(IPC.questionAnswer, …)` | an IPC door does not exist in the board process |
| Terminals are the window's | `PtyManager` (`ptys`) read by the surface, the observer, the sweep, `heldSessions`, `sessionSignOf` | until W3 the terminals live where the window lives |
| Power events | `powerMonitor` suspend and resume feed the dispatcher's and observer's time asleep | Electron only |
| History's acts | the surface notes acts through `actsForSurface`, built with History in the window | the act writer must be the board's |
| Quit | `quit.shutdown` stops the surface; every board timer is cleared through `quit.onQuit` | the board needs its own stop |

### 2.3 What has no test today

`wireBoardDispatch` as a whole, `createMachineSessionHolds` by name, and the composition itself (`runCycle` and the
wiring of the sweep, the dispatcher and the bridge). W2a.4 brings them under test as it moves them.

## 3. The waves

Each step lands on its own, behind `scripts/ci.sh fast` with exit 0, with a line in the design map, the merge log and
CHANGELOG `Unreleased`, and leaves every answer an agent gets unchanged. A step that changes what the operator sees
says so in its CHANGELOG line.

| Step | What | Exit check | State |
|---|---|---|---|
| W1 | Hub ports: terminals, sweep, settings, registry (`hubPorts.ts`) | `hub-ports` test; ci fast | landed `eaca893b` |
| W2b | Local stores take their folder from the entry | `local-store-dir` test; ci fast | landed `458bb92b` |
| W2a.1 | `HubLinks`: a product connection's link and scheme handler | `hub-ports` test; ci fast | landed `11b1391e` |
| W2a.2 | **Board state in one object.** The shared memory of §2.2 moves into `main/boardState.ts` with methods (`markPersonEnded`, `reportBranch`, `wake`, the dispatcher's holder, the sweep's handle, `stackHealth`); window doors and board code both call it. Still one process. | a test per method; the doors' tests unchanged; ci fast | landed `0d81cc39`. As built (2026-11-18): `boardState.ts` holds the parts as `personEnded.mark`/`take`, `branches`, the `dispatchWake` slot, the dispatcher's holder, the sweep's handle and `stackHealth`, not the named methods above |
| W2a.3 | **The hub's composition out of `index.ts`.** `main/board.ts#startBoardHub(ports, deps)` builds the registry, access, connector, enrolment, surface and `startHub`; `index.ts` calls it. The consent presenter stays in `index.ts`. | `hub-surface`, `board-surface`, `tracking-surface`, `hub-standby` green; ci fast | landed `50c79ce4` (composed as `82064f51` before its rebase): the four green, every node test of the package green; the presenter, the hub ports and History's acts stay the window's (`BoardHubDeps`) |
| W2a.4 | **The cycle's composition out of `index.ts`.** `board.ts#startBoardCycle` builds the routine tick, chain advance, observer, sweep, dispatcher with its supervisor, people-ask, digests and the stack watch, with its own timers and stop. The bridge applies decisions through a `BoardDecisions` port (the same functions the IPC doors call), not `callDoor`. Power events become a `BoardClock` port. New tests: `wireBoardDispatch`, the session holds factory, one cycle pass. | the new tests; every test of §1.1; ci fast | landed `205d7bd8`: `boardCycle.ts#startBoardCycle`, `decisions` (the bridge's `PeopleDoors`) and `clock` as the two ports; `board-cycle` pins its timers, its reach and the window's doors; a test of one cycle pass, of the session holds factory and of `wireBoardDispatch` goes with W2c.1b, whose entry runs the cycle against a stand-in store; the stack watch stays in `index.ts` and moves with W2c.1b (the 0.3.23 review, iteration 1, PL-2) |
| W2c.1a | **The board's hub entry.** `main/boardMain.ts#startBoardProcess` composes `board.ts#startBoardHub` under plain Node (`ELECTRON_RUN_AS_NODE`), against the stack the window started: its own database client from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, journal, identity and operations log (`<user data>/board/logs`), `setLocalStoreDir` from `--user-data`, terminals `undefined`, a consent presenter without a window, macOS `open` for a product's link, a quit of its own (`createBoardQuit`). The assign's deps (`crossProjectAssign.ts#createAssignDeps`) and the project reads (`projectReads.ts`) leave `index.ts` so the window and the entry build them alike. A bundle entry `board-main` in `electron.vite.config.ts`. | `board-main.test.mjs`: the entry against a stand-in store answers a tool over its port; the quit, the presenter, the link opener, the reads; the import closure never reaches `env.ts`, `index.ts` or a top-level Electron import | landed `22403642`: the entry is built and nothing starts it; a start that fails after its hub is up withdraws `hub.json` (the 0.3.23 review, iteration 1, ER-7) |
| W2c.1b | **The cycle in the board's entry.** `boardMain.ts` starts `boardCycle.ts#startBoardCycle` once the window's decision doors are the board's (W2c.2b), with a clock that judges sleep by timer drift. | a test of one cycle pass against a stand-in store, of the session holds factory and of `wireBoardDispatch`; the stack watch moved out of `index.ts` with it | |
| W2c.2a | **The operator door's transport.** `main/operatorDoor.ts#startOperatorDoor` listens on `127.0.0.1` on a port the system picks and publishes `board-door.json` with a fresh token in `board-door-token` beside `hub.json`, both 0600 (`hub.ts#writeAtomic`). Before a body is read: the Host, no browser Origin, the caller's account (CO-514, `peerAccount.ts#createPeerCheck`), the bearer token in constant time. A call is `POST /door/<name>` with `{ "args": … }`; `callOperatorDoor` is the window's side. | `operator-door.test.mjs`: a call through the published files; every refusal before a door runs (421, 403, 403 `peer-foreign-account`, 503 `peer-unverified`, 401); unknown, failing and oversized calls; the stop withdraws only its own files | landed on `main` 2026-11-21 (composed as `fe7971f0` on `refactor/board-operator-door`, replayed on main at `fe8961f1`): the door is built and nothing starts it; two planted defects (no token check, no account check) watched being caught |
| W2c.2b | **The operator door's doors.** The board registers the window's board doors (the 45 of §2.2) on the W2c.2a door, a group at a time; the window's terminals are given to the board on the same door until W3. | a contract test per door group; the owner check refuses another account (CO-514) | in groups. **Agent access** (the nine `hub*` doors) landed 2026-11-21: `hubDoors.ts#createHubDoors` holds their bodies, the window's IPC doors call it, `hubDoors.ts#hubDoorTable` names them `hub.overview` … `hub.disconnect` for the operator door; `hub-doors.test.mjs` 10 of 10, through a real door too, four planted defects watched being caught. The board's entry does not serve the group yet: two of its doors write History's acts, which are still the window's (§2.2). Left: `work*` (13), `comms*`, `board*`, the attention read, `stackHealth`, `estateSummary`, and the terminals |
| W2d | **The window as a client.** The window starts `boardMain` as a child, waits for its door, and its board doors call it; it no longer starts the hub. Until W4 the window stops the child at quit. | screens stand and browser suites green; a live run: quit and reopen the window, an agent's session keeps its claims | |
| W3 | **Sessions outside Fabric.** Consoles start through Switchboard's session host; the window attaches viewers; `HubTerminals` answers from Switchboard. | `pty*` tests; a live console survives a window restart | task `dbeb4fcd` |
| W4 | **The service.** `fabric-board` gets its launchd job in the bundle and its enrolment in the lifecycle broker; ADR-0192's main-process service is retired; «Перезапустить Fabric» restarts the window only. | `quit`, `background-launch`, `board-launch-agent` tests; `launchctl print` on an installed build | task `4e0976c6` |

### 3.1 Order and why

State first (W2a.2), because every later step moves code that reads it; composition next (W2a.3, W2a.4), because a
second process needs one function to call; then the entry (W2c.1), the door (W2c.2) and the switch (W2d). W3 and W4
need W2d. The window keeps working at every step: until W2d nothing runs outside its process.

### 3.2 Alongside

Board requests and tasks addressed to Fabric are answered in the same turns as these steps (the operator, 2026-11-17:
«Не забудь параллельно решать задачи, которые прилетают»). The five-minute check reads the board.
