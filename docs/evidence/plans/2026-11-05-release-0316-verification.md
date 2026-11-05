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
  started run, which ends; with the switch off nothing new starts and no decision is recorded (the on-demand spec §10,
  as amended in iteration 3, DO-5). It needs fabric-agent-adapter 0.63.0 on this Mac, which arrives with PassionCode
  launcher 0.2.76; the launcher waits for an analytics secret from the operator (the board, thread `cb1df3d5`), a human
  gate. If the check fails after 0.3.16 is published, a point release turns the switch off by default; the decision is
  the operator's (iteration 3, PL-8).
- Forty agent sessions at once on this Mac: the home, the left column and Агенты stay responsive.
- A live start of the local stack with the Docker engine stopped (CO-294's owed check; the 0.3.16 review, iteration 2,
  PL-6); expected: Colima's context becomes current (CO-508), not «the same context as before» (iteration 3, PL-5).
- The live upgrade of the installed schema-98 database through migrations 126 and 127 after a backup: 0.3.15 refuses the
  upgraded database and 0.3.16 opens it (the 1105 plan's release checklist, item 3; iteration 3, PL-5). The reboot check
  of CO-365 (item 2) is carried with CO-508 to the organization slice.
- `node scripts/release-mac.mjs --check-only --tag v0.3.16` on the commit to be tagged reads green before the tag is
  pushed, its result written here (iteration 3, PL-1).
- On `main` after the tag, one carry-over row for V3-56 to V3-59 (the verifier of `822560c5`, findings 2 to 5), since the
  register cannot change after `verifiedCommit`.
- On the board, threads `1add3c03` and `f7758225`: the `main` commit and the tag of 0.3.16, as promised on 2026-11-05; on
  thread `44c43a06`: one line to fabric-workspace that CO-409's dispatcher ships in 0.3.16 after all, correcting what
  Fabric said there on 2026-11-03 (iteration 3, PL-6).

## Iteration 1

Candidate `a6f0ffdabb84796b6480d3fdfb197f55a75eaf5d`. Five reviewers, one per level; their reports are in
[`docs/evidence/reviews/0.3.16/iteration-1/`](../reviews/0.3.16/iteration-1/). 52 findings, 15 blocking.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | Agent access did not open as a full page: the page rule never matched | fixed: the rule names the panel itself (`.ceo-panel.ceo-page`, `apps/desktop/src/renderer/src/launch/rail.css`) |
| V1-2 | UX-2 | blocking | twelve strings still sent the person to «Настройки → Доступ агентов» | fixed: every product and agent-facing string names Agent access in the left column, except the board's own `not_authorized` refusal (migrations 107 and 124), which needs a schema step: CO-507 (amended in iteration 3, PL-9) (14 files, `i18n/ru.ts`, `i18n/en.ts`, `main/hubCall.ts`, `main/agentSurface.ts`, `main/fabricMcp.ts` and others); text check reports `5c0ade5b` ru-RU, `922fccc5` en-US |
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
| V1-50 | PL-9 | non-blocking | a commit moved the workspace pin back four publications | fixed in iteration 3 (PL-1), replacing «not a defect»: the scheduled publication had failed since 2026-11-03, so the iteration-3 fixes set the `workspace` gitlink to its receipt's commit `77e81ea1b75eafd5b77a633508251708b8d3092e` (`docs/workspace-receipt.json`); `scripts/lib/release-mac.mjs#workspacePinProblem` reads null at the final candidate |
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

Candidate `344b09e8ee09e88b4e9adc38d5a1d97b60fb103d`. Five reviewers, one per level, read-only in a detached checkout; their reports are in
[`docs/evidence/reviews/0.3.16/iteration-3/`](../reviews/0.3.16/iteration-3/). 40 findings, 10 blocking. The dispositions of
iterations 1 and 2 held at the candidate except where the rows below take them up (V1-50, V2-15, V2-16).

Iteration 3's fixes made the candidate `23e1e89c56ed231b7db091793be92589e4d87739` (`fix(release 0.3.16): the third
review iteration's findings`). Two fresh verifiers read it read-only: the documents and plan dispositions held, verdict
«ready» ([report](../../reports/2026-11-05-release-0316/2026-11-05-final-candidate-docs-verification.md)); the code
dispositions held except one blocking defect, B-1, verdict «not ready»
([report](../../reports/2026-11-05-release-0316/2026-11-05-final-candidate-code-verification.md)). Its fix made the final
candidate `822560c5baec3d9cf4181e7f65acc8b79dd4819e` (`fix(release 0.3.16): the final candidate's verification`), which a
third fresh verifier read in full, with probes over the real dispatcher at both commits, verdict «ready»
([report](../../reports/2026-11-05-release-0316/2026-11-05-final-candidate-delta-verification.md)). The verifiers'
findings are V3-41 to V3-59 below. The final candidate is the release gate's `verifiedCommit`; the receipts and the
release gate name it, as 0.3.15 named its final candidate.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V3-1 | UX-1 | blocking | Settings' permissions line said one choice covers every agent Fabric starts; the board-request agent always runs with every permission | fixed: `settings.permissions.lede` says the choice is for the agents the person starts and a board-request agent always runs with every permission (ru and en; text check `af015c1e` ru-RU, `bcbb620c` en-US) |
| V3-2 | UX-2 | non-blocking | История's «Отметить прочитанным» marked the whole feed while a filter showed part of it | fixed: the mark is offered only when no «Кто» or «Проект» filter narrows the feed (`launch/HistoryScreen.tsx#HistoryScreen`); test `HistoryScreen.test.tsx` «offers no mark while «Кто» narrows the feed …», watched failing with the guard removed |
| V3-3 | UX-3 | non-blocking | a request given to the person after two empty runs reads as one nobody picked up | ruled: CO-409 (a kind and words of its own in «На проверке») |
| V3-4 | UX-4 | non-blocking | the console's top bar and back link still led with the runner | fixed: `consoles.sessionTitle` «Сессия · {project} · {runner}» and `session.back` «← {project} · {runner}» in ru and en (text check `3890a5fb` ru-RU, `f4c4dc14` en-US) |
| V3-5 | UX-5 | non-blocking | «Поручить агенту B» writes its notes in Russian whatever the interface language | ruled: CO-511 |
| V3-6 | UX-6 | non-blocking | Agent access as a page was a complementary landmark inside the place's main | fixed: as a page it is a labelled `section`, as a side panel it stays an `aside` (`AgentAccessPanel.tsx`) |
| V3-7 | ER-1 | blocking | closing a given-up request was retried every minute forever on a permanent error | fixed: at most `CLOSE_ATTEMPTS` (5) tries, then one `gave_up` line (`main/boardDispatchRun.ts#createBoardDispatch`); test `test/board-dispatch-run.test.mjs` «iteration 3, ER-1: …» |
| V3-8 | ER-2 | blocking | a run Switchboard reports `unknown` never counted as empty, so the stop after two never fired | fixed: a run Switchboard cannot report on, ended with its request unsettled, counts as empty; tests «iteration 3, ER-2: …» and «ER-3: a run Switchboard cannot report on frees its place …» |
| V3-9 | ER-3 | non-blocking | a workflow the run closed itself made every later take-back fail | fixed: Observatory's `WorkflowClosed` gives the request a new workflow; test «iteration 3, ER-3: …» |
| V3-10 | ER-4 | non-blocking | a `starting` record with the switch off never ended and kept the board read every minute | fixed: with the switch off a pending start ends as `unknown`, and the board is read only while a run is in flight; test «iteration 3, ER-4, DO-2: …» |
| V3-11 | ER-5 | non-blocking | the take-back can steal a live run's lease and comes before the spec's 120 s of silence | ruled: CO-409 |
| V3-12 | ER-6 | non-blocking | a persistent refusal is retried every 10 minutes for the request's life | ruled: CO-409 |
| V3-13 | ER-7 | non-blocking | an accepted request past its deadline Fabric never started for reaches the person as a log line only | ruled: CO-409 |
| V3-14 | ER-8 | non-blocking | the records file is checked for two fields only | ruled: CO-409 |
| V3-15 | ER-9 | non-blocking | a workflow is left open on a quit between open and record, or a lost first checkpoint | ruled: CO-409 |
| V3-16 | ER-10 | non-blocking | `noteOf` kept paths after `:`, `~`, `[`, `,` and in `file://` URLs | fixed: `noteOf` drops everything from a path after any of those, a `file://` URL, `~` or a drive letter (`main/boardDispatchRun.ts#noteOf`); test `test/board-dispatch-run.test.mjs` «iteration 3, ER-10, DA-4: …», watched failing with iteration 2's pattern |
| V3-17 | ER-11 | non-blocking | `callOpName` counts empty and unknown MCP names | ruled: CO-509 |
| V3-18 | ER-12 | non-blocking | the start's fold re-reads the hourly month file once per missing day | ruled: CO-509 |
| V3-19 | DA-1 | blocking | two verbatim operator statements remained (CO-492, CO-505) | fixed: as DO-1 |
| V3-20 | DA-2 | blocking | trimming the records dropped a request's only record and its count of empty runs | fixed: a request's newest record is kept while the board can hold the request (`KEEP_REQUEST_MS`, 8 days), records in flight always, the rest the newest 500; test «iteration 3, DA-2: …»; completed by V3-41 (B-1) |
| V3-21 | DA-3 | non-blocking | a digest write that fails before the operations log exists is said nowhere | ruled: CO-509 |
| V3-22 | DA-4 | non-blocking | `noteOf` kept paths after `:`, `[`, `,` or `file://` | fixed: as ER-10 |
| V3-23 | DA-5 | non-blocking | the notes said the board is not read with the switch off | fixed: as DO-2 |
| V3-24 | DO-1 | blocking | four verbatim operator quotations remained, two wrapping a line | fixed: paraphrased in the on-demand spec §8, CO-492, CO-505 and the board-delivery report, and the report's rule name; a rescan joining consecutive added lines, for «…» after «operator» or «оператор» with no length floor, finds only interface strings, rule names and reviewers' quotations |
| V3-25 | DO-2 | blocking | the notes said the board is not read with the switch off | fixed: CHANGELOG says nothing new starts, a pending start ends and the board is read only to follow a run in flight; `AGENTS.md`'s dispatcher row and the spec §6 say the same; code as ER-4 |
| V3-26 | DO-3 | blocking | `AGENTS.md` said the records file holds at most 500 records | fixed: the row names every record in flight, each request's newest for 8 days and of the rest the newest 500; code as DA-2 |
| V3-27 | DO-4 | non-blocking | ADR-0188's amendment and CO-500 pointed away from CO-509; CO-411 named one slot | fixed: ADR-0188 amendment of 2026-11-05 (DO-4), a note in CO-500 and in CO-411 |
| V3-28 | DO-5 | non-blocking | the on-demand spec stated permissions, the grant and `skipped-off` as current | fixed: §2, §6 and §10 corrected; the wave row points at CO-409, which lists the five unbuilt items |
| V3-29 | DO-6 | non-blocking | the agents-and-logs spec, CO-499 and the sweep row described CO-499 and CO-498 as first built | fixed: dated amendments under §2.1 and §2.2, a note in CO-499, the sweep row describes the let-go of a claim whose task left work (`claim-closed`) |
| V3-30 | DO-7 | non-blocking | code comments in `dockerLaunch.ts` and `boardDispatch.ts` said the old thing | fixed: the region header says `colima start` makes Colima's context current (CO-508); the 24-hour count and the switch's label |
| V3-31 | DO-8 | non-blocking | «Owed in 0.3.16's Release close» placed the adapter prerequisite under the forty-sessions bullet | fixed: the section above |
| V3-32 | PL-1 | blocking | the release preflight refuses the candidate's workspace pin | fixed: as V1-50's new disposition; `--check-only` is owed on the commit to be tagged (section above) |
| V3-33 | PL-2 | blocking | the notes said the board is not read with the switch off and that runs on Windows are not in the release | fixed: as DO-2; the CHANGELOG says the dispatcher has not been tried on Windows yet |
| V3-34 | PL-3 | non-blocking | board promises made after the candidate had no register home | fixed: CO-409 carries the new workflow on `WorkflowClosed` (built) and CO-509 the stop hour before the fold and `OP_NAME`; CO-509's status names every open item |
| V3-35 | PL-4 | non-blocking | the board's dates had no release before 2026-11-21 | fixed: CO-409's, CO-509's and CO-503's date cells say on `main` by the date, shipped in the release after 0.3.16 |
| V3-36 | PL-5 | non-blocking | the Release close omitted the schema-100 upgrade and CO-365, and expected an unchanged docker context | fixed: the section above; the 1105 plan's checklist corrected |
| V3-37 | PL-6 | non-blocking | board follow-ups beyond `1add3c03` were owed nowhere | fixed: the section above names `f7758225` and `44c43a06` |
| V3-38 | PL-7 | non-blocking | P-29 and the 1105 plan named the scope wrongly | fixed: P-29 names CO-411, CO-454, CO-439's first part, CO-492, CO-502 and CO-365 as not shipping; CO-411's, CO-454's, CO-439's and CO-365's date cells; the 1105 plan's widening note and CO-294 row |
| V3-39 | PL-8 | non-blocking | no fallback if the dispatcher's live check fails | fixed: the section above |
| V3-40 | PL-9 | non-blocking | V1-2's disposition overstated the strings | fixed: V1-2's cell amended |
| V3-41 | FV-B1 (verifier of 23e1e89c, code) | blocking | the trim dropped a to-operator record older than 8 days, so the request could be dispatched again | fixed in `822560c5`: a request's newest record stays while the request can come back (8 days, its own deadline kept as `until`, or read on the board this pass) (`main/boardDispatchRun.ts#createBoardDispatch`); tests «final candidate, B-1: …», watched failing on `23e1e89c`'s dispatcher |
| V3-42 | FV-NB1 (verifier of 23e1e89c, code) | non-blocking | the closed-workflow check matched «closed», which a dropped connection also says | fixed in `822560c5`: matched by the typed name `WorkflowClosed`; test «final candidate, NB-1: …», watched failing |
| V3-43 | FV-NB2 (verifier of 23e1e89c, code) | non-blocking | the switch ends a pending start whose run may already be live; a later start uses a new dispatch id | ruled: CO-409 |
| V3-44 | FV-NB3 (verifier of 23e1e89c, code) | non-blocking | `noteOf` let a path through after a backtick, `<`, `;`, `|` or `{` | fixed in `822560c5`: the five characters added, with cases in «iteration 3, ER-10, DA-4: …» |
| V3-45 | FV-NB4 (verifier of 23e1e89c, code) | non-blocking | two comments kept the runner-first order | fixed in `822560c5` (`App.tsx`, `SessionWindow.test.tsx`) |
| V3-46 | FV-NB5 (verifier of 23e1e89c, code) | non-blocking | the 24-hour cap can undercount by one per request after a trim | ruled: CO-409 |
| V3-47 | FV-NB6 (verifier of 23e1e89c, code) | non-blocking | a placeholder line in this section | fixed: the paragraph above |
| V3-48 | FV-N1 (verifier of 23e1e89c, docs) | non-blocking | CO-439's date cell said shipped for the whole row | fixed in `822560c5`: part 1 shipped, parts 2 and 3 keep their date |
| V3-49 | FV-N2 (verifier of 23e1e89c, docs) | non-blocking | the on-demand spec §3.3 said `skipped-off` is recorded | fixed in `822560c5`: §3.3 says nothing is recorded with the switch off |
| V3-50 | FV-N3 (verifier of 23e1e89c, docs) | non-blocking | the CHANGELOG named Windows alone as not tried | fixed in `822560c5`: Windows and Linux |
| V3-51 | FV-N4 (verifier of 23e1e89c, docs) | non-blocking | the CHANGELOG's board-rule bullet stated the stop before production as enforced | fixed in `822560c5`: the rule tells the session, nothing else enforces it |
| V3-52 | FV-N5 (verifier of 23e1e89c, docs) | non-blocking | V3-29 said the sweep row names `claim-closed` | fixed: V3-29's cell says the row describes it |
| V3-53 | FV-N6 (verifier of 23e1e89c, docs) | non-blocking | Windows fixture homes `C:\Users\p` in a test | fixed in `822560c5`: `C:\Users\example` (`apps/desktop/test/agent-registry.test.mjs`) |
| V3-54 | FV-N7 (verifier of 23e1e89c, docs) | non-blocking | the text-check ids could not be re-read | not a defect: Copylot keeps the reports by id (`copylot_check` answers `reportId`); no tool here reads one back |
| V3-55 | FV2-1 (verifier of 822560c5) | non-blocking | a far deadline keeps a request's record past the 8 days | not a defect: growth stays bounded by at most 20 dispatches per project a day and one kept record per request |
| V3-56 | FV2-2 (verifier of 822560c5) | non-blocking | an unparsable deadline ends the whole pass (earlier than this change) | ruled: a carry-over row filed on `main` after the tag (the register cannot change after `verifiedCommit`) |
| V3-57 | FV2-3 (verifier of 822560c5) | non-blocking | a run whose request was not read ends without counting as empty (earlier than this change) | ruled: a carry-over row filed on `main` after the tag (the register cannot change after `verifiedCommit`) |
| V3-58 | FV2-4 (verifier of 822560c5) | non-blocking | a test stand-in throws a made-up closed-workflow message | ruled: a carry-over row filed on `main` after the tag (the register cannot change after `verifiedCommit`) |
| V3-59 | FV2-5 (verifier of 822560c5) | non-blocking | two comments in `SessionWindow.tsx` keep the runner-first order | ruled: a carry-over row filed on `main` after the tag (the register cannot change after `verifiedCommit`) |

Exit for iteration 3: every finding has a disposition. Blocking findings open: none.
