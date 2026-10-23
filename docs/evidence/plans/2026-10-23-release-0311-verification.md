# Release verification: Fabric 0.3.11, wave 4 and the working language, three independent iterations

The operator, 2026-10-22: «доска не на русском» (P-24, the working language), then the walk of the installed 0.3.10
(2026-10-23, OF-14 to OF-40), then «давай доделывай все сам автономно и выбирай лучшие решения для меня и в итоге
заливай все обнови доки и новая вресия». 0.3.11 is everything after v0.3.10 on the release branch, landed on `main`
before the tag: the working language (P-24,
ADR-0172, and the switch of ADR-0174), the start that waits out a statement timeout (CO-389), the simple plan's wave 4
as the operator's walk reshaped it (the home, the Board as a kanban, the task page, Агенты, История, Comms as a feed,
Settings; the walk's plan `docs/evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md`), and the
carry-overs 0.3.10 left for it (CO-380, CO-384, CO-385, CO-387; CO-386 and CO-388 re-ruled to 0.3.12). Schema 95,
unchanged: no file under `supabase/` changed since v0.3.10.

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.11/iteration-N/`.

## Rollout on the operator's Mac

0.3.11 adds no migration; the upgrade is the bundle alone and so is going back to 0.3.10. As for 0.3.10
([its rollout](2026-10-22-release-0310-verification.md#rollout-on-the-operators-mac)):

0. The agent measures the disk and swap (`df -h`, `sysctl vm.swapusage`) and frees space until more than 3 GB is free
   (Fabric's own warning), so the first start does not meet the statement timeout 0.3.10's did (CO-389 waits it out,
   but the start is slower); the measurement goes in the Release close.
1. The agent downloads and verifies the signed 0.3.11 bundle (`SHA256SUMS`, `codesign`, `spctl`); a rollback takes
   `Fabric-0.3.10-universal.dmg` from the v0.3.10 release.
2. The agent lists the live console sessions and says them; then **the person quits Fabric**, the agent puts the 0.3.11
   bundle in `/Applications`, and **the person opens Fabric**. The running 0.3.10 is the person's (`lifecycle.status`,
   `startedBy: person`), and the agent never starts or restarts Fabric through the broker while CO-382 is open: a
   broker-started Fabric is stopped after 15 idle minutes.
3. The agent checks that the broker did not start Fabric between the quit and the open (`startedBy: person`; no
   `ensure` for `fabric.desktop` in `~/Library/Logs/local-lifecycle/broker.log` in that window), then verifies the version
   (0.3.11), the schema (95), the hub (`hub.json` and a `fabric_whoami` naming the working language), and on the real
   app the places the walk named: Главная, Доска, a task, Агенты, История, Comms, Настройки. For OF-36 the agent sets
   «Не давать компьютеру засыпать» to «while agents work», reads `pmset -g assertions` while a console runs and after it
   ends, and puts the setting back to «never».

## Owed from 0.3.10's Release close

- CO-383: the links on board threads `02bf19c5` and `a5969ac5` move to `main`, and CO-371's ask (the hub's 503 body and
  the backoff) gets its update; with 0.3.11's publication post. Its triage half (threads `7bd4dfac`, `c97280b0`,
  `e204b5b5`, and DEC-0098, now DEC-0102) is 0.3.12 by D-7.
- The correction for the threads that were told 0.3.11 (wave 4, the agents' acts, CO-339): the 0.3.11 publication post
  on `0f5d0589`, `617c8cbe`, `8448237d`, `bb87af23` and `27750925` says what shipped and what is 0.3.12.
- The knowledge base: `products.md`, `roadmap.md` and `plans.md` rows 2 and 13 name 0.3.11 and 0.3.12 (a fabric-workspace
  pull request in the Release close).
- The measurements of 0.3.9's "How we will know it holds", with the broker's idle stops (CO-382), read at the 0.3.11
  install; CO-382 is decided on what they show.
- From 0.3.10's V3-48: SCN-162's swipe step and the stack exposure warning, read in this release's documents review;
  CO-384's two items are done (non-wrapping content, «at most 640 px»).
- New asks since: CO-396 (CT-81, `board_tick` step a0) and CO-397 (`fabric_whoami`'s board rule against DEC-0102), both
  0.3.12. CO-390, the workspace sync's stale lock, is 0.3.12 by D-7.

## Iteration 1

Five fresh reviewers, 2026-10-23, against `a9accd06` (`a9accd06ee880781694339a584d16730f5d64ad8`), read-only in a detached checkout. All five
stopped on the account's session limit midway and were resumed from where they stopped once it reset. Reports:
[UX](../reviews/0.3.11/iteration-1/2026-10-23-ux.md), [errors](../reviews/0.3.11/iteration-1/2026-10-23-errors.md),
[documents](../reviews/0.3.11/iteration-1/2026-10-23-docs.md), [data](../reviews/0.3.11/iteration-1/2026-10-23-data.md),
[plan](../reviews/0.3.11/iteration-1/2026-10-23-plan.md).

64 findings, 4 blocking. Two reviewers independently found that Comms' new feed asked for the last 100 journal
numbers, which hold a handful of posts or none, since a post's number is the journal's (DA-1, ER-1: 8 of 887 on the
operator's database). The UX reviewer measured the real stylesheets and found the home's agents heading broken
mid-word and a project's agents three lines tall, though OF-23 was marked done (UX-1, UX-2). The plan reviewer found 53
carry-over rows due in 0.3.11 that the candidate neither did nor re-ruled (PL-1). The fixes make the next candidate;
the rows the walk leaves for later are 0.3.12 by decision D-7, and the review's own rulings are CO-391 to CO-401.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | DA-1, ER-1 (blocking) | Comms «Лента» reads the last 100 journal numbers, not the newest 100 posts | fixed: the feed reads windows back from the newest number until it holds the newest 100 posts (`launch/commsNewest.ts#newestPosts`); `commsNewest.test.ts` with posts one journal number in twenty and with every number a post |
| V1-2 | DA-2, ER-2, UX-7 | A project's board filters estate-wide lists already cut at their caps | fixed: `work.board(projectId)` filters in the query (`main/workRead.ts#readTaskBoard`, `readHome`); a column empty under a cap says «Нет среди последних прочитанных»; `KanbanBoard.test.tsx` «reads one project's tasks» |
| V1-3 | ER-3 | A task moved to review with a live claim shows in two columns | fixed: only a task still in work is in «В работе» (`shared/homeLive.ts#composeHome`); `homeLive.test.ts` «a claim on a task that left work» (watched failing without it) |
| V1-4 | ER-4, DA-8, UX-8, DO-14 | The feed never refreshes and has no retry | fixed: the feed reads every 15 s while open, keeps what it read when a refresh fails and says so, and offers «Попробовать снова» (`launch/CommsFeed.tsx`, `FEED_POLL_MS`); `CommsFeed.test.tsx` «offers Try again» |
| V1-5 | UX-1 (blocking) | «Агенты в работе» breaks mid-word in the side column | fixed: `overflow-wrap:break-word` on the page instead of `anywhere`, and the agents heading keeps one line while its buttons wrap (`rail.css`, `launch.css`); browser case «the agents heading stays on one line» (watched failing on the candidate's CSS) |
| V1-6 | UX-2 (blocking) | A project's agent is three lines, not one | fixed: the compact row is a row (`launch.css`, `flex-direction:row`); browser case «a project's agent is one line inside its card» (watched failing on the candidate's CSS) |
| V1-7 | PL-1 (blocking) | 53 carry-over rows due in 0.3.11 neither done nor re-ruled | fixed: decision D-7 re-rules them to 0.3.12 in the carry-over register's dated note, by id, with CO-377's date kept; P-20 says its scope and P-25 names 0.3.12 |
| V1-8 | UX-3 | The board's header actions do nothing on the kanban | fixed: «Начать разбор» and «Добавить тему» open «Нужны вы», where they act (`launch/BoardScreen.tsx`); `BoardScreen.test.tsx` «Add a topic opens Needs you» |
| V1-9 | UX-4, DO-4 | «Открыть на доске» lands on the kanban, not the row | fixed: a row opens the board's «Нужны вы» on itself, the head button and the waiting count open «Нужны вы» (`EstateHome.tsx`, route `needs`); `HomeParts.test.tsx` (called with the row's ref) |
| V1-10 | UX-5, DO-3 | «Нужны вы» lists what agents can resolve and names no asker | ruled: CO-391, 0.3.12; OF-14 says partly |
| V1-11 | UX-6, DO-11 | История's lede and empty line contradict «Что делали агенты» | fixed: the lede names both sections and the empty line says nothing was changed through Fabric (`i18n`); the feed's own rows (no agent, no date, `#seq`) are ruled CO-395 |
| V1-12 | DO-1, DA-10, ER-6, UX-10 | The language hints say agents write the person's documentation; the hint ignores the switch | fixed: the first-run and Settings hints name tasks, notes, reports and board messages and say a repository keeps its language; with the switch off Settings says agents write in their own; CHANGELOG and SCN-170 follow |
| V1-13 | DO-2, UX-11 | Fabric still reads quotas and shows the project page's quota cell | ruled: CO-392, 0.3.12 with the project page; OF-35 says partly |
| V1-14 | DO-5 | AGENTS.md's Lifecycle table misses the new reads | fixed: the home's work reading names Агенты; rows for the Board's kanban and Comms' feed with their cadence |
| V1-15 | DO-6, PL-3, PL-11 | The 0.3.12 moves live only in the walk; P-20, the simple plan and the scenarios lag | fixed: P-25 for 0.3.12, CO-401 for the walk's moved items (OF-19's agent filter with them), the simple plan's dated lines, SCN-163, SCN-166, SCN-168, SCN-170, SCN-173 and SCN-174 implemented |
| V1-16 | DO-7, PL-4, PL-12 | The rollout restarts Fabric through the broker; the keep-awake check changes a setting | fixed: the person quits and opens Fabric, the agent checks the broker did not start it, and the keep-awake check puts the setting back (Rollout) |
| V1-17 | PL-2 | Published promises name 0.3.11 for work it does not ship | fixed: the notes say what moved to 0.3.12 and why; the publication post and the knowledge base pull request carry the correction (Release close) |
| V1-18 | PL-5, DO-8 | Owed list incomplete; new asks to Fabric have no row | fixed: the Owed list is complete; CO-396 (CT-81) and CO-397 (the whoami text) record the new asks; CO-390 and CO-383's triage half are ruled by D-7 |
| V1-19 | PL-6 | The candidate is not pushed and `main` moved | fixed: the branch is pushed and `origin/main` is merged into it, so every reviewed candidate stays an ancestor; landing is a fast-forward |
| V1-20 | PL-7, DO-13 | The handoff is stale | fixed: `docs/handoffs/2026-10-23-release-0311.md` states the review in progress and the next task |
| V1-21 | PL-8, PL-13, DA-3 | No 0.3.11 schema line in the runbook or the notes | fixed: «0.3.11 admits schema 95» in `release-mac.md` and the schema line in the notes |
| V1-22 | PL-9 | Five expired agent-sync leases left behind | fixed: released |
| V1-23 | PL-10 | D-1 cites stale migration numbers | fixed: a dated correction line under D-1 |
| V1-24 | DA-4 | `protocol.language` joined the shape and the version did not move | fixed: `PROTOCOL_VERSION` 2 (`shared/protocol.ts`) |
| V1-25 | DA-5 | Going back to 0.3.10 and saving a setting drops a switched-off working language | not a defect: 0.3.10 does not know the key; the runbook says what going back does (`release-mac.md`, 0.3.11 paragraph) |
| V1-26 | DA-6 | `session.oriented@1` records the rules only once per session | ruled: CO-399, 0.3.12 |
| V1-27 | DA-7 | The queue orders by `moved_at`, empty for most queued tasks | fixed: the queue reads newest filed first by `seq`, and a card's age falls back to `started_at` (`main/workRead.ts#readTaskBoard`) |
| V1-28 | DA-9 | Tool descriptions name no fallback when no language is named | fixed: «or the person's own, when it names none» in the four descriptions |
| V1-29 | DA-11 | The done read sorts without an index | ruled: CO-398, 0.3.12 |
| V1-30 | DA-12, ER-8 | No test for the switch off; a settings read failure serves English | fixed: `shared/appSettings.ts#workingLanguageOf` with its test, and a failed read names no language (`main/agentSurface.ts`) |
| V1-31 | ER-5, UX-12 | An agent with nowhere to open is a dead button; no agent page | fixed: such an agent is a row, not a button (`HomeWork.test.tsx`); the agent page is ruled CO-393, 0.3.12 |
| V1-32 | ER-7 | A failed done read fails the whole home | fixed: «Закончили» says its own failure and the rest reads (`main/workRead.ts`, `homeLive.ts` `doneUnread`); `HomeWork.test.tsx`, `KanbanBoard.test.tsx` |
| V1-33 | ER-8 | Test gaps: История's unread boundary, Comms' default tab, the done filter | fixed: `HistoryScreen.test.tsx` (watched failing with the boundary removed), `CommsFeed.test.tsx` «is what Comms opens on», `homeLive.test.ts` «lists finished tasks only» |
| V1-34 | ER-9 | «Что делали агенты» stays on «Reading» when the journal fails | fixed: История says the journal could not be read (`feedFailed`); `HistoryScreen.test.tsx` |
| V1-35 | ER-10 | A stale project filter empties every column | fixed: a filter whose project left the list is dropped (`KanbanBoard.tsx`); `KanbanBoard.test.tsx` |
| V1-36 | UX-9 | The task template's labels differ from the notes | fixed: the notes name the shipped labels |
| V1-37 | UX-13 | «Нужны вы» says the kind twice and does not show a row opens | fixed: the kind once, a chevron that turns (`HomeParts.tsx`, `launch.css`) |
| V1-38 | UX-14 | The home's lanes open the project, the kanban the task | ruled: CO-394, 0.3.12 |
| V1-39 | UX-15, DO-9 | Screens and flows lag the shipped places | ruled: CO-400, 0.3.12 |
| V1-40 | DO-10 | Four scenarios disagree with the shipped code | fixed: SCN-143, SCN-162, SCN-163 and SCN-170 amended |
| V1-41 | DO-12 | operating-surfaces and P-24 miss the off state | fixed: both name ADR-0174's off state |

Exit for iteration 1: every finding is fixed, ruled to a register row or not a defect. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-23, against `1f7a16ac` (`1f7a16acf4033c40f17eb1114501133f1bcbed52`), read-only in a detached checkout. All five
stopped on the account's session limit midway and were resumed from where they stopped. Reports:
[UX](../reviews/0.3.11/iteration-2/2026-10-23-ux.md), [errors](../reviews/0.3.11/iteration-2/2026-10-23-errors.md),
[documents](../reviews/0.3.11/iteration-2/2026-10-23-docs.md), [data](../reviews/0.3.11/iteration-2/2026-10-23-data.md),
[plan](../reviews/0.3.11/iteration-2/2026-10-23-plan.md). The local gate on the next commit found the prototype's board and
task views without a page heading in some states (the product report's browser suite); fixed in `caefb24b`, 17 of 17
browser suites pass.

46 findings, none blocking. The data reviewer found the full tier's database test still expecting English where
iteration 1 made a failed settings read name no language (DA-1); the UX reviewer measured that the release's new toggle
buttons never looked pressed (UX-1); the errors reviewer slowed the board and watched the feed start reads on top of
each other and never leave «Читаю…» (ER-1). During this iteration the operator decided two more things (ADR-0176): a task
starts only once its spec is gathered by questions, and work another project's agent should do crosses by the machine's
trust; both are 0.3.12's first work (CO-403, CO-404, SCN-176, SCN-177).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | DA-1 | The database test still expects English when the settings read throws | fixed: `apps/desktop/test/agent-surface.test.mjs` expects no language on a failed read and on the switch off (ADR-0174) |
| V2-2 | UX-1 | The new toggle buttons never look pressed | fixed: a pressed `.lp-button` in `.lp-modes` and `.lc-filters` has the `.lp-tabs` look (`launch.css`) |
| V2-3 | ER-1 | The feed starts reads on top of each other under a slow board | fixed: one read at a time, a poll during a read waits for the next tick (`launch/CommsFeed.tsx`); `CommsFeed.test.tsx` «never starts a read while one runs» |
| V2-4 | DA-2, ER-2 | The newest-posts search swings between two windows and returns fewer than 100 | fixed: the window lies between the widest too-few and the narrowest too-many and converges (`launch/commsNewest.ts`); `commsNewest.test.ts` «a quiet newest stretch over a busy one» (watched failing on the candidate) |
| V2-5 | DA-3 | A read on a post-dense board fetches five times what it keeps | not a defect: within the documented bound of the AGENTS.md row (at most 10 windows of 5 pages); on the operator's board 2 calls |
| V2-6 | DA-4 | The hidden thread list reads the board every 2.5 s under the feed | fixed: the thread list and its responders read once and poll only in «Ветки» (`launch/CommsScreen.tsx`) |
| V2-7 | DA-5, ER-6, ER-7, ER-10 | A project's board takes claims from an estate-wide capped read; main-process reads untested; История's feed waits on a failed projects read | ruled: CO-405, 0.3.12 |
| V2-8 | DA-6, DO-8 | Protocol version 2 is not told to its readers | fixed: CHANGELOG and `operating-surfaces.md` say the protocol is version 2 and why |
| V2-9 | ER-3 | An unreadable settings file names a language the person may have switched off | fixed: an `unreadable` settings read names no language (`main/index.ts`, `readSettingsState`) |
| V2-10 | ER-4 | A claimed task back in the queue shows in two columns | fixed: a task in the queue is not in «В работе» (`shared/homeLive.ts`) |
| V2-11 | ER-5 | An unread column shows the count 0 | fixed: its count reads «?» (`KanbanBoard.tsx`, `HomeWork.tsx`) |
| V2-12 | ER-8 | The feed keeps a project filter whose posts left the read | fixed: such a filter is dropped (`CommsFeed.tsx`) |
| V2-13 | ER-9, UX-2 | The board header's actions can close what is open and keep the queue's heading on the kanban | fixed: an action that switches the tab opens, never closes; the kanban has its own kicker, heading and lede (`BoardScreen.tsx`, i18n) |
| V2-14 | UX-3, UX-5 | On a project page the agents heading overflows and the compact row says nothing | fixed: the one-line heading rule is the home's side column only, the compact row shows the task alone; the browser case runs at 230 px (`launch.css`, `HomeWork.tsx`, `shell-scroll.browser.mjs`) |
| V2-15 | UX-4 | Arriving with a row in one column leaves its detail 5800 px down | fixed: the arrived row's detail takes focus and comes into view (`BoardScreen.tsx`) |
| V2-16 | UX-6, DO-9 | The feed's filtered empty and failed refresh say too little | fixed: «Под этот фильтр ничего не подходит» with «Показать всё»; a failed refresh says when the posts were read, with «Попробовать снова»; «просьба» in both places |
| V2-17 | UX-7 | История's feed shows an em dash for an event with no project | fixed: «без проекта» (`Feed.tsx`) |
| V2-18 | UX-8, PL-3, DO-1 | Scenario statuses and the task labels disagree with the code | fixed: SCN-163, SCN-168 and SCN-170 implemented in both places with what is not built named; SCN-166, SCN-173 and SCN-174 draft; SCN-174 and OF-21 name the shipped labels |
| V2-19 | UX-9 | The language hint is read twice by a screen reader | fixed: the hint sits outside the label as the select's description (`SettingsScreen.tsx`) |
| V2-20 | UX-10 | Агенты has no page heading | fixed: an h2 «Агенты» (`HomeWork.tsx#AgentsAtWork`) |
| V2-21 | UX-11 | Derived rows say an agent wrote nothing; «You are needed» | fixed: «Кроме заголовка, здесь ничего нет»; «Needs you» |
| V2-22 | UX-12 | A capped empty column does not say what to do | fixed: it says a project's own board shows all of its tasks |
| V2-23 | DO-2 | SCN-126 and SCN-170 quote the retired hint | fixed: dated lines quote the shipped hint |
| V2-24 | DO-3, DO-6 | Unbuilt parts handed to rows that do not hold them; the swipe and SCN-073's warning | fixed: CO-401 holds OF-29's half, the board filters, the task history and the swipe; SCN-143 and SCN-162 cite it; SCN-073 says the warning is on the home |
| V2-25 | DO-4, PL-8 | The merge log records landings that have not happened | fixed: the release commit folds them into the one landing with its time (Release close) |
| V2-26 | DO-5, PL-4 | `main` moved again | fixed: `origin/main` is merged into the branch again; the reviewed candidates stay ancestors |
| V2-27 | DO-7 | Walk status cells are spliced | fixed: OF-14, OF-19, OF-23, OF-30 and OF-35 rewritten as «partly done … ; not built: … (CO-…)» |
| V2-28 | DO-10 | P-20 sweeps CO-291 the note does not list | fixed: P-20 keeps CO-291 on its own trigger |
| V2-29 | PL-1 | The rollout does not check the disk | fixed: step 0 measures the disk and swap and frees space above 3 GB before the quit (Rollout) |
| V2-30 | PL-2 | 0.3.12 carries 66 rows with no step that decides them | fixed: P-25 opens with a triage of every carried row, CO-377 first by 2026-10-31 |
| V2-31 | PL-5 | DEC-0106 affects `estate-record/1` and has no row | ruled: CO-402, 0.3.12 |
| V2-32 | PL-6 | CO-382's measurement is due at the install | fixed: the Owed list names it |
| V2-33 | PL-7 | The bundle is replaced while Fabric runs | fixed: the bundle goes in after the person quits (Rollout) |

Exit for iteration 2: every finding is fixed, ruled to a register row or not a defect. Blocking findings open: none.

## Iteration 3

_Not started._

## Release close

_Not started._
