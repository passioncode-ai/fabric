# ADR-0125 — An agent launch may follow the operator's fallback order, resolved before the session opens

**Status:** accepted · 2026-10-07 · operator request («везде, где есть чаты с агентом — терминальные
агенты по настройке с выбором и fallback; нет сессии Claude Code — отвечает запущенный Hermes») · plan
CO-223 · contract DEC-0026 as refined by DEC-0029 (`fabric-agent-contract`, 2026-10-07). This record
replaces the proposal of the same number in PR #18, which a review against the host code at `a655b068`
found unworkable in seven places (listed under *What the first proposal got wrong*). The contract
side of the same review is `fabric-agent-contract` DEC-0029 (PR #19, merged as `058fb789`).

## Context

The contract now defines a **runner route**: an ordered list of admitted candidates, each with a session
policy, walked from the top at a launch, every candidate passed over with a closed probe result, a
selected candidate run under the *derived execution context* — the pinned one with only the provider
replaced (DEC-0029). It also says what a host may do before it adopts routes: order runners by a setting
of its own, as long as what it records names no route revision.

What the host has (read at `a655b068`):

- **Two entry points reach every session today.** The ad-hoc terminal (`IPC.terminalOpen` in `index.ts`) and the managed launch's `prepare` (`apps/desktop/src/main/index.ts#createManagedLaunch`), which serves `tasks.start`,
  `tasks.startExisting`, `tasks.research`, chain advance and routine tick through `startTask`. Both end in
  `PtyManager.open` (`pty.ts#PtyManager`), which validates and spawns one runner and throws when it is not
  available (`pty.ts#PtyManager`). The owned-backend path (ADR-0081, AS-13) and the CEO session (ADR-0123
  §2) are not wired yet.
- **A launch names one runner and gets that runner or an error.** `prepare` substitutes `'claude-code'`
  for an empty option (`apps/desktop/src/main/index.ts#createManagedLaunch`), chain advance does the same (`chainAdvance.ts#createChainAdvance`), and the
  pickers silently pick the first available runner when the default is missing (`Tasks.tsx#Tasks`,
  `ProjectHome.tsx#ProjectHome`).
- **Availability is `which`** (`pty.ts#launchOptions`); the first run's detection
  (`executorDetect.ts`) knows found/unresponsive/missing and a bounded sign-in observation
  (`executorAuth.ts`).
- **Quota has one basis, Claude's** (`quota.ts#createQuotaReader`); routine tick claims it before it starts a task
  (`routineTick.ts#createRoutineTick`), and ADR-0119 forbids running unattended on an unknown quota.
- **Sessions are Fabric-spawned PTYs** (`PtyManager.sessions`); a managed launch requires the session id
  its admission minted (`managedLaunch.ts#createManagedLaunch`), so it can never reuse another session.
- **App settings are device-local** (`settings.ts#readSettings`) and installed runners are a fact about the device.

## Decision

1. **The fallback order is an installation setting, and it is not a route.** Settings → *Fallback order* carries
   an ordered list of runners, each with a session policy: *open a new session*, *use an open session,
   otherwise open a new one*, or *use an open session only*. It lives in the device-local settings file,
   next to theme and locale, because which runners exist is a fact about this computer. Following
   DEC-0029, what Fabric records of it names the basis `host-order`, never a route revision. When the
   project-pinned contract route lands (the contract repin, CO-223's later step), it takes precedence
   over this list and its records name its revision; the list then remains the installation's default.
2. **"Fallback order" is a launch choice, never a silent substitution.** Every picker that offers a
   runner offers *Fallback order* as one more choice when the list is not empty, and shows the runner it
   resolves to right now. Choosing a runner by name launches that runner or fails, as today. Only the
   *Fallback order* choice walks the list, so the picker and the launch can never disagree, and a person
   who asked for Codex never gets Claude. When the list is set, the launchers choose *Fallback order* by
   default — the operator set the order to be used (SCN-135). The choice is a launch input only
   (`FALLBACK_OPTION`); a task records the runner the walk chose, never the choice.
3. **The walk runs in the main process, before the session exists, at both entry points** — the ad-hoc
   terminal and the managed launch (`tasks.start` with the fallback choice). `PtyManager.open` stays the
   final validator and refuses exactly what it refuses now. The walk is a pure function
   (`shared/runnerRoute.ts`) over the list and a probe; for each candidate, in order:
   - **catalogued** — a row of `shared/agents.ts` (the catalogue until AS-03), never `shell`;
   - **installed and responding** — the detection's found state;
   - **signed in** where the detection can tell (`executorAuth.ts`): only its *not authenticated* answer
     passes a runner over as `not-connected`; an unsupported build or an inconclusive check is judged
     by the version answer alone, as the contract says of a runner without a sign-in check;
   - **the launch's permission mode** — the candidate accepts the mode (`mayLaunch`) and its containment
     for it is not weaker than the containment the first candidate would have had (`containmentFor`), so
     a fallback never trades *ask before each tool* for *no gate*;
   - **the result channel** — for a managed task, not weaker than the first candidate's, so a task that
     would report on the surface is not handed to a runner that cannot;
   - **the surface**, for `acp-session` and `config-content-env` runners, which cannot start without it
     (passed over as `refused`, with the reason);
   - **attach** (ad-hoc terminal only), when the entry allows it: a live, idle Fabric-held session of
     that runner in the same project, run as the runner itself (not a created agent) and under exactly
     the permission mode this launch would apply, accepting input, not bound to a task
     (`taskBySession`) and not opening — so a launch that asks for a gate never lands in a session
     opened in bypass. Attaching brings that session forward; an instruction the launch carries goes
     through the same delivery as a new session's. A managed launch never attaches: its admission
     minted a new session identity, and an entry set to *use an open session only* is `refused` for it;
   - **spawn**, when the entry allows it.

   A candidate that fails a step is passed over with the contract's probe result (`not-catalogued`,
   `not-installed`, `not-responding`, `not-connected`, `no-held-session`, `refused`). The walk walks
   only the list: never the rest of the catalogue, never a plain shell.
4. **Three failure classes, as the contract states them, as types** (`pty.ts`). Candidate-unavailable —
   `RunnerUnavailable` (not available on this machine, its surface is down) and `SpawnFailure` (a spawn
   that threw, so nothing started) — moves to the next. Request-invalid — `LaunchAuthorityChanged`, raised
   before the spawn and outside its catch, a `LaunchRefusedBeforeSpawn` to the managed launch — stops the
   walk with the launch's own error. Outcome-unknown — `PtyLaunchFailure`, a process may be alive — stops
   and is never retried on another runner. On the managed path a failure fails the launch, because the
   task was created with the selected runner and a second runner under one admission is a second claim
   on it. The ad-hoc loop is `openWithFallback` (`runnerFallback.ts`); every pass excludes a runner or a
   vanished session, so it ends.
5. **Unattended launches stay where ADR-0119 put them.** A routine or chain uses the runner it names. Only
   Claude Code has a quota basis today, so a fallback order for an unattended launch would pass over every
   other runner as `quota-unknown`; the routine's Claude gate therefore stays before the start, and the
   walk is not offered to routines and chains until AS-09 gives another runner a quota basis.
6. **What is recorded.** A launch that walked the list and spawned records the walk in
   `terminal.opened@1`, additively: `route: { basis: 'host-order', requested: 'fallback-order',
   selected_index, session: 'spawned', probes: [{ index, runner, result, detail? }] }` — every candidate
   above the selected one, in order, named as DEC-0029's event names them. An attach opens nothing, so
   it adds no `terminal.opened@1`; it is an operations-log line `runner.fallback-attached`, and the
   person sees which session answered. An exhausted walk opens nothing and so
   records no estate fact: the person is answered with every candidate and the reason it was passed over,
   and the ops log keeps the same. `permission_mode` in `terminal.opened@1` becomes the mode the runner
   actually received — `null` for a runner without modes — instead of the mode that was asked for
   (the A6-006 class this review found again).
7. **Kimi Code becomes a catalogue row, unconnected until probed.** `kimi-code` (the contract's shared
   kind name), program `kimi`, run as itself in the project directory — its TUI — with modes *plan*
   (`--plan`), *ask* (no flag) and *bypass* (`--auto`, which never asks; `--auto` joins the named
   `BYPASS_FLAGS`). *Ask* passes no flag, so it is a gate only while Kimi's own `config.toml` does not set
   a looser default — the risk that made ADR-0119 configure Kilo through its config variable; it is
   recorded here, not removed. Its installer puts `kimi` in `~/.kimi-code/bin`, which the probe PATH now
   includes when the folder exists. It does not connect to the surface until its ACP session (`kimi acp`) is probed
   through Fabric's ACP shell, the way ADR-0119 brought Hermes in. Its result channel is `none`, so it is
   not a fallback for a task that reports on the surface.
8. **Sticky by construction.** A walk happens at a launch; a running session never changes runner.

## What the first proposal got wrong

The proposal of 2026-10-07 resolved inside `PtyManager.open`, below the routine's quota gate, so a
Claude quota pause could never reach Hermes; it put `projects.default_agent` (never empty, default
`claude-code`) first, which made the Settings list unreachable and overrode the person's own pick; it
appended "the remaining available catalogue rows", which reaches `shell` and runners without the
surface; it attached managed launches to existing sessions, which their admission forbids; it left the
failure classes undefined; it planned journal events with no migration or ingress owner and without the
contract's reason and run fields; and it named AS-09 for probes (AS-06 is probes; AS-09 is quota-less
routines). DEC-0029 in the contract closed the matching gaps on the contract side.

## Not decided here

The project-pinned contract route and its `runner.selected@1` / `runner.switched@1` journal events (they
need the contract repin, a migration and an ingress owner); foreign-session attach (tmux, Terminal.app);
the owned-backend and CEO-session entry points, which call the same walk when they are wired; the other
hard-coded `'claude-code'` defaults (`runtimeObserver.ts#capabilitiesFor`, `index.ts` (the liveness capabilities, the first-run list — now built from the catalogue — and an import default),
`workspace.ts#importWorkspace`, `onboardingDraft.ts#EMPTY_DRAFT`, the `default_agent` column default); Fabric Dashboards'
console and Fabric Switchboard's chains, which keep their own lists until each adopts the contract
route (their backlogs carry the rows).

## Consequences

- **Modules:** `shared/runnerRoute.ts` (the walk, `FALLBACK_OPTION`), `main/runnerFallback.ts` (probes
  through first-run detection, the attach lookup, a 30-second measurement shared by preview and launch),
  `shared/appSettings.ts` and `shared/types.ts` (`runnerFallback`), `main/index.ts` (`terminalOpen`,
  `tasks.start`, `terminal.fallback`, `prepare` carrying the walk, the first-run list built from the
  catalogue instead of a copy of it), `main/pty.ts` (`runnerKind` on a live session, `attachable`, the
  additive `terminal.opened@1` `route`, the applied mode), `shared/agents.ts` and `shared/containment.ts`
  (`kimi-code`, `--auto`), `renderer/src/FallbackOrderSetting.tsx`, `renderer/src/useFallbackChoice.ts`
  and the two pickers (`Tasks.tsx`, `ProjectHome.tsx`). Tests: `shared/runnerRoute.test.ts`,
  `shared/appSettings.test.ts`, `renderer/src/FallbackOrderSetting.test.tsx`. Scenario: SCN-135.
- **Registers:** CO-223 stays open for the contract route; this decision is its first shipped step.
  ADR-0119 stays the runner-row authority, ADR-0123 the conversation authority.
- **Vision check** (`docs/ux/vision.md` §9): principle 2 — the agent serving a conversation may change
  without the Project losing its purpose, history or evidence; the console stays the runtime's own.
