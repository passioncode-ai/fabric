# Fabric 0.3.9 "the core holds": tracking fixes after review iteration 1 (agent/core-tr2)

Scope: PL-2, UX-3, DA-1 (TR-13), UX-9, DA-6 and DA-7 of the iteration-1 review (`2026-10-21-plan.md`, `-ux.md`,
`-data.md`). Base: candidate `8100be6b`. Every new code region carries
`docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking`. No migration and no new event type: DA-1
reuses `session.ended@1`, DA-6 reuses `task.moved@1`; both have their `event_types` rows and feed sentences already.
Not touched: `index.ts`, the hub standby, `stackWatch`, `boardService.ts`, the home board panel.

## Changes

| Finding | What changed | Where |
|---|---|---|
| PL-2 | An enrollment offers `agentPid` only while the hub takes it. A refusal that is the hub's input schema refusing `agentPid` (MCP -32602 "Invalid arguments ... Unrecognized key", answered as an error result or raised as an `McpError`) is answered by sending the same call once more without it; that hub (origin and pid) is remembered, so its next enrollments and rejoins go without it at once, and one stderr line says so. A new hub pid (Fabric restarted) is offered `agentPid` again. Any other refusal is passed on unchanged. The hub client now carries an error result's text (`HubCall` result `text`) when the result has no structured answer. | `fabricMcp.ts#FabricMcpProxy.enroll` (region `fabric-mcp-old-hub`), `#refusesArgument`; `fabricMcpClient.ts#makeHubCall` |
| UX-3 | The transport reads the body of a 429, or of a 503 with Retry-After, bounded (4 KB, 2 s), and keeps only the hub's `code` (in its own shape) and its one-line reason (300 characters, control characters removed); anything else gives nothing and the wait still holds. `FabricRateLimitError` carries them (`hubCode`, `hubReason`) and says them in its message. The agent is told them in all three places: the cooldown answer ("Fabric asked to wait: Fabric is starting and its database is not ready yet. ... (stack-starting); wait N seconds. No new request was sent."), `fabric_whoami` after a failed pass ("Fabric answered, and asked to wait: ..." instead of "Fabric could not be reached"), and a call refused under a live session ("HTTP 503: <reason> (stack-unavailable)" and the seconds to wait, instead of "no reason given"). The cooldown and the kept session are unchanged. | `fabricMcpClient.ts#refusalSaid` (region `fabric-mcp-refusal-body`), `#httpTransport`; `fabricMcp.ts#hubRefusalOf`, `#sayHubRefusal` (region `fabric-mcp-hub-refusal`), `#hubSaidOf`, `#FabricRateLimitError`, `#classifyFailure`, `FabricMcpProxy#call`, `#waitingAnswer`, `#connectOnce` |
| DA-1 (TR-13) | When the agent's own fabric-mcp leaves an enrolled session (its HTTP session's DELETE: the agent closed fabric-mcp's stdin, or exited), Fabric journals `session.ended@1` with `observed_by: fabric`, `reason: agent-left`, the session and runtime ids and the time, no git facts, then ends the session as before (claims released through `onSessionEnded`). One end per session: whichever of the hook's end and the agent's leave comes first records it (an in-memory record per run, bounded at 4096); a hook end after that answers `already-ended`, and a hook end that failed to write gives the record back for its retry or for the leave. A rejoin's leave and a board session's leave record nothing. The record is awaited by `stop()`; a failure to write it is an ops line (`agentSurface.session-left-record`) and the session still ends. | `agentSurface.ts#recordAgentLeft`, `#claimEndRecord` (region `surface-session-left-record`), `#leave`; `workTools.ts` (`fabric_session_observe`; deps `claimEndRecord`, `releaseEndRecord`) |
| UX-9 | `fabric_session_observe` says a renamed runtime id is accepted and names the three ends that do not end the session (reason `clear` / `session-kept`, `stale-end`, `agent-still-connected`) and `already-ended`; `fabric_work_claim` says a claim moves its task from backlog to running and that fabric-mcp's sign renews it; `fabric_work_release` says done moves the task to review (through running from backlog) and let-go or handed-over takes a task the claim moved to running back to backlog. No U+2014 in the three descriptions. The `stale-end` reason ends with a full stop. | `workTools.ts` (the three descriptions, `#endRefusal`) |
| DA-6 | A claim's move to running names its claim (`task.moved@1` payload `claim_id`). A release other than done (let-go, handed-over, the hooks' `claims: "session"` let-go, a session's end and the app's quit through `releaseSessionClaims`) takes the task back to backlog when it is still in running and its last move is that claim's move there; a move since (the operator, another claim, a run) wins. Read back; a move that did not land is said to the agent (`task-not-moved`, or `tasks_not_moved_back` for a session-wide release) and, for a session end, recorded as an ops line (`work.session-end-task-back`) without stopping the other releases. Claim renewal by fabric-mcp's ping (DA-6's first half) is the documented intent and is kept. | `workRelease.ts#returnClaimedTaskToBacklog`, `#lastTaskMove`, `#releaseSessionClaims` (region `work-release-returns-task`); `workTools.ts` (`fabric_work_claim` move payload, `fabric_work_release`) |
| DA-7 | No code change; the wording is the integrator's (below). | |

## Tests, each written first and watched failing against the candidate

| Test | Failed on the candidate | Passes now |
|---|---|---|
| `test/fabric-mcp.test.mjs` PL-2 x3: a real MCP server with the 0.3.8 `.strict()` enroll schema (`git show v0.3.8:apps/desktop/src/main/hubTools.ts`, :163 to :169), reached through the real `makeHubCall` over the SDK's in-memory transport | 2 of 3 (the enrollment ended `failed`, the rejoin `not-enrolled`). The third (a refusal naming another argument is not retried) holds on the candidate too; it guards the retry from widening | 3/3 |
| `test/fabric-mcp.test.mjs` UX-3 x3: the standby's real body through the real `makeHubCall` with `fetch` replaced, an oversized body, and the proxy's three answers | 3 of 3 | 3/3 |
| `test/tracking-surface.test.mjs` DA-1 x2: the real AgentSurface over HTTP with a recording journal; the own client's `terminateSession()` | 1 of 2 (0 ends recorded, 1 expected). "No double record" holds on the candidate trivially (it recorded nothing) and guards the fix | 2/2 |
| `test/tracking-surface.test.mjs` UX-9: descriptions read through `listTools`, and the stale-end full stop | 1 of 1 | 1/1 |
| `test/work-release-session.test.mjs` DA-6 x3 (the helper, and the source wiring) | 3 of 3 | 3/3 |
| `test/work-claims-db.test.mjs` DA-6 x2 (disposable stack: a session end and a session-wide let-go take their tasks back to backlog) | 2 of 2 on the candidate's `workRelease.ts` and `workTools.ts` (tasks read `running`; exit 1, no other `FAIL`) | 2/2 |

Totals: `fabric-mcp` 67/67, `tracking-surface` 8/8, `work-release-session` 17/17. Also green: `session-enroll` 40,
`session-enroll-request` 16, `session-observe-wire` 9, `hub-surface` 15, `board-surface` 10, `board-tool-schemas` 3,
`tool-trace` 1, `hub-locator` 8, `work-read-views` 2, `agent-sync-leases` 8, `ingress-owners` 2, `hub-standby` 5;
`pnpm -C apps/desktop typecheck` exit 0; `node scripts/check-regions.mjs` (517 markers), `check-ops.mjs` (493 catch
blocks each recording or explaining), `check-list-reads.mjs`, `check-probes.mjs`, `check-written-never-read.mjs`,
`check-unread-boundary.mjs`, `check-actor.mjs`, `check-references.mjs`, `bash scripts/check-docs.sh`: exit 0. `desktopIngress.ts`'s owner line for `session.ended@1` names the new writer (`desktop-ingress`, `ingress-owners` green).

Disposable stack (never the live ports): `node scripts/test-stack.mjs run -- sh -c 'cd apps/desktop && node
--experimental-strip-types test/work-claims-db.test.mjs && node test/agent-surface.test.mjs'` with the fixes, before the
two DA-6 DB checks were added: exit 0, 145 `ok`, no `FAIL`.
Then with the two DA-6 checks added, same command: exit 0, 147 `ok`, no `FAIL`.

## Docs the integrator must update

- `CHANGELOG.md` (0.3.9): fabric-mcp works against a running older Fabric (it enrolls without `agentPid` when the hub
  refuses it), so installing the bundle before Fabric restarts no longer stops enrollments and hook rejoins; agents
  connected through fabric-mcp are told the hub's `stack-starting` / `stack-unavailable` with its reason (the lines
  "agents are told `stack-unavailable`" and "Agents get a 503 `stack-starting`" are now true through fabric-mcp too);
  an enrolled session's end is journalled when its agent's fabric-mcp leaves (`observed_by: fabric`, `agent-left`);
  a claim released other than done takes the task it moved to running back to backlog.
- DA-7, the wording of "keeps its identity ... after Fabric restarts" (`CHANGELOG.md`, plan `README.md` Tracking):
  after a Fabric restart the agent's fabric-mcp enrolls again by itself at once, but Fabric gives it a NEW session id
  (`sessionEnroll.ts#enrollSessionOnce`, `randomUUID()`), and its earlier claims were released at quit (`app-quit`,
  `workRelease.ts#releaseSessionClaims`); with DA-6 their tasks went back to backlog. What holds across a restart is
  the runtime id and the agent process, not the Fabric session. Say "rejoins by itself right after a Fabric restart,
  as a new Fabric session; its claims were released at quit and their tasks are back in backlog".
- Plan `README.md`: TR-13 moves from "stays with TR-11's record" into "What landed" (DA-1 above); add PL-2, UX-3 and
  DA-6 to the Tracking paragraph; the adapter half of TR-11 stays in "Not in this release" (CO-371).
- ADR-0134 amendments: an enrollment offers `agentPid` only while the hub takes it (fallback without it, per hub
  pid); an enrolled session's end is recorded by Fabric when the agent's own fabric-mcp leaves, once per session, and
  the hook's later end answers `already-ended`.
- `docs/ux/scenarios.md` SCN-140: a let-go, a handover, a session end and the app's quit take a task the claim moved to
  running back to backlog, unless it moved since.
- `AGENTS.md` lifecycle row `fabric-mcp`: cadence unchanged; it reads at most 4 KB (2 s) of a refusal body.
- `AGENTS.md:158` and the ADR-0115 amendment on `stack-starting`: now hold for fabric-mcp clients as well.
- The upgrade note PL-2 asked for ("install, then restart Fabric soon") becomes advice, not a requirement: the old hub
  serves enrollments without TR-1's rename-by-pid until Fabric restarts.
- Carry-over ledger: a fabric-mcp killed without leaving (SIGKILL, a crash) still leaves its session open, with no end
  recorded, until the cap or the silence rule; Fabric could probe `agentPid` (not done here).
- The design map (`docs/reports/map.html`) changelog entry and `docs/MERGES.md` for the landing.

## Not done, and why

- A fabric-mcp that dies without leaving records no end: Fabric sees only silence. Probing the agent's pid is a new
  liveness rule, outside these findings.
- Other em dashes in `workTools.ts` (the `fabric_work_list` description, the related-work warning, the file header)
  are outside UX-9's three tools and are left as they are.
- DA-6's first half (pings renew claims, so an idle connected agent's claim never lapses) is the documented intent and
  was not changed.
