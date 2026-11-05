# Fabric 0.3.16 release verification

Release gate ledger for 0.3.16 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02,
P-29). Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under
[`docs/evidence/reviews/0.3.16/`](../reviews/0.3.16/).

## Protocol

- Baseline: tag `v0.3.15`. The reviewers read one clean checkout of the candidate (disk below 8 GB on 2026-11-05, so
  no checkout of their own), wrote nothing in it and recorded HEAD and `git status --short | wc -l` before and after.
- The review copies are redacted for publication (ADR-0096): private names replaced, home paths made `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.

## Owed in 0.3.16's Release close

- The person's look at the opened 0.3.16, carried from 0.3.15's Release close (the 0.3.16 review, iteration 1, PL-10).
- A live run of the board dispatcher on this Mac: a request filed to a project with no live session is answered by a
  started run, which ends; with the switch off nothing starts (the on-demand spec §10).
- Forty agent sessions at once on this Mac: the home, the left column and Агенты stay responsive.
  The live dispatcher check needs fabric-agent-adapter 0.63.0 on this Mac, which arrives with PassionCode launcher
  0.2.76; the launcher waits for an analytics secret from the operator (the board, thread `cb1df3d5`), a human gate.
- A live start of the local stack with the Docker engine stopped (CO-294's owed check; the 0.3.16 review, iteration 2,
  PL-6).
- On the board, thread `1add3c03`: the main commit and the tag of 0.3.16, as promised to two projects on 2026-11-05.

## Iteration 1

Candidate `a6f0ffdabb84796b6480d3fdfb197f55a75eaf5d`. Five reviewers, one per level; their reports are in
[`docs/evidence/reviews/0.3.16/iteration-1/`](../reviews/0.3.16/iteration-1/). 52 findings, 15 blocking.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | Agent access did not open as a full page: the page rule never matched | fixed: the rule names the panel itself (`.ceo-panel.ceo-page`, `apps/desktop/src/renderer/src/launch/rail.css`) |
| V1-2 | UX-2 | blocking | twelve strings still sent the person to «Настройки → Доступ агентов» | fixed: every product and agent-facing string names Agent access in the left column (14 files, `i18n/ru.ts`, `i18n/en.ts`, `main/hubCall.ts`, `main/agentSurface.ts`, `main/fabricMcp.ts` and others); text check reports `5c0ade5b` ru-RU, `922fccc5` en-US |
| V1-3 | UX-3 | blocking | the Comms unread count was not part of the link's accessible name | fixed: `aria-labelledby` names the word and the count (`launch/LaunchShell.tsx#LaunchShell`); test `Rail.test.tsx` «UX-3: «Переписка» says its unread count in its accessible name» |
| V1-4 | UX-4 | non-blocking | the release notes left out user-visible changes | fixed: CHANGELOG `## Unreleased` names CO-494, CO-458, CO-457, CO-478, CO-460, CO-456, the agents' lines (CO-459, CO-467, CO-470, CO-473, CO-472, CO-475, CO-483, CO-471, CO-481, CO-484), CO-474 and the smaller fixes |
| V1-5 | UX-5 | non-blocking | scenarios and the lifecycle row still placed Comms and Agent access in Settings | fixed: SCN-132, SCN-133 and SCN-143 amended 2026-11-05 (`docs/ux/scenarios.md`); the Comms count row in `AGENTS.md` |
| V1-6 | UX-6 | non-blocking | a rail row with no project showed the runner twice | fixed: the small line says «Без проекта» when the title is the runner (`launch/LaunchShell.tsx#LaunchShell`) |
| V1-7 | UX-7 | non-blocking | the Switchboard sessions panel shows raw ids and old rows after a failed read | ruled: CO-507 |
| V1-8 | UX-8 | non-blocking | another session's lease shows an id; the rail's star lags a pin from the project page | ruled: CO-507 |
| V1-9 | UX-9 | non-blocking | the resize separator had no value text, no Home and End, no pointercancel | fixed: `aria-valuetext` (`rail.resizeValue`), Home and End to the bounds, `pointercancel` ends a drag (`launch/LaunchShell.tsx#LaunchShell`); test `Rail.test.tsx` «0.3.16 review, UX-9: …» |
| V1-10 | ER-1 | blocking | a timed-out or refused start kept no record, so passes duplicated agents and workflows | fixed: the record is written `starting` before Switchboard is asked and the next pass asks again with the same workflow, hand-over and dispatch id; a refusal or a start that never answered waits `REFUSAL_BACKOFF_MS` and reuses its workflow (`apps/desktop/src/main/boardDispatchRun.ts#createBoardDispatch`); tests `test/board-dispatch-run.test.mjs` «ER-1, ER-2: …» and the refusal case |
| V1-11 | ER-2 | blocking | a quit or crash during a start left no record, so a restart started a second run | fixed: as ER-1, and no Switchboard call or start once quitting (`DispatchDeps.quitting`); test «ER-2: quitting starts nothing and asks Switchboard nothing» |
| V1-12 | ER-3 | non-blocking | a run Switchboard cannot report on held its place forever | fixed: past its end plus `UNKNOWN_AFTER_END_MS` it ends with outcome `unknown`, not an empty run; test «ER-3: …» |
| V1-13 | ER-4 | blocking | «two runs … go to the operator in «На проверке»» was false | fixed: two empty runs close the workflow (taken back first) and mark the request `to-operator`; the sweep shows it in «На проверке» in any open state (`apps/desktop/src/shared/abandonedSweep.ts#findAbandoned`, `SweepRequest.toOperator`); tests «PL-1: …» in `board-dispatch-run.test.mjs` and `abandonedSweep.test.ts` «CO-409 (0.3.16 review, PL-1): …» |
| V1-14 | ER-5 | blocking | a run started beside a live session after the grace, contrary to the notes | fixed: a project with a live session never gets a second agent (`apps/desktop/src/shared/boardDispatch.ts#decideDispatch`); test `boardDispatch.test.ts` «0.3.16 review (ER-5, DO-2): …»; the spec's wave row says the wake of §3.2 is not built |
| V1-15 | ER-6 | non-blocking | a run was judged on the previous pass's request state | fixed: runs are watched after this pass's read, and a state not read leaves the run for a later pass; test «ER-6: …» |
| V1-16 | ER-7 | non-blocking | the board was read every minute with the switch off | fixed: with the switch off and nothing in flight nothing is read; test «ER-7: …» |
| V1-17 | ER-8 | non-blocking | `colima start` activates its own docker context | ruled: CO-508 |
| V1-18 | ER-9 | non-blocking | the digest drops a day after a long gap and is never pruned | ruled: CO-509 |
| V1-19 | ER-10 | non-blocking | `app.started` is written before the ops sink exists | ruled: CO-508 |
| V1-20 | ER-11 | non-blocking | CO-499 let go of a claim taken on a task already in review | fixed: a claim on a review or backlog task is let go only when the task moved there after the claim was taken; done and cancelled always (`abandonedSweep.ts#findAbandoned`, `SweepClaim.taskMovedAt`, `main/workRead.ts` reads `moved_at`); test `abandonedSweep.test.ts` «0.3.16 review, ER-11: …» |
| V1-21 | DO-1 | blocking | the notes said two empty runs go to «На проверке» | fixed: as ER-4; CHANGELOG says what is built |
| V1-22 | DO-2 | blocking | the notes and help said no run starts beside a live session | fixed: as ER-5, the code now matches the words |
| V1-23 | DO-3 | blocking | the lifecycle table had no row for the board dispatcher | fixed: rows for the board dispatcher and Switchboard's sessions on Агенты; the Windows and Linux paragraph names both background reads (`AGENTS.md`, Lifecycle) |
| V1-24 | DO-4 | blocking | CO-474's note was written into the released 0.3.15 section | fixed: the 0.3.15 section reads as it did at the tag; CO-474 is in `## Unreleased` |
| V1-25 | DO-5 | non-blocking | «forty agents» claimed the agent pages are throttled too | fixed: the CHANGELOG names the home and the left column only |
| V1-26 | DO-6 | non-blocking | three lifecycle rows were stale | fixed: the Comms count row, the home reading's git in every held session's folder, the Switchboard sessions row (`AGENTS.md`) |
| V1-27 | DO-7 | non-blocking | «Settings → Agent access» still named in strings and docs | fixed: as UX-2; ADR-0186 amended |
| V1-28 | DO-8 | non-blocking | ADR-0186 decision 4 says organization machines are unchanged; the code allows everywhere | fixed: ADR-0186 amendment of 2026-11-05 says what the code does; the narrowing is CO-506 |
| V1-29 | DO-9 | non-blocking | the notes left out `fabric_task_close` and other changes | fixed: as UX-4 |
| V1-30 | DO-10 | non-blocking | migration 127's header says 126 shipped in 0.3.15 | not a defect: migration texts are fixed by their hashes in `supabase/migration-ledger.json` (CO-199) and are not edited; the release notes' Upgrading paragraph, which a person reads, is correct |
| V1-31 | DO-11 | non-blocking | the on-demand spec described unbuilt parts as current | fixed: the spec's wave row of 2026-11-05 names what 0.3.16 builds and what it does not (§7, §6.1, §8, §3.2, the fallback agent, Windows) |
| V1-32 | DO-12 | non-blocking | ADR-0188 says the digest folds the journal and the retros | fixed: ADR-0188 amendment of 2026-11-05 |
| V1-33 | DO-13 | non-blocking | private names were added to living public files | fixed: as DA-1 |
| V1-34 | DO-14 | non-blocking | an em dash in the design map | fixed: `docs/reports/map.html` iteration-2026-10-28-contract-repin |
| V1-35 | DA-1 | blocking | private names, a personal port and verbatim operator quotes were added to the public repository | fixed: every flagged term on the lines added since 0.3.15 replaced with neutral words, the operator's words paraphrased (ADR-0096 §5), the notification gateway's address moved to the vault slot `fabric/prod/COMMUNICATOR_URL` (`scripts/lib/communicator-notify.mjs`, `scripts/lib/bounded-run.mjs#tellChat`); `check_private.py` over the lines added since v0.3.15 prints 0; the earlier history stays as published (ADR-0096's history decision is the operator's) |
| V1-36 | DA-2 | non-blocking | a refused start opened a new workflow every minute | fixed: as ER-1 |
| V1-37 | DA-3 | non-blocking | the dispatcher writes no journal events | ruled: CO-409 (the spec's wave row says §7 is not built in 0.3.16) |
| V1-38 | DA-4 | non-blocking | «Поручить агенту B» files a second task on a retry | ruled: CO-510 |
| V1-39 | DA-5 | non-blocking | migration 126 and 127 headers misstate what shipped | not a defect: as DO-10 |
| V1-40 | DA-6 | non-blocking | the digests' size was understated and the dispatcher's files unlisted | fixed: the lifecycle rows say about 1 to 3 MB a month and list `board-dispatches.json` and the Observatory child; pruning is CO-509 |
| V1-41 | DA-7 | non-blocking | dispatcher notes could carry absolute paths | fixed: `noteOf` replaces paths with `<path>` in every note (`main/boardDispatchRun.ts#noteOf`) |
| V1-42 | PL-1 | blocking | the to-operator decision was only a log line | fixed: as ER-4 |
| V1-43 | PL-2 | blocking | the notes left out most of the release and the 0.3.15 section was edited after its tag | fixed: as UX-4 and DO-4 |
| V1-44 | PL-3 | blocking | the consent strings still sent the person to Settings | fixed: as UX-2 |
| V1-45 | PL-4 | non-blocking | P-29 still said the release takes no new scope | fixed: P-29 records the widening of 2026-11-05 (`docs/evidence/backlog.md`) |
| V1-46 | PL-5 | non-blocking | parts of the on-demand spec are not in this release | fixed: as DO-11; they stay in CO-409 and CO-496 |
| V1-47 | PL-6 | non-blocking | `com.enroll` still said never to reply only with a state | fixed: the description says a state with its nearest date answers too (DEC-0152) (`apps/desktop/src/main/boardTools.ts`); test `test/board-service.test.mjs` «com.enroll's description names the route …» |
| V1-48 | PL-7 | non-blocking | CO-463 still open though migration 126 did it | fixed: CO-463 resolved in the register |
| V1-49 | PL-8 | non-blocking | no lifecycle row for the dispatcher | fixed: as DO-3 |
| V1-50 | PL-9 | non-blocking | a commit moved the workspace pin back four publications | not a defect: the scheduled publication pins the newest snapshot after the release commit lands (`node scripts/workspace.mjs check --allow-pending 6`) |
| V1-51 | PL-10 | non-blocking | 0.3.15's «the person's look at the opened 0.3.15» is neither done nor carried | fixed: «Owed in 0.3.16's Release close» above carries it |
| V1-52 | PL-11 | non-blocking | CO-503's row did not carry the date given on the board | fixed: CO-503 decides by 2026-11-18 (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) |

Exit for iteration 1: every finding has a disposition. Blocking findings open: none.

## Iteration 2

Candidate `37ec0410583cb6e0141a0366d0b3ebd8d5892d37`. Five reviewers, one per level, read the same checkout read-only; their reports are in
[`docs/evidence/reviews/0.3.16/iteration-2/`](../reviews/0.3.16/iteration-2/). 41 findings, 7 blocking. Every
iteration-1 fix the reviewers checked held.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V2-1 | UX-1 | blocking | the switch's help said the agent stops before production, which nothing enforces | fixed: the help says the agent runs with every permission and its instructions tell it to stop before production (`settings.dispatchHelp`, ru and en; text check `aecab303` ru-RU, `ac41ff7d` en-US); the CHANGELOG says the same |
| V2-2 | UX-2 | non-blocking | the switch did nothing silently without Switchboard or a default agent | fixed: the help and the CHANGELOG say nothing starts without Switchboard and a default agent of Claude Code or Codex, and the operations log says why (`deferred-no-agent`) |
| V2-3 | UX-3 | non-blocking | the top bar, tooltip and console button still led with the runner | fixed: `rail.agentTitle` reads «{project} · {runner}» in ru and en, used by the top bar (`App.tsx`), the rail tooltip and the console button; test `Rail.test.tsx` «opens an agent's session from the console icon …» |
| V2-4 | UX-4 | non-blocking | the notes promised a folder on the task page's agent card | fixed: the CHANGELOG says the card leads with the project and the runner; a never-run task's heading is ruled CO-507 |
| V2-5 | UX-5 | non-blocking | «Ширина {px} пикселей» was wrong Russian for some widths | fixed: «Ширина колонки {px} px» / "Column width {px} px" (`rail.resizeValue`); test `Rail.test.tsx` «0.3.16 review, UX-9: …» |
| V2-6 | UX-6 | non-blocking | the drag handle is 3 px and has no single-pointer alternative | ruled: CO-507 |
| V2-7 | UX-7 | non-blocking | page breakpoints assume a 216 px column | ruled: CO-507 |
| V2-8 | ER-1 | non-blocking | a run whose request is no longer read never ended | fixed: past its end plus `UNKNOWN_AFTER_END_MS` it ends as unknown (`main/boardDispatchRun.ts#createBoardDispatch`); test `test/board-dispatch-run.test.mjs` «iteration 2, ER-1: …» |
| V2-9 | ER-2 | non-blocking | two empty runs reached the operator only while the request was a candidate | fixed: two empty runs give the request to the operator whatever path the decision takes; test `test/board-dispatch-run.test.mjs` «iteration 2, ER-2, ER-3: …» |
| V2-10 | ER-3 | non-blocking | a failed close left the request unmarked | fixed: the request is marked first and the close is retried each pass (`DispatchRecord.closed`); same test |
| V2-11 | ER-4 | non-blocking | a superseded lease made every later pass fail | fixed: a failing write under the held lease drops it and takes the workflow back |
| V2-12 | ER-5 | non-blocking | a failing offer opened a new workflow every pass | fixed: an open that failed waits `REFUSAL_BACKOFF_MS` for that request; test `test/board-dispatch-run.test.mjs` «iteration 2, ER-5: …» |
| V2-13 | ER-6 | non-blocking | with the switch off a pending start was asked again | fixed: no Switchboard call while the switch is off; test `test/board-dispatch-run.test.mjs` «iteration 2, ER-6: …» |
| V2-14 | ER-7 | non-blocking | the back-off counted from the record's creation and refusals used up the day | fixed: the back-off counts from `endedAt`; only started runs count against the 24 hours; test `test/board-dispatch-run.test.mjs` «iteration 2, ER-7, DA-3: …» |
| V2-15 | ER-8 | non-blocking | trimming could drop a to-operator record | fixed: records in flight or given to the operator are never trimmed; test `test/board-dispatch-run.test.mjs` «iteration 2, ER-8, DA-2: …» |
| V2-16 | DO-1 | blocking | verbatim operator quotes remained in lines added since v0.3.15 | fixed: 31 quotes paraphrased (ADR-0096 §5) in code comments, a test, ADR-0188, the ADR index, the on-demand and logs specs, the carry-over register, the backlog, the 1105 plan, two reports, the map and a review copy; a scan of every line added since v0.3.15 for «…» of six or more Russian words finds only interface strings and reviewers' quotations of them |
| V2-17 | DO-2 | blocking | three texts said Fabric never changes the docker context | fixed: CHANGELOG, `AGENTS.md` (Local Supabase row) and the SCN-161 amendment say `colima start` makes Colima's context current (CO-508) |
| V2-18 | DO-3 | blocking | four places still said «Settings → Agent access» | fixed: `AGENTS.md` (the fabric-mcp row and the hub paragraph), SCN-132 step 3; ADR-0186 amended (decision 3) |
| V2-19 | DO-4 | non-blocking | rows still said the release takes no new scope; the digest's journal counts had no home | fixed: eight register rows reworded; the journal counts are in CO-509 |
| V2-20 | DO-5 | non-blocking | the on-demand spec described unbuilt behaviour as current | fixed: §3.3's switch label and the 24-hour count; the wave row names the cycle-only dispatch, `crash`, the mandate, `com.get`, `timed-out` as not built |
| V2-21 | DO-6 | non-blocking | `--permissions all` was not said | fixed: the CHANGELOG and the switch's help say it |
| V2-22 | DO-7 | non-blocking | «Поручить агенту B» was said to answer when the task is done | fixed: the CHANGELOG says only a done release by the task's agent answers it |
| V2-23 | DO-8 | non-blocking | `fabric_task_close` was said to need the source | fixed: the CHANGELOG says the words and their date are required, the source when the relay names one (`main/hubAuthority.ts#decisionSchema`) |
| V2-24 | DO-9 | non-blocking | three lifecycle rows were incomplete | fixed: the Windows and Linux paragraph, the sweep row (CO-499, CO-409) and the workspace-sync row (two vault slots) in `AGENTS.md` |
| V2-25 | DO-10 | non-blocking | no scenario for the switch; a /Users/p fixture; the map's throttle claim | fixed: SCN-147 amended 2026-11-05; `test/docker-launch.test.mjs` uses `/Users/example`; the map entry says the throttle covers the home and the left column |
| V2-26 | DA-1 | blocking | verbatim operator statements in public lines | fixed: as DO-1 |
| V2-27 | DA-2 | blocking | the 500-record bound evicted to-operator records | fixed: as ER-8 |
| V2-28 | DA-3 | non-blocking | refusals counted against the daily cap | fixed: as ER-7 |
| V2-29 | DA-4 | non-blocking | the records file was read without validation and written without sync | fixed: a list of records only, anything else logged and read as empty; written whole, synced, renamed (`main/boardDispatchWiring.ts#wireBoardDispatch`) |
| V2-30 | DA-5 | non-blocking | a path with spaces survived `noteOf` | fixed: everything from the first absolute path is dropped; Switchboard's stderr reaches no note except its refusal code (`noteOf`, `boardDispatchWiring.ts` `run`) |
| V2-31 | DA-6 | non-blocking | review copies named the gateway's route; the chat notice carried the log's path | fixed: the copies redacted and rehashed; the notice names the log file only (`scripts/workspace.mjs`); `AGENTS.md` names both slots |
| V2-32 | PL-1 | blocking | the docker context claim | fixed: as DO-2 |
| V2-33 | PL-2 | non-blocking | CO-409 did not carry what the spec's wave row says it does | fixed: CO-409 names what 0.3.16 builds and what stays open |
| V2-34 | PL-3 | non-blocking | the two dispatcher gaps promised by 2026-11-12 were not in CO-409 | fixed: CO-409 carries both with 2026-11-12 |
| V2-35 | PL-4 | non-blocking | CO-509 lacked the grammar and sleep items and the board's date | fixed: CO-509 carries both and decides by 2026-11-18 |
| V2-36 | PL-5 | non-blocking | eight rows said no new scope; CO-494 named the permissions screen | fixed: as DO-4; CO-494 says the grant is revoked in Agent access |
| V2-37 | PL-6 | non-blocking | CO-365 and CO-294 were neither closed nor re-dated | fixed: CO-365 waits on CO-508; CO-294's live start is in «Owed in 0.3.16's Release close» |
| V2-38 | PL-7 | non-blocking | P-29 overstated the date and the shipped rows | fixed: P-29 says the tag aims at 2026-11-06 and CO-461, CO-464 are not shipped |
| V2-39 | PL-8 | non-blocking | the Release close lacked the adapter prerequisite and the board follow-ups | fixed: both are in «Owed in 0.3.16's Release close» |
| V2-40 | PL-9 | non-blocking | CO-496 recorded one of two board dates | fixed: CO-496 names both |
| V2-41 | PL-10 | non-blocking | CO-502 said Fabric counts retros written | fixed: CO-502 says Fabric counts those asked, Observatory those written |

Exit for iteration 2: every finding has a disposition. Blocking findings open: none.

## Iteration 3

_Not started._
