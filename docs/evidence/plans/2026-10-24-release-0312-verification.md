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
candidate; their reports are committed under `docs/evidence/reviews/0.3.12/iteration-N/`.

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
   allow it, the step stops here and the database stays at 95 with 0.3.10 installed: migrating without a rehearsal is
   the operator's decision, asked once with the measurement.
6. **Migrate.** `supabase migration up --local` in the stack folder; `schema_version()` = 96 and the journal count
   unchanged.
7. **Open.** The agent puts the 0.3.12 bundle in `/Applications`, and **the person opens Fabric**. If the first start
   stops on a failure, the agent reads `startup-failure.log` in Fabric's data folder, frees what it names, and the person
   opens Fabric again; the way back is the 0.3.11 bundle with the backup restored into a clean stack (0.3.11 admits only
   95).
8. **Verify.** The version (0.3.12), the schema (96), the hub (`hub.json` with a live `pid`, and a `fabric_whoami` with
   protocol version 3 naming `machine`), the broker (`startedBy: person`, no `ensure` since step 2), and on the real app,
   in Russian and then in English (CO-306: the splash speaks the interface's language): Главная («Нужны вы», the
   greeting), a project page (Цель, Команда, План, the analytics strip, «Познакомиться с проектом» on a project with no
   profile), the graph, Агенты with an agent page, История, Comms, the Board's filters, Настройки («Этот компьютер»,
   «Сообщения между сессиями агентов», «Готовность Fabric»). For OF-36 the agent sets «Не давать компьютеру засыпать» to
   «while agents work», reads `pmset -g assertions` while a console runs and after it ends, and puts the setting back.
   CO-382's idle stop is read after 15 minutes with no use: a person-opened Fabric is not stopped. On this Mac the agent
   sets «Этот компьютер» to «мой» (ADR-0176 Decision 3, amendment 7) and reads `protocol.machine.trust` = `mine` in
   `fabric_whoami`; fabric-workspace is told on `6c7a5404` that its interim line can go. Then the first
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
| V1-22 | PL-9, DO-16 | The newest handoff names a finished task as next | fixed: a release handoff `docs/handoffs/2026-10-24-release-0312.md`, named in the gate's metadata |
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
