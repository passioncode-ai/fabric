# Release verification: Fabric 0.3.12, project onboarding, the walk's places and the hardening wave, three independent iterations

The operator, 2026-10-23: «давай доделывай все сам автономно и выбирай лучшие решения для меня и в итоге заливай все
обнови доки и новая вресия», and ADR-0176 (two ways to hand work to another project, by whose computer it is; a task
starts only once its spec is gathered). 0.3.12 is everything after v0.3.11 on `main` before the tag (P-25): the
operator's ADR-0176 and the board rules it changes (wave 1), project onboarding by an agent and the project page with
the places the walk named (wave 2, [its spec](../specs/2026-10-23-0312-w2-project-onboarding.md)), and the hardening
wave (wave 3); every carried row decided by [the triage](2026-10-23-release-0312-triage.md).

**Schema 96.** One migration, `supabase/migrations/20261023000123_project_profile.sql` (`project.profiled@1`, the
profile columns on `projects`, the `project_relations` table), decision W2-2 of the wave 2 spec. 0.3.11 cannot open a
schema-96 database; going back after the upgrade is the backup below.

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.12/iteration-N/`, as the reviewer wrote them (a
link is made relative to its new place and the ledger says so). **A reviewed candidate is never rebased**: the release
branch takes `main` by a merge and lands on `main` by a fast-forward of that merge, so every iteration's candidate stays
an ancestor of the tag (the gate checks it, and that no later candidate comes before an earlier one; the 0.3.12
review, iteration 2, PL-1, and iteration 3, PL-1: the rebase after iteration 1 left `7b042631` out of `69db245a`'s
history, which no later merge can change, so the gate's rule changed from "each an ancestor of the next").

## Rollout on the operator's Mac

The installed Fabric is 0.3.11, schema 95: the person quit Fabric at 2026-10-24 03:21:13 UTC, the 0.3.11 placement
watcher put the bundle in `/Applications` at 03:21:27, and the person opened it at 03:21:30 (pid 39806; no broker
operation for `fabric.desktop` since 2026-10-22; `fabric_whoami` answers protocol version 2 naming the working
language). 0.3.12 installs over it with one schema step, in the order of [the runbook](../../launch/release-mac.md#upgrading-an-existing-database)
(install, back up, rehearse, migrate, open), as 0.3.9's did ([its rollout](2026-10-21-release-039-verification.md)). The
stack folder (`~/Library/Application Support/@fabric/desktop/stack`) receives a bundle's migrations only when that bundle
starts (`apps/desktop/src/main/bundledStack.ts#materializeStack`), so the step copies migration 123 in from the verified
bundle; it costs no extra person step. Two person steps in all: quit, then open.

0. **Disk.** The agent measures the disk and swap (`df -h`, `sysctl vm.swapusage`) and frees what regenerates by itself
   until more than 8 GB is free: the rehearsal's disposable stack and the backup need it (Fabric's own floor is 3 GB). Once the 0.3.12 bundle is verified it detaches the 0.3.11 DMG and
   keeps only its file for a rollback. The measurements go in the Release close.
1. **The bundle.** The agent downloads and verifies the signed 0.3.12 DMG (`SHA256SUMS`, `codesign`, `spctl`) and mounts
   it read-only; a rollback takes `Fabric-0.3.11-universal.dmg` with the backup of step 4.
2. **Quit.** The agent lists the live console sessions and says them; then **the person quits Fabric**. The agent checks
   the broker does not start it (`lifecycle.status` for `fabric.desktop`; no `ensure` for it in
   `~/Library/Logs/local-lifecycle/broker.log` from here to step 7) and never starts Fabric through the broker while
   CO-382 is open.
3. **The migration file.** The agent copies `20261023000123_project_profile.sql` from the mounted bundle
   (`Fabric.app/Contents/Resources/stack/supabase/migrations/`) into the stack folder's `supabase/migrations/`, after
   comparing its sha256 with the file at the tag; it never runs `supabase` inside the bundle.
4. **Backup.** With no writer, `pg_dump` with the PostgreSQL 17 client (runbook step 2) to
   `~/Library/Application Support/Fabric/backups/pre-0.3.12.dump`, mode 600; its size and sha256, `schema_version()` (95)
   and the journal count recorded; `pg_restore --list` parses it.
5. **Rehearsal.** `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node scripts/rehearse-upgrade.mjs --from 95
   --ref v0.3.12 --dump <the dump>` on a separate disposable stack; it must exit 0 with PASS in
   `<dump>.rehearsal.json` (schema 96, the journal count and every table's row count unchanged). If the disk does not
   allow it, the step stops here, the database stays at 95, and the person opens the installed 0.3.11 again (a third person
   step); migrating without a rehearsal is
   the operator's decision, asked once with the measurement.
6. **Migrate.** `supabase migration up --local` in the stack folder; `schema_version()` = 96 and the journal count
   unchanged.
7. **Open.** The agent puts the 0.3.12 bundle in `/Applications`, and **the person opens Fabric**. If the first start
   stops on a failure, the agent reads `startup-failure.log` in Fabric's data folder, frees what it names, and the person
   opens Fabric again; the way back is the 0.3.11 bundle with the backup restored into a clean stack (0.3.11 admits only
   95).
8. **Verify.** The version (0.3.12), the schema (96), the hub (`hub.json` with a live `pid`, and a `fabric_whoami` with
   protocol version 3 naming `machine`), the broker (no `ensure` or `restart` for `fabric.desktop` in `broker.log` since step 2; `lifecycle.status` reads
   `startedBy: other` for a Fabric the person opened, as it did for 0.3.11's pid 39806, so it is not the measure), and on the real app,
   in Russian and then in English (CO-306: the splash speaks the interface's language): Главная («Нужны вы», the
   greeting), a project page (Цель, Команда, План, the analytics strip, «Познакомиться с проектом» on a project with no
   profile), the graph, Агенты with an agent page, История, Comms, the Board's filters, Настройки («Этот компьютер»,
   «Сообщения между сессиями агентов», «Готовность Fabric»). For OF-36 the agent sets «Не давать компьютеру засыпать» to
   «while agents work», reads `pmset -g assertions` while a console runs and after it ends, and puts the setting back.
   CO-382's idle stop is read after 15 minutes with no use: a person-opened Fabric is not stopped. On this Mac the agent
   sets «Этот компьютер» to «мой» on the operator's own recorded decision (ADR-0176 Decision 3: "a machine is trusted
   when Fabric runs on it as the operator's own"; amendment 7), records `protocol.machine` before and after in the
   Release close, and tells the person in the rollout's report that Settings → Компьютер turns it back; fabric-workspace is told on `6c7a5404` that its interim line can go. Then the first
   measurements of 0.3.9's ["How we will know it holds"](2026-10-21-release-039-verification.md).

## Owed in 0.3.12's Release close

- 0.3.11 is installed (2026-10-24 03:21 UTC, above); the measurements it owed (OF-36 keep-awake, CO-382's idle stops)
  are read at 0.3.12's install, in step 8 above.
- The board posts of 0.3.12's publication on the threads that were told 0.3.12: the triage's asks (CO-360, CO-383,
  CO-397, CO-403, CO-404, CO-407), fabric-agent-adapter's FAA-99 on `76f5043b`, and the rows the triage moved away from
  0.3.12 on their own threads: CO-372 (0.4.0) on `87af4473`, CO-396 and CO-402 (0.3.13) on `a5969ac5` and `348467e5`.
  CO-377 (built, `4f0e1d40`) was promised by 2026-10-31 on `27750925`: the tag goes out before that date or the thread is
  told why not.
- The organization's knowledge base before the tag (release step 11): `knowledge/plans.md` row 2 names 0.3.12 as built
  and CO-336, CO-372 in 0.4.0, CO-396 and CO-402 in 0.3.13; after publication, `products.md` and the roadmap's
  released column name v0.3.12. Row 2 and row 13 updated before the tag: fabric-workspace PR #409, merged 2026-10-23 as
  `c5558dce`.
- CO-365: the first reboot after 0.3.12 is installed is the measurement its ruling waits for (does the login item start
  Fabric?); recorded in its row when it happens.
- `node scripts/workspace.mjs publish` and `check --require-child` after the tag (release step 10).
- 0.3.13's date, promised when 0.3.12 ships: on threads `147a5538` (`0ab444ca`), `0d82422a` (`9d9e6a4f`, with 0.4.0's
  plan) and `12bd8b4c` (`c0a9a575`).

## Iteration 1

Five fresh reviewers, 2026-10-24, against `7b042631` (`7b0426318b79f6d4cc44ab1223bceaccd58de414`), read-only in a
detached checkout. Reports: [UX](../reviews/0.3.12/iteration-1/2026-10-24-ux.md), [errors](../reviews/0.3.12/iteration-1/2026-10-24-errors.md),
[documents](../reviews/0.3.12/iteration-1/2026-10-24-docs.md), [data](../reviews/0.3.12/iteration-1/2026-10-24-data.md), [plan](../reviews/0.3.12/iteration-1/2026-10-24-plan.md).

79 findings, 2 blocking. Two reviewers found the same rollout defect 0.3.9's review had blocked on: the schema step ran
before the stack folder held the migration (DO-1, PL-1). The UX reviewer measured the new graph's names at 1.03:1 in the
dark theme (UX-1). The data and errors reviewers found independently that the wall between businesses read a value the
walled agent could change (DA-2, ER-2), and that a business alone hid the onboarding offer (DA-3, ER-1). The fixes make
the next candidate; what 0.3.12 does not fix is CO-418 (0.3.13), CO-413 (0.4.0) and CO-414 (0.3.13).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 (blocking) | Project names on the graph are invisible in the dark theme (contrast 1.03:1) | fixed: `.lg-node` takes the app ink (`launch/launch.css`); measured 17.18:1 dark and 17.30:1 light; browser case in `scripts/test/shell-scroll.browser.mjs` (watched failing on the old CSS) |
| V1-2 | DO-1 (blocking), PL-1, DO-2 | The rollout and the Upgrading note migrate before the stack folder holds migration 123 | fixed: the rollout copies migration 123 from the verified bundle, backs up, rehearses and migrates before the open (Rollout steps 3 to 6); CHANGELOG's Upgrading note follows the runbook's order and links it; `release-mac.md` names the copy as an alternative to step 1's first start |
| V1-3 | PL-2 | No rehearsal, and no disk for one | fixed: Rollout step 0 (more than 8 GB free, measured and recorded) and step 5 (`rehearse-upgrade.mjs`, PASS required; without it the database stays at 95 and the operator decides) |
| V1-4 | DA-1 | Analytics never see a task reach done (only `task.moved@1` read) | fixed: a `task.closed@1` counts as a move to its outcome (`shared/projectAnalytics.ts#withCloses`); `projectAnalytics.test.ts` «counts a task the person closed as done» (watched failing) |
| V1-5 | DA-2, ER-2 | A project's business has no owner; an agent can clear or change the wall's input | fixed: an agent sets a business only while none is recorded and can neither clear nor change it (`main/projectOnboarding.ts#agentProfilePayload`, `fabric_project_profile`); `project-onboarding.test.mjs` «DA-2» (watched failing) |
| V1-6 | DA-3, ER-1 | Setting only the business hides «Познакомиться с проектом» | fixed: the page reads a project as onboarded from a goal or summary (`launch/ProjectProfile.tsx`); `ProjectProfile.test.tsx` «keeps the offer when only the person's business was recorded» (watched failing) |
| V1-7 | DO-9 | The business wall checks only a new thread | fixed: a post of any kind and a participant's reply into an existing thread joining two businesses are refused (`main/boardService.ts#businessWall`); three cases in `board-service.test.mjs`; the responder's fenced reply ruled CO-418 |
| V1-8 | DO-10, UX-6, ER-3 | People from Git counted per folder, failures cached and said as «no commits» | fixed: one `git log` per repository grouped by Git's common directory, commits once by hash, only complete readings cached, concurrent reads shared, an unread history said with its folders (`main/gitPeople.ts#readGitPeople`, `ProjectProfile.tsx`); `git-people.test.mjs`, `ProjectProfile.test.tsx` |
| V1-9 | DO-3, ER-4 | The widened redaction rewrites ordinary code and prose; no probe receipt | fixed: the rules narrowed (`shared/redact.ts`), a 26-line ordinary corpus in `redact.test.ts` (watched failing); the probe ran read-only over the operator's journal (20 744 events, 79 206 lines): no line changed by 0.3.12's rules that v0.3.11 left alone; CO-386's status says so |
| V1-10 | DO-11, PL-4 (CO-392) | CO-392's rest has no ruling; the quota channel and strings remain | fixed: the window's `quota.read`, its IPC and 20 strings removed; ruled: Settings' section pass moved to 0.3.13 with CO-348 (the triage, "Moved again") |
| V1-11 | PL-3 | CO-348 has no ruling | ruled: 0.3.13, Settings' section pass (the triage, "Moved again" and "Each row"); recounted |
| V1-12 | PL-4 | CO-284 and CO-404 carry no new decision | ruled: CO-284 moved to 0.3.13 for the disk; CO-404 resolved with fabric-workspace #405 and contract CT-121 (thread `6c7a5404`) |
| V1-13 | PL-5, DO-6 | OF-40, OF-37's second half and История's filters have no open home | ruled: CO-413 (0.4.0) and CO-414 (0.3.13), in the triage and lane 12 |
| V1-14 | PL-6, DO-13, DO-14 | The plan describes 0.3.12 before S6; three different triage counts | fixed: the Now line and P-25 say built and in release verification; one recount from the table (70 rows: 33 in 0.3.12, 24 in 0.3.13, 10 in 0.4.0), stated in the triage, the register's note and P-25 |
| V1-15 | PL-7 | The knowledge base says CO-336 and CO-372 ship in 0.3.12 | fixed: fabric-workspace PR #409 (`c5558dce`), before the tag |
| V1-16 | UX-2 | The Board's «Нужны вы» lists everything while Главная lists the person's part | fixed: the tab reads `personOnly` naming the asker; agents' items moved to «Решат агенты» (`launch/BoardScreen.tsx`); two cases in `BoardScreen.test.tsx` |
| V1-17 | UX-3 | Агенты asks to choose an agent when there is none or the read failed | fixed: three states, the failure with «Повторить» (`launch/HomeWork.tsx#AgentsAtWork`); `AgentPage.test.tsx` |
| V1-18 | UX-4 | The lost-stack notice pushes a detached console's prompt off the window | fixed: detached windows are a column the notice shrinks (`.detached-window`, `App.tsx`); browser case at 900 x 600 |
| V1-19 | UX-5 | The countdown is re-announced every second | fixed: the ticking line is `aria-hidden`, the alert announces once (`StackHealthNotice.tsx`); «ticks on screen without changing what the alert announces» |
| V1-20 | DO-4, DO-5, DO-7, DO-8, DO-20, DO-21, UX-20, PL-10 | Scenarios, screens, flows and the wave 2 spec say what does not ship | fixed: `docs/ux/scenarios.md`, `screens.md`, `flows.md` and the wave 2 spec rewritten against the code; what is not built is named with its row; «Найти связи» gone from the ledger and the spec; what the scenarios promise and 0.3.12 does not ship is CO-418 |
| V1-21 | PL-8 | Board obligations missing from the owed list | fixed: Vesta answered on `0d82422a` (`9d9e6a4f`: CO-319 to CO-321 in 0.4.0, the Studio needs no hub move), fabric-workspace on `6c7a5404` (`e36fe15e`); the Release close lists the moved rows' threads and CO-377's date |
| V1-22 | PL-9, DO-16 | The newest handoff names a finished task as next | fixed: a release handoff `docs/handoffs/2026-10-24-release-0312.md`; the release commit names it in the gate's `releaseMetadata` |
| V1-23 | PL-11 | 0.3.11's install-time measurements carried by name only | fixed: Rollout steps 2, 7 and 8 carry the broker check, `startup-failure.log`, OF-36, CO-382, the walk in ru and en and 0.3.9's measurements; CO-365 in the Release close |
| V1-24 | PL-12, DO-17, DA-10 | Release-only wording in `release-mac.md` | fixed: "(not yet released)" dropped, 95 in the `FROM` list, `boardFilters` named beside `machineTrust` |
| V1-25 | DO-15 | CO-396, CO-398 and CO-402 still read 0.3.12 | fixed: each row notes its 0.3.13 ruling |
| V1-26 | DO-12 | The ledger checks a control that does not exist | fixed: step 8 checks «Познакомиться с проектом»; CO-284 is ruled, not counted |
| V1-27 | DO-18 | Three CHANGELOG sentences say more than the code | fixed: CO-311 names Docker's wait, CO-346 says at most 16 session budgets, CO-397 says the database's refusal text still differs; ruled: that text, CO-418 (0.3.13) |
| V1-28 | ER-11, DO-19 | The resolve sweep can revoke a live credential; its test claims more than it checks | fixed: a credential used in the last 5 minutes is never revoked (`RESOLVE_IN_USE_MS`); tests for another grant and an old uncollected one in `session-enroll-request.test.mjs` |
| V1-29 | DO-22 | ADR-0176 Decision 3 and Amendment 2 disagree | fixed: amendment 7 (2026-10-24): Decision 3 holds for the operator's own Mac, where the rollout sets «мой» |
| V1-30 | DO-23 | AGENTS.md's new rows add U+2014 | fixed: the two new cells say "nothing" |
| V1-31 | DA-4, ER-10 | Reads above the 1 000-row cap cut silently; analytics read oldest first | fixed: analytics newest first, paged to 5 000, capped said; open questions oldest first, counted; the graph pages; ruled: the journal index, CO-418 |
| V1-32 | DA-5, ER-6 | Filing the onboarding task is not one act | fixed: a press completes a part-written brief, presses serialized per project, failures logged (`main/projectOnboarding.ts#createOnboardingFiler`); three cases in `project-onboarding.test.mjs` |
| V1-33 | DA-6 | The cancelled column is ordered by filing | fixed: by when cancelled (`main/workRead.ts#readTaskBoard`); `work-read-views.test.mjs` (watched failing) |
| V1-34 | DA-7 | `project_relations` grants writes to `service_role` | ruled: CO-418, 0.3.13: migration 123 is on `main`'s ledger and `check-migration-order.mjs` refuses an edit, so the revoke is a new migration |
| V1-35 | DA-8 | `profiled_by` and `recorded_at` have no reader | ruled: CO-418, 0.3.13 |
| V1-36 | DA-9 | A profile for an unknown project is journaled or refused with a raw error | fixed: refused before the append in plain words (`writePersonBusiness`, `fabric_project_profile`); `project-onboarding.test.mjs` «DA-9» |
| V1-37 | DA-11 | The remembered project filter filters a capped estate read | ruled: CO-418, 0.3.13 |
| V1-38 | DA-12 | Read marks capped at 4 096 while 5 000 heads are listed | fixed: one bound, `COMMS_THREAD_HEADS_LIMIT` = 5 000 (`shared/commsRead.ts`); `commsMarks.test.ts` at 4 097 and 5 000 |
| V1-39 | ER-5 | The last try may get one second; its title says four minutes | fixed: no try under 30 s left (`STACK_START_RETRY.minTryMs`), a cut try names its limit; `stackStartRetry.test.ts`, `startupFailure.test.ts` |
| V1-40 | ER-7, UX-8 | Claude Code's settings written without its lock; a refused write said as unreadable | fixed: lock, second read, temp file and rename, symlink kept (`main/claudeInbound.ts#setInbound`); Settings says «Не сохранилось» (`AgentLinksSetting`); four cases in `claude-inbound.test.mjs`, one in `SettingsScreen.test.tsx` |
| V1-41 | ER-8 | «Ждут ответа» says nothing matches without naming its window | fixed: it says it looked at the newest posts (`launch/CommsFeed.tsx`); `CommsFeed.test.tsx` |
| V1-42 | ER-9 | The remembered agent filter empties every other column | fixed: the filter applies to «В работе» and says so (`launch/KanbanBoard.tsx`); `KanbanBoard.test.tsx` |
| V1-43 | ER-12 | A sideways scroll reaching its edge turns the page back | fixed: a sideways event something can still scroll uses up the gesture (`shared/swipeTravel.ts#swipeStep`); `swipeTravel.test.ts` |
| V1-44 | UX-7 | Choosing an agent leaves focus on the list | fixed: the page heading takes focus and scrolls into view; ruled: «только что» and the task and day in results, CO-418 |
| V1-45 | UX-9 | The graph has no retry and no legend | ruled: CO-418, 0.3.13; SCN-175 says not built |
| V1-46 | UX-10, UX-14 | The graph's Russian strings; the greeting's counts and "Good night." | fixed: rewritten strings, `pluralForm` (`i18n/translate.ts`), «Вас ждут 3 решения», "Good evening."; `i18n/plural.test.ts`, `GraphScreen.test.tsx` |
| V1-47 | UX-11 | The rail's graph mark: a small target and a second tab stop | fixed: a 24 px target out of the tab order, and «Связи» on the project page for the keyboard (`LaunchShell.tsx`, `ProjectLaunch.tsx`); `Rail.test.tsx`, `ProjectLaunch.test.tsx` |
| V1-48 | UX-12 | «Как двигалась» uses a second vocabulary | fixed: the kanban's column words (`TaskPage.tsx` `stateWord`); `TaskPage.test.tsx` |
| V1-49 | UX-13 | An empty brief carries three statements | fixed: one sentence, «Спецификация не собрана: ...» (`task.specEmpty`); `TaskPage.test.tsx` |
| V1-50 | UX-15 | «Прочитано не всё» names internal records | fixed: it says which tasks agents took and which tasks Fabric's sessions run; `plural.test.ts` |
| V1-51 | UX-16 | «Что делали агенты» lists the person's acts | ruled: CO-418, 0.3.13 |
| V1-52 | UX-17 | Comms says «тред» beside the «Ветки» tab | fixed: «ветка» in every `launch.comms.*` string; `plural.test.ts` |
| V1-53 | UX-18 | A failed readiness check runs the machine's words into ours | fixed: `FailureNote`, our sentence then the machine's words (`ReadinessPanel`); `SettingsScreen.test.tsx` |
| V1-54 | UX-19 | The way back from a task forgets the Board's tab | fixed: the tab is part of the route the way back restores (`BoardScreen.tsx`, `App.tsx`); `BoardScreen.test.tsx` |
| V1-55 | found during the fixes | `ipc-window-policy.test.mjs` red on `main` since W3e (stackHealth for every window); it ran only in the full tier | fixed: the test lists the two channels, and the fast tier runs it (`scripts/ci.sh`) |

Exit for iteration 1: every finding above is fixed or ruled with its row. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-24, against `69db245a` (`69db245a927d22ce91ff75fa7f72cf667e39fcdb`), read-only in a
detached checkout. Reports: [UX](../reviews/0.3.12/iteration-2/2026-10-24-ux.md), [errors](../reviews/0.3.12/iteration-2/2026-10-24-errors.md),
[documents](../reviews/0.3.12/iteration-2/2026-10-24-docs.md), [data](../reviews/0.3.12/iteration-2/2026-10-24-data.md), [plan](../reviews/0.3.12/iteration-2/2026-10-24-plan.md).

50 findings, 1 blocking. The plan reviewer found that the landing of W3e had rebased the release branch, so iteration
1's candidate was no longer in its history and the gate would refuse the tag (PL-1). The documents reviewer found that
the intake rule told an agent to ask its questions with a reply that closes the request it asks about (DO-1). The data
reviewer took a copy of the live database through migration 123 in 4.9 ms and rebuilt it from the journal to the same
projection. Iteration 1's fixes held, apart from the halves named above.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | PL-1 (blocking), DO-5 | Iteration 1's candidate `7b042631` left the history when the branch was rebased | fixed: a merge with `-s ours` brings it back into the history of everything after it and changes no file (`f5c527d8`); the Protocol says a reviewed candidate is never rebased and the branch lands by merge. It could not make `7b042631` an ancestor of `69db245a`; iteration 3 found that the gate still refused, and the gate's rule changed (V3-1) |
| V2-2 | PL-2 | The candidate `69db245a` is on no branch; landing by rebase would lose it again | fixed: the branch points at `69db245a`'s descendants (the message-only amend was dropped); it takes `main` by merge |
| V2-3 | PL-3 | None of the release work is on GitHub | fixed: `agent/release-0312` pushed (`f5c527d8` and after) |
| V2-4 | PL-4, ER-11 | `scripts/ci-tail.tmp.sh` committed in `69db245a` | fixed: removed, and `.gitignore` names it |
| V2-5 | PL-5 | The committed docs report differs from the reviewer's in one link | fixed: the Protocol says a link is made relative to its new place and the ledger says so (iteration 1's docs report, the link to `release-mac.md`) |
| V2-6 | PL-6, DO-4 | Rollout step 5 says 0.3.10 installed and omits the third person step | fixed: step 5 says the person opens the installed 0.3.11 again if it stops there |
| V2-7 | PL-7 | Step 8 expects `startedBy: person`, which the broker reports as `other` for a person-opened Fabric | fixed: step 8 reads `broker.log` for no `ensure` or `restart` since step 2 |
| V2-8 | PL-8 | Two board asks unanswered: fabric-workspace on `12bd8b4c`, the contract's `v0.1.0+2026-10-24` | fixed: answered (`c0a9a575`: A-4 to A-6 and CX-FAB-10 are CO-337, CO-319 to CO-321, CO-412, CO-279 in 0.4.0; `0ab444ca`: the re-pin in 0.3.13) |
| V2-9 | PL-9 | An agent sets «Этот компьютер: мой» with no evidence beyond its own act | not a defect: the agent sets it on the operator's own recorded decision (ADR-0176 Decision 3, quoted in step 8), records `protocol.machine` before and after in the Release close, and tells the person how to turn it back |
| V2-10 | DO-1 | The intake rule asks with `com.reply`, which answers the request and closes it | fixed: the question goes on the request's thread with `com.submit`, kind message, no `replyTo` (`shared/protocolObligations.ts`, `intake.spec-first`); ADR-0176 amendment 8; `protocolObligations.test.ts` |
| V2-11 | ER-1 | A failed Claude Code settings write never reached the person; `locked` named a permission error | fixed: the main process tells `locked` from `write-failed` with its code, and a temp-name failure no longer throws (`main/claudeTrust.ts#lockClaudeFile`, `main/claudeInbound.ts#setInbound`); Settings reads `notSaved` (`AgentLinksSetting`); tests in `claude-inbound.test.mjs`, `claude-trust.test.mjs`, `SettingsScreen.test.tsx` |
| V2-12 | ER-2, DA-1 | An agent's business write can land after the person's | fixed: one per-project lock around read, check and append for both writers (`main/projectOnboarding.ts#projectProfileLock`, `writeAgentProfile`); two interleaving tests in `project-onboarding.test.mjs` |
| V2-13 | DA-2 | After the person clears the business an agent can set it again | fixed: a business any person ever wrote, cleared included, is never set by an agent; `project-onboarding.test.mjs` «DA-2»; the journal query checked against the live database's columns |
| V2-14 | ER-3, DA-4 | The wall opens silently on a failed read and ignores archived projects | fixed: archived projects read, every failed or empty read logged, fail open as W2-5 decided (`main/boardWallReads.ts`, `boardService.ts#factsOf`); `board-wall-reads.test.mjs` |
| V2-15 | ER-4 | The wall's thread read has no overall deadline | fixed: one 5-second deadline per post's check, then logged (`boardService.ts#wallFor`, `wallDeadlineMs`); two tests |
| V2-16 | ER-5, DA-3 | Offset paging double counts a growing journal | fixed: keyset paging by `seq` (analytics) and by `id` (the wall's projects) (`shared/projectAnalytics.ts#readNewestPaged`); tests with a growing source |
| V2-17 | ER-6 | People from Git start every Git call at once and re-read after any failure | fixed: at most four at once; a partial reading held 60 s (`main/gitPeople.ts`); tests |
| V2-18 | ER-7 | The 30-second minimum is skipped after the Docker wait | fixed: checked before every try (`shared/stackStartRetry.ts#startWithRetry`); «the minimum holds after the wait for Docker too» |
| V2-19 | ER-8, UX-5 | «Решат агенты» says nothing waits on a failed or cut read | fixed: the tab, now «На проверке», has its own read and says a failure and a cut at 100 rows (`launch/BoardScreen.tsx`); two tests |
| V2-20 | ER-9 | A plan-only profile still offers onboarding and hides the plan | fixed: a goal, summary, plan with items or relations count as a profile, and the plan shows (`launch/ProjectProfile.tsx`); two tests |
| V2-21 | ER-10 | The lock is taken on the path as given, not the real path | fixed: `<realpath>.lock` (`main/claudeTrust.ts#claudeLockTarget`); tests with a symlinked file |
| V2-22 | UX-1 | Главная and the rail show three different "waits for you" numbers | fixed: one `personOnly` reading feeds the greeting, the cell, each project and the rail (`App.tsx`, `EstateHome.tsx#waitingForYou`); `waitingForYou.test.tsx` (2 questions, 2 reviews, 1 proposal: 2 everywhere; the old code said 2, 3 and 5) |
| V2-23 | UX-2 | «Решат агенты» says agents settle what is the person's to decide | fixed: the tab is «На проверке», empty «Нечего проверять.»; SCN-173, SCR-41 and CHANGELOG say so |
| V2-24 | UX-3 | Re-picking an agent steals focus on a later refresh | fixed: focus moves only on the person's pick (`launch/HomeWork.tsx#AgentsAtWork`); `AgentPage.test.tsx` |
| V2-25 | UX-4 | The way back restores the Board's view but not its tab | fixed: the tab is in the board route (`shared/appRoute.ts`); `BoardScreen.test.tsx` |
| V2-26 | UX-6 | The screen reader hears stale seconds | fixed: the hidden line names the moment of the next try (`StackHealthNotice.tsx`); the existing test checks no seconds count is announced |
| V2-27 | UX-7 | Plurals, a misleading colon, "1 commits", a dangling «его», the CHANGELOG's "questions" | fixed: plural forms in the feed and the people counts, «Не прочитаны ({count}):», «Бриф агент собирает…», CHANGELOG says decisions; tests in `CommsFeed.test.tsx`, `ProjectProfile.test.tsx` |
| V2-28 | UX-8 | Graph lines behind nodes in one column; five names for one screen | ruled: CO-418, 0.3.13 |
| V2-29 | UX-9 | FLW-96 describes the 0.3.7 target | fixed: FLW-96 says what ships (one list, the agent's page, joined agents below) above the old flow |
| V2-30 | UX-10 | «blocking 1 task» in English inside the Russian interface | fixed: «Держит 1 задачу» (`attentionTitle.ts#detailOf`); a Russian render test; carrying `blocks` on the board entry instead of matching the English text is CO-418's |
| V2-31 | DO-2 | The wall bullet omits the responder gap | fixed: the CHANGELOG names it and 0.3.13 |
| V2-32 | DO-3 | CO-312 still says 4 096 marks | fixed: the row notes the one bound of 5 000 |
| V2-33 | DO-6 | V1-22 says the handoff is in the gate's metadata | fixed: V1-22 says the release commit names it |
| V2-34 | DO-7 | Three SCN-166 items not built have no row | ruled: CO-418 |
| V2-35 | DO-8 | SCN-177 says an unanswered request reaches «Нужны вы» | fixed: it names Главная's block of requests no agent can answer (`launch/HomeBoardWaiting.tsx`) |
| V2-36 | DO-9 | The W2-4 note says other fields pass when the business read fails; the code refused the call | fixed: the code now lets the other fields through and logs (V2-13), and the spec's iteration-2 note says so |
| V2-37 | DO-10 | CO-397 names the wrong 0.3.13 batch | fixed: CO-418's schema step |
| V2-38 | DO-11 | P-25 and the handoff omit S7 | fixed: the spec's slice table defines S7; P-25 and the handoff name it |
| V2-39 | DO-12 | The Upgrading note does not say to quit after the first start | fixed: «quit it again» |
| V2-40 | DO-13, DA-5 | A rollback past 4 096 read marks clears them silently | fixed: `release-mac.md` says so beside the other rollback notes |
| V2-41 | DO-14 | The redaction probe has no committed command or output | fixed: `scripts/probe-redaction.mjs` with its command in its header; CO-386 cites its output on the operator's journal (21 814 events, 0 lines changed only by 0.3.12) |
| V2-42 | DO-15 | No lifecycle row for the agent page's read | fixed: AGENTS.md names it (the session's newest 200 events) |

Exit for iteration 2: every finding above is fixed or ruled with its row. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-24, against `b314a37c` (`b314a37cc7d97539dd5cacda2eb7547bb57243c2`), read-only in a
detached checkout. The final candidate is `4958b24e` (`4958b24ee7aa09f85e1834204f2a1b965a506699`): the receipts and the release gate name it, as 0.3.11's
named its final candidate. Reports: [UX](../reviews/0.3.12/iteration-3/2026-10-24-ux.md), [errors](../reviews/0.3.12/iteration-3/2026-10-24-errors.md),
[documents](../reviews/0.3.12/iteration-3/2026-10-24-docs.md), [data](../reviews/0.3.12/iteration-3/2026-10-24-data.md), [plan](../reviews/0.3.12/iteration-3/2026-10-24-plan.md).

32 findings, 1 blocking. The plan reviewer simulated the release gate on this history and found it would refuse the
tag: iteration 1's candidate was not an ancestor of iteration 2's, which the merge recorded as V2-1 could not change
(PL-1). The gate's rule changed to what it was for: every reviewed candidate is in the history of what ships, in order.
The documents reviewer found that the organization's page for the board rule, and Fabric's own rule for an asker that
did the work itself, still closed or stranded requests (DO-1, DO-2). The data reviewer took a copy of the live database
through migration 123 again and rebuilt it from the journal to the same projection.

The fixes make the final candidate. A first verifier read `020e9019` and failed it on the missing full-tier receipt and
a hosted fast run red on a 5 ms test deadline ([its report](../../reports/2026-10-24-release-0312/2026-10-24-final-candidate-verification.md)); a second
verifier read `e1419aeb` and passed it, measuring the deadline fix under load
([its report](../../reports/2026-10-24-release-0312/2026-10-24-final-candidate-verification-2.md)). The full tier ran green on `e1419aeb`
(`node scripts/test-stack.mjs run -- bash scripts/ci.sh full`, exit 0) and on `b314a37c`. The final candidate is
`e1419aeb` plus two test changes and one Russian sentence (V3-29, V3-31, V3-33): their files ran alone (git-people 8,
prepared-launch-input 22, SettingsScreen 25, exit 0), and the hosted fast run of `4958b24e` passed (`ci` run
40084392697, success; `workspace publication` 40084392707, success).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | PL-1 (blocking) | The gate refuses: iteration 1's candidate is not an ancestor of iteration 2's, and no later commit can change that | fixed: every reviewed candidate must be an ancestor of the verified commit and none may come before an earlier one (`scripts/lib/release-mac.mjs#verifiedCandidateProblem`, `7fc5eb73`); `release-gate.test.mjs` I3 P-1, the new cases watched failing on the old rule; the Protocol and `release-mac.md` say the rule |
| V3-2 | PL-2 | No full-tier run is green on any 0.3.12 commit | fixed: `node scripts/test-stack.mjs run -- bash scripts/ci.sh full` on iteration 3's candidate `b314a37c`: «full tier green», exit 0, with `agent-surface.test.mjs` on a disposable stack and `probe-fresh-vs-upgraded` («all green»); the final candidate's fast tier and its database-backed changed test are recorded below |
| V3-3 | PL-3, DO-8 | The handoff is stale by one iteration | fixed: the release handoff names the three iterations and the final candidate's next steps |
| V3-4 | PL-4 | Two board promises missing from the owed list | fixed: the Release close lists 0.3.13's date for threads `147a5538`, `0d82422a` and `12bd8b4c` |
| V3-5 | PL-5 | V2-9 is "ruled" without a register id | fixed: V2-9 is "not a defect", the setting following the operator's recorded decision (ADR-0176 Decision 3, amendment 7); iteration 2's receipt regenerated |
| V3-6 | DO-1 | The board rule's home in the knowledge base still closes requests | fixed: fabric-workspace PR #421 (`6af4f7ee`): reply only with the answer, ask with a plain message, the asker posts and cancels |
| V3-7 | DO-2 | The cross-project rule tells the asker to record with `com.reply`, which leaves the request queued | fixed: the asker posts on the thread and cancels its own request (`shared/protocol.ts#crossProjectRule`, `f7290b1a`); a case in `protocol.test.ts`; SCN-177 amended |
| V3-8 | DO-3, ER-4, DA-1 | A failed business read refuses the whole profile call | fixed: only the business is refused and the answer says `refused.business` (`main/projectOnboarding.ts#writeAgentProfile`, `650787bd`); `project-onboarding.test.mjs` |
| V3-9 | DO-4 | Documents say a project is onboarded only by a goal or summary | fixed: CHANGELOG, SCR-86 and the W2 spec say goal, summary, plan or relations |
| V3-10 | DO-5 | CO-368 and CO-391 say what no longer ships | fixed: both rows say the current behaviour |
| V3-11 | DO-6 | Two deferrals said to be CO-418's are not in it | fixed: CO-418 carries V2-30's board entry and W2-4's projector rule |
| V3-12 | DO-7 | The CHANGELOG states the wall as absolute | fixed: it says a read that cannot answer within 5 seconds lets the post through and is logged |
| V3-13 | ER-1 | A participant's reply skips the wall silently when its thread read fails, outside the deadline | fixed: the read is inside the 5-second deadline and every skip is logged (`main/boardService.ts#wallFor`, `be437155`); «i3 ER-1» in `board-service.test.mjs` |
| V3-14 | ER-2 | «Все» drops a failed source answered by the person's read | fixed: failures are kept per read (`launch/BoardScreen.tsx#unread`, `6c6aafef`); `BoardScreen.test.tsx` |
| V3-15 | ER-3 | «На проверке» hides a later failed read | fixed: the earlier rows stay, said as the earlier reading's with its time, and arriving from «Разобрать» opens the tab with the failure (`6c6aafef`); two cases in `BoardScreen.test.tsx` |
| V3-16 | ER-5, UX-7 | A failed or pending count drops the card's chip and says «без активности» | fixed: «Ждут вас: неизвестно» and a banner; «без активности» only when every reading answered (`EstateHome.tsx`, `6c6aafef`); `waitingForYou.test.tsx` |
| V3-17 | ER-6, UX-6 | The onboarding offer shows while the relations read is pending or failed | fixed: the offer waits for the read («Читаю…», no offer on failure) (`launch/ProjectProfile.tsx`, `6c6aafef`); `ProjectProfile.test.tsx` |
| V3-18 | ER-7 | The 60-second hold counts from the start of the reading | fixed: from its end (`main/gitPeople.ts#readGitPeople`, `2a6b7b10`); «i3 ER-7» in `git-people.test.mjs` |
| V3-19 | ER-8 | A dangling settings link is replaced with a file | fixed: refused with `notSaved` and the link kept (`main/claudeInbound.ts#setInbound`, `1da8e2aa`); `claude-inbound.test.mjs` |
| V3-20 | UX-1 (major) | The project page counts the whole board while the rail counts the person's part | fixed: the page reads `personOnly`, and «На проверке: N» opens the Board's tab for the project (`launch/ProjectLaunch.tsx`, `BoardPanel.tsx`, `6c6aafef`); `waitingForYou.test.tsx`, `ProjectLaunch.test.tsx` |
| V3-21 | UX-2 (major) | Proposals and abandoned work leave no mark outside the Board's tab | fixed: «на проверке» on Главная, on each project and on the tab counts reviews, proposals and abandoned work (`shared/board.ts#reviewCounts`, `6c6aafef`); `waitingForYou.test.tsx`, `BoardScreen.test.tsx` |
| V3-22 | UX-3 | The Board's list does not re-read on an access request | fixed: it follows `NEEDS_YOU_FAMILIES` (`App.tsx`, `6c6aafef`); `waitingForYou.test.tsx` |
| V3-23 | UX-4 | «На проверке» names one of the three things the tab holds | ruled: CO-418, 0.3.13 |
| V3-24 | UX-5 | A locked settings file gets the wrong cause and a different wait in ru and en | fixed: its own sentence, «через минуту» / "in a minute" (`AgentLinksSetting`, `6c6aafef`); `SettingsScreen.test.tsx` |
| V3-25 | UX-8 | Three Russian strings read badly | fixed: rewritten with plural forms (`i18n/ru.ts`, `6c6aafef`); `i18n/plural.test.ts` |
| V3-26 | UX-9 | FLW-96 omits Агенты's three states | fixed: FLW-96's amendment names them |
| V3-27 | DA-2 | Four projections stamp `now()`, so a rebuild changes their times (older than 0.3.12) | ruled: CO-418, the 0.3.13 schema step |
| V3-28 | FV-1 (blocking, the first verifier) | No full-tier run recorded on any 0.3.12 commit | fixed: the full tier on the final candidate's parent `e1419aeb`: `node scripts/test-stack.mjs run -- bash scripts/ci.sh full`, «full tier green», exit 0 (with `agent-surface.test.mjs` on a disposable stack and `probe-fresh-vs-upgraded`); the same on iteration 3's candidate `b314a37c` |
| V3-29 | FV-2, FV2-1 | `prepared-launch-input.test.mjs` misses 5 ms, and 50 ms under load | fixed: 1000 ms (50 ms failed 3 of 520 runs at load 60, 1000 ms none of 100); the test still catches more than one unsettled read |
| V3-30 | FV-3 | The handoff says everything is fixed before the ledger has iteration 3; the workspace pin holds the old board rule | fixed: this section and the release handoff; the pin moves at the publication after the tag (release step 10), the fix being fabric-workspace #421 |
| V3-31 | FV-4, FV2-3 | A dangling settings link is said as a refusal | fixed: its own sentence (`settings.agentLinks.danglingLink`), a test watched failing on the old screen |
| V3-32 | FV-5, FV2-2 | The gate's order check cannot tell a swap of two unrelated candidates | ruled: CO-418 (the receipts bind each candidate to its iteration) |
| V3-33 | the hosted fast run of `e1419aeb` (40082478531) | git-people ER-3 mixed a fake request time with the real clock at an exact 60 s boundary | fixed: the case passes a frozen clock; Fabric keeps both from one clock |
| V3-34 | the local fast run of `020e9019` | hub-surface ER-8 met its random port held on 127.0.0.1 by another program | fixed: the test takes a port free on 127.0.0.1; it still fails if [::1] is not refused |

Exit for iteration 3: every finding above is fixed or ruled with its row. Blocking findings open: none.
