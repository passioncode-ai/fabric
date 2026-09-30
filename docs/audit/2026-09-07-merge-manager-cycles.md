<sub>ssheleg skills — project-audit · agent-sync · agent-orchestrator · agent-harness · agent-interop · ux-scenarios · ux-flows · ux-audit · sheleg-design · brand-voice · copywriting</sub>

# PassionCode.ai → Fabric: manager binding, lifecycle, единый inbox и циклы

Read-only дополнение к аудиту, 2026-09-07, HEAD `153b4f029e626230d465d5d21d02fb8c9de5fadf`. Корень всех относительных receipts: `.`. Источники: ADR, execution briefs, backlog, operating-surfaces и фактические main/shared/renderer/SQL. Native app, реальные агенты и полная suite в этом проходе не запускались; веб-проверку провайдеров выполняет родитель. Acceptance ниже — предлагаемые исполнимые fixtures, а не заявление об уже пройденных тестах.

## 1. Вывод

Выбор встроенного менеджера или Claude Code/другого агента **уже принят в ADR-0043**. У пользователя должна меняться реализация суждения, а правила, область полномочий, журнал, Board и механизм проверки должны оставаться одними. Это хорошая основа синергии с более сильными агентами: Fabric сохраняет актуальные обязательства, доказательства, контроль полномочий, непрерывность и общий рабочий контекст команды независимо от конкретной модели.

Однако M194 сегодня описывает идею, а не законченный lifecycle contract. Dependency «→ M152» недостаточна. Нет реализованного estate manager binding с ревизией и fencing, durable wake/checkpoint, проверенной смены владельца роли, общего trace для eval и безопасного результата внешнего manager. M185 и M186 также запланированы, их отсутствие не регрессия. Но их briefs опираются на предпосылки, которые текущий код не обеспечивает: Board truth, полные tool traces и наблюдаемость каждого цикла.

Действующее решение: [docs/adr/0043-the-manager-seat-is-a-binding.md:13](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/adr/0043-the-manager-seat-is-a-binding.md#L13) (binding), `:16` (fixed core/checker/floor), `:23` (wake/verify/pack), `:30` (стоимость). Текущие briefs: [docs/evidence/plans/2026-09-06-execution-briefs.md:493](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/plans/2026-09-06-execution-briefs.md#L493), `:500`, `:515`.

## 2. Что подтверждено кодом, что только запланировано

| Предмет | Факт и receipt | Статус и следствие |
|---|---|---|
| Единый manager surface, core, checker | ADR-0043:16–29; brief:515–524 | **Решено и описано, реализация впереди.** В runtime нет реализованных `settle_by_citation`/ModelPort/manager loop. Не выдавать UI selector за работающую возможность. |
| Scope binding | [supabase/migrations/20260831000001_migration_one.sql:63](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/supabase/migrations/20260831000001_migration_one.sql#L63) — `agent_bindings.project_id NOT NULL`; `:74` unique active **product-manager** per project | **Подтверждённый schema gap будущего M194.** Estate manager и project PM — разные slots; существующая таблица не принимает estate manager без фиктивного проекта. |
| Scope credentials и отзыв | [apps/desktop/src/main/agentSurface.ts:51](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/agentSurface.ts#L51) — estate/project/session/task; `:190` — revoke только текущих in-memory tokens | **Подтверждённый gap для смены manager.** Нет binding revision, role epoch или durable fence, доказывающих, что старый процесс потерял полномочия. |
| Повторное чтение протокола | `agentSurface.ts:427`, `:442`, `:475`, `:500` | `fabric_whoami` уже можно вызвать повторно; dedupe касается event. M177:234 просит часть уже существующего поведения. Нужны версия/хеш/receipt и честные adapter capabilities после compaction. |
| Сигнал «прочитал правила» | `agentSurface.ts:447` пишет **`session.oriented@1`**; catch:452 сохраняет обслуживание при неудаче записи | **Документальный дефект.** ADR-0040:43, backlog M179:665, brief:269 и `agent-visibility-and-runs.md:150` ждут `context.read`. Watch по этому имени будет ложным. Отсутствие записи не доказывает отсутствие прочтения; запись делается до завершения ответа. |
| Heartbeat, outside watch, taxonomy | brief:242–279; [apps/desktop/src/main/pty.ts:474](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/pty.ts#L474) реально running/idle/ended, silence-based | **Запланировано.** Heartbeat — утверждение агента, elapsed/server receipt и process exit — наблюдения. Из молчания нельзя достоверно вывести «сломался skill» или «MCP недоступен». |
| Trace для M176 | [apps/desktop/src/shared/surfaceTools.ts:11](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/shared/surfaceTools.ts#L11) прямо говорит, что counts отсутствуют; read-tools не journalled | **Подтверждена ложная предпосылка плана.** [docs/evidence/backlog.md:662](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L662) говорит, что corpus/trace уже есть, потому что every tool call journalled. Полной траектории сейчас нет. |
| Wake on Board delta | [apps/desktop/src/main/index.ts:1339](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/index.ts#L1339) — один 60s interval; `routineTick.ts:50`; [apps/desktop/src/shared/routine.ts:21](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/shared/routine.ts#L21) — everyMinutes/lastRunAt | **Запланировано, существующий scheduler не эквивалентен контракту.** Нет watermark/coalescing/role lease/causation-aware wake. |
| Inbox | [apps/desktop/src/renderer/src/Feed.tsx:26](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/renderer/src/Feed.tsx#L26) — seq/time/sentence/project без раскрытия/deep link; M185 brief:493 | **Запланировано.** Safe detail DTO и корректный Board нужны до сборки объединённого экрана. |
| Cycles | `index.ts:1351` routine + chain; `:1719` native notifier; `shared/automations.ts:20` outcomes только ran/paused | **Частичный runtime фундамент.** ran означает «запустил task», не успешное завершение. Нет общей истории start/finish/error для каждого producer. |
| Приложение выключено | [docs/adr/0037-the-telegram-bot-answers-by-reply-and-fabric-has-no-always-on-process.md:40](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/adr/0037-the-telegram-bot-answers-by-reply-and-fabric-has-no-always-on-process.md#L40) | **Принятое ограничение**, не поломка. Нельзя обещать мониторинг или wake при выключенном единственном host. |
| M155 brief | [docs/evidence/backlog.md:641](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L641) и order:82; отдельной секции M155 в execution briefs нет | **План неполон.** Добавить bounded brief с refused/observed/advice, detections и negative controls. |

## 3. Минимальный precise contract manager role

Ниже **предложение**, совместимое с ADR-0043. Это не существующая API и не новый принятый ADR. В монолите достаточно отдельных модулей `roleBinding`, `commandGateway`, `wakeCoordinator`, `managerPack`, `cycleObservation`, `providerAdapter`; отдельные микросервисы здесь не обоснованы.

### 3.1 RoleSlot, revision и lease

- `RoleSlot = {estate_id, role, scope}`; scope различает `estate` для manager/CEO и `{project_id}` для project PM. Реестр должен предотвращать два активных binding на один slot. Никаких скрытых «проекта CEO» для обхода NOT NULL.
- `BindingRevision = {binding_id, revision, role_slot, provider_ref, placement, capability_profile, policy_revision, enabled}` — immutable. Правки конфигурации создают revision, execution сохраняет исходную привязку. Это продолжает ADR-0021:32, где смена placement создаёт новую ревизию, active Runs остаются pinned.
- **Отдельный монотонный epoch роли** выдаётся серверной транзакцией: `{slot, epoch, active_binding_revision}`. Revision отвечает, с какой конфигурацией исполняли; epoch отвечает, кто вправе действовать сейчас. Одного номера config_revision недостаточно; его текущий rebuild defect уже зарегистрирован M198 ([docs/evidence/backlog.md:682](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L682)).
- `RoleLease = {slot, epoch, owner_execution, expires_at}`: один активный владелец, TTL и clock в БД, renewal проверяет epoch. Локальный `ticking` bool не защищает после restart и между двумя hosts.
- Проверка epoch/binding/lease/scope выполняется **в write boundary той же транзакции, что принимает command**, включая финализацию результата; не только при spawn. Отзыв токена в памяти остаётся ускорением, но не authority. Reads с чувствительными данными тоже проверяют текущую credential policy.
- При смене менеджера: атомарно активировать successor revision и увеличить epoch, прекратить новые действия старого, потребовать cancel старого исполнения, передать successor оставшиеся eligible wakes. История старого исполнения сохраняется. Старый процесс может ещё жить, но не завершать новые mutations с отозванными правами.
- Завершение already-dispatched внешнего эффекта нельзя отменить отзывом. UI показывает `unknown/reconciling`, пока нет наблюдаемой квитанции. «Менеджер заменён» не означает «его внешние операции отменены».
- Полномочия выводятся из credential и binding, а не из `role`, project или actor, присланных в body. Встроенный manager вызывает тот же CommandGateway, что внешний MCP manager: обход Policy для builtin запрещён.

Необходимое уточнение ADR-0021: pinned revision в истории сохраняется, но не продлевает revoked authority. Смена placement без revoke и аварийный revoke — разные операции. Политика drain может существовать явно, но не должна незаметно позволять двух действующих manager.

### 3.2 Native session и Fabric Run

[docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md:19](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md#L19) уже определяет **Run = session, связанная с task**, без нового id. Поэтому provider-native Claude/Codex thread/session id — optional opaque reference адаптера, не идентификатор истины Fabric.

Для task execution сохранить `(task_id, fabric_session_id)`; native resume допускается только при capability и совпадении binding/placement/policy. Иначе новый Fabric session с явной ссылкой на прошлую попытку и проверенный checkpoint. Нельзя назвать новый provider session «продолженным» без receipt.

Для manager wake, у которого нет task, ввести **cycle invocation** с wake/attempt identity и optional execution session. Встроенный in-process loop вообще может не иметь native session. Не создавать фиктивную task ради соответствия экрану Runs и не заводить отдельный независимый Run store. Journal + rebuildable projection могут хранить cycle attempts; точную терминологию нужно явно согласовать с ADR-0042. Текущий `AgentScope.projectId` обязателен (`agentSurface.ts:54`), поэтому расширение estate scope необходимо также на MCP/pack/query границе.

## 4. Lifecycle: проверить → разбудить → получить результат → восстановить

### 4.1 Admission

Перед активацией selector показывает scope/placement/реально проверенные capabilities и цену wake. Проверить runner presence, required manager tool transport, policy floor, pack availability, quota/budget, active slot lease. Missing optional skill может дать degraded execution с записью. Missing **обязательного** command channel или evidence source не даёт начать автономные mutations.

Это сильнее сегодняшнего общего fallback: `index.ts:257–263` допускает продолжение запуска после ошибки AgentSurface; `sessionBundle.ts:61` возвращает null при отсутствии endpoint. Для ручной standalone CLI это допустимая деградация. Для manager роль требует канала, через который и существуют все её результаты; иначе получится непривязанный к Board терминал с полномочиями ОС.

### 4.2 Wake contract

1. Eligible triggers: manual, cadence, **значимый** Board delta, принятый адресный handoff. Каждая причина имеет устойчивый id/seq, scope и causation.
2. Coalesce: 100 релевантных delta до старта образуют один wake. На slot один active attempt; поступившие во время работы события остаются в pending window.
3. Перед исполнением фиксировать `{from_seq, through_seq, input_ids, pack_hash, binding_revision, policy_revision}`. Manager pack содержит Board slice, необходимые facts с actor/source/date/validity, открытые questions, trust ceiling и ограничения полноты. Lockfile journalled до выдачи pack.
4. Только успешная фиксация command receipts + checkpoint продвигает `completed_through_seq`. Crash до checkpoint не теряет события. После crash надо сначала найти команды по idempotency keys/receipts, затем продолжать, не повторять всё слепо.
5. События собственного heartbeat/tool trace/checkpoint/пересчёта ранга не создают следующий wake. Список wake-worthy event classes явный. **Не запрещать весь causation root:** реальный результат worker, которого запустил manager, должен разбудить manager, хотя causal root тот же. Нужны consumed event ids, тип события и ограничение глубины/hops.
6. Backoff exponential+jitter, общий cap попыток **на wake через всех providers**, cooldown после повторных отказов, runtime/token/cost ceilings, concurrency/start-rate limits. Это продолжает `ceo-runtime.md:121–128`; не каждый provider получает новый бюджет retries.
7. Unknown quota/неподтверждённая цена дают явное недоступное автономное исполнение по policy. Безопасно продолжает работать deterministic core. Ошибку quota нельзя трактовать как «всё свободно».
8. Manual «проверить сейчас» — диагностический запрос; «разбудить» — постановка eligible wake. Повторные клики coalesce. UI не обещает вторую конкурентную сессию. «Retry» доступен, когда причина исправлена или retry явно разрешён policy; неизвестный внешний эффект сначала reconcile.

**Catch-up по типу:** ordinary routine выполняется один раз после пропуска (`shared/routine.ts:5`); вечернее письмо сохраняет день и отправляет каждое пропущенное окно, помечая поздним (ADR-0037:49). Нельзя без решения унифицировать их в один алгоритм «свести всё в один wake». Конкретный producer объявляет catch-up policy и bounds.

### 4.3 Handoff/mailbox между агентами

Здесь нужна не бесконтрольная общая переписка, а адресуемое намерение с квитанцией. Durable mailbox — projection journal, а не новый архив истин рядом с памятью.

Минимальное сообщение: `{message_id, command_id, estate_id, sender_execution, recipient_slot|recipient_binding_revision, project_scope, subject_ref, input_refs, expected_result_schema, evidence_refs, reply_to, causation_id, idempotency_key, payload_hash, expires_at}`. Передавать именованные артефакты и их hash/schema/source, а не строку «продолжи выше».

- Role-addressed pending message может получить новый binding по явно определённой политике. Binding-addressed сообщение нельзя незаметно переприсвоить другому агенту.
- Delivery/claim/accepted/completed — разные факты. Состояния, которые требуется различать: queued, claimed, accepted, completed, rejected, expired, cancel_requested, cancelled, unknown. У одного сообщения один действующий fenced consumer.
- Повтор того же key+payload возвращает тот же receipt. Тот же key с другим payload — conflict, не новый side effect. Timeout после commit узнаётся по key; отсутствие ответа не означает отсутствие исполнения.
- Cancel request сначала fencing запрещает новые действия; observed termination или явный provider receipt подтверждает cancelled. На crash/restart reclaim только просроченной lease, unknown dispatched effect требует reconcile.
- Не считать передачу данных передачей полномочий. Ссылки на другой project проверяются по source/recipient visibility. Cross-project knowledge идёт через принятые evidence/proposals и target PM, а не раскрытием всех raw facts.
- Текст артефакта/чужого агента — untrusted input. Только typed command с проверенной authority изменяет Board. Transcript не является output channel (ADR-0043:29,37).

Для project task сохраняются требование именованного handoff и receipts из протокола; новым manager messages не следует обходить текущий task graph и evidence модель. `operating-surfaces.md:17` уже требует ограниченный disposable context и единственный durable дом знаний.

## 5. M155 + M177–M181: что именно проверяет harness

M155 должен получить собственный brief, с тестом для каждого detector и negative control:

| Уровень | Действие | Что считать доказательством |
|---|---|---|
| REFUSED | недопустимый переход done, mutation без текущих scope/lease/grant, неименованный handoff, command после revoke, превышение loop/budget | atomically rejected command receipt; не полагаться на правильный prompt |
| OBSERVED | не подтверждённая ориентация, review без brief, held lease после session end, heartbeat gap | observed fact + classified uncertainty + deduped Board obligation |
| ADVICE | качество вопроса, глубина insight, стиль обоснования | eval/human feedback; не блокировать контрактом субъективное качество |

Основание tiering: [docs/evidence/backlog.md:641](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L641), [docs/architecture/board-and-ceo.md:355](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/board-and-ceo.md#L355). Не добавлять per-session question cap: brief `:337` явно фиксирует его отказ; runaway asker агрегируется hygiene M153 в один actionable item.

**M177:** дата должна содержать timezone/observedAt; факт — actor kind/source/validity. Протокол возвращает `protocol_revision`/hash/allowed vocabulary; pack хранит выданную версию. Повторное чтение уже работает, поэтому acceptance должна проверять известное изменение версии и adapter поддерживаемую reassertion, а не только «функция дважды вернула строку». Если CLI не сообщает compaction, показывать «compaction notification unavailable»; не обещать автоматическое восстановление.

**M178:** отдельно записывать phase claim агента и server receivedAt. Нельзя вычислять здоровье по произвольному времени клиента. `waiting_on` должен ссылаться на реально открытый question/grant в допустимом scope; после разрешения/expiry wait не может навсегда маскировать отсутствие прогресса. Heartbeat остаётся наблюдаемым требованием, а не искусственным запретом всякого worker task. Отсутствующая у runner capability обозначается unknown/unsupported, а не автоматически «agent wedged».

**M179/M180:** canonical event — `session.oriented@1`, не `context.read`. Отсутствие orientation = «не удалось подтвердить получение протокола», потому что append может упасть, а ответ уйти (`agentSurface.ts:452`). Существующая запись создаётся до завершения ответа; она также не доказывает доставку, понимание или следование правилам. Отсутствие tool calls совместимо с reasoning/длинным tool/выключенным приложением. `skill-failed-to-load` нужен actual load failure receipt; `harness-unreachable` — проверка transport. Иначе unknown/suspected, с фактами и последним временем наблюдения. Agent-crashed и task-failed-honestly должны сохраняться раздельно (brief:272–276).

**M181:** матрица required/optional capabilities на роль. Отсутствие advisory model: детерминированные rank/hygiene/digest продолжают работу, суждение unavailable. Потеря обязательного tool channel: manager paused с понятным исправлением. Частичный notifier: «из N источников доступны K», receipt источника и возраст, без выдуманной полноты.

**M176 до tuning:** нужен bounded redacted generic invocation trace: execution/command/binding revision/epoch, tool name, input ref/hash, started/completed/refused/error, duration, usage только когда реально доступен. Бизнес-событие и transport call — разные вещи. Read-tools тоже важны для причинности, но raw args/prompt/secret не нужны в audit feed. `surfaceTools.ts:11` опровергает предпосылку backlog M176 о готовом полном корпусе. Сначала fake builtin + fake external через один gateway и seeded traces, потом реальные собранные траектории и tuning M175. Порядок F в `agent-visibility-and-runs.md:170` (…M175→M176) противоречит brief:528; исправить плановую проекцию, не добавлять ещё один вариант порядка.

## 6. M185: единый inbox, который помогает действовать

Две lanes уже решены и совместимы с отсутствием Board store (`board-and-ceo.md:174`; brief:493):

- **Нужно ваше действие:** единый `BoardItem` query по актуальным obligations/questions. Stable id, субъект/проект, кто/почему ждёт, срок/criticality, точное действие и evidence. Не mark-read/dismiss; разрешение меняет исходный предмет. Если действие уже выполнил коллега, показать актуальный outcome вместо повторного submit. Состояние pending и idempotency защищают double-click.
- **Произошло:** безопасная история событий с actor, временем, субъектом, result/evidence и scoped deep link. Прочтение не разрешает obligation. Если нужен read cursor, это локальное предпочтение пользователя, не новая бизнес-истина.

Фразу brief:496 «expands to payload» заменить на **typed safe event detail**. Сырой journal payload содержит введённые человеком/агентом данные и evidence, иногда частный текст; одна regex redaction не даёт универсальной гарантии. Нужен allowlisted DTO по event kind: summary/actor/subject/outcome/evidence refs/target. Доступ проверяется до count, list и detail. Нет доступа к субъекту — нет утечки названия в notification.

Текущие проблемы readAttention должны закрываться до новой оболочки: `index.ts:1636` читает независимо, `:1652` берёт последние 50 policy decisions, `:1684` фильтрует refusals без current grant resolution. Неразрешённое может исчезнуть после 50 других событий, разрешённое — оставаться. Это RT07 из предыдущего аудита; актуальный Board обязан отражать состояние, не окно истории.

UX: при load error показывать «данные недоступны, последний снимок …», не «ничего не ждёт». Сохранять focused item при realtime insert/reorder, group bursts, stable keyboard navigation. Count появляется из того же scope/query, что список. Notification click ведёт в конкретный item; текущий `index.ts:1738` лишь фокусирует окно. Native preview минимален и безопасен. Неподтверждённая доставка notification не закрывает задачу и не делает obligation прочитанной; текущий `told.add` происходит до `n.show` (`index.ts:1736`).

При «старый вопрос → новый manager» карточка должна сохранить владельца вопроса, основания, применённую decision и ссылку на выполнение, чтобы человеку не требовалось читать чаты двух агентов.

## 7. M186: observability начинается у producer

«UI поверх имеющихся данных» недостаточно, если producer не записывает запуск, завершение и ошибку. Это уже частично признано v4 brief:504–508. Heartbeat M178 не создаёт недостающие события автоматически.

| Producer | Что существует сегодня | Что добавить до заявления о health |
|---|---|---|
| Routine tick | `index.ts:1339`, `routineTick.ts:50`; ran/paused событий достаточно для старта task | tick started/finished/outcome, lease/owner, last success, error, checkpoint; отличать dispatcher success от task success |
| Chain advance | `index.ts:1350`; вызов параллельно routine tick | собственный cycle id/attempt/receipt; сначала RT02/03/10 correctness, затем health. «Функция вызывалась» не доказывает исправную цепочку |
| Native notifier | `index.ts:1717` in-memory told; `:1719` interval; ошибки только console:1744 | attempt/source availability/result; immutable obligation pointer; отсутствие подтверждения доставки обозначить буквально |
| CEO rank/hygiene, board review | briefs M153/M166 и future loop | объявить как planned/unconfigured, пока нет producer; отдельный record skipped-no-delta без model wake |
| Retro, evening letter | future briefs/ADR-0037 | registry entry после реализации; event windows, partial sources, catch-up policy, retry receipts |
| Provider recovery check | `ceo-runtime.md:123` — проектное требование | отдельный diagnostic cycle при реализации ModelPort, реальный capability/health source |

Предлагаемый контракт наблюдения (journal + projection): `{cycle_id, kind, scope, definition_revision, executor_host, enabled, cadence, catchup_policy, trigger_id, attempt_id, lease_epoch, started_at, finished_at, outcome, last_success_at, error_kind, error_ref, pending_window, completed_through_seq, observed_at}`. `next_due` выводится из конфигурации/receipt, не фиксируется вторым независимым scheduler state. Для event-triggered cycle next due может быть «при новом релевантном событии», а не фальшивой датой.

**Не помещать всё в одно пятизначное поле.** ADR-0040 states `working/waiting/quiet/stalled/gone` описывают liveness активного исполнителя. У цикла есть ещё availability (`enabled/disabled/app_off/source_unknown/not_configured`), last outcome (`succeeded/failed/refused/partial/unknown`) и lateness. Failing-but-alive — alive + last outcome failed; disabled не «gone agent»; scheduled waiting не fault. Пять agent states можно применять к active cycle execution, показывая рядом состояние scheduler. Это уточнение модели, не повод заочно отменять ADR.

App-off: ADR-0037:42 прямо говорит об Electron timers и отсутствии always-on. На единственном выключенном host никто не измеряет gap онлайн. На следующем открытии UI должен показать «не исполнялось, приложение было закрыто/host не наблюдался», age последнего known state и конкретный catch-up. Если точного факта закрытия нет (power loss), формулировка «host не наблюдался», а не доказанное выключение. Удалённый observer/relay — отдельная будущая placement capability, не обещание local UI.

Если journal недоступен, невозможно надёжно записать в него собственную ошибку. Нужен bounded локальный redacted diagnostic buffer/health overlay с «источник недоступен» и original observedAt, последующая запись recovery; он не становится источником бизнес-успеха. Полностью зависящий от той же сломанной DB health dashboard будет показывать последний зелёный snapshot.

## 8. Старые blockers, которые M194 усиливает

Подробные механизмы, executable reproductions и severity сохранены в `/tmp/fabric-audit-runtime.md`, `/tmp/fabric-audit-runtime.json`, `/tmp/fabric-runtime-probes.mjs`, `/tmp/fabric-runtime-probes-output.txt`. Родитель наблюдал только local fixture activity; последствие в реальной эксплуатации не доказано. Здесь **latent с воспроизводимым механизмом**, не сообщение о фактической утечке/чужом запуске.

| Gate перед autonomous manager | Существующий дефект/receipt | Почему selector не может считаться готовым |
|---|---|---|
| Scope isolation | RT01 `routineTick.ts:56` и `chainAdvance.ts:43` без estate predicate; main service-role | manager estate wake увеличит blast radius ошибочной выборки |
| Dispatch correctness + quota | RT02 `chainAdvance.ts:68`, `:127` повторный новый task; RT03 `quota.ts:181`/`quotaGate.ts:61` malformed 200 пропускается; chain без quota gate | больше интеллекта увеличит число/стоимость неверных запусков |
| Atomic authority + truthful effects | RT04 `agentSurface.ts:1209` зовёт recordEffect при permission request; `policy.ts:228` пишет executed без внешнего receipt; RT05 `policy.ts:130` grant без project/action, consume неатомарен | сильный manager способен уверенно повторять неверно разрешённые действия; нужен command id + reservation + dispatch + observation |
| Secret boundary | RT06 `policy.ts:163` raw reasons обходят appendRedacted; `agentSurface.ts:1190` effect args идут в Policy | M185 raw payload и M176 raw trace размножат уже известный канал |
| Current Board truth | RT07 `index.ts:1652` last50 и unresolved semantics | manager автоматически решает не тот набор обязательств |
| Atomic graph validation | RT10 `agentSurface.ts:1112` ignores RPC error; precheck отдельно append | parallel managers/workers создают race даже с корректным текстом |
| Revision replay | M198 [docs/evidence/backlog.md:682](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L682) | checkpoint pinning нельзя строить на revision, который меняется от replay |
| Process isolation + voluntary effects | CO-090 [docs/evidence/specs/2026-08-16-software-fabric-carryover.md:101](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/specs/2026-08-16-software-fabric-carryover.md#L101); существующее M140 ([docs/evidence/backlog.md:614](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L614)) | роль в MCP не ограничивает все полномочия ОС у same-uid CLI. До сильных unattended claims нужен выбранный isolation profile и mediated actions; не обещать всем runner одинаковую защищённость |
| Runner passport | CO-074 там же `:85` | spawn/stream/interrupt/resume/result/budget/bare-mode должны быть проверены по capability; provider label не доказательство поддержки |

M140/CO-090 нельзя «закрыть документацией» о добровольном использовании effect_request. Можно выпустить явно ограниченный trusted-local tier, но full autonomous tier требует выполняемой границы и отрицательного теста обхода.

## 9. Проверенный порядок работ для включения в общий план

1. **Исправить документационный contract drift**: `context.read` → actual orientation event, M176 corpus claim, F-order, explicit supersession в `ceo-runtime.md:86–90` (там старый отказ CLI CEO, позже ADR-0043 его разрешает). M177 переформулировать вокруг revision/receipt. Не переписывать append-only ADR; исправлять исполняемые проекции и при необходимости новым ADR уточнять новый контракт.
2. **Закрыть correctness/security gates выше** с точечными regression tests. Gate не означает ожидание новой модели; это основа текущих routines/chains и будущего manager.
3. **Описать и реализовать RoleSlot/BindingRevision/epoch/lease + CommandGateway.** Отдельная migration/contract задача как часть M194; estate vs project scope; conditional receipt/epoch; replay tests. Никакого нового store Board/Run/graph.
4. **M177 → M178 + отдельный M155 → M179/M180/M181**, с honest detection и scope checks. Эти работы полезны существующим workers до manager.
5. **Board M148/M149/M151/M152 и correctness нескольких одновременно blocking questions**, deterministic hygiene M153/M184; M157/M158 citation/routine authority не ждать provider. Они определяют предметы, на которые wake подписывается.
6. **Cycle producer instrumentation + wake/mailbox/checkpoint**, shared budget admission, recovery. M186 reader можно выпускать по существующим producers, будущие обозначать как ещё не настроенные/плановые; не ждать реализации всех шести ради первых полезных наблюдений.
7. **M166/M167/M168 fixed core+port+checker, trace contract + M176 fixtures**, затем M194 builtin/external equivalence и selector. M175 prompt/loop tuning только после eval. Capability passport и revocation тест обязательны для каждого enabled external seat; не блокировать deterministic tools отсутствием ModelPort.
8. **M185 unified inbox** после current Board query, safe details, idempotent actions и scoped links; **M186 cycles** после producer contracts. M188 проекция task Runs использует heartbeat; manager cycle identity не заставляет переделывать Task Run ontology.

Так M194 имеет явные prerequisites scope/fencing/commands, Board, manager floor, health, capabilities и trace/eval, а не только M152. Не стоит сводить всё к длинному линейному блокеру: безопасные детерминированные улучшения, instrumentation существующих циклов и read-only UI могут идти параллельно, но claim «autonomous external manager готов» получает отдельный gate.

## 10. Исполнимые acceptance cases (предлагаемый test contract)

Следующий пакет использует fake clock, fake provider, fault-injected Journal/RPC и isolated test estate. Реальные CLI/модель/продакшн эффекты не нужны. Pure и renderer fixtures включаются в существующий Vitest runner: `pnpm --filter @fabric/desktop exec vitest run src/shared/managerWake.test.ts` — после создания указанного файла; `.mjs` probes запускаются через `node`, как текущие `apps/desktop/test/*.test.mjs` ([apps/desktop/package.json:15](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/package.json#L15)). Транзакционные invariants — в существующем SQL/probe harness на изолированном datastore. Названия файлов ниже **предлагаются**, пока их не существует.

| Fixture / сценарий | Arrange → act → assert |
|---|---|
| `roleBinding.test.ts` / atomic switch | binding v1 держит lease; switch v2 и старый command одновременно → только один current epoch; старый refused; новая команда accepted once; история v1 сохранена |
| `roleBinding.probe.mjs` / два host | два параллельных acquire одного slot → один owner; expiry+renew старого после нового acquire → fence reject |
| `managerWake.test.ts` / coalesce | 100 Board delta до tick → один wake/один pack through_seq; ещё 3 delta во время run → ровно один следующий pending window |
| `managerWake.test.ts` / no recursion | 100 своих heartbeat/checkpoint/rank events → ноль новых wakes; worker result в том же causal root → один релевантный wake |
| `managerWake.test.ts` / failure matrix | crash до command, после command commit до response, после receipt до checkpoint → ни потерянного delta, ни второго эффекта; receipt найден по key |
| `commandGateway.probe.mjs` / idem | одинаковый key+payload после timeout возвращает прежний receipt; key с изменённым payload отклонён; две concurrency попытки дают один accepted effect |
| `managerCancel.test.ts` | cancel_requested при живом provider → UI ещё не cancelled; observed exit подтверждает; уже dispatched неизвестный effect остаётся unknown/reconcile |
| `managerRecovery.test.ts` | restart с passport resume=false → новая Fabric session с checkpoint ref; прежняя native identity не объявлена resumed; pending mutation сначала reconciled |
| `managerFloor.test.ts` | fake builtin и fake external: одинаковые citation/criticality/trust cases → одинаковые allowed/refused receipts; prose «я всё решил» не изменяет Board |
| `managerAdmission.test.ts` | обязательный MCP down, quota 200 `{}`, unavailable placement → ни одного автономного spawn; deterministic core доступен; reason назван; cloud fallback не случился |
| `protocolObservation.test.ts` | whoami дважды вернул protocol; journal append один раз fault → отсутствие orientation классифицируется unconfirmed, не skill-failed; catalog gate ловит несуществующий `context.read` |
| `liveness.test.ts` | real working, valid waiting, expired waiting_on, quiet, stalled suspect, ended, runner heartbeat unsupported, laptop sleep → состояние+reason без доказанной причины из молчания |
| `failureKind.test.ts` | loader exit evidence → skill-failed; tool silence без evidence → unknown; typed honest task failure → review; process crash → crashed |
| `managerPack.test.ts` | одинаковый about, stale evidence, agent-authored fact vs person fact, revoked visibility → отказ автоsettlement при невалидном основании; точный pack hash/through_seq повторяется |
| `cycleObservation.test.ts` | healthy, late, stopped, failed-but-alive, disabled, not-configured и source DB unavailable → отличимые availability/outcome/liveness, виден last observed age |
| `cycleCatchup.test.ts` | три пропущенных дня: ordinary routine → один запуск; letter producer → три window keys с late label; cap ограничивает burst, не теряя окна |
| `Inbox.test.tsx` | 51 новых events не удаляют старую unresolved obligation; разрешение удаляет из needs-you и оставляет happened; double-click → один command |
| `Inbox.test.tsx` / privacy | synthetic token/private payload не появляются в DTO/native preview; чужой estate не влияет на counts; denied deep link не раскрывает subject |
| `Inbox.test.tsx` / interaction | realtime insert не теряет фокус выбранного item; keyboard action открывает тот же receipt; read failure показывает stale/error, не zero items |
| `cycleReplay.probe.mjs` | replay дважды → тот же binding revision/epoch history, completed watermark и current projection; replay не повторяет side effect |
| `managerCapabilities.test.ts` | passport без budget/resume/heartbeat flags → не заявляются эти функции; required capability absent запрещает автономный seat; optional absent создаёт visible degradation |

Набор должен проверять не только итоговые строки состояния, но command receipts, количество dispatch, scopes и source-of-truth после recovery. Existing suite green не заменяет эти проверки новых контрактов.

## 11. UX конкретно для manager выбора и работы

На карточке роли: «Менеджер Fabric»; текущая реализация builtin/конкретный runner; scope и placement; enabled capability badges; последнее проверенное состояние с возрастом; активный wake или ожидание причины. В picker стоимость показывать как механизм: внешний runner запускает session на wake; для builtin отдельно цена model calls, если они включены. Не обещать builtin «бесплатный», потому что in-process ≠ без оплачиваемой модели.

Действия: «Проверить подключение», «Запустить проверку Board», «Приостановить», «Сменить менеджера». При смене показать старое исполнение как завершающееся/отозванное, новое как current; очередь и история остаются у роли. При отсутствии модели core продолжает выдавать понятный Board/digest, а judgement visibly unavailable. При выключенном local executor «ожидает запуска приложения», с последним наблюдением.

В подробностях wake: причина и relevant delta; с какой версией pack/policy/binding начал; какие named commands принял gateway; какие доказательства получены; что ещё ждёт человека; сколько потрачено и насколько точны эти данные. Raw transcript — отдельная диагностическая ссылка с доступом, не результат работы и не основной интерфейс управления.

Inbox и cycles ссылаются на те же items/attempts/receipts. Человек должен за один переход понять «кто ждёт чего, почему не продвигается, какое действие безопасно сделать», без сопоставления журналов разных CLI. Эта непрерывность и проверяемость — устойчивое преимущество Fabric по мере усиления моделей.

## 12. Граница проведённой проверки

В этом проходе подтверждены source contracts и конкретные расхождения текущего кода/документации. Предложенный lifecycle не реализован и fixtures не выданы за исполненные. Предыдущие runtime reproductions и результаты сохранены в [evidence базового аудита](2026-09-07-evidence/index.md); существующая suite выполнена в базовом проходе этого же HEAD. Ни native app, ни реальные agents, ни production mutations здесь не выполнялись.

Применены ранее прочитанные `project-audit` (разделение факта, planned и consequence) и `ux-audit` (путь пользователя через code receipts и acceptance). Пакеты безопасности/архитектуры здесь не выданы за отдельно проведённый skill audit. Реестры M/CO/ADR и исходники не изменялись.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`project-audit`](https://github.com/ssheleg/task-pipeline) — сверка фактов проекта и объединение планов
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — проверка видимости параллельной работы
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — жизненный цикл менеджера и границы полномочий
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — проверяемость прогонов и контекста
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — границы внешних агентов и протоколов
- [`ux-scenarios`](https://github.com/ssheleg/super-ux) — покрытие требований сценариями
- [`ux-flows`](https://github.com/ssheleg/super-ux) — цепочки экранов и восстановление
- [`ux-audit`](https://github.com/ssheleg/super-ux) — проверка графов памяти и рабочих сценариев
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — плотность и визуальная иерархия
- [`brand-voice`](https://github.com/ssheleg/super-ux) — иерархия PassionCode.ai и Fabric
- [`copywriting`](https://github.com/ssheleg/super-ux) — термины и объяснение состояний
