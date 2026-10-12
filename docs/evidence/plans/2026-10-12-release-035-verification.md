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

_Not started._

## Iteration 3

_Not started._
