# Контракты первой поставки: производители, данные и отказы

**Рекомендуемая спецификация, 15 сентября.** Этот документ углубляет архитектуру R1 до интерфейсов и правил хранения. Приведённые DTO — проект для review, не уже экспортируемые типы и не новая версия внешнего wire. Общие `ReadEnvelope`, `CommandResult`, `Ref`, `Revision` и `Seq` принадлежат [системному контракту](../../architecture/system-contract.md); при внедрении переиспользуются либо мигрируют совместимо. Контекст: [README](README.md), [пакеты](packets.md). Исходная ревизия `d0260d430797f16dfaad1fde53a72afbed503893`.

## 1. Что уже имеет производителя

Проверено чтением исходников и точек сборки, **не новым запуском агентов или базы**. Ссылки фиксируют исходную ревизию. Результаты старых тестов — в соответствующих receipts, а не повторно приписаны этой итерации.

| Шов | Производитель / точка включения | Что переиспользовать | Что ещё проверить/доделать для R1 |
|---|---|---|---|
| TaskRun | [migration 49](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/supabase/migrations/20260909000049_task_runs.sql), [runLifecycle](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/runLifecycle.ts#L78), [assembly](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/index.ts#L2031) | admitted invocation, bind к настоящей session, end/reconcile | CO-126: delivery ack и generation; происхождение всех интересующих событий, полнота plan steps |
| Запуск существующей работы | [admitExisting](../../../apps/desktop/src/main/admitExisting.ts), [chainAdvance](../../../apps/desktop/src/main/chainAdvance.ts) | Одна admission RPC, lease и quota admission | CO-122: crash после dispatch и до receipt, reconciliation перед новым запуском |
| Ответ → дальнейшая работа | [answer handler](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/index.ts#L2674), [continuationDelivery](../../../apps/desktop/src/main/continuationDelivery.ts) | Атомарный ответ/decision и отдельная доставка | Наблюдать состояние в обоих placements Agent; не принимать записанный ответ за подтверждённое продолжение |
| Контекст для агента | [compileContextPack](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/contextPack.ts#L138), [launch caller](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/index.ts#L451), [preview caller](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/index.ts#L1368) | Один компилятор и отдельный dry preview | CO-154: явное происхождение historical compiled pack; отсутствие receipt не заполнять новым preview |
| Возврат и непрочитанное | [digestRead](../../../apps/desktop/src/main/digestRead.ts), [digest IPC](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/index.ts#L3015) | Boundary путешествует с payload | Общий estate/feed cursor ещё не считать тем же механизмом; старый `number` seq переводить только при доказанной точности |
| Цикл | [cyclePort](../../../apps/desktop/src/shared/cyclePort.ts), [receipt failure observation](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/main/index.ts#L2159) | Window states, bounded starts, worst-of outcomes | Включить next/last/health в UI; не заявлять per-source cursor для старого агрегированного pass без такого producer |
| План и решения | [planOf](../../../apps/desktop/src/shared/plan.ts), [lineagesOf](../../../apps/desktop/src/shared/decisions.ts) | Задачи без цели сохраняются; supersession с проверкой неполноты | Graph routes/expansion, causal joins, historic source navigation; CO-148/149/150/152/155/156 |
| Избранные проекты | [favourites](../../../apps/desktop/src/main/favourites.ts), [consumer](https://github.com/passioncode-ai/fabric/blob/d0260d430797f16dfaad1fde53a72afbed503893/apps/desktop/src/renderer/src/EstateHome.tsx#L140) | Существующий store, revision и конфликт | Стабильный полный order, distinction personal ordering/business priority, видимый отказ сохранения |
| Fabric-agent | [managerEval](../../../apps/desktop/src/shared/managerEval.ts), текущие M166…175/194 | Checker corpus и deterministic границы | Полный активируемый manager profile не доказан этим наличием; узкий профиль ниже нуждается в реализации и activation evidence |

**Следствие:** D01 начинается с этой таблицы, а не с повторного поиска всего проекта. Нельзя из отсутствия полного graph producer вывести отсутствие TaskRun. Нельзя из существования TaskRun вывести полноту истории и надёжность любого continuation.

## 2. Контекст для человека — C1

Owner: Knowledge. Consumers: Home, Project, Agent/IDE, Fabric-agent read tool. Используем один запрос на выбранный scope с независимыми source receipts; failure одного source даёт partial по общему envelope. Это целевая композиция; legacy `digestFor` при отказе content read сейчас бросает ошибку, поэтому его исключение должно явно переводиться в source failure, а не незаметно в пустой массив.

```ts
type ContextSubject =
  | { kind: 'estate'; estateId: string }
  | { kind: 'project'; estateId: string; projectId: string }
  | { kind: 'taskRun'; estateId: string; projectId: string;
      taskId: string; taskRunId: string };
type ContextClaim = {
  text: string;
  basis: 'person_decision' | 'agent_claim' | 'observed' | 'verified';
  sources: Ref[];
};
type ContextView = {
  subject: ContextSubject;
  goal: ContextClaim | null;
  initialBrief: Ref | null;
  activeWork: Ref[];
  lastDecisions: Ref[];
  changesSinceVisit: Ref[];
  blockers: Ref[];
  nextSteps: ContextClaim[];
  historicalPack: { receipt: Ref; digest: string; included: Ref[] } | null;
  related: { target: Ref; relation: string; evidence: Ref[] }[];
};
// readContext(subject, cursor?) -> ReadEnvelope<ContextView>
```

Массив ограничен и пагинируется; `omitted`/`next_cursor` живут в общем envelope. Нулевые/пустые поля читаются с source status: «не прочитали» не равно «целей нет». Rich narrative summary необязателен; если добавится, каждый его факт обязан ссылаться на refs из того же snapshot. `related.relation` закрывается реестром существующих отношений при реализации, а не принимает произвольный пользовательский тип в writer.

Seen-command получает subject + идентификатор/границу **действительно показанного payload**, не текущий journal head. First visit не помечает всю историю прочитанной. Смена scope сбрасывает pending request binding, но сохраняет navigation state. Snapshot restore меняет generation, прежний cursor требует reconciliation. Legacy numeric seq допускается лишь как safe integer; иначе `unavailable/unsupported`, не округлённый новый cursor.

**C1 acceptance:** A→B→late A; событие между чтением и mark-seen; missing source; deleted/denied ref; historical pack отсутствует; две сессии одной задачи и два разных TaskRun. Все случаи возвращают объяснимое состояние без выдуманной полноты.

## 3. Доска и повестка — C2

Owner данных: Work. Owner правил текущего внимания: существующий Board query. Предпочтительный разрез: свободная тема — `AgendaTopic` как новый минимальный **тип намерения**, не Task с фиктивным статусом running. Принятие типа требует нового ADR/миграции; это рекомендуемый выбор D03. Альтернатива «всякая тема — Question» отклонена в проекте, потому что заметка без адресата и запроса решения не является вопросом.

```ts
type AgendaTopic = {
  id: string; estateId: string; projectId: string | null;
  author: Ref; source: Ref | null; text: string;
  state: 'open' | 'resolved' | 'withdrawn'; revision: Revision;
  outcome: Ref | null;
};
type AgendaEntry = {
  id: string; topicRef: Ref; reviewId: string | null;
  position: string; pinned: boolean;
  revisit: null | { kind: 'at'; at: string }
                | { kind: 'after'; evidenceRef: Ref };
};
type ReviewSession = {
  id: string; scope: Ref; openedBy: Ref;
  state: 'open' | 'closed'; entries: Ref[]; outcomeRefs: Ref[];
};
```

Все три — целевые DTO, не заявления о таблицах. `AgendaEntry.topicRef` может ссылаться на существующий Question/Task/review obligation либо AgendaTopic. Уникальность записи по `(reviewId, topicRef)` исключает дубликат в одном разборе. Позднее изменение outcome создаёт версию, а не переписывает предыдущий итог. Metadata order допускается вне journal только если это индивидуальное view preference; содержание разбора и возврат темы durable.

Команды: `capture`, `include`, `move`, `defer`, `resolve`, `delegate`, `closeReview`; названия предложены, внешние event IDs пока не резервируются. Каждая команда имеет commandId, scope, expectedRevision и атомарный результат. `resolve` для Question делегирует existing answer command; для topic требует outcome. `delegate` создаёт/связывает конкретную Task и владельца, остаётся pending до receipt. `closeReview` закрывает встречу, **не все нерешённые темы**.

Системное critical attention и личная повестка различаются визуально. Snooze убирает тему из текущего разбора, но не отменяет critical obligation. Условие возврата просматривает cycle reader; unknown source не считается наступившим условием. Дата хранится как момент + исходная timezone для отображения; «завтра» разрешается в момент сохранения, DST проверяется.

**C2 acceptance:** capture→review→delegate→receipt→следующий review; concurrent move; duplicate capture с тем же commandId; resolved elsewhere; две незакрытые блокировки; urgent new item; archived project. Инвариант: любой исходный unresolved объект доступен в полной очереди независимо от pin/snooze.

## 4. Home preferences и накопленный результат — C3

Owner: Projects/Identity для profile/settings; Knowledge/readers для наблюдений. Предложение первой формы: одна сохранённая avatarRef + fallback; `featuredIds` в существующем лимите; `projectOrder` содержит уникальные project IDs выбранного estate. Новые проекты добавляются в конец; исчезнувшие/недоступные refs не раскрывают данные и не двигают остальные. Команда порядка содержит revision и полный новый порядок, проверенный на duplicate/foreign IDs; конфликт возвращает текущую версию для повторного намеренного применения.

**Порядок не является business priority.** Priority редактируется отдельной командой с отдельной подписью; pins не повышают системную критичность вопросов.

Предлагаемая метрика полезного дня: календарный день в выбранной timezone, в котором оператор дал принятое решение, создал/принял задачу или проверил результат. Автономные tool calls, открытие приложения и повтор события не добавляют дни. Streak — последовательность таких дней; lifetime days — уникальные дни. Импортированные события учитываются только если их actor/time/source надёжно сопоставлены; иначе показывается неполное покрытие.

Стоимость показывается только по attributed usage receipts; incomplete spend имеет признак неполноты, unknown не $0. Длительность наблюдаемой работы агента не называется временем, которое вложил человек. Уровень можно вывести из подтверждённых результатов с видимой формулой, но конкретные коэффициенты не являются архитектурой и остаются отдельным reversible design choice D03. Уровень не повышает права и не оценивает компетентность модели.

## 5. Раскрываемый граф — C4

Owner: Surfaces/Planning как read model над Work/Knowledge/Execution. SQL/projections остаются владельцами фактов; отдельная graph DB не требуется. `graphKind` выбирается в маршруте и не меняется от zoom.

```ts
type GraphRead = {
  scope: Ref; graphKind: 'target-plan' | 'project-history' | 'agent-history';
  root: Ref; revision: Revision | null; cursor: string | null;
};
type GraphNode = {
  ref: Ref; parent: Ref | null; title: string;
  expandable: boolean;
  childCount: number | null;
  hiddenExternalEdges: number | null;
  claim: ContextClaim | null;
};
type GraphEdge = {
  from: Ref; to: Ref;
  kind: 'depends-on' | 'spawned' | 'supersedes' | 'evidence-for' | 'decided-because';
  evidence: Ref[]; proposed: boolean;
};
type GraphExpansion = { nodes: GraphNode[]; edges: GraphEdge[] };
// expand(GraphRead) -> ReadEnvelope<GraphExpansion>
```

`decided-because` разрешён только при явно записанном обосновании/проверяемой ссылке; простой временной порядок не причинность. Родительское раскрытие (`parent`) не блокирующее ребро. Табличные/графовые ID наследуются из канонических сущностей. Нет task→goal — задача остаётся в группе «без цели». История отменённых задач доступна по фильтру, не выпадает из total.

На expand приложение сохраняет `graphKind/scope/root/revision/expandedRefs/selectedRef/viewport`; смена revision требует атомарного нового snapshot либо явного stale режима, не склейки несовместимых подграфов. Недоступные соседние проекты обозначаются без раскрытия private identifiers. Нельзя показывать точный процент по пагинированному подмножеству. Полный outline остаётся доступным клавиатурой; направление LR/TB следует существующей UX-спеке, курсор не сдвигается неожиданно при live update.

R1 редактирует цель/задачу штатной формой и возвращается в граф. Произвольное рисование рёбер/новых типов — вне среза. Если позже добавится edge writer, он использует существующую атомарную команду и cycle guard; изменение картинки само по себе ничего не записывает.

## 6. Workflow и цикл — C5

Owner: Work (определение workflow/версия и состояние задач), Continuity (invocation window/lease/cursor), Execution (admission/TaskRun/delivery). Проектный шаблон первой поставки: formulate→plan→execute→verify→remember. Переход к следующему шагу имеет конкретный artifact: brief, versioned plan, result, verification, retained outcome. Проверка не выбирается самим агентом постфактум по удобному признаку.

Периодическая Routine создаёт работу по своему definition revision. Наличие следующего due не разрешает effect: admission повторно проверяет scope, policy, budget и существующий lease. Для окна сохраняются definitionRef, windowKey, selected input boundary, attempt refs, committed result refs и outcome. При state unknown новое окно не должно без reconciliation повторить прежний необратимый эффект. При повторе задачи создаётся новый TaskRun, transport retry остаётся attempt внутри старого.

Предложение R1: существующий single-host scheduler; bounded catch-up; ручные pause/resume; no always-on обещания. Новый distributed mode потребует durable cross-process quota reservation и fencing (CO-120), не только нового UI переключателя. Политика следующего наблюдения задаётся результатом workflow/routine; задача без автоматического followup имеет явно ручной next action.

## 7. Fabric-agent — C6

Owner: Agents/Manager; effect authority остаётся у Authority/Work. Предлагаемый минимальный profile:

| Поле | Контракт первой формы |
|---|---|
| Trigger | Явный запрос человека в выбранном estate/project; циклы наблюдения могут предложить разбор, но не скрытно расширить этот trigger |
| Input | ContextSubject + source boundary + вопрос + текущий tool capability set + profile revision |
| Tools | readContext, readSource, inspectPlan, draftProposal; названия адаптируются к штатному tool surface, raw DB/shell/credentials не выдаются |
| Durable output | ManagerInvocation receipt + cited proposal или причина unavailable/refused/partial; предложение не закрывает задачу |
| Commit | Отдельное действие существующей command boundary с текущей revision; согласие на предложение не является standing grant всех будущих эффектов |
| Loop guards | Step/time/budget caps на invocation; общий retry budget; trim/wrap-up; malformed output/refused tool не считаются выполненной работой |
| Failure | Нет model → детерминированный обзор и явный unavailable для judgement; unknown external call → reconciliation, не автоматический второй эффект |
| Activation | Eval corpus + negative controls соответствуют именно этому profile/tool set; известна стоимость/unknown usage; настройки не дают скрытых прав |

Почему этот разрез: полное M194 включает смену manager и lifecycle вокруг широких tools; связывать с ним первую полезную сводку слишком дорого. При этом назвать только визуального персонажа работающим CEO было бы неверно. Предлагаемый narrow profile сохраняет шов заменяемого judgement и требует собственного честного activation gate. D04 проверяет совместимость с действующим контрактом и оформляет ADR **до** реализации; здесь выбор изложен полностью для предметного review.

## 8. Миграция, совместимость и нижняя проверка

Новые источники нужны для agenda/review, history brief revisions и недостающих attributed context refs; существующие Task/TaskRun/Question/Decision не копируются. Перед миграцией проверить, может ли history быть восстановлена из уже записанных journal events. Backfill сохраняет provenance и отмечает неизвестные значения; не реконструирует исходный текст, если его нет.

Сначала additive schema/event registry/projector с rebuild parity; затем producer; затем reader/typed IPC; затем UI и read receipts. Старый writer не получает новые права от наличия nullable column. Во время mixed-version reader сообщает unsupported/partial для неизвестной схемы. Самовольное переименование внешнего `run_id` исключено; wire изменения проводятся в fabric-agent-contract и adapter отдельными коммитами/пакетами.

Проверять снизу вверх на одном fixture: append/rebuild equality → scoped query → command dedup/revision → admission/delivery/unknown → UI context → два цикла → повторный возврат человека. Negative набор: stale write, wrong scope, wrong generation, partial source, replayed command, archive source, interrupted dispatch, missing provider, delayed acknowledgement. Живой host и user value остаются отдельной приёмкой L09; этот документ не закрывает их.
