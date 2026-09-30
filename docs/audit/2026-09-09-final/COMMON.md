# Контекст и договор передачи агентам

Аудит исходников `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`, 2026-09-09. Это план следующей реализации. Он не включает разрешение на платные прогоны, новые credentials, production DB reset или activation внешних effects.

1. Начать с этой страницы, выбранного packet и `docs/architecture/system-contract.md`; подробная целевая спецификация — `docs/architecture/engineering-specs.json`. Статус реализации проверять по коду, а не по `proposed_contract_not_implemented` внутри исторического target catalog.
2. Прочитать `AGENTS.md`, `docs/AGENT_SYNC.md`, `CONTEXT.md`, применимые ADR и сценарий. В отдельной ветке/checkout, уникальная AGENT_SYNC_RUN_ID; shared docs только под lease. Не работать одновременно над main/index.ts в одном checkout.
3. Перепроверить baseline против текущей ветки: `git diff d28c321 -- <affected paths>`. В чужие изменения не писать. Сначала воспроизвести дефект; для audit probes PASS означает подтверждение старого дефекта, не здоровье продукта.
4. Один logical command — одна atomic receipt. Actor/estate/project/lease revision приходят из trusted context. Unknown не равен zero/success; agent claim не равен observation; permission не равен effect.
5. Task, TaskRun, Session, Attempt, WorkflowRun не взаимозаменяемы. Новую схему вводить additive migration; не менять старые journal events. Native session refs opaque. Повтор command key возвращает прежнюю receipt.
6. UI: controlled entity-keyed drafts, generation guard, локальные loading/error/empty/stale; отказы CommandResult должны быть показаны, catch недостаточно. Keyboard/focus/zoom, RU/EN и contrast проверяются отдельно. Mockup — target, не runtime evidence.
7. Перед работой указать точные producer → store/command → query → IPC → renderer → observable. Если consumer отсутствует, задача заканчивается partial, а не shipped-end-to-end.
8. В каждом packet поле paths — существующие точки чтения; future_files каталога — только кандидаты на создание. Не создавать уже существующие TaskRun/trace/answer механизмы повторно. Общие generic envelopes не дублировать.
9. Соседние contract/adapter repositories меняет их владелец: сначала versioned contract и conformance, затем pin потребителя. Repo snapshot hashes перечислены в index JSON; другие ветки автоматически не импортировать.
10. Приёмка: failing baseline → исправление → positive+negative tests → consumer walkthrough → exact command/exit/source receipt. Full DB/role/crash probes — на disposable stack. Native paid pilot ждёт названных runner, resource и бюджета.
11. Исторические документы не переписывать. Новый ADR только для действительной смены архитектуры; предложение в этом аудите не есть принятый ADR. Каждое оставшееся ограничение — в существующем owner/CO-113 subitem. Commit+push, fresh checkout, map and workspace publication по owning repo contract.

## Более поздние изменения

Сначала [последний auto addendum](provider-auto-addendum.md): ADR-0052 заменяет прежнее исключение auto; M199.probe/accounts/auth/binding/resume/usage/auto/ui/acceptance — актуальные девять частей. Затем прочитать [provider addendum](provider-addendum.md) и существующие [PA-01–06](../../evidence/plans/2026-09-09-provider-accounts.md#packets) перед работой с account/quota/session. Срез 25026da — только proposed design. Generic reads остаются UX28-02, quota identity/cache — PA-05, native switch — M199, admission/run — FA-02. Не создавать второй account store или coordinator под другим ID. M199.ui — полная приёмка UI после auto; независимые account/manual read-state fixtures можно делать раньше по готовым контрактам, без утверждения полной поставки M199.ui.

## Параллельная работа и контракты рёбер

Безопасные параллельные lanes: build/CI; UI saved-work; read models; launch/DB; pure manager contracts. Внутри lane общие файлы сериализуются. UI до завершения producer может строить отказ/unknown и fixtures, но не активировать capability.

- FA-03 → FA-02: validated scoped quota + admission reservation.
- FA-04 → FA-02: атомарный ацикличный dependency snapshot.
- FA-02 → run/continuation UI: одна подтверждённая TaskRun/session identity и lifecycle receipt.
- UX28-02 → Inbox/cycles/graphs: freshness, partial sources, scope generation, minimum cursor.
- M153 + M158 → M166: pure hygiene/criticality; M168 остаётся mutation checker.
- M166 → M167 → M169/M171: core snapshot → optional model port → bounded attempts/usage.
- M166 → M194; M169 + M171 + M194 → M175: replaceable binding, cumulative budget, manager lifecycle.
- M183.local → M183.upstream: устойчивый локальный lineage/suppression; outbound дополнительно ждёт endpoint/schema/consent.

Каждый executor перед стартом проверяет payload ребра. Фаза сама по себе не блокирует работу. Один inherited packet и дочерняя коррекция — один owner scope, не две конкурирующие реализации.
