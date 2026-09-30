<sub>ssheleg skills — project-audit · ux-audit · agent-orchestrator · agent-harness · sheleg-design · brand-voice · copywriting</sub>

# Fabric — аудит плана и операционных сценариев, 2026-09-07

Срез: `153b4f029e626230d465d5d21d02fb8c9de5fadf`. Read-only. Проверены SCN-013…019 и SCN-039…049, план 2026-09-06, слой задач/памяти/планирования/агентов, последовательность горизонтов. Репозиторий не менялся. Браузер и эксплуатационные частоты в этой делегированной части не проверялись; механизм, наблюдаемость и проектные гипотезы разделены.

## Главный вывод

Основа продукта хорошо соответствует запросу: Project хранит цель, память, правила и историю, агент сменяем. Но заметная часть помеченного «shipped» пока даёт чтение таблиц без полноценного возвращения в работу. Источники не открываются, агрегат подменяет доступные права, история теряется из catch-up, а графические планы растут быстрее доказанных операционных циклов. Настоящее укрепление продукта сейчас — достоверная цепочка **сигнал → работа → проверяемый результат → принятое решение → следующий агент/следующее наблюдение**, а не ещё один экран агентов.

Это не повод переписывать ядро или строить собственную модельную платформу. Имеющиеся journal/projections, короткоживущая project scope, task lease, раздельные claim/observation, context lockfile и независимое принятие результата — правильные долгоживущие активы.

## Измерения

- 196 уникальных строк M в backlog (пересчитано разбором таблиц и независимо anchored-regex). 65 заявлены shipped/done, 7 partial, 105 proposed, 8 decided-unscheduled, 1 scheduled, 9 open, 1 in-review. **Это состав регистра, а не процент готовности**: строки пересекаются и поглощают друг друга.
- 17 записей SURFACE_TOOLS; 13 с records=true, 4 с false. Флаг whoami сам неточен: orientation пишется один раз, а не на каждый вызов. Это не полная трасса агента.
- Семь последовательных togglePin дали 7 закреплений. Ожидаемый SCN-043 предел 5 отсутствует не только в UI, но и в main writer.
- Реальные package boundaries: packages/schema и packages/journal. policy/runner/work/memory пока расположены внутри desktop main/shared. Само отсутствие отдельных пакетов не дефект: нужен чистый модульный шов, не обязательные пакеты/микросервисы.

## Сценарии

### SCN-013 — FAIL

Invitation, reviewed scope, membership accept/decline and revocation UI absent; M38/M39 deliberately deferred.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:331`, `docs/architecture/iterations.md:110`, `docs/evidence/backlog.md:703`.

### SCN-014 — FAIL

Role queue with typed resolution, SLA and delegated effect absent; CO-071/072/073 + M39 remain open.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:351`, `docs/evidence/specs/2026-08-16-software-fabric-carryover.md:82`, `docs/evidence/backlog.md:704`.

### SCN-015 — FAIL

Provider adaptation/recipe/conformance journey absent; runtime creation of an agent spec is a different implemented capability.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:374`, `docs/architecture/iterations.md:111`, `apps/desktop/src/shared/agentSpec.ts:8`.

### SCN-016 — FAIL

Independent exact-revision provider admission and separate canary binding not implemented; BYA is iteration 3.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:396`, `docs/architecture/iterations.md:111`.

### SCN-017 — FAIL

No bootstrap/conformance UI, therefore recovery/rollback flow cannot run; planned absence, not a regression.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:418`, `docs/architecture/iterations.md:111`.

### SCN-018 — FAIL

Sandboxed provider layout editor/role view publication absent; constrained grid is a decided future capability.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:440`, `docs/adr/0024-v1-workspaces-use-a-constrained-responsive-grid.md:1`, `docs/architecture/iterations.md:111`.

### SCN-019 — FAIL

End-to-end support intake, knowledge/checker, owner fallback and delivery receipt absent; S6 and channels CO-085 remain deliberate future work.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:463`, `docs/architecture/iterations.md:51`, `docs/evidence/specs/2026-08-16-software-fabric-carryover.md:96`.

### SCN-039 — PARTIAL

Counts/miss list exist and individual overview-query errors are represented; no author/last-read per store, no packs/retrieval drill-in. Promise.all with misses means one rejected misses request prevents publishing all new overview data; stale values have no read age. Superseded-all-facts count links to decisions-only view.

Класс: implemented gaps plus documented deferred readers. Доказательства: `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:45`, `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:83`, `apps/desktop/src/main/index.ts:2035`, `docs/evidence/backlog.md:628`.

### SCN-040 — PARTIAL

Digest exists, but cleanup acknowledges on feedMark changes and even read failure; line sources not clickable, no compiled-at/recompile control. Separate decisions view has source_ref plain text. Model-less composition is decided and valid.

Класс: regression and incomplete delivery. Доказательства: `apps/desktop/src/renderer/src/DigestSection.tsx:35`, `apps/desktop/src/main/index.ts:1925`, `apps/desktop/src/renderer/src/DecisionsSection.tsx:71`.

### SCN-041 — PARTIAL

Board, agent task tools, person movement, failure banner and assigned-by/to exist. Origin is only kind on card and a string on detail, source not navigable. Empty board hides the only file-idea form behind rows.length>0.

Класс: implemented board, incomplete provenance navigation. Доказательства: `apps/desktop/src/renderer/src/ProjectHome.tsx:497`, `apps/desktop/src/renderer/src/ProjectHome.tsx:527`, `apps/desktop/src/renderer/src/ProjectHome.tsx:565`, `apps/desktop/src/renderer/src/TaskPage.tsx:156`, `apps/desktop/src/main/agentSurface.ts:777`.

### SCN-042 — FAIL

No conversational manager creates reviewed editable specification/artifact. Existing attention panel is useful deterministic half; M119/M126/M194 and CEO loop remain planned.

Класс: known planned absence; decided-documented. Доказательства: `docs/ux/scenarios.md:1050`, `docs/evidence/backlog.md:574`, `docs/evidence/backlog.md:581`, `docs/architecture/operating-surfaces.md:289`.

### SCN-043 — PARTIAL

Partition/pin order works. Seven togglePin calls yield seven pins, contradicting five cap. Pin appears even for <=6 projects. No replacement prompt at limit; persistence rejection not caught.

Класс: observed function defect; decided-unpropagated. Доказательства: `apps/desktop/src/shared/favourites.ts:52`, `apps/desktop/src/main/favourites.ts:19`, `apps/desktop/src/renderer/src/EstateHome.tsx:93`, `docs/evidence/backlog.md:575`.

### SCN-044 — PARTIAL

Profile recomputes row counts; missing metrics omitted and failed counts null. Reasons lost, root call swallows error, UI can remain loading; source register names/links incomplete (M142 knowingly partial). Cancelled tasks counted with done as tasksClosed: acceptable label only if translated label continues to say closed.

Класс: implemented metrics, error/source gaps. Доказательства: `apps/desktop/src/main/index.ts:1971`, `apps/desktop/src/renderer/src/ProfileSection.tsx:38`, `apps/desktop/src/renderer/src/EstateHome.tsx:177`, `docs/evidence/backlog.md:628`.

### SCN-045 — PARTIAL

Task detail/note/promotion/receipts implemented. Sibling navigation reuses uncontrolled textareas, async loads unguarded; old text can be saved into new task. No agent draft rendering, notes oldest-first with no author identity/time; resource/related/promoted fact references not clickable; subread errors become empty/free.

Класс: latent cross-task write corruption; incomplete task trail. Доказательства: `apps/desktop/src/renderer/src/TaskPage.tsx:46`, `apps/desktop/src/renderer/src/TaskPage.tsx:183`, `apps/desktop/src/renderer/src/ProjectHome.tsx:249`, `apps/desktop/src/main/index.ts:1465`, `apps/desktop/src/renderer/src/TaskPage.tsx:209`.

### SCN-046 — PARTIAL

Goal creation/orphan attachment works. Graph intentionally replaced by list; do not relitigate as defect. List filters done/cancelled before grouping, so fulfilled goal reads like undecomposed goal, no done/total progress; task entries not navigable/no status or holder.

Класс: documented graph deferral plus actual goal-state gap. Доказательства: `apps/desktop/src/renderer/src/PlanSection.tsx:78`, `apps/desktop/src/renderer/src/PlanSection.tsx:91`, `apps/desktop/src/renderer/src/PlanSection.tsx:13`, `docs/evidence/backlog.md:630`.

### SCN-047 — PARTIAL

Harness shows global runner descriptors, one Fabric endpoint and estate grant totals; projectId unused. No project-created agent roster/skills/per-server grant state or tool argument/return detail. Grant read failure shown as zero. Actual resolveServers enforces requested subset at launch; per-tool counts deliberately absent and not itself a defect.

Класс: project-level contract claimed, global data delivered. Доказательства: `apps/desktop/src/main/index.ts:2002`, `apps/desktop/src/renderer/src/HarnessSection.tsx:75`, `apps/desktop/src/shared/agentSpec.ts:78`, `apps/desktop/src/shared/surfaceTools.ts:11`.

### SCN-048 — PARTIAL

Only facts/transcripts/tasks groups, not projects + separate decisions. Every hit opens project, not subject. 20-row query caps no hasMore/count, no loading/new-query stale label; all zero groups render. Failures of individual stores honest when API returns them.

Класс: decided-unpropagated; shipped claim overstated. Доказательства: `apps/desktop/src/shared/search.ts:17`, `apps/desktop/src/main/index.ts:1816`, `apps/desktop/src/renderer/src/SearchPanel.tsx:31`, `apps/desktop/src/renderer/src/SearchPanel.tsx:112`, `docs/evidence/backlog.md:627`.

### SCN-049 — PARTIAL

Estate screen lists sessions and output excerpt; interactive console purposely opens existing session window (valid recorded choice, scenario stale). History read once per selection; queries only payload.session_id/owner, so actor-only tool events omitted; no refresh of history, no task-header link, no priority sorting in component.

Класс: documented console deferral plus incomplete observed history. Доказательства: `apps/desktop/src/renderer/src/EstateAgents.tsx:7`, `apps/desktop/src/renderer/src/EstateAgents.tsx:39`, `apps/desktop/src/renderer/src/EstateAgents.tsx:102`, `apps/desktop/src/main/index.ts:2398`.

## Находки и приёмка

### PLAN-01 · P1 · Two questions block one task; answering first clears the task block while second remains open

latent; exact SQL mechanism traced, production occurrence not measured. Состояние решения: decided-unpropagated.

`supabase/migrations/20260906000028_questions.sql:98`, `supabase/migrations/20260906000028_questions.sql:124`.

Исправление: Recompute earliest remaining open blocker and blocked_since from question_blocks after answer/withdraw; validate project/estate scope of every link before append.

Приёмка: Probe inverse cardinalities: Q1+Q2 block T; answer each order and withdraw; T stays blocked until no open question. Rebuild matches; foreign/nonexistent task refused.

Куда: M148 correction before M149/M152.

### PLAN-02 · P1 · Digest advances read mark on refresh and on failed reads

latent data-loss-in-catchup path; no production incidence query. Состояние решения: decided-unpropagated.

`apps/desktop/src/renderer/src/DigestSection.tsx:45`, `apps/desktop/src/renderer/src/DigestSection.tsx:53`, `apps/desktop/src/main/index.ts:1925`.

Исправление: Separate subscription effect from leave/explicit-ack effect; advance only to successfully displayed digest high-water, never current unseen journal tail.

Приёмка: Rerender feedMark while request pending/failed; seen must not advance. Late event between rendering and leaving survives next visit; exact source click resolves.

Куда: M133 + M102.

### PLAN-03 · P1 · Sibling navigation can save old task brief into the new task

latent unintended overwrite; source path complete, live browser delegated to parent. Состояние решения: decided-unpropagated.

`apps/desktop/src/renderer/src/ProjectHome.tsx:249`, `apps/desktop/src/renderer/src/TaskPage.tsx:46`, `apps/desktop/src/renderer/src/TaskPage.tsx:183`.

Исправление: Key/reset TaskPage by taskId, cancel stale loads, control draft per task and section, retain server revision/conflict checks before save.

Приёмка: A→B with distinct briefs: B never displays/saves A text. A slow response arriving after B ignored. Dirty draft explicit save/recovery.

Куда: M143 correction.

### PLAN-04 · P2 · Five-favourite ceiling does not exist despite shipped claim

observed: node function probe this run produced 7 after 7 pins. Состояние решения: decided-unpropagated.

`apps/desktop/src/shared/favourites.ts:52`, `apps/desktop/src/main/favourites.ts:19`, `apps/desktop/src/renderer/src/EstateHome.tsx:93`, `docs/evidence/backlog.md:575`.

Исправление: Implement cap at write, return typed at-cap result and replacement prompt; hide favourites action for <=6 projects; surface persistence errors.

Приёмка: Seven synthetic projects: sixth pin asks release, stored count <=5; <=6 no pin step; failed write leaves partition unchanged.

Куда: M120.

### PLAN-05 · P2 · Search ships three groups and project navigation, while contract promises five groups and exact subjects

observed static contract disagreement; real lost-search frequency blind. Состояние решения: decided-unpropagated.

`apps/desktop/src/shared/search.ts:17`, `apps/desktop/src/main/index.ts:1816`, `apps/desktop/src/renderer/src/SearchPanel.tsx:112`, `docs/evidence/backlog.md:627`.

Исправление: Typed target {kind,id,projectId}; projects and decision group; shared openEvidence resolver; named searched stores, per-group count/hasMore and loading generation. Escape PostgREST substring syntax for arbitrary text.

Приёмка: Search unique project name, decision and task. Open lands exact subject; >20 results can be retrieved; one failure preserves successes; text containing comma/parentheses searchable without filter parse errors.

Куда: M141 + M74 + M142.

### PLAN-06 · P2 · Task evidence trail is stored but not fully readable/navigable

observed code omissions; user impact frequency blind. Состояние решения: decided-unpropagated.

`apps/desktop/src/renderer/src/TaskPage.tsx:156`, `apps/desktop/src/renderer/src/TaskPage.tsx:209`, `apps/desktop/src/renderer/src/TaskPage.tsx:267`, `apps/desktop/src/main/index.ts:1465`, `supabase/migrations/20260905000016_operating_surfaces.sql:283`.

Исправление: Per-section author and draft history, newest notes with identity/time, clickable origin/relations/promoted facts; typed per-store read state instead of empty arrays/free lease on error.

Приёмка: Every SCN045 step completed cold; error in notes/lease/links does not turn into no notes/free/no links; all three original agent brief fields remain readable after human edit.

Куда: M143 + M124 + M74.

### PLAN-07 · P2 · Harness screen describes global runner availability as project harness and hides grant errors as zero

observed ignored parameter and null fallback; production incidence blind. Состояние решения: decided-unpropagated.

`apps/desktop/src/main/index.ts:2002`, `apps/desktop/src/renderer/src/HarnessSection.tsx:75`, `apps/desktop/src/shared/agentSpec.ts:78`.

Исправление: Build project harness DTO from created agents, requested effective server scope, grant outcomes, tool schemas; distinguish runner/agent/binding. Preserve documented absence of usage counts until trace exists.

Приёмка: Two projects with different granted servers/specs render different harnesses; failed grant query unavailable with reason; missing required server prevents launch and identifies dependency.

Куда: M145 correction + M61 + M127.

### PLAN-08 · P2 · Goal with completed work appears undecomposed

observed filter/renderer mechanism; production frequency blind. Состояние решения: decided-unpropagated.

`apps/desktop/src/renderer/src/PlanSection.tsx:78`, `apps/desktop/src/renderer/src/PlanSection.tsx:93`.

Исправление: Group full task population and calculate done/total separately from displayed open list; keep graph a deferred view, make list nodes navigable and state/holder visible.

Приёмка: Goal with three done tasks reads 3/3, empty goal undecomposed, mixed goal accurate; every task occurs once in structural result.

Куда: M144 + M173.

### PLAN-09 · P2 · Memory/agent views can retain outdated or wrong-subject readings while errors are displayed elsewhere

latent async/source coverage defect. Состояние решения: decided-unpropagated.

`apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:45`, `apps/desktop/src/renderer/src/EstateAgents.tsx:39`, `apps/desktop/src/renderer/src/EstateAgents.tsx:72`, `apps/desktop/src/main/index.ts:2398`.

Исправление: Independent per-store result envelopes with readAt/source generation; clear selected subject while loading; observe journal on actor.id OR payload correlation; include pagination.

Приёмка: A→B switch with one failed read never shows A history/branch as B. Agent memory remember/task note appears in history; >200 event history is explicitly partial/navigable.

Куда: M70/M71 + M135 + M191 + M102.

### PLAN-10 · P1 · Execution briefs contain non-existent event/field names and missing producer changes

observed plan-to-schema drift before implementation. Состояние решения: decided-unpropagated.

`docs/evidence/plans/2026-09-06-execution-briefs.md:370`, `docs/evidence/plans/2026-09-06-execution-briefs.md:388`, `docs/evidence/plans/2026-09-06-execution-briefs.md:410`, `apps/desktop/src/main/agentSurface.ts:447`, `apps/desktop/src/main/agentSurface.ts:762`, `supabase/migrations/20260906000028_questions.sql:27`, `supabase/migrations/20260906000028_questions.sql:189`.

Исправление: M152 must use memory.project.recorded@1; explicitly add indexed fact.about + producer contract. Define and register question.settled@1/projector or reuse answered consistently. M179 observes session.oriented@1, not context.read. Add process kind before M184 emits it.

Приёмка: Mechanical contract table resolves every planned event/enum/column to existing or explicit migration; fixture emits every new event and rebuilds correctly.

Куда: M149/M152/M157/M179/M182/M184.

### PLAN-11 · P1 · Fact-first dual append is not an exactly-once domain command

latent concurrency/crash defect in promotion; repeated in M152 plan. Состояние решения: decided-unpropagated.

`apps/desktop/src/main/index.ts:1561`, `supabase/migrations/20260905000016_operating_surfaces.sql:274`, `docs/evidence/plans/2026-09-06-execution-briefs.md:369`, `supabase/migrations/20260906000028_questions.sql:120`.

Исправление: Atomic idempotent command with request identity: create/reuse fact and transition question/note together, or durable prepared-command/reconcile with canonical fact ID. First append ordering alone is insufficient.

Приёмка: Concurrent promote/answer creates one effective decision/fact; crash after first append then retry does not put duplicate/conflicting current facts into pack; duplicate answer returns existing outcome.

Куда: M143 promotion + M152.

### PLAN-12 · P1 · Trajectory eval is planned over a trace that does not exist

observed contradictory docs; future eval blind unless call capture added. Состояние решения: decided-unpropagated.

`docs/evidence/backlog.md:662`, `docs/architecture/agent-system-map.md:103`, `apps/desktop/src/shared/surfaceTools.ts:11`, `apps/desktop/src/shared/surfaceTools.ts:30`.

Исправление: Add scoped invocation trace contract (tool/version,input digest,response class/refusal,latency,cost,session/run/request IDs) as separate diagnostic/evidence stream; include read calls and refusals. Then build independent trajectory eval.

Приёмка: Success/read/refusal/throw/retry produce complete correlated trace; no secret/raw irrelevant payload; eval detects planted skipped-question/missing-basis/cross-project/false-completion trajectories.

Куда: M81 + M155 + prerequisite M176.

### PLAN-13 · P2 · Dependency arrows mix hard dependencies with sequencing preference, and omit actual prerequisites

observed planning incompleteness, not a runtime failure. Состояние решения: decided-unpropagated.

`docs/evidence/plans/2026-09-06-execution-briefs.md:23`, `docs/evidence/plans/2026-09-06-execution-briefs.md:384`, `docs/evidence/plans/2026-09-06-execution-briefs.md:515`, `docs/adr/0043-the-manager-seat-is-a-binding.md:19`.

Исправление: Store dependency reason/artifact and type hard|review-order|policy-order|optional. Decouple M153 hygiene from M183 feedback export. M194 needs core/checker/floor/protocol/trace/eval + heartbeat/watch, not M152 alone. M157 floor enforcement/criticality must co-ship before activation, not follow via M158.

Приёмка: Executable acyclic DAG with every edge naming consumed artifact; no task claiming ready with missing input. Independent M191 not accidentally serialized after graph.

Куда: M98/M109/M153/M183/M157/M158/M194 + execution briefs.

### PLAN-14 · P2 · Backlog and canonical iteration story retain contradictory current/delivered states

observed docs drift across overlapping IDs. Состояние решения: decided-unpropagated.

`docs/evidence/backlog.md:15`, `docs/evidence/backlog.md:38`, `docs/evidence/backlog.md:577`, `docs/evidence/backlog.md:632`, `docs/architecture/iterations.md:64`, `docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md:18`.

Исправление: One normalized milestone register with absorbed_by/superseded_by, evidence SHA and acceptance state; render backlog/slices/status map from it. Explicitly reconcile stale S2 transcripts/context-pack remains and S3 open; older module work Run definition vs ADR0042.

Приёмка: All 196 rows resolve unique IDs and parent absorption, current leaf claims checked; no original M53/M54/M79 appears new after M122 absorbed it; no semantic copy of old Run definition remains marked current.

Куда: M114/M96/documentation normalization.

## Что не следует выдавать за новый дефект

- SCN-013…019 и SCN-042 отсутствуют осознанно; команда, provider foundry, role UI, support loop и conversational manager ещё не заявлены исполненными. Их FAIL означает отсутствие сценария сейчас, не нарушение уже поставленной функции.
- Отсутствие интерактивного console в estate agents — явное решение в EstateAgents.tsx:7. Сценарий надо согласовать, а затем решать, нужна ли встроенная консоль. История и безопасный переход по точному task/session полезны независимо от решения.
- Decision graph заменён списком, per-tool counts убраны из-за отсутствия call log, часть figure drill-in отложена за отсутствием целевого register view. Это задокументированные ограничения, а не найденные внезапно ошибки.
- `fabric_effect_request` защищает только путь, которым агент добровольно воспользовался; M140 и iterations.md:79 это честно признают. Нельзя продавать текущий runner как полностью перехваченный execution plane.
- M97/M195/M196/M197 уже поставлены текущим HEAD. M198 config_revision replay idempotency обнаружен и открыт на backlog:682; повторно новый ID не нужен. M177 whoami repeat call уже доступен: работа — наблюдаемость и восстановление protocol после compaction, не создание нового разрешения вызвать инструмент ещё раз.

## Проверенный порядок работ — предложение обновления плана

Стрелка ниже означает потребляемый результат. Число порядка — политика поставки, не объявление фальшивой технической зависимости.

| Волна | Содержание и существующие IDs | Зависимости | Проверка выхода |
|---|---|---|---|
| 0. Достоверный срез | Сверить и нормализовать register/absorbed-by; сохранить базовые smoke/gates; закрытые M97/M195/M196/M197 вывести из next. Brand hierarchy как отдельное изменение ADR0018 | текущий HEAD | Один runnable backlog; заявленный shipped имеет сценарий/проверку и SHA; отсутствие явно помечено |
| 1. Сохранность данных/решений | PLAN-01,02,03,11; M198; вопросные scope/FK/идемпотентность; supersession/human-floor regression fixtures | journal/schema | Два вопроса/одна задача, конкурентные ответы/promote, crash-retry, sibling navigation, неувиденная decision не теряются |
| 2. Понятный модульный каркас | M98 (main/ProjectHome/agentSurface), затем M109 return contracts; M102/M105; не смешивать refactor и исправления | baseline tests; review-order after safe baseline | Бутстрап только собирает контекст; handlers по доменам, типы возвращаемого DTO проверяются; изменения relevant event не будят посторонние запросы |
| 3. Польза уже записанного | PLAN-04…09: exact evidence resolver M74/M142, M141 search, M143 task, M144 plan, M145 harness, M191 pack/lineage preview | нужные stores уже есть | Холодное возвращение в проект/задачу открывает доказательство, ошибку/давность видно, весь путь клавиатурой; cap/pagination честны |
| 4. Полный операторский Board | Поправить contract PLAN-10; M149 + M151 + M152, одна атомарная answer command; scope+decision subject contract | wave1/schema; existing M148/M150/M156/M195 | Реальный агент спрашивает, оператор отвечает, обе задачи продолжаются, следующий pack несёт ровно принятую decision |
| 5. Надёжный harness и след агента | M177…181/M155 + scoped invocation trace (M81); M188 runs/steps; M186 cycle failures отдельно от здоровья процесса | task/session correlation; current tool definitions | Тихий думающий/blocked/stalled/gone различимы; ошибка tick не теряется; traces включают отказ и чтение; два runs не смешивают steps |
| 6. Один настоящий проверенный loop | M129/S4 + CO060/061/086: HTTP/production signal → sourced task → agent change → независимая проверка → receipt/reobserve. Подключить минимальный доступный read source; fixture end-to-end до внешнего сервиса | wave4+5, эффектные runner gates где нужны | Один реальный дефект найден без ручного осмотра, исправление проверено независимо, следующий scheduled probe подтвердил состояние; ручное время измерено |
| 7. Снижение нагрузки на оператора | M153 hygiene отдельно от feedback export; M157+M158+M168 deterministic settlement/floor вместе; M154/M182/M184 retro | atomic question answer, typed subject/decision basis | Одинаковый subject ещё не означает одинаковый ответ: conflict/staleness/option mismatch не settled; human reversal невозможен; override и replay/counterfactual проверены |
| 8. Замена агента и первый коллега | CO074 + M17/M34: второй полноценный runner passport; затем узкий M38/M39/CO071…073 pilot с reviewer-only ролью | loop доказан; auth/revoke/read scope tests | Один проект выполняет ту же работу после смены runner; коллега видит/решает только разрешённое и после revoke теряет доступ, история/память/routine не переезжают |
| 9. Manager loop при готовом контракте | M176 eval до tuning; M166…171/M175/M194; ModelPort|null и внешний seat за одним manager tool surface | trace+checker+core+floor+watch+budget; существования M152 одного недостаточно | Собственный/fake external manager одинаково отказываются от basis-less действия, меняются без потери роли; провайдерный outage оставляет deterministic core рабочим |
| 10. Удалённое участие и масштабирование UI | Telegram M159…165 после answer command; M189/190 preview graphs по реальному спросу; M187 density, M50…93 recomposition, M183 privacy/export с явным scope | hard edges из DTO/effect/authority; UX pass перед конкретным экраном | Ответ из Telegram идемпотентен и имеет тот же policy receipt; graph reader не выдумывает edge; интерфейс сокращает переходы на реальной рабочей нагрузке |
| 11. Экосистема | M37 BYA, provider conformance/rollback, M40/41 federation, M36 marketplace | не-owner pilot и второй runner прошли; CO080 | Третья сторона допускается по точной revision и минимальному scope; только затем view extensions/hosting/marketplace |

Волны 3 и 5 можно делать отдельными ограниченными потоками после сохранности данных; M191 не нуждается в M152. M153 hygiene не должен ждать M183 выгрузки product feedback. M98→M109 — разумный порядок review; M97→M98 — политика foundations-first, не реальный импортный edge. Trace/eval/checker/floor перед selectable manager — настоящий hard gate.

## Архитектурные решения, которые стоит пересмотреть явно

1. **`about` equality — это адрес вопроса, не доказательство ответа.** ADR0036:32 и board-and-ceo.md:672 предписывают ключевое равенство. Оно механически верно только при контракте значения: namespace, тип ответа, субъект/контекст, revision/validity и проверка отсутствия конфликта. В нынешнем plan about свободная строка и fact.about вообще отсутствует. «Нужно ли сменить db.version?» и «какая db.version сейчас?» нельзя автоматически объединять только по ключу. Это предложение усилить принятое решение, а не молча заменить его модельным судьёй. Приёмка: противоположные вопросы об одном subject, поменявшийся scope, устаревший источник, несовместимые options остаются разными/неразрешёнными.
2. **Один action command должен менять все обязательные доменные факты атомарно.** Упорядоченные appends уменьшают один crash case, но создают двойные authoritative facts при гонке/повторе. Общий command/idempotency слой полезнее локальных if-проверок в каждом handler.
3. **След инструмента и бизнес-журнал — разные данные.** Journal фиксирует признанные события проекта; invocation trace фиксирует попытку, отказ, timing, параметры модели и envelope result. Eval читает оба. «Любой journal event — независимая истина» тоже неверно: agent claim в journal остаётся claim.
4. **Human approval и independent verification — разные ворота.** Не надо навсегда заставлять человека manually close каждую задачу: должен быть checker-approved outcome плюс область standing authority. Более сильные агенты увеличивают долю independently verified результатов, уменьшая очередь человеку. Пока code-level checks/CO060/061 не готовы, human close остаётся честным interim.
5. **Single-operator сейчас, team-ready seams сейчас же.** «Ждёт второго человека» у M38 — эксплуатационный gate, не запрет проектировать actor-qualified preferences, revoke и permission tests. Нужен минимальный reviewer pilot раньше marketplace/provider canvas, чтобы доказать командную ценность продукта.

## Как Fabric станет полезнее при усилении моделей

Стабильное преимущество: не самый длинный prompt и не своё agent loop API, а **совместно используемый договор проекта и его независимый след**. Контур хранит intent/решения/команду, даёт агенту ограниченный capability scope и воспроизводимый pack, получает результат с доказательствами, проверяет другим источником, фиксирует решение и наблюдает изменение снова. Любой новый runner проходит passport и сразу использует накопленный контекст/authority/evidence. Чем лучше агент, тем больше полезных результатов проходит тот же gate и тем меньше исключений остаётся людям.

Предлагаемые outcome-метрики (пока не измерены, не выдавать за существующий telemetry): медиана возвращения к проекту до первого обоснованного действия; доля закрытых loops с независимой проверкой; время ожидания human action; доля false done и overturned settlement; повторные ошибки после accepted retro; время смены runner с сохранением routine/evidence; задач на час operator attention. Это лучше tests-count/LOC/числа active sessions для проверки defensibility.

## Brand boundary для основной команды аудита

Прямой запрос пользователя (paraphrased; redacted for publication on 2026-09-30, ADR-0096): **PassionCode should be the parent brand and Fabric the product — the IDE, workspace and command centre**. Он конфликтует с ADR0018:15–22, где PassionCode.ai — продукт, Fabric — техническое ядро и «not the product brand», и отражён в docs/ux/vision.md:1. В аудите фиксируем необходимость нового superseding ADR и propagation checklist (name hierarchy, product descriptor, site/app/store/README/package/window title). Не переписывать старый append-only ADR. Essence durable Projects и anti-vision этому брендингу не противоречат; наоборот, слово command center нужно конкретизировать через управление проектами и решениями, чтобы не скатиться в отвергнутый multi-chat cockpit. Написание из запроса сохранялось до канонизации; for publication the request is recorded as a neutral paraphrase.

## Полный реестр модулей/работ

`/tmp/fabric-backlog-inventory.json` и поле `milestone_inventory` JSON sidecar содержат **каждую из 196 строк**: ID, название, status claim и точную строку источника. Сводные группы:

| Группа | Реальность сейчас | Плановые IDs/границы |
|---|---|---|
| Foundation/store | journal+schema реализованы, legacy projector разобран; config_revision replay всё ещё M198 | M1/M3/M97/M109/M198 |
| Desktop/workspace | terminal, projects, repositories, editor, declared git mirror, quota, startup/package реализованы | M16/M42/M56/M63/M73/M95/M99…113/M118; M98/M102/M105 остаются |
| Memory/evidence | facts/transcripts/retrieval log/bitemporal/context packs реализованы; reader gaps перечислены выше | M44…49/M74…76/M133/M135/M141…145/M191 |
| Tasks/routines/chains | board/tools/lease/origin/siblings/agent specs/gateway/routines/chain bound/payload реализованы | M13/M17/M65/M68/M94/M121…125/M127/M132/M134/M146; исходные M53/M54/M79 поглощены M122 |
| Operator Board | table, rank, trust settings есть; ask/answer/settlement отсутствуют | M148/M150/M156 shipped; M149/M151…155/M157/158 planned |
| Agent health/visibility | process/output-based состояние; heartbeat/run steps/outside watch/graphs в проекте | M177…181/M185…191 |
| CEO | deterministic attention reader есть; полноценного loop нет | M119/M126/M166…176/M194 |
| Product feedback/retro | базовые memory kinds есть, category/upstream privacy/recurrence cycle ещё нет | M154/M182…184 |
| Real operating loops | execution infrastructure есть, наблюдение→проверенный результат ещё не доказан | S4…6/M4/M9/M19…31/M128/129; CO060/061/085/086 |
| Team/identity | tenant schema primitives, UI/auth membership отсутствуют | M38/M39 + CO071/072/073 |
| Providers/federation | contract architecture и агентные seams, не provider-foundry experience | M15/M32…37/M40/M41 + CO074/080 |
| Visual/language | brand pack/components/icon/RU-EN ratchet поставлены; scenario coverage и workflow density не завершены | M82/M116/M117/M197; M62/M64/M78/M87…93/M187 |

Использовано в этой части: project-audit — различие наблюдения/латентного риска/задокументированного решения; ux-audit — сценарий→код→вызывающее место→вердикт. Инструментальные проверки ограничены pure pin probe, tool manifest count и двумя независимыми подсчётами backlog, чтобы не дублировать основной тестовый прогон.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`project-audit`](https://github.com/ssheleg/task-pipeline) — проверка проекта и доказательств
- [`ux-audit`](https://github.com/ssheleg/super-ux) — сценарии и дефекты интерфейса
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — архитектура исполнения и полномочий
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — переносимый агентный контур
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — визуальная система
- [`brand-voice`](https://github.com/ssheleg/super-ux) — иерархия бренда
- [`copywriting`](https://github.com/ssheleg/super-ux) — формулировки позиционирования

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
