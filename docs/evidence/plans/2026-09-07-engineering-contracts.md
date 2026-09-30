<sub>ssheleg skills — task-pipeline · agent-orchestrator · agent-harness · agent-interop · agent-sync · evidence-docs · ux-scenarios · sheleg-design · accessibility-review · webapp-testing</sub>

# Fabric: задания исполнителям и модель системы

**2026-09-07 · целевой инженерный пакет, на предметном review.** Исследованный код:
`5051def6304a781615f21adcd84b5836ab56a9dc`. Эта итерация поставляет документацию, визуализацию и gates
документации. Фичи продукта, новая версия agent contract и безопасность live среды
не объявлены поставленными.

[Открыть устройство системы](../../reports/system.html#system) ·
[граф данных](../../reports/system.html#data) · [циклы](../../reports/system.html#cycles) ·
[карточки](../../reports/system.html#tasks) · [порядок работы](../../reports/system.html#order) ·
[три ADR](../../reports/system.html#decisions) · [живая карта](../../reports/map.html#engineering-specs).

## Задача и граница

Оператор попросил исследовать существенные задачи текущего плана до конкретного решения,
оставить очевидные исправления краткими, зафиксировать данные/циклы в одном источнике
и дать визуальную систему для review. Сохранены все 57 карточек текущего
объединённого плана и все 31 требований исходного запроса.
Из них 49 получили глубокий контракт, 4 — короткий рецепт,
4 — ограничения сохранения уже поставленного. Шесть частей отделяют
authority boundary от dispatch, answer commit от delivery и local retro от upstream.

В общей очереди 62 исполняемых узла и 121
связь с названными данными. M183 представлен двумя частями без фиктивного третьего
агрегатного исполнения. Все остальные стратегические M строки остаются в backlog;
этот пакет не выдаёт дальний горизонт за готовые задания.

Соответствие vision: сохраняет Project как устойчивую единицу с полномочиями, Evidence
и обратной связью; смена исполнителя не меняет смысл данных. Проверено против
[anti-vision и alignment test](../../ux/vision.md): никакой зависимости от одного
вендора, скрытого саморазрешения или подмены результата уверенностью модели.

## Как передавать работу агенту

1. Выбрать готовый узел в [канонической очереди](../backlog.md#build-order-by-layer).
2. Получить автономно читаемый пакет командой `node scripts/task-spec.mjs M188`.
   Для части — `node scripts/task-spec.mjs M152.commit`. Вывод содержит общий контракт,
   карточку, входные зависимости и общий контекст родителя, когда выбрана часть.
3. Реализовать выбранный алгоритм и типы; не добавлять свой state machine, скрытый
   fallback, новую wire-роль или источник данных. Имена `future_files` / `proposed_symbols`
   обозначают будущие элементы, а `sources` — исследованный код.
4. Выполнить указанные позитивные, отказные и конкурентные случаи. В карточке `tests`
   — **будущая приёмка**, а не результаты уже выполненных тестов.
5. Если тест опровергает выбранное решение или внешний version/admission gate недоступен,
   зафиксировать конкретное противоречие в CO-108/новом ADR по правилам проекта. Не
   подменять ограничение догадкой и не активировать capability без её зависимости.
6. Обновить затронутые scenarios → flows → screens, модель/карточку и живую карту
   в том же изменении. Сдать diff, receipt тестов и точную ссылку на изменённый элемент.

**Владелец общего смысла:** [system-contract.md](../../architecture/system-contract.md).
**Владелец детализации задач и dependencies:** [engineering-specs.json](../../architecture/engineering-specs.json).
**Владелец данных и циклов:** [system-model.json](../../architecture/system-model.json).
HTML — детерминированная проекция этих файлов, а не второй вручную поддерживаемый план.
Исследовательские варианты внутри `research_context` информативны: финальный общий
контракт и карточки явно имеют приоритет над прежними вариантами зависимости/типов.

## Что именно определено

| Область | Выбранное решение и что это предотвращает |
|---|---|
| Архитектура | Модульный монолит на существующих швах; PostgreSQL journal + projections, отдельные типы durable operational state, identity, blobs и host-local settings. Граф — запрос к источникам, отдельная графовая БД не требуется. |
| Authority | Серверный scope, текущая revision и floor, reservation до dispatch. Grant, разрешённое намерение и фактически выполненный эффект различаются; unknown требует сверки. Reservation имеет историю и освобождается только с доказательством отсутствия dispatch. |
| Исполнение | Legacy WorkflowRun сохраняет прежний run_id. Новый TaskRun появляется после атомарного admission, до spawn. Каждый явный повтор unfinished task — новый прогон с новыми step states; terminal task не переоткрывается. |
| Ответы и продолжение | Один атомарный answer/decision commit; blockers — множество. Адресная delivery требует TaskRun, binding/epoch и семантическое ack. Запись в PTY не является подтверждением получения задания. |
| Графы | Отдельные agent history, project history, target plan и decision lineage. DID допускает возвраты и циклы; SHOULD проверяет нормативные зависимости. История решений показывает записанное обоснование и источники, не скрытое мышление модели. |
| Manager | ceo/estate и product-manager/project; один канонический role assignment, сменяемый binding и один effective writer epoch. Native capabilities допускаются только после измеренной conformance; чужой session ID не переносит полномочия. |
| Память | Наблюдение, claim, verified correction, retrieval и exact supplied context — разные данные. Next context preview ничего не пишет; исторический pack не заменяется сегодняшним. Partial/unknown не становятся пустой памятью. |
| Sync/restore | Git mirror покрывает объявленную конфигурацию; не является полным backup. Полный backup согласует identity + operational state + journal + blobs. После restore — новая authority generation, quarantine и reconciliation, чтобы старый снимок не оживил отозванные права/отправки. |
| Ретро | Категория и устойчивый occurrence/episode ID, цепочка proposed→implementing→verifying→verified/regressed. Семантическую коррекцию проверяет общий checker. Сервисные инсайты собираются локально; отправка — отдельная capability. |
| Inbox и циклы | Needs you выводится из канонических нерешённых обязательств; Happened имеет персональный read cursor. Конфигурация расписания, наблюдение активности и последний результат различаются. |
| UI | Превью → адресный экран → источник → возврат к прежним scope/selection/revision. Основное видно сразу, детали раскрываются; тот же граф доступен списком. Кастомизация controls пока записана как будущая возможность, не новый редактор UI в первом срезе. |
| Поставка | Provenance сборки, ACL/RLS отдельно, clean/upgrade/recovery fixtures, два исполнителя на одном observe-to-verify corpus. Неизмеренная конверсия и нативная совместимость не объявляются достигнутыми. |

В модели 8 областей, 61 сущность и 95
связей. Пометки `existing/partial/planned` относятся к основе сущности; **все связи —
целевой контракт**, а не утверждение о полном текущем исполнении. Шесть boundary-only
сущностей соседних модулей показывают границу системы без обещания их полной реализации.

## Двенадцать циклов

- [Наблюдение → проверенный результат](../../reports/system.html#cycle-observe-verify): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Запуск существующей задачи](../../reports/system.html#cycle-launch): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [План задачи и полные итерации](../../reports/system.html#cycle-iterations): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Вопрос → решение → продолжение](../../reports/system.html#cycle-answer): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Жизненный цикл manager](../../reports/system.html#cycle-manager): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Наблюдение за агентом](../../reports/system.html#cycle-health): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Память и компиляция контекста](../../reports/system.html#cycle-memory): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Ретро и обновление уроков](../../reports/system.html#cycle-retro): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Сервисные инсайты и отправка](../../reports/system.html#cycle-feedback): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Зеркало и импорт конфигурации](../../reports/system.html#cycle-sync): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [Восстановление без побочных запусков](../../reports/system.html#cycle-recovery): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.
- [События → внимание → действие](../../reports/system.html#cycle-attention): вход, dedup key, переходы с guard/payload, выход, прерывания и владеющие задачи.

## Изменения порядка после детального исследования

- **M173: M152.commit replaces M152.** Decision lineage consumes the committed answer, not continuation acknowledgement. S10 is already transitive.
- **M158: M152.commit replaces M152; no M168 prerequisite for pure assessment.** Scoring consumes durable original/replacement and evidence. M157 consumes this assessment and M168 before applying a settlement.
- **M154: Add S14.** A reader must distinguish partial/unavailable data and enforce scope. M182 alone does not provide the read envelope.
- **M184: Add M168 for semantic resolution activation.** Retro can collect episodes early, but a proposed memory/task mutation must pass the same fixed checker.
- **M149/M151/M190: No redundant S03.boundary/S14/S10 edges.** These contracts are already reachable through their prerequisites.
- **M153/M166/M169/M171/M176: Facet activation gates, not a reciprocal module dependency.** Shared ports may be designed before both implementations. Recurring wake requires S15; semantic writes require M168; enforced budgets require durable usage reservations. An eval fake does not wait for production ModelPort.

Новый граф не создаёт общего ожидания всего foundation-слоя: доставка конкретной
возможности ждёт её prerequisites. Например, Memory preview не ждёт полного backup,
а deterministic retro gathering может появиться до autonomous manager activation.
Исторические audit/foundation HTML/JSON оставлены неизменными и больше не являются
последней детализацией dependencies. Исходные статусы реализации сохранены.

## Предметные решения на review

- [ADR-0045](../../adr/0045-workflow-runs-task-runs-and-explicit-iterations.md):
  WorkflowRun / TaskRun / iteration; перенос legacy без выдуманной истории.
- [ADR-0046](../../adr/0046-manager-role-slots-epochs-and-provider-compatibility.md):
  slot, role, binding, смена исполнителя, epochs и admission внешнего manager.
- [ADR-0047](../../adr/0047-service-feedback-minimization-and-durable-suppression.md):
  локальный intake по умолчанию включён и отключаем; исходящая отправка отдельно
  выключена до явной активации с проверенным privacy/endpoint контрактом.

Последнее — **предложение, требующее предметного решения**, а не молчаливое принятие
оператором. Исходная идея default-on outbound сохранена как рассмотренный вариант.
Свободный текст не считается автоматически безопасным после удаления user ID:
для обычной отправки выбран закрытый structured payload без сырых названий/кода/путей.
Default-on outbound возможен лишь отдельным принятым изменением после проверки
реального payload, suppression, endpoint/retention/aggregation и продукта согласия.
Версионные изменения внешнего agent contract и брендовый superseding ADR для S11
остаются явными activation/delivery gates в соответствующих карточках, не потерянными задачами.

## Независимый review и исправления

Runtime/data/UX review нашёл противоречия уже внутри нового пакета. До закрытия этой
итерации в целевых контрактах исправлены:

- обязательный TaskRun для addressed continuation, включая reuse одной native session;
- release reservation и постоянная uniqueness grant: введена история reservations,
  partial uniqueness и одна блокировка с beginDispatch;
- epoch как Seq decimal string, local revision как opaque Revision, intake как boolean;
- согласованный backup всех классов данных и безопасная реактивация старого снимка;
- M158 как чистая assessment, применение через M157 + M168 + S06;
- отображение пояснений к источникам, текущего исходного состояния и target-статуса ребра;
- историческая оговорка M173 обновлена в соответствии с новой зависимостью.

Это изменения спецификации. Приёмочные race/restore/ack тесты добавлены **для будущей
реализации** и не выданы за выполненные security тесты. Закрытие замечаний сохранено
в [review receipts](2026-09-07-engineering-contracts/review-closure.json).

## Воспроизводимая проверка

- `node scripts/check-system-model.mjs`: охват карточек/requirements, идентичности,
  task dependency DAG, guards и состояния циклов, источники по pinned Git blob,
  локальные ссылки и уникальные HTML anchors.
- `node scripts/test/check-system-model.test.mjs`: намеренно испорченные входы обязаны
  отказать; gate не доказывает корректность семантики будущего исполнителя.
- `node scripts/build-system-map.mjs --check`: HTML точно соответствует исходникам.
- `python3 docs/ux/lint.py`: сценарии/flows/screens; planned coverage не превращается в built.
- `node scripts/check-design-map.mjs --refresh`, затем проверка: карта проверяется и
  получает отпечаток всех repository sources, сохраняя старые anchors и snapshots.
- `bash scripts/ci.sh fast`: документация, типы, UI gates и существующие pure tests.

Browser probe: `scripts/test/system-map.browser.cjs`; требует доступный модуль Playwright
(`FABRIC_PLAYWRIGHT_MODULE`), локальный docs server на `127.0.0.1:8770` и пишет только
в каталог `FABRIC_BROWSER_OUTPUT` (по умолчанию отдельный каталог в tmp). Он запускает
собственный headless Chromium, не подключается к пользовательскому браузеру/продукту.

Результаты: [design checks](2026-09-07-engineering-contracts/design-checks.json),
[browser checks](2026-09-07-engineering-contracts/browser-check.json),
[команды этой итерации](2026-09-07-engineering-contracts/checks.json).

Источники: [280 retained receipts](2026-09-07-engineering-contracts/source-receipts.json).
Текущий gate перепроверяет локальные исторические Git blobs; соседний contract repository
представлен явно помеченными retained receipts и pinned ссылками, не фиктивным CI checkout.
CI checkout получает history, чтобы проверять исследованную ревизию после следующих коммитов.

**Граница production evidence.** Исторический [CI baseline 5051def](https://github.com/passioncode-ai/fabric/actions/runs/34070268253)
прошёл fast и упал на P21 ACL: anon SELECT grants у estate_settings, proposals,
question_blocks, questions, routines, task_handoffs. Это расхождение grants, не
доказанная утечка строк через RLS. S02/S07 содержат отдельные grant + actual access tests.
Native Fabric, живые агенты, production DB и внешние effects этой итерацией не запускались.

## Ретро и что проверять оператору

- Вместо общего описания плана появились конкретные контракты и автономная выдача задания.
- Модель, визуализация, исходные receipts и проверки связаны, старые отчёты сохранены.
- Устранены противоречия continuation, grant release и restore, найденные на review.
- Проверить глазами TaskRun, manager switch, recovery и service feedback; сопоставить четыре графа с ожидаемой работой.
- Следующая реализация начинается с S02/S01/M198 и их реальных потребителей; предложенные ADR не объявлены принятыми.

«Правильно ли мы это запланировали, и правильно ли мы это делаем?» Конкретный выбор:
границы TaskRun, переключение manager через role slot и отдельная активация исходящей
отправки сервисных инсайтов.


---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — спецификации и независимый review
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — идентичности и циклы исполнения
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — границы harness и полномочий
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — версионированный контракт внешних агентов
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — lease и общие реестры
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — источники и воспроизводимые проверки
- [`ux-scenarios`](https://github.com/ssheleg/super-ux) — сценарии графов и переходов
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — читаемая визуализация системы
- `accessibility-review` — клавиатура и текстовое представление — not a skill this family ships
- `webapp-testing` — проверка интерактивного отчёта — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
