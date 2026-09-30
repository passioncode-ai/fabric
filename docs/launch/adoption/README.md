# Fabric: от первого проекта к полезному возвращению

> **2026-09-25 · текущий целевой вход изменён.** [Первый релиз: CEO → исполнитель → папка → обзор](../first-release.md) и [стратегия FR-A…G](../first-release-strategy.md) заменяют обязательные name/purpose/review шаги AD03. Исторические результаты и 25 пакетов ниже сохранены; их наличие не означает готовность нового пути.

**Текущий review: 17 сентября 2026.** [Интерактивный проект знакомства](../../reports/adoption.html#overview) · [Все возможности](../../reports/adoption.html#capabilities) · [34 наблюдения и 18 решений](../../reports/adoption.html#findings) · [25 пакетов реализации](../../reports/adoption.html#plan).

Начните с интерактивного маршрута: выберите исходную ситуацию, фазу знакомства и состояние. Затем откройте соответствующее решение и пакет. Подробный [конечный дизайн](design.md) объясняет функционал, последовательность сессий, hook, ошибки и измерение пользы. [Общие контракты](contracts.md) запрещают разным агентам придумывать несовместимые модели. Все хорошие идеи и старые экраны сохранены в [инвентаре 85 представлений](inventory.json).

## Реализация · 17 сентября 2026

[AD00 — passed, pure](receipts/AD00.json): исправлена UX-проекция, сохранены все 85 view IDs. [AD02 — native acceptance pending](receipts/AD02.json): сохранность черновиков исправлена и проверена через настоящий renderer/disk; проверка окна ожидает разрешений macOS Computer Use. [AD01 — passed, source](receipts/AD01.json): единая матрица producers и ADR-0061, runtime-порты остаются отдельными пакетами. [Журнал первого среза](execution/2026-09-17-foundation.md).

План ниже сохранён как исходный; факт выполнения определяется квитанциями, а не исходным статусом planned. AD03 реализован в целевом макете: [три шага](../../reports/product.html#view-launch-start), [проверки и остаток](execution/2026-09-17-unified-creation.md). Приёмка browser/keyboard пока не пройдена. AD04 ждёт native-приёмку AD02 и prototype-приёмку AD03.

## Приоритет

Первый результат — **понятный контекст своего проекта и сохранённый следующий шаг**. Главный повторный результат — **вернуться после паузы и быстро продолжить точную работу**. Project/Task creation остаются setup/action receipts, но не заменяют эти результаты. Настройка агента появляется перед делегированием, цикл — перед повторением; помощь не запирает функции за уроками.

Предлагаемая очередь: AD00 исправляет доказательную карту; AD01 связывает модель с producers (существующий OX-01/D01). AD02 отдельно исправляет риск потери native drafts. AD03–08 с требуемым AD09 дают первый сквозной context-return path с сохранностью данных; AD09–17 добавляют разговор, обязательный реальный голос, доску, исполнение и циклы по готовности; AD18–21 связывают постепенное знакомство; AD22–23 подтверждают runtime и пользу. Полный редактор не блокирует готовую узкую возможность, но отсутствие authority/receipts/recovery блокирует её применение.

## Как читать доказательства

Это законченный **аудит, предлагаемый дизайн и план**, а не завершённая реализация найденных изменений. [Checks](checks.md) различает source survey, pure probe, prototype click и ещё не пройденную native/user acceptance. Все 85 views инвентаризированы; нельзя утверждать, что каждый клик во всех их состояниях уже пройден. В плане для этого есть конкретные matrix/gates. Невозможно гарантировать агенту отсутствие любой ошибки; можно исключить догадки о границах, обязательных входах и критериях завершения и требовать остановки при недостающем контракте.

Новые ID SCN/FLW/SCR не вводятся, runtime-статусы **не повышены**. AD00 уже исправил генератор; AD03 переносит изменения target-поведения через canonical сценарии → flow → screens → product model → mockup. Интерактивный adoption report — предложение маршрута для изучения, текущий [product mockup](../../reports/product.html#view-launch-start) содержит новый трёхшаговый target-сценарий; браузерная приёмка отделена от pure-проверок. Это предотвращает ложное доказательство новой ценности старым зелёным макетом.

## Передача агенту

- Objective: реализовать постепенное знакомство вокруг контекста и полезного возврата, не потеряв существующие функции и источники.
- Completed: 85-view/20-family inventory; три пересекающихся аудита; 34 observations → 18 reviewed proposals → 25 bounded packets; cohort/session/error/recovery design; interactive review; source integrity checks.
- Open work: AD03–24 и native-приёмка AD02; native/user checks из [checks](checks.md). Deferrals tracked by **CO-167**, parent CO-166 и OX/D01; этот план не второй task store.
- Decisions: предложения D01–D18 в [findings.json](findings.json). Рекомендованные альтернативы разобраны; изменение существующей архитектуры принимается отдельным ADR при реализации. Не считать proposal accepted из-за публикации.
- Prerequisites: input receipts, actual producer binding, permitted scope, exact write set, source digest; future packets blocked until fulfilled.
- **Exact next task: [приёмка AD02/03](execution/2026-09-17-unified-creation.md#handoff-and-next-task)** — пройти изолированное native окно после разрешений Computer Use и browser/keyboard матрицу нового маршрута. AD00/AD01 уже имеют immutable passed receipts. AD04 не начинать без обоих acceptance receipts.

Owner: `passioncode-ai/fabric`; branch `codex/context-audit-2026-09-14`; immutable audit baseline [bac1f67](https://github.com/passioncode-ai/fabric/commit/bac1f67f295b1b05a5caf914f59aa63ced94d439). Каждая packet содержит commit-addressed references и SHA256 исходных файлов. Publication identity хранит [workspace receipt](../../workspace-receipt.json); текущий source/pin берётся оттуда. Runtime-source срез AD02 исправляет сохранность черновиков; native acceptance остаётся открытой. Metadata CLI 2.1.274 сохраняет capability verdicts unverified. Member repositories adapter/contract не менялись; pending member branches этой итерации нет. Fresh checkout verification проверяет отдельную Git-доставку.

## Module spine

| Module | Own requirement | Deliverable | Packets | Status |
|---|---|---|---|---|
| traceability | REQ-01 | корректная связь evidence→UX | AD00 | planned |
| contracts | REQ-02 | один producer/тип/authority на port | AD01 | planned |
| project | REQ-03 | один сохраняемый путь проекта | AD02–04 | planned |
| sources | REQ-04 | наблюдать выбранные источники честно | AD05, AD24 | planned |
| context | REQ-05 | first checkpoint + exact return | AD06–08 | planned |
| conversation | REQ-06 | scoped durable input и атрибуция | AD09–11 | planned |
| voice | REQ-07 | реальный voice input и коррекция | AD12–13 | planned |
| attention | REQ-08 | решение и resurfacing без дублей | AD14 | planned |
| execution | REQ-09 | readiness→Run→verified result | AD15–16 | planned |
| cycles | REQ-10 | один контролируемый полезный цикл | AD17 | planned |
| adoption | REQ-11 | прогресс по результату, точный resume | AD18–19 | planned |
| shell | REQ-12 | спокойный UI без чужих fixture данных | AD20 | planned |
| depth | REQ-13 | все поздние входы и приглашённый | AD21 | planned |
| acceptance | REQ-14 | runtime и проверенный пользовательский результат | AD22–23 | planned |

AD00/01 — явно обоснованное исключение из walking-skeleton-first: текущая проекция загрязнена, а обещанный durable producer не доказан. Первый пользовательский сквозной срез — Project→source→checkpoint→restart→return (AD04–08), не завершение всех слоёв платформы. Полное сканирование папки AD24 отделено от минимального source/no-source порта AD05, поэтому idea-path не ждёт batch discovery. AD08 намеренно связывает три consumers после durable conversation AD09. Module decomposition по способности; shared journal/schema — infrastructure owner, не отдельная ветка пользовательских требований.

Вопрос review: выбираем ли первый успешный возврат основной активацией вместо окончания тура — **правильно ли мы это запланировали, и правильно ли мы это делаем?**
