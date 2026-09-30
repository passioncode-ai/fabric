# Проверки и handoff — 15 сентября 2026

Цель: пересмотреть wiki/backlog, сохранить идеи, предложить целевую архитектуру и разобрать R0/R1 до bounded packets. Входная ревизия `d0260d430797f16dfaad1fde53a72afbed503893`, ветка `codex/context-audit-2026-09-14`. Владелец source — Fabric parent. Entry: [README](README.md), следующий пакет [D01](packets.md).

## Выполненная работа

- Исправлена текущая рекомендация композиции: профиль Fabric сверху, затем доска, проекты, live; Planning и циклы входят в целевой запуск.
- Сохранён дословный inventory исходных строк и всех tracked docs на baseline; proposed overlay не меняет delivery states.
- Архитектура разделена на существующие области ответственности; 15 пакетов с входами, выходами, приёмкой и ограничениями. Это план, а не работающий продукт.
- Противоречия старых и новых M188/M152/M190, ADR-0045 и M199 отмечены явно. Проверка каждого live path принадлежит D01 и последующим пакетам.
- CO-165 расширен под lease; прежние ячейки и остальные строки реестров сохранены. Новые ADR не созданы: инженерные варианты остаются proposed до предметного решения.

## Проверки

Результаты дополняются только выполненными командами. Планируемые проверки продукта описаны в packets.md и не считаются выполненными здесь.

| Проверка | Наблюдение |
|---|---|
| Toolkit | 527 callable skills; маршрут записан в [skills.md](skills.md) |
| `node scripts/workspace.mjs status` | stale source; child не перепубликовывался |
| agent-sync status | other runs: none holding; mirror drift 122 pages; TTL lease git-CAS получен |
| agent-sync reconcile | исторические расхождения присутствуют; сохраняем без выдумывания прошлых as-built записей; подробности прежнего аудита остаются CO-165 |
| `node docs/audit/2026-09-15-launch/inventory.mjs` | 656 files, 527 source rows, 197 M milestones, 165 carry-over; исходные данные читаются из Git baseline |
| Полнота ручной классификации M | Первый запуск отказал: M101 отсутствовал в mapping. M101 добавлен в инженерный owner; повтор прошёл. Это проверка реестра, не тест продукта |

## Публикация и границы

Wiki остаётся на прежнем pin до отдельной успешной публикации. Историческое несовпадение installed CLI capabilities останется препятствием, если повторный fast его подтвердит; обновлять capability matrix без probes нельзя. Scope этой итерации не включает runtime-изменения, release, merge, запуск live CEO, удаление/сброс БД, правку sibling repos или правку workspace/content.

## Возобновление

Прочитать README → packets D01 → receipts/source links. D01 проверяет actual producer/consumer и сохраняет минимальные контракты; D02 синхронизирует новый UX/model/mockups; D03 определяет durable agenda и настройки; D04 ограниченный Fabric-agent. Изменения R1 не dispatch-ready до принятых D-результатов и свежих context digests. 5 пересечений файлов в launch.json требуют одного integration owner и порядка при dispatch.

Исходный архитектурный пакет закоммичен и отправлен: `9eb372fd5f5a194e1277ae9dc8b6eae6f29d0f0d`. `git ls-remote origin refs/heads/codex/context-audit-2026-09-14` вернул этот SHA. Запись ниже добавляет проверку передачи; это не merge или deployment.

## Итог выполненных проверок

- `node docs/audit/2026-09-15-launch/check.mjs`: PASS для сохранности baseline docs/строк, требований и DAG. 656 файлов, 527 сохранённых строк, 15 пакетов, 10 требований, 31 зависимость. Проверка сохранности CO-165 сначала отказала на вставку внутрь старой ячейки; дополнение перенесено после полного исходного текста, повтор прошёл.
- `node scripts/repin-mockup-receipts.mjs`: обновлён только hash backlog; цитируемая M131 строка byte-identical. `build-mockup-coverage.mjs` и `build-plan-projection.mjs`: exit 0.
- `bash scripts/ci.sh fast`: **exit 1**, прежняя категория provider capability mismatch. Матрица Claude Code 2.1.236 против установленной **2.1.272**; Codex 0.152.1 против 0.154.0. Предшествующие документационные gates, сборка и pure tests прошли. Это не PASS общего CI и не публикационный допуск.
- Проверка встроенного JS и браузер: первый экран выявил SyntaxError из-за переноса строки в generated script; исправлено escaping в renderer, `node --check` прошёл. В Codex IAB проверены 527 строк очереди, поиск M188 (10 совпадений, включая ссылки из других строк), пустой результат, библиотека 656 файлов после очистки, раскрытие Delivery→D01 и Planning→L07→L02 с раскрытием родителя зависимости. Скриншот 1280×720 просмотрен: навигация, фильтры и результаты читаемы. Это проверка отчёта, не полная accessibility-приёмка продукта.
- Дополнительно подготовлены [C1–C6](contracts.md): проверенные точки включения run/answer/pack/cycle, точные предложения ContextView, Agenda, GraphExpansion, preferences, workflow и bounded manager; migration/failure semantics заданы до будущего кода.

План не ждёт новых внешних аккаунтов или настройки всех будущих агентов. Следующий D01 — предметное принятие/уточнение C1–C6 и остаточных контрактов, после него D02 обновляет канонические сценарии и макеты. Никакая документационная готовность здесь не повышает runtime status.

Финальные документационные проверки: `pnpm gates:docs` exit 0; `git diff --check` exit 0; `node --check` встроенного script exit 0; карта после refresh проходит (1522 source files, 262 anchors, 858 targets). Reconcile завершился exit 1 на ранее известных расхождениях; это не runtime verdict. Общий fast остаётся exit 1 на названных CLI versions.

## Передача из свежего remote checkout

`git clone --depth 8 --branch codex/context-audit-2026-09-14` с authorized origin и `git submodule update --init --depth 1 workspace` завершились exit 0. Parent: `9eb372fd5f5a194e1277ae9dc8b6eae6f29d0f0d`, child: `40e6d0fe5fee717f0728a59aac25f9b8c3313a6e`.

В этом отдельном checkout `node docs/audit/2026-09-15-launch/check.mjs` прошёл: 656 сохранённых файлов, 527 строк, 15 пакетов, 10 требований, 31 зависимость, 94 локальные ссылки. Полнота и адреса доступны без истории чата и без npm dependencies. HTML, contracts.md, launch.json и inventory.json пришли из remote Git.

`node scripts/check-design-map.mjs` в голом clone не стартовал: не установлена зависимость `parse5`. Это prerequisite `pnpm install --frozen-lockfile`, а не PASS свежей сборки. В основном checkout с dependencies map прошёл; пользовательская runtime-приёмка и сборка из чистого checkout здесь не заявлены. После получения следующих принятых контрактов D01 должен материализовать обновлённые digests. Временный clone служит только проверкой доступа и не является местом доставки.

Повторный `fast` перед handoff-коммитом: exit 1 на тех же двух provider-capability mismatches; предшествующие gates прошли. Карта handoff: 1522 source files, 263 anchors, 863 link targets. Повторный `agent-sync reconcile` после as-built record: exit 1, исторические отсутствующие записи остаются; новая документация записана как source 9eb372f, без заявления о реализации.
