# Fabric · память проекта и продолжение работы

<sub>ssheleg skills — task-pipeline · agent-orchestrator · super-ux · sheleg-design · copywriting · evidence-docs · agent-sync · maintaining-fabric-workspace</sub>

Статус: архитектурный проект и интерактивный целевой макет, 2026-09-26. Нативная реализация частичная. [Макет](../../reports/product.html#view-r0-memory) · [Архитектура](../../architecture/project-memory.md) · [Пакеты реализации](plan.md) · [Основания](evidence.md).

## Зачем

Вернуться в проект, понять, что уже решено, найти точный фрагмент чужой сессии и продолжить работу без ручного пересказа. Память принадлежит Project; Provider и Session заменяемы. Fabric помогает найти и объяснить; записи, права, отбор и доставка контролируются системой.

## Что проектируем

| Запрос | Результат | Проверка |
|---|---|---|
| MEM-01 Память между сессиями | Источники, факты, резюме и переданный контекст с разными правилами | Архитектура: модель и жизненный цикл |
| MEM-02 Найти работу другого агента | Поиск → фрагмент → события вокруг → адресная ссылка | Макет и negative cases в плане |
| MEM-03 Продолжить другим исполнителем | Остановка → свежая рабочая копия → пакет → новый Run → ACK | MEM-P5; не объявляется нативно готовым |
| MEM-04 Понятный UI | Память из проекта/главной/работы; список, источник, выбор для разговора | SCN-057, FLW-31, SCR-34; браузерный проход |
| MEM-05 План без догадок | Владельцы модулей, зависимости, контракты, запреты и приёмка | MEM-P0…P7 |

Основания маршрута: `AGENTS.md`, `docs/AGENT_SYNC.md`, `docs/ux/vision.md`, workspace skill. Используются task-pipeline, agent-orchestrator, super-ux, sheleg-design, copywriting, evidence-docs, agent-sync, maintaining-fabric-workspace. Текущая модель/ветка сохраняются; отдельный Figma-файл не создаётся. Проектирование идёт в существующих runtime-компонентах Paperclip. ADR-0070 задаёт общую PassionCode design system; миграция текущего Fabric UI остаётся CO-169 и не заявляется выполненной этой памятью. Локальные браузерные проверки не являются WCAG-сертификацией.

## Первый полезный цикл

1. Подключить исполнителя и выбрать папку привычным R0 flow. Никакой настройки vector DB.
2. Fabric показывает обзор с источниками; принятые решения остаются в Project.
3. После работы пользователь возвращается: «Где остановились» показывает последний подтверждённый шаг и пробелы захвата.
4. «Почему выбрали это?» — Fabric ищет историю и отвечает со ссылками. Клик раскрывает исходный фрагмент.
5. «Продолжи с Codex» — Fabric готовит перенос. Пока прежний процесс не остановлен и новый исполнитель не готов, запуск удержан.
6. Память раскрывается по потребности: сессия → источник → состав пакета. На главной нет ленты всех воспоминаний.

## Компоновка

Home сохраняет Доску, Проекты и Агентов. Память — вторичный вход, а важное появляется в «Где остановились». В Project доступен вход «Память». В Work рядом с контекстом — история задачи и точный пакет.

Экран памяти: заголовок и видимая область поиска; чипы проектов; поле поиска; короткие фильтры «Всё / Сессии / Решения». Основная колонка — найденные записи (задача, исполнитель, статус/покрытие), правая — выбранный источник. Никакого обязательного раскрытия каждой строки. На узком экране источник идёт следом за списком. Статистика служебная и компактная; большие показатели числа токенов не подменяют пользу.

У источника: краткое содержание → атрибуция и происхождение → фрагмент → соседние события → исходный Run. «В разговор с Fabric» добавляет адресный контекст; не запускает задачу. «Открыть работу» ведёт к точному Run. Уже переданный пакет и будущий отбор показаны раздельно.

Состояния: загрузка, пустая история, нет совпадений, частично прочитано, устаревший индекс, недоступный источник, нет доступа, конфликт утверждений. Состояния не сводятся к нулю. Просмотр сессии не меняет исполнителя и не запускает процесс.

## Что переносим из Claude-Mem

Из [официальной архитектуры](https://docs.claude-mem.ai/architecture/overview) и [поиска](https://docs.claude-mem.ai/architecture/search-architecture), прочитанных 2026-09-26: lifecycle capture, видимый поток памяти, фильтр проекта, постепенный поиск «список → соседние события → подробности». Это референс взаимодействия. Fabric сохраняет свой журнал, PostgreSQL FTS и контракты. Не устанавливаем Claude-Mem и не заводим его SQLite/Chroma рядом как второй источник истины. Заявления референса об экономии токенов не принимаются за измерения Fabric.

## Передача следующему агенту

Начать с **MEM-P0** в [плане](plan.md): проверить текущие producers на синтетическом корпусе, зафиксировать реальное покрытие и точный baseline. Затем MEM-P1 устраняет пробелы захвата и редактирования секретов. Не начинать с embeddings, фоновой суммаризации или переписывания dashboard. Общий контекст — [архитектура](../../architecture/project-memory.md), ADR-0032/0067/0069, FR-E и CW-N1; все зависимости перечислены в пакетах. Это расширение CO-168, а не закрытие его нативной части.

## Проверки итерации

Проверки источников: независимое ревью memory_arch_review, исправлены девять замечаний и регресс статуса принятого результата. Дополнительно отказ неизвестного Project покрыт отдельным тестом. `node --test scripts/test/memory-workspace.test.mjs`: **14 passed**, без skips. Расширенная матрица до дополнительного identity-case: **268 passed**; итоговую матрицу выполняет fast gate. `python3 docs/ux/lint.py`: 0 errors, 1 inherited U077 warning. `git diff --check`: exit 0.

Браузер: Home → все проекты → поиск «оплату» → Codex session-15/run-14 → сохранённый контекст → source attachment в чат → точная работа orbit. Проверены 1240×820 и 390×844; на узком экране scrollWidth=innerWidth=390. [Снимки и hashes](../../reports/previews/memory-captures.json); [desktop](../../reports/previews/memory-desktop.png), [чат](../../reports/previews/memory-chat.png), [узкий экран](../../reports/previews/memory-mobile.png). Все 98 route thumbnails пересняты с финального product artifact; это обновление галереи, не 98 полных UX-аудитов.

Первый broad check выявил отсутствующий новый view в adoption inventory; запись и числовое ожидание обновлены, отрицательные проверки сохранены. Первый fast остановился на stale generated system map после изменения контракта; системная карта пересобрана. Следующий fast выявил пропуск `r0-memory` в общем calm-каталоге: экран добавлен в семейство источников, проверка nav/atlas сохранена и проходит. Исправлены метаданные новой записи changelog. Последняя регрессия требовала local max ADR + 1 и не учитывала параллельно выданные ADR-0070/0071. Глобальный allocator выдал 0072 для неисполненной pipeline-резервации; в контракте сохранены SHA выдачи каждого пропуска. Проверка по-прежнему запрещает необъяснённые пропуски и существующие файлы. Эти исходные ошибки не объявляются passing runs.

Доставка: source branch `codex/context-audit-2026-09-14`, remote `git@github.com:passioncode-ai/fabric.git`. Source commit будет связан с workspace через `docs/workspace-receipt.json`; entry point — этот документ. Нативные файлы памяти в этой итерации не менялись. `VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` завершился exit 0 (`fast tier green`, 2026-09-26): 121 desktop test files / 1362 tests passed, 98 preview pins passed, documentation/register and audit regression gates passed. После этого добавлена только эта квитанция и обновлён stamp; publisher повторно проверяет точный source commit. Три отрицательные пробы правила ADR (нет receipt пропуска, невыданный скачок, занятый ID) отклонены. Publication receipt создаётся только после проверки опубликованной версии; его наличие и связь проверяются `node scripts/workspace.mjs check --require-child`. Существующий reconcile backlog (26 ADR/112 CO плюс pre-baseline) сохраняется; новая ADR-0069 получает отдельную as-built запись target work, не native implementation. Нативные интеграционные проверки памяти требуют отдельного локального Supabase и исполнителей; макет их не заменяет.

При публикации обнаружена уже выпущенная workspace-версия из toolkit-ветки `820ee2538007c78f9e3467bee381a7d62ce5553a`. Ветка включена в текущую с сохранением ADR-0070, CO-169, обеих историй карты и бренд-направления; runtime и макеты toolkit-итерация не меняла. Это интеграция рабочих веток, не merge в main. Снимок публикуется из общего source commit, который указан в receipt.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — scope and delivery
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — memory architecture
- [`super-ux`](https://github.com/ssheleg/super-ux) — scenarios and flows
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — memory workspace hierarchy
- [`copywriting`](https://github.com/ssheleg/super-ux) — source labels
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — native evidence
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — lease and ADR
- `maintaining-fabric-workspace` — publication — not a skill this family ships
