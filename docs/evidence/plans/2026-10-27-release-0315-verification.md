# Release verification: Fabric 0.3.15, the screens as the operator approved them, three independent iterations

0.3.15 brings the screens shipped in 0.3.14 to the mockup the operator approved on 2026-10-26 (P-30,
[plan, conflict rules and gap maps](../../reports/2026-10-27-mockup-parity/README.md)), agreed as 0.3.15 by the
coordinator (MD-16, fabric-workspace `knowledge/integration.md`), target 2026-10-29. The board dispatcher and load
governor, numbered 0.3.15 until 2026-10-27, is now the release of 2026-11-05 (P-29), numbered at its tag.

**No schema step.** The local database stays at schema 98, as in 0.3.14: upgrading is the new bundle alone, and going
back is the 0.3.14 bundle alone ([CHANGELOG](../../../CHANGELOG.md), «Upgrading»).

## Protocol

The protocol is 0.3.14's ([0.3.14 ledger, Protocol](2026-10-26-release-0314-verification.md#protocol)), unchanged:
fresh reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the candidate;
their reports are committed under `docs/evidence/reviews/0.3.15/iteration-N/` as written, with one
`fabric-release-reviews/1` receipt per level. A reviewed candidate is never rebased.

## Rollout on the operator's Mac

0.3.15 is the bundle alone (schema 98 unchanged). The Mac runs Fabric 0.3.14 under the broker target `fabric.desktop`.
The rollout holds the broker target first and lifts the hold after the swap, as 0.3.14's did ([its Rollout, as
done](2026-10-26-release-0314-verification.md#rollout-as-done-on-2026-10-27)); the bundle is checked (`SHA256SUMS`,
`codesign`, `spctl`) and the old one kept aside as the way back. The quit is the person's.
## Release

The candidates keep version 0.3.14 (`apps/desktop/package.json`, `CHANGELOG.md`'s heading «0.3.15 (unreleased)») and
`docs/launch/release-gate.json` stays 0.3.14's, because `release-gate.test` requires the package version to match the
gate file. Iteration 3's candidate, once it closes with no blocking finding open, becomes the verified commit. The
release commit then raises `package.json` to 0.3.15, gives `CHANGELOG.md` its dated heading and writes
`release-gate.json` in one change: version 0.3.15, this ledger, the verified commit, the release metadata and the
receipts of iterations 1 to 3. `bash scripts/ci.sh fast` and the release gate run on that commit; the tag `v0.3.15` is
pushed after they read green and `release.yml` is watched to its published assets. The rollout above follows.

As 0.3.14 did, iteration 3's fixes make a final candidate after its reviewed one; a fresh verifier reads that final
candidate (every iteration 3 disposition, the changed tests one file at a time, the documents gates) and it becomes the
verified commit. In order (the release review, iteration 3, PL-8):

1. The final candidate's verifier report, «ready to tag», committed as release metadata.
2. The release commit: version, CHANGELOG heading, `release-gate.json`, this ledger, the handoff, `docs/MERGES.md`, the
   design map's entry. Nothing outside the runbook's post-`verifiedCommit` list changes in it.
3. The hosted `ci.yml` on `main` read before the tag (the full tier needs a database this Mac cannot hold); its run is
   recorded here.
4. The tag `v0.3.15`, `release.yml` to its published assets, the DMG checked (`SHA256SUMS`, `codesign`, `spctl`).
5. After the tag, on `main`: P-30 «released» and the Now line (the register cannot change after the verified commit),
   `node scripts/workspace.mjs publish` and `check --require-child`, the knowledge base's release row, the board post.
6. The rollout above.

## Hosted CI on the final candidate

The push run of `ci.yml` on `112779af` is `40520347021`. The full tier needs a database this Mac cannot hold, so it runs
on the hosted runner on the release commit once it is on `main`, and the release guard waits for `ci.yml` on that
commit before the macOS, Windows and Linux builds (`docs/launch/release-mac.md`, step 4). Their conclusions are read
before the tag and recorded in the release handoff; a failed job is a finding, never a pass.

## Owed in 0.3.15's Release close

- V3-19 (FV-1) as a carry-over row on `main` after the tag.
- After the tag, on `main`: P-30 «released» and the Now line, `node scripts/workspace.mjs publish` and
  `check --require-child`, the knowledge base's release row, the board post.
- The rollout above, and the person's look at the opened 0.3.15: Главная at 900 to 1440 px in both themes, the left
  column, an agent's page.

## Iteration 1

Candidate `d1b0379dcdf0cdf566b3e457a17431f80e7582c7`. Five reviewers, one per level, read-only in a detached checkout; their reports are in
[`docs/evidence/reviews/0.3.15/iteration-1/`](../reviews/0.3.15/iteration-1/). 35 findings, 6 blocking (UX-1, DO-1 to DO-4, PL-2).

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | the rail dropped the status word «Работает» | fixed: every agent row says its status in a word, «Работает» included (`apps/desktop/src/renderer/src/launch/LaunchShell.tsx#LaunchShell`); test `Rail.test.tsx` «shows the agents at work … opens one», watched failing with the word removed; SCN-162 amendment and CHANGELOG 0.3.15 say so |
| V1-2 | UX-2 | non-blocking | the rail said no project is at work before the home reading answered | fixed: until `pulses` is read the whole list shows and nothing is said to rest (`LaunchShell.tsx#LaunchShell`); test `Rail.test.tsx` «has no «Все проекты» row …» |
| V1-3 | UX-3 | non-blocking | the rhythm said «не прочитаны» while it was only loading | fixed: a first reading says «читаю решения и результаты…» (`apps/desktop/src/renderer/src/launch/HomeParts.tsx#rhythmOf`, `launch.home.rhythm.totalsReading`); Copylot reports `35fb6d47`, `06a92fde` |
| V1-4 | UX-4 | non-blocking | the project page heading printed the slug | fixed: the heading prints `projectDisplayName`, the slug on hover (`apps/desktop/src/renderer/src/ProjectHome.tsx#ProjectHome`) |
| V1-5 | UX-5 | non-blocking | an unknown project printed as its id | fixed: `nameOfProject` answers null for an id no list knows; the cards fall back to the board's own name and the requests say «проект вне списка» (`EstateHome.tsx`, `HomeParts.tsx#NeedsYouCard`, `HomeBoardWaiting.tsx#HomeBoardWaiting`); test `HomeBoardWaiting.test.tsx` «UX-5: …» |
| V1-6 | UX-6 | non-blocking | «молчат: 1», and the shots were not this build | fixed: plural keys `launch.home.inWork.agentsQuiet.{one,few,many}` (`HomeInWork.tsx`); the shots in `docs/reports/2026-10-27-mockup-parity/shots/after-*.png` retaken from the fixed renderer with a rhythm fixture |
| V1-7 | UX-7 | non-blocking | the rail console button was wider than its box and off-centre | fixed: `.rail-console` takes no padding and a line height of 1 (`launch/launch.css`); a long name keeps the mockup's ellipsis (rail gap 6) |
| V1-8 | UX-8 | non-blocking | narrow windows put «Нужны вы» and the session card last | fixed: below 1100 px «Нужны вы» follows the numbers, below 1000 px the session card precedes the tasks (`launch/launch.css`, the home and `.as-side` rules) |
| V1-9 | UX-9 | non-blocking | humanised slugs mangled acronyms | fixed: `humaniseSlug` keeps known acronyms upper case (`apps/desktop/src/shared/projectDisplayName.ts#humaniseSlug`) |
| V1-10 | UX-10 | non-blocking | console chip wording, a dash placeholder, a dated hint | ruled: `heldFor` answers null and the clause is hidden (`apps/desktop/src/renderer/src/duration.ts#heldFor`, test `duration.test.ts`); the console chip and the dated hint are CO-472 |
| V1-11 | ER-1 | non-blocking | the identity join brought back long-released claims and gave one task to two agents | fixed: only a claim that ended by itself within `CARRY_CLAIM_MS` in the same project is carried, one task to one agent, and a carried task alone is not work (`apps/desktop/src/shared/agentIdentity.ts#joinByRuntime`, `agentWork.ts#workOf`); tests `agentIdentity.test.ts` «ER-1: …», `agentWork.test.ts` «ER-1: …», watched failing with the carry rule removed |
| V1-12 | ER-2 | non-blocking | the rhythm read was not throttled | fixed: main answers a reading younger than `MIN_INTERVAL_MS` again and shares one in flight (`apps/desktop/src/main/workRhythm.ts#createRhythmReader`); test `test/work-rhythm.test.mjs` «ER-2: …» |
| V1-13 | ER-3 | non-blocking | the marks read was unfiltered | fixed: three reads filtered by the database (`workRhythm.ts#createRhythmReader` `marks`); test «results and decisions come from three reads …» |
| V1-14 | ER-4 | non-blocking | no midnight refresh; a stale chart said only on hover | fixed: a 60 s tick (`HomeParts.tsx#useRhythm`, `RHYTHM_TICK_MS`) and «· не обновлено» on the line (`launch.home.rhythm.stale`) |
| V1-15 | ER-5 | non-blocking | a failed turns read looked like idle; turns not joined across ids | fixed: turns under an agent's earlier ids count as its own (`LiveAgent.aliases`, `apps/desktop/src/main/agentWork.ts#withWork`) and `atWork.turnsUnread` says a failed read |
| V1-16 | ER-6 | non-blocking | display names flipped to slugs on a passing failure, silent caps | fixed: a failed read keeps the last names and is logged, a capped projects read is logged (`apps/desktop/src/main/projectNames.ts#createDisplayNameReader`); test `test/project-names.test.mjs` «ER-6: …», watched failing with the fallback removed |
| V1-17 | DO-1 | blocking | region headers cited the renamed gap maps | fixed: every region cites `gaps/2026-10-27-*.md`; `node scripts/check-regions.mjs` exit 0 |
| V1-18 | DO-2 | blocking | two broken links to the renamed maps | fixed: spec v1 and the SCN-162 amendment link the dated maps; `bash scripts/check-docs.sh` exit 0 |
| V1-19 | DO-3 | blocking | the design map stamp was stale | fixed: new top entries for the candidate and for these fixes, refreshed; `node scripts/check-design-map.mjs` exit 0 |
| V1-20 | DO-4 | blocking | AGENTS.md lifecycle missed the new background reads | fixed: the home's work reading row names the enrolments, earlier ids, turns and display names; a new row for the rhythm reading; the board reading row names the list (`AGENTS.md`, Lifecycle) |
| V1-21 | DO-5 | non-blocking | «counted the same way on Pulse» overstated | fixed: CHANGELOG 0.3.15 says the definitions are shared and Pulse counts on the events it holds |
| V1-22 | DA-1 | non-blocking | Pulse still counts from the newest 500 events | fixed: CHANGELOG 0.3.15 says so; Pulse is not in the mockup |
| V1-23 | DA-2 | non-blocking | «держит» moved with every edit | fixed: `heldSince` is the claim time only (`apps/desktop/src/shared/homeLive.ts#composeHome`) |
| V1-24 | DA-3 | non-blocking | an open claim plus a ping read as at work | fixed: a task counts only with a work signal within `TASK_WORK_MS` (`agentWork.ts#workOf`); test `agentWork.test.ts` «holding a task is at work while …» |
| V1-25 | DA-4 | non-blocking | the new journal reads have no index | ruled: an index is a schema step and 0.3.15 is the bundle alone; CO-469 |
| V1-26 | DA-5 | non-blocking | the rhythm refreshed on every mark | fixed: as ER-2 |
| V1-27 | DA-6 | non-blocking | the join ignored the project; agents without a runtime id | fixed: the join keeps to the live agent's project (`agentIdentity.ts#joinByRuntime`); agents with no runtime id are named in CHANGELOG and are CO-473 |
| V1-28 | DA-7 | non-blocking | a stamped stage task outranks the grace rule | ruled: the known limit of one live claim; CO-470 |
| V1-29 | DA-8 | non-blocking | the marks bound spent on moves that are not results | fixed: as ER-3 |
| V1-30 | DA-9 | non-blocking | other screens still print the slug | ruled: the screens outside the mockup; CO-471 |
| V1-31 | DA-10 | non-blocking | two «at work» counts | fixed: an agent past its sign window is quiet, never at work, so the strip is the cards' count less the quiet ones (`agentWork.ts#workOf`); test `agentWork.test.ts` |
| V1-32 | PL-1 | non-blocking | closure of the gap maps not recorded | fixed: the README's «What closed and what stays open» names each open gap with its reason and home |
| V1-33 | PL-2 | blocking | the renumbering was incomplete | fixed: the backlog Now line, the carry-over rows, the scenarios' note on «Поручить агенту B», v2's header note and four code comments name the release of 2026-11-05; `grep -rn "0\.3\.15" apps/desktop/src` prints only tests |
| V1-34 | PL-3 | non-blocking | the waves table named too few paths; status | fixed: the waves table names every changed file group; status in-review |
| V1-35 | PL-4 | non-blocking | conflict rules only in the README; no light console shot | fixed: the rules apply recorded decisions (v2, the operator's theme setting, ADR-0100) as the README says; `shots/after-console-light.png` added |

Exit for iteration 1: every finding has a disposition. Blocking findings open: none.

## Iteration 2

Candidate `acdf7ac3ab1645057ced0cd2d0cd4715747a8a24`. Five reviewers, one per level, read-only in a detached checkout; their reports are in
[`docs/evidence/reviews/0.3.15/iteration-2/`](../reviews/0.3.15/iteration-2/). 22 findings, 2 blocking (UX-11, UX-12).

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V2-1 | UX-11 | blocking | the hero's words column starved between 1101 and 1180 px | fixed: below 1260 px the hero is two columns with the chart under the words (`launch/launch.css`, the 1260 px rule); shot `after-home-light-1150.png` |
| V2-2 | UX-12 | blocking | Агенты and the agent page said «работает» for an agent only connected | fixed: `shared/sessionStatus.ts#sessionStatus` takes `atWork` and says idle when it is false; `launch/agentRoster.ts` lists it under «Простаивают»; tests `sessionStatus.test.ts` «UX-12 (0.3.15 review, iteration 2)» and `AgentsScreen.test.tsx` «lists an agent judged connected but not at work under Простаивают», watched failing |
| V2-3 | UX-13 | non-blocking | the cross-project panel printed slugs | fixed: `launch/CrossProjectConsole.tsx` names projects by `projectDisplayName` (the agent's instruction keeps the slug); test «UX-13 (0.3.15 review, iteration 2)», watched failing |
| V2-4 | UX-14 | non-blocking | narrow-window order | fixed (a): below 1000 px «Сейчас» comes first, then the session card and questions, then the tasks (`launch/launch.css`; shot `after-agent-light-900.png`); ruled (b): the DOM order is CO-476, the release of 2026-11-05 |
| V2-5 | UX-15 | non-blocking | the shots did not show the mockup's main row | fixed: the harness fixture carries a goal, a task title, a project line and a waiting request; the shots are retaken and the README says so |
| V2-6 | UX-16 | non-blocking | a dash or «?» in place of an unreadable time («(dash) назад», «взял ?») | fixed: `duration.ts#knownTime` and `#untimed`; `AgentPage.tsx#atWords` answers null; each caller leaves the clause out; tests in `duration.test.ts`, `AgentPage.test.tsx`, `HomeInWork.test.tsx` and `HomeBoardWaiting.test.tsx` «UX-16 (0.3.15 review, iteration 2)», watched failing on the agent page and «В работе»; the `heldFor` comment corrected |
| V2-7 | ER-7 | non-blocking | a failed identity read was shown as the truth | fixed: `main/agentIdentity.ts#withIdentity` sets `identityUnread`; the strip's «работают» says «прочитано не всё» (`HomeWork.tsx#HomeStats`); tests `agent-identity.test.mjs` «a read that fails leaves the reading as it was» and `HomeWork.test.tsx` «says «agents working» is partial», watched failing |
| V2-8 | ER-8 | non-blocking | attribution across ids | fixed (1): an earlier id's stage report from another project is skipped (`shared/agentIdentity.ts#joinByRuntime`, test «ER-8 (0.3.15 review, iteration 2)», watched failing); not a defect (2): an open claim is the earlier session's by the board's record until the sweep releases it once lapsed, the comment on `CARRY_CLAIM_MS` says so; ruled (3): CO-475 |
| V2-9 | ER-9 | non-blocking | the capped-marks cut used the union's oldest row | fixed: `shared/workRhythm.ts#composeRhythm` takes `marksCutAt`, the newest of the capped reads' oldest rows (`main/workRhythm.ts`); test «ER-9: one capped read cuts the days before its oldest row», watched failing |
| V2-10 | ER-10 | non-blocking | caps logged but not said; unindexed lookup; unthrottled `comms.waiting` | fixed: a full turns read sets `turnsUnread`, a full enrolment chunk `identityUnread`, both said on the strip (test «ER-10 (0.3.15 review, iteration 2)»); ruled: the index and the throttle are CO-477 |
| V2-11 | ER-11 | non-blocking | failure paths without tests | fixed: tests «ER-11: a reading that fails rejects every caller sharing it», the identity catch (ER-7's test) and the turns cap (ER-10's); `main/index.ts#executorsCached` drops only its own failed entry; not a defect: a runner that did not answer stays «не отвечает» for the 10 minutes detection keeps |
| V2-12 | DO-6 | non-blocking | the rhythm row listed four mark families | fixed: `AGENTS.md` lists the nine, naming `shared/workRhythm.ts#DECISION_TYPES` |
| V2-13 | DO-7 | non-blocking | V1-33's grep and V1-34's waves table overstated | fixed: this row corrects them: `apps/desktop/src` keeps «0.3.15» only in comments citing this release's review and in tests, no promise of the release of 2026-11-05; the README's waves table names the main file groups and says so |
| V2-14 | DO-8 | non-blocking | no scenario amendment for the home and the agent page | fixed: SCN-158 and SCN-166 carry dated amendments of 2026-10-27 with their code and tests; `node scripts/sync-product-ux.mjs` and `build-product-report.mjs` rerun |
| V2-15 | DO-9 | non-blocking | stale statements | fixed: P-28 released with its tag and ledger, the Now line no longer lists it as next; the map's candidate entry says the version went back; CO-427 names the organization slice; P-30 «in review» |
| V2-16 | DA-11 | non-blocking | turns read for 15 minutes, task work counted for 60 | fixed: `main/agentWork.ts#withWork` reads turns over `TASK_WORK_MS`; `AGENTS.md` says 60 minutes |
| V2-17 | DA-12 | non-blocking | the 2 h released-claim carry is mostly dead | not a defect: nothing false is shown; the comment on `CARRY_CLAIM_MS` and the CHANGELOG now say the open claim is what comes along |
| V2-18 | DA-13 | non-blocking | a quiet agent with no task is in no count | not a defect: it stays in the left column and on Агенты; the CHANGELOG says so |
| V2-19 | DA-14 | non-blocking | `operator` is not a journal actor kind | fixed: decisions are the person's alone (`shared/workRhythm.ts#isPersonDecision`, `main/workRhythm.ts`); test «results and decisions come from three reads» checks `eq actor->>kind person` |
| V2-20 | PL-5 | non-blocking | the plan to release was not recorded | fixed: the «Release» section above; P-30 links this ledger and names the release commit's bump |
| V2-21 | PL-6 | non-blocking | carry-over and wording gaps | fixed: Pulse's counts are CO-474; README lists D10 (kept, v2 R-1, R-2) and F3 (closed); P-29 names CO-469 to CO-479; V1-33 corrected by V2-13; v2 §6 carries the renumbering note |
| V2-22 | PL-7 | non-blocking | three board asks unfiled | ruled: CO-478 (prowlagent's cancel door), CO-479 (DEC-0142 and DEC-0143), CO-480 (FAA-153 question 2), each answered on its thread |

Exit for iteration 2: every finding has a disposition. Blocking findings open: none.

## Iteration 3

Candidate `dbb69aa467347a9db806849c7c819a7107db4658`. Five reviewers, one per level, read-only in a detached checkout; their reports are in
[`docs/evidence/reviews/0.3.15/iteration-3/`](../reviews/0.3.15/iteration-3/). 18 findings, none blocking. Iteration 2's dispositions held at the
candidate, with the caveats the rows below take up (V2-11's test, V2-18's left column).

Iteration 3's fixes made the final candidate `112779af7fccd9444779b4e72983c535ac160ebc` (`fix(0.3.15): the release review's
iteration 3`). A fresh verifier read it in a detached checkout
([report](../../reports/2026-10-27-release-0315/2026-10-27-final-candidate-verification.md), verdict «ready to tag»):
the 18 dispositions V3-1 to V3-18 hold at the candidate, eight test files passed one at a time (the report's method line
says nine; its table lists the eight that ran), the five documents gates exited 0, and both checkouts were left with no
change. Its two low findings are V3-19 and V3-20 below. The candidate is the release gate's `verifiedCommit`. The receipts and the release gate name it, as 0.3.14 named its final candidate.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V3-1 | UX-17 | non-blocking | the rail's switch at 900 px cuts «Проек…» | ruled: CO-483, the release of 2026-11-05 |
| V3-2 | UX-18 | non-blocking | no highlighted rail row for the open session in the console shot | ruled: CO-483 (look in the real app; the harness fixture may lack it) |
| V3-3 | ER-12 | non-blocking | earlier stage reports read unordered and unbounded; a full claims read not said | ruled: CO-477 extended |
| V3-4 | ER-13 | non-blocking | the turns read has no `seq` bound or covering index | ruled: CO-477 extended; a failed or slow read is said as partial (ER-7, ER-10) |
| V3-5 | ER-14 | non-blocking | the ER-11 rhythm test proved less than its title | fixed: renamed to what it proves, and «ER-14 (0.3.15 review, iteration 3): a failed reading is answered again for MIN_INTERVAL_MS, then read anew» added (`test/work-rhythm.test.mjs`) |
| V3-6 | ER-15 | non-blocking | a rejected thread page dropped the whole waiting list | fixed: `main/commsWaitingList.ts#withWaitingList` drops the subjects only; test «ER-15 (0.3.15 review, iteration 3)» in `test/comms-waiting-list.test.mjs` |
| V3-7 | DO-10 | non-blocking | P-30 one iteration behind; no iteration 3 section | fixed: P-30 names iteration 3 and the final candidate; this section |
| V3-8 | DO-11 | non-blocking | the Rollout cited a runbook step it lacks, and Colima | fixed: the Rollout follows 0.3.14's «Rollout, as done» and drops the engine |
| V3-9 | DO-12 | non-blocking | the CHANGELOG's «Работает» left out the working heartbeat | fixed: CHANGELOG 0.3.15 names it |
| V3-10 | DA-15 | non-blocking | a connected agent holding its task past the hour vanished and its task read «without an agent» | fixed: `shared/homeProjects.ts#onWorkRow` keeps any agent that holds a task, «Простаивает»; `connectedIdle` counts only agents with no task (`shared/agentWork.ts#withWorkSignals`); test «DA-15 (0.3.15 review, iteration 3)» in `homeProjects.test.ts`, watched failing |
| V3-11 | DA-16 | non-blocking | the CHANGELOG said a quiet agent with no task stays in the left column | fixed: CHANGELOG says it is on Агенты only; V2-18 corrected by this row |
| V3-12 | DA-17 | non-blocking | the identity join does not reach the agent page | ruled: CO-475 extended |
| V3-13 | DA-18 | non-blocking | a display name can be a sibling repository's or shared | ruled: CO-481 |
| V3-14 | DA-19 | non-blocking | the waiting list and the strip can differ from the board and the chart | ruled: CO-482 |
| V3-15 | DA-20 | non-blocking | typing into a console counted as its output | fixed: `main/pty.ts` keeps `lastOutputAt` from output only and `main/index.ts#heldSessions` judges by it; test «typing moves the activity clock, never the output clock» in `test/delivery.test.mjs` |
| V3-16 | PL-8 | non-blocking | the Release section lacked the runbook's later steps | fixed: the «Release» section's ordered list |
| V3-17 | PL-9 | non-blocking | P-30's status one iteration behind | fixed: as DO-10 |
| V3-18 | PL-10 | non-blocking | the gap maps' closure only partly by row | fixed: the README names the rows not ticked and the evidence that stands for them |
| V3-19 | FV-1 (final verifier) | non-blocking | `shared/homeProjects.ts#onWorkRow` keeps any agent that holds a task, so a connected agent that is not silent but holds a task carried from an earlier session id is counted in «молчат» though it is not stale; the strip and the cards still reconcile | ruled: a wording row for the release of 2026-11-05, filed on `main` after the tag (the register cannot change after `verifiedCommit`) |
| V3-20 | FV-2 (final verifier) | non-blocking | a console that has not printed yet no longer counts as printed (`main/index.ts#heldSessions`, `outputAt` null until the first output), so its first minute reads «подключён», not «работает» | ruled: intended by DA-20 (V3-15); no row |
Exit for iteration 3: every finding has a disposition. Blocking findings open: none.
