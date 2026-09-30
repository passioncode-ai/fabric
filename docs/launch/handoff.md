# Wiki и интерактивный дизайн запуска · 2026-09-15

Продолжение этой итерации: [персональный Fabric и пульс — текущая передача](pulse-handoff.md). Запись ниже сохранена как квитанция предыдущего шага.

## Scope и источник запроса

Оператор попросил сделать overview и приоритет первым входом wiki, сохранить остальные идеи и прорисовать production-like интерактивную карту приоритетного запуска. Предыдущая архитектура: [снимок e2c58a5](https://github.com/passioncode-ai/fabric/tree/e2c58a5c99d3d6698f7c95c28c7e314c098c0067/docs/audit/2026-09-15-launch).

REQ-01: главный вход объясняет запуск и следующую задачу — проверка home/priority.
REQ-02: приоритет ведёт прямо к макету и инженерному пакету — проверка ссылок.
REQ-03: Home, Board, Project, Agent, Planning связаны — browser clickthrough.
REQ-04: загрузка, ошибка, пусто, устаревший снимок и ожидание различимы — state walkthrough.
REQ-05: идеи и старые адреса сохранены — conservation check и отсутствие удалений реестров.
REQ-06: публикация имеет подтверждённый source/child/release — workspace strict check.

## Дизайн

Сценарии обновляются в режиме Update; детализация остаётся draft, макет служит предметом проверки. Runtime coverage не повышается.
Основа: `docs/brand/ui.md`, Paperclip/app semantic tokens. Композиция открыта; бренд и смысл статусов фиксированы. Главный критерий: в первом экране видны Fabric, актуальный вопрос и прямое действие; до контекста агента не более двух переходов. Плотная инструментальная поверхность, без кинематографической анимации. Один проход visual critique и исправление конкретных дефектов; новая палитра не выбирается. Проверка браузера и клавиатуры не объявляется полным WCAG-аудитом.

## Порядок работ

1. Канонические сценарии и модель экранов.
2. Рендереры интерактивного приоритетного среза; общие данные и состояния.
3. Главный вход wiki, приоритет, прямые ссылки; старые разделы сохраняются.
4. Проверки, карта изменений, source commit; child tests, publish, strict receipt.

Модель и среда наследуются из текущего сеанса. Дополнительный модельный выбор, Figma-файл и запуск runtime-агентов для этого макета не нужны. Работа авторизована последним запросом, коммит/push — standing handoff instruction. Исторический code graph не доказывает поведение нового макета; источники модуля и маршрутов проверяются напрямую.

## Состояние

Канонический дизайн и host-навигация реализованы. Новые маршруты — target на синтетических данных; runtime запусков/доски не объявлен готовым. Источник wiki — `overview.json`, host читает его из versioned snapshot. Публикационный результат удостоверяется только `../workspace-receipt.json` после publisher, а не этой плановой записью.

### Проверено до source commit

- `node scripts/check-product-model.mjs`: PASS — 63 screens, 78 views, 94 scenarios, 54 flows; production coverage не повышено.
- `node --test scripts/test/product-empty-state.test.mjs`: 6/6 PASS, включая соответствие объявленного empty-action тексту экрана. Предыдущий запуск выявил у новых views наследованный action; модель исправлена под фактический empty-state.
- `npm --prefix workspace test`: 38/38 PASS. Новые проверки: source-owned priority перед библиотекой, прямой task/prototype link и fallback старого snapshot.
- `node docs/audit/2026-09-15-launch/check.mjs`: PASS — 656 документов, 527 исходных строк, 15 пакетов, 31 зависимость, 94 ссылки.
- `node scripts/build-mockup-previews.mjs --check`: 78 views привязаны к текущему prototype/model. Превью собраны штатным renderer screenshot builder; это не browser acceptance runtime.
- `node --experimental-strip-types --test apps/desktop/test/provider-accounts.test.mjs apps/desktop/test/conversation-binding.test.mjs apps/desktop/test/provider-capability-upgrade.test.mjs`: 3/3 файлов PASS. Исторические измерения сохранены; новые Claude Code 2.1.272 / Codex 0.154.0 — unverified до capability-specific проб.
- CUA browser, 1280×720 и 390×844: Home → вопрос → перенос с причиной → отложенная тема → агент → задачи/сессии → пакет запуска 1; Planning portfolio → Atlas → цель → этапы; DID отдельно. Порядок Studio/Atlas меняется. Home loading/empty/error/denied/partial/conflict/ready показаны в браузере. Черновик «Проверить возврат завтра» пережил conflict → перечитывание; запись в конфликте disabled.
- Visual judgment, не WCAG certification: видны аватар и основной вход в доску; общая навигация упрощена. На 390px исправлены перенос заголовка и отсутствовавший selector разделов. Макет агента разделяет задачу/запуск/сессию и исходный/следующий пакет. Полный аудит assistive technology и runtime latency не проводился.
- `git diff --check`: PASS. Общий fast запускался; ранние отказы матрицы, empty-action и устаревшего preview исправлены. Окончательный fast-result сохраняется рядом в `checks.txt`.

- `node --test scripts/test/launch-design.test.mjs`: 4/4 PASS — priority ordering, scope, draft conflict, historical version.
- `bash scripts/ci.sh fast`: exit 0; [выборка результата](checks.txt). База данных не запускалась.

### Репозитории и открытая работа

Fabric: `git@github.com:passioncode-ai/fabric.git`, ветка `codex/context-audit-2026-09-14`, вход `docs/launch/README.md`.
Workspace: `git@github.com:passioncode-ai/fabric-workspace.git`, ветка `main`, host entry `lib/pages.mjs` (`home`, `priority`). Host commit: [fa5961b](https://github.com/passioncode-ai/fabric-workspace/commit/fa5961b4a500396aec4ac940109792b58cf66b45); точный child pin и source SHA хранит publication receipt. Adapter/contract не менялись.

Открыто: D01 и все runtime-пробелы CO-165; широкая автономия и прочие полки сохранены. Исторический as-built reconcile сообщает пропущенные записи старых ADR/CO; эти записи не выдуманы и не закрыты. Full tier с базой не запускался. Публикация wiki не является релизом desktop-продукта.

### Точная следующая задача
 Следующая инженерная работа после дизайна: D01, затем C1 ContextView и C2 Agenda; не начинать полноценный автономный manager до проверки read/command contracts.
