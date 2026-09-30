<sub>ssheleg skills — task-pipeline · super-ux · sheleg-design · copywriting · agent-sync · maintaining-fabric-workspace</sub>

# Fabric: простой чат и знакомство через первый проект

Дата: 2026-09-16. Source baseline: `1da45b6845b54f89e7969070676e46dec30370ac`. Scope: целевой интерактивный прототип, сценарии, руководство и контракт реализации. Native scan, модель, STT и долговечный backend не входят в эту дизайн-итерацию.

## Brief и порядок работы

Запрос владельца: постоянный чат справа, узнаваемый Fabric с понятным уровнем, управление проектами/задачами/доской/harness из разговора, минимум видимых элементов; постепенное знакомство при создании собственного проекта; интерактивный результат и читаемая помощь.

Источники: `docs/ux/vision.md`, SCN-031/042/044/059/093/094, FLW-18/24/32, ADR-0057, `docs/architecture/operator-interaction.md`, бренд-пак, предыдущая [R0 итерация](r0-ui.md). Два независимых статических прохода: CEO/capabilities и project/onboarding. Противоречия: старый чат является колонкой, каждый запрос создаёт тему; старый onboarding перегружен. Решение — shared handlers и новая постепенная оболочка; полномочия и Project как доменная единица сохраняются.

| Пакет | Что должно получиться | Проверка |
|---|---|---|
| CEO-01 | Панель всегда справа поверх экрана; один scroll, input внизу, Escape/focus; одинаковый аватар | Desktop/mobile геометрия и browser clicks |
| CEO-02 | Имя Fabric, состояние и отдельный уровень знакомства; переключение области | Scope/identity tests, A→B→A |
| CEO-03 | Каталог managerial intentions; чтение, задача, тема, config, cycle, harness и recovery | Реальные fixture adapters, exact IDs, отрицательные тесты |
| ONB-01 | Папка проектов / один проект / идея; просмотр найденного и честные ошибки | Scan states, duplicates, explicit selection |
| ONB-02 | Цель → агент → review → собственный проект; без обязательного провайдера | Same create path, scoped dedupe, unavailable-provider |
| ONB-03 | Fabric → первая Task → учебная тема Board → возврат; skip/resume | Собственный project/task ID, повтор без дубликатов |
| HELP-01 | Руководство с примерами и интерактивными переходами | Пример → чат/форма → результат |
| GRID-01 | Карта модулей и раскрытия для всех семейств экранов | Инвентаризация model.views, grid/state audit |
| SHIP-01 | Сценарии/модель/превью/вики согласованы, Git handoff | UX/docs/model/fast CI; source→workspace receipt |

Порядок: сценарии и контракты → общая панель/capability adapter → setup/guide → руководство и карта → browser/test/refine → публикация. Все этапы выполняются в рамках уже запрошенной автономной проработки; текущая модель и существующий visual pack сохранены. Это preview для изучения; Product/Coverage не повышаются по результатам макета.

## Принципы взаимодействия

Имя — **Fabric**. CEO объясняет его роль при знакомстве; это не второе имя. Цветной аватар один на всех экранах. «Уровень знакомства» отражает завершённые шаги пользователя, не интеллект модели, качество кода или уровень полномочий. Пропуск обучения не снижает функциональность.

Чат: заголовок/статус → разговор → контекст над вводом → поле и голос. Уточнение 2026-09-16: [composer и спокойный UI](calm-ui.md#fabric-контекст-рядом-с-вводом). Shortcuts нужны в пустом разговоре или в раскрываемом меню. Поиск и чтение не требуют подтверждения. Явно запрошенная обратимая задача записывается в выбранный проект; запуск исполнителя отделён от записи. Настройки создаются черновиком; внешние эффекты, расширение полномочий и запуск проходят существующие проверки. Неоднозначный адресат уточняется. Неизвестный исход сверяется тем же request ID.

## Знакомство

1. Выбрать источник: общая папка, один проект, идея. Сканирование не создаёт проекты.
2. Выбрать первый проект из прочитанного; дубликат ведёт к существующему. Остальные остаются кандидатами.
3. Задать название и первый полезный результат.
4. Выбрать кандидата-исполнителя либо отложить. Выбор не означает проверенный binding.
5. Проверить состав и создать один проект через общий create path.
6. Открыть Fabric в области этого проекта и получить контекст/следующий шаг.
7. Создать настоящую Task по своей цели; не запускать её автоматически.
8. Открыть учебную тему на своей доске. Закрытие подсказки не закрывает рабочую задачу.
9. Вернуться к проекту: что сохранено, что требует настройки, где продолжить. Пропустить/возобновить обучение можно независимо от работы.

## Контракт реализации и следующие пакеты

GuideRecord: estate_id, project_id/draft_id, guide_revision, entry_mode, step, completed/skipped, first_task_id, conversation_id, candidate_selection, updated_at. Identity = Estate + draft/project + guide revision. Бизнес-результат устанавливает command receipt, а не нажатие «Далее». ScanResult содержит canonical path, readable/denied/duplicate/nested status, observed_at и coverage; выбранные пути не становятся разрешением читать всё дерево или исполнять scripts.

Capability catalog: intent, read/write class, required scope, prerequisites, handler, fallback route. UI и Fabric используют один command adapter. Production: parse → resolve entities/ACL → plan → policy → execute command → receipt → projections → response. Chat не является единственным хранилищем истории. Alias/unknown/partial/retry сохраняют тот же command identity. Read operations могут работать при paused schedule; новые agent runs остаются на паузе.

Следующие инженерные пакеты: OX-05/D01 durable conversation/command journal; native folder discovery с cancellation/partial/dedupe; persisted GuideRecord; capability adapters к реальным handlers; OX-07 capture/STT; desktop accessibility и pilot. Их статус остаётся открытым в CO-166 и [OX-плане](../ux/plans/2026-09-15-r0-operator.md). Адаптер и контракт агента этой итерацией не меняются.

## Проверки и передача

Целевые проверки: 88 Node tests PASS, 0 FAIL; renderer проверяет 84×7 общих ветвей. Browser CUA: 84 ready + 504 дополнительных состояния на 1280×800, 84 ready на 390×844 — 0 пустых ready, 0 overflow, 0 console errors. Функционально пройдены собственный проект → Task → чтение через Fabric → ещё одна Task → отдельная учебная Board topic; overlay geometry, mobile dialog и Escape/focus. Это smoke всех экранов плюс адресная функциональная проверка изменённых путей, а не полная runtime приёмка каждого действия. `bash scripts/ci.sh fast` — exit 0, «fast tier green»; stack-backed full probes не запускались. `node scripts/build-mockup-previews.mjs --check` — PASS, 84 views pinned. `node scripts/check-design-map.mjs` — PASS, 1 572 source files / 269 anchors / 900 link targets. `git diff --check` — exit 0. Publication и fresh checkout проверяются после source commit; их идентичность хранится в publication receipt. Owning repository: passioncode-ai/fabric; branch codex/context-audit-2026-09-14. Entry для следующего агента — этот документ; publication identity — [receipt](../workspace-receipt.json). Не переносить демонстрационные результаты scan/voice/agent в runtime.

## Архитектура сверху вниз

| Слой | Ответственность | Граница |
|---|---|---|
| Shell | Одинаковый аватар, запуск панели, scope, focus/close | Не хранит предметную историю |
| Conversation | Реплики, исходный ввод, исправления, ссылки и receipt | Не заменяет Task/Board/Project |
| Intent router | Намерение, адресат, класс операции, уточнение | Preview использует явный каталог; production требует NLU и ACL resolution |
| Command adapter | Общая команда ручного UI и CEO, request ID, проверка состояния | Повтор не создаёт второй объект; агент не обходит admission |
| Domain | Project, Task, Board topic, configuration, cycle | Запись Task не является запуском; тема обучения не является Task |
| Projections | Обзор, доска, история, Live, доступные действия | Ответ строится по подтверждённому результату, со свежестью |
| Guided adoption | Шаги, receipts результатов, пропуск и возвращение | Обучение не выдаёт полномочия и не подменяет бизнес-результат |

Целевой runtime-конвейер: текст/голос → неизменяемая входная запись → resolve scope/entities → read или command plan → policy/admission → общий handler → journal receipt → проекции → компактный ответ. Неоднозначное имя уточняется до команды. Неизвестный исход остаётся pending до reconciliation. Голос хранит original/transcript revision/attribution отдельно; политика удержания аудио требует отдельной настройки, по умолчанию не предполагается вечный audio archive.

## Пакеты развития и критерии выхода

| Порядок | Пакет | Что передать следующему исполнителю | Приёмка |
|---|---|---|---|
| 1 | OX-05 + D01 | Message/Command/Receipt, Estate+Project scope, version fencing, outbox | Restart/retry сохраняют исходную реплику и один результат; ACL loss скрывает содержимое |
| 2 | Native discovery | Directory capability, cancellation, canonical-path dedupe, partial coverage | Нет исполнения найденных scripts; вложенные репозитории и symlink не дублируются; выбор не импортирует всё |
| 3 | Guided adoption | Versioned GuideRecord и receipts фактических шагов | Пропуск, возврат, новый проект, другое Estate, archive и upgrade не теряют работу |
| 4 | CEO manager adapters | Каталог намерений к существующим commands/read models | Контрактные проверки каждой capability, allowed/refused/unknown/retry; одинаковые права у UI и CEO |
| 5 | OX-07 voice | Capture → STT → review → message, original/revision, timestamps | Denied/device/silence/interrupted/timeout; нет отправки без действия пользователя |
| 6 | R0 acceptance | Desktop keyboard/screen reader, latency, сценарии с реальными проектами | Оператор находит следующий шаг; измерены context recovery time и лишние подтверждения |

Readiness — по возможности. Текстовый context/Task путь можно вводить раньше native discovery и voice. Полное управление через естественную речь требует capability adapters и evals; кликабельная ссылка в макете не является выполненной командой.

## Контракт компоновки

Основная оболочка: навигация и текущий scope → заголовок со статусом → главный объект/следующее действие → подробности по запросу. Desktop: 12 условных колонок; Home использует основную колонку Board→Projects и независимый Live, верх объединяет avatar/pulse/resume. Project: цель/статус, затем Board и агенты. Task: состояние и следующий допустимый переход перед источниками. Графы: полотно плюс адресная инспекция; история отделена от будущего плана. Формы: одна основная колонка, параметры и последствия до сохранения. Mobile: один поток; таблицы и графы имеют собственный scroll, чат — отдельный полноэкранный диалог.

Fabric справа поверх shell: 430px при достаточной ширине, 16px от краёв; до 600px — полноэкранный диалог. Чат не меняет ширину контентной сетки. История прокручивается отдельно, ввод остаётся доступным. Shortcuts сворачиваются после первого сообщения. Происхождение, проверки голоса и конфигурация находятся в disclosures. При высоте до 650px панель допускает общий scroll, чтобы контролы не оказались недоступными.

[Поэкранный инвентарь и матрица аудита](../ux/audits/2026-09-16-ceo-onboarding.md) связывают каждое представление с этим контрактом. [Руководство пользователя](fabric-guide.md) можно читать отдельно от инженерных пакетов.

[Инструменты и происхождение отчёта](ceo-onboarding-signature.md).

Точная следующая задача: реализовать OX-05/D01 durable Message→Command→Receipt для read-context и create-Task на одном реальном Project; использовать те же handlers, что ручной UI. Сначала прочитать этот entry, `docs/architecture/operator-interaction.md` и OX-пакеты; проверить актуальный domain/adapter contract и не переносить page-local fixtures в production. Требуются инициализированные submodules, текущая схема журнала и авторизованный provider только для последующих integration проверок.
