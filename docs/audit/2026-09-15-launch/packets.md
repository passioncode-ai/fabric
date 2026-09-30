# Пакеты первой поставки Fabric

Статус: программа проектирования и исполнения для review. Следующий исполнимый пакет — D01; implementation leaves ждут принятых входов. Общий контекст: [контракты C1–C6 и готовые производители](contracts.md), [архитектура и сценарии](README.md), [машинный граф](launch.json), [сохранённые источники](inventory.json). Это продолжение P01–P12, а не конкурирующая очередь доставки.

Каждый пакет наследует AGENTS, lease для guarded paths, проверки доказательств, документацию в той же итерации, source commit/push и отдельную публикацию. Чужие edits сохраняются. Поля JSON содержат точные context digests; refresh обязателен после predecessor, простая неизменность старого SHA не означает готовность.

## D01 — Подтвердить настоящий фундамент R1

**Владелец:** Delivery · **LR:** LR10 · **Входы:** исходная ревизия и запрос оператора · **Связь:** S01, S02, S03, S04, S06, S10, S12, S14, S15, M188, M152, M190

Сопоставить code/receipt/old-plan по каждому обязательному шву и принять минимальные контракты контекста/графа. Это следующий исполнимый пакет решения.

**Точные исходники/цели изменения:** [docs/architecture/system-contract.md](../../../docs/architecture/system-contract.md), [docs/architecture/engineering-specs.json](../../../docs/architecture/engineering-specs.json), [docs/evidence/backlog.md](../../../docs/evidence/backlog.md). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Прочитать CO-119/122/126/148/150/152/154/156 и current work rows.
2. Проследить task_runs admission→bind→end и answer→delivery→ack; исторические запреты отличить от нынешнего отсутствия.
3. Для каждого R1 действия записать существующий producer, reader, scope, revision, ref и измерительный пробел.
4. Зафиксировать поддерживаемые run/decision/context edges и boundary unknown; новые изменения вынести отдельными именованными leaves.

**Положительная приёмка:** Таблица R1-швов полностью покрыта; каждый пропуск либо уже механизм, либо конкретное изменение, либо activation blocker.

**Отрицательная приёмка:** Строка shipped без cross-seam proof не закрывает capability; missing producer не заменяется fixture.

**Выход:** readiness-and-contracts.md + принятый минимальный ReadContext/GraphExpansion mapping.

**Граница:** Не переизобретать journal и TaskRun. Не запускать live CEO, не сбрасывать рабочую БД.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## D02 — Согласовать сценарии и четыре поверхности

**Владелец:** Experience · **LR:** LR01, LR04, LR05, LR06, LR07 · **Входы:** D01 · **Связь:** V1-M1, V1-M6, V1-M7, T-01, T-02, P01, P03

Превратить принятую композицию и контекстные вопросы в согласованную UX-цепочку и target mockups.

**Точные исходники/цели изменения:** [docs/ux/scenarios.md](../../../docs/ux/scenarios.md), [docs/ux/flows.md](../../../docs/ux/flows.md), [docs/ux/screens.md](../../../docs/ux/screens.md), [docs/ux/product-model.json](../../../docs/ux/product-model.json), [scripts/product/workbench.mjs](../../../scripts/product/workbench.mjs). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Home: профиль→доска→проекты→лента; Project/Agent/Planning на одних данных.
2. Покрыть first visit, week return, missing/stale source, competing edit, keyboard back и absent provider.
3. Обновить journeys/model и затронутые renderers; запустить sync/build/check product model.
4. Сравнить 1280×720, узкий viewport, темы и reduced motion; явно оставить runtime coverage прежним.

**Положительная приёмка:** Все LR этой карточки трассируются к сценариям, переходам и кадрам; профиль ведёт Home, action Board достижим.

**Отрицательная приёмка:** Demo-граф или gradient preview не объявлен работающим графом/генератором.

**Выход:** reviewed-ux-chain + target mockup comparisons.

**Граница:** Не менять полномочия ради визуального сценария. Точный visual pass через sheleg-design; тексты через brand/copywriting.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## D03 — Принять модель повестки и настроек дома

**Владелец:** Attention · **LR:** LR02, LR03 · **Входы:** D01, D02 · **Связь:** P05, M120, M131, M151, M156

Выбрать durable source свободной темы, review-session metadata, pin/rank и статистические определения.

**Точные исходники/цели изменения:** [docs/architecture/board-and-ceo.md](../../../docs/architecture/board-and-ceo.md), [apps/desktop/src/shared/board.ts](../../../apps/desktop/src/shared/board.ts), [apps/desktop/src/shared/favourites.ts](../../../apps/desktop/src/shared/favourites.ts). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Предложение: свободная тема — типизированная Work-запись с source; Board query объединяет её с действующими обязательствами.
2. Повестка хранит membership/order/revisit и итоги; resolution по-прежнему живёт у исходной сущности.
3. Развести личный порядок проектов и business priority; задать revision/CAS и undo.
4. Записать формулу полезного дня/накопленных показателей, timezone, missed imports, source age. При новой семантике — новый ADR и migration gate.

**Положительная приёмка:** У каждой записи один owner; повторный разбор не теряет тему; известен контракт optimistic/conflict/save.

**Отрицательная приёмка:** Прочтение, snooze или перестановка не отменяют unresolved blocker; preview не даёт activity credit.

**Выход:** agenda-and-home-preferences contract + ADR при принятии.

**Граница:** Не заводить независимую копию задач; не применять числовые формулы до review и источников.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## D04 — Принять границу ограниченного Fabric-agent

**Владелец:** Agents · **LR:** LR09 · **Входы:** D01 · **Связь:** M166, M167, M168, M169, M171, M175, M176, M194, CO-158

Специфицировать один bounded manager profile для R1: чтение контекста и proposal через инструменты, без молчаливой широкой автономии.

**Точные исходники/цели изменения:** [docs/architecture/ceo-runtime.md](../../../docs/architecture/ceo-runtime.md), [docs/architecture/system-contract.md](../../../docs/architecture/system-contract.md), [apps/desktop/src/shared/managerEval.ts](../../../apps/desktop/src/shared/managerEval.ts). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Определить immutable scope, capabilities, input revision, allowed tools и profile revision.
2. Существующие checker/authority инструменты обязательны; max steps/time/budget и total retries на invocation.
3. Model unavailable оставляет deterministic view; исход предложения отдельно от commit/dispatch.
4. Записать corpus, planted counterexamples, остановку и дальнейшие prerequisites M194; если узкий срез небезопасен — назвать точный blocker R1.

**Положительная приёмка:** Названы точные command/tool contracts, persistence/trace и activation verdict; оператор может понять доступные действия.

**Отрицательная приёмка:** Prompt не расширяет права, stale scope и exhausted budget отказывают; нет доверия неподтверждённому tool result.

**Выход:** bounded-fabric-profile contract + принятое решение до L08.

**Граница:** Не включать автоматический settlement, расширенные права, remote manager или marketplace.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L01 — Собрать единый человеческий срез контекста

**Владелец:** Knowledge · **LR:** LR06 · **Входы:** D01, D02 · **Связь:** P02, T-04, M191, S14

Читать одну доказуемую границу estate/project/task-run с citations и historical context, сохранив model pack отдельно.

**Точные исходники/цели изменения:** [apps/desktop/src/main/contextPack.ts](../../../apps/desktop/src/main/contextPack.ts), [apps/desktop/src/main/digestRead.ts](../../../apps/desktop/src/main/digestRead.ts), [apps/desktop/src/shared/readEnvelope.ts](../../../apps/desktop/src/shared/readEnvelope.ts). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Переиспользовать readers и scoped store; собрать поля D01.
2. Отдельно передать исходный brief, действующие решения, текущее/будущее, included/omitted, age и observed/claimed.
3. Использовать payload watermark для shown data; проверить late A после переключения B.

**Положительная приёмка:** Два consumer читают одинаковые source refs/revision; partial источник не гасит остальные.

**Отрицательная приёмка:** Ошибка не даёт ноль; current preview не подменяет pack запуска; событие в ходе чтения остаётся непрочитанным.

**Выход:** typed read contract + cross-reader fixtures.

**Граница:** Не создавать вторую memory DB или обязательный LLM summary.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L02 — Сделать исторический источник и возврат точными

**Владелец:** Knowledge · **LR:** LR06 · **Входы:** L01 · **Связь:** P06, P08, CO-148, CO-149, CO-150, CO-152, CO-154, CO-155

Адресовать исходный brief, сохранённые версии/решения/пакет и сессию; открыть источник и вернуться к выбору.

**Точные исходники/цели изменения:** [apps/desktop/src/renderer/src/TaskPage.tsx](../../../apps/desktop/src/renderer/src/TaskPage.tsx), [apps/desktop/src/main/runLifecycle.ts](../../../apps/desktop/src/main/runLifecycle.ts), [apps/desktop/src/renderer/src/SessionWindow.tsx](../../../apps/desktop/src/renderer/src/SessionWindow.tsx). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Использовать task/run/session identity из D01; не восстанавливать неизвестную причину догадкой.
2. Сохранить исторические edits и ref revision по принятому контракту.
3. Подключить drilldown рядом с терминалом; navigation state не влияет на execution.

**Положительная приёмка:** Оператор видит исходную и изменённую задачу, прежние прогоны, выдачу pack и ответ; Back восстанавливает scope/selection.

**Отрицательная приёмка:** Concurrent brief edit даёт conflict; отсутствующий source отмечен; закрытие панели не останавливает агента.

**Выход:** исторический drilldown + возврат в IDE.

**Граница:** Не обещать доступ ко всем скрытым данным модели или native resume.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L03 — Собрать дом Fabric и упорядочиваемые проекты

**Владелец:** Experience · **LR:** LR01, LR03, LR04 · **Входы:** L01, D03 · **Связь:** P03, P04, M120, M131, V1-M6

Воплотить принятую композицию и единый образ Fabric, используя существующую ленту и реальные измерения.

**Точные исходники/цели изменения:** [apps/desktop/src/renderer/src/EstateHome.tsx](../../../apps/desktop/src/renderer/src/EstateHome.tsx), [apps/desktop/src/renderer/src/ProfileSection.tsx](../../../apps/desktop/src/renderer/src/ProfileSection.tsx), [apps/desktop/src/main/favourites.ts](../../../apps/desktop/src/main/favourites.ts). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Один avatar identity + fallback, сохранение и undo.
2. Сохранить избранные и добавить устойчивый order; предоставить move up/down.
3. Подключить Board preview, projects и feed; age/unknown при источниках.
4. Проверить профиль и first action на согласованных viewports.

**Положительная приёмка:** Главная узнаваема, проекты переставляются и сохраняются; событие ленты открывает контекст.

**Отрицательная приёмка:** Конфликт настроек не теряет выбор; сортировка не меняет authority/ранг blocker; отсутствие расхода не даёт $0.

**Выход:** Home + shared Fabric identity.

**Граница:** AI-генерация и богатые достижения отдельные расширения.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L04 — Замкнуть ежедневную доску

**Владелец:** Attention · **LR:** LR02 · **Входы:** L01, D03 · **Связь:** P05, P07, M151, M152, M185, V1-M2

Добавить agenda/capture/revisit поверх Work; один разговор об актуальном на Home и Project.

**Точные исходники/цели изменения:** [apps/desktop/src/shared/board.ts](../../../apps/desktop/src/shared/board.ts), [apps/desktop/src/renderer/src/BoardPanel.tsx](../../../apps/desktop/src/renderer/src/BoardPanel.tsx), [apps/desktop/src/shared/inbox.ts](../../../apps/desktop/src/shared/inbox.ts). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Реализовать source/metadata из D03 journal-first.
2. Сделать capture, add to agenda, resolve/delegate/revisit с receipts.
3. Ответ использовать существующий M152 путь; отдельно показывать commit/delivered/accepted/resumed.
4. Разобранное за прошлый визит доступно как итог, нерешённое остаётся.

**Положительная приёмка:** Два последовательных утренних разбора на вопросе, blocker, review и свободной теме воспроизводят историю.

**Отрицательная приёмка:** Retry не дублирует тему; read не закрывает; urgent arrival не подменяет карточку под кнопкой.

**Выход:** Board agenda + итог разбора.

**Граница:** Не создавать competing notification store; не менять системные веса без отдельной проверки.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L05 — Сделать циклы видимыми и управляемыми

**Владелец:** Cycles · **LR:** LR09 · **Входы:** L01, D02 · **Связь:** S15, M186, V1-M3, T-10, T-11, T-12

Показать cadence/last/next/health, включить безопасный повтор по существующему цикловому контракту.

**Точные исходники/цели изменения:** [apps/desktop/src/shared/cyclePort.ts](../../../apps/desktop/src/shared/cyclePort.ts), [apps/desktop/src/shared/cycleView.ts](../../../apps/desktop/src/shared/cycleView.ts), [apps/desktop/src/main/chainAdvance.ts](../../../apps/desktop/src/main/chainAdvance.ts). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Проследить invocation receipts от producer до view.
2. Настройка/пауза/следующее окно через доверенные commands; удержать concurrency/catch-up.
3. При unknown не повторять эффект; при app-off показать host gap с неопределённой причиной.
4. Проверить два окна и quota refusal на disposable harness.

**Положительная приёмка:** Два цикла имеют разные windows и версионированные результаты, next due объясним.

**Отрицательная приёмка:** Partial и unknown не превращаются в complete; восстановление не порождает второй запуск.

**Выход:** Cycles view + работающий повтор.

**Граница:** Не вводить круглосуточный daemon, fleet scheduler или автоматическую смену аккаунтов.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L06 — Пройти рабочий workflow и раннюю R0

**Владелец:** Work · **LR:** LR05, LR09 · **Входы:** L02, L03, L04, L05 · **Связь:** P06, P12, S08, V1-M1, V1-M4

Собрать один end-to-end путь цель→задача→план→исполнение→вопрос→решение→review→следующий проход.

**Точные исходники/цели изменения:** [apps/desktop/src/renderer/src/ProjectHome.tsx](../../../apps/desktop/src/renderer/src/ProjectHome.tsx), [apps/desktop/src/main/runLifecycle.ts](../../../apps/desktop/src/main/runLifecycle.ts), [apps/desktop/src/renderer/src/SessionWindow.tsx](../../../apps/desktop/src/renderer/src/SessionWindow.tsx). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Переиспользовать admission/ack/task state; добавить недостающие consumers, названные D01.
2. Сделать один преднастроенный workflow без нового competing state machine.
3. Проверить two-project переключение и новый TaskRun при итерации.
4. Описать R0 как доступную раннюю сборку без нового Fabric-agent; записать первое наблюдение ценности.

**Положительная приёмка:** Рабочий результат принят человеком/проверкой, сохранён, виден при повторном входе; есть следующий шаг.

**Отрицательная приёмка:** Exit 0 не означает verified task; stale answer, второй blocker и unknown delivery не запускают работу повторно.

**Выход:** R0 integration receipt + workflow template.

**Граница:** R0 не называется полной R1; общий workflow builder не требуется.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L07 — Построить раскрываемое планирование

**Владелец:** Planning · **LR:** LR07 · **Входы:** L02, D02 · **Связь:** P08, P09, M173, M190, V1-M7, CO-156

Отдельный Planning читает уровни portfolio/project/goal/task/run; видит блокеры и движение.

**Точные исходники/цели изменения:** [apps/desktop/src/shared/plan.ts](../../../apps/desktop/src/shared/plan.ts), [apps/desktop/src/shared/decisions.ts](../../../apps/desktop/src/shared/decisions.ts), [apps/desktop/src/renderer/src/PlanSection.tsx](../../../apps/desktop/src/renderer/src/PlanSection.tsx). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Реализовать GraphExpansion из D01 через existing refs, pagination и completeness.
2. Разделить DID и SHOULD routes; сохранять expanded set/selection/revision.
3. Рисовать typed dependencies, hidden cross-boundary edges и unknown counts.
4. Сделать доступный outline и keyboard expand, source drilldown, cycle refusal для изменений плана.

**Положительная приёмка:** Из проекта раскрывается цель→задача→прогон, одна cross-project связь открывает обе стороны без потери места.

**Отрицательная приёмка:** Spawned не blocker; недоступная нода не раскрывает чужие данные; truncated graph не изображает полный %.

**Выход:** Planning routes + hierarchy query.

**Граница:** Без новой graph DB, полного trace ingestion всех providers и generic canvas editor.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L08 — Включить ограниченный Fabric-agent

**Владелец:** Agents · **LR:** LR09 · **Входы:** D04, L01, L04, L06 · **Связь:** M166, M167, M168, M169, M171, M175, M176, M194

Ввести только принятое в D04 действие: sourced разбор по запросу, проверяемое предложение и trace.

**Точные исходники/цели изменения:** [apps/desktop/src/shared/managerEval.ts](../../../apps/desktop/src/shared/managerEval.ts), [apps/desktop/src/main/agentSurface.ts](../../../apps/desktop/src/main/agentSurface.ts). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Добавить profile/ModelPort adapter по решению D04.
2. Все tools проходят scoped gateway и validator; no-provider fallback детерминирован.
3. Сохранить invocation identity, call trace, usage unknown и total budgets.
4. Прогнать corpus и negative controls до activation, затем один согласованный реальный вызов.

**Положительная приёмка:** Fabric объясняет положение по sources и предлагает следующее действие; принятое предложение проходит штатную команду.

**Отрицательная приёмка:** Нет источника/полномочия/бюджета — нет commit; malformed tool result не проходит; отсутствие model видно.

**Выход:** bounded Fabric-agent + activation evidence.

**Граница:** Полный M194, широкое autonomous settlement и auto hiring остаются вне среза.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L09 — Проверить R1 целиком и повторный возврат

**Владелец:** Delivery · **LR:** LR10 · **Входы:** L06, L07, L08, L10, L11 · **Связь:** P12, V1-M5, T-19

Принять работу всей системы, а не сумму зелёных компонентных тестов.

**Точные исходники/цели изменения:** [docs/evidence/verification.md](../../../docs/evidence/verification.md), [docs/evidence/backlog.md](../../../docs/evidence/backlog.md). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Два проекта: утренний разбор→запуск→переключение→вопрос→ответ→проверка→повторный цикл.
2. Повторить после паузы/перезапуска; записать время до правильного решения, переходы и ошибки понимания.
3. Клавиатура, narrow viewport, увеличение текста и source failures отдельными наблюдениями.
4. В каждом LR сохранить outcome/source/build revision и остаток; разрешить релиз только при выбранном scope.

**Положительная приёмка:** Каждое LR подтверждено конкретным сценарием на идентифицированной сборке; все незавершённые идеи имеют homes.

**Отрицательная приёмка:** Макет/юнит-тест не заменяет live value; нет утверждения «за 10 секунд» без замера.

**Выход:** R1 acceptance ledger + следующий приоритет.

**Граница:** Не закрывать все legacy milestones из-за одной новой приёмки.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L10 — Сделать wiki входом в текущую работу

**Владелец:** Delivery · **LR:** LR08 · **Входы:** D01, D02 · **Связь:** P10, CO-162, CO-164, CO-165

Вывести current launch index, весь горизонт и историю из единого parent overlay; сохранить адреса.

**Точные исходники/цели изменения:** [docs/DOCMAP.md](../../../docs/DOCMAP.md), [workspace/lib/navigation.mjs](../../../workspace/lib/navigation.mjs), [workspace/lib/pages.mjs](../../../workspace/lib/pages.mjs). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Сопоставить каждый исходный документ с библиотекой/current home.
2. Добавить current pointer с revision/status; устаревшие планы открываются как история.
3. Host читает parent snapshot; проверить ссылки/фильтры/Back и current-vs-history.
4. После исправленных publication gates committed export→child verify→parent pin отдельным циклом.

**Положительная приёмка:** Cold reader находит текущий пакет, архитектуру и отложенную идею; все исходные paths доступны.

**Отрицательная приёмка:** Не копировать delivery state в host; не править workspace/content; stale publication не зовётся текущей.

**Выход:** wiki launch navigation + verified source/pin chain.

**Граница:** Parent и child коммитятся раздельно; существующие приватные границы сохраняются.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## L11 — Подготовить честный выпуск R1

**Владелец:** Delivery · **LR:** LR10 · **Входы:** D01 · **Связь:** P11, S07, CO-114, CO-115, CO-117, CO-124, CO-129

Закрыть фактические release blockers: проверенные CLI capabilities, CI scope, совместимость данных и поставляемые bytes.

**Точные исходники/цели изменения:** [scripts/ci.sh](../../../scripts/ci.sh), [docs/architecture/external-contracts.md](../../../docs/architecture/external-contracts.md), [.github/workflows/ci.yml](../../../.github/workflows/ci.yml). Новые файлы контрактов/fixtures создаются в модуле-владельце после решения, их адрес входит в актуализированный packet.

1. Переизмерить установленные CLI на безопасных probes перед обновлением матрицы.
2. Развести parent-only и child-initialized CI без потери проверки реальных missing symbols.
3. Проверить fresh/upgrade/restore для меняемых R1 миграций; фиксировать исключения.
4. Сформировать build/runtime/source receipt; не обходить красный gate публикации.

**Положительная приёмка:** Идентифицированная сборка проходит предусмотренные gates и читает прежние данные.

**Отрицательная приёмка:** Неверный symbol, чужой scope или неподдержанный capability остаются отказом; journal не чистится для зелёного теста.

**Выход:** release prerequisites receipt.

**Граница:** Нельзя произвольно обновить pin по номеру версии, force-push или выпускать пакет как часть планирования.

**Rollback:** Отменить только изменение пакета; сохранить journal и evidence. Миграции — совместимая компенсирующая миграция, не удаление истории.

## Совместные файлы и интеграция

Никакие два пакета ниже пока не названы parallel-ready. Общие файлы перечислены в `launch.json.resource_constraints`; на dispatch владелец интеграции ставит resource-order либо переносит assembly в один integration packet. Сначала готовый producer/contract, затем consumer; окончательная R1-приёмка зависит от их результатов, а не номеров в списке. Это честная граница планирования: ещё не принятые D-решения нельзя прятать внутри implementation task.

D01 обязан выдать обновлённый пакет для каждого consumer с подтверждённым source/context digest; D02 — сценарии и mockups; D03 — agenda/preferences; D04 — manager activation. До этого очередь является reviewable decomposition, но не разрешением на автоматическую рассылку всем исполнителям.
