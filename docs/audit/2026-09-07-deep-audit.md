<sub>ssheleg skills — project-audit · ux-audit · agent-orchestrator · agent-harness · sheleg-design · brand-voice · copywriting</sub>

# Fabric: глубокий аудит, стратегия продукта и план исправлений

> **Дополнение по последнему запросу:** рабочий маршрут теперь в [объединённом M-плане](2026-09-07-merged-execution-plan.md). Он сохраняет все M из вложения, раскрывает графы/прогоны/manager/ретро и учитывает подтверждённый бренд PassionCode.ai → Fabric. Этот документ сохраняется как исходный срез аудита и W-находок.

**Срез:** 7 сентября 2026, Europe/Warsaw. Репозиторий `.`, ветка `feat/brand-icon-and-intake`, commit `153b4f029e626230d465d5d21d02fb8c9de5fadf`. Это исследование текущего состояния и предложение следующего плана. Код приложения, принятые ADR и общий backlog не изменены. Отчёт и приложения — новые локальные файлы.

Полный [план W01–W31](2026-09-07-work-plan.md) и его [граф зависимостей](2026-09-07-work-plan.json), [проработка бренда](2026-09-07-brand-and-product.md), [машиночитаемый результат](2026-09-07-deep-audit.json), [доказательства и подробные разборы](2026-09-07-evidence/index.md).

## 1. Главный вывод

**Vision стоит сохранить. Текущий продукт нуждается прежде всего в восстановлении достоверности исполнения и пользовательской работы.** Проект уже содержит существенное ядро: журнал и проекции, задачи, память, контекстные пакеты, PTY-сессии, локальные инструменты агента, routines, policy и интерфейс проекта. Однако некоторые гарантии из vision пока выполняются только в отдельных модулях. Между модулями обнаружены разрывы: разрешение считается выполненным действием; тик видит чужой estate; следующее звено цепочки стартует повторно; интерфейс может потерять текст или показать неизвестное как пустое.

Это особенно важно для обещанного командного центра. Его ценность — дать человеку верное понимание, что произошло, кому нужно вмешаться и чему можно доверять. Если экран требует повторной проверки через терминалы, чаты и БД, он увеличивает работу оператора. Следующий приоритет — один полностью работающий цикл «наблюдение → задача → исполнение → независимая проверка → решение → следующее наблюдение».

**Не предлагаю переписывать приложение, заменять Postgres или строить собственный универсальный агентный runtime.** Модульный монолит соответствует текущему масштабу. Нужны строгие границы команд, области доступа, восстановления и чтения, а также несколько сквозных проверок на реальных компонентах. Стратегический актив Fabric — долговечная работа проекта, доказательства и совместная координация. Отдельные модели, терминалы и схемы prompt chaining должны оставаться заменяемыми.

Предложение соответствует `docs/ux/vision.md:12`, `:18`, `:32` и alignment test `:70`: укрепляет проект как единицу работы, сохраняет заменяемость агентов, делает полномочия явными и замыкает проверку результата. Брендовая иерархия меняется по запросу владельца; это отдельная семантическая поправка к ADR-0018, а не повод менять проектную модель.

## 2. Что реально проверено

| Объект | Результат этого аудита | Что результат не доказывает |
|---|---|---|
| Состав HEAD | 681 tracked file; 30 SQL migrations; 43 ADR. Число файлов независимо получено через `git ls-files` и `git ls-tree` | Построчный ручной аудит каждого файла не заявляется |
| Сценарии | Все 49 SCN распределены без пропусков по трём независимым партиям, затем сверены на общих швах | Запланированное отсутствие не считается регрессией выпуска; компонентная проверка не равна desktop E2E |
| Backlog | Все 196 M-строк инвентаризированы с исходной строкой и заявленным статусом | Статус shipped из документа не означает проверенную готовность |
| Штатная проверка | `bash scripts/ci.sh fast` — exit 0; `pnpm -r test` — exit 0; desktop Vitest: 48 файлов, 415 тестов | Нет проверки from-empty/upgrade migrations в этом запуске; полный `ci.sh` с применением миграций не запускался |
| Дополнительные пробы | Actual React App, Editor и ProjectHome с изолированными API; runtime probes с production modules и synthetic dependencies | Не измеряют частоту дефектов у пользователей |
| Память | Fixture: 6/6 с памятью, 0/6 без, 6/6 после rebuild | Это retrieval/replay проверка, не доказательство улучшения поведения живого агента |
| Соседний Agent Contract | `pnpm run check` — exit 0, 34 tests, docs/UX gates | Shape conformance не равно admission работающего провайдера |
| Соседний Agent Adapter | `pnpm test` — exit 0, validator и 8 unittest | Не проверялись заново npm tarball и все каналы дистрибуции adapter |
| Публичный сайт | Живой `passioncode.ai` проверен в browser, 1280×720 и 390×844 | Не проводились интервью, usability study или конверсионный эксперимент |

Инвентарь и результаты находятся в приложениях. Штатные тесты действительно прошли; дополнительные пробы действительно воспроизводят перечисленные ниже механизмы. Противоречия здесь нет: тест на чистую функцию состояния сохранения не проверяет жизненный цикл Monaco, а тест цепочки со stub запуска не проверяет, какую задачу создаёт production caller.

### Поставка, удалённый репозиторий и установленное приложение

На момент чтения GitHub Actions API возвращает `total_count=0`, список releases пуст. У текущего SHA нет удалённого commit; ветка не опубликована. Между `origin/main` (`a360b51778d6a80eb294a9a91dd4809fd4dfbff1`) и HEAD — 116 коммитов. Это не 116 дефектов; это отсутствие общей удалённой проверки большого накопленного изменения. Долю неуспешных релизов вычислить нельзя: знаменатель равен нулю. Основание — `gh api`, `gh run list`, `git ls-remote`, `git log`, сводка `production-summary.json`.

В `/Applications/PassionCode.app/Contents/Resources/app.asar` найден другой артефакт при той же версии `0.1.0`: установленная сборка использует `out/preload/index.mjs` и `sandbox:false`; текущие исходники после M196 используют bundled preload `.js` и `sandbox:true`. Хеши извлечённых файлов сохранены в `installed-artifact.json`. Поэтому проверка на установленной сборке не проверяет нынешний HEAD, а версия `0.1.0` не позволяет определить действующие гарантии.

### Данные и последствия

Принадлежность локального Supabase подтверждена собственными Docker labels: project `fabric`, workdir `.`; проверены контейнеры DB и API. Читались только агрегаты, без тел пользовательских записей. На финальном срезе fixture estate `…00ff`: 712 journal rows, 62 projects, 75 tasks, 24 enabled routines, 9 `effect.executed` events; свежая запись — **2026-09-06 22:17:10.52521 UTC**. Owner estate `…0001`: одна запись `estate.created`, свежесть **2026-09-06 21:46:24.060059 UTC**, ноль projects/tasks/routines/effect executions. Это приложенная локальная среда, не весь возможный пользовательский парк.

Штатные live-тесты создают fixture-данные в этой среде; её счётчики выросли во время проверки. Из-за найденного несоблюдения estate scope установленное desktop-приложение намеренно не запускалось: startup tick может увидеть включённые тестовые routines и запустить настоящего агента. Никакие реальные внешние эффекты аудит не выполнял. Этот разрыв также означает, что запуск тестов должен использовать изолированную БД или строго ограниченный namespace, который production scheduler не читает.

**Blind spots:** реальная частота потери текста/ложных статусов и иных инцидентов; готовность платить и повторное использование; живая совместная работа двух пользователей; native VoiceOver/клавиатурные маршруты; полный Electron E2E и пакетная установка; восстановление на новой БД; реальные внешние эффекты через enforcement; сравнение качества разных моделей. Для этих пунктов нет оценки «всё хорошо». Есть кодовые механизмы, воспроизведённые проверки и будущие acceptance gates.

Механический scanner дал 11 сырых срабатываний: десять credential-паттернов относятся к синтетическим test fixtures и их истории; один сравнивал приватный Fabric с одноимённым npm-пакетом Fabric.js. Они отклонены как ложные/неприменимые и не превращены в список уязвимостей. Harness scanner нашёл ноль agent-related files: его эвристика не распознала архитектуру, в которой Fabric управляет внешним CLI. Это ограничение инструмента. Реальный обход redaction найден отдельным dataflow-тестом.

## 3. Проблемы, которые определяют первый этап

Здесь «воспроизведено» означает наблюдение механизма в контролируемой пробе этого аудита. «Статический путь» — проверенная цепь definition → caller → persistence/renderer, без измеренного пользовательского инцидента. Подробные acceptance tests и исходные RT/UV/PLAN-записи сохранены в приложениях.

| Приоритет / источники | Проблема и следствие | Основание | Предложенное закрытие |
|---|---|---|---|
| P0 · UV-01 | После успешного `meta.info` Shell меняет число Hooks и падает. Общий путь недоступен раньше остальных экранов | `App.tsx:97`, `:247`, `:292`; actual mount воспроизведён | W01: стабильный порядок Hooks и root recovery; тест реально монтирует App |
| P1 · UV-02 | Save ответа пересоздаёт Monaco из отправленного текста; символы, введённые во время сохранения, исчезают | `EditorWindow.tsx:74`, `:99`, `:151`; проба `abc→ab` | W02: живая модель отдельно от saved baseline |
| P1 · PLAN-03 | TaskPage переиспользуется для другой task; uncontrolled textarea и поздняя загрузка допускают запись старого brief в новую задачу | `ProjectHome.tsx:249`, `TaskPage.tsx:46`, `:183`; статический путь | W03: ключ/состояние по taskId, поколение загрузки, адресованный save |
| P1 · PLAN-02 | Digest подтверждает непрочитанное при смене feedMark и даже ошибке чтения | `DigestSection.tsx:45`, `:53`, main `index.ts:1925`; статический путь | W04: ack только до показанного high-water |
| P1 · RT-01 | Scheduler и file roots читают чужой estate через service role; RLS не исправляет этот caller | `routineTick.ts:56`, `chainAdvance.ts:43`, main `index.ts:640`, `workspace.ts:26`; foreign routine воспроизведена | W06: ScopedStore и проверки составного владения на command boundary |
| P1 · RT-02 | Follower остаётся backlog, а каждый тик создаёт новую task/session; join запускается при одном готовом предшественнике | `chainAdvance.ts:68`, `:127`, main `index.ts:851`; две пробы воспроизведены | W09: start-existing-task, all-predecessors, atomic claim, idempotency |
| P1 · RT-03 | HTTP 200 с пустым quota payload читается как разрешение; chain проходит без quota gate | `quota.ts:181`, `quotaGate.ts:61`; `{}` разрешило запуск в пробе | W10/W09: unknown отдельно, ограничение по фактическому runner |
| P1 · RT-04 | `fabric_effect_request` записывает `effect.executed` до внешнего действия | `agentSurface.ts:1163`, `:1209`, `policy.ts:228`; статический путь | W08: различать разрешение, резервацию, выполнение, наблюдение и unknown |
| P1 · RT-05 | Одноразовый grant не привязан к project/action и расходуется неатомарно | `policy.ts:77`, `:130`, `:248`; два concurrent allow/receipt воспроизведены | W08: scope и atomic reservation/receipt command |
| P1 · RT-06 | why/target проходят в policy journal мимо redaction M195 | `agentSurface.ts:1190`, `policy.ts:163`; loopback MCP сохранил распознаваемый synthetic sentinel | W07: redaction всего agent-originated persistence boundary |
| P1 · PLAN-01 | Ответ на первый из двух вопросов разблокирует task, хотя второй открыт | migration `20260906000028_questions.sql:98`, `:124`; статический путь | W21: derived blocker set, scope links, оба порядка ответа/withdraw |
| P1 · PLAN-11 | Создание fact и отметка promoted/answered — разные append; crash/retry/concurrency могут оставить дублирующие решения | main `index.ts:1561`, questions migration `:120`; статический путь | W22: атомарный идемпотентный domain command |
| P2 · RT-10 | Cycle-check пропускает ошибку RPC и не сериализован с append | `agentSurface.ts:1112`, `:1121`; статический путь | W09: DAG admission внутри command transaction |
| P2 · RT-07 | Attention считает последние отказы вместо незакрытых обязательств; ошибка чтения похожа на отсутствие ожиданий | main `index.ts:1636`, `:1684`, `EstateHome.tsx:60` | W22/W17: unresolved projection, typed stale/error, idempotent decision |

Сокращённые renderer/main пути в этой таблице относятся к `apps/desktop/src/renderer/src/` и `apps/desktop/src/main/`. Полные file:line находятся в JSON и подробных разборах. P0/P1 задают порядок до следующего выпуска; они не являются оценкой наблюдаемого ущерба в production.

## 4. Архитектура: что оставить и где провести границы

### Существующая опора

Журнал как источник событий и перестраиваемые проекции — полезное основание для продукта, где важно объяснить состояние задним числом. Typed memory, current/superseded факты, контекстный lockfile и происхождение задач уже создают проектную непрерывность. Отдельные session credentials, server subset и очищенное окружение уменьшают случайное наследование доступа. ADR-0042 правильно отделяет статус, заявленный агентом, от наблюдения Fabric; ADR-0043 позволяет менять manager через binding. Основание: `packages/journal/src/index.ts:69`, migration write boundary `:103`, `contextPack.ts`, `sessionBundle.ts:80`, `agentSpec.ts:78`, ADR-0042/0043.

Слабость — в разных уровнях реализации этих правил. Например, journal append надёжен как примитив, но несколько append без общей идемпотентной команды не образуют атомарную бизнес-операцию. Redaction в одном классе не покрывает writer в зависимости. Schema floor для события не ограничивает произвольный subprocess с правами пользователя. Нужны проверки гарантий на месте фактического исполнения.

### Карта модулей

| Модуль / слой | Реальное состояние и основной разрыв | Следующий результат |
|---|---|---|
| Schema / projections | 30 migrations, planted tests; rebuild есть. `config_revision` исключён из parity test и меняется на replay — известный M198 | Полная воспроизводимость ревизии до pinned Run/context; не заводить дубль M198 |
| Journal | RPC writer и retry реализованы. Групповые domain-команды местами распались на отдельные события | Command id, atomic acceptance, causation/correlation, явный неизвестный исход внешнего действия |
| Policy / authority | Floor и grants есть; cooperative tool пока не доказывает enforcement; scope/атомарность/receipt неверны | Authorization service с exact scope и adapters для наблюдаемых effects |
| Work / Board / graph | Filing, assignment, lease, notes, links есть. Цепочка и цикл нарушают причинность; promote неатомарен | Work service: transition/start-existing-task/answer/promote под одной acceptance boundary |
| Routines / scheduling | Тик, backlog routine и блокировка по quota частично работают. Чужие estate, повторный запуск, unknown quota | Durable command identity, scoped eligibility, lease и recovery; ticks можно повторять безопасно |
| Runner / PTY / session | Claude Code подключён к Fabric; shell и Codex имеют разные возможности. PTY delivery использует эвристику readiness | Capability matrix; supported handshake либо честное «доставка не подтверждена»; повторное подключение не равно переносу сессии между vendors |
| Agent surface / MCP | Локальная аутентифицированная поверхность и 17 tools есть; generic invocation trace неполон | Versioned protocol/tool manifest, trace каждого outcome, sink redaction; северный API/admission не считать готовыми |
| Memory / context / transcript | Retrieval и replay проходят fixture. Превью, lineage и часть read-state UI не завершены | Inspect-pack без запуска, точные источники, read age, branch/subject guards, поведенческий eval |
| Questions / decisions | Вопросы и блокировки хранятся; полноценный answer→decision→continuation ещё не замкнут | M148 correction → M149/151/152, затем guarded settlement |
| Proposals / loop-bound | Ограниченная loop-bound proposal реализована; широкий cross-project intake отложен | Сохранить текущий предел, расширять после первого доказанного цикла |
| Connectors / external accounts | По module architecture это будущая граница slice 4 | Один реальный observer+effect adapter с receipts, затем generalisation |
| Workspace / files / Git | Mirror, file operations и repo readings есть; scope roots недостаточен; статусы должны хранить свежесть | Scoped path roots, явные source revisions, reconcile drift, независимость состояния UI от filesystem mirror |
| Main / IPC / preload | `index.ts` 2692 строки, agentSurface 1325; смешаны assembly, queries, commands, policy и UI DTO | M98 с application services, M109 с return types/runtime validation; извлечение по одному шву |
| Renderer / project shell | ProjectHome 1786 строк, несколько несогласованных локальных read models, root hook crash | W01–W05, единая навигация и ReadResult; затем реорганизация разделов |
| Design / i18n / components | Токены и библиотека есть; label registry, terminal/editor theme, nested controls расходятся | Исправление примитивов и семантики, затем композиция; не смена библиотеки |
| Distribution / operations | Локальный build проходит, установленный пакет отстаёт, remote CI evidence отсутствует | Provenance manifest, package smoke, clean-clone/upgrade gates, наблюдаемый release |
| Agent Contract | В sibling repository — спецификации/schemas/fixtures/validation, не host runtime | Не путать bundle conformance с negotiated protocol/admission/project binding |
| Agent Adapter | Portable skill/installer и scaffold; contract pin указан в README | Проверенный вход для провайдера после host boundary; не самостоятельный конкурент Fabric |

Эта таблица покрывает функциональные модули, а не приписывает каждому файлу отдельный архитектурный смысл. Пофайловый инвентарь, 12 runtime rows и UI coverage приложены. Крупный размер файла — сигнал сложности проверки, а не сам по себе дефект. Конкретное основание для extraction здесь — обход scope, смешение command/query и несогласованные состояния.

### Предлагаемая целевая граница

```text
Человек / UI                         Совместимый агент / manager binding
      │ typed queries + commands            │ versioned tools
      └──────────────────┬───────────────────┘
                  Application services
      Projects · Work · Authority · Knowledge · Execution
              │ command validation + exact scope
              │ atomic journal append / projections
              ▼
         Postgres: journal + rebuildable read models
              │ durable dispatch intention
              ▼
      Runner / connector adapters → process or external action
              │ observed receipt / heartbeat / independent probe
              └──────────────→ Work / evidence / attention

Safe diagnostic invocation trace: отдельный поток с теми же correlation ids.
Read models → UI: value + source + revision + readAt + fresh/stale/error.
```

Это направление рефакторинга, не обещание уже существующих services. Разворачивать каждую строку отдельным сервисом не нужно. Источником authority остаётся проверяемая команда, а не поля DTO, переданные renderer. Read-only probe, decision и external effect имеют разные гарантии; не объединять их флагом `done`.

## 5. Harness, который выигрывает от сильных агентов

**Устойчивость продукта — проверяемая гипотеза, не гарантия незаменимости.** Конкурировать только количеством одновременных агентов или центральным экраном недостаточно: Cursor документирует Cloud Agents с изолированной средой, multirepo и MCP, а GitHub объявил Agent HQ как управление разными агентами. Это смежные возможности, а не доказательство полной эквивалентности Fabric. [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent), [GitHub Agent HQ announcement](https://github.blog/news-insights/company-news/welcome-home-agents/) — прочитано 2026-09-07.

Предлагаемый фокус: Fabric хранит то, что нужно команде после завершения любого agent session. Почему работа началась; какое решение действовало; что агент знал; где он мог действовать; что изменилось; чем подтверждён результат; кто должен решить исключение; что проверять дальше. Улучшение модели повышает качество исполнения поверх этой основы и снижает стоимость результата, не обнуляя накопленную историю.

### Долговечные гарантии и заменяемая стратегия

| Остаётся в Fabric при любой модели | Меняется вместе с моделью и проверяется экспериментом |
|---|---|
| Project identity, scope, owners, принятие решений | Planner/decomposer prompt и глубина разбиения |
| Журнал, происхождение, актуальность знаний, export | Размер/форма context pack и retrieval strategy |
| Atomic commands, leases, recovery, authority ceiling | Частота self-check, critic, compaction, handoff |
| Независимое доказательство значимого результата | Распределение задачи между одним/несколькими агентами |
| Human attention queue и адресованные вопросы | Модель для rank/judgement, автоматическое settlement в допустимых рамках |
| Наблюдение исполнения, build/revision trace, budgets | Vendor adapter, SDK/CLI placement, model binding |

Такое разделение согласуется с практикой Anthropic: компоненты harness нужно повторно проверять по мере улучшения модели и убирать те, которые перестали помогать. Из их эксперимента не следует, что всем продуктам нужны три агента или фиксированные sprint loops. [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps). Раздельный жизненный цикл session, harness и execution environment также описан в [Managed Agents](https://www.anthropic.com/engineering/managed-agents). Для Fabric это аргумент за переносимый контракт, а не за копирование конкретного сервиса.

### Контракт запуска

Следовать ADR-0042: **Run — проекция пары task_id + session_id; новый независимый id/store не вводится.** Повторный запуск с новой session — новый Run, reconnect/resume той же session — тот же. На границе attach/start фиксируются доступные provider/model/harness versions, project config revision, context lockfile, policy/scope и входная задача. Неизвестные metadata явно unknown. M198 должен закрыться прежде, чем config_revision станет доказательством неизменности.

Заявленный агентом план и step statuses остаются claims. Fabric отдельно наблюдает, что процесс жив, lease действует, вопрос блокирует работу, изменение попало в Git, проверка завершилась. Возможная карточка: «Агент заявил: завершено; проверка: не выполнена; процесс: завершён; требуется: review». Это гораздо полезнее одного зелёного кружка.

### Контракт инструмента и эффекта

Каждый Fabric tool получает валидируемую schema, protocol revision, scope и request identity. Invocation trace фиксирует попытку и outcome, включая чтение, отказ и исключение. Raw secret и полный лишний payload не должны попадать в трассу. Domain journal остаётся журналом значимых состояний; технические traces связываются с ним, не подменяют его. Внутренние вызовы инструментов стороннего CLI известны только при реальном hook/adapter capture; нельзя заявлять полноту по терминальному transcript.

Внешний effect должен пройти distinct states: requested → authorized/reserved → dispatched → observed либо unknown/failed → reconciled. Grant ограничивает estate/project, action/resource, срок и число использований; rebind/повторный запуск не расширяет scope. Невозможно обещать exactly-once для произвольного внешнего API после network timeout: нужны idempotency key провайдера и reconciliation. Приложение обязано сохранять неизвестность исхода, пока её не разрешило наблюдение.

Текущая MCP specification latest разрешилась в `2026-07-28`; Agent Adapter уже указывает эту ревизию. Не обновлять pin «на всякий случай»: проверить фактическую negotiation и семантический профиль host/provider. MCP описывает protocol features и trust requirements, но сам не исполняет вашу политику доступа. [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28).

### Контекст и накопление пользы

Принятый факт, человеческое решение, гипотеза агента и stdout — разные типы знания. Pack должен выбирать актуальные данные с lineage и ограниченным бюджетом; вывод чужого агента не становится управляющей инструкцией. Decision subject, revision и supersession позволяют следующей модели продолжить с верной основы. Объяснимое preview «что агент получит и почему» полезнее непрозрачной кнопки «улучшить память».

Учиться следует на паре «ошибка → проверенное исправление», с областью применимости и возможностью отмены. Не превращать каждое удачное завершение в вечное правило. Локальное retro и eval должны работать без внешней отправки данных; M183 не является hard dependency для hygiene/retro.

### Обновление модели — обычная операция продукта

Предлагаемый корпус должен содержать короткую правку, долгую задачу, неполный контекст, противоречивое решение, отсутствующий server, вопрос человеку, отмену grant, недоступную БД, перезапуск, частичный внешний effect и ложный self-report. Для baseline/candidate использовать одинаковые задачи, ограничения и критерии приёмки; отдельно считать качество, стоимость принятого результата, время и человеческие вмешательства. Проверку оснований результата проводить независимо от исполнителя; модельный reviewer дополняет детерминированные probes там, где критерий требует суждения.

После каждого обновления провести ablation: убрать конкретную прослойку harness и проверить изменение результата. Если сильный агент уже справляется сам, уменьшаем prompting/оркестрацию. Если он теперь умеет больше, расширяем доступные задачи через проверенную capability и соответствующий scope. Canary/rollback меняют будущие bindings; история сохраняет, кто и с какой конфигурацией работал. Такой продукт может развиваться в синергии с моделями. Проверка этой гипотезы — меньше внимания человека при равной или лучшей доказанной надёжности.

## 6. UI, UX и визуальная система

### Исправить целостность рабочего пути

| Область | Выявлено | Предложение / проверка |
|---|---|---|
| Начало работы | Пустая Board скрывает единственную форму создания идеи; воспроизведено UV-03 | Форма/CTA доступны до первой строки; тест пустого проекта |
| Выбор агента | Registry знает Codex, но несколько экранов показывают его как Terminal; UV-04 | Один descriptor для имени, иконки и capabilities; «доступен» отдельно от «подключён к Fabric» |
| Переключение экранов | Estate Agents overlay остаётся после project / home / search / create; UV-06 | Один route state, адресуемый объект и явный возврат; не набор независимых booleans |
| Onboarding | Project и repos создаются отдельными append; поздний ответ Create после закрытия меняет состояние; UV-07 | Idempotent create command и recovery partial result; pending navigation не теряет результат |
| Асинхронное чтение | Transcript A может заменить B; соседние stores не инвалидируются; ошибки похожи на пустоту; UV-08/10/13, PLAN-09 | Scope+generation+readAt; независимые error states; локальная свежесть каждого источника |
| Evidence / поиск | Feed/source_ref не открывает предмет, search ведёт только в project, заявлены пять групп при трёх; UV-09, PLAN-05/06 | Typed evidence target и общий resolver с expand/focus/back; paging/count и имена проверенных stores |
| Наблюдение агента | История выбирается по неполному correlation; UI не обновляет её полноценно; PLAN-09/SCN-049 | Session/task link и actor events, pagination, freshness; терминал вторым уровнем |
| Запуск / повтор | Readiness по тишине/deadline; reuse отсутствует в доступном пути; UV-11/12 | Подтверждённая доставка либо явная неопределённость; достижимый reuse с правилом совместимости |
| Favourites / goals | Можно сохранить семь pins вместо cap пять; все done tasks дают вид «нет декомпозиции»; PLAN-04/08 | Проверять cap на записи; goal считает full population и показывает done/total |
| Harness | projectId в reader не используется; глобальный список выдаётся за проектный; PLAN-07 | Project-specific roster, requested/effective servers, grant/read errors, required capabilities |

### Информационная архитектура

Предлагаемый первый уровень проекта — **Обзор, Работа, Запуски, Решения и память, Команда и доступ**. Это гипотеза структуры для проверки по SCN, не уже утверждённая замена всех SCR. Главная страница отвечает: что изменилось, какое решение требуется, какая работа идёт, что проверено, где данные устарели. Детали store, protocol и tool schema раскрываются из соответствующего предмета.

Board хранит намерения и текущую работу; Runs показывают исполнения; history показывает наблюдаемое прошлое; plan — объявленное будущее. DID и SHOULD остаются отдельными экранами по ADR-0042. Граф не должен быть предварительным условием понять проект: число/короткая сводка плюс переход к полному графу соответствуют ADR-0041. M191 pack preview и lineage можно делать независимо от большого графического экрана.

Командность проверяется конкретно: второй человек открывает чужую задачу, понимает последнее решение и границы, отвечает на адресованный вопрос и видит продолжение. Для ACL достаточно двух synthetic principals; для продуктового вывода нужен реальный второй участник. Полная оргструктура, делегированные роли всех типов и marketplace не нужны до этого результата.

### Визуальная правка

Существующие brand assets, passion-fruit знак и Paperclip tokens можно сохранить. Главные визуальные дефекты имеют технические причины: nested button в agent tile (UV-05); нечёткая связь label/hint и controls (UV-15); единая тема не доходит до terminal/editor (UV-14); warning hue используется как текст важного stale warning, а muted text недостаточно контрастен на части светлых поверхностей (UV-16); `.widget.span-2` не совпадает с реальным `.panel`, Board фиксирует четыре колонки (UV-17). Эти проблемы закрываются в компонентах и семантических токенах. В этом запуске заново вычислен контраст указанных непрозрачных пар: `#737373` / `#f5f5f5` — 4.349:1, `#0a0a0a` / `#1f1d1a` — 1.177:1; [расчёт](2026-09-07-evidence/contrast-recomputed.json) не заменяет проверку фактической композиции и всех syntax tokens в приложении.

Принципы следующего макета: нейтральная спокойная поверхность, один главный акцент, состояния подписаны словами, focus виден, плотность не отменяет читабельность. Light/dark, keyboard, 200% zoom, узкое окно, пустота, ошибка и длинное имя — состояния одного компонента. Нативные keyboard/VoiceOver и zoom ещё не проверены: это обязательные acceptance scenarios, а не готовый accessibility сертификат.

На живом сайте при 1280×720 hero CTA измерен y=719.4…769.4: почти весь ниже первого экрана, хотя верхний GitHub доступен. При 390×844 CTA виден и body width равен viewport width. Это конкретная композиционная правка, не повод объявлять весь сайт неработающим. Сайт честно помечает private repos и development status; следующая версия должна объяснить продукт через реальный рабочий цикл, а техническую карту репозиториев оставить дополнительной.

## 7. Бренд: PassionCode.ai → Fabric

**Предлагаемая система:** PassionCode.ai — главный бренд; Fabric — продукт; рабочая среда, IDE и командный центр — его режимы. Agent Contract и Agent Adapter — технические компоненты совместимости. Новые самостоятельные продукты могут появляться под главным брендом, когда у них будет отдельная задача.

Первое знакомство: **Fabric by PassionCode.ai**. Название приложения: **Fabric**. Категория: **«Рабочая среда для проектов, людей и агентов»**. Основное обещание: сохранить задачи, решения, границы и проверенные результаты при смене людей, моделей и инструментов. Формулировка — предложение для проверки, не заявление о полной текущей реализации.

Написание подтверждено владельцем: PassionCode.ai — главный бренд, Fabric — продукт. Неоднозначность написания снята; каноническую семантику ролей бренда нужно обновить согласованно. Домен и технические namespace можно сохранить. Нельзя просто заменить заголовок: ADR-0018, CONTEXT, brand channels/terminology, narrative gate и сайт пока защищают старую формулу «PassionCode — продукт, Fabric — ядро». Нужна новая ADR с точным supersession и согласованное обновление копий. [Полная проработка](2026-09-07-brand-and-product.md) содержит позиционирование, RU/EN copy, визуальные регистры, CTA и propagation map.

## 8. Что изменить в существующем плане

Механическая инвентаризация M-строк: 65 помечены shipped, 7 partial, 105 proposed, 8 decided/unscheduled, 1 scheduled, 9 open, 1 in review. Это **заявления документа**, не процент готовности. Сумма равна 196; таблица каждой строки с исходным line и нормализованным claim приложена. Некоторые прежние M поглощены последующими, поэтому считать их как независимые deliverables неправильно.

| Разрыв плана | Коррекция |
|---|---|
| Старые работы уже выполнены или поглощены | M97/M196/M197 не планировать повторно; M53/M54/M79 сверять с поглотившим M122; M195 уточнить обходом, не обнулить сделанное |
| Архитектура Run в старом module doc конфликтует с ADR-0042 | Каноничен Run=session+task; пометить прежний NodeResult/SDK design как historical/proposed, не строить второй store |
| Ревизия пока не replay-stable | M198 — prerequisite pinned execution snapshot; убрать исключение P24 после исправления |
| Brief содержит отсутствующие producer/schema | M152: `memory.project.recorded@1`, а `fact.about` — явное добавление; M157: зарегистрировать `question.settled@1` либо согласованно использовать answered; M179: `session.oriented@1` |
| M176 предполагает полную трассу вызовов | Сначала scoped/versioned invocation trace, затем trajectory corpus/eval; `surfaceTools.recordsEvent` не trace полноты |
| M194 зависит только от части вопросного цикла | Входы: deterministic core/checker, floor/trust, manager pack, heartbeat/watch, protocol и trajectory eval; второй runner можно сделать раньше manager |
| Автоматическое settlement опережает защиту | M157 и M158 активируются вместе с критичностью и schema floor либо после них |
| Зависимости путают потребность и очередность | У каждой стрелки тип hard/review-order/policy-order/optional и входной артефакт; M153 не ждёт внешнего export M183; M191 не ждёт все graphs |
| Документы частично расходятся с собой | Нормализованный register с absorbed_by/superseded_by, SHA evidence, acceptance state; производные slice/status/screens сверяются автоматически |

В README остаются утверждения про объём backlog и пустой verification (`README.md:94`, `:96`), уже не описывающие текущий проект. Старые module paths `packages/policy/work/runner/memory` — архитектурный замысел, тогда как текущие реализации в main. Agent system map утверждает полную запись tool calls; manifest содержит 17 tools, 13 flags true и 4 false, причём и flag true не означает каждую invocation. Это существенный drift: агент может построить следующую работу на ложной предпосылке при зелёном markdown lint.

Проверка документации должна разрешать **символы, события, поля, типы и принятые решения**, а не только наличие файлов и синтаксис таблиц. ADR не переписываются задним числом. Canonical current / implemented / proposed / superseded явно размечаются. Полезен generated as-built manifest, но автоматизация не должна объявлять способность готовой только по наличию handler.

## 9. Новый порядок работы и границы готовности

Полная таблица W01–W31 содержит scope, зависимости и проверку каждого результата. Независимый повторный review плана обнаружил и помог устранить риск второго Run store, пропущенный M198, скрытый цикл manager/core и выпуск unattended без enforcement. Это проверка согласованности плана; сами будущие изменения ещё не реализованы.

| Очередь | Результат | Gate |
|---|---|---|
| W01–W05 | Приложение открывается, сохраняет ввод и не теряет предмет навигации | Root mount и репродукции потери данных проходят исправленный путь |
| W06–W11 | Scope, chain, quota и полномочия удерживаются на execution boundary | Concurrent/foreign/unknown/retry probes; разрешение не равно выполнению |
| W12–W14 | Воспроизводимая поставка и правдивая картина текущей версии | Remote CI на известном SHA, isolated migration checks, package provenance |
| W15–W20 | Проверяемые module seams, typed reads, Run, recovery и trace | Fault injection, replay parity, scoped IPC, complete Fabric invocation outcomes |
| W21–W24 | Вопрос человеку превращается в устойчивое решение и продолжение | Multi-blocker, atomic answer/promote, crash/retry, floor/citation tests |
| W25–W27 | Первый замкнутый рабочий продукт | Один реальный observer доводит поломку до независимой проверки исправления |
| W28–W30 | Команда и смена агента дают дополнительную пользу | Два principal, второй runtime, model comparison и rollback |
| W31 | Одна понятная иерархия бренда | Согласованные названия и обещания, соответствующие выпуску |

Работы внутри первой очереди независимы; документацию/PR можно готовить одновременно. M98 не должен превратиться в паузу на большой rewrite: extraction проводится вокруг конкретного сломанного шва. Публичный marketplace, Telegram, сложные provider views и расширенный собственный CEO остаются в горизонте после доказанного core loop. Это изменение последовательности, не молчаливое удаление требований. Подготовленные W-строки — предложения для intake; M/CO IDs не резервировались и общие registries не редактировались.

### Как проверять пользу

Собрать baseline до оптимизации: время до первого проверенного результата; минуты внимания человека на принятый результат; доля ложных «успехов»; время обнаружения и восстановления; полнота request→Run→receipt→verification; время погружения второго участника; стоимость и задержка при одинаковом quality corpus. Все эти показатели сейчас **не измерены** в реальном использовании.

Хороший следующий демонстрационный сценарий: импортировать небольшой действующий repo, подключить проверенного агента, создать контролируемый failing probe, получить задачу с доказательством, запросить необходимое решение, выполнить правку, проверить её отдельным probe и вернуться на следующий день к точному digest. Затем повторить с другим runtime и вторым человеком. Этот сценарий одновременно проверяет vision, architecture, UX и стратегию заменяемости.

## 10. Материалы и метод

Отдельно доступны [runtime и полномочия](2026-09-07-evidence/runtime.md), [UI/UX и визуальная часть](2026-09-07-evidence/ux.md), [план и operating surfaces](2026-09-07-evidence/operating-plan.md), [все 49 сценариев](2026-09-07-evidence/scenarios.md), [все 196 M-строк](2026-09-07-evidence/milestones.md). Оригинальные 43 локальные записи имеют пересечения; это не число уникальных уязвимостей. Их связи и evidence сохранены в sidecar, а очереди W объединяют исправления по результату.

Применён маршрут из `AGENTS.md` и `docs/AGENT_SYNC.md`; toolbox измерен командой `npx sshlg-skills toolkit --for …` — 527 reachable skills. Design pack измерен отдельно. `project-audit` организовал discovery/probes/production/seams; `ux-audit` — сверку SCN и независимые партии; `agent-orchestrator` и `agent-harness` — границы исполнения и развитие harness; `sheleg-design` — токены/композицию; `brand-voice` и `copywriting` — иерархию и предлагаемые формулировки. Skill construction, backend wiring и pipeline implementation не выполнялись. Отсутствующие optional design tools не устанавливались.

Полные чтения skills и исходные partial reports сохранены как указатели в evidence index. Отчёт использует только агрегаты и исходные file:line; credentials и raw тела продуктовых событий в него не включены. Временные тестовые логи остались в `/tmp`, их результаты вынесены в безопасные summaries. Источники рекомендаций — первичные инженерные публикации, прочитанные в этом запуске; вывод о стратегии Fabric является нашей интерпретацией, подлежащей продуктовой проверке.

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
