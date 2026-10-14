# Release verification — Fabric 0.3.6, the operator home, the project's way, settings as a screen: three independent iterations

Run `2026-10-14-release-036-verification` (`r-44ae60a75316`). The operator's rule (2026-10-03, plan row P-02, kept for
every release): before the release, three independent testing iterations across every level of the project, every
finding fixed, and only then the release. The operator asked on 2026-10-14, after Fabric would not open on their Mac,
for the fix and a new version, then for the whole run to be closed in one iteration with two or three checking rounds —
these three iterations are those rounds. This file is the ledger for **Fabric 0.3.6**: everything on `main` since
v0.3.5 — the operator home and project page in plain words (SCN-158, SCN-159), settings as a screen with the agents on
this computer (SCN-160), the stack-start retry (CO-294), comms wave 4 reads, the CO-282 harness waves behind their
flag, load-tolerant tests. The onboarding plan that held the 0.3.6 number moves to 0.3.7
([its note](2026-10-13-onboarding-036/README.md)).

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.6/iteration-N/`.

## Iteration 1

Five fresh reviewers, 2026-10-14, against `034108c5` (`034108c5cf0f4019fa35f5be0ec46776dfdd3ed5`, `main` after the stack-start retry), read-only in a
detached checkout. Reports, committed as written: [UX](../reviews/0.3.6/iteration-1/2026-10-14-ux.md) (UX-n),
[errors and boundaries](../reviews/0.3.6/iteration-1/2026-10-14-errors.md) (ER-n),
[code and documents](../reviews/0.3.6/iteration-1/2026-10-14-docs.md) (DO-n),
[data, memory, orchestration, harness](../reviews/0.3.6/iteration-1/2026-10-14-data.md) (DA-n),
[plan and roadmap](../reviews/0.3.6/iteration-1/2026-10-14-plan.md) (PL-n).

62 findings, 17 blocking, plus one found by the lead. Fixes landed on `agent/release-036-i1-fixes` with the
Comms branch `fix/rv-036-comms-ux` (`f5d55a16`) and the documentation branch `docs/review-036-docs` (`4f3f207c`). Every
*watched* fix had its test run with the old behaviour planted back and seen failing. Checks run after the fixes:
`vitest run src/renderer src/shared` 2147/2147; `agent-surface.test.mjs` on a disposable stack 104/104;
`probe-fresh-vs-upgraded.mjs --from 84` all green; `context-privacy.test.mjs` 8/8.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 (blocking) | The release notes omit the release's three headline user-facing changes | fixed: CHANGELOG `## Unreleased` names the home (SCN-158), the project page (SCN-159), Settings as a screen (SCN-160) and the lost manual order of unpinned projects (docs branch `4f3f207c`) |
| V1-2 | UX-2 (blocking) | The headline "who is doing what" presents work nobody is doing as current | fixed: `homeLive.ts#composeHome`: `WorkItem.live`; a silent/lapsed claim is listed as «никто не отмечается», not counted and never a project's «Сейчас» (test `homeLive.test.ts` "work nobody is doing is not current"; watched) |
| V1-3 | UX-3 | The same task is named differently on two screens, against the wave's own plain-language rule | fixed: `projectPath.ts#pathSummary` = `homeLive.ts#taskSummary`: brief, title, else «Задача без описания»; the board keeps `legacyTaskLine` for untitled legacy tasks (`projectPath.test.ts`) |
| V1-4 | UX-4 | The home's "to review" figure is a floor shown as an exact number | fixed: `HomeView.reviewCapped`/`inWorkCapped`; counts read «50+» (`HomeWork.test.tsx`; watched) |
| V1-5 | UX-5 | Raw English machine errors are put inside localized sentences | fixed: `OperatorError.tsx#FailureNote`: our sentence, the machine's words on their own line, on Comms, home, project and Settings (branch `f5d55a16`, plants watched per screen) |
| V1-6 | UX-6 | Comms shows coding agents by raw runner id | fixed: Comms names agents by `runnerLabel` (branch `f5d55a16`; plants watched) |
| V1-7 | UX-7 | Two Comms reads fail in silence | fixed: a failed «More results» page and a refused Copy are said, «More results» kept (branch `f5d55a16`; plants watched) |
| V1-8 | UX-8 | Settings turns "unknown" into "not installed" | fixed: `SettingsScreen.tsx`: `installed: null` shows no pill (Switchboard did not say) |
| V1-9 | UX-9 | The screen records were not updated for the home and project waves, and the UX lint does not notice | fixed: `docs/ux/screens.md` SCR-30/31/52 built with coverage (docs branch `4f3f207c`) |
| V1-10 | UX-10 | From the Settings screen, "History" and "Agent access" open their panels in the `.shell` that follows the Settings screen, beside a hidden `<main>` | fixed: `App.tsx`: Settings renders inside `.shell`, so History and Agent access open beside it |
| V1-11 | UX-11 | The home's "In work" and "To review" lanes show at most 6 rows | fixed: lanes show «Ещё N» to the Board past six rows (`HomeWork.tsx` `LANE_ROWS`) |
| V1-12 | UX-12 | The Settings nav item is a toggle | fixed: the navigation item opens Settings (no toggle) and the screen carries its name «Настройки приложения» |
| V1-13 | UX-13 | The stack-start retry line is Fabric's own English sentence in main: "The stack is still starting — trying again (1)…" | ruled: CO-306 — the whole splash is English (main writes it before the locale is read); the line now says «try 2 of 4» |
| V1-14 | ER-1 (blocking) | A task whose instruction (plus brief) exceeds ~11.5 k characters can no longer be started at all, and the person is not told why | fixed: `contextPack.ts`: the essential head is delivered whole, memory that does not fit is left out and said; compiler revision 5 (`context-privacy.test.mjs`, the old refusal planted back failed) |
| V1-15 | ER-2 (blocking) | The project page's board glance counts "Done" from a read capped at 20 and shows it as the total | fixed: `ProjectWay.tsx#ProjectBoardGlance` `doneFloor` from `TaskList.closed.truncated`: «Готово 20+» (`ProjectLaunch.test.tsx`; watched) |
| V1-16 | ER-3 (blocking) | The release notes give the wrong schema boundary | fixed: CHANGELOG: schema 89 from 84, five migrations, an Upgrading paragraph (docs branch `4f3f207c`) |
| V1-17 | ER-4 | Claude Code (and every surface-connected runner) now refuses to start while Fabric's agent surface is down, where 0.3.5 started it unconnected | fixed: recorded in CHANGELOG "How sessions start": a surface-connected runner is refused before start when its surface is down, with the person-facing message; the behaviour is CO-282's and intended |
| V1-18 | ER-5 | The home's "In review" count and each project's review pill come from a read capped at 50, without saying so | fixed: with UX-4 |
| V1-19 | ER-6 | The stack-start retry has no quit check, logs nothing, and retries more than its stated scope | fixed: `stackStartRetry.ts`: `stopped()` read before and after the wait; retries recorded as `stack.start.retry` in the operations log; `unhealthy` is not waited out (`stackStartRetry.test.ts` "a quit during the wait starts no new try") |
| V1-20 | ER-7 | The home's count strip shows the last confirmed numbers as current after a failed read | fixed: `HomeStats`: after a failed read the counts show «—» with the reason as their title (`HomeWork.test.tsx`) |
| V1-21 | ER-8 | A failed "more results" page in Comms search ends the results silently | fixed: with UX-7 |
| V1-22 | ER-9 | "What waits for a project" drops the board's cap flag | fixed: «What waits for a project» keeps and says the over-100 flag (branch `f5d55a16`; watched) |
| V1-23 | ER-10 | "Quiet since" and the home's project order come from the last 3 000 journal events only | ruled: CO-307 |
| V1-24 | ER-11 | Settings shows Switchboard's raw answer as the "failed" reason when its JSON is a schema this build does not read | fixed: `agentCatalog.ts`: a newer schema is `unknown-schema`, said in words (`agentCatalog.test.ts`) |
| V1-25 | ER-12 | The two pending resource migrations reuse applied version numbers | ruled: CO-309 |
| V1-26 | DO-1 (blocking) | The release notes give the wrong schema: "schema 88 (from 84): four migrations", but the build admits only 89, after five | fixed: with ER-3 |
| V1-27 | DO-2 (blocking) | Settings cannot read the Switchboard catalogue it documents: Fabric's parser ignores Switchboard's `--json` envelope | fixed: `agentCatalog.ts#parseSwitchboardAgents` reads the `{ok, data}` envelope; measured live on Switchboard 0.6.31: 30 agents read (`agentCatalog.test.ts` "the envelope Switchboard actually prints") |
| V1-28 | DO-3 (blocking) | `## Unreleased` does not mention the release's headline changes | fixed: with UX-1, plus CO-292 and the Kimi Code registration |
| V1-29 | DO-4 (blocking) | Shipped launch behaviour from the CO-282 wave is unrecorded, and two of the changes are not behind any flag | fixed: CHANGELOG "How sessions start" (surface refusal, Kimi modes applied, context revision, ADR-0152/0154 inactive) |
| V1-30 | DO-5 | The stack-start retry can start a new `supabase start` after a quit, contrary to its own quit contract | fixed: with ER-6 |
| V1-31 | DO-6 | The runbook still says "The next release" and its readback omits 89 | fixed: `docs/launch/release-mac.md`: 0.3.6 admits 89; readback 89 |
| V1-32 | DO-7 | `screens.md` does not record the screens this release built | fixed: with UX-9 |
| V1-33 | DO-8 | SCN-147 and SCN-148 still say the contract repin is owed, but it has landed | fixed: SCN-147/SCN-148 amended 2026-10-14: the repin landed (`a59d04b`) |
| V1-34 | DO-9 | The private-archive compatibility record stops at schema 84, but the code admits 85–89 | fixed: archive compatibility for 85–89 recorded with its measurement (docs branch `4f3f207c`) |
| V1-35 | DO-10 | The pending harness migrations reuse version numbers the release now ships | ruled: CO-309 |
| V1-36 | DO-11 | The lifecycle table (LC-09) does not list this release's new clocks | fixed: AGENTS.md lifecycle rows: Comms badge 5 s, home reading 15 s, Settings catalogue once per opening |
| V1-37 | DO-12 | Some documents still describe the Settings band that wave 3 removed | fixed: `components/registry.ts` reworded; ADR-0156 Amendment 1 reads "the Settings band" as Settings |
| V1-38 | DO-13 | No scenario covers the stack-start retry; its code region points at an unrelated scenario | fixed: SCN-161 written and the code region points at it; the splash language is CO-306 |
| V1-39 | DO-14 | The CHANGELOG states the receipt-shape change twice, in two clusters | fixed: the duplicated receipt-shape entries merged |
| V1-40 | DA-1 (blocking) | A task with a long instruction no longer starts, and whether it starts depends on how much the project remembers | fixed: with ER-1 |
| V1-41 | DA-2 (blocking) | Harness wave-1 repairs change the ordinary launch path without a release note | fixed: with ER-4 and DO-4 |
| V1-42 | DA-3 (blocking) | The project page's board glance counts a capped read as the total — the M190 defect again | fixed: with ER-2 |
| V1-43 | DA-4 (blocking) | The release notes state the wrong schema | fixed: with ER-3 |
| V1-44 | DA-5 | History search cannot reach older messages once its 2 s budget is spent, and tells the person to do the thing that makes it worse | ruled: CO-308 |
| V1-45 | DA-6 | "Works on a board too large to hold" holds for the output, not the work | ruled: CO-308 |
| V1-46 | DA-7 | The inactive resource SQL keeps filenames that collide with applied migrations | ruled: CO-309 |
| V1-47 | DA-8 | A project's "last activity" is read from the newest 3 000 journal events of the whole estate | ruled: CO-307 |
| V1-48 | DA-9 | "What it is doing now" can be an old stage from a session that has ended | fixed: `composeHome`: a stage counts only from a session still held and signing (`homeLive.test.ts` "an ended session's last stage is not what anyone is doing") |
| V1-49 | DA-10 | The stack retry also retries `unhealthy`, which the release note and commit say it does not | fixed: with ER-6 |
| V1-50 | PL-1 (blocking) | The release notes omit the release's headline work | fixed: with UX-1 |
| V1-51 | PL-2 (blocking) | CHANGELOG gives the wrong schema | fixed: with ER-3 |
| V1-52 | PL-3 (blocking) | The plan on the candidate says 0.3.6 is a different release | fixed: the onboarding plan records its release moving to 0.3.7; this ledger re-scopes 0.3.6 |
| V1-53 | PL-4 (blocking) | A carry-over row gates this release and is still open | ruled: CO-284 — two of three checks run green 2026-10-14 (agent-surface 104/104, upgrade probe 84→89); the real-client smoke is carried to 0.3.7 |
| V1-54 | PL-5 | The release is not in the plan registers yet | fixed: P-18 in `docs/evidence/backlog.md`; this ledger |
| V1-55 | PL-6 | Recorded fixed, not shipped: CO-291 | fixed: CO-291 corrected: deferred with the onboarding plan (0.3.7) |
| V1-56 | PL-7 | Shipped, still recorded open: CO-190 | fixed: CO-190 resolved (`979474d3`) |
| V1-57 | PL-8 | The operator-home plan has no register home and silently dropped an item | fixed: the operator-home plan carries its status; the dropped permission mode is CO-305 |
| V1-58 | PL-9 | The workspace publication is stale and its path is broken | ruled: CO-197 / N-030 — the publication runs after this release lands; the scheduled sync's new failure (`ceo-conversation-service.test.mjs`) is fixed on main `ee4064b4` |
| V1-59 | PL-10 | Harness records lag the work after N-040 closed | fixed: the CO-282 handoff names N-040 closed and the next task |
| V1-60 | PL-11 | CO-277's deadline is this release | ruled: CO-277 — the upgrade path measured green 2026-10-14; the `db reset` refusal is carried to 0.3.7 |
| V1-61 | PL-12 | Two open rows name the next release's local gate as their deadline | ruled: CO-281 and CO-293 — the release's local gate run decides them; carried to 0.3.7 if not reproduced |
| V1-62 | PL-13 | The same change is announced twice | fixed: with DO-14 |
| V1-63 | lead, while running CO-284's checks | `agent-surface.test.mjs` on a disposable stack: `fabric_whoami`'s answer outgrew the trace tap's 4 KiB head, so every call traced `unknown` | fixed: `toolOutcome.ts#bodyFromEnds` reads a long body from its head and tail; `toolOutcome.test.ts` 23/23; agent-surface 104/104 |

Exit for iteration 1: every finding is fixed or ruled to a register row. Blocking findings open: none.

## Iteration 2

_Not started._

## Iteration 3

_Not started._
