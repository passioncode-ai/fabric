# Передача: персональный Fabric и пульс · 2026-09-15

Текущее продолжение: [аудит доступности R0, голос и снижение нагрузки](operator-first.md). Этот снимок сохранён как история.

## Один вход и цель

[Overview и приоритет](README.md) → [требования P-01…P-06](pulse.md) → [контракт и пакеты P0–P6](../architecture/personal-fabric-pulse.md). Объектив: персональный узнаваемый Fabric, полезный обзор живой работы и результата без поиска по wiki.

Основание: продолжение запроса оператора после принятой композиции. Предыдущий исходный снимок: [d2bec116](https://github.com/passioncode-ai/fabric/tree/d2bec116a254cae49a0e5b4f53d3665b88b2eed6). Проектная vision сохранена; новая детализация — target и ADR-0059 proposed, без повышения runtime coverage.

## Что сделано

1. Новый SVG-генератор цветных вариантов (Орбита, Искра, Волна), preview/выбор/сохранение/пропуск, отдельная ветка первого входа к созданию проекта. Сохранённый облик используется всеми launch surfaces и Fabric launcher в текущей странице.
2. Home сохраняет порядок профиль → доска → проекты; далее активность, релиз и пульс. Общая статистика и график используют один synthetic fixture dataset; деталь дня показывает исходные записи.
3. Пульс показывает agent claim, host observation, unknown coverage и следующий cycle отдельно. Пауза ленты/новое событие/apply/потеря соединения — интерактивные локальные состояния.
4. Релизы различают candidate/published/verified/rolled back и показывают состав, среду, причины, проверку и дальнейший шаг. Данные разных проектов не подставляются друг за друга.
5. Новый архитектурный контракт задаёт identity, revision/CAS, event projection/cursor/dedup, timezone, source coverage, release evidence, command authority, migration и P0–P6. Системная карта, UX, индекс wiki, CO-165, backlog, карта экранов и исторические источники связаны.

## Проверки и границы

- `node --test scripts/test/pulse-design.test.mjs scripts/test/launch-design.test.mjs`: 9/9 PASS. Это поведение настоящего prototype reducer/renderer, не проверка базы или runtime.
- Пять временных механизм-удаляющих plants были отвергнуты тестами: отсутствующее сохранение, unknown→zero, auto-apply unseen, снятая conflict-block, publication→verified. После восстановления 5/5 PASS. Plants не оставлены в исходниках.
- `node scripts/check-product-model.mjs`: PASS, 81 view / 63 screen / 94 scenario / 54 flow / 37 journey. Это целевые views, coverage не повышена.
- `node docs/audit/2026-09-15-launch/check.mjs`: PASS, прежние 656 документов и 527 строк сохранены; 15 пакетов, 31 ребро, 94 ссылки старого launch audit не потеряны.
- `bash scripts/check-docs.sh`: PASS с существующими advisory warnings. 32 изменившихся hash-receipt контроллера перепривязаны только после совпадения каждой цитируемой строки с предыдущей ревизией; verdict старых clause не расширен.
- Browser CUA, localhost docs-only server: карта → персонализация первого входа → «Сохранить и создать проект» открывает существующий onboarding; выбор Искра → ещё варианты → вариант 2 → сохранить → Home; выбранный облик виден у профиля и Fabric. Период 7 дней → релизы → 14 сентября → основание. Pause → incoming → apply; connection lost; Studio published-but-unverified. Обычный viewport 1280×720, дополнительно 390×844: мобильная навигация, персонаж и варианты доступны. UI read-only; никаких настоящих агентов или публикационных команд из макета не запускали.
- Browser обнаружил наследование project scope после сохранения аватара; исправлено default scope для новых views и global Home chart. Сверены времена демонстрационных событий и снимка. На узком экране добавлен native day selector как альтернатива маленьким столбцам; browser selection 2026-09-02 показывает отсутствие покрытия. Conflict → Перечитать меняет Save с disabled на enabled. Console errors в просмотренном локальном макете: 0.
- Визуальная оценка: выбранная композиция сохранена, цвет сосредоточен в персонаже и графике, Board остаётся основным действием. Это judgment, не полная WCAG certification, нагрузочный тест или pilot с пользователями.
- Финальные generated/map/fast receipts — [pulse-checks.txt](pulse-checks.txt). Full DB tier не запускался. Публикационная цепочка удостоверяется [workspace receipt](../workspace-receipt.json).

## Репозитории и публикация

Fabric — `git@github.com:passioncode-ai/fabric.git`, branch `codex/context-audit-2026-09-14`, entry `docs/launch/README.md`. Workspace — `git@github.com:passioncode-ai/fabric-workspace.git`, main; host-код в этой итерации не менялся, публикуется новый immutable source snapshot. Adapter и public contract не менялись; pending member branches для этой итерации отсутствуют. Source SHA и deployed child SHA находятся в receipt, а финальный parent pin — в истории Git. Branch handoff не является merge на main.

Доступ из свежего checkout проверяется после публикации: clone parent branch → init pinned workspace → entry/read sources → receipt/manifest source equality. Для выполнения CI отдельно нужны указанные зависимости репозитория. Превью или чат не являются единственной передачей.

## Точная следующая задача

**D01/P0: пройти `producer → event → projection → reader → screen` для ContextView, Agenda, appearance, activity, liveness/cycles и release evidence.** На входе этот контракт, C1–C6, existing liveness/cycle implementations. На выходе evidence-backed reuse/extend/missing table, точные owner/read/write boundaries, миграционные prerequisite и первый вертикальный пакет P2→P4→P5. Не начинать с внешнего image provider или нового event bus.

Открыто в CO-165: persist avatar, runtime projections, real live transport, release mapping и bounded review; AI avatar adapter, расширенная геймификация и always-on host — дальнейшие пакеты. Fast выявил, что новый ADR-0059 опережает старую prose reservation ADR-0058. По уже принятому collision rule прежнего плана зарезервирован ADR-0060 (agent-sync), индекс продолжен с 0061; старый план остаётся неисполненным. Старые as-built/mirror divergences обнаружены до работы; исторические записи не выдуманы. Исторический code graph не пересобирался; новые модули связаны через product/system model, graph↔code parity старого индекса не заявлена. Использованные навыки и их вклад: [receipt](pulse-skills.md).
