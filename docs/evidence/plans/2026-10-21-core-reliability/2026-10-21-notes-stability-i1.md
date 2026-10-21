# 0.3.9 "the core holds": stability fixes after review iteration 1 (branch `agent/core-st2`)

Base: candidate `8100be6b`. Scope: the stability findings of the iteration-1 release review (errors ER-1 to ER-5,
ux UX-2, UX-4, UX-5, data DA-2 with docs DO-7). No guarded or living document was edited (CHANGELOG, AGENTS.md,
CONTEXT.md, docs/ux, docs/adr, docs/architecture, backlog, design map): the integrator writes them from the list at
the end. Files of the tracking branch (`fabricMcp.ts`, `fabricMcpClient.ts`, `sessionEnroll.ts`, `workTools.ts`) and
of the board branch (`boardService.ts`, the home board panel) were not touched.

## Finding, fix, test

Every test below was written first and watched failing against the candidate's behaviour (last column).

| Finding | Fix | Test | Watched failing against the candidate |
|---|---|---|---|
| ER-1 (blocking): on Windows and Linux, destroying the wait window (or the splash, or the failure dialog's window on Retry) fired `window-all-closed` and quit | `quit.ts#createQuitCoordinator` takes `starting`: while it holds (index.ts passes `!windowReady`), `window-all-closed` quits on no platform unless a quit has begun (region `startup-window-scaffolding`). `index.ts#startOrExplain` creates the main window before `startupWaitDone('started')`, and the failure dialog's window (`explainAndQuit` is synchronous up to `new BrowserWindow`) before `startupWaitDone('failed')`. `index.ts#quitWhenPersonCloses`: the person closing the wait window or the splash on Windows or Linux still quits (`destroy()` emits no `close`, so only the person's act reaches it) | `test/quit.test.mjs` "ER-1: while the start is in progress …" (win32, linux, darwin; a begun quit still quits); `test/startup-wait.test.mjs` "ER-1: the wait window and the splash are scaffolding …" (source-pinned order and wiring) | quit: "win32: closing the wait window or the splash during the start quit Fabric"; startup-wait: the order asserts against the candidate `index.ts` |
| ER-2: a request during the standby-to-hub handover got no answer | `AgentSurface.start({ adopt })` accepts a function; `hub.ts#startHub` passes `() => standby.handOver()`, which the surface calls after its credential prime and in the same synchronous step that attaches its handler, so the standby answers 503 `stack-starting` until the surface answers | `test/hub-standby.test.mjs` "ER-2: a request during the handover is answered stack-starting …" (a prime held open, a request sent meanwhile) | "a request sent while the hub was taking over got no answer" (the test process also hung on the leaked socket) |
| ER-5: hub.json kept naming a live process on a closed port; a throwing takeover left sockets listening unanswered | `startHub`: a standby that is not taken over is stopped before the ordinary start (its port is then free for it); sockets handed over by a takeover that threw are closed (`closeListeners`); if the hub then does not open, hub.json and the door token are withdrawn (`withdrawHub`, only while they name this process). `OpenStandby.standby` gains `stop()` | `test/hub-standby.test.mjs` "ER-5: a standby the hub does not take over is stopped and its hub.json withdrawn"; "ER-5: a takeover that throws closes the adopted sockets, and the hub opens on its port the ordinary way" | both: hub.json still located; the hub could not open on its own port |
| UX-2 (blocking): «Next try in 0 s» while a try runs, a read every second, Retry-After 5 s; an external stack promised a recovery | `shared/stackWatch.ts`: the state gains `trying`, `recovers`, `hold`; `recoveryBegun` / `recoveryEnded` (the next try waits the backoff from the END of a try); `recoveryDue` is false while a try runs and for a stack Fabric does not own; `watchDelayMs` is 30 s while trying or holding; `hubRefusalFor` answers Retry-After 30 s while trying, with its own words for `external`, `stopped`, `running` (never "bringing it back"); `stackHealthView` gains `trying`, `attempt`, `hold`, `platform`, and `nextTryInS` is null while trying or holding. `main/stackWatch.ts` publishes a try's end and reads again 1 s after it. `StackHealthNotice.tsx` says `startup.wait.trying` («Trying now (try N).») while a try runs, and `stack.health.external` / `.stopped` / `.waitingContainers` for the holds | `src/shared/stackWatch.test.ts` "a try in flight, and a stack Fabric does not bring back (UX-2)" (3); `test/stack-watch.test.mjs` "UX-2: while a try runs …", "UX-2: an external stack is said as waited for …"; `src/renderer/src/StackHealthNotice.test.tsx` "while a try runs …", "for a stack Fabric does not bring back …" | all: `nextTryInS 0`, Retry-After 5, "bringing it back" for an external stack |
| UX-4 (blocking): OrbStack named on Windows and Linux | `shared/stackWatch.ts#platformKey` (`.win32`, `.linux`, else the macOS key, as `startupFailure.ts#diskLowLine` picks); used by `index.ts#startupWaitText` and `StackHealthNotice.tsx` (the view carries `platform`). New keys `startup.wait.docker.win32`/`.linux`, `stack.health.docker.win32`/`.linux`, en and ru | `src/renderer/src/platformWords.test.ts` "each platform names its own Docker" (every string naming OrbStack has non-OrbStack `.win32`/`.linux` variants, or is listed with why); `src/shared/stackWatch.test.ts` "each platform names its own Docker (UX-4)" (also: no U+2014 in these strings); `StackHealthNotice.test.tsx` "names Docker Desktop on Windows and Docker Engine on Linux …"; `test/startup-wait.test.mjs` "UX-4, UX-5 …" | platformWords against the candidate strings: offenders `startup.wait.docker`, `stack.health.docker` |
| ER-3: the watch restarted a stack stopped on purpose, and looped `supabase start` against running containers | A due try first asks Docker for the database container (`stackServices.ts#databaseContainer`: `docker ps -a --filter name=^supabase_db_fabric$ --format {{.State}}`; `#containerStateFrom`). `shared/stackWatch.ts#recoveryPlan`: gone (`absent`) holds as `stopped`; `running`, `restarting`, `paused` hold as `running`; anything else (exited, created, dead, Docker not answering, no `docker` CLI) starts. A held try counts no attempt and looks again at the next reading. A start is ONE `supabase start` (`env.ts#recoverStack`, `shared/stackStartRetry.ts#recoveryStart`): «already running» ends the try as nothing to start; Docker that is not there yet is still waited for, once. Each try's record says why: `stack.recover` detail `down`, `containers`, `because`, `result`; a hold is `stack.recover.held` (warn), once per change of hold | `src/shared/stackWatch.test.ts` "whether a try starts the stack (ER-3)" (2); `src/shared/stackStartRetry.test.ts` "recoveryStart: one start per try …" (3); `test/stack-watch.test.mjs` "ER-3: containers gone …", "ER-3: running containers are waited for …"; `test/stack-services.test.mjs` "ER-3: the database container's state …" | all: no module, or the candidate started the stack in each case |
| ER-4: a slow but working database put the hub into refusal | `STACK_READ_DEADLINE_MS` 3 s to 6 s (the hub's `HUB_DB_DEADLINE_MS`, 5 s, plus a margin). A read that ran out of time is `'slow'`; three slow reads in a row (`STACK_DOWN_AFTER_SLOW`) are a loss, two refused or broken ones (`STACK_DOWN_AFTER`) as before; one answer resets the count. `readDeadlineMs` is a dependency for the probe | `src/shared/stackWatch.test.ts` "a slow database is not a lost one (ER-4)" (2; one asserts `STACK_READ_DEADLINE_MS >= HUB_DB_DEADLINE_MS`); `test/stack-watch.test.mjs` "ER-4: reads that only run out of time take three in a row …" | 3000 < 5000; two slow reads lost the stack |
| UX-5: the wait window cut its Russian text | `index.ts#showStartupWait`: `useContentSize: true`, content 460 × 360 to start (`STARTUP_WAIT_HEIGHT`), resizable (min 360 × 160); `index.ts#fitStartupWait` sets the content height to the page's `scrollHeight` (160 to 640 px) after load and after each text update | `test/startup-wait.test.mjs` "UX-4, UX-5 …" (source-pinned) | the candidate's `height: 240, resizable: false` |
| DA-2 (blocking): unsampled `mcp.ping` broke the week; DO-7: "keeps at least 7 days" is not what the code does | `ops.ts#sampledByDefault` also samples a successful, fast, info-level `mcp.ping` (a failed, warned or slow ping is always written; `mcp.initialize` is never sampled). The header comment and the `DEFAULT_RETAIN_MS` comment state the true rule (below) | `test/ops-retention.test.mjs` "DA-2: forty agents pinging every 2 minutes for a week fit the default budget, and the week is kept" (40 agents × 30 pings an hour × 7 days plus 187 KB/h of other lines; default 8 MB segments and 96 MB budget) | the candidate's `ops.ts` (sampling asserts removed so the volume part runs): "the budget cut the week" (`ops.retention-short` written) |

### The decisions taken

- **A deliberate `supabase stop` is respected while Fabric runs.** `supabase stop` removes the project's containers
  (volumes stay). The watch reads a database container that is gone while Docker answers as such a stop: it does not
  start the stack, says so on the notice (`stack.health.stopped`) and to agents (hold `stopped`, Retry-After 60 s), and
  records it once (`stack.recover.held`). The next launch starts the stack as always. Reason: starting what the person
  stopped, behind their back, is worse than a database that stays down until they start it or reopen Fabric.
  Detection limit (to be written with the AGENTS.md row): a container removed by something other than `supabase stop`
  (a `docker system prune` after a crash, an engine reset) also reads as a stop; Docker that does not answer, or no
  `docker` CLI on PATH, reads as `unknown` and the try starts the stack as before (that start waits for Docker first).
- **Containers running, database silent: Fabric waits** (no `supabase start`, which only answers «already running»).
  Recovery there comes from Docker's restart policy or the database finishing its own recovery, as the audit found.
- **The operations log's retention, as it is.** The byte budget wins. Closed segments keep at most `budget - segment`
  (88 MiB by default; the current file adds up to 8 MiB), so a full week is kept while the log writes under about
  13 MB a day (about 550 KB an hour). The rate 0.3.9 writes besides the pings was measured by the reviewer at 187 KB/h;
  with `ipc.*` reads and `mcp.ping` sampled the pings add about one line per 10 minutes plus one `ops.sampled` count
  line, so the measured rate is about a third of the ceiling, and the DA-2 test keeps the week with 40 agents. A cut
  inside the week writes `ops.retention-short`; segments older than 30 days go. "Keeps at least 7 days" is not a
  guarantee and must not be written as one; "sized for 7 days within a 96 MB ceiling (a cut inside the week is
  recorded)" is.

### Also fixed on the way (same root as ER-1)

- The failure dialog's Retry destroyed its own window before the next start: on Windows and Linux that was the last
  window, and Fabric quit instead of retrying. The `starting` guard covers it.

## Measured

- The wait page exactly as `showStartupWait` builds it, rendered in WebKit (Playwright) at 460 px wide with the
  operator's log path: en 210 px, en with the disk line 275, ru 266, ru with the disk line 330 (the reviewer measured
  212, 275, 266, 330). The window starts at 360 px of content and then follows `scrollHeight`.

## Checks run on this branch

Exit codes read directly, never through a pipe.

| Command | Exit |
|---|---|
| `node --experimental-strip-types --test test/<t>.test.mjs` (from `apps/desktop`) for quit (15 tests), hub-standby (8), hub-surface (15), hub-locator (8), hub-access-refusals (2), fabric-mcp (61), startup (1), docker-ping (5), background-launch (4), stack-services (5), stack-watch (10), startup-wait (7), ops (1), ops-retention (5), ipc-window-policy (14), agent-http-ingress (1), stack-exposure (5) | 0 each |
| `node_modules/.bin/vitest run src/shared/stackWatch.test.ts src/shared/stackStartRetry.test.ts src/renderer/src/StackHealthNotice.test.tsx src/renderer/src/platformWords.test.ts` | 0 |
| `pnpm -C apps/desktop typecheck` (repo root) | 0 |
| `node scripts/check-regions.mjs`, `check-ops.mjs`, `check-ipc-contract.mjs`, `check-probes.mjs`, `check-design.mjs`, `check-list-reads.mjs` (repo root) | 0 each |
| `python3 docs/brand/lint.py`, `python3 docs/ux/lint.py` | 0 (0 errors; brand warnings gain 7 B022 rows for the new strings, the existing shape) |

Not run: the app (not launched); `scripts/ci.sh full` and the DB-backed suites (they need the disposable stack); the
design-map gate (the map is the integrator's).

## User-visible strings added (en / ru)

| Key | en | ru |
|---|---|---|
| `startup.wait.docker.win32` | Docker Desktop is not answering yet. Fabric keeps trying and opens by itself once it answers. | Docker Desktop пока не отвечает. Fabric продолжает пробовать и откроется сам, как только Docker ответит. |
| `startup.wait.docker.linux` | Docker Engine is not answering yet. Fabric keeps trying and opens by itself once it answers. | Docker Engine пока не отвечает. Fabric продолжает пробовать и откроется сам, как только Docker ответит. |
| `stack.health.docker.win32` | Docker Desktop stopped answering, so the local database is down. Fabric is bringing it back, and agents are asked to wait. | Docker Desktop перестал отвечать, поэтому локальная база данных недоступна. Fabric поднимает её снова, а агентов просят подождать. |
| `stack.health.docker.linux` | Docker Engine stopped answering, so the local database is down. Fabric is bringing it back, and agents are asked to wait. | Docker Engine перестал отвечать, поэтому локальная база данных недоступна. Fabric поднимает её снова, а агентов просят подождать. |
| `stack.health.external` | The database Fabric was given (SUPABASE_URL) stopped answering. Fabric does not run it, so it waits for it to come back, and agents are asked to wait. | База данных, которую указали Fabric (SUPABASE_URL), перестала отвечать. Fabric её не запускает, поэтому ждёт, когда она вернётся, а агентов просят подождать. |
| `stack.health.stopped` | The local database was stopped: its containers are gone, as after supabase stop. Fabric does not start it again by itself. Start it, or quit and reopen Fabric; agents are asked to wait. | Локальную базу данных остановили: её контейнеров нет, как после supabase stop. Fabric не запускает её снова сам. Запустите её или закройте и снова откройте Fabric; агентов просят подождать. |
| `stack.health.waitingContainers` | The local database stopped answering, though its containers are running. Fabric waits for it to answer, and agents are asked to wait. | Локальная база данных перестала отвечать, хотя её контейнеры работают. Fabric ждёт, когда она ответит, а агентов просят подождать. |

Reused on the notice: `startup.wait.trying` («Trying now (try {attempt}).» / «Пробуем сейчас (попытка {attempt}).»).
Agent-facing (English, not in the registry): `shared/stackWatch.ts#hubRefusalFor` now has five reasons (trying now,
next try, external, stopped, containers running). No string carries U+2014.

## What the integrator must change in docs

- `CHANGELOG.md` `## Unreleased`:
  - The first line ("Fabric no longer quits when Docker or the database is not ready at start") becomes true on
    Windows and Linux with this branch. Add: "On Windows and Linux, the end of a start that waited, and the startup
    dialog's Retry, no longer quit Fabric."
  - The runtime watch line: while a try runs the notice says «Trying now»; an external stack is waited for, never
    "brought back"; a stack stopped with `supabase stop` is not started again while Fabric runs; each try is one
    `supabase start`, none while the containers run.
  - The operations log line: "keeps a week" becomes "is sized for a week within 96 MB (a cut inside the week is
    recorded); successful polling reads and agents' keep-alive pings are counted, not written each time".
- `AGENTS.md` lifecycle table, the runtime stack watch row: the read deadline is 6 s (past the hub's 5 s); lost after
  2 refused or 3 slow reads in a row; on a due try `docker ps -a --filter name=^supabase_db_fabric$` first; one
  `supabase start` per try, backoff 10 s to 2 min counted from the end of a try; none while the containers run; none
  after `supabase stop` (containers gone: respected until the next launch, with the detection limit above); none for
  an external stack. The Local Supabase stack row's "Stopped by: `supabase stop`, by the operator" stays true; add that
  the watch respects it.
- `AGENTS.md`, the operations log sentence ("keeping at least 7 days", `AGENTS.md:169` on the candidate), and CO-362's
  resolution in the carry-over ledger: state the retention rule above (DO-7).
- `docs/ux/scenarios.md`: the SCN-161 amendment and the stack-lost scenario gain the try-in-flight line, the three
  holds (external, stopped, containers running) and their words, and the per-OS Docker names; the flows and the product
  model as the iteration contract says.
- `docs/architecture` (the hub) and the ADR-0115 amendment on the hub before the stack: the takeover is atomic (the
  standby answers until the surface's handler is on the same sockets); a standby the hub does not take over is stopped
  and its hub.json withdrawn.
- `docs/reports/map.html` changelog entry, then `node scripts/check-design-map.mjs --refresh` and the check.
- Board rows to file (adjacent, not blocking): `startup.stack-start-timed-out.remedy` and
  `startup.stack-would-not-start.remedy` (en and ru) name OrbStack on every OS; they are listed in
  `src/renderer/src/platformWords.test.ts` `ORBSTACK_ANYWHERE` until they get per-OS keys.
