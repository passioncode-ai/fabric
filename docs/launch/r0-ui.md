<sub>ssheleg skills — task-pipeline · ux-scenarios · ux-audit · sheleg-design · copywriting · agent-sync · maintaining-fabric-workspace</sub>

# Fabric R0: связный интерфейс и компактная главная

Дата: 2026-09-16. Объём: целевой интерактивный прототип и его каноническая UX-цепочка. Это не выпуск desktop runtime. [Главная](../reports/product.html#view-launch-home) · [Карта экранов](../reports/product.html#view-launch-map) · [Проверка всех возможностей](../ux/audits/2026-09-16-r0-ui.md).

## Что принято в этой итерации

Сверху слева — цветной Fabric, ритм и короткий статус; справа — компактное «Где остановились». Ниже две независимые колонки: доска → проекты и Live → будущие дополнительные секции. Высота доски больше не создаёт промежуток между секциями справа. Возврат следует последнему открытому проекту. В узком виде DOM-порядок: профиль/ритм → возврат → доска → проекты → Live.

Ритм показывает значения дня при hover/focus. Один вход Tab, стрелки/Home/End выбирают день, Enter открывает его события. Зелёная точка Live показывает свежий просмотр; пауза или неизвестная свежесть делают её статичной. При reduced motion пульсация выключается. Цвет поддерживает текст состояния. Используются существующие Paperclip/app tokens и фиолетовая палитра персонального Fabric.

## Связные пути

| Задача оператора | Путь и результат в макете |
|---|---|
| Начать новый проект | Home → +Проект → цель/начальная конфигурация → preview → подтвердить → собственный project ID → Home → этот же проект |
| Вернуться к работе | Home → компактный возврат → цель, последнее наблюдение, решения и следующий шаг → подробности агента |
| Решить вопрос | Board → точный вопрос; исходные obligations сохраняют свой destination/handler. Контекстный CTX-Q-12 не равен staging Q-12 |
| Принять или вернуть результат | Точная карточка → итог/замечание → вердикт и запись в журнале. Получение решения агентом отдельно от его записи |
| Прочитать прошлый запуск | Агент → история → run1 → его статус/пакет/консоль; текущий run2 открывается явно |
| Поручить через Fabric | Текст/голосовой пример → редактируемый текст → отправить → назначить проект/задачу → квитанция → точная Board-тема |
| Найти основание | Board → исходная реплика; ID/time/input/original/revision/origin сохранены в журнале примера. Связь с задачей уточняется отдельной записью, не переписыванием реплики |
| Настроить агента | Fabric → «Создать агента» → scoped draft → та же ручная форма → сохранить → отдельная проверка и допуск. Каталог исполнителей раскрывается после основной формы |
| Настроить цикл | Fabric → «Настроить цикл» → paused draft → расписание/границы/причина → preview → версия → включить → результат → пауза. Повторное окно возвращает прежнюю квитанцию |
| Продолжить при сбое | Partial/conflict: чтение и черновик доступны, запись удержана. Denied: содержимое скрыто. Voice errors: черновик остаётся, доступен текст. Отказ сохранения не превращается в «Записано» |

## Механика и архитектурные границы

Расширены существующие модули; второй runtime или task store не создан. `syncLaunchWorkspace` читает разрешённый реестр проектов и `readObligations`, сохраняя точные ссылки на исходные handlers. Launch-only records имеют отдельный CTX namespace, потому что старый AT-42/Q-12 описывает приглашения и staging. Эти учебные предметные области нельзя склеивать одинаковой строкой ID.

Conversation key = Estate + Project либо Estate intake. Origin сообщения неизменяем; destination предложения задаётся отдельно. Сообщение имеет ID/time/input/original/revision. Callback возвращает `{ok, receipt, entityRef}`: только подтверждённая квитанция даёт saved. Повтор предложения идемпотентен. Config/routine proposals создают черновик, не запуск. Ручной ввод и Fabric используют существующие config/routine APIs. Черновики циклов разделены по ID; неизвестный ID не подменяется первым циклом.

Это локальная демонстрационная память страницы. Реальное аудио не захватывается, STT и модель не вызываются. Production journal/outbox, сохранность после restart, реальные provider/host receipts и native accessibility требуют OX-05…OX-12. Прототип не закрывает эти пакеты и не повышает Product/Coverage. Общая архитектура и зависимости остаются в [operator interaction](../architecture/operator-interaction.md) и [OX-плане](../ux/plans/2026-09-15-r0-operator.md); все старые идеи сохранены в CO-166 и более ранних строках.

## Проверки

- CUA: 81 экран в ready; 567 сочетаний 81×7 common states — заголовки отрисованы, ошибок JavaScript и горизонтального overflow при 1280×800 не обнаружено. Это smoke, а не 567 доказательств функциональной приёмки.
- CUA: 81 ready-экран на 390×844 проверен на горизонтальное переполнение и на заполненном Atlas, и на новом локальном проекте: overflow не обнаружен.
- Пройдены: график стрелками/Enter → точный день; голосовой пример → исправленный текст → адресат → receipt → Board; создание Boreal R0 → Home → собственный проект; CEO workflow → preview/save → enable → run → replay без дубля → pause; draft → denied → partial → recovery; CTX-решение → pending delivery; уточнить связь с CTX-AT-42 → Board → подсвеченная исходная реплика. Главная просмотрена в светлой и тёмной теме; Live на паузе имеет статичный индикатор (computed animation: none).
- 81 Node tests PASS: `r0-ui-design`, `launch-design`, `pulse-design`, `product-integration-sources`, `product-integration-final`, `product-integrations`, `product-empty-state`. Включают 81×7 render branches, отрицательные scope/ID/receipt случаи. [Тестовый файл](../../scripts/test/r0-ui-design.test.mjs).
- Pointer hover и reduced-motion media contract проверены в коде; клавиатурный tooltip просмотрен в браузере. Native screen reader, реальная voice/STT latency и usability pilot не проверялись.
- File URL был отклонён браузерной политикой. Проверка продолжилась через отдельный loopback HTTP, разрешающий только product.html и preview JPEG; настройки безопасности не менялись. Preview builder поддерживает такой URL и сверяет SHA256 ответа с собранным артефактом до генерации.

Источники: `scripts/product/launch.mjs` (Home, Board, scope bridge, outcome, journal), `assistant.mjs` (scope/message/apply/voice/relink), `routines.mjs` (exact lookup, draft isolation, version/run), `integrations.mjs` (scoped configuration), `controller.js` (routing/callbacks), `launch.css` (layout/chart/motion). Точные функции и line receipts — в [аудите](../ux/audits/2026-09-16-r0-ui.md). Repository gates: `bash scripts/ci.sh fast` — exit 0, `fast tier green`; `node scripts/build-mockup-previews.mjs --check` — 81 views pinned; `node scripts/check-design-map.mjs` — 1 561 source files, 268 unique anchors, 894 link targets. Это включает typecheck, design/docs/register gates и pure tests; проверки со стеком БД (`full`) не запускались. Первая попытка выявила недостающую внутреннюю ссылку в changelog и несовпадение empty-action аватара: исправлены источник/модель, прежние проверки не ослаблялись. Публикация удостоверяется отдельной квитанцией после source commit.

## Передача и следующий шаг

Objective: завершить переработку главной и устранить обнаруженные разрывы интерфейса первой версии. Source baseline `f7ed54935d32ae615f630b99c6d93f3dadb7a8fd`; owning repo `passioncode-ai/fabric`, branch `codex/context-audit-2026-09-14`. Source/artifacts/models/UX chain сохраняются одним изменением. Адаптер и контракт не менялись; ожидающих member branches нет. [Publication receipt](../workspace-receipt.json) задаёт source/child/digest/release; ветка не является merge или выпуском desktop.

Следующая инженерная задача: OX-05/D01 — связать message/outbox и command receipt с подтверждёнными producers, затем реальный capture/STT OX-07. Начать с [пакета OX-05](../ux/plans/2026-09-15-r0-operator.md#ox-05), shared contracts C1–C6 и отрицательных сценариев этой итерации. Не переносить синтетические CTX fixtures в production database. Приоритетные UX входы открыты; проверку пилотом и runtime acceptance выполнять на идентифицированной сборке.

Concrete review: компактный возврат в верхней правой области, Live от уровня доски; детали открываются по запросу. Правильно ли мы это запланировали, и правильно ли мы это делаем?

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — source iteration and verification
- [`ux-scenarios`](https://github.com/ssheleg/super-ux) — R0 screen and flow contracts
- [`ux-audit`](https://github.com/ssheleg/super-ux) — independent audits and browser state checks
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — compact columns and calm Live indication
- [`copywriting`](https://github.com/ssheleg/super-ux) — actions and error recovery
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — lease and tracked handoff
- `maintaining-fabric-workspace` — wiki snapshot publication — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
