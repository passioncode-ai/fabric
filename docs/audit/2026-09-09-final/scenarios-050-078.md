# Fabric: SCN-050–078 — текущая реализация и пакеты исправлений

Baseline: `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`. Вердикт: **REFINE**. PASS 0, PARTIAL 16, FAIL 13, BLOCKED 0.

Это проверка production source/callers, не интерактивного целевого прототипа. Ни один live production flow не объявлен PASS.

## Важнейшие результаты

1. TaskRun таблица существует, но допуск записывает другой session_id, чем открывает PTY; запись завершения Run отсутствует в production producer. Старый create+spawn остаётся входом UI.
2. M189 действительно вызывает runs.status; ошибка не в отсутствии виджета, а в ложном orientedAt:null, пропущенном wait/gap, потерянных ошибках источников и обновлении только от output. Два контрпримера воспроизведены чистой функцией.
3. Исторический context pack сохраняется как hash/IDs, а единственные bytes лежат в удаляемом session bundle. Dry preview есть на IPC, интерфейса и exact-past чтения нет.
4. Рутинный цикл может завершиться ошибкой чтения/запуска, но внешний cycle.ran всё равно пишет completed.
5. Прошлый отчёт сохраняем как dated snapshot, а исправления/остатки раскладываем по существующим M/S/CO. Нельзя повторно строить таблицу Run, нельзя снимать графы или backup только потому, что текущий seed не требует их.

## Измерения и пределы

- `python3 docs/ux/lint.py`: exit 0; 0 errors, 38 warnings; missing scenario index SCN-068..080 and flow/file evidence warnings
- `node /tmp/fabric-audit-20260909/reproduce-slice.mjs`: exit 0; actual pure liveness derivation reproduced orientation inputs working→stalled and waitingOn omission waiting→stalled
- Read-only source audit; no database state sampled, no UI walkthrough, no real agent/effect/auth/restore invoked.
- FAIL denotes target scenario missing or broken, not regression in previously released capability. PARTIAL distinguishes shipped foundations.
- Absence checked across current renderer/main/preload including multiline calls; ProjectHome runs.status is present.
- Skill use: ux-audit scenario source tracing; agent-harness prompt/tool boundary inspection; agent-evals distinction between synthetic evaluator and real observed behavior. No interop skill used.
- Parent integrates canonical statuses/leases/Git/publication and owns full auth/storage/chain execution audit.

## Все сценарии

### SCN-050 — PARTIAL

**Уже есть:** Board preview, typed options, CAS answer commit, draft retained on refusal, separate continuation summary.

**Остаток:** Full question route/history absent. Receipt lives only under still-open row; refresh removes answered row. Transport rejection escapes submit try/finally without local catch. Continuation targets pre-spawn session recorded in task_runs; repeated answer RPC re-enters delivery with fresh delivery UUID.

**Владелец:** M151, M152.commit, M152.continue, S04, S13.

**Доказательства:** `apps/desktop/src/renderer/src/BoardPanel.tsx:84`, `apps/desktop/src/renderer/src/BoardPanel.tsx:117`, `apps/desktop/src/main/index.ts:2419`, `apps/desktop/src/main/index.ts:2448`, `apps/desktop/src/main/index.ts:2472`.

### SCN-051 — FAIL

**Уже есть:** Proposal checker exists; decision list distinguishes authorship.

**Остаток:** No manager settlement lifecycle, current-basis assessment UI or human override path. Existing checker is prerequisite, not delivered settlement.

**Владелец:** M158, M157, M168, M194, M173.

**Доказательства:** `docs/ux/screens.md:53`, `apps/desktop/src/renderer/src/DecisionsSection.tsx:74`, `apps/desktop/src/shared/managerEval.ts:3`, `docs/evidence/backlog.md:71`.

### SCN-052 — PARTIAL

**Уже есть:** TaskRun schema and run ordinal; status IPC and agent tile; claim/observation types.

**Остаток:** Admission session differs from actual PTY, no production run.ended producer, missing run/session binding; no PlanRevision/StepClaim/history selector. Widget omits envelope coverage, stale failures and independent clock. Status reader drops orientation/wait/gap inputs and secondary read errors.

**Владелец:** M188, M189, M178, M179, S04.

**Доказательства:** `supabase/migrations/20260909000044_admit_task_launch.sql:111`, `supabase/migrations/20260909000049_task_runs.sql:91`, `apps/desktop/src/main/index.ts:1408`, `apps/desktop/src/main/index.ts:1273`, `apps/desktop/src/main/index.ts:1303`, `apps/desktop/src/renderer/src/ProjectHome.tsx:1598`.

### SCN-053 — PARTIAL

**Уже есть:** Legacy goal list, explicit closed-count truncation and decision lineage list.

**Остаток:** No SCR-40 history/plan routes, typed edge inspector, outline-equivalent view, as-of or historical plan. PlanSection filters completed task membership out of list even while progress counts it.

**Владелец:** M190, M188, M173, S13.

**Доказательства:** `docs/ux/screens.md:52`, `apps/desktop/src/shared/appRoute.ts:36`, `apps/desktop/src/renderer/src/PlanSection.tsx:84`, `apps/desktop/src/renderer/src/DecisionsSection.tsx:90`.

### SCN-054 — PARTIAL

**Уже есть:** List with four actor kinds, superseded predecessors and cap disclosure.

**Остаток:** Source_ref is plain span, not exact navigable source; supplied pack, retrieval receipts, valid-period/branch/as-of selection absent. Current query cannot reconstruct exact past context.

**Владелец:** M173, M191, S13.

**Доказательства:** `apps/desktop/src/renderer/src/DecisionsSection.tsx:56`, `apps/desktop/src/renderer/src/DecisionsSection.tsx:90`, `apps/desktop/src/main/index.ts:2941`, `apps/desktop/src/main/index.ts:419`.

### SCN-055 — FAIL

**Уже есть:** Two-lane types exist; Board obligations cannot be marked read.

**Остаток:** No Inbox route, persistent per-operator watermark, safe event detail reader or displayed-cursor transaction. Type shape does not deliver user flow.

**Владелец:** M185, S14, S13, CO-111.

**Доказательства:** `apps/desktop/src/shared/inbox.ts:25`, `apps/desktop/src/shared/appRoute.ts:36`, `docs/ux/screens.md:54`, `docs/evidence/specs/2026-08-16-software-fabric-carryover.md:122`.

### SCN-056 — PARTIAL

**Уже есть:** Scheduled pass writes cycle.ran, observer called, routine summaries and three-column DTO exist.

**Остаток:** No all-cycles route/detail/wake. Outer cycle reports completed when inner routine read/spawn failed and was swallowed; capped inner partial receipt may be followed by outer completed. No stable tick ID/config revision/cursor across both.

**Владелец:** M186, S15, M179, S04.

**Доказательства:** `apps/desktop/src/main/index.ts:1924`, `apps/desktop/src/main/routineTick.ts:63`, `apps/desktop/src/main/routineTick.ts:196`, `apps/desktop/src/shared/cycleView.ts:25`, `docs/ux/screens.md:55`.

### SCN-057 — PARTIAL

**Уже есть:** Same compiler supports dry IPC preview; source read envelope, character budget and hash exist.

**Остаток:** Preview has no renderer consumer; history keeps only hash/IDs, not immutable rendered artifact/compiler/budget. context.md is removed on session discard. Mandatory sources are optional and not supplied on unattended compile, launch proceeds after context failure.

**Владелец:** M191, M49, S14, S12.

**Доказательства:** `apps/desktop/src/main/index.ts:1209`, `apps/desktop/src/main/index.ts:397`, `apps/desktop/src/main/index.ts:419`, `apps/desktop/src/main/sessionBundle.ts:136`, `apps/desktop/src/main/sessionBundle.ts:196`, `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:137`.

### SCN-058 — PARTIAL

**Уже есть:** Typed project focus and reduced-motion section scroll exist.

**Остаток:** Section scrolling has no exact entity resolution/focus/return stack or disclosure opening. New targeted views absent. TaskPage async load is unguarded, so previous task response can replace selected task contents.

**Владелец:** S13, M187, M190, M191.

**Доказательства:** `apps/desktop/src/shared/appRoute.ts:44`, `apps/desktop/src/renderer/src/evidence.ts:53`, `apps/desktop/src/renderer/src/TaskPage.tsx:52`.

### SCN-059 — PARTIAL

**Уже есть:** Name/purpose project creation without required repository, shell-owned draft survives project tab switch; stable projectId.

**Остаток:** Draft is renderer memory only and excluded from persisted tabs; relaunch loses unfinished fields. Full readiness/admission route still absent.

**Владелец:** S01, S13, S14.

**Доказательства:** `apps/desktop/src/renderer/src/Onboarding.tsx:32`, `apps/desktop/src/renderer/src/Onboarding.tsx:61`, `apps/desktop/src/renderer/src/App.tsx:147`, `apps/desktop/src/shared/tabs.ts:38`.

### SCN-060 — PARTIAL

**Уже есть:** One AppRoute removes prior agents-screen/project navigation collision; project tabs persist.

**Остаток:** Only open project IDs and active project persist; task/ref/filter/scroll/focus/return state does not. Unguarded TaskPage request can show A under route B.

**Владелец:** S13, S01, M102.

**Доказательства:** `apps/desktop/src/shared/appRoute.ts:36`, `apps/desktop/src/shared/tabs.ts:28`, `apps/desktop/src/renderer/src/TaskPage.tsx:52`.

### SCN-061 — FAIL

**Уже есть:** Agent descriptors, capability declarations, proposal checker and synthetic evaluator are useful prerequisites.

**Остаток:** No manager binding/seat lifecycle, replacement fencing, drain, activation authority or cost attribution. Do not treat general runner picker as manager permission.

**Владелец:** M194, M166, M167, M169, M171, M175, M176.

**Доказательства:** `docs/ux/screens.md:56`, `apps/desktop/src/shared/managerEval.ts:3`, `docs/evidence/backlog.md:733`.

### SCN-062 — PARTIAL

**Уже есть:** Retro reader filters category/kind/history, recurrence uses episode identity.

**Остаток:** No review→verification→lesson→recurrence/regression operational lifecycle. Source availability resolver remains incomplete. Reader cannot serve as evidence that CEO recurring retro works.

**Владелец:** M182, M154, M153, M184.

**Доказательства:** `apps/desktop/src/renderer/src/RetroSection.tsx:62`, `apps/desktop/src/main/index.ts:3029`, `docs/evidence/backlog.md:71`, `docs/reports/2026-09-09-queue-progress-report.html:264`.

### SCN-063 — FAIL

**Уже есть:** Local category/subject/episode foundations exist.

**Остаток:** No service-feedback control or inspectable outbound queue. Privacy/version revocation races and endpoint receipts are not implemented; absence is not proof of a tested stop control.

**Владелец:** M183.local, M183.upstream.

**Доказательства:** `docs/ux/screens.md:58`, `docs/reports/2026-09-09-queue-progress-report.html:249`, `docs/reports/2026-09-09-queue-progress-report.html:265`.

### SCN-064 — PARTIAL

**Уже есть:** Mirror declares two entity families, exclusions computed from TABLE_SCOPE; import uses one RPC transaction.

**Остаток:** No SCR-47 complete declared storage reader, exact generation diff/receipt recovery UX or full estate backup. session_context_packs exclusion says regenerated although exact old bytes are not reproducible.

**Владелец:** S12, M198, M191, S14.

**Доказательства:** `apps/desktop/src/shared/storageContract.ts:58`, `apps/desktop/src/shared/storageContract.ts:102`, `apps/desktop/src/main/index.ts:1966`, `docs/ux/screens.md:59`.

### SCN-065 — FAIL

**Уже есть:** Mirror/import correctness foundations exist.

**Остаток:** No verified backup archive or fenced read-only restore environment, authority generation rotation or old-writer rejection. Do not equate declared snapshot import to full restore.

**Владелец:** S12, S07, S02.

**Доказательства:** `docs/ux/screens.md:60`, `docs/reports/2026-09-09-queue-progress-report.html:201`, `apps/desktop/src/shared/storageContract.ts:86`.

### SCN-066 — FAIL

**Уже есть:** Membership command/floor work exists independently.

**Остаток:** No authentication/session identity, invitation link transport or scoped auth return; desktop constructs service-role client with persistence/refresh disabled.

**Владелец:** S09, S02, S03.boundary.

**Доказательства:** `apps/desktop/src/main/index.ts:330`, `docs/ux/scenarios.md:1614`, `docs/reports/2026-09-09-queue-progress-report.html:204`.

### SCN-067 — FAIL

**Уже есть:** Existing-task admission RPC and preload endpoint exist, acknowledgement protocol exists.

**Остаток:** No renderer startExisting caller (multiline scan also checked); tasksStart follows old create+spawn route. New path ignores returned run identity, maps only lease to real PTY, writes delivery.written before deferred PTY flush, does not close admitted run on spawn failure/exit.

**Владелец:** S04, M103, M188, S13, S14.

**Доказательства:** `apps/desktop/src/preload/index.ts:21`, `apps/desktop/src/main/index.ts:1341`, `apps/desktop/src/main/index.ts:1363`, `apps/desktop/src/main/index.ts:1419`, `apps/desktop/src/main/index.ts:1444`, `apps/desktop/src/main/pty.ts:217`, `apps/desktop/src/main/index.ts:494`.

### SCN-068 — FAIL

**Уже есть:** Target prototype describes stage/version path.

**Остаток:** No production versioned pipeline editor; route union has no destination. New scenario lacks index row, lowering discoverability.

**Владелец:** M18, M188.

**Доказательства:** `docs/ux/scenarios.md:1664`, `docs/evidence/backlog.md:237`, `apps/desktop/src/shared/appRoute.ts:36`.

### SCN-069 — PARTIAL

**Уже есть:** Goal create/list, task assignment and orphan task handling exist.

**Остаток:** No criterion versions, explicit result acceptance/rejection, autonomy limits or supersession route. Task completion remains distinct from goal acceptance only in target design.

**Владелец:** M144, M190.

**Доказательства:** `apps/desktop/src/renderer/src/PlanSection.tsx:61`, `apps/desktop/src/renderer/src/PlanSection.tsx:72`, `docs/ux/scenarios.md:1682`.

### SCN-070 — PARTIAL

**Уже есть:** Provider quota/reset visible; unattended quota guard exists.

**Остаток:** No unified usage/capacity/cost/source detail; unreadable quota can disappear instead of explain. Manager cost is unmeasured, subscription terms remain open.

**Владелец:** M83, M94, M171.

**Доказательства:** `apps/desktop/src/renderer/src/ProjectHome.tsx:176`, `apps/desktop/src/renderer/src/ProjectHome.tsx:760`, `apps/desktop/src/main/routineTick.ts:117`, `docs/ux/scenarios.md:1700`.

### SCN-071 — PARTIAL

**Уже есть:** Theme/locale/keep-awake settings and save failure feedback exist.

**Остаток:** No integrated settings screen for storage/inherited project override/revision checks; scenario references M152 (answer lifecycle) as settings owner, which is incorrect.

**Владелец:** M72, M73, S14.

**Доказательства:** `apps/desktop/src/renderer/src/App.tsx:414`, `apps/desktop/src/renderer/src/App.tsx:567`, `docs/ux/scenarios.md:1730`, `docs/evidence/backlog.md:693`.

### SCN-072 — FAIL

**Уже есть:** Notification route target has owner rows.

**Остаток:** No bound identity challenge/channel route/consent/delivery receipt UI. Needs-you obligations must stay with Board; cannot create second task store to implement notification read state.

**Владелец:** M159, M160, M161, M162, M163, M164, M165, M185.

**Доказательства:** `docs/ux/scenarios.md:1736`, `docs/evidence/backlog.md:700`, `apps/desktop/src/shared/appRoute.ts:36`.

### SCN-073 — PARTIAL

**Уже есть:** Diagnostics panel reads filtered log and build provenance; errors distinct from empty results.

**Остаток:** No export selection/preview/redacted export surface. Successful refresh does not clear prior problem; metadata failure swallowed. Diagnostic log is rotating evidence, not archived agent trajectory.

**Владелец:** M81, S05.

**Доказательства:** `apps/desktop/src/renderer/src/DiagnosticsSection.tsx:33`, `apps/desktop/src/renderer/src/DiagnosticsSection.tsx:47`, `apps/desktop/src/renderer/src/DiagnosticsSection.tsx:112`, `apps/desktop/src/main/index.ts:2906`.

### SCN-074 — FAIL

**Уже есть:** Project archived state exists in domain.

**Остаток:** No operator archive/restore/purge review UI or exact-object command path; generic confirmation is insufficient. Purge must be designed separately from journal-replayable archival.

**Владелец:** M77, S12, S09.

**Доказательства:** `apps/desktop/src/shared/types.ts:78`, `docs/evidence/backlog.md:418`, `apps/desktop/src/shared/appRoute.ts:36`.

### SCN-075 — PARTIAL

**Уже есть:** Simple interval/backlog routine editor, pause/resume and bounded chain primitives exist.

**Остаток:** No versioned typed DAG editor/event inputs/missing-empty-stale policies or run pinned config. Parent owns additional runtime chain admission defects.

**Владелец:** M66, M67, M68, M90, S04, S15.

**Доказательства:** `apps/desktop/src/renderer/src/ProjectHome.tsx:1457`, `apps/desktop/src/renderer/src/ProjectHome.tsx:1542`, `apps/desktop/src/main/chainAdvance.ts:72`, `docs/evidence/backlog.md:489`.

### SCN-076 — FAIL

**Уже есть:** Ordinary agent/session terminal exists.

**Остаток:** No service terminal generation/probe/healthy-unknown lifecycle for gateway and Claude Swap. Do not reuse agent admission as service readiness.

**Владелец:** M10.

**Доказательства:** `docs/evidence/backlog.md:25`, `docs/ux/scenarios.md:1808`, `apps/desktop/src/shared/appRoute.ts:36`.

### SCN-077 — FAIL

**Уже есть:** Citation/browser target is specified.

**Остаток:** No isolated browser production surface. Scenario lists only M74 but sandbox/browser owner is M75; fix trace before assigning agents.

**Владелец:** M74, M75.

**Доказательства:** `docs/ux/scenarios.md:1826`, `docs/evidence/backlog.md:404`, `docs/evidence/backlog.md:405`, `apps/desktop/src/shared/appRoute.ts:36`.

### SCN-078 — FAIL

**Уже есть:** File editor exists; media target prototype exists.

**Остаток:** No image/PDF production preview. Scenario points to M75 (browser), actual preview owner M76; assigning by scenario would implement wrong module.

**Владелец:** M74, M76.

**Доказательства:** `docs/ux/scenarios.md:1844`, `docs/evidence/backlog.md:405`, `docs/evidence/backlog.md:406`.

## Как использовать старые находки

- **S04/M103/M178 no task_runs table — drop-obsolete-rationale / merge residual.** Migration49 defines table and migration44 admission emits run.started. Existing full runtime/epoch/ack obligations remain AX-01.
- **M189 no runtime widget — closed narrow absence / partial scenario.** ProjectHome:1600 multiline caller exists; no false absence. Input/refresh/envelope flaws remain AX-02.
- **M191 no dry compiler path — closed backend / partial UI+history.** index:1209 dry compile exists; no preview renderer and no immutable history, AX-04.
- **M152 answer commit + continue fully shipped — partial.** CAS exists; delivery route misses real session and repeats fresh delivery IDs. AX-01/03.
- **M178 wait expires after resolution — partial helper only.** Derivation supports waitingOn.resolvedAt; runtimeObserver never selects/passes wait reference, AX-02.
- **M179 observer has no caller — closed.** index:1898 creates and 1931 samples; host observation worker remains future; separate failure semantics AX-08.
- **S12 import partial writes — closed narrow transaction / keep restore.** index:1966 import_declared_snapshot one transaction; archive + restore still absent, parent/AX-12.
- **S14 complete errors and cursors — partial/merge CO-111.** Read envelope helper works; several readers still drop errors, and cursor consumer absent.
- **M185/M186/M190 reader UI absent — keep.** DTO/helper work does not implement route; independent packets AX-06/07/08.
- **M182/M154 complete learning loop — partial.** Capture/category/reader done; recurring verification/feedback remains AX-11.
- **M176 proves manager behavior — drop overclaim / keep activation eval.** Synthetic corpus tests evaluator; no real trajectory importer or activated manager, AX-10.
- **S13 agents-view navigation collision — closed narrow / keep deeper continuity.** One AppRoute fixes boolean collision. Entity/history/draft return still missing, AX-05.
- **Second runner, signed release, feedback endpoint — defer external execution; prepare contracts now.** Keep S08/S07/M183.upstream gated by chosen resource/budget/credentials. No speculative provider dispatcher with zero consumers.
- **M75 media preview assignment — drop wrong mapping / retain feature.** M75 owns sandbox browser, M76 media, M74 citation semantics; AX-15/17.

## Пакеты для агентов

Каждый пакет ниже — подзадача существующих владельцев, не новый параллельный roadmap. Точный порядок определяется зависимостями. AX-01/02/03/04/08/10 — исправления целостности; остальные потребители можно проектировать параллельно, внедрять после их контрактов.

### AX-01 · P0 · One admitted task → actual session → immutable ended TaskRun

Владельцы: S04, M188, M103, M152.continue. Сценарии: SCN-050, SCN-052, SCN-067.

**Контекст:** Table exists but runtime does not complete its lifecycle. Admission returns task_run_id and pre-spawn session; handler ignores ID, pty generates another, projector never corrects it; no runtime run.ended producer. Current renderer still starts through legacy create+spawn. Upgrade trap: commit 242eeb8 edited already-existing migration44 to emit run.started while migration49 does not replace admit_task_launch; upgrading from 0a5e932 leaves original function unless migrations are replayed manually.

**Решение:** Create one launch service for recorded tasks and every trigger; allocate stable command/run/session identities before spawn or append explicit session binding under epoch. Persist dispatch state/outbox. Finalize every admitted run including spawn failure, exit and restart; guard old generations. Deliver acknowledgements under run+epoch+digest.

**Файлы:** `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/pty.ts`, `apps/desktop/src/main/routineTick.ts`, `apps/desktop/src/main/chainAdvance.ts`, `apps/desktop/src/preload/index.ts`, `apps/desktop/src/shared/types.ts`, `supabase/migrations/20260909000044_admit_task_launch.sql`, `supabase/migrations/20260909000049_task_runs.sql`, `apps/desktop/src/renderer/src/Tasks.tsx`, `apps/desktop/src/renderer/src/TaskPage.tsx`.

**Декомпозиция:**

1. Define command/run/session/epoch DTO and migration with immutable ended constraints.
2. Make creation separate from admission; migrate all operator/routine/chain callers; expose startExisting in actual task UI.
3. Bind allocated identity through PTY/bundle or atomically attach actual session and run before delivery; record running/ended transitions and recover abandoned admission.
4. Make transport write receipt originate at actual flush, ack receipt at authenticated agent acceptance; stable replay never inserts text twice.
5. Add integration harness using fake PTY + real temporary schema and exercise renderer→IPC→launch→ack→exit; retain scenario receipts.

**Prerequisites:** S02/S03 current command boundary; parent chain fix must share this service

**Положительная приёмка:**

- One UI start yields one task, one run, one actual session and ending receipt.
- Upgrade database from 0a5e932 with only new migrations then start a task: same run.started/run identity as clean bootstrap; ship append-only corrective function migration.
- Timeout retry with same command yields same run; retry after ended yields new ordinal.
- Answer reaches exact live run, successor waits for all required predecessors.

**Негативная приёмка:**

- Spawn throw ends failed_known run and releases lease; app restart reconciles outcome_unknown.
- Wrong session/old epoch/wrong digest refuses ack.
- No run for denied admission; no duplicate write after lost response; no run state rewrite after ended.

**Не входит:**

- Do not rebuild TaskRun table from scratch.
- Do not implement provider-specific external effects or charge real runners for tests.
- Do not count SQL unit probe as complete runtime proof.

### AX-02 · P1 · One observed liveness result for watcher and live widget

Владельцы: M178, M179, M181, M189, S14. Сценарии: SCN-052, SCN-056.

**Контекст:** Two consumers call correct derivation with different/incomplete inputs. Widget always orientedAt:null; both omit wait target; widget omits host gap. Secondary failures become zero blockers. Reproduced pure-function divergence: same fresh working beat becomes stalled with handler input.

**Решение:** Share an observation read service returning complete provenance and source envelope; read exact wait target resolution, orientation receipt and host observation generation; render this response rather than re-derive with invented nulls.

**Файлы:** `apps/desktop/src/main/runtimeObserver.ts`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/shared/liveness.ts`, `apps/desktop/src/renderer/src/ProjectHome.tsx`.

**Декомпозиция:**

1. Extract shared read+derive with wait/reference scope, orientation and gap inputs.
2. Make task/blocker errors explicit unknown in envelope, never zero.
3. Drive widget freshness by heartbeat/observation/feed + bounded time tick independent of terminal output; retain last snapshot and show age/error.
4. Render run, claim, observation, coverage and reason separately; add fake-clock/browser assertions.

**Prerequisites:** AX-01 for stable run binding; liveness corrections can start independently

**Положительная приёмка:**

- Fresh oriented worker remains working in watcher and UI.
- Unresolved question stays waiting; resolved target grace expires consistently.
- Data updates with no PTY output refresh widget.

**Негативная приёмка:**

- Read failure cannot claim no blockers or healthy coverage.
- Host sleep/restart cannot become agent fault.
- Unsupported reporter cannot be called broken solely for no orientation when no orientation capability exists.

**Не входит:**

- No new manager loop or always-on hosted monitor required.
- Do not test only deriveLiveness; test its two callers.

### AX-03 · P1 · Recoverable question detail, receipt and exactly-once continuation

Владельцы: M151, M152.commit, M152.continue, S13. Сценарии: SCN-050, SCN-051.

**Контекст:** Form receipt is keyed in memory but rendered only while Board open row remains. Refresh can remove answered question and receipt; submit promise rejection lacks local error. Repeat commit path calls continuation again with fresh delivery ID.

**Решение:** Add exact question/receipt destination independent of ranked open query; persist scoped draft+command; continuation outbox identity derives from committed decision+target run, reconciliation reads existing receipt.

**Файлы:** `apps/desktop/src/renderer/src/BoardPanel.tsx`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/shared/answerReceipt.ts`, `apps/desktop/src/shared/continuation.ts`, `apps/desktop/src/shared/appRoute.ts`.

**Декомпозиция:**

1. Create question detail read DTO and typed route, fixed revision snapshot and explicit conflict response.
2. Separate current top-N list refresh from selected detail and durable receipt.
3. Handle rejected IPC with draft retained and same command retry; reset command only for a genuinely new intent.
4. Persist/dedupe continuation and recheck target epoch/blockers at dispatch, refresh ack state.
5. Exercise response loss, already-answered open, concurrent answer and refresh while editing.

**Prerequisites:** AX-01 delivery/run identity; AX-05 route primitive

**Положительная приёмка:**

- Answer remains inspectable after leaving Needs you.
- Current exact options and draft revision cannot silently change under refresh.

**Негативная приёмка:**

- Post-commit response loss does not resend or mint second continuation.
- Thrown IPC shows local error and retains draft.
- A second blocker cannot be bypassed by commit-time eligibility snapshot.

**Не входит:**

- Keep existing CAS implementation and option IDs.
- Do not add mark-read to authored questions.

### AX-04 · P1 · Immutable past context and safe next-context preview

Владельцы: M191, M49, S14, S12. Сценарии: SCN-054, SCN-057, SCN-064.

**Контекст:** Preview backend is real but has no renderer consumer. Historic journal payload has hash/IDs only; actual context.md lives in disposable credential bundle. Mandatory source list is not passed by unattended launch and compile errors allow start.

**Решение:** Store immutable pack bytes/artifact outside credential bundle with compiler revision/budget/source versions/hash and scoped read API. Use same compiler for dry task-aware preview. Declare mandatory source policy by launch purpose and block unattended admission when unmet.

**Файлы:** `apps/desktop/src/main/contextPack.ts`, `apps/desktop/src/main/sessionBundle.ts`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx`, `supabase/migrations/20260901000013_context_packs.sql`, `apps/desktop/src/shared/storageContract.ts`.

**Декомпозиция:**

1. Design PackRef and durable artifact retention, hash verification and source access policy.
2. Persist before launch and return reference in session/run receipt; never delete artifact with token cleanup.
3. Expose next/past/lineage/retrieval routes and omitted-item reasons; legacy missing artifact renders incomplete.
4. Pass task instruction/brief and purpose to preview/compile so preview matches intended launch; preserve character units.
5. Test edit/rename/compiler upgrade, file loss, denied source, short budget and source failure.

**Prerequisites:** AX-01 launch purpose/run identity; AX-05 exact source routing; archive snapshot contract shared with S12

**Положительная приёмка:**

- Past pack bytes/hash remain identical after edits and session exit.
- Dry preview writes no lockfile/journal and spawns nothing.
- Preview names all omitted sources/items and budget version.

**Негативная приёмка:**

- Never reconstruct with closest current facts.
- Unattended start refuses mandatory memory/task-source failure; interactive degraded mode explicit.
- Missing archive cannot be called restored/generated exact pack.

**Не входит:**

- No tokenizer claim without versioned tokenizer.
- No second memory store or repository plaintext copy of private packs.

### AX-05 · P1 · Typed exact destinations and scope-safe async readers

Владельцы: S13, S01, M102, M187. Сценарии: SCN-050, SCN-053, SCN-054, SCN-055, SCN-057, SCN-058, SCN-059, SCN-060.

**Контекст:** AppRoute handles only home/draft/project/agents; evidence reveal scrolls section and does not focus exact entity. TaskPage load has no generation guard. PersistedTabs keeps only project IDs.

**Решение:** Extend canonical typed route+source resolver and per-object async state. Add durable draft identity+revision and return-state contract for selection/filter/scroll/focus, no duplicated task or evidence ownership.

**Файлы:** `apps/desktop/src/shared/appRoute.ts`, `apps/desktop/src/shared/entityRef.ts`, `apps/desktop/src/shared/tabs.ts`, `apps/desktop/src/renderer/src/evidence.ts`, `apps/desktop/src/renderer/src/App.tsx`, `apps/desktop/src/renderer/src/TaskPage.tsx`.

**Декомпозиция:**

1. Define canonical estate/project/entity/revision route and safe denied/missing outcomes.
2. Implement effect generations/abort and key loaded detail with requested identity; block mutations against mismatched response.
3. Open required disclosure, focus entity heading, preserve prior selection on background updates and Back.
4. Persist onboarding/task drafts with atomic write result and recoverable unsaved patch; reuse existing localState.
5. Keyboard/narrow/200% zoom checks on one representative detail then route conformance matrix.

**Prerequisites:** S14 localState/read envelope; exact new readers AX-03/04/06 can implement after route contract

**Положительная приёмка:**

- A→B→late-A response still displays B.
- Close/reopen restores draft fields without inventing committed object.
- Source→target→Back restores scope and focus.

**Негативная приёмка:**

- Denied reference never reveals foreign data.
- Missing target explains locally, not console-only.
- Late failed save cannot clear different object draft.

**Не входит:**

- Do not redesign visual theme or rewrite all screens.
- Do not revive corrected agents-screen boolean bug.

### AX-06 · P2 · Distinct graph/history/plan and decision readers

Владельцы: M190, M173, M188, M144. Сценарии: SCN-053, SCN-054, SCN-069.

**Контекст:** Legacy lists/progress are useful; requirements for four semantic views are retained in merged plan, not superseded by zero edges measured in one estate.

**Решение:** Read canonical event/edge queries into separate agent history, project history, target plan and decision destinations; exact plan revisions keep completed membership. Criteria acceptance is separate goal state.

**Файлы:** `apps/desktop/src/renderer/src/PlanSection.tsx`, `apps/desktop/src/renderer/src/DecisionsSection.tsx`, `apps/desktop/src/shared/plan.ts`, `apps/desktop/src/shared/decisions.ts`, `apps/desktop/src/main/index.ts`, `docs/ux/product-model.json`.

**Декомпозиция:**

1. Define each query identity, relation kinds, provenance and cap/cursor schema; no new graph truth store.
2. Add immutable plan revision/steps in M188 then target-plan read model shared by list and graph.
3. Render historical cycle diagnostics/boundary stubs and keyboard outline equivalent; DAG guard only for normative plan.
4. Add decision supplied-context/rationale/source links with no hidden-reasoning claim.
5. Add acceptance criterion versions and explicit goal acceptance separate from completed tasks.

**Prerequisites:** AX-01 base run producers; AX-04 exact pack; AX-05 source routes; criteria contract can be designed independently

**Положительная приёмка:**

- Same scope/revision yields same nodes in graph and outline.
- Done/cancelled membership retained as declared; partial counts labelled.
- Two predecessors in decision supersession both visible.

**Негативная приёмка:**

- No fabricated edges from coincident timestamps.
- Historical DID cycles not rejected by dependency DAG constraint.
- All tasks done does not auto-accept goal.

**Не входит:**

- Do not discard graph requirement because a seed estate has no edges.
- Do not interpret product.html fixture as production reader.

### AX-07 · P2 · Cursor-aware Inbox as reader, not task store

Владельцы: M185, S14, CO-111. Сценарии: SCN-055, SCN-058, SCN-072.

**Контекст:** Two-lane types built; no production route or per-person read persistence. CO-111 explicitly defers cursor consumer until this work.

**Решение:** Needs-you reuses Board identity; Happened sanitized source query with per-person visible watermark and cursor generation. Contract must work for authenticated persons before shared deployment.

**Файлы:** `apps/desktop/src/shared/inbox.ts`, `apps/desktop/src/shared/readEnvelope.ts`, `apps/desktop/src/shared/appRoute.ts`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/preload/index.ts`.

**Декомпозиция:**

1. Implement read command with requested/displayed cursors and minimumCursor evidence.
2. Persist mark-visible-read against principal/estate, monotonic within current restore generation.
3. Build lanes/detail/filter/back with coverage for missing producers.
4. Replay duplicate/out-of-order/feed-error/multi-user cases.

**Prerequisites:** AX-05 route; S09 real principal before shared use; S14/CO-111 cursor contract

**Положительная приёмка:**

- Mark read affects only visible Happened rows for current operator.

**Негативная приёмка:**

- Arrival/error cannot advance watermark.
- Needs-you remains until canonical obligation resolves.
- Restored generation rejects obsolete cursor.

**Не входит:**

- No second obligation database; no blanket all-event read.

### AX-08 · P1 · Cycle receipts carry actual pass outcome and visible coverage

Владельцы: S15, M186, M179. Сценарии: SCN-056, SCN-075.

**Контекст:** RoutineTick returns void and swallows read/spawn failures. Outer cycle defaults completed. Partial inner receipt and completed outer receipt have no join ID. Reader gap helper also equates gap with app closed though sink failure exists.

**Решение:** Return typed per-producer pass outcomes; one tick identity/config revision and explicit admitted/skipped/refused/partial/unknown aggregate. Observer independent of routine success; gap means unobserved unless host evidence says otherwise.

**Файлы:** `apps/desktop/src/main/routineTick.ts`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/shared/cyclePort.ts`, `apps/desktop/src/shared/cycleView.ts`, `apps/desktop/src/renderer/src/ProjectHome.tsx`.

**Декомпозиция:**

1. Define tick identity and aggregation table including source outage and coalesced overlap.
2. Return routine/chain results instead of catch-and-complete; cap planned starts vs actual admitted counts separately.
3. Separate observer sampling so failed/slow workload does not suppress health recording.
4. Expose all-cycles table/detail with planned unsupported sources and guarded wake.
5. Use fake clock for sleep, concurrent tick, cap fairness, unavailable DB and failed receipt sink.

**Prerequisites:** AX-01 admission; AX-02 observation service; CO-111 when adding cursors

**Положительная приёмка:**

- One partial pass remains partial in aggregate; zero due explicitly not-due/skipped.

**Негативная приёмка:**

- Failed routine read never reports completed empty pass.
- Receipt absence cannot prove app closed.
- Wake cannot bypass leases/admission or duplicate inflight work.

**Не входит:**

- No hosted always-on monitor required for local cycle reader.
- Do not treat task start as verified outcome.

### AX-09 · P2 · Safe manager/settlement activation path

Владельцы: M153, M158, M157, M166, M167, M169, M171, M194, M175, M168. Сценарии: SCN-051, SCN-061.

**Контекст:** Core/checker prerequisites do not provide manager. Queue order is dependency order, not automatic authority to select vendor, budget or activation owner.

**Решение:** Implement deterministic core and typed criticality first; all seats share checker/current basis/trust floor; replace binding with fenced generation and explicit drain. Provider absence is normal capability state.

**Файлы:** `docs/architecture/engineering-specs.json`, `apps/desktop/src/main/commands/proposalCommands.ts`, `apps/desktop/src/shared/managerEval.ts`, `apps/desktop/src/shared/authorityIngress.ts`, `apps/desktop/src/shared/capabilityReport.ts`.

**Декомпозиция:**

1. M153 hygiene preserves questions; M158 assessments snapshot components/hard floor.
2. M157 commits only current applicable basis and human override creates new decision.
3. M166 deterministic state/priority core, then M167 optional ModelPort.
4. M169 shared attempt budget+idempotent fallback and M171 measured usage.
5. M194 seat scope/replacement/fencing/eval activation owner; M175 built-in loop as one seat.

**Prerequisites:** AX-01/02/03 execution+delivery; AX-10 eval evidence; S09 principal for human override; M168 existing checker

**Положительная приёмка:**

- Same inputs produce same deterministic queue/core result.
- Absent ModelPort yields explicit unavailable state; replacement preserves history.

**Негативная приёмка:**

- Stale basis/trust revision, human-decision reversal, expired generation cannot auto-settle.
- Failover cannot reset budget; eval pass cannot grant activation.

**Не входит:**

- Do not infer first provider/budget owner; leave explicit operator decision packet.
- Do not build parallel manager authority boundary.

### AX-10 · P1 · Real trace-to-eval pipeline and evidence completeness

Владельцы: S05, M176, S08, M194. Сценарии: SCN-052, SCN-061, SCN-062.

**Контекст:** Evaluator consumes synthetic Trajectory with authority/touched scope/effect/usage fields. Current tool trace records transport outcome/IDs only; no runtime importer, durable fixture capture or profile activation consumer. Corpus validates checker, not actual agent behavior.

**Решение:** Add sanitized versioned trajectory adapter joining attempts to immutable command/result/authority references. Explicit required-field coverage per fixture/rubric makes absent semantic evidence inconclusive even when transport capture complete.

**Файлы:** `apps/desktop/src/main/toolTrace.ts`, `apps/desktop/src/shared/managerEval.ts`, `apps/desktop/src/shared/managerCorpus.ts`, `scripts/check-eval.mjs`, `apps/desktop/src/main/ops.ts`.

**Декомпозиция:**

1. Inventory fixture required evidence and define typed measured fields with unknown/unsupported.
2. Capture safe authority revision, touched scope and effect receipts by IDs, not raw private prompts.
3. Persist immutable redacted session/run trace artifact and convert to fixture; report incomplete/sink gaps.
4. Run offline synthetic+replayed real failures; hold-out blinded human labels only if judge introduced.
5. Then one approved fake/local conformance run and later S08 real runner pilot with explicit budget.

**Prerequisites:** AX-01 run identity, AX-04 pack reference, S05 existing transport tap; no need to wait for all manager UI

**Положительная приёмка:**

- Replayed real refusal/run includes observable state change, citations and scope evidence.
- Report pins profile/compiler/corpus/runtime versions and coverage.

**Негативная приёмка:**

- Complete transport trace lacking touched scope cannot pass scope-leak criterion.
- Hard violation cannot be offset by success average.
- No real provider run or paid pilot without chosen resource/budget.

**Не входит:**

- Retain current corpus; do not market synthetic pass as proven autonomous manager.
- No raw secret-bearing prompt/result archive.

### AX-11 · P2 · Retro review and privacy-separated feedback

Владельцы: M182, M154, M153, M184, M183.local, M183.upstream. Сценарии: SCN-062, SCN-063.

**Контекст:** Category/episode model and reader shipped. Review state/verification/recurrence and outbound privacy lifecycle remain missing; they are separate workloads.

**Решение:** Local episode→proposal→verified lesson state machine, same occurrence IDs. Separate local collection from outbound consent generation; off prevents future dispatch, in-flight unknown stays unknown.

**Файлы:** `apps/desktop/src/shared/memoryContract.ts`, `apps/desktop/src/shared/retroView.ts`, `apps/desktop/src/renderer/src/RetroSection.tsx`, `apps/desktop/src/main/index.ts`, `docs/architecture/engineering-specs.json`.

**Декомпозиция:**

1. Finish exact evidence resolver and review outcomes with append-only supersession.
2. M184 recurrent review task consumes only verified episodes for threshold; threshold is explicit policy.
3. M183.local minimized schema/allowlist, preview, consent revision, local queue and purge before dispatch.
4. M183.upstream endpoint dedupe/receipt/aggregation after independent endpoint/privacy approval.
5. Regression test one episode with multiple notes vs multiple verified episodes and disable while inflight.

**Prerequisites:** AX-03 reviewed decisions, AX-04 context references, AX-09 manager optional; local retro independent from upstream

**Положительная приёмка:**

- Verified lesson linked to exact source and test; repeat after fix yields regression review.
- Local retro works with sending off or endpoint absent.

**Негативная приёмка:**

- Repeated mentions do not inflate recurrence.
- Off cancels unsent; in-flight result never falsely cancelled/deleted upstream.
- Category does not expand scope.

**Не входит:**

- No second general knowledge store; do not auto-adopt feedback into product backlog.

### AX-12 · P1 · Storage, backup and authentication remain distinct gated capabilities

Владельцы: S12, S09, S07, M198. Сценарии: SCN-064, SCN-065, SCN-066, SCN-074.

**Контекст:** Declared two-family mirror is not backup. Service-role desktop has no person auth flow. Parent owns detailed data/auth packet.

**Решение:** Keep full restore, mirror import, identity/membership and archive/purge separate task families; integrate through authority generation and read-only restored mode.

**Файлы:** `apps/desktop/src/shared/storageContract.ts`, `apps/desktop/src/main/workspace.ts`, `apps/desktop/src/main/index.ts`, `supabase/migrations`, `docs/ux/scenarios.md`.

**Декомпозиция:**

1. Parent expands archive custody/manifest/projection rebuild matrix and fenced restoration.
2. Parent expands auth provider/current membership/invitation return/single-use receipt.
3. Add SCR-47/48 exact storage coverage and read-only restore display after backend contract.
4. M77 reversible project archive first; true purge separate tombstone and receipt design.

**Prerequisites:** S02 boundary, AX-05 routes, operator resource choices for backup and auth transport

**Положительная приёмка:**

- Mirror import remains atomic; restored environment read-only until explicitly activated.
- Authentication returns to exact still-valid invitation.

**Негативная приёмка:**

- Old writers cannot mutate restored authority generation.
- Auth retry cannot consume second seat; purge cannot resurrect on replay.
- Do not label mirror as full backup.

**Не входит:**

- Do not repeat parent-owned storage/auth analysis; merge by existing owners.

### AX-13 · P2 · Versioned pipeline and routine editing

Владельцы: M18, M66, M67, M68, M90. Сценарии: SCN-068, SCN-075.

**Контекст:** Only basic interval routine editor exists; target typed data graph and pipeline revision are not runtime capabilities.

**Решение:** Version both workflow definition and execution snapshot; typed edges name data, producer run, missing/empty/stale policy. Bound rounds from originating task and require proposal after bound.

**Файлы:** `apps/desktop/src/renderer/src/ProjectHome.tsx`, `apps/desktop/src/shared/routine.ts`, `apps/desktop/src/shared/chain.ts`, `apps/desktop/src/main/routineTick.ts`, `docs/ux/product-model.json`.

**Декомпозиция:**

1. Implement pipeline revision read/write contract and skills/stage validation.
2. Build event/schedule input editor with typed edges and DAG checks.
3. Pin execution to admitted revision, retain prior revisions, migrate old fixed routines explicitly.
4. Render paused/invalid/missing/empty/stale states and proposal at bound.

**Prerequisites:** AX-01 run/admission, AX-06 plan revisions, AX-08 cycle receipts

**Положительная приёмка:**

- Editing future config never changes started run; round count survives retry/restart.

**Негативная приёмка:**

- Missing/empty/stale are distinct; no implicit handoff payload.
- Historical graph cycle does not bypass normative edit DAG guard.

**Не входит:**

- Do not implement an agent loop in UI or invent manager for simple scheduler.

### AX-14 · P2 · Settings, usage and diagnostics finish their actual user paths

Владельцы: M72, M73, M83, M94, M81, M171. Сценарии: SCN-070, SCN-071, SCN-073.

**Контекст:** Existing controls and quota are useful; desired unified screens/export absent. Wrong scenario owner M152 must be corrected.

**Решение:** Assemble existing settings/usage/diagnostics without changing authority semantics. Separate inherited preference from permission; unavailable usage stays explicit; export is selected sanitized immutable snapshot.

**Файлы:** `apps/desktop/src/renderer/src/App.tsx`, `apps/desktop/src/renderer/src/DiagnosticsSection.tsx`, `apps/desktop/src/renderer/src/ProjectHome.tsx`, `apps/desktop/src/main/settings.ts`, `apps/desktop/src/main/ops.ts`, `docs/ux/scenarios.md`.

**Декомпозиция:**

1. M72 settings route groups existing local controls plus data locations; project override only for defined safe fields.
2. M83/M94 expose source/freshness/reset and limited action; M171 adds measured model usage later.
3. M81 local source status, filter, selection, redacted preview/export; errors cleared only after successful read.
4. Correct owner traces in scenarios/index, then verify stale/rejected settings save keeps draft.

**Prerequisites:** AX-05 route/read-state, parent redaction checks, S14 atomic local storage

**Положительная приёмка:**

- Existing theme/language/wake saves verified from disk; unavailable quota explains source.
- Export bytes match reviewed redacted selection.

**Негативная приёмка:**

- No secret/path/content disclosure in export; no cost zero for missing measurement.
- Preference cannot broaden permissions.

**Не входит:**

- Do not rebuild shipped keep-awake or quota gate.
- Subscription pricing remains decision, not default code.

### AX-15 · P2 · Service terminal, isolated browser and media readers

Владельцы: M10, M74, M75, M76. Сценарии: SCN-076, SCN-077, SCN-078.

**Контекст:** These production surfaces are absent; scenario assignment confuses browser M75 and preview M76.

**Решение:** Three independent deliverables on shared citation resolver: service generation/probe, sandboxed browser, exact image/PDF asset preview.

**Файлы:** `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/pty.ts`, `apps/desktop/src/shared/types.ts`, `apps/desktop/src/renderer/src/EditorWindow.tsx`, `docs/ux/scenarios.md`.

**Декомпозиция:**

1. Correct SCN-077 owner to M74+M75 and SCN-078 to M74+M76 before dispatch.
2. M10 service terminal shows generation and measured probe receipt; close-tab distinct from stop.
3. M75 isolated WebContentsView/session partition, no preload/node, strict URL scheme and popup/external control, visible address/history.
4. M76 exact approved file asset, image/PDF page rendering with independent source/loader errors; citation return and Cmd-click rule.

**Prerequisites:** AX-05 route/ref contract; file-root safety and existing desktop sandbox boundary

**Положительная приёмка:**

- Each chosen citation opens exact source and Back returns to origin.
- Probe generation change invalidates stale healthy result.

**Негативная приёмка:**

- Browser cannot access Fabric IPC or app cookies; popup/javascript/file scheme rejected.
- Missing asset distinct from unavailable loader; no arbitrary native file open on ordinary click.
- Closing service tab cannot silently stop service.

**Не входит:**

- No unsolicited service start or external navigation.
- No conflation of renderer sandbox with agent process permissions.

### AX-16 · P2 · Notification identity and transport contract

Владельцы: M159, M160, M161, M162, M163, M164, M165. Сценарии: SCN-072.

**Контекст:** SCN-072 is a target; main notification-connection settings/consent routes do not exist.

**Решение:** Bind channel to verified principal and explicit project route; minimal disclosure preview, generation-scoped consent, dedup and receipt. Read-only notifications never resolve canonical Board authority obligations.

**Файлы:** `docs/architecture/engineering-specs.json`, `docs/ux/scenarios.md`, `apps/desktop/src/shared/notify.ts`, `apps/desktop/src/shared/appRoute.ts`, `apps/desktop/src/main/index.ts`.

**Декомпозиция:**

1. Specify challenge/identity ownership, one token consumer and update id dedupe.
2. Implement credentials in main/keychain, consent version and route preview.
3. Implement send queue plus provider receipt/unknown recovery and mute/cancel semantics.
4. Integrate settings and Inbox source links; test cross-project route and stale consent.

**Prerequisites:** S09 verified person before shared use; AX-07 Inbox; actual transport credentials deferred to operator

**Положительная приёмка:**

- Bound route sends only selected allowed events and shows receipt.

**Негативная приёмка:**

- Read/mute never dismisses Needs-you.
- Retry unknown send cannot blindly duplicate message.
- Forged identity or stale consent cannot route private project data.

**Не входит:**

- Do not send real messages during implementation tests.
- Parent should route Telegram-specific wiring skill if Telegram implementation chosen.

### AX-17 · P1 · Repair scenario/owner and claimed delivery evidence drift

Владельцы: S10, CO-108, M189, M191, M152, M74, M75, M76. Сценарии: SCN-050, SCN-051, SCN-052, SCN-053, SCN-054, SCN-055, SCN-056, SCN-057, SCN-058, SCN-059, SCN-060, SCN-061, SCN-062, SCN-063, SCN-064, SCN-065, SCN-066, SCN-067, SCN-068, SCN-069, SCN-070, SCN-071, SCN-072, SCN-073, SCN-074, SCN-075, SCN-076, SCN-077, SCN-078.

**Контекст:** UX lint reports no SCN-068..078 index rows. Specific wrong ownership: settings→M152, browser→M74 only, media→M75. Queue report shipped parts coexist with stale missing-table deferrals and milestone M152 still says continuation not shipped.

**Решение:** Keep dated report immutable; append current evidence matrix separating helper/schema/backend/caller/UI/live outcome. Correct canonical owner mapping, retain named partial milestones rather than reopening everything.

**Файлы:** `docs/ux/scenarios.md`, `docs/ux/screens.md`, `docs/ux/flows.md`, `docs/evidence/backlog.md`, `docs/architecture/engineering-specs.json`, `docs/reports/2026-09-09-queue-progress-report.html`.

**Декомпозиция:**

1. Reconcile each scoped scenario to owner, current implementing file and target-only prototype; restore index.
2. Link run table closure vs runtime residual; remove obsolete missing-table rationale.
3. Record latest report findings disposition (closed/partial/merge/defer/drop) with source receipts.
4. Add mechanical gate for missing index/unknown task IDs and semantic owner review for reused IDs.
5. Publish current audit/packets/map through parent workflow; do not edit dated history to hide prior errors.

**Prerequisites:** This audit; no product dependency

**Положительная приёмка:**

- Every scenario 050..078 has verdict and actionable owner.
- Current queue milestone states point to observed deliverable level.

**Негативная приёмка:**

- No fixture/prototype/dto-only code counted as operational UI.
- No fresh duplicate milestone for issue existing owner can close.

**Не входит:**

- Never mark Product observed from static audit.
- Do not change old acceptance requirements just to make current code pass.

## Cross-batch

Parent must merge AX-01 with parent chain launch finding and AX-12 with parent auth/data; AX-05 duplicates likely navigation findings in SCN-001..049. No contradictory PASS claim; runs.status absence corrected before final report.

Использовано: ux-audit — сценарии/flows/screens и receipts; agent-harness — границы prompt/tool/runtime; agent-evals — отсутствие подмены поведения синтетическим evaluator PASS. Публикацию и signature выполняет parent.
