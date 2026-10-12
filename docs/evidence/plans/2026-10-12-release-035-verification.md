# Release verification — Fabric 0.3.5, Windows and Linux, agents in your terminal, who works on what: three independent iterations

Run `2026-10-12-release-035-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release):
before the release, three independent testing iterations across every level of the project, every finding fixed,
and only then the release. This file is the ledger for **Fabric 0.3.5**: everything on `main` since v0.3.4 —
Windows and Linux (CO-238), a coding agent opened in any terminal enrolling into a project through `fabric-mcp`
([ADR-0134](../../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)), claims with
«Who is working» and «Where work is» (REQ-38), the operator's board (COM-06/07), `fabric://` links (SCN-142) and
the bug-fix wave of 2026-10-12 ([handoff](../../handoffs/2026-10-12-release-035-fix-wave.md)). Schema 79 → 84.
The operator decided on 2026-10-12 that this ships as 0.3.5; 0.4.0 stays the agents-first plan
([plan](2026-10-11-release-040-agents-first.md)).

## Protocol

The protocol is 0.3.4's, unchanged ([0.3.4 ledger, Protocol](2026-10-10-release-034-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.5/iteration-N/`.
## Iteration 1

Five fresh reviewers, 2026-10-12, against `895302f1` (`895302f19c7f3a132f043c23a9e1f7a5662c99d0`, `main` after the bug-fix wave and the workspace pin), read-only in a detached checkout. Reports (committed as written, machine paths replaced):
[scenarios/UX/UI](../reviews/0.3.5/iteration-1/2026-10-12-ux.md) (UX-n, 3 blocking + 12),
[errors and boundaries](../reviews/0.3.5/iteration-1/2026-10-12-errors.md) (ER-n, 2 blocking + 8),
[code ↔ documents](../reviews/0.3.5/iteration-1/2026-10-12-docs.md) (DO-n, 2 blocking + 17),
[data, memory, orchestration, harness](../reviews/0.3.5/iteration-1/2026-10-12-data.md) (DA-n, 1 blocking + 9),
[plan and roadmap](../reviews/0.3.5/iteration-1/2026-10-12-plan.md) (PL-n, 5 blocking + 8).

67 findings, 13 blocking (the data reviewer's DA-0, the untested upgrade, counted as a gate). Every *watched* fix had its test run with the defect planted back and seen failing. The Windows fixes are proven on macOS by their built command lines (CO-267). Fixes landed on `agent/rv1-fixes` (renderer: `agent/rv1-ux` `002fe183`; main process: `agent/rv1-main` `e6e293c6`; docs, plan and data rows in the same branch).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 (blocking) | Comms «Earlier» silently skips messages and then says "The beginning of the thread." The initial page is read from initialAfter = lastSeq − 50, but the cursor for older pages, earliestAfter, starts at 0 and is never set  | fixed: `CommsScreen.tsx#ThreadView` starts Earlier at the first page's cursor, bounded by the thread's first message; `CommsScreen.test.tsx` 120-message walk (watched: start cursor removed → 1 failed) |
| V1-2 | UX-2 (blocking) | Windows and Linux startup failures give macOS-only fixes, and the release notes omit a Windows requirement. | fixed: `startupFailure.ts#forPlatform` gives Windows and Linux their own remedies (`.win32`/`.linux` keys, en/ru); `startupFailure.test.ts` holds every Windows/Linux dialog free of brew, Homebrew, OrbStack, DMG and Mac (watched: no per-OS remedy → 8 failed); CHANGELOG names the Supabase CLI for Windows |
| V1-3 | UX-3 (blocking) | «Open session» on a live agent opened in a terminal shows a window that says "This session is gone." SCR-31's row action (and every session row in «Where work is») calls windows.openSession(sessionId). | fixed: `console` on `WorkSessionView`/`WorkClaimView` (`workRead.ts#consolesOf`); Open only for a console Fabric holds, otherwise "runs in a terminal outside Fabric"; `WhoIsWorking.test.tsx`, `test/work-read-views.test.mjs` (watched: Open shown regardless → 1 failed); the session window's wording is CO-268 |
| V1-4 | UX-4 | "Nobody is working in this project right now" can be said while a session works there. | fixed: `WhoIsWorking.tsx` lists sessions without a claim; "nobody" only with none; SCR-31 updated (watched: 1 failed) |
| V1-5 | UX-5 | The agent-sync lease line repeats its own prefix, shows English in Russian, and looks like a failure on most projects. | fixed: `agentSyncLeases.ts` asks only a repository with `.claude/agent-sync.json`; reason codes translated; no repeated prefix; `test/agent-sync-leases.test.mjs` (watched: 4 plants caught) |
| V1-6 | UX-6 | On Windows, Agent access → Connect starts a consent that cannot finish. | fixed: `observatoryVault.ts#unavailable` on win32; `productConnect.ts#begin` refuses `vault-unavailable` before the product opens; `hub-products.test.mjs` (watched: 1 failed); off-host proof is CO-267 |
| V1-7 | UX-7 | On Windows and Linux the sign-in line blames the agent's version. | fixed: `executorAuth.ts` returns `unsupported-os` on Windows and Linux, with its own string (watched: 1 failed) |
| V1-8 | UX-8 | "Run the command below" when there is no command. | fixed: no-command variants in FirstRun and BuilderFixes (watched: 2 plants caught); the missing vendor links are CO-268 |
| V1-9 | UX-9 | Windows paths are split on "/" only. | fixed: `startParts.tsx#programOf` splits on both separators and drops the extension (watched: old split → 2 failed) |
| V1-10 | UX-10 | Raw English machine errors reach the screen, Russian locale included. | fixed: `OperatorError.tsx#MachineDetail` — our sentence with the machine's words on a second line, on Comms, both work screens and the quota panel; `quotaReading.ts` strips the IPC wrapper (watched: 5 plants caught) |
| V1-11 | UX-11 | Comms shows message ids where the scenario promises words. | fixed: thread heading by subject or first words; a reply names the answered message by sender and first words, else "an earlier message" (watched: 2 plants caught); an unread first message is CO-268 |
| V1-12 | UX-12 | Russian does not match English in two places. | fixed: ru «пространства»; `accessWords.ts#projectWords` carries its own preposition (watched: 2 plants caught) |
| V1-13 | UX-13 | No plural forms in two new English strings. | fixed: "messages: {count}" and "More projects with nothing in flight: {count}" (watched: 1 failed) |
| V1-14 | UX-14 | A fabric:// link can be lost, or explained with the wrong reason. | fixed: `linkRoute.ts#resolveLink` — a failed read is `link-unreadable`, never an empty list; `linkArrival.ts#releaseLink` `first-run-left` offers a held link when the first run is left by any route (watched: 4 and 3 failed) |
| V1-15 | UX-15 | First-run Continue reads "Continue without an agent" while agents are still being checked. | fixed: FirstRun shows plain Continue while agents are read (watched: 1 failed) |
| V1-16 | ER-1 (blocking) | A fabric:// link whose project read fails tells the person the project does not exist, and tells them to add it. | fixed with UX-14: `linkRoute.ts#resolveLink` and `index.ts` region `fabric-link-handler`; `linkRoute.test.ts` (watched: 4 failed) |
| V1-17 | ER-2 | On macOS, a link that arrives while Fabric runs with no window opens nothing until the person clicks the Dock icon. | fixed: `linkRoute.ts#linkWindowPlan` opens a window for a link that finds none (macOS after the last window, `--background`, a second instance); `background-launch.test.mjs` |
| V1-18 | ER-3 (blocking) | The Windows quit reaper force-kills whatever process holds Fabric's old PID 15 s later, even after a clean quit. | fixed: `platform.ts#quitReaperInvocation` — POSIX checks the pid's start time and command before `kill -9`; Windows filters `taskkill` by Fabric's image name; `quit.test.mjs` real process that becomes another program survives (watched: 1 failed); the Windows residue and the on-host proof are CO-267 |
| V1-19 | ER-4 | A non-forced Stop of a Windows terminal falls back to pty.kill('SIGTERM'), which node-pty rejects by design, so the stop cannot succeed through that path. | fixed: `platform.ts#stopWindowsTree` (graceful `/T`, then `/T /F`, then closing the PTY with no signal), `#killPty`; `platform.test.mjs` (watched: 2 plants caught); on-host proof CO-267 |
| V1-20 | ER-5 | .cmd runners (npm shims such as codex.cmd, or claude.cmd from npm) are started as cmd.exe /d /s /c <file> <args> without the outer quote pair /s expects. | fixed: `platform.ts#cmdCommandLine` with the outer quote pair, refusing newlines and inner quotes; the brief goes by `--append-system-prompt-file` on Windows (`sessionBundle.ts`); `platform.test.mjs`, `session-bundle.test.mjs` (watched); on-host proof CO-267 |
| V1-21 | ER-6 | A Windows account name with a space disables the hub, and the door-token temp file is left on disk. | fixed: `protectedAclInvocation` accepts spaced names; `hub.ts#writeAtomic` removes the temp file on every path; `hub-files.test.mjs` (watched: 1 failed); on-host proof CO-267 |
| V1-22 | ER-7 | fabric-mcp keeps sending a binding credential to the hub origin it located once, for up to the 10-minute request window, without re-checking hub.json/pid. | fixed: `fabricMcp.ts#moved` re-reads hub.json and the pid before each credential, the request and every poll; `fabric-mcp.test.mjs` 2 new tests (watched: 2 failed) |
| V1-23 | ER-8 | fabric_work_release {claims: "session"} answers released: true from its appends, without reading the projection back. | fixed: `workTools.ts#releaseEveryOwnClaim` reads back and answers released/unconfirmed/partial; `test/work-release-session.test.mjs` (watched: no read-back → 3 failed) |
| V1-24 | ER-9 | A failed schema check loses its cause, and the remedy then names the wrong one. | fixed: `schemaReadiness.ts#SchemaUnverified` keeps a typed check (timeout, transport, backend-error, not-an-integer), with per-check remedies en/ru (watched) |
| V1-25 | ER-10 | The private-history panel shows "nothing pending" when the pending-operations read fails. | fixed: `PrivateHistoryPanel.tsx` keeps unknown as null and says which list could not be read, with Check again (watched: 1 failed) |
| V1-26 | DO-1 (blocking) | The README says Fabric is a macOS-only, DMG-only preview. | fixed: README says macOS, Windows and Linux with each install route, the `.deb` for `fabric-mcp`, Docker and the Supabase CLI on every OS |
| V1-27 | DO-2 (blocking) | The runbook's "What the installed app needs" still says Windows and Linux are not supported. | fixed: runbook *What the installed app needs* gains Windows and Linux from 0.3.5, with CO-244 and CO-245 |
| V1-28 | DO-3 | The runbook calls 0.3.5 "in development", and step 4's readback names only 79. | fixed: runbook "0.3.5 admits schema 84"; readback 84 for 0.3.5; the FROM comment names 79 for 0.3.2–0.3.4 |
| V1-29 | DO-4 | The CHANGELOG's Upgrading paragraph lists the steps without "install 0.3.5 and start it once". | fixed: CHANGELOG Upgrading — install 0.3.5 and start it once, quit, back up, rehearse, migrate, start again |
| V1-30 | DO-5 | Runbook step 6 says publish runs once macos has passed. | fixed: runbook step 6 names the windows and linux jobs, their smoke check, signing and notes, and `publish` waiting for all three |
| V1-31 | DO-6 | Runbook step 9 (website) covers the macOS asset only. | fixed: runbook step 9 says Windows and Linux are on GitHub Releases only until the site adds their patterns (404 read 2026-10-12) |
| V1-32 | DO-7 | Runbook step 1's ledger list stops at 0.3.3. | fixed: runbook step 1 lists the 0.3.4 and 0.3.5 ledgers |
| V1-33 | DO-8 | "Register Fabric once in Claude Code or Codex" gives only the Claude Code command. | fixed: the Codex registration beside Claude Code's in the CHANGELOG and README |
| V1-34 | DO-9 | fabric-mcp announces itself as version 0.4.0 in a 0.3.5 release. | fixed with PL-5: `shared/appVersion.ts`; `test/app-version.test.mjs` refuses a literal version in any MCP server or client in main (watched) |
| V1-35 | DO-10 | CONTEXT.md says an enrolled session is not listed until "0.4.0's wave 2". | fixed: CONTEXT.md *Enrollment* says where 0.3.5 lists an enrolled session and where it does not; CO-256 narrowed |
| V1-36 | DO-11 | CONTEXT.md's "Fabric button" says it opens the manager session in the person's coding agent. | fixed: CONTEXT.md *Fabric button* separates the target from what 0.3.5 does |
| V1-37 | DO-12 | CONTEXT.md says «Automations», «Cycles» and «Rhythm of work» are retired. | fixed: CONTEXT.md says the three labels are to be retired and still shown in 0.3.5 |
| V1-38 | DO-13 | ADR-0131 Amendment 1 says "0.4.0 revokes …0002". | fixed: ADR-0131 amendment 2 — the retirement ships in 0.3.5 |
| V1-39 | DO-14 | ADR-0119 Amendment 5 and ADR-0134 §6 say Codex and Kimi Code have no surface adapter and reach Fabric only through fabric-mcp. | fixed: ADR-0119 amendment 6 and ADR-0134 amendment 3 — Codex and Kimi Code connected by probe |
| V1-40 | DO-15 | ADR-0121 Amendment 3 says "Copies up to and including 0.3.4 still need one manual update". | fixed: ADR-0121 amendment 4 — copies up to 0.3.5 need one manual update |
| V1-41 | DO-16 | The CEO private-archive qualification record ends at schema 82 and says "83 refuses". | fixed: the archive's schema 83/84 qualification recorded (`run-ceo-private-archive-db.mjs` exit 0); the type derived from the admitted list |
| V1-42 | DO-17 | The README's owned-cluster counts are stale. | fixed: README counts — nineteen runners, six in the fast tier, fourteen in the full tier; `pnpm dev` no longer "macOS" |
| V1-43 | DO-18 | The general plan still names the in-flight release "Fabric 0.4.0" and has no row for 0.3.5. | fixed with PL-2: plan row P-17 for 0.3.5 |
| V1-44 | DO-19 | CO-251 is still open with a deadline of "before a Windows or Linux build is published". | ruled CO-251, deferred to 0.4.0 wave 7: nothing reads the tuple yet (N1), and the release jobs install and smoke-start each build natively |
| V1-45 | DA-0 (blocking) | No receipt in the candidate shows a 79 → 84 upgrade (dump, restore, supabase migration up --local, counts before and after). | fixed: `scripts/rehearse-upgrade.mjs` on the operator's dump (schema 79, journal 1917): PASS 79 → 84, journal 1917 → 1917, event_types 101 → 106; receipt beside the dump, mode 600, candidate `4b86e817` (migrations unchanged since) |
| V1-46 | DA-1 | When the holder claims its task again after its own lease expired, the new claim row is silently dropped, and the tool answers with a false refusal.<br>1. | ruled CO-264 (the claims' lifecycle; a second call recovers), 0.4.0 wave 3 |
| V1-47 | DA-2 | A takeover without a claim_id leaves the previous holder's claim live, so the screens and the claim tool name the wrong holder. | ruled CO-264, 0.4.0 wave 3 |
| V1-48 | DA-3 | After a crash or restart, live claims are orphaned, and "lapsed" means two different things. | ruled CO-264, 0.4.0 wave 3 |
| V1-49 | DA-4 | No test replays the new projections. | ruled CO-265 (a restore-and-compare probe) |
| V1-50 | DA-5 | Pre-91 grants stay valid in every project. | fixed: runbook *Upgrading* says pre-91 grants still serve every project and how to revoke |
| V1-51 | DA-6 | Wrong counts in migration headers. | not recoverable: the migration ledger freezes those header bytes; the real counts are in the runbook (79 + 5 = 84) and in this row |
| V1-52 | DA-7 | The backlog link journals an absolute folder path. | ruled CO-266, before archives are shared beyond their owner |
| V1-53 | DA-8 | The type union lags the runtime list. | fixed with DO-16: the archive type derived from `PRIVATE_ARCHIVE_LIMITS.sourceSchemas` |
| V1-54 | DA-9 | The work snapshot can be truncated without saying so. | ruled CO-265 |
| V1-55 | PL-1 (blocking) | The gate cannot clear: hosted CI fast fails on the candidate. | fixed: `schema-readiness.test.mjs` expects this OS's stack folder (`shared/stackFolder.ts`) and pins all three; reproduced with process.platform linux (old fails, new passes); hosted `ci` on the next candidate is the receipt |
| V1-56 | PL-2 (blocking) | The general development plan does not carry the 0.3.5 release. | fixed: P-17 row and Now line; P-12, P-13, P-16 re-dated; lane 2 delivers P-17 and CO-238 |
| V1-57 | PL-3 (blocking) | The 0.4.0 plan contradicts 0.3.5 and does not record the decision that split it. | fixed: the 0.4.0 plan's dated section *Decision, 2026-10-12* says what 0.3.5 ships and what 0.4.0 keeps |
| V1-58 | PL-4 (blocking) | The sources disagree on Windows signing, and the deferral has no ledger row and no operator question. | fixed: Windows signing switched on (passioncode-ai/.github #41, `AZURE_SIGNING_ENABLED` true in the release environment), as fabric-workspace platforms.md recorded; CHANGELOG and README say signed; an rc rehearsal proves it before the tag |
| V1-59 | PL-5 (blocking) | A 0.3.5 build reports itself as 0.4.0 over MCP. | fixed: `shared/appVersion.ts`, `test/app-version.test.mjs` (watched: a literal put back → 1 failed) |
| V1-60 | PL-6 | CO-256's status disagrees across four sources. | fixed: CO-256 narrowed; CONTEXT.md *Enrollment* agrees |
| V1-61 | PL-7 | CO-238, the headline of 0.3.5, is open in lane 12 ("Carried decisions and horizon"). | fixed: CO-238 partially (ships in 0.3.5, resolved at the tag), CO-244 recorded (release-notes branch), CO-238 moved to lane 2 |
| V1-62 | PL-8 | The roadmap tracks 0.3.5 serves are not named in Fabric's sources. | fixed: P-17 names RM-05, RM-13, RM-25 and PL-01, PL-02, PL-10; the knowledge base rows follow the release (runbook step 11) |
| V1-63 | PL-9 | Only a few files may change after the verified commit, and the plan does not account for that. | not a defect: a constraint, met — every source fix lands before iteration 3's candidate; only release metadata follows it |
| V1-64 | PL-10 | The unified plan was not recompiled after 0.3.4, as the backlog promised. | fixed: the unified-plan promise re-dated to after 0.3.5 with CO-221 |
| V1-65 | PL-11 | The fix-wave handoff is out of date at the candidate. | fixed: the handoff names step 1 done, the operator questions and the next task |
| V1-66 | PL-12 | ADR-0131 amendment 1 says "0.4.0 revokes …0002"; the revoke ships in 0.3.5. | fixed with DO-13: ADR-0131 amendment 2 |
| V1-67 | PL-13 | A CHANGELOG bullet contradicts itself. | fixed: CHANGELOG — sign-in not read on Windows and Linux (CO-244); the vault not on Windows (CO-245) |

Exit for iteration 1: 67 findings dispositioned (58 fixed, 7 ruled, 2 not a defect or not recoverable); the next candidate goes to iteration 2. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-12, against `3570f116` (`3570f1168048b8df9a0d0183d92f67adf9400d9c`, `main` after iteration 1's fixes and the scheduled workspace pin), read-only in a detached checkout; the errors reviewer stopped at an API session limit and a second fresh errors reviewer read the same candidate. Reports (committed as written, machine paths replaced):
[scenarios/UX/UI](../reviews/0.3.5/iteration-2/2026-10-12-ux.md) (UX-n, 3 blocking + 10),
[errors and boundaries](../reviews/0.3.5/iteration-2/2026-10-12-errors.md) (ER-n, 4 blocking + 6),
[code ↔ documents](../reviews/0.3.5/iteration-2/2026-10-12-docs.md) (DO-n, 1 blocking + 7),
[data, memory, orchestration, harness](../reviews/0.3.5/iteration-2/2026-10-12-data.md) (DA-n, 1 blocking + 5),
[plan and roadmap](../reviews/0.3.5/iteration-2/2026-10-12-plan.md) (PL-n, 1 blocking + 14).

52 findings, 10 blocking (DA-1 blocking by the brief's definition, ruled: only the repair tool reaches it). Every *watched* fix had its test run with the defect planted back and seen failing. The Windows fixes are proven on macOS by their built command lines (CO-267). Fixes on `agent/rv2-fixes`: workflows, work screens, docs and plan (`6ae2401d`, `8af4b08f`, landed on `main`), the errors level on `agent/rv2-errors` (`3061d438`).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | UX-1 (blocking) | «Who is working on what» goes stale and then says false things. | fixed: `WhoIsWorking.tsx` re-reads each minute and on `session`/`terminal` events (`ProjectHome.tsx`); `WhoIsWorking.test.tsx` minute re-read (watched: interval removed → 1 failed) |
| V2-2 | UX-2 (blocking) | A review count on «Where work is» opens the wrong section. | fixed: BoardPanel's «Needs you» is `sec-needs-you` (`evidence.ts`), so the review count opens the board; `projectSectionIds.test.ts` (watched: the shared id put back → 1 failed) |
| V2-3 | UX-3 (blocking) | The «Sessions with no project» row leaves out where each session runs. | fixed: `WorkSessionView.folder` from Fabric's own terminals (`index.ts#heldSessions`, `workRead.ts#sessionView`); the no-project row names the folder, else "its folder is not shared with Fabric", and opens when Fabric holds the console (watched: Open removed → 1 failed) |
| V2-4 | UX-4 | When the review queue cannot be read, «Where work is» still counts projects as having "nothing in flight". | ruled CO-268 (iteration 2 additions) |
| V2-5 | UX-5 | Comms calls itself "the board", one rail item below the task «Board». | ruled CO-268 |
| V2-6 | UX-6 | Comms says "The board did not answer." with Try again even when the board did answer: with a refusal, an invalid_arguments, or a row in a shape this build cannot read (a newer schema). | ruled CO-268 |
| V2-7 | UX-7 | Russian still says "Estate" in the private-history panel. | ruled CO-268: a terminology pass over the private-history strings, not a one-word swap |
| V2-8 | UX-8 | First-run "Your choice was not saved: {reason}" puts main's English sentence inside the operator's language. | ruled CO-268 |
| V2-9 | UX-9 | Times on the two work screens use the operating system's locale, not the app's. | ruled CO-268 |
| V2-10 | UX-10 | «Who is working on what» can show another project's claims. | fixed: the reading is kept only for the project still on screen (a ref, not the closure); `WhoIsWorking.test.tsx` stale reading (watched: the old guard → 1 failed) |
| V2-11 | UX-11 | The headline 0.3.5 feature (a coding agent opened in a terminal joins a project) has no route inside the product. | ruled CO-268; the CHANGELOG and README give the registration until the Setup console (0.4.0, RM-09) |
| V2-12 | UX-12 | A fabric://chat link that carries both a service and a project never tries the service's repository. | ruled CO-268 (Dashboards' button sends only the service, not affected) |
| V2-13 | UX-13 | A fabric:// link pressed while the project list cannot be read is held with no word, indefinitely. | ruled CO-268 |
| V2-14 | ER-1 (blocking) | release.yml is not valid YAML, so GitHub rejects the workflow and a pushed v0.3.5 tag starts nothing. | fixed with DO-1 (`6ae2401d`): `release.yml` block scalar; `scripts/check-workflows.py` in `ci.sh` |
| V2-15 | ER-2 (blocking) | Iteration-1's ER-9 fix holds only for a client that throws, and the real one never does. | fixed: `schemaReadiness.ts#unansweredCause` — a status-0 answer or a 502/503/504 is `transport`, an AbortError `timeout`, only a database answer `backend-error`; `schema-readiness.test.mjs` with the real client against a closed port (watched: always backend-error → exit 1) |
| V2-16 | ER-3 (blocking) | fabric-mcp treats the surface's own refusals as a broken connection. | fixed: `fabricMcp.ts#classifyFailure` keeps the session on 400/408/413/429 and says nothing was done; no re-enrollment (watched: 1 of 32 failed); ADR-0134 amendment 4 |
| V2-17 | ER-4 (blocking) | The per-binding cap (8) ends the oldest-minted session, not the least recently active one. | fixed: eviction by last call (`sessionEnroll.ts#enrollSession`), the evicted session told why (`AgentSurface#forget`), DELETE ends a leaving session (`AgentSurface#leave`, `openSessionLink`); `session-enroll.test.mjs` 3 new, `fabric-mcp.test.mjs` 1 new (watched: 4 plants caught); ADR-0134 amendment 4 |
| V2-18 | ER-5 | Each --rejoin-only (the session hooks, per turn) mints another bearer for the same session, and nothing bounds or sweeps them. | fixed: `EnrolledSessions#rejoinBearer` reuses an unspent bearer; unclaimed bearers swept at mint (watched: 2 plants caught) |
| V2-19 | ER-6 | A Windows Stop runs taskkill synchronously on the main thread: execFileSync, 5 s timeout, up to two steps, per session. | fixed: `platform.ts#stopWindowsTree` async, `pty.ts#runBounded` async `execFile` with its 5 s bound (watched: 2 plants caught); on-host proof CO-267 |
| V2-20 | ER-7 | fabric:// links that arrive before startup has finished or with no window are capped at 8, and the 9th and later are dropped with no record and no notice. | fixed: `linkOutbox.ts#createLinkHold` reports each drop; `link.dropped` in the ops log, `links.notice.dropped` on screen (watched: 2 plants caught) |
| V2-21 | ER-8 | fabric_work_release with how: done appends the release, then appends task.moved@1 to review, and only the release is read back. | fixed: `workTools.ts#moveDoneTaskToReview` reads the move back; `task-not-moved` when it did not land; a repeat finishes it (watched: 2 plants caught) |
| V2-22 | ER-9 | The Windows ACL for the hub and credential files grants userInfo().username, a bare name. | fixed: `platform.ts#windowsAclAccount` grants `%USERDOMAIN%\name`; not proven on an Azure AD or domain machine (CO-267) |
| V2-23 | ER-10 | The Windows taskkill spawn in executorDetect.ts#versionOf (killGroup) and the quit reaper (quit.ts#spawnQuitReaper, bare cmd.exe) attach no 'error' listener. | fixed: `platform.ts#spawnHelper` attaches `error` first; used by `executorDetect.ts` and `quit.ts#spawnQuitReaper`, both recorded (watched: 2 plants caught) |
| V2-24 | DO-1 (blocking) | The release workflow does not parse, so pushing v0.3.5 releases nothing. | fixed: `release.yml` block scalar; `scripts/check-workflows.py` in `ci.sh` (PyYAML in `scripts/requirements-ci.txt`) parses every workflow (watched: the old file → FAIL, exit 1) |
| V2-25 | DO-2 | "Signed with the organization's Authenticode certificate" has no receipt, and the publisher Windows shows is a person. | fixed: CHANGELOG and README say "Authenticode-signed through Azure Artifact Signing"; the 0.3.5 rc rehearsal on the release commit is the signature's proof, before the tag |
| V2-26 | DO-3 | The Windows registration of fabric-mcp.cmd is given but was never measured, and the repository's own probe cannot start a .cmd directly. | fixed: the Windows registration through `cmd /c "<Fabric>\resources\bin\fabric-mcp.cmd"`, marked not yet tried on a Windows machine (CO-267) |
| V2-27 | DO-4 | Runbook step 6 describes the Linux job wrongly. | fixed: runbook step 6 — `windows` installs, smoke-starts and uninstalls; `linux` installs and starts the `.deb`; the AppImage is built, not started |
| V2-28 | DO-5 | The upgrade section's remedy for pre-migration-91 grants points at the wrong screen. | fixed with DA-2: the runbook says floor grants before 91 last at most an hour and nothing revokes them |
| V2-29 | DO-6 | Three glossary and ADR entries read as shipped for 0.4.0 work 0.3.5 does not have. | fixed: CONTEXT.md *Setup console* and *Session handoff* marked 0.4.0; ADR-0119 amendment 7 |
| V2-30 | DO-7 | Two Linux-only gaps in the CHANGELOG's fabric:// bullet (not measured). | fixed: the CHANGELOG says to install the `.deb` to open `fabric://` links and register `fabric-mcp` |
| V2-31 | DO-8 | A stale count in scripts/ci.sh's header (a code comment, read by contributors): "The full tier runs the eleven owned-cluster suites". | fixed: the ci.sh header counts six fast and fourteen full owned-cluster suites |
| V2-32 | DA-1 (blocking) | An in-place replay closes a claim with a release that belongs to an earlier claim. | ruled CO-265 (extended): only `rebuild_estate_projections`, the repair tool, reaches it; the app does not call it and the runbook does not name it; deadline: before the tool is offered to anyone |
| V2-33 | DA-2 | The runbook's remedy for pre-91 grants points at a control that cannot reach them, and it misnames what 91 projects. | fixed: the runbook's pre-91 paragraph names floor grants, their one-hour life and that nothing revokes them |
| V2-34 | DA-3 | A restore reproduces live claims and leases from the source machine. | ruled CO-264 (4) |
| V2-35 | DA-4 | A reused idempotency key returns another task's claim as same_claim. | ruled CO-264 (5) |
| V2-36 | DA-5 | Migration 94 (count 83) does not add 83 to the archive's accepted list; 95 adds 83 and 84. | not a defect: the five migrations apply together and the app admits only 84, so a schema-83 database is never opened |
| V2-37 | DA-6 | Iteration 1's rulings and fixes:<br>- V1-45 (rehearsal) holds: receipt PASS, and the migrations are byte-identical since the rehearsed commit.<br>- V1-51 holds: header counts are unchanged and explained in the runbook (r | not a defect: a check of iteration 1 — its findings are DA-1 and DA-2 of this iteration |
| V2-38 | PL-1 (blocking) | The gate cannot clear: hosted ci is red on the candidate, so iteration 1's PL-1 fix (V1-55) does not hold.<br>The release guard (release-guard@v1, workflows: ci.yml) passes only a tag whose commit passed ci.yml.<br>On 35 | fixed: the 0.3.3 startup-dialog tests name darwin (`startupFailure.test.ts`); the hosted fast job on `8c1c279e` passed (run 38207098935, whose full job failed on CO-251's NOT_RUN, then fixed), and `ci` was green on `main` at `8af4b08f` (run 38210310607) |
| V2-39 | PL-2 | The rc rehearsal is ordered before iterations 2 and 3, but it cannot pass preflight until the gate is clear and the changelog is final.<br>The handoff's open work puts "2. | fixed: the handoff orders the rc rehearsal on the release commit, after the gate clears |
| V2-40 | PL-3 | The plan's Now/Next line still contradicts the re-dated rows.<br>The backlog says "until then the Now line is the authority", but the Next clause reads "P-12 (self-update) and P-13 (the CEO as a session) after 0.3.4". | fixed: the Now/Next line — P-12 and P-13 in 0.4.0, the upgrade to 84 |
| V2-41 | PL-4 | P-17's status is stale and miscounts iteration 1. | fixed: P-17's status — iteration 1 closed with 13 blocking, iteration 2 on `3570f116` |
| V2-42 | PL-5 | The handoff is stale again at this candidate.<br>It says the fixes "are on agent/rv1-fixes" and gives "Next task: step 1" (land them). | fixed: the handoff's status at 07:40, the CO-210 wording |
| V2-43 | PL-6 | The knowledge base still states two things that are no longer true.<br>RM-19 says "Fabric builds it after 0.3.4 (P-12; ADR-0121 amendment 2)". | fixed: fabric-workspace #156 — RM-19 says 0.4.0, plans.md's Now line names P-17 |
| V2-44 | PL-7 | platforms.md says Windows signing is "switched on at the 0.3.5 rc". | fixed: fabric-workspace #156 — platforms.md says switched on 2026-10-12, first signed build at the rc |
| V2-45 | PL-8 | The 0.4.0 plan's #waves anchor now lands on the 0.3.5 decision. | fixed: `<a id="waves">` moved to just above `## Waves` |
| V2-46 | PL-9 | P-16's plan-item text still says Windows/Linux "folds in". | fixed: P-16's text (Windows and Linux shipped in 0.3.5) and lane 2's entry rule names P-15 |
| V2-47 | PL-10 | Carry-over deadlines are past due or name an old release.<br>CO-221's "latest" is still "After 0.3.4". | fixed: CO-221 and CO-179 re-dated; CO-198 records the 79 → 84 rehearsal |
| V2-48 | PL-11 | P-17 says the seed owner is retired in 0.3.5 (CO-242), but the release notes do not say so. | fixed: a CHANGELOG bullet for the seed owner's revoke at first start |
| V2-49 | PL-12 | REQ-25's receipt ("operator's Windows PC smoke") is not scheduled, and the deviation is not recorded as an operator question.<br>0.3.5 ships REQ-25's port part without the updater. | fixed: recorded as an operator question in the handoff with the default taken (release with CO-267) |
| V2-50 | PL-13 | It is unclear when the operator's data is reset: at 0.3.5 or at 0.4.0.<br>The handoff's step 5 resets the operator's local data after installing 0.3.5 ("the operator's original order"), and also lists that reset as an op | fixed: one home — the 0.4.0 plan's *Decision, 2026-10-12* moves the clean first run to 0.3.5's release close |
| V2-51 | PL-14 | The site's Windows/Linux download has no carry-over row. | fixed: CO-269, the site's Windows and Linux downloads |
| V2-52 | PL-15 | The backlog's direction paragraph says the unified plan is the queue, yet unified-plan.mjs check still exits 1. | not a defect: CO-221's ruling confirmed |

Exit for iteration 2: 52 findings dispositioned (37 fixed, 12 ruled, 3 not a defect or not recoverable); the next candidate goes to iteration 3. Blocking findings open: none.

## Iteration 3

_Not started._
