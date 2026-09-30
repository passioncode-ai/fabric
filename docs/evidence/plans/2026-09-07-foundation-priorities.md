<sub>ssheleg skills — task-pipeline · agent-sync · evidence-docs</sub>


# Приоритеты Fabric: фундамент, карта и фиксация аудита

**Дата:** 2026-09-07. **Тип итерации:** документация, порядок поставки и механическая проверка карты.
**Вход:** уточнение оператора о карте/summary и foundations-first; сохранённый аудит `153b4f0` и приложенный план.
**Выход:** ADR-0044, CO-108, одна актуальная очередь в backlog, обновлённая карта, доступный архив аудита.
Продуктовый runtime, схемы данных, UX-поведение и native build в этой итерации не меняются.

## Почему меняется порядок

- M97, M196 и M197 уже имеют delivery receipts; повторное планирование скрывало реальные блокеры.
- `M98 → всё остальное` не подтверждено зависимостью: размер файла сам по себе не мешает исправить scope или data loss.
- M198 нужен до доверия replay/config identity; S14 даёт честный контракт чтения нескольким ранним экранам.
- Сохранность пользовательского ввода — нижняя граница продукта, даже если дефект находится в React-компоненте.
- M188 описывает прогон и шаги; M190 читает их, поэтому красивый граф не может заменить события и стабильные идентификаторы.
- M157 нельзя включить раньше M158/M168. M176 предшествует активации manager, а не проводится после настройки prompt.
- M183.local и M183.upstream различаются внешним эффектом. Отсутствие имени пользователя не доказывает анонимность свободного текста.

Основания, acceptance и исходные файлы для этих выводов: [проверенный merged report](../../audit/2026-09-07-merged-execution-plan.html).
Новая очередь не выдаёт частоту дефекта или рост бизнес-метрик за измеренный факт: таких production-данных аудит не получил.

## План текущей итерации и приёмка

| Шаг | Работа | Проверка |
|---|---|---|
| 0 | Сверить HEAD, реальную доску, lease и уже поставленные M | источник 153b4f0; status/reconcile до изменения |
| 1 | Сохранить audit snapshots, добавить индекс и ссылки | HTML/MD/JSON находятся в Git; ссылки разрешаются |
| 2 | Добавить ADR и одну delta CO; прежние ids/status не переписывать как новые задачи | резервирование, register gate, полное покрытие 196 M |
| 3 | Пересобрать очередь и зависимые подзадачи | 62 execution nodes after the reviewed splits; каждый dependency существует; DAG без цикла |
| 4 | Обновить живую карту и общую инструкцию агентам | новые review anchors; четыре графа и их статусы различимы |
| 5 | Встроить freshness/link gate и проверить отказ | изменённый source и отсутствующий anchor должны дать nonzero |
| 6 | Выполнить fast CI, осмотреть HTML, зафиксировать Git и обновить board mirror | отдельные exit codes и итог фактической синхронизации |

## Границы решения

Утверждён порядок реализации и правило итерации. Из аудита не принимаются молча новые cardinalities:
Run/WorkflowRun/TaskRun, project-manager versus estate-CEO и outbound privacy contract должны
пройти соответствующую ADR/contract-миграцию в своих задачах. Фиксация CO не закрывает дефект.
Полная ретро, manager и графы на карте помечаются как проектируемое поведение.
Figma не является текущим design source: по `docs/ux/foundation.md` он отключён; карта — HTML,
с источниками в scenarios/flows/screens и архитектуре.

## Проверка общей очереди

Из 196 M-строк 42 входят в focus, остальные 154 классифицированы ниже. 15 audit S-subitems не создают 15 новых M.

- **Delivered outside this focus:** M17, M42, M43, M44, M45, M46, M47, M48, M49, M56, M63, M65, M68, M73, M82, M83, M94, M95, M96, M99, M100, M101, M113, M114, M115, M104, M106, M107, M108, M112, M111, M116, M117, M118, M120, M121, M122, M123, M124, M125, M127, M130, M131, M132, M133, M134, M135, M136, M137, M138, M139, M141, M143, M144, M145, M146, M147, M148, M150, M156.
- **Earlier strategic umbrellas / federation horizon:** M0, M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, M15, M16, M18, M19, M20, M21, M22, M23, M24, M25, M26, M27, M28, M29, M30, M31, M32, M33, M34, M35, M36, M37, M38, M39, M40, M41.
- **External capability or later manager activation:** M119, M126, M128, M129, M140, M170, M172, M174.
- **Telegram delivery channel:** M159, M160, M161, M162, M163, M164, M165.
- **Existing surfaces and capability backlog:** M50, M51, M52, M61, M57, M58, M59, M54, M62, M53, M55, M64, M60, M66, M67, M69, M70, M71, M72, M74, M75, M76, M78, M77, M79, M81, M84, M85, M86, M87, M88, M89, M90, M91, M92, M93, M110, M142.

## Исполняемые узлы и исправленные зависимости

[JSON этого review](2026-09-07-foundation-priorities.json) сохраняет 62 узла и точные зависимости.
Он расширяет первоначальные 58 узлов двумя независимыми частями S03 и двумя частями M152;
старый audit snapshot остаётся неизменным. Topological sort доказывает отсутствие цикла, а не приоритет.

- **S03.boundary** — scoped authority, floor, revision, atomic reservation. **S03.effects** — dispatch, receipt, unknown/reconcile и sink redaction. S04/S06 требуют первой части; автономные внешние эффекты — обеих.
- **M177** требует S02/S10/S14, но не полной S05. S05 остаётся необходимой для M176 и полного action history.
- **M152.commit** атомарно записывает ответ/decision и обновляет множество blockers. **M152.continue** доставляет его существующей task/session с ack/retry через S04/M103. M188 обогащает lineage позднее; первый answer не ждёт всех plan steps.
- **M153** читает M152.commit. **M186** читает S15/S14 и показывает unknown для отсутствующих detectors; полный M180 нужен соответствующим наблюдениям, не пустой оболочке экрана.
- **S07**: CI/manifest можно готовить сейчас; release с обещанием restore/upgrade требует также M198/S14/S12.
- **M103** уже shipped. В этой очереди запланирована коррекция acknowledgement boundary под CO-108, не его повторная реализация.

## Куда относится каждый пункт дельты CO-108

| Audit subitem | Existing milestone owners | Existing carry-over | Exact delta |
|---|---|---|---|
| S01 | M143, M111, M110 | CO-089, CO-107 | Текущие регрессии: hooks, editor inflight-save, task-bound draft, empty board и pending create. M143 — task page; M111 — сохранение рабочего контекста; CO-089 — уже собранные UX-дефекты. Не переобъявлять весь M111/M143 неотгруженным. |
| S02 | M1, M109, M13 | CO-071, CO-091, CO-092, CO-107 | Scope writer/query/filesystem и scheduler. CO-071 владеет identity invariants, CO-091 — per-window API, CO-092 — ORG1/local assumptions. Закрыть только проверенный локальный scope slice; это не завершение всей auth/multi-machine работы. |
| S03 | M3, M137, M138, M139, M140, M195 | CO-059, CO-061, CO-107 | Коррекция существующих floor/grant/effect receipts и всех redaction sinks. CO-059/061 ограничить этим scope, не переоткрывать выбор policy engine CO-079, уже решённый ADR0023. M195 shipped с отдельной коррекцией, не новое выполнение S1. |
| S04 | M13, M94, M132, M146, M90, M92 | CO-043, CO-061, CO-063, CO-107 | Admission/start-existing-task, all-predecessor join, quota unknown, launch identity. Использовать уже принятый durable execution contract; CO-077 не принимать заново. M90/M92 — related dependency/needs requirements, не новая сущность графа. |
| S05 | M81, M176 | CO-078, CO-060 | M81 — существующий диагностический log milestone, M176 — потребитель trajectory. Добавить attempt/outcome trace как подзадачу, не новый CO о том же отсутствии observability. CO078 внутренний envelope частично уже закрыт ADR0027; external mapping остаётся отдельным долгом. |
| S06 | M148, M152, M143 | CO-107 | Исправление blockers-set и атомарная answer/promote command. Новая дельта CO108 ссылается на M148 regression и M152 acceptance. CO051 про внешний work-producing-agent store лишь смежный, не владелец данного SQL-дефекта. |
| S07 | M110, M100, M196 | CO-082, CO-088, CO-107 | CI, artifact identity, packaged smoke и recovery — продолжение M110/CO107 REL01/02; install path принадлежит CO088. Подготовку manifest/CI делать рано, activation release после нужных safety/replay gates. |
| S08 | M176, M129 | CO-074, CO-060, CO-082 | Основной owner — CO074 runner conformance и M176 eval. M129 может дать выбранный production-signal pilot, но не является условием всех controlled loop fixtures. Не создавать новый CO «any agent недоказан». |
| S09 | M38, M39 | CO-071, CO-073, CO-088, CO-092 | Уже принятые identity/member milestones. Scope/authorization — первая независимая часть, live team launch ждёт нужных release/privacy gates. Не дублировать M38 новым S-milestone в каноническом реестре. |
| S10 | M96, M112, M114, M115 | CO-107 | Living map, точные anchors и implemented/verified/installed/observed — delta filing. ADR0044 (зарезервирован parent) только foundation delivery order и требования living map/retro. Не принимать через него новые Run/privacy/manager решения. |
| S11 | M82, M116, M117 | — | Новая брендовая иерархия подтверждена владельцем; source-of-truth propagation в brand/docs/assets. CO028 resolved касается product family, не равен решению новой роли Fabric; не переоткрывать его автоматически. Изменение ADR0018 оформлять отдельным superseding brand ADR, не ADR0044 о порядке. |
| S12 | M1, M118, M198 | CO-081, CO-082, CO-107 | Import/mirror declared coverage и recovery. M198 сохраняется самостоятельным existing milestone; не создавать CO108 подпункт с новым id «rebuild revision» как независимую дублирующую работу. |
| S13 | M117, M120, M121, M141, M142, M144, M145 | CO-089, CO-107 | Исправления уже shipped readers/components; сохранять находки PLAN04–08/UV по отдельным acceptance, M187 density не подменяет их. Для поиска owner M141, для scope harness M145, для cap M120. |
| S14 | M49, M102, M106, M108, M109, M111, M120, M133, M135 | CO-089, CO-107 | Единый read/error contract и локальная durability. M49/135 — pack/overview; M111/120/133 — local state. Не ждать full trace S05 и не создавать отдельный domain store preferences. |
| S15 | M13, M153, M184, M186, M194 | CO-020, CO-043, CO-097 | Общий cycle foundation — часть уже записанных scheduler/catch-up/manager wake требований. Parent record CO108 связывает producers и reader M186. Не новая самостоятельная orchestrator truth или повторный выбор engine CO077. |

Открытие CO-108 не закрывает CO-107/CO-089 и не переоткрывает целиком shipped M. Перед реализацией каждого подшага повторно проверить его механизм и уже прошедшие исправления.

## Проверки этой итерации

- `bash scripts/ci.sh fast` — exit 0; 48 Vitest files / 415 tests, build, documentation/design gates and pure probes. [Полный лог](2026-09-07-foundation-priorities/fast-ci.log). После финального parser gate и записи evidence проверка повторяется перед commit; результат фиксируется в рабочем журнале проверки.
- `node scripts/test/check-design-map.test.mjs` — 19/19 cases pass, включая реальный отказ на изменённый ADR, execution brief, потерю старого anchor, битую ссылку и повтор committed iteration. Повтор refresh в незакоммиченной итерации проходит. [JSON](2026-09-07-foundation-priorities/map-gate.json) · [лог](2026-09-07-foundation-priorities/map-gate.log).
- [Проверка плана](2026-09-07-foundation-priorities/validate-plan.py) — 62 nodes, 119 edges, DAG, 42 focus + 154 other = 196 existing M rows, S→M/CO и anchors resolve. [Результат](2026-09-07-foundation-priorities/plan-validation.json).
- Изолированный headless Chromium, ширины 1280/390: переходы к changelog, графам и вложенной S03.boundary, раскрытие details, отсутствие overflow/JS errors. Липкая навигация сначала перекрывала mobile target — исправлено измерением её высоты. [Результат](2026-09-07-foundation-priorities/browser-check.json) · [desktop](2026-09-07-foundation-priorities/graphs-desktop.png) · [mobile](2026-09-07-foundation-priorities/graphs-mobile.png).
- Native Codex browser check не состоялся: Mac был заблокирован. Открытие карты поставлено в очередь Codex. Headless-проверка не выдаётся за native Electron E2E.
- `reconcile` до изменений показал 18 ADR и 57 CO после baseline без as-built records. Исторические записи не отмечены реализованными на основании filing этой итерации: часть является design, часть требует восстановления receipt. Задача на смысловую сверку остаётся CO-108/S10. Новые ADR-0044/CO-108 записываются как policy/audit filing, не как реализация продукта.

Ссылки в новых, ещё не зафиксированных audit Markdown приведены к source commit либо относительным путям: содержание findings и исходный JSON плана сохранены. Это исправление переносимости ссылок, не переписывание выводов аудита. Новый продуктовый функционал не проверялся как поставленный.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — приоритизация по зависимостям и фиксация итерации
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — lease и синхронизация общей доски
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — проверяемые ссылки и границы доказательств

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
