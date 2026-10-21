# 0.3.9 "the core holds": stability part (branch `agent/core-st`)

Scope: ST-3, ST-2, ST-1 (CO-362), ST-4 of [the stability audit](docs/evidence/plans/2026-10-21-core-reliability/stability.md).
No guarded document was edited (backlog, ADRs, architecture, CONTEXT, vision, CHANGELOG, docs/ux, docs/reports): the
integrator writes them from the list at the end.

## What changed

### ST-3: a start that finds Docker or the database not ready does not quit

- `apps/desktop/src/shared/stackWatch.ts#startupHeals`: which classified start failures heal by waiting
  (`stack-start-timed-out`, `database-unreachable`, `stack-would-not-start`/`unknown` whose words say Docker is
  unreachable or the stack is still starting, `schema-not-ready` with an unverified `timeout`/`transport` check).
  Everything else (CLI missing, repository missing, schema behind/ahead/backend-error, schema missing, identity,
  stack up but silent, a port taken) keeps the startup dialog.
- `apps/desktop/src/shared/stackWatch.ts#stackBackoffMs`: 10 s, 20 s, 40 s, 80 s, then 2 min.
- `apps/desktop/src/main/index.ts#startOrExplain`: a healing failure goes to `waitAndRetryStart` instead of
  `explainAndQuit`; `startupBroken` is set only for a failure that will not heal.
- `apps/desktop/src/main/index.ts#waitAndRetryStart`, `#showStartupWait`, `#startupWaitText`, `#startupWaitDone`:
  the wait. Each failure is appended to startup-failure.log and recorded (`startup.waiting`, one record per try, tries
  are 10 s to 2 min apart); a small window says what Fabric waits for (Docker or the database), the low-disk line when
  the disk is under 3 GB, the next try, that agents are asked to wait, and the log path. No window in a background
  start until the person activates Fabric (`activate` and `second-instance` now show it). The splash is not shown
  on top of it (`resolveEnvStartingStackIfNeeded`). A quit clears the timer (LC-02); the quit deadline is unchanged.
  `startup.waited` records how the wait ended (`started` or `failed`), once.
- `apps/desktop/src/main/hubStandby.ts#HubStandby`, `#openHubStandby`, `#closeHubStandby`, `#refuseForStack`: the hub's
  port (127.0.0.1 and [::1]) and hub.json are taken and published at the top of `bootstrap`, before the stack. Every
  call is answered HTTP 503 with `{ "error", "code": "stack-starting" | "stack-unavailable", "retryable": true }` and
  `Retry-After`, after the same Host/Origin checks the surface makes; no body read, no credential lookup.
  `stack-unavailable` with the failure's title is answered while the startup dialog shows a failure that will not heal.
- `apps/desktop/src/main/agentSurface.ts#AgentSurface.start` (`adopt`): the surface takes the standby's listening
  sockets over as they are (region `hub-standby-adopt`): the port is never free for a moment, no second bind.
- `apps/desktop/src/main/hub.ts#startHub` (`standby`, region `hub-standby-takeover`): with a standby on the hub port
  the hub keeps the hub.json and door token the standby published (an agent that read them during the wait keeps a
  valid token). Without one, unchanged.

### ST-2: runtime stack watch

- `apps/desktop/src/shared/stackWatch.ts#observeStack`, `#recoveryDue`, `#recoveryTried`, `#watchDelayMs`,
  `#hubRefusalFor`, `#stackHealthView`: the pure state machine. Lost after 2 consecutive failed reads (one slow read is
  a blip), why `docker` when Docker's ping also fails, else `database`; one event per change of state.
- `apps/desktop/src/main/stackWatch.ts#createStackWatch`: every 30 s one `schema_version` read with a 3 s deadline;
  Docker's `/_ping` only when that read failed; `statfs` of userData. Records `stack.lost` (error, with why and free
  disk), `stack.back` (down seconds, tries), once each; `stack.recover` once per try (bounded by the backoff). While
  down it ticks sooner when a try is due, tries the launch's start path (`env.ts#startStack`, which waits for Docker
  and retries a starting container) with backoff 10 s growing to 2 min, never two tries at once, and never for an
  external stack (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY given).
- `apps/desktop/src/main/index.ts#startStackWatch` (region `runtime-stack-watch`): started once the app has started
  (not under SMOKE); Docker ping asks the default socket and, on macOS, `~/.orbstack/run/docker.sock`; `onChange` puts
  the surface into the refusal mode and broadcasts `stack:health-changed`. Stopped on quit.
- `apps/desktop/src/main/agentSurface.ts#AgentSurface.setUnavailable` (region `stack-unavailable-mode`): while set,
  every POST is refused 503 `stack-unavailable` with Retry-After, before any credential lookup; a DELETE (a client
  leaving) still goes through.
- IPC `stack:health` (read) and `stack:health-changed` (broadcast), main window only:
  `apps/desktop/src/shared/types.ts` (`IPC.stackHealth`, `IPC.stackHealthChanged`, `FabricApi.stack.health`,
  `FabricApi.stack.onHealth`), `apps/desktop/src/shared/ipcWindowPolicy.ts`, `apps/desktop/src/preload/api.ts`,
  `scripts/check-ipc-contract.mjs` (`BROADCAST` gains `stackHealthChanged`).
- `apps/desktop/src/renderer/src/StackHealthNotice.tsx#StackHealthNotice`, mounted at the top of every screen in
  `App.tsx`: the database down (Docker or database), that Fabric is bringing it back and agents are asked to wait, the
  next try; nothing while up and the disk has room.

### ST-1 / CO-362: free disk with the stack state

- `apps/desktop/src/shared/stackWatch.ts#observeStack`: under `LOW_DISK_BYTES` (3 GB decimal) is `disk-low`, recorded
  once per crossing (`stack.disk-low`); back above 3.5 GB (`DISK_RECOVERED_BYTES`) is `disk-ok` (`stack.disk-ok`), so a
  disk hovering at 3 GB does not flap. `stackHealthView.diskLikelyCause`: down on a low disk.
- The notice names the disk first, as the likely cause, when the stack is down on it; a low disk alone is a warning.
  The start-wait window carries the existing `startup.diskLow*` line (`startupFailure.ts#diskLowLine`).

### ST-4: the operations log keeps days

- `apps/desktop/src/main/ops.ts#createOps`: sized by time within a byte budget. The current file rotates past 8 MB into
  `operations.<epoch ms>.jsonl`; nothing is rewritten in place (the 4.7 MB full-file trim every 1 000 appends, part of
  ST-9, is gone; size is counted, not read). Segments older than 30 days go; the oldest go first past the 96 MB budget;
  a budget cut inside the 7-day floor writes `ops.retention-short` (warn). `read()` reads newest segments first and
  stops at `limit`. The gap marker (`ops.gap`) and never-throw behaviour are kept.
- `apps/desktop/src/main/ops.ts#sampledByDefault`: a successful, fast (< 1 s), info-level `ipc.*` record (the polling
  reads: `ipc.feed:replay`, `ipc.terminal:list`, `ipc.comms:heads`, now `ipc.stack:health`) is written once per
  10-minute window per operation and counted otherwise; the window's counts are one `ops.sampled` line. Failures,
  warnings, slow calls and every other operation are always written.
- `apps/desktop/src/main/boundedLog.ts#appendBounded`: startup-failure.log is appended (256 KiB, newest kept, cut at a
  line), never overwritten; never throws, answers `{ ok }` and the caller records a failure
  (`index.ts#explainAndQuit`, `#waitAndRetryStart`).

## Tests (written first, watched failing)

| Test | Watched failing against |
|---|---|
| `apps/desktop/src/shared/stackWatch.test.ts` (13, vitest) | no module; then planted: `startupHeals` returning false (the old "always quit"), and a loss recorded on every tick |
| `apps/desktop/test/ops-retention.test.mjs` (4) | the old `ops.ts`: 3 of 4 failed (no rotation, 988 890 bytes against a 200 KiB budget, 600 lines for 600 polls); planted: `appendBounded` overwriting (the old `writeFileSync`) failed "attempt 0 was overwritten" |
| `apps/desktop/test/hub-standby.test.mjs` (5) | planted: the surface ignoring `adopt` and the unavailable mode removed, 3 of 5 failed |
| `apps/desktop/test/stack-watch.test.mjs` (5) | no module; planted: the one-try-at-a-time guard removed, failed |
| `apps/desktop/test/startup-wait.test.mjs` (5, source-pinned as `background-launch.test.mjs` is) | the old `index.ts`: 5 of 5 failed |
| `apps/desktop/src/renderer/src/StackHealthNotice.test.tsx` (5, vitest) | planted: the down branch removed, 2 of 5 failed |

Updated: `apps/desktop/test/ops.test.mjs` (the bound is bytes now, not a line cap), `apps/desktop/test/background-launch.test.mjs`
(the splash also stays away while the wait window shows; an activation during the wait shows it). The four new node
tests are added to `apps/desktop/package.json` `test`.

Run on this branch: `npx vitest run` 198 files, 2 332 tests passed; `pnpm -C apps/desktop typecheck` exit 0;
`node scripts/check-regions.mjs`, `check-ops.mjs`, `check-list-reads.mjs`, `check-ipc-contract.mjs`,
`check-probes.mjs`, `pnpm gates:design` exit 0; node tests ops, ops-retention, hub-standby, stack-watch,
startup-wait, hub-surface, hub-locator, hub-access-refusals, fabric-mcp, startup, docker-ping, ipc-window-policy,
background-launch, quit, schema-readiness, seed-repair, reconcile, digest-boundary, local-state, agent-http-ingress,
pty-launch-failure, stack-exposure, main-bundle, preload-sandbox, csp (after `electron-vite build`) exit 0.
Not run: `agent-surface.test.mjs` and `routine-tick.test.mjs` refuse without a disposable stack (`ci.sh full`); the
operator's live database (54321/54322) was not touched. `pnpm gates:docs` fails only at `check-design-map.mjs`
("Changed iteration reuses the committed top entry"): the design map is the integrator's.

## User-visible strings added (en / ru)

| Key | en | ru |
|---|---|---|
| `startup.wait.title` | Fabric is waiting for its database | Fabric ждёт свою базу данных |
| `startup.wait.docker` | Docker (OrbStack or Docker Desktop) is not answering yet. Fabric keeps trying and opens by itself once it answers. | Docker (OrbStack или Docker Desktop) пока не отвечает. Fabric продолжает пробовать и откроется сам, как только Docker ответит. |
| `startup.wait.database` | The local database is not ready yet. Fabric keeps trying and opens by itself once it answers. | Локальная база данных ещё не готова. Fabric продолжает пробовать и откроется сам, как только она ответит. |
| `startup.wait.next` | Next try in {seconds} s (try {attempt}). | Следующая попытка через {seconds} с (попытка {attempt}). |
| `startup.wait.trying` | Trying now (try {attempt}). | Пробуем сейчас (попытка {attempt}). |
| `startup.wait.agents` | Agents that call Fabric meanwhile are asked to wait. | Агентов, которые тем временем обращаются к Fabric, просят подождать. |
| `startup.wait.log` | What the machine said each time is in {log} | Что машина отвечала каждый раз, записано в {log} |
| `stack.health.title` | Fabric's database is not answering | База данных Fabric не отвечает |
| `stack.health.docker` | Docker (OrbStack or Docker Desktop) stopped answering, so the local database is down. Fabric is bringing it back, and agents are asked to wait. | Docker (OrbStack или Docker Desktop) перестал отвечать, поэтому локальная база данных недоступна. Fabric поднимает её снова, а агентов просят подождать. |
| `stack.health.database` | The local database stopped answering. Fabric is bringing it back, and agents are asked to wait. | Локальная база данных перестала отвечать. Fabric поднимает её снова, а агентов просят подождать. |
| `stack.health.nextTry` | Next try in {seconds} s. | Следующая попытка через {seconds} с. |
| `stack.health.diskCause` | This disk has {free} GB free. A full disk stops Docker, and the database with it: free some space first. | На этом диске свободно {free} ГБ. Когда диск заполнен, Docker останавливается, а с ним и база данных: сначала освободите место. |
| `stack.health.diskTitle` | The disk is almost full | Диск почти заполнен |
| `stack.health.diskLow` | This disk has {free} GB free. Docker stops when the disk runs out, and Fabric's database with it: free some space soon. | На этом диске свободно {free} ГБ. Когда место кончается, Docker останавливается, а с ним и база данных Fabric: освободите место в ближайшее время. |

Agent-facing (English, the hub's language, not in the registry): the standby's and the surface's 503 reasons in
`index.ts#startupRefusal` and `shared/stackWatch.ts#hubRefusalFor`. No string carries U+2014.

## Docs the integrator must update

- `AGENTS.md` lifecycle table: a row for the runtime stack watch (main process, every 30 s while running: one
  `schema_version` read, 3 s deadline; Docker `/_ping` on failure; statfs of userData; on loss `supabase start` with
  backoff 10 s to 2 min, one at a time, local stack only; stopped on quit); the Local Supabase stack row (a start that
  meets Docker or the database not ready now waits and retries with the same backoff instead of the failure window,
  showing a small wait window, none in a background start until activated); the "Fabric listens on one loopback port"
  paragraph (the hub port and hub.json are now published before the stack and answer 503 `stack-starting` /
  `stack-unavailable` with Retry-After until the database is ready, and again while the runtime watch finds it lost);
  the operations log (rotated segments `operations.<ms>.jsonl`, 8 MB, 96 MB budget, 7-day floor, 30-day age limit,
  `ipc.*` successes sampled with `ops.sampled` counts) and `startup-failure.log` (appended, 256 KiB).
- `docs/ux/scenarios.md`: SCN-161 (Fabric opens while its stack is still starting) gains the wait instead of the
  failure window for healing causes, the wait window, and the hub's `stack-starting`; a new scenario for "the stack
  goes away while Fabric runs" (the notice, the hub refusal, the recovery, the low-disk line); `docs/ux/` flows and
  the product model as the iteration contract says.
- `docs/architecture/*` (external contracts / the hub, ADR-0115 §1): the hub exists before the stack and has a typed
  refusal mode; the fabric-hub/0.1 contract gains the 503 body `{ error, code, retryable }`. Probably an ADR (or an
  ADR-0115 amendment) for "the hub answers before the database is ready".
- `docs/ANALYTICS.md`: nothing. `CHANGELOG.md` lines:
  - "Fabric no longer quits when Docker or the database is not ready at start: it waits, says what it waits for, and
    tries again (10 s growing to 2 min). Agents get a 503 `stack-starting` with Retry-After instead of no hub."
  - "While Fabric runs it watches its database every 30 s: a lost stack is said on every screen, agents are told
    `stack-unavailable`, and Fabric brings it back. A disk under 3 GB is named, first, as the likely cause."
  - "The operations log keeps a week (rotated segments within a 96 MB budget); successful polling reads are counted,
    not written each time. startup-failure.log keeps every failed start."
- `docs/reports/map.html` changelog entry and `node scripts/check-design-map.mjs --refresh` (gate currently red only
  for this).
- Backlog: CO-362 and ST-1..ST-4 rows to review/done with this branch's commit.

## Not done, and why

- The 60 s cycle keeps running while the stack is down and leaves its `outcome_unknown` receipts (the audit proposed
  pausing it). Left: its receipts are the availability measure the audit itself used; pausing it is a separate choice.
- Docker is asked on the default socket and OrbStack's `~/.orbstack/run/docker.sock`; a Docker Desktop context on
  another socket reads as Docker down when the database is also down (only the `why` wording is affected).
- The wait window is a plain page without buttons (Quit through the menu or Cmd+Q; closing it on Windows or Linux
  quits, as closing the last window does there). The startup dialog with Retry/Copy/Quit is unchanged for failures
  that will not heal.
- The notice's next-try seconds refresh at the watch's ticks (at most 30 s apart), not every second.
- No end-to-end run of the app (the brief forbids launching it): the index.ts wiring is pinned by source
  (`startup-wait.test.mjs`) and its parts are driven for real in the module tests.
- DB-backed suites (`agent-surface.test.mjs`, `routine-tick.test.mjs`) need `ci.sh full` on a disposable stack.
