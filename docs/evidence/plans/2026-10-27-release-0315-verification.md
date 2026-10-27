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

0.3.15 is the bundle alone (schema 98 unchanged). The Mac runs Fabric 0.3.14 on Colima, under the broker target
`fabric.desktop`. The rollout holds the broker target first (`lifecycle.py hold --target-id fabric.desktop`, released
after the swap), as [the runbook](../../launch/release-mac.md) says. The quit is the person's.
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
