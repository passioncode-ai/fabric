# Fabric 0.3.19 release verification

Release gate ledger for 0.3.19 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.19/`.

0.3.19 carries CO-559 (every addressee on the board woken and watched, [the on-demand spec
§3.8](../specs/2026-11-04-on-demand-sessions.md#38-every-addressee-woken-and-watched-co-559)), CO-561, CO-556, CO-551
stage A, the scenario walk of 2026-11-11, and 0.3.18, which was not published on its own (the decision is in
[the 0.3.18 handoff](../../handoffs/2026-11-09-release-0318.md#decisions)).

## Protocol

- Baseline: `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`, 0.3.18's release commit, never tagged. The reviewers read one
  clean detached checkout of the candidate, write nothing in it and record HEAD and `git status --short | wc -l`
  before and after.
- Tests are run by file on the twin worktree at the same commit, under `nice -n 10`, one run at a time.
- The review copies are redacted for publication (ADR-0096): home paths are `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- Machine load on 2026-11-11 ran from 90 to 140 on 14 cores and the disk filled once (ENOSPC, cleared by pruning tool
  caches and a merged worktree); a timing test that fails under that load and passes alone is recorded as such.

## What 0.3.19 carries

Schema 100 to 101: one migration, `supabase/migrations/20261111000128_board_inbox_operator.sql`. The `## 0.3.19`
section of [`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change since 0.3.17, 0.3.18's included.

## Iteration 1

Candidate `3138e829902836d54f1a796b590fa4f04e94c869` (the scenario walk's fixes on `board-clockwork`; the fast gate
green on it but for `claude-owned-stdio` under the Electron runner at load 133, which passed alone twice). Five
reviewers, one per level; their reports and receipts are in `docs/evidence/reviews/0.3.19/iteration-1/`. 42 findings,
7 blocking (UX-1, ER-1, ER-2, DO-1, PL-1, PL-2, PL-3). The fix wave is `d08877d6`; every new test was watched failing on
the old code. Text check reports of the strings the wave changed are cited in SCN-147 and in each row.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | the dispatch switch and its help named board requests alone while it also starts runs for messages | fixed in d08877d6: «Запускать агента, когда проекту на доске пишут, а взять некому» and its help in both locales (`i18n/ru.ts`, `i18n/en.ts` `settings.dispatch`, `settings.dispatchHelp`), copy checks a4f221c6, 895901cb, 0efdb079, b0373758; SCN-147 amended |
| V1-2 | UX-2 | non-blocking | the inbox row was titled as an answer from another project | fixed in d08877d6: `attention.untitled.inbox` («Непрочитанные сообщения проекту на доске»), `attentionTitle.ts`; copy checks 78477572, fcbcdf8d |
| V1-3 | UX-3 | non-blocking | the inbox row said Fabric starts no more runs while a newer message gets one | fixed in d08877d6: `attention.swept.inbox-to-operator` says three runs and that a newer message gets one more; copy checks caa8964b, e4f59e13 |
| V1-4 | UX-4 | non-blocking | a run lost on another machine reads as given to the operator | ruled: CO-562 item 8 |
| V1-5 | UX-5 | non-blocking | the review cap was said as someone at work hidden | fixed in d08877d6: its own line `launch.home.work.reviewCapped` (`HomeWork.tsx#CappedNote`), test `HomeWork.test.tsx` «0.3.19 review UX-5»; copy checks 72fc5d6b, abc6876a |
| V1-6 | UX-6 | non-blocking | a cut waiting list lost the CO-482 caveat | fixed in d08877d6: `launch.home.boardWaiting.partialCut` says both; test `HomeBoardWaiting.test.tsx` «0.3.19 review UX-6 and UX-8»; copy checks 4c72ffba, cc249f6d |
| V1-7 | UX-7 | non-blocking | the notes sent the person to a Settings row for dispatchTarget that does not exist | fixed in d08877d6: CHANGELOG and AGENTS.md name the `dispatchTarget` key of settings.json and say Settings has no row |
| V1-8 | UX-8 | non-blocking | the cut announcement thread and the cut waiting list had no renderer test | fixed in d08877d6: `CommsAnnouncements.test.tsx` and `HomeBoardWaiting.test.tsx` «0.3.19 review UX-8» |
| V1-9 | UX-9 | non-blocking | the cut announcement line read with two colons | fixed in d08877d6: «ответа не видно (прочитаны первые {count} сообщений ветки)»; copy checks 5569679b, 625ed270 |
| V1-10 | UX-10 | non-blocking | the relayed answer mixed a Russian sentence with an English outcome word | fixed in d08877d6: `shared/boardDispatch.ts#relayText` says the outcome in Russian with the value in code; `boardDispatch.test.ts` |
| V1-11 | UX-11 | non-blocking | a failed inbox read empties the inbox rows of «На проверке» for that pass | ruled: CO-562 item 7 |
| V1-12 | ER-1 | blocking | a reconnect shared the hooks' rejoin bearer, which each hook rejoin revoked | fixed in d08877d6: `sessionEnroll.ts` `reconnectBearer`, a slot of its own; test `session-enroll.test.mjs` «0.3.19 review ER-1», watched failing on 3138e829 |
| V1-13 | ER-2 | blocking | §3.8 item 2 said empty runs and the back-off belong to one message | fixed in d08877d6: §3.8 item 2 says the project counts both across its messages until a run reads them |
| V1-14 | ER-3 | non-blocking | inbox runs went to the dispatch target | fixed in d08877d6: as PL-2 |
| V1-15 | ER-4 | non-blocking | a refused Quit leaves hideForService's listener armed | ruled: CO-562 item 10 |
| V1-16 | ER-5 | non-blocking | the macOS owner read can block fabric-mcp for 20 s | ruled: CO-562 item 11 |
| V1-17 | ER-6 | non-blocking | a retried open changed its packet under the same idempotency key | fixed in d08877d6: `boardDispatchRun.ts` keeps the first inbox snapshot in `retryOpen`; test `board-dispatch-run.test.mjs` «0.3.19 review ER-6 and PL-1», watched failing |
| V1-18 | ER-7 | non-blocking | the inbox read scans every delivery and ignores more | fixed in part in d08877d6 (`more`, as PL-10); the scan ruled: CO-562 item 13 |
| V1-19 | ER-8 | non-blocking | a crash of launchd's copy after the switch went off unregisters its job | ruled: CO-562 item 12 |
| V1-20 | DO-1 | blocking | the spec said two empty runs in §2, §3.6, §3.7 and §10 | fixed in d08877d6: the spec says three from 0.3.19 in §2 rule 4, §3.6 and §10, and the dispatcher's comments |
| V1-21 | DO-2 | non-blocking | the next-id note said CO-556's row was on an unlanded branch | fixed in d08877d6 |
| V1-22 | DO-3 | non-blocking | the CO-561 row said not yet diagnosed and named two files | fixed in d08877d6: the row names the diagnosis, the four files and the tests |
| V1-23 | DO-4 | non-blocking | the CHANGELOG read as four runs | fixed in d08877d6: «after three runs in all» |
| V1-24 | DO-5 | non-blocking | the lifecycle rows left out the reads 0.3.19 adds | fixed in d08877d6: AGENTS.md dispatcher and Comms rows |
| V1-25 | DO-6 | non-blocking | the agent page row said «Написать агенту» re-reads every 15 s | fixed in d08877d6: the row says it re-reads on a journal mark; the behaviour is CO-562 item 5 |
| V1-26 | DA-1 | non-blocking | no receipt of the migration on the full chain, its database test or the 100 to 101 upgrade | ruled: the board DB suite ran on a disposable cluster in the plan review of this iteration, inbox case included; the upgrade is item 3 of this ledger's Release close |
| V1-27 | DA-2 | non-blocking | the fan-out cuts hours in the database's zone | ruled: CO-562 item 13 |
| V1-28 | DA-3 | non-blocking | the 30 s inbox read scans the whole board | ruled: CO-562 item 13 |
| V1-29 | DA-4 | non-blocking | a project cut from the read was judged answered | fixed in d08877d6: as PL-10 |
| V1-30 | DA-5 | non-blocking | a reply without a read mark counts the run empty | ruled: CO-562 item 14 |
| V1-31 | DA-6 | non-blocking | a fan-out across two clock hours is not caught | ruled: CO-562 item 14 |
| V1-32 | PL-1 | blocking | an inbox run starts under Switchboard's request-only instructions | fixed in d08877d6: the packet reads the request as the unread messages, never claimed or completed (test «0.3.19 review ER-6 and PL-1»); Switchboard asked for `--reason inbox` on the board (thread c650e0aa); the switch goes on only after one observed live inbox run (Release close) |
| V1-33 | PL-2 | blocking | inbox runs took the dispatch target where no fabric-mcp can read the board | fixed in d08877d6: an inbox run always starts here; test «0.3.19 review PL-2», watched failing |
| V1-34 | PL-3 | blocking | the spec and comments still said two runs | fixed in d08877d6: as DO-1, and the doc comment moved above `RequestState` |
| V1-35 | PL-4 | non-blocking | 0.3.18's notes never reach a reader of the 0.3.19 release | fixed in the release commit: the 0.3.19 section carries 0.3.18's changes and its Upgrading paragraph |
| V1-36 | PL-5 | non-blocking | the release close was not written and the 0.3.18 handoff pointed at v0.3.18 | fixed in the release commit: this ledger, the gate, the version and the handoff's Next task |
| V1-37 | PL-6 | non-blocking | turning the switch on starts a burst with no spend bound | fixed in part in d08877d6 (an Upgrading sentence); the switch-on order is item 6 of the Release close |
| V1-38 | PL-7 | non-blocking | two projects with no live session can wake each other through replies | ruled: CO-562 item 15 |
| V1-39 | PL-8 | non-blocking | the 30 s rule against what ships | ruled: CO-562 item 17 and CO-559's Left; said in the release message |
| V1-40 | PL-9 | non-blocking | a silent person's session no longer keeps a dispatched agent out | ruled: CO-562 item 16 |
| V1-41 | PL-10 | non-blocking | the inbox read's more flag was dropped | fixed in d08877d6: `createInboxState` answers unknown for a project a cut read left out; test «CO-559 review: an inbox message is answered …» |
| V1-42 | PL-11 | non-blocking | the macOS owner read blocks fabric-mcp | ruled: CO-562 item 11 |

Exit for iteration 1: every finding has a disposition. Blocking findings open: none.

## Iteration 2

Candidate `d08877d6d243f4ded4524d2e4a263e8573b570d0` (the fast gate green, exit 0; hosted `ci` on the branch). Reports
and receipts in `docs/evidence/reviews/0.3.19/iteration-2/`. 24 findings, 5 blocking (ER-9, DO-7, DO-8, PL-12, PL-13).
The fix wave is `ad73a986` (hosted `ci` 42959365791 green).

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V2-1 | UX-12 | non-blocking | the inbox row says the messages wait for a decision but offers none | ruled: CO-562 item 19 |
| V2-2 | UX-13 | non-blocking | the burst warning covered turning the switch on, not updating with it on | fixed in ad73a986: the Upgrading paragraph of the 0.3.19 notes says both |
| V2-3 | UX-14 | non-blocking | CO-562 item 9 said the cut states have no test; item 6 lacked its full stop | fixed in ad73a986: item 9 withdrawn, the stop added |
| V2-4 | UX-15 | non-blocking | three wording points (whose wait, «taken», a thousand exactly) | fixed in ad73a986: the strings reworded, copy checks b783061b, 25a73e2b, 84f83801, eaf71180 |
| V2-5 | ER-9 | blocking | the reconnect bearer was minted as a hook's, so the agent's exit never ended the session | fixed in ad73a986: `sessionEnroll.ts` mints the session's own kind of bearer; test `session-enroll.test.mjs` «0.3.19 review ER-1» asserts it, watched failing on d08877d6 |
| V2-6 | ER-10 | non-blocking | another process with the same runtime id took the held session | fixed in ad73a986: the reconnect checks the agent's process; test «0.3.19 review iteration 2, ER-10» |
| V2-7 | ER-11 | non-blocking | the per-request owner check can wait about 23 s | ruled: CO-562 item 21 |
| V2-8 | DO-7 | blocking | §3.7 and §3.1 still said two empty runs | fixed in ad73a986: §3.1, §3.7 and §10 say three from 0.3.19; no other two-runs claim in the spec |
| V2-9 | DO-8 | blocking | the 0.3.18 handoff's Next task still said to tag v0.3.18 | fixed in ad73a986: Next task points at this ledger's Release close, the old text kept as a quotation |
| V2-10 | DO-9 | non-blocking | CO-562 items 5 and 9 partly false; files column short | fixed in ad73a986 |
| V2-11 | DO-10 | non-blocking | DA-1 and PL-4 were neither fixed nor recorded | fixed in ad73a986: PL-4 in the notes; DA-1 is item 4 of this ledger's Release close |
| V2-12 | DO-11 | non-blocking | a comment still said empty runs belong to one message | fixed in ad73a986: as PL-17 |
| V2-13 | DO-12 | non-blocking | the CO-559 map entry read as four runs | fixed in ad73a986 |
| V2-14 | DO-13 | non-blocking | CO-560 read not yet diagnosed with a cancelled deadline | fixed in ad73a986 |
| V2-15 | DA-7 | non-blocking | the PL-10 fix left a cut-out project's run unjudged | fixed in ad73a986: `createInboxState` falls through to the message's read marks when the read was cut; test «CO-559 review: an inbox message is answered …» |
| V2-16 | DA-8 | non-blocking | DA-1 still open and not carried | ruled: item 4 of this ledger's Release close |
| V2-17 | PL-12 | blocking | §3.7 still said two empty runs | fixed in ad73a986: as DO-7 |
| V2-18 | PL-13 | blocking | the notes said 0.3.18's open checks closed on this candidate | fixed in ad73a986: the notes say they moved to this release's close and the logout check to CO-562 |
| V2-19 | PL-14 | non-blocking | PL-4, PL-5 and DA-1 neither fixed nor carried | fixed in ad73a986: PL-4 and PL-5 as PL-13 and DO-8; DA-1 is Release close item 4 |
| V2-20 | PL-15 | non-blocking | the release close order was not written | fixed in ad73a986: this ledger's Release close, items 1 to 12 |
| V2-21 | PL-16 | non-blocking | updating with the switch on starts a burst under a consent for requests | fixed in ad73a986: as UX-13; Release close item 8 triages the backlog first |
| V2-22 | PL-17 | non-blocking | a code comment said empty runs belong to one message | fixed in ad73a986: `boardDispatchRun.ts` |
| V2-23 | PL-18 | non-blocking | a run continued by Switchboard after a limit is counted empty | ruled: CO-562 item 20 |
| V2-24 | PL-19 | non-blocking | an inbox run could enroll for board.inbox | fixed in ad73a986: the packet forbids com.enroll for board.inbox |

Exit for iteration 2: every finding has a disposition. Blocking findings open: none.

## Iteration 3

### Run one, ad73a986 (superseded)

Candidate `ad73a98679d4b47ca896cdc6ade06c9a13e894d3`. Reports in `docs/evidence/reviews/0.3.19/iteration-3-ad73a986/`
(kept as the record; not this iteration's receipts). 21 findings, 2 blocking (DO-14, PL-20); the fix wave `04b5eafc`.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| R1-1 | UX-16 | non-blocking | the notes told the person to mark messages read, which no route does | fixed in 04b5eafc: as PL-20 |
| R1-2 | UX-17 | non-blocking | three wording leftovers (exactly a thousand, the label in two languages, fan-out in the help) | fixed in 04b5eafc for (a) and (b), copy checks db41fa2b, 49bbdc1d, 516529f0; (c) ruled: CO-562 item 25 |
| R1-3 | UX-18 | non-blocking | the cited Russian copy-check id did not reproduce | fixed in 04b5eafc: SCN-147 says the Russian checks ran with formal address and cites 49bbdc1d |
| R1-4 | ER-12 | non-blocking | a reconnect right after /clear gets a new session | fixed in part in 04b5eafc: the notes no longer say never; ruled: CO-562 item 24 |
| R1-5 | ER-13 | non-blocking | §3.8 item 2 said a cut read says nothing of a left-out project | fixed in 04b5eafc: as PL-25 |
| R1-6 | ER-14 | non-blocking | a dead run whose stop answers already-ended counts empty unread | ruled: CO-562 item 23 |
| R1-7 | DO-14 | blocking | §3.6 still said a request is not started a third time | fixed in 04b5eafc: §3.6 says past the limit (a fourth time from 0.3.19) and the comment in `boardDispatchRun.ts` too |
| R1-8 | DO-15 | non-blocking | the notes and close item 8 named a triage route that does not exist | fixed in 04b5eafc: as PL-20 |
| R1-9 | DO-16 | non-blocking | the Fabric.app row said the job goes when the switch goes off | fixed in 04b5eafc: AGENTS.md names `loginItemOffAtQuit` |
| R1-10 | DO-17 | non-blocking | CO-562's files and CO-561's fixes incomplete | fixed in 04b5eafc |
| R1-11 | DO-18 | non-blocking | §3.8 item 2 out of date after DA-7 | fixed in 04b5eafc: as PL-25 |
| R1-12 | DA-9 | non-blocking | the database proof came after the artefacts | fixed in 04b5eafc: Release close item 2 runs before the release commit |
| R1-13 | DA-10 | non-blocking | the inbox DB test's fan-out case fails across a clock hour | ruled: Release close item 2 runs it once more then; CO-562 items 13 and 14 |
| R1-14 | PL-20 | blocking | the notes and close item 8 told the operator to mark messages read, which no surface does | fixed in 04b5eafc: the Upgrading paragraph says to turn the switch off before updating and that only the project's run marks a message read; close item 8 has no triage |
| R1-15 | PL-21 | non-blocking | nothing stops a failure that hits every run | fixed in part in 04b5eafc (close item 8 turns the switch off on it); ruled: CO-562 item 22 |
| R1-16 | PL-22 | non-blocking | no free-disk check in the close | fixed in 04b5eafc: Release close item 0 |
| R1-17 | PL-23 | non-blocking | 0.3.18's after-tag items lost their home | fixed in 04b5eafc: Release close item 13 |
| R1-18 | PL-24 | non-blocking | CO-559's leftovers had no target | fixed in 04b5eafc: the release after 0.3.19 |
| R1-19 | PL-25 | non-blocking | §3.8 points 2 and 3 out of date | fixed in 04b5eafc |
| R1-20 | PL-26 | non-blocking | §6 Safety not updated for message-started runs | fixed in 04b5eafc: §6 names it |
| R1-21 | PL-27 | non-blocking | the close never turns «Служба доски» on again, nor says migration 128 is then frozen, nor how to go back | fixed in 04b5eafc: close item 5 and the Upgrading paragraph |

### Run two, 04b5eafc (superseded)

Candidate `04b5eafc3642a846a07281ec4e0ededba7c6dde1` (hosted `ci` 42961040397). Reports in
`docs/evidence/reviews/0.3.19/iteration-3-04b5eafc/`. 15 findings, 3 blocking (ER-15, DO-19, PL-28); the fix wave is the
next candidate.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| R2-1 | UX-19 | non-blocking | the Upgrading sentence said only a dispatched run marks a message read | fixed: as PL-28 |
| R2-2 | UX-20 | non-blocking | the review-count string had no copy check on record | fixed: SCN-147 cites db41fa2b and 516529f0 |
| R2-3 | UX-21 | non-blocking | the Russian label could read as the agent's session | fixed: «… а открытой сессии проекта нет», copy check e8ab8087 |
| R2-4 | ER-15 | blocking | launchedAt was the pass's start, not Switchboard's answer | fixed: `boardDispatchRun.ts#start` sets it from `deps.now()` after the answer; test `board-dispatch-run.test.mjs` «0.3.19 review, iteration 3 run two, ER-15», watched failing on 04b5eafc |
| R2-5 | ER-16 | non-blocking | the ER-6 fix held for one retry only | fixed: `retryOpen` keeps the first packet through every retry |
| R2-6 | ER-17 | non-blocking | a new fabric-mcp can join a session its old process is still leaving | ruled: CO-562 item 26 |
| R2-7 | ER-18 | non-blocking | off, on and off again added a second quit hook | fixed: `index.ts` adds the hook once (`loginItemQuitHook`) |
| R2-8 | DO-19 | blocking | §3.1 and two comments still said the dispatcher runs on the 60 s cycle | fixed: §3.1, `boardDispatchRun.ts` header and wake comment say the 30 s pass |
| R2-9 | DO-20 | non-blocking | the WATCH_MS comment said a stored message wakes the dispatcher | fixed: `shared/boardDispatch.ts#WATCH_MS` comment |
| R2-10 | DA-11 | non-blocking | the Upgrading sentence named the wrong reader of a message | fixed: as PL-28 |
| R2-11 | DA-12 | non-blocking | item 0 named the old item numbers | fixed: Release close item 0 says items 2 and 5 |
| R2-12 | PL-28 | blocking | the Upgrading sentence said only a run of the project marks a message read | fixed: the notes say a session of that project marks it read or answers it, and reading it in Comms does not |
| R2-13 | PL-29 | non-blocking | item 0 named the old item numbers; free disk below the floor | fixed: as DA-12; the floor is read at item 0 before the close |
| R2-14 | PL-30 | non-blocking | run one's reports had no home | fixed: committed under `docs/evidence/reviews/0.3.19/iteration-3-ad73a986/` in the candidate itself |
| R2-15 | PL-31 | non-blocking | the Studio's switch was decided after its update | fixed: Release close item 10 sets it first |

### Run three, 12d0aceb (this iteration's candidate)

Candidate `12d0aceb86f3486bcd2ce336b24d9ff57131924d`, the `verifiedCommit` (the local fast gate exit 0; it reached
`main` by fast-forward from `3dc86247`). Five reviewers, one per level; reports and receipts in
`docs/evidence/reviews/0.3.19/iteration-3/`. 13 findings, none blocking. Every earlier blocking finding was checked
again and holds.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V3-1 | UX-22 | non-blocking | the operator's inbox row follows only the newest unread message | ruled: CO-562, item 27 added on main after the tag (Release close item 14) |
| V3-2 | UX-23 | non-blocking | Settings reads as failed while the switch-off waits for the Quit; SCN-170 not amended | ruled: CO-562, item 28 added on main after the tag (Release close item 14) |
| V3-3 | ER-19 | non-blocking | a lost open of a brand-new workflow after a closed one is retried under a new id | ruled: CO-562, item 29 added on main after the tag (Release close item 14) |
| V3-4 | DO-21 | non-blocking | four spec places and two comments still say the cycle | ruled: CO-562, item 30 added on main after the tag (Release close item 14); the 60 s bound still covers the 30 s pass |
| V3-5 | DO-22 | non-blocking | §6 does not say a dead run is stopped with the switch off | ruled: CO-562, item 30 (Release close item 14) |
| V3-6 | DO-23 | non-blocking | the runbook's 0.3.19 paragraph omits two cautions | fixed in the release commit for the notes (the Upgrading paragraph carries both); the runbook ruled: CO-562, item 30 (Release close item 14) |
| V3-7 | DO-24 | non-blocking | «a dozen» against «12 or more»; the 65-project date | fixed in the release commit: the notes say 12 or more and the measurement's date |
| V3-8 | DA-13 | non-blocking | a failed first inbox open is keyed by the newest message id | ruled: CO-562, item 29 (Release close item 14) |
| V3-9 | DA-14 | non-blocking | 136 186 events read, 136 188 in the backup, unexplained | fixed in the release commit: item 2's record says the backup was taken after the read |
| V3-10 | PL-32 | non-blocking | the broker is restored before the published build is installed | fixed in the release commit: Release close items 7 and 9 reordered, the install held, the rc bundle kept |
| V3-11 | PL-33 | non-blocking | inbox runs share the machine's two slots with requests | ruled: CO-562, item 31 added on main after the tag (Release close item 14) |
| V3-12 | PL-34 | non-blocking | an idle open session counts as live for ever | ruled: CO-562, item 31 (Release close item 14); CO-559's §3.2 wake |
| V3-13 | PL-35 | non-blocking | two silent exclusions; a row ages out after a week | ruled: CO-562, item 31 (Release close item 14) |

Exit for iteration 3: every finding has a disposition. Blocking findings open: none.

## Release close

Executable in this order, each act with its actor; a failure stops the close and takes a fix through a new candidate.

0. Free disk read before items 2 and 5 (`df -h`; iteration 3 run two, DA-12, PL-29): at least 5 GB, the measured need
   with margin (the backup was 29 MB and the rehearsal's disposable stack is removed when it ends); the disk filled once
   on 2026-11-11 (iteration 3, PL-22).
1. Hosted `ci` on the final candidate: its push run and a full run green (actor: this session, `gh run`).
2. The board database suite (`apps/desktop/test/run-project-board-operator-db.mjs`) and the upgrade rehearsal from
   schema 100 on a disposable cluster, from a backup of the live database, their receipts here (iteration 1, DA-1;
   iteration 3, DA-9). The suite's fan-out case can fail falsely when its twelve submits cross a clock hour: run it
   once more then (DA-10).
3. The release commit on `main`: `apps/desktop/package.json` 0.3.19, the `## 0.3.19` section finalized,
   `docs/launch/release-gate.json` naming this ledger, the final candidate and the fifteen receipts.
4. `v0.3.19-rc.1` on the release commit: `release.yml` builds macOS, Windows and Linux; every job green.
5. The rc installed on this Mac: a database backup; the board switch off in Settings; «Служба доски» off and Quit
   (0.3.18's switch-off ends Fabric at once in launchd's own copy, so live terminals are closed first); the rc
   installed; the migration up to schema 101 (from here migration 128 never changes: a fix is a new migration); the
   first start read back (schema 101, `hub.json`, the board); «Служба доски» on again (iteration 3, PL-27).
6. 0.3.18's open checks on the rc: the Settings line «Служба доски» and the legacy login item; N6 (d) with a live
   terminal session opened from Fabric's window; `chat-activation-native`; the Docker-stopped start (it stops every
   container, so with the operator present); the Windows nightly failures of `platforms.yml` ruled or fixed (CO-560).
7. Kept until item 9 is done: the lifecycle broker's `fabric.desktop` held off (revision 30 since 0.3.18's close), so
   `always_on` cannot bring a bundle back while one is replaced (iteration 3 run three, PL-32).
8. The board dispatcher: the switch on, and the first live request run and inbox run (two at a time) watched end to
   end (accepted, read marks, workflow closed, `finished`); if a failure hits every run (as CO-556 did), the switch
   goes off at once, since the run limits are fixed in code (CO-562 item 22); then the first hour of
   `board.dispatch.*` lines and Switchboard's usage read (iteration 1, PL-1 and PL-6; iteration 3, PL-20 and PL-21).
   No route marks another project's messages read for the operator, so there is no triage before it.
9. `v0.3.19` on the same commit, published; this Mac updated to the published build with the board switch off and
   «Служба доски» off then Quit as in item 5, the rc bundle kept beside it as `Fabric-0.3.19-rc.app` until the published
   build reads back; then the broker's policy restored to revision 29's `always_on` and the board switch on again
   (PL-32).
10. The Mac Studio: the dispatcher switch decided there first, set before the update as the notes tell every user
    (iteration 3 run two, PL-31); then 0.3.19 installed for both accounts with studio-agent; Switchboard's version read;
    `dispatchTarget` stays unset on both machines.
11. The workspace published and pinned; the knowledge base rows; the site's download links checked.
12. Board replies on threads `90b6921f` and `f408566b`; CO-562 and CO-560 are the next release's.
13. 0.3.18's two items for after its tag, which lost their home with `v0.3.18` (iteration 3, PL-23): REQ-1 of the
    board-always-on brief amended with the N6 (b) measurement (within 70 s, not 10 s), and Observatory told on the
    board about its `dispatch_packet.py` header (DO-27 (a)).
14. On `main` after the tag: CO-562 gains items 27 to 31 for iteration 3 run three's findings ruled there (UX-22,
    UX-23, ER-19 with DA-13, DO-21 to DO-23, PL-33 to PL-35), which the release commit may not add.

### Executed

- Item 0, 2026-11-11 05:44Z: `df -h /System/Volumes/Data` read 7.7 GiB free.
- Item 2, 2026-11-11: the board database suite on a disposable cluster with the whole migration chain, 13 passed, 0
  failed, the inbox case included («PASS full migration chain, the operator's reads of the project board on isolated
  PostgreSQL», exit 0). The live database read schema 100 and 136 186 journal events at 05:43Z; a private backup,
  taken a minute later while Fabric ran (two events were written between, hence 136 188 below; DA-14),
  `pre-0.3.19.dump` (29 099 229 bytes, mode 600, 1 757 entries by `pg_restore --list`) was taken with PostgreSQL 17's
  `pg_dump` inside the stack's container; `rehearse-upgrade.mjs --from 100 --ref 04b5eafc` on it: «PASS: schema 100 →
  101 (admits 101), journal 136188 → 136188», 79 tables, the receipt beside the dump, the disposable stack removed,
  exit 0. Migration 128 is byte-identical in every later candidate (iteration 3 run two, data review).
