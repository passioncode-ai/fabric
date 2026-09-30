# Inventory for progressive adoption

Baseline `bac1f67f295b1b05a5caf914f59aa63ced94d439`. 85/85 views assigned once to 20 families. Read-only audit; no browser or production acceptance. Proposed session numbers are contextual stages, never hard day locks. Canonical scenario IDs below come from explicit Scenarios fields, not model unions.

## Вход и первый проект

Понять обещание и сохранить свою первую работу. **When:** S0: сразу; помощь по запросу. **Scope:** R0 узкий запуск; публичный вход external.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `landing` | external | S11, S07 | docs/ux/screens.md:553 → SCN-038 |
| `onboarding` | near | S09, S01, S13, S14, M17 | docs/ux/screens.md:516 → SCN-031,SCN-033,SCN-059; docs/ux/screens.md:113 → SCN-001,SCN-002 |
| `launch-start` | near | S14, M185 | docs/ux/screens.md:516 → SCN-031,SCN-033,SCN-059 |
| `launch-guide` | near | S14, M185 | docs/ux/screens.md:605 → SCN-040,SCN-041,SCN-060 |
| `launch-help` | near | S14, M185 | docs/ux/screens.md:887 → SCN-061 |

## Обзор и возврат

Понять сейчас/дальше и вернуться в нужный проект. **When:** S0 после сохранения; S1 после реального ухода. **Scope:** R0.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `estate` | near | S13, S14, M151, M185, M186, M187 | docs/ux/screens.md:575 → SCN-043,SCN-044,SCN-059,SCN-060,SCN-092,SCN-093; docs/ux/screens.md:96 → SCN-001,SCN-006,SCN-007 |
| `project` | near | S01, S04, S13, S14, M151, M189, M190, M173, M191 | docs/ux/screens.md:605 → SCN-040,SCN-041,SCN-060; docs/ux/screens.md:127 → SCN-001,SCN-007,SCN-011 |
| `launch-home` | near | S13, S14, M151, M185, M186, M187 | docs/ux/screens.md:575 → SCN-043,SCN-044,SCN-059,SCN-060,SCN-092,SCN-093; docs/ux/screens.md:96 → SCN-001,SCN-006,SCN-007 |
| `launch-project` | near | S01, S04, S13, S14, M151, M189, M190, M173, M191 | docs/ux/screens.md:605 → SCN-040,SCN-041,SCN-060; docs/ux/screens.md:127 → SCN-001,SCN-007,SCN-011 |
| `inbox` | near | M185, M151, S14, M187 | docs/ux/screens.md:847 → SCN-044,SCN-055,SCN-058 |
| `search` | near | S13, S14, M187 | docs/ux/screens.md:741 → SCN-048 |

## Облик Fabric и прогресс

Узнавать своего помощника и видеть подтверждённый накопленный результат. **When:** После первого value; аватар по желанию, без блокировки. **Scope:** R0 простой облик; AI генерация позже.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `profile` | near | S13, S14, M194 | docs/ux/screens.md:722 → SCN-044 |
| `launch-persona` | near | S13, S14, M194 | docs/ux/screens.md:722 → SCN-044 |

## Доска и решения

Дать одно необходимое решение и проверить исход. **When:** S0 при реальном вопросе; S1 ежедневный разбор. **Scope:** R0.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `board` | near | S06, M149, M151, M152, M157, M158, M168, S14 | docs/ux/screens.md:825 → SCN-050,SCN-051,SCN-053,SCN-055,SCN-058 |
| `launch-board` | near | S06, M149, M151, M152, M157, M158, M168, S14 | docs/ux/screens.md:825 → SCN-050,SCN-051,SCN-053,SCN-055,SCN-058 |
| `question` | near | S06, M149, M151, M152, M157, M158, M168, S14 | docs/ux/screens.md:825 → SCN-050,SCN-051,SCN-053,SCN-055,SCN-058 |
| `authority` | near | S03, S06, M151, M152, S13 | docs/ux/screens.md:464 → SCN-027 |
| `decisions` | near | M173, M152, S14, S10, M187 | docs/ux/screens.md:662 → SCN-040,SCN-051,SCN-054,SCN-058 |

## Задача и исполнение

Записать результат, адресовать работу, наблюдать run и проверить результат. **When:** S0 первая Task; исполнение после readiness; история при первом повторе. **Scope:** R0.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `task-new` | near | S01, S04, S06, S13, S14, M189, M152, M191 | docs/ux/screens.md:639 → SCN-045,SCN-060,SCN-067 |
| `launch` | near | S01, S04, S06, S13, S14, M189, M152, M191 | docs/ux/screens.md:639 → SCN-045,SCN-060,SCN-067 |
| `task` | near | S01, S04, S06, S13, S14, M189, M152, M191 | docs/ux/screens.md:639 → SCN-045,SCN-060,SCN-067 |
| `run` | near | S04, M188, M189, M103, S03, S14 | docs/ux/screens.md:226 → SCN-007,SCN-008 |
| `task-archive` | near | M77, M124 | docs/ux/screens.md:605 → SCN-040,SCN-041,SCN-060 |
| `launch-agent` | near | S13, S14, M105, M189, M190, M194 | docs/ux/screens.md:776 → SCN-049,SCN-052,SCN-053,SCN-091 |
| `agent-detail` | near | S13, S14, M105, M189, M190, M194 | docs/ux/screens.md:776 → SCN-049,SCN-052,SCN-053,SCN-091 |
| `estate-agents` | near | S13, S14, M105, M189, M190, M194 | docs/ux/screens.md:776 → SCN-049,SCN-052,SCN-053,SCN-091 |

## Команда, исполнитель и manager

Настроить действующего исполнителя с ясными полномочиями. **When:** До первого запуска; custom provider только по потребности. **Scope:** R0 preset/readiness; полный каталог/production pipeline позже.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `agents` | near | M17, M194, M32, S04, S02 | docs/ux/screens.md:148 → SCN-001,SCN-003,SCN-004 |
| `providers` | later | M32, M34, M37 | docs/ux/screens.md:163 → SCN-003,SCN-004 |
| `manager` | near | M194, M175, M166, M167, M176, S15 | docs/ux/screens.md:887 → SCN-061 |
| `admission` | later | M34, M37, M32 | docs/ux/screens.md:333 → SCN-015,SCN-016,SCN-017 |
| `bootstrap` | later | M37, M32, M34 | docs/ux/screens.md:318 → SCN-015,SCN-016,SCN-017 |

## Harness и настройки проекта

Видеть что доступно агенту и менять настройки осознанно. **When:** Перед первым действием с доступом; затем по отказу/изменению цели. **Scope:** R0 нужные пределы; полный каталог по потребности.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `project-settings` | near | S13, S02, M198, S12, M194 | docs/ux/screens.md:272 → SCN-001,SCN-002,SCN-003,SCN-012 |
| `harness` | near | S02, S05, M177, S14, S13 | docs/ux/screens.md:702 → SCN-047 |
| `harness-tool` | near | S05, S13, S14, M177 | docs/ux/screens.md:761 → SCN-047 |

## Аккаунты провайдера

Работать с нужной identity и сохранить разговор при возможной смене. **When:** Только при нужде во втором аккаунте/квоте, не обязательный старт. **Scope:** Near catalogue, M199 proposed; не обязательный onboarding gate.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `provider-accounts` | near | M199 | docs/ux/screens.md:1310 → SCN-081,SCN-082,SCN-086 |
| `account-switch` | near | M199 | docs/ux/screens.md:1332 → SCN-083,SCN-084,SCN-085,SCN-087,SCN-088,SCN-089 |

## Внешние подключения и MCP

Дать точный доступ к инструменту/аккаунту. **When:** Когда конкретная задача требует внешнего ресурса. **Scope:** Later; не все аккаунты заранее.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `connections` | later | M9, M11, M29, S03, S02 | docs/ux/screens.md:179 → SCN-001,SCN-005 |
| `connect-account` | later | M9, M11, M29, S03 | docs/ux/screens.md:195 → SCN-005 |
| `access` | later | M15, S02, S03, S05 | docs/ux/screens.md:411 → SCN-022,SCN-023,SCN-024 |
| `access-detail` | later | M15, S02, S03, S05 | docs/ux/screens.md:427 → SCN-022,SCN-023,SCN-024 |

## Повторяемая работа и workflow

Превратить уже полезный ручной цикл в контролируемое повторение. **When:** S2 после хотя бы одного полезного разбора; раньше по явному желанию. **Scope:** R0 ограниченный preset, save/enable/pause; full DAG editor later.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `cycles` | near | M186, S15, S14, M178, M179, M180, M181 | docs/ux/screens.md:866 → SCN-056,SCN-058 |
| `schedule` | near | M13, S15, M186, M188, S04, S14 | docs/ux/screens.md:210 → SCN-008,SCN-009 |
| `routine-editor` | later | M66, M67, M68, M90 | docs/ux/screens.md:1173 → SCN-075 |
| `pipeline` | later | M18 | docs/ux/screens.md:1012 → SCN-068 |

## Цели и графы

Различать направление, зависимости и историю. **When:** S1 при нескольких задачах; S2 при втором проекте/ветвлении. **Scope:** R0 read context; arbitrary editing R1.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `goals` | later | M144 | docs/ux/screens.md:1035 → SCN-069 |
| `goal` | later | M144 | docs/ux/screens.md:1035 → SCN-069 |
| `project-plan` | near | M190, M188, M189, M152, S13, S14, S10, M187 | docs/ux/screens.md:804 → SCN-046,SCN-052,SCN-053,SCN-058 |
| `launch-plan` | near | M190, M188, M189, M152, S13, S14, S10, M187 | docs/ux/screens.md:804 → SCN-046,SCN-052,SCN-053,SCN-058 |
| `agent-history` | near | M190, M188, M189, M152, S13, S14, S10, M187 | docs/ux/screens.md:804 → SCN-046,SCN-052,SCN-053,SCN-058 |
| `project-history` | near | M190, M188, M189, M152, S13, S14, S10, M187 | docs/ux/screens.md:804 → SCN-046,SCN-052,SCN-053,SCN-058 |

## Память и источник

Проверить что известно, откуда и что реально видел агент. **When:** Первый why/ошибка/повтор задачи; не форма заполнения на старте. **Scope:** R0 источники и historical pack; расширенный документ later.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `memory` | near | M191, M177, S14, S12, M182 | docs/ux/screens.md:680 → SCN-039,SCN-057,SCN-062,SCN-064 |
| `context-pack` | near | M191, M177, S14, S12, M182 | docs/ux/screens.md:680 → SCN-039,SCN-057,SCN-062,SCN-064 |
| `memory-lineage` | near | M191, M177, S14, S12, M182 | docs/ux/screens.md:680 → SCN-039,SCN-057,SCN-062,SCN-064 |
| `document` | later | M124, M130, M134 | docs/ux/screens.md:1288 → SCN-080 |

## Активность и релизы

Увидеть изменение и отличить публикацию от проверки. **When:** При первом наблюдаемом событии/результате; график после истории. **Scope:** R0 узкие source-backed readers.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `launch-pulse` | near | M185, M151, S14, M187 | docs/ux/screens.md:847 → SCN-044,SCN-055,SCN-058 |
| `launch-releases` | near | M185, M151, S14, M187 | docs/ux/screens.md:847 → SCN-044,SCN-055,SCN-058 |

## Ретро и улучшение Fabric

Превратить повторяемую проблему в проверенное улучшение. **When:** S3 после реальных повторных эпизодов; outbound consent отдельно. **Scope:** Near catalogue; полный lifecycle не доказан.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `retro` | near | M154, M182, M184, M168, S15 | docs/ux/screens.md:911 → SCN-062,SCN-063 |
| `feedback` | near | M183, S12, S14 | docs/ux/screens.md:936 → SCN-063 |

## Совместная работа

Подключить коллегу и разрешать свои взаимодействия. **When:** При приглашении или явной нужде в делегировании; вход приглашённого отдельный. **Scope:** S09 narrow estate membership; role workspace later.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `membership` | near | S09, M38, M39, S02, S03 | docs/ux/screens.md:302 → SCN-013,SCN-014,SCN-066 |
| `invite` | near | S09, M38, M39, S02, S03 | docs/ux/screens.md:302 → SCN-013,SCN-014,SCN-066 |
| `role-workspace` | later | M38, M39, M40 | docs/ux/screens.md:286 → SCN-013,SCN-014,SCN-018 |
| `workspace-editor` | later | M39, M37, M34 | docs/ux/screens.md:348 → SCN-018 |

## Рабочие инструменты IDE

Изучать и менять результат рядом с агентом. **When:** Контекстно по ссылке на артефакт/сессию; не обзор всех инструментов. **Scope:** Near workspace/editor/session; остальные later.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `workspace` | near | S13, S14, M187 | docs/ux/screens.md:500 → SCN-030 |
| `editor` | near | S01, S02, S13 | docs/ux/screens.md:534 → SCN-034 |
| `session` | near | M16, M105, S13, S14, S02 | docs/ux/screens.md:481 → SCN-025,SCN-029,SCN-091; docs/ux/screens.md:444 → SCN-025 |
| `service-terminal` | later | M10 | docs/ux/screens.md:1196 → SCN-076 |
| `internal-browser` | later | M74 | docs/ux/screens.md:1219 → SCN-077 |
| `media-preview` | later | M75 | docs/ux/screens.md:1242 → SCN-078 |
| `file-diff` | later | M76, M62 | docs/ux/screens.md:1265 → SCN-079 |

## Предпочтения, затраты, уведомления

Управлять пределами и получать только полезные сигналы. **When:** До cost/external effect — нужный предел; полный экран после потребности. **Scope:** Later full surfaces; обязательные R0 ограничения не откладывать.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `usage` | later | M83, M94 | docs/ux/screens.md:1058 → SCN-070 |
| `estate-settings` | later | M72, M73, M152 | docs/ux/screens.md:1081 → SCN-071 |
| `settings` | later | M72, M73, M152 | docs/ux/screens.md:1081 → SCN-071 |
| `notifications` | later | M159, M160, M161, M162, M163, M164, M165 | docs/ux/screens.md:1104 → SCN-072 |

## Диагностика, синхронизация, восстановление, архив

Понять сбой, вернуть данные или завершить жизненный цикл. **When:** JIT при сбое/переносе/закрытии; recovery доступен с первой сессии. **Scope:** Near sync/restore target; later full maintenance; never hide emergency actions.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `diagnostics` | later | M81 | docs/ux/screens.md:1127 → SCN-073 |
| `sync` | near | S12, S14, M191 | docs/ux/screens.md:962 → SCN-064,SCN-065 |
| `restore` | near | S12, S14 | docs/ux/screens.md:987 → SCN-065 |
| `archive` | later | M77 | docs/ux/screens.md:1150 → SCN-074 |

## Специализированные роли и межпроектные предложения

Закрывать поддержку, выпуск, контент и передачи с проверенным результатом. **When:** После устойчивого основного цикла и появления конкретной роли. **Scope:** Later; идеи сохраняются, не входят в принудительный tour.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `support` | later | M27, M11, M39, S03 | docs/ux/screens.md:364 → SCN-019 |
| `release` | later | M2, M4, M25, M188, M190, M168, S03, S08 | docs/ux/screens.md:380 → SCN-020 |
| `content` | later | M21, M19, M22, M23, M29, S03 | docs/ux/screens.md:395 → SCN-021 |
| `reports` | later | M4, M11, M20, M25, S03 | docs/ux/screens.md:241 → SCN-010,SCN-011 |
| `proposal` | later | M20, M35, M157, S03, S06 | docs/ux/screens.md:257 → SCN-010,SCN-011,SCN-012 |
| `cross-project-proposal` | later | M20, M35 | docs/ux/screens.md:257 → SCN-010,SCN-011,SCN-012 |

## Карта и каталог дизайна

Проверить дизайн и покрытие экранов. **When:** Для ревьюера/агента, не обязательное обучение клиента. **Scope:** Review-only catalogue, не новая production capability.

| View | Horizon | Task IDs | Canonical receipts and explicit scenarios |
|---|---|---|---|
| `launch-map` | near | S13, S14, M151, M185, M186, M187 | docs/ux/screens.md:575 → SCN-043,SCN-044,SCN-059,SCN-060,SCN-092,SCN-093; docs/ux/screens.md:96 → SCN-001,SCN-006,SCN-007 |
| `launch-design` | near | S14, M185 | docs/ux/screens.md:575 → SCN-043,SCN-044,SCN-059,SCN-060,SCN-092,SCN-093 |

## Aliases and exclusions

- `estate`/`launch-home`, `project`/`launch-project`, `board`/`launch-board`, `agent-detail`/`launch-agent` and graph preview variants are alternate presentations, not additional domain capabilities.
- `goal`/`goals` and `settings`/`estate-settings` are route aliases; do not add duplicate setup steps or stores.
- `launch-map`/`launch-design` are review artefacts. `landing` is an external acquisition surface. These are inventoried but excluded from mandatory in-product tour.
- Near/later in the model is a catalogue horizon, not R0 runtime readiness. Explicit R0 authority, admission, configuration and recovery requirements still apply even when advanced screen editor is later.
- All old views, backlog IDs and specialist ideas are retained above. Deferred means a named trigger and dependency, never deletion.

See JSON sibling for per-screen runtime descriptions and bounded canonical status/coverage receipts.

## Findings requiring explicit review

These are bounded source findings, not a claim that every click in every state was exercised.

1. **P0 · Traceability parser absorbs unrelated appendices.** `scripts/sync-product-ux.mjs:11` slices a registry record until the next *same-prefix* `###`, or EOF; `:18` collects every SCN occurrence in that body. Therefore SCR-63 inherits SCN-094/042/031/059 from general appendices beginning `docs/ux/screens.md:1356`, although its declared Scenarios field at `:1336` only lists SCN-083/084/085/087/088/089. The same boundary function parses scenarios and flows, so final SCN/FLW records need checks too. **Red regression run (exit 1):** assert that references extracted from SCR-63's parser slice exclude SCN-031; actual references were `083,084,085,087,088,089,094,042,031,059`. Repair packet before trusting downstream auto coverage: bound record at next equal-or-higher heading, parse own fields, model general appendices as explicit overrides keyed to named records; preserve legitimate inverse references. Do not raise canonical status on resync.
2. **P0 · Required R0 capabilities and later catalogue screens need narrower contracts.** OX-09/10 are R0 at `docs/ux/plans/2026-09-15-r0-operator.md:74–75`, but providers/admission/routine-editor/pipeline are later model views. `docs/ux/screens.md:1403–1404` already distinguishes basic config from advanced gates. Decision: define one admitted preset setup and one paused review-cycle preset as R0 journeys, reuse advanced details only when needed. Do not infer that later editor permits bypassing admission, cost or authority.
3. **P0 · Runtime account setup cannot be a universal first-use gate.** `docs/ux/scenarios.md:2109`, `:2126`, `:2160` say ProviderAccounts component has tests but no reachable runtime IPC/settings entry; M199 stays proposed at `docs/evidence/backlog.md:767`. `apps/desktop/src/shared/providerCapabilityMatrix.ts:10–22` records explicit capability/certification limitations (version-specific historical evidence, not a claim about today's external product). New users need system-login/read-only/manual-task path; managed second account and cross-account continuity introduced only when capability is actually certified. Never promise live resume from prototype account-switch.
4. **P0 · Teaching collaboration must disclose estate-wide visibility before invitation.** `apps/desktop/src/shared/membership.ts:129–154` explicitly says v1 sees the whole estate; renderer filters cannot manufacture project-only membership. Model SCR-14 description reports no invitation/acceptance renderer; canonical `docs/ux/screens.md:302`. Give invited users separate entry/intent, existing work restoration and role-specific actions. Do not show “invite to this project only” absent enforced contract.
5. **P0 · Recurring-value hook must respect desktop availability.** `apps/desktop/src/main/routineTick.ts:16–20` says closed app runs nothing, with bounded catch-up; future cycle overview is not proof of background service. Teaching “come back tomorrow, Fabric worked” is invalid without actual receipts. Preview next due + host requirement, then first real completed window, then pause/recovery. Pause feed is distinct from pause schedule and stop current run (OX plan `:28–32`).
6. **P1 · Current guide is one linear setup, not a cross-session adoption system.** `scripts/product/guided.mjs:7–11` is an in-memory Map and fixed four steps; `:29` explicitly limits retention to page lifetime; `docs/launch/ceo-onboarding.md:47` describes future GuideRecord but no entry/trigger policy for later capabilities. Add durable per-user+estate+project adoption state with eligibility triggers, dismiss/resume, source receipts and independent feature availability. Session number is guidance, not a lock or streak obligation.
7. **P1 · “Learning completed” conflates object creation with experienced value.** `scripts/product/guided.mjs:34` counts task/topic IDs; `:50` creates an educational Board topic; `:51` marks finished once both exist. User could complete without resolving the topic or returning after a pause. Keep setup receipts separate from first-value, first-return and learning evidence; never invent learning from a click. Educational topic must be visibly tutorial, removable/skippable and never outrank real obligations.
8. **P1 · Synthetic default cycles can contaminate empty-project learning.** `scripts/product/routines.mjs:24–25` seeds “Проверка уроков” with a three-node fixture graph for every project; `:28–30` clones it when user proposes a cycle. This is explicitly a simulator (`:1`), but guided new-project demonstrations need genuine empty state and explicit preset preview so they do not teach that a real new project already has configured work. Verify new project→cycles with no fixture graft before accepting prototype flow; do not treat this as a proven runtime bug.
9. **P1 · Full catalogue remains reachable as 85-item mobile control.** `scripts/product/calm.mjs:23` renders all model views in mobile select and “Все разделы · 85” for every cohort. Good for design review, unsuitable as default novice IA. Separate preview controls from proposed product shell; use progressive suggested entries plus stable search, never remove recovery or experienced-user direct navigation. Map/editor aliases should not become extra concepts to learn.
10. **P1 · Conversational discovery is currently a deterministic catalogue, not general manager execution.** `scripts/product/concierge.mjs:1–32` regex routes to forms; `:42–43` explicitly says changes are not applied and link to common form. Define each introduced shortcut by intent→scope→prerequisite→command/read→receipt→next action. User should get value after click, not a tour of a form that cannot act. Unsupported/freeform clarification must preserve draft and give exact fallback, not silently create a task.
11. **P1 · Learnable system requires meaningful unit receipts, not all-screen smoke.** `docs/ux/audits/2026-09-16-calm-ui.md:11` disclaims full-operation coverage. SCN registry `docs/ux/scenarios.md:39–98` remains partial/blocked/fail/unobserved. Test first-time novice with no seeded tasks/agents/conversations and distinct invited/existing/new-idea cohorts, then leave/relaunch and verify correct next action. Existing green prototype tests do not certify value or production readiness.

## Cross-session proposal and introduction rules

**S0 · First useful session:** choose one real project or an idea; save purpose/first task; receive a sourced orientation card and an explicit next step. If existing history is available, first value is a correct “where we are/what needs you” summary, not creating a redundant task. No history? Say so and establish the first durable checkpoint. Provider setup only if the user wants to run immediately; otherwise “saved, not started” plus next setup link. Voice is an offered input modality, not a compulsory tutorial; R0 delivery still requires real voice acceptance.

**S1 · First real return or second project:** show changes since the actual last visible snapshot, last decision and next action; invite one Board decision when one exists. Demonstrate switching A→B→A, exact source and “Discuss with Fabric”. Teach history/pack only when a user asks why or inspects an agent. Exit receipt: user can correctly name goal/current work/blocker/next action, and their action is saved once in correct scope.

**S2 · Repeated valuable work:** after a useful manual review or repeated action, offer “repeat this review” with a paused preset, timing/timezone, host availability, budget and preview. Enable explicitly. Teach cycle result and pause after first actual run; introduce goal read graph when work has meaningful dependency/branching and second project when user adds one. Do not fabricate results to finish training.

**S3 · Depth through need:** repeated blocker→retro; team invitation→membership; quota issue→account/usage; evidence doubt→memory lineage; chosen external task→connection/MCP; real release→release evidence. Role workspace, production of providers, advanced graph/workflow editor, outbound feedback and federation remain discoverable library items triggered by actual need. No forced session date or mandatory completion percentage.

**Always reachable:** help, scope switch, current source, task/agent state, explicit failure reason, cancel/stop where applicable, recovery, and direct expert navigation. Progressive introduction suppresses teaching noise, never withdraws safety or existing capabilities.

## Agent-ready decomposition inputs

These are proposed integration packets, not new competing task IDs. Root should attach them to existing OX/D/L/P owners and reserve any new issue IDs under its lease.

### A. Repair source-model traceability before coverage planning
- Read/write owner: `scripts/sync-product-ux.mjs`, canonical `docs/ux/{scenarios,flows,screens}.md`, `docs/ux/product-model.json`; shared integration owner serialises generated outputs.
- Dependency: none beyond current baseline; preserve historical IDs/anchors/statuses. New parser test must fail old implementation using general appendices after final SCN/FLW/SCR, then pass new boundaries and legitimate scoped overrides.
- Verify: `node scripts/sync-product-ux.mjs --check`; after intentional regeneration `node scripts/build-product-report.mjs --check`; count all 85 view IDs unchanged unless separately reviewed. `bash scripts/ci.sh fast` final integration only; source-mutating CI must not run concurrently with generation.
- Negative: appended global SCN reference must not attach to SCR-63; final scenario must not inherit every general-screen reference; no silent deletion of legitimate named appendix refinements.

### B. Persist adoption state and value receipts (OX-01/05 + GuideRecord)
- Reuse `apps/desktop/src/main/onboardingDrafts.ts:51`, `apps/desktop/src/shared/onboardingDraft.ts`, renderer `Onboarding.tsx` and `onboardingDraft.persist.test.tsx`; journal/schema owners are `packages/journal/`, `packages/schema/` and `apps/desktop/src/main/index.ts` IPC boundary. Confirm current write-set before adding types. Prototype owner `scripts/product/guided.mjs`, not a new task store.
- Contracts: actor+estate+project/draft+guideRevision; origin cohort; dismissed/skipped vs experienced outcomes; immutable business entity/request refs; last shown source boundary; no provider login or grant from tutorial.
- Inputs: OX-01 entity/command matrix, typed create Project/Task receipts, permission boundary. Output: restart-safe pause/resume across projects, no duplicate project/task and no auto-dispatch.
- Tests: existing `apps/desktop/test/onboarding-drafts.test.mjs`, `apps/desktop/src/renderer/src/onboardingDraft.persist.test.tsx`; targeted prototype `node --test scripts/test/ceo-onboarding.test.mjs scripts/test/calm-flows.test.mjs`.
- Negative: A→B while pending; crash after commit before receipt; duplicate creation; archived existing repo; revoked access; version upgrade; skip creates no success receipt; new project never borrows Atlas tasks or seed cycles.

### C. Introduce narrow executable agent setup (OX-09, S04, M17)
- Reuse `apps/desktop/src/renderer/src/ProjectHome.tsx`, `HarnessSection.tsx`, existing main agent/terminal handlers and `apps/desktop/src/main/agentSurface.ts:226`; advanced prototype `scripts/product/integrations.mjs:149/316`.
- Keep separate: chosen candidate → saved config → compatibility/admission → active binding → actual observed host → accepted TaskRun → delivery. Descriptor choice is not certified capability. `docs/evidence/backlog.md:264` M17 shipped descriptor dispatch, `:317–322` M32/34/37 proposed or unscheduled.
- Dependencies: addressed first Task, actual provider capability, S02/S03 authority, budget/current revision and shared form/CEO command gateway. M199 second-account support is optional, not prerequisite to all local agent work.
- Verify existing suites `node --test scripts/test/product-integrations.test.mjs scripts/test/calm-config.test.mjs`; runtime tests need proper runtime package context rather than importing main/index.ts (module starts Electron; `routineTick.ts:11–14`). Negative no-provider, unsupported adapter, changed policy after preview, stale version, revoked scope, duplicate launch and unknown ACK.

### D. Turn completed manual value into a cycle preset (OX-10 / P4/P5 / S15)
- Owners: `apps/desktop/src/main/routineTick.ts:83`, `apps/desktop/src/main/index.ts:1768` automation read, `apps/desktop/src/shared/{routine,cyclePort,cycleView}.ts`; prototype `scripts/product/routines.mjs`, `pulse.mjs`.
- Required fields: exact project/agent/preset revision, trigger, zone/next window, effect limits, availability, selected input boundary, definition/window/attempt/result receipts. Full arbitrary pipeline editor stays independent later capability.
- Output UI: Draft→validated→saved paused→enabled→last result→pause; current in-flight run separately stoppable; paused view does not pause runtime.
- Existing tests: `apps/desktop/test/routine-tick.test.mjs`, `run-lifecycle.test.mjs`, shared routine/cycle tests. Some runtime probes need stack; report not-run rather than fallback mock PASS.
- Negative: app closed, timezone/DST, bounded catch-up, duplicate same window, stale/missing source, quota unknown, active run on pause, config changed during run, replay after crash; no automatic late effect after unknown outcome.

### E. Return context and graph/source drill-down (OX-08 / L01/L02 / M190/M191)
- Roots: `apps/desktop/src/main/{digestRead,memoryOverviewRead}.ts`, `shared/{plan,planProgress,decisions,memoryContract,cycleView}.ts`; renderer `DigestSection.tsx`, `PlanSection.tsx`, `HarnessSection.tsx`; prototype graphs/workbench/launch/context-items modules.
- Scope: read-only first; target plan, agent history and project history separately named and addressed. Existing `planOf` at `shared/plan.ts:33` is not full graph engine; `docs/evidence/backlog.md:761` says full M190 producers/routes missing. Exact historical pack is distinct from future dry-run preview.
- Acceptance: second session on own project restores known checkpoint and marks only displayed source boundary seen; expansion→exact object→back preserves scope/selection; unknown source not “none”. Test command `node --test scripts/test/product-graphs.test.mjs scripts/test/product-graph-provenance.test.mjs scripts/test/product-graph-scopes.test.mjs scripts/test/product-graph-plan.test.mjs`; runtime source-reader test suites distinct.
- Negative: late A response while B open; denied/deleted source; unbound task/goal; capped totals; changed snapshot; temporal order must not invent causal edge; no seed graph for empty project.

### F. Contextual power-user paths, with visible prerequisites
- Collaboration roots `main/identity.ts:54`, `shared/membership.ts:80/138`, existing membership probes. Team lesson exposes estate-wide read scope before invite; no project privacy promise.
- Accounts roots `main/providerAccounts.ts:104`, `shared/providerCapabilityMatrix.ts:27`, shared conversation/account switch modules. Credentials not in conversation/journal/analytics; unsupported provider leaves current session intact. PA packets/CO-112 retained, live certification separate.
- Memory/recovery roots `main/backup.ts:58`, `main/memoryOverviewRead.ts:91`, architecture memory/sync contracts. Export/mirror not automatically full recoverable backup; restore quarantines old authority/outbound intent; never invoke destructive restore in novice tour.
- Notifications/usage/diagnostics/archive currently broad target governance (`scripts/product/governance.mjs:56/75/86/107/118`) and draft canonical SCN-070…075. Use explicit eligibility first real signal, cost question, error or archive intent; no forced Telegram, no arbitrary outbound feedback.
- Separate packet per family only once prerequisite is actually ready; retain M IDs from inventory and explicitly name fallback/UI-disabled reason for unfinished capability.

### G. Outcome evaluation / acceptance ledger (OX-12)
- Maintain per cohort × capability × starting data × action × expected state/effect × receipt × negative result × viewport/input mode. Observation categories: source-inspected, pure test, prototype click, desktop integration, observed user outcome. A row cannot be green from a different category.
- Required cohorts: brand-new idea/no repo/no provider, one real repo, folder with many candidates, existing history, invited member, returning unfinished setup, first/second project, unsupported provider/offline. First meaningful value may differ; tutorial completion isn't activation.
- Metrics proposed for baseline/pilot, not guarantees: correct next-action time, sourced context reconstruction, first accepted task/decision/result, successful return after pause, redundant setup/approvals, wrong-project/lost-input/duplicate effects. Measure user benefit, not clicks or screen count. No unsupported “maximum conversion” number.
- Handoff to each implementation agent: baseline commit, canonical entry, read/write sets, owner/lease, dependencies with exact output schema, fixed decisions/exclusions, named current handler, fixture + runtime checks, negative controls, integration order, roll-forward/rollback and receipt location. Missing contract is a stop-and-resolve condition; never invent a second store or auto-upgrade scope to keep a demo flowing.

## Verification in this audit

- Baseline: `bac1f67` (full hash in JSON). Repository not edited.
- Inventory script asserts 85 model views = 85 assignments = 85 unique IDs, no missing/extras: PASS.
- Source-model boundary red regression: expected FAIL, exit 1, SCR-63 unexpectedly includes SCN-031. No regression fix performed here.
- No browser, product runtime, live login, external transmission, scheduler or destructive operation performed. Proposed tests/acceptance commands above are implementation inputs, not claims of execution.
