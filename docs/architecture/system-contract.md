# Fabric — инженерный контракт системы

**Статус:** рекомендуемая целевая спецификация, 2026-09-07. Это проектное решение для
следующей реализации, не утверждение о поставленных функциях. Исследованный код:
`5051def6304a781615f21adcd84b5836ab56a9dc`. Объём — текущие карточки из
[зафиксированного объединённого плана](../audit/2026-09-07-merged-execution-plan.json)
и уточнённые зависимости `execution_nodes` в [engineering-specs.json](engineering-specs.json).
[Foundation review](../evidence/plans/2026-09-07-foundation-priorities.json) сохранён как предшествующий снимок.
Остальной горизонт backlog сохраняется; он не объявлен готовым к разработке этим документом.

[Открыть интерактивную систему](../reports/system.html#system) ·
[Граф данных](../reports/system.html#data) · [Циклы](../reports/system.html#cycles) ·
[Задания разработчикам](../reports/system.html#tasks).

## 1. Как пользоваться источниками

| Вопрос | Единственный владелец ответа |
|---|---|
| Какое поведение рекомендуем построить | Этот контракт: общие правила и границы; [engineering-specs.json](engineering-specs.json): конкретное решение каждой карточки |
| Какие сущности, связи и циклы описаны | [system-model.json](system-model.json); схема в HTML генерируется из него |
| Почему выбрана новая семантика | Новые ADR, перечисленные в `decisions` модели; статус `proposed` требует предметного review, а не подразумеваемого согласия |
| Что реально реализовано и проверено | Код исследованной ревизии и receipts проверок; [backlog](../evidence/backlog.md) хранит delivery state |
| Что делает пользователь | [scenarios.md](../ux/scenarios.md), с трассами к flows/screens; новые графы — draft до реализации и проверки |
| Что обещано внешнему адаптеру | Версионированный [fabric-agent-contract](https://github.com/passioncode-ai/fabric-agent-contract); локальная спецификация не меняет его wire format |

Старые ADR и датированные аудиты не переписаны. Противоречия Run/Session и manager
в них перечислены в новых предложениях. Внутри **целевого** пакета разработчик следует
уточнённым терминам ниже; перенос их в публичный wire и действующие словари происходит
в указанном migration gate. Так текущее поведение и новый проект не выдаются друг за друга.

Генератор: `node scripts/build-system-map.mjs`. Проверка модели:
`node scripts/check-system-model.mjs`. Проверка производного HTML:
`node scripts/build-system-map.mjs --check`. Одна карточка для исполнителя:
`node scripts/task-spec.mjs M188` — выдаёт выбранную задачу, общие ограничения,
контракты зависимостей, файлы и приёмку. Генерируемый HTML не редактируется вручную.

## 2. Границы модулей

В первой поставке сохраняем модульный монолит: Electron main, PostgreSQL journal,
детерминированные проекторы и адаптеры исполнителей. Новые микросервисы и отдельная
графовая БД не нужны для перечисленных сценариев. Это проектный выбор, основанный на
существующих швах `apps/desktop/src/main/index.ts#startTask`,
`packages/journal/src/index.ts#createJournal` и `apps/desktop/src/main/agentSurface.ts#AgentSurface`.

| Модуль | Владеет | Не принимает на веру |
|---|---|---|
| Project / Identity | tenant, actor, membership, project и file scope | IDs и actor из renderer/MCP payload |
| Authority / Effects | policy revision, floor, grant reservation, dispatch/result | разрешение как доказательство исполнения |
| Work | цель, task lifecycle, вопрос, blockers, решение, plan version | agent `done` как независимую приёмку |
| Execution | admission, TaskRun, delivery, attempt, checkpoint, cancellation | PTY write как ack; отсутствие сигнала как смерть |
| Agents / Manager | binding, role slot, capability contract, wake, observation, usage | общий label manager как новый wire role |
| Knowledge | claims, observations, transcripts, retrieval, pack, retro | current fact как объективную истину; текст как инструкцию |
| Continuity | cycle ledger, cursor, lease, mirror/import, restore, local settings | зеркало YAML как backup; configured как running |
| Surfaces | scoped queries, preview, graph, Inbox, navigation, draft state | локальный cache как бизнес-состояние |

Каждая команда проверяет полномочия в доверенном процессе и повторно на границе
необратимого внешнего действия. Renderer и external agent не получают raw write
client. Одно изменение нескольких projections, которое должно быть атомарным,
остаётся **одной командой**, а не цепочкой UI-вызовов.

## 3. Идентичности и время

Следующая таблица — рекомендуемое уточнение семантики; старый wire `run_id` не
переименовывается при чтении. Новые поля проходят version gate в карточках S10/M188.

| Термин | Идентификатор и смысл |
|---|---|
| WorkflowRun | `workflow_run_id`, в старом journal поле `run_id`: один проход одной закреплённой версии графа |
| Task | `task_id`: долговечная работа с отдельным бизнес-состоянием; несколько прогонов до закрытия |
| TaskRun | новый `task_run_id`: один явно допущенный прогон задачи, с закреплёнными конфигурацией и исполнителем |
| Session | `fabric_session_id`: транспорт/PTY; opaque `provider_native_session_ref` не является ID задачи или прогона |
| Iteration | явная итерация управляемого цикла; новая итерация задачи создаёт новый TaskRun и все step claims с нуля |
| Attempt | `attempt_id`: попытка конкретного вызова/доставки/эффекта; retry не обнуляет план задачи |
| CycleInvocation | `cycle_invocation_id`: одно срабатывание повторяемого намерения в конкретном окне, с cursor и outcome |
| ManagerInvocation | `manager_invocation_id`: один ограниченный разбор signal batch выбранным manager; это не скрытая задача проекта |
| Checkpoint | `checkpoint_id`: проверка конкретного условия на версии плана/шага с отдельным verdict |
| ExecutionSnapshot | `execution_snapshot_id`: переносимое состояние для продолжения; не означает одобрение checkpoint и не содержит credentials |

Отказ **до** admission возвращает command receipt без TaskRun. Успешный admission
создаёт TaskRun и spawn intent в одной транзакции; последующий отказ spawn — терминальный
исход этого прогона. Так не остаётся невидимого интервала «уже приняли работу, но потеряли запуск».

По умолчанию явная итерация запускает отдельную Fabric session. Повторное использование
native session разрешается только адаптеру с invocation-scoped ack, trace, cancellation
и fencing. Внутренние model turns стороннего агента Fabric не угадывает по тексту или времени.

`TaskState` сохраняет существующий словарь `backlog | running | review | done | cancelled`
из `apps/desktop/src/shared/ladder.ts#TaskState`. Blocked — препятствие/overlay, а не
самовольно добавленный TaskState. Закрытая Task не переоткрывается: продолжение создаёт
новую связанную Task. Повторный TaskRun допустим для ещё не закрытой Task.

Порядок событий — `(estate_id, seq)`, где seq передаётся новым API как decimal string,
чтобы PostgreSQL bigint не терял точность в JS. Время события, время получения и время
наблюдения разделены. Между estate нет общего total order. Миграция number→string в
legacy JournalEvent относится S10/S14 и требует совместимого reader, не coercion в каждом UI.

## 4. Общий протокол команд

Ниже **целевые типы**, а не существующие экспортируемые TypeScript-интерфейсы.
Внедрение проводит M109/S02; domain-specific DTO перечислены по карточкам.

```ts
type Seq = string;                 // decimal non-negative bigint, no Number conversion
type Revision = string;            // opaque equality token, never arithmetic in the UI
type Ref = { kind: string; id: string; version?: string };
type VerifiedContext = {
  actor: { kind: 'person' | 'agent' | 'system'; id: string };
  estate_id: string;
  scope: { kind: 'estate' } | { kind: 'project'; project_id: string };
  authority_revision: Revision;
  binding_revision?: Revision;
  epoch?: Seq;
};
type Command<T> = {
  command_id: string;              // caller persists across retries
  expected_revision?: Revision;
  input: T;                       // context is injected by trusted boundary, not input
};
type CommandResult<T> =
  | { status: 'committed'; value: T; receipt_ref: Ref }
  | { status: 'refused'; code: string; retryable: false; detail?: string }
  | { status: 'conflict'; current_revision: Revision; current_ref?: Ref }
  | { status: 'unavailable'; retryable: true; request_id: string }
  | { status: 'unknown'; request_id: string; reconcile_after_ms: number };
```

`unavailable` означает, что известно об отсутствии commit/dispatch; `unknown` — что
исход мог случиться. Последний нельзя автоматически превращать в повтор внешнего эффекта.
Error codes закрыты в соответствующем module DTO; подробности очищены от секретов,
чужих IDs и внутренних путей. Новый error code вводится с новой совместимой версией
или известным fallback `unsupported_reason`; renderer не печатает raw enum.

Алгоритм атомарной команды:

1. Проверить sender/auth, синтаксис и trusted scope. Найти target через scope, а не
   загрузить объект глобально и надеяться на renderer.
2. Под транзакцией взять dedup row `(estate_id, command_id)`. Повтор с иным
   каноническим payload hash отвергнуть; повтор с тем же вернуть уже записанный result.
3. Проверить expected revision, authority revision, lease epoch, blocker set,
   preconditions и budget/reservation. Все связанные IDs должны принадлежать допустимому scope.
4. Записать business event batch, projections и command result в одной транзакции.
   Внешняя доставка создаёт **outbox intent** в том же commit, но не выполняется внутри SQL.
5. Dispatcher забирает intent через compare-and-swap; проверяет текущую разрешающую
   границу; записывает attempt до вызова и outcome/unknown после. Повтор использует
   тот же effect/delivery identity. Exactly-once external execution не обещается без
   поддержки целевого API и reconciliation; обеспечиваем dedup и доказуемый исход.

## 5. Чтение, графы и визуальное состояние

```ts
type ReadEnvelope<T> = {
  data: T | null;
  availability: 'complete' | 'partial' | 'unavailable';
  freshness: 'fresh' | 'stale' | 'unknown';
  as_of: string | null;            // ISO timestamp for observed snapshot
  at_seq: Seq | null;             // high-water actually covered by this query
  revision: Revision | null;
  sources: Array<{
    name: string;
    status: 'ok' | 'error' | 'not_configured' | 'not_supported';
    as_of: string | null;
    error_code?: string;
  }>;
  omitted: { count: number | null; reason: string }[];
  next_cursor: string | null;
};
```

Ноль выводится только после успешного измерения нуля. Снимок при ошибке refresh
сохраняется как stale, с источником и действием повторной проверки. Пагинация/фильтр
не делают частичный граф «всей историей». DTO всегда сообщает скрытое и источник.
`seen` — состояние внимания конкретного человека; `resolved` — результат бизнес-команды.

Четыре графа имеют отдельные адреса и назначения:

- **Agent DID:** реальные наблюдаемые действия выбранного агента, созданные им задачи,
  вопросы, передачи и исходы; полная наблюдаемость зависит от capability адаптера.
- **Project DID:** объединение фактической истории всех агентов в пределах проекта,
  включая задачи, добавленные в ходе работы, и путь их происхождения.
- **Project SHOULD:** закреплённая версия целевого плана, декомпозиция и зависимости;
  выполнение отображается через ссылки на TaskRun/проверки, не меняя прошлый план.
- **Decisions:** явные основания, supersession, автор, source refs, pack и записанное
  объяснение решения. Transcript не равен скрытой цепочке рассуждений модели.

Графы — read projections, не новый mutable graph store. `task_links` и журнал
хранят отношения; deterministic layout cache можно удалить и восстановить. В DID
допустимы циклические причинные пути через разные события/итерации; в каждой версии
исполняемого SHOULD DAG цикл отклоняется до запуска. Каждое ребро имеет тип и payload;
не рисуем `informs`, если есть лишь близкие timestamps.

Preview на Project/Agent/Task: текущая работа, состояние, явный blocker, последний
checkpoint и ссылка на полный экран. Фильтры, raw refs и advanced controls — раскрытие.
Полный экран сохраняет scope, selection и back-target в route; не теряет позицию при
переходе к task/question. Наблюдаемое, заявленное и независимо проверенное не усредняются.

## 6. Долговечность и безопасность данных

Пять классов данных требуют разных правил. Их нельзя свести в переключатель «sync on».

| Класс | Источник | Восстановление |
|---|---|---|
| Бизнес-история | append-only journal | replay в изоляции; replay никогда не dispatches effects |
| Представления | versioned deterministic projectors | rebuild + hash parity, включая config_revision |
| Полномочия и operational state | identity, grants, leases, dedup, outbox/cursors | backup и reconciliation; не выбрасываются как cache |
| Внешние/локальные артефакты | transcript spool, repo files, blobs, export manifests | по manifest coverage/checksums; отсутствующий локальный источник отмечается |
| Личный рабочий контекст | local preferences/drafts | атомарная запись с revision; не перезаписывает shared project policy |

Memory backend `local|cloud` — маршрутизация чтения/записи, не доверие к содержимому.
Память сохраняет valid-time и recorded-time; актуальность версии не гарантирует её
правильность. Context pack хранит compiler/input versions, units/budget, включённые и
исключённые источники. Просмотр будущего pack не объявляется фактически переданным контекстом.

Целевой Memory Kernel из sibling contract не объявляется реализованным desktop
`memory_facts`. Category/lineage можно добавить локально совместимо; новые wire
scope/CAS/tombstone/promotion требуют отдельного released contract и conformance.

Сервисное ретро проходит категории `project | agents | harness | fabric | process`.
Default `project`; export candidates только `agents | harness | fabric`. Для вопроса о
процессе рекомендуем `kind=decision, topic=process`, сохраняя существующий kind enum.
Raw incident и verified corrective lesson различаются. Три отчёта об одном сбое — один
occurrence, не три основания для повышения приоритета.

Исходящие данные — отдельный контур с payload preview, consent revision, outbox,
suppression и server receipt. В v1 default payload запрещает свободный текст, пути,
имена проектов/пользователей, transcript и произвольную metadata. Сначала локальная
категоризация; рекомендуемое включение outbound вынесено в privacy ADR для review.
Не обещаем абсолютную анонимность: транспорт и редкие комбинации полей тоже могут
связывать сообщения. Outbound endpoint/retention/aggregation policy должен пройти gate
до активации. При opt-out pending suppress, in-flight unknown показывается честно;
повторное включение не отправляет старый suppression backlog.

## 7. Циклы, manager и усиление агентами

Каждый повторяемый механизм реализует общий контракт S15: trigger → stable window key
→ claim/epoch → bounded work → durable result → cursor commit → next due. Lease и
ownership хранятся в доверенном operational store. Истечение lease не отменяет уже
отправленный внешний запрос; новый владелец сначала reconciles unknown attempt.

Политики concurrency/catch-up/version заранее закреплены на cycle definition. Результат
одного окна не теряется при retry; пропуск/слияние окон отражён receipt. Расписание —
конфигурация, heartbeat — наблюдение, outcome — результат. В desktop v1 app-off означает
недоступный host, а не скрытую круглосуточную службу.

Manager slot имеет `role=ceo` для estate или `role=product-manager` для project.
Выбранная provider revision меняет judgement loop; fixed tool gateway, checker, authority
и проектная память сохраняются. Handoff: stop admissions → checkpoint → invalidate old
epoch → new binding admission → new epoch/context → acknowledge continuation. Не
переносятся vendor-private reasoning blocks, tokens, hidden state и неподтверждённые capabilities.

Модель/агент сильнее → можно принимать более качественные proposals при тех же
scope/checker/evidence правилах. Качество проверяется corpus/negative controls до
расширения роли, а доступ не расширяется автоматически вслед за benchmark. Стоимость,
latency, unknown usage и вмешательства человека наблюдаются отдельно. Детерминированный
core работает при `ModelPort=null` и честно оставляет judgement-вопросы нерешёнными.

## 8. Порядок реализации и критерий готовности карточки

Порядок — реальные prerequisites, а не обязательное завершение всего нижнего слоя.
S03.boundary разблокирует безопасный admission/answer; S03.effects требуется перед
автономным dispatch. M152.commit не ждёт всех plan widgets; M152.continue требует
адресованной доставки. M191 preview не ждёт полного Memory Kernel. M186 использует
cycle receipts, а отсутствующие detectors показывает unknown.

Карточка считается **специфицированной**, когда заданы: цель, source observations,
выбранное решение, вход/выход, owner/scope, invariants, ошибки/retry/restart,
migration/compatibility, файлы, воспроизводимые acceptance cases и payload каждой
зависимости. `specified` не значит `implemented` или `approved-for-activation`.

Исполнитель может выбрать локальные имена private helpers и структуру тестовых fixtures,
если это не меняет указанные DTO/семантику/границы. При фактическом расхождении с baseline
он останавливает **зависимый шаг**, сохраняет новую evidence и предлагает поправку к
контракту; не заменяет продуктовую семантику молча. Это особенно важно для внешних API,
версий SDK и редких отказов, которые исследование не превращает в константы.

## 9. Что проверяется в этой итерации

Механические gates проверяют комплектность карточек, разрешимость источников,
ссылки графа, состояния и переходы, dependency DAG и совпадение HTML с JSON. Browser
проверка проверяет навигацию/раскрытие/узкий viewport конкретного отчёта. Они не
исполняют предложенные product features и не доказывают отсутствие всех security defects.

Свежий remote CI для baseline:
[run 34070268253](https://github.com/passioncode-ai/fabric/actions/runs/34070268253).
Fast прошёл, full остановился на P21: SELECT grants для anon присутствуют на шести
таблицах. Это подтверждение нарушения ACL-ожидания теста, а не выполненная попытка
прочитать чужие строки через RLS. Карточки S02/S07 требуют обоих видов пробы.
Различие механизмов описано в [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
и [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), проверено 2026-09-07.


## 11. Уточнения после независимого review

Reservation имеет собственную сохраняемую историю: один grant допускает только один
активный/consumed reserve. Освобождение возможно отдельной атомарной командой с
доказательством отсутствия dispatch; старый intent не удаляется. Неопределённый исход
не освобождает разрешение. Полный контракт и race cases находятся в S03.

Backup включает согласованные journal, identity, operational state и blobs. Восстановление
старого снимка не возвращает старые разрешения, отозванного manager или отправляемость
feedback. Активация получает новую generation от актуального доверенного control plane,
блокирует старых writers и отдельно сверяет незавершённые effects/deliveries. Без
актуальных подтверждений среда остаётся read-only, экспорт — выключенным/в карантине.
Сценарий backup → send/opt-out/rebind → restore → activate обязателен в S12.

## 10. Персональный Fabric и пульс работы · target 2026-09-15

[Контракт appearance/activity/releases/pulse](personal-fabric-pulse.md) детализирует presentation и проекции поверх существующих S13/S14/S15 и C1–C6. [ADR-0059](../adr/0059-personal-fabric-and-evidence-backed-pulse.md) proposed: estate владеет версией облика; Project владеет источниками работы; heartbeat, host observation, schedule и verified outcome раздельны. Live — проекция журнала с cursor/coverage, не второй store. AI avatars и always-on host не блокируют R0. Пакеты P0–P6 имеют acceptance и реальные зависимости; D01 остаётся первой инженерной задачей. Эта итерация поставляет целевые макеты и спецификацию, не новый runtime.


## Memory and session retrieval refinement · 2026-09-26

[Project memory](project-memory.md) extends the Knowledge/Continuation boundaries with source-addressed capture coverage, bounded authorized retrieval and portable checkpoints (ADR-0069). Existing journal/transcript/fact/pack owners remain canonical; the R0 workspace is a target prototype. [MEM-P0…P7](../launch/memory/plan.md) names native prerequisites and negative acceptance.
