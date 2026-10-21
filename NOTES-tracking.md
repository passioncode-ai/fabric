# Fabric 0.3.9 "the core holds": the tracking branch (agent/core-tr)

Scope: TR-1, TR-2, TR-3, TR-4, TR-5, TR-6, TR-7, TR-11 (Fabric's part) and TR-14 (through TR-6) of
[the tracking audit](docs/evidence/plans/2026-10-21-core-reliability/tracking.md). Every new code region carries
`docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking`. No migration, no new event type, no
edit to `index.ts`, hub startup, `boardService.ts` or the `com.*` tools.

## Changes

| Finding | What changed | Where |
|---|---|---|
| TR-1 | The agent's own fabric-mcp enrolls with `agentPid` (its parent, the coding agent: the bin script execs) and, for Claude Code, with the runtime id the agent has NOW, read at each enrollment from Claude Code's `<config>/sessions/<pid>.json` (only `*.json`, bounded 64 KB, a record whose `pid` is not its file name is not believed; `*.key` files are never opened). A `--rejoin-only` fabric-mcp finds the claude pid of its runtime id in the same files and sends it. | `fabricMcp.ts#claudeSessionsDir`, `#claudeSessionOfPid`, `#claudePidOfSession`, `#agentPidOf`, `FabricMcpProxy#attempt`; `fabricMcpMain.ts` region `fabric-mcp-agent-process` |
| TR-1 | `fabric.session.enroll` takes `agentPid` (integer >= 2). A rejoin whose runtime id finds no session falls back to the live session of the same binding and project enrolled with that agent pid, renames it to the new runtime id (ops line `hub.session.runtime-renamed`) and drops the rejoin bearer minted for the old id. Board sessions are never matched. | `hubTools.ts` (schema), `sessionEnroll.ts#EnrolledSessions.ofAgentPid`, `#renameRuntime`, `enrollSessionOnce` |
| TR-1 | The surface records the rename: a rejoin minted under a new runtime id updates the session's runtime id. `fabric_session_observe` accepts the session's current (renamed) runtime id as well as the one its bearer was minted with. An end with reason `clear` does not end the session (`code: session-kept`): /clear keeps the agent process and its fabric-mcp. | `agentSurface.ts#mint`, `workTools.ts` (`fabric_session_observe`) |
| TR-2 | An end (observe `end`, or `fabric_work_release {claims: "session"}`) observed more than 5 s before the session (re)enrolled is refused, `code: stale-end`; the release takes an optional `observedAt`. A rejoin's end or session-wide release while the agent's own fabric-mcp signed within 5 minutes is refused, `code: agent-still-connected` (its own fabric-mcp's leave ends the session and releases the claims when the agent goes). | `workTools.ts#endRefusal`, `#STALE_END_TOLERANCE_MS`; `agentSurface.ts` (`touched(scope, own)`, `lastOwnCallAt`, `OWN_CLIENT_LIVE_MS`, work deps `sessionStartedAt`, `currentRuntimeSessionId`, `ownClientLive`, `serverFor(scope, rejoin)`) |
| TR-3 | A claim moves its backlog task to running, read back; the answer carries `task_moved_to: "running"` or `task_not_moved` with the reason. A `done` release moves a backlog task through running to review (the ladder is unchanged); a move that cannot happen or did not land answers `code: task-not-moved` with the reason, never a silent success. A closed task still moves nothing and fails nothing. | `workTools.ts#moveClaimedTaskToRunning`, `#moveDoneTaskToReview` (now `move(task, to)`), `fabric_work_claim` |
| TR-4 | A connected fabric-mcp pings its session every 2 minutes (`SIGN_EVERY_MS`); a successful call counts as a sign too; nothing is logged for a sign that went through. Every request on a session (a ping, a hook's turn through a rejoin) was already a sign in `touched()` and renews the session's claims every 5 minutes; the 10-minute silence rule is unchanged. | `fabricMcp.ts#keepAlive`, `#SIGN_EVERY_MS`; `fabricMcpClient.ts#openSessionLink` (`ping`) |
| TR-5 | While connected, every pass of the run loop (2 s) re-reads hub.json: a hub that is gone or has another pid or origin drops the dead session and enrolls again at once. A ping refused as gone (401, 403, 404, a connection never made) drops it too; a ping that failed in the client keeps it. | `fabricMcp.ts#keepAlive`, `#attempt` |
| TR-6 | `fabric_agents_list` lists every session of the project, the terminals Fabric runs and the agents enrolled through fabric-mcp (the set `fabric_work_list` reads), each with `came_in`; an enrolled one's `observed.state` is `active` or `silent` from its signs, `observed.by` says which. A manager that cannot answer is still "no report" (`sessions: null`). | `agentSurface.ts` region `agents-list-every-session` |
| TR-14 | A stage report is shown only beside a session still held (follows from TR-6). The home already filtered ended sessions (`homeLive.ts#composeHome`, DA-9). | same |
| TR-7 | Each agent-sync lease ref's commit body is read locally (`git log -1 --format=%B <sha>` through the hardened `gitRun`, eight at a time, nothing fetched) and classified by agent-sync's own rule `ts + ttl`: `live` with `expiresAt`, `expired`, or `unknown` (object not local, or not a lease). `fabric_work_list`, `fabric_leases_list` and the screens' `leasesView` list live and unknown leases and only count the expired (`expired`). | `agentSyncLeases.ts#leaseBodyOf`, `#leaseLife`, `#currentLeases`, `#LEASE_BODY_READS_AT_ONCE`; `workRead.ts#leasesView`; `shared/workClaims.ts` (`LeaseRef.state`, `expiresAt`, `WorkLeasesView.expired`) |
| TR-11 | A `--rejoin-only` fabric-mcp that finds no session asks once and exits with code 3 (stderr `fabric-mcp: not-enrolled; this rejoin ends`) instead of retrying every 30 s until the hook's deadline. | `fabricMcp.ts#run` (`onFinal`), `fabricMcpMain.ts` |

## Tests, each watched failing against the old behaviour

Run the old code against the new tests (the old source of the changed file restored, or before the implementation):

| Test | Failed before | Passes now |
|---|---|---|
| `test/fabric-mcp.test.mjs` (8 new: TR-1 x3, TR-4, TR-5 x3, TR-11) | 8 of 61 failed (TR-11 bounded to 5 passes so the old endless loop is an assertion, not a hang) | 61/61 |
| `test/session-enroll.test.mjs` (3 new, TR-1) | 2 of 40 failed (the third, "never matched", holds on old code too) | 40/40 |
| `test/session-observe-wire.test.mjs` (5 new, TR-1, TR-2) | 5 of 9 failed | 9/9 |
| `test/work-release-session.test.mjs` (4 new, TR-3) | 4 of 14 failed | 14/14 |
| `test/agent-sync-leases.test.mjs` (3 new, TR-7) | 3 of 8 failed | 8/8 |
| `test/hub-surface.test.mjs` (1 new, TR-1 schema) | 1 of 15 failed with `hubTools.ts` at HEAD | 15/15 |
| `test/tracking-surface.test.mjs` (new file, real AgentSurface over HTTP, no database: TR-6 x2, TR-1, TR-2 x2) | 5 of 5 failed with `agentSurface.ts` at HEAD | 5/5 |

Also green: `session-enroll-request`, `board-surface`, `work-read-views`, `board-tool-schemas`, `tool-trace`,
`hub-locator`; `pnpm -C apps/desktop typecheck`; `node scripts/check-regions.mjs`, `check-ops.mjs`,
`check-list-reads.mjs`, `check-probes.mjs`, `check-scope.mjs`, `check-commands.mjs`, `check-written-never-read.mjs`,
`check-actor.mjs`, `check-references.mjs`, `check-obligations.mjs`, `check-unread-boundary.mjs`, `check-checker.mjs`,
`check-ipc-contract.mjs`, `check-hooks.mjs`; `electron-vite build`. DB-backed: see "Disposable stack" below.
`tracking-surface.test.mjs` is added to `apps/desktop/package.json` `test`.

## Migrations and event types

None. TR-3 reuses `task.moved@1` (its projector arm applies any `to`; the ladder check stays in the application,
`mayMove('agent', ...)`), so no `event_types` row and no feed sentence are needed.

## Strings an agent reads (English only; no operator-facing UI string was added)

No renderer string changed, so there is no Russian copy to add. Agent-facing answers added (no U+2014):

- `stale-end`: "this end was observed at <t>, before this session enrolled (<t>): it belongs to an earlier process of the same coding-agent session. This session goes on, with its claims"
- `agent-still-connected`: "the coding agent's own fabric-mcp is still connected and signing, so the agent has not ended; when it does, its fabric-mcp ends this session and releases its claims"
- `session-kept`: "/clear keeps the agent process and its fabric-mcp, so this Fabric session goes on under the new runtime id"
- `task_not_moved` on a claim: "the claim stands, but its task did not move to running (<why>); read fabric_tasks_list"
- `fabric.session.enroll` `agentPid` and `fabric_work_release` `observedAt` field descriptions.
- `fabric_agents_list` `observed.by`: "its terminal in Fabric" / "its calls and signs to Fabric"; `claims_unreadable` when the stage reports cannot be read.

A screen that wants to show the expired lease count can read `WorkLeasesView.expired` (optional); it would need an
en and ru string then.

## Docs the integrator must update

- `docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking` is the docs anchor of every new region; it should
  say what landed per finding (the table above) and what stays open.
- ADR-0134 amendments (`docs/adr/0134-...md#amendments`): enrollment and rejoin carry `agentPid`; a rejoin is matched by
  the agent process when its runtime id changed, and renames the session; the agent's fabric-mcp signs every 2 minutes
  and drops a session whose hub restarted; a rejoin that finds nothing exits 3.
- `docs/architecture/*` / `CONTEXT.md` if they describe session liveness ("a sign" now includes fabric-mcp's ping and
  hook turns), the end guards (`stale-end`, `agent-still-connected`, `session-kept`), and the claim moving its task.
- `docs/ux/scenarios.md` SCN-140 (claim moves the task to running; done goes through running to review) and SCN-141
  (agents list shows enrolled sessions; expired agent-sync leases counted, not listed).
- AGENTS.md lifecycle table, row `fabric-mcp`: it now also pings its session every 2 minutes while connected and reads
  hub.json every 2 s (already its connected pass); a `--rejoin-only` one exits 3 when it finds no session.
- The design map (`docs/reports/map.html`) changelog entry and `docs/MERGES.md` for the landing.

## What I could not do, and why

- **The adapter half (fabric-agent-adapter, another repository).** `fabric_session.py#deliver` should pass
  `observedAt` to its session-wide `fabric_work_release` (Fabric accepts it now), skip that release for reason
  `clear`, drop a spooled `end` when a SessionStart with source `resume` arrives for the same id, label a rejoin that
  found no session (`not-enrolled`, now exit 3 from fabric-mcp) and not retry it every turn (TR-11's main half).
  Fabric's guards cover the release without `observedAt` only while the agent's own fabric-mcp signs (0.3.9 children).
- **Old fabric-mcp children.** A fabric-mcp started before 0.3.9 neither pings nor sends `agentPid`, so its session
  is not renamed on /clear and the `agent-still-connected` guard does not see it. Each agent picks the new code up
  when its fabric-mcp restarts (the agent restarts).
- **The agent pid assumption.** `agentPid = process.ppid` holds because the bin script `exec`s and Claude Code starts
  the MCP server directly (the audit's pid pairs agree). A host that wraps it in a non-exec shell would send the
  shell's pid and the rename would not match; nothing else breaks.
- **TR-4's "idle in Claude" display** (reading Claude Code's `status`) and **TR-13** (journalling an enrolled
  session's exit) were not asked for here and are not done.
- **TR-3 one-off:** the 8 tasks already released `done` and still in backlog are not moved by this change; the
  operator moves them (list in the audit).

## Disposable stack

`node scripts/test-stack.mjs run -- sh -c 'cd apps/desktop && node --experimental-strip-types test/work-claims-db.test.mjs && node test/agent-surface.test.mjs'`
on a disposable stack (`fabric_test_ab8ddda0`, removed at the end; never the live ports): exit 0, 145 `ok` lines and no
`FAIL` across both probes (claims, releases, observations and agent-sync leases through real MCP clients; the agent
surface, including `fabric_agents_list`'s observation and claim fields and its "no report" answer).
