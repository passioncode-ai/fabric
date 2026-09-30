<sub>ssheleg skills — project-audit · agent-sync · agent-orchestrator · agent-harness · agent-interop · ux-scenarios · ux-flows · ux-audit · sheleg-design · brand-voice · copywriting</sub>

# Приложение к объединённому плану: четыре графа, Run, прогресс и раскрытие

Дата: 2026-09-07. Проверенный исходник: `153b4f029e626230d465d5d21d02fb8c9de5fadf`. Репозиторий: `.`. Область: **M173, M187, M188, M189, M190**, их производители данных и зависимости. Бренд в предложении: **PassionCode.ai → Fabric**. Ниже `file:line` разрешается относительно корня репозитория. Это самостоятельное предложение к плану; исходники, ADR, сценарии и канонические статусы не изменены. Реальные агенты и приложение не запускались, полный suite не повторялся.

Главный вывод: нужные поверхности хорошо совпадают с продуктовой идеей Fabric, но их нельзя доставить как один графический reader над уже готовыми данными. Есть полезная основа — журнал, задачи, связи, вопросы, решения, context pack. Не определены совместимые границы Run, не хватает причинных связей и производителей, а существующие readers возвращают ограниченные текущие срезы. Сначала нужен проверяемый контракт наблюдения; после него графы станут рабочим инструментом команды, а не изображением, которому придётся верить.

## 1. Что уже принято, реализовано и предложено

| Предмет | Статус в источнике | Что действительно найдено | Значение для объединённого плана |
|---|---|---|---|
| ADR-0030 | Accepted | Run = выполнение целого графа; Run 1→N Node; terminal Run неизменяем; события коррелируются `run_id/node_id` | Сохраняет родителя бюджета, отмены, версии процесса. [docs/adr/0030-a-run-is-one-execution-of-one-graph.md:17](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/adr/0030-a-run-is-one-execution-of-one-graph.md#L17), `:20`, `:23`, `:27` |
| ADR-0042 | accepted | Run = task+session без нового id; каждая итерация — Run; статусы шагов — заявления; графы — запросы | Принятое решение ещё не является реализацией. Оно конфликтует с ADR-0030 и внутри себя по экранам. [docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md:19](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md#L19), `:31`, `:36` |
| M144 | shipped as LIST | `PlanSection` показывает цели и открытые задачи; `DecisionsSection` — решения и линейки замен | Полезный исходный reader, не четыре графа и не live Run. [docs/evidence/backlog.md:630](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L630); [apps/desktop/src/renderer/src/PlanSection.tsx:78](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/renderer/src/PlanSection.tsx#L78); [apps/desktop/src/renderer/src/DecisionsSection.tsx:48](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/renderer/src/DecisionsSection.tsx#L48) |
| **M173** | proposed | Есть `actor_kind`, `superseded_by`, context pack; текущий decisions IPC не выдаёт actor/session/task/pack identity | Сохранить отдельным M: история решений и доказательства их происхождения. [docs/evidence/backlog.md:659](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L659); [apps/desktop/src/main/index.ts:2023](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/index.ts#L2023) |
| **M187** | Принцип accepted, milestone proposed | ADR-0041 §6 принимает один disclosure primitive и откладывает настройки; M187 — полный проход по SCR | Делать до новых виджетов в части контракта/компонента; полный sweep оставить отдельной итерацией M187. [docs/adr/0041-insights-carry-a-category-and-only-service-categories-ever-leave.md:70](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/adr/0041-insights-carry-a-category-and-only-service-categories-ever-leave.md#L70); [docs/evidence/backlog.md:673](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L673) |
| **M188** | proposed | В design названы два tools, два события, две проекции | Поиск по `apps/desktop/src` и `supabase/migrations` не находит ни одного `fabric_plan_declare`, `fabric_plan_step`, `plan.declared@1`, `plan.step@1`, `task_plans`, `plan_steps`; exit 1. Нужны также lifecycle/correlation producers. [docs/evidence/backlog.md:674](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L674); [docs/architecture/agent-visibility-and-runs.md:30](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L30) |
| **M189** | proposed | Описан preview run/steps/heartbeat, полного reader нет | Не закрывать по макету: нужны M188 и M178–M181 с честными источниками состояния. [docs/evidence/backlog.md:675](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L675) |
| **M190** | proposed | Design/бэклог: три вкладки; SCR-40 отсутствует в реестре screens/scenarios/flows | Сохранить M190, но не потерять четвёртую семантику M173; перед UI обновить цепочку UX. [docs/evidence/backlog.md:676](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L676); [docs/architecture/agent-visibility-and-runs.md:88](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L88) |

Воспроизводимое отрицательное свидетельство: `rg -n 'fabric_plan_declare|fabric_plan_step|plan\.declared@1|plan\.step@1|task_plans|plan_steps' apps/desktop/src supabase/migrations` → нет совпадений, exit 1, на указанном HEAD. Это проверка наличия реализации в этих корнях, не доказательство поведения ещё не написанного продукта.

## 2. Четыре семантики: сохранить отдельно и в данных, и в интерфейсе

| Граф и M | Вопрос оператора | Основные узлы и связи | Что показывать первично | Что нельзя подразумевать |
|---|---|---|---|---|
| **История агента — M190** | Что сделал этот агент, какие задачи создал/взял, кому и что передал? | Конкретные execution attempts, задачи, изменения владения, вопросы, handoffs; actor/binding/session и происхождение | Последовательность событий, результат попыток, текущий контекст, явно выбранная идентичность агента | Что одна session равна долговечной личности; что каждую задачу агент выполнил только потому, что создал или получил её |
| **История задач проекта, DID — M190** | Как всё происходило у всех участников проекта и где сейчас каждая задача? | Все задачи, попытки, создания/передачи/переводы, блокировки и разрешения; события в историческом порядке | История + отдельно текущее состояние; фильтр участников и времени с видимым scope | Что список последних 20 закрытых задач — весь проект; что связь `follows` доказывает состоявшуюся передачу результата |
| **История решений — M173** | Как изменялось решение, кто и на каком основании его принял, какое действие оно вызвало? | Решения, заменённые решения, вопросы/ответы, авторы, явно цитированные факты и evidence; ссылки на задачи/попытки | Действующее решение, автор, основание, цепочка изменения; переход к точному источнику | Что порядок по времени или близость узлов доказывает причинность; что человек обязательно «ствол», а агент обязательно «ветка» без записанного отношения |
| **Целевой план, SHOULD — M190** | К чему идём, что должно предшествовать чему, что осталось и что мешает? | Цели, задачи, типизированные зависимости, именованные необходимые результаты; текущие/выбранные попытки как подробность | Декларация направления и зависимостей, версия/момент плана, незакрытые обязательства, наблюдаемые результаты отдельным слоем | Что запланированное уже произошло; что количество закрытых шагов измеряет процент готовности продукта |

Это **четыре пользовательских назначения**. Agent DID и Project DID могут использовать общий исторический renderer и общий query engine со scope; M173 использует lineage/evidence; SHOULD использует направление зависимостей. Общий компонент не означает один смешанный граф.

Принятая основа различения DID/SHOULD верна: [docs/architecture/agent-visibility-and-runs.md:70](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L70), `:76`. Но таблица там содержит только три графа (`:66`), а M173 живёт отдельно ([docs/evidence/backlog.md:659](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L659)). В объединённой навигации M173 должен иметь собственную точку входа; нельзя поглотить его узлами решений в общем DID и считать запрос исполненным.

Термин «DID» означает **что записано о произошедшем**. Формулировку «journal cannot be wrong about the past» ([docs/architecture/agent-visibility-and-runs.md:78](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L78); [docs/evidence/backlog.md:676](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L676)) нужно ослабить: журнал может хранить заявление, отвергнутую команду, неполный импорт или событие без корреляции. Верность вычисления и полнота наблюдения — разные свойства. В графе должны быть source kind, event seq и полнота покрытия.

## 3. Противоречия, которые необходимо разрешить до реализации

### 3.1. Run уже имеет два несовместимых принятых значения

ADR-0030 определяет Run как выполнение графа и прямо отвергает `Run = node execution` (`:17`, `:34`). ADR-0042 определяет Run как session, привязанную к одной задаче (`:19`), не объявляя отмену или уточнение ADR-0030. Это влияет на ключи, историю, бюджет, отмену, возобновление и агрегацию. Нельзя оставить исполнителю выбор по месту.

**Минимальное предложение для нового согласующего ADR, а не тайной правки старых:** назвать верхний уровень `WorkflowRun` с прежней семантикой ADR-0030; отдельно назвать `TaskRun` с ключом `(task_id, session_id)` по ADR-0042. У TaskRun может быть ссылка на родительский WorkflowRun. До успешного связывания task/session существует **launch/admission receipt** — запись запроса и результата запуска; она видна оператору, но не считается начавшимся Run. Для её корреляции достаточно существующего journal event ref, отдельный новый domain ID не обязателен. Такое решение уточняет два уровня и сохраняет правило ADR-0042 «No new id».

Failed spawn сам по себе **не доказывает дефект ADR-0042**: его можно честно отобразить как неуспешную попытку запуска до Run. В счётчике нужно различать «3 запуска состоялись; 1 попытка запуска отклонена». Только если пользователь требует считать и pre-spawn failures именно Runs, потребуется явная смена определения. Новую сущность с отдельным attempt_id не следует вводить автоматически.

Остаётся отдельная развилка: если «каждая итерация — Run» относится к внутреннему циклу, который продолжает ту же session/task, текущий ключ не различает итерации. Для принятого определения нужно обеспечивать отдельную наблюдаемую session на каждую такую итерацию либо явно расширить ключ границей итерации/отдельным execution attempt. Первый путь сохраняет ADR-0042 буквально; второй требует новой записи, меняющей §1. **Рекомендация для первого increment — сохранить task/session Run и launch receipt, определить наблюдаемый scope итерации; не объявлять внутренние ненаблюдаемые циклы реализованными.** Решение о более мелком execution attempt принять по adapter fixtures, а не ради удобства виджета. Текущие ADR не переписаны.

Основания в коде:

- `startTask` каждый раз создаёт новый **task id** ([apps/desktop/src/main/index.ts:851](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/index.ts#L851)) и только после успешного spawn пишет task.session.attached (`:934`). Это не повторная попытка той же задачи.
- Неудачный spawn уже записан как task.abandoned (`:908`, `:916`), но session отсутствует. Его надо показывать launch receipt отдельно от состоявшихся TaskRuns; attached-only history без этого блока скрыла бы реальную неудачную попытку запуска.
- `fabric_task_claim` пишет lease на переданный task ([apps/desktop/src/main/agentSurface.ts:953](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/agentSurface.ts#L953), `:974`) и возвращает успех (`:1004`); он не обновляет scope.taskId и не пишет task.session.attached. Он не запрещает одной session брать несколько разных задач. Lease renewal — не новый запуск.
- Текущая проекция attached только заменяет `project_tasks.session_id` ([supabase/migrations/20260906000030_dissolve_legacy_projector.sql:124](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/supabase/migrations/20260906000030_dissolve_legacy_projector.sql#L124)). Журнал позволяет восстановить пары, но текущая строка не является историей attempts.
- Завершение процесса пишет `task.finished` с task id и exit code, без session/attempt correlation ([apps/desktop/src/main/index.ts:399](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/index.ts#L399), `:416`). Для нескольких попыток такой payload недостаточен.

Требование «каждая итерация — отдельный Run» также требует определить **границу итерации**. Tool call, inference turn, повтор после ошибки, validator→developer round и routine tick — разные уровни. Не считать их по выводу в терминал. Для встроенного orchestrator событие испускается на границе цикла; для внешнего runner нужен hook/adapter или явный tool. Если граница не наблюдается, UI пишет «внутренние итерации не наблюдаются», а не выдумывает их количество. Связанные M68/M175/M194 остаются в плане, не превращаются в новую несвязанную систему.

### 3.2. «Два экрана» и «один SCR-40 с тремя tabs» одновременно приняты

ADR-0042 пункт 4 требует two screens, not one toggle (`:34`), а пункт 5 — one screen SCR-40 (`:36`). Design повторяет оба ([docs/architecture/agent-visibility-and-runs.md:79](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L79), `:88`); M190 фиксирует три tabs ([docs/evidence/backlog.md:676](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L676)). Это не следует решать стилизацией toggle под tabs.

**Предложение к согласующему ADR:** SCR-40 определить как вход/группу полноэкранных представлений, а не один canvas с переключателем смысла. Внутри четыре адресуемых назначения: «История агента», «История проекта», «Решения», «План». Каждое имеет собственный заголовок, breadcrumb, query kind, состояние фильтров, выбранный узел, URL/route identity. История и план открываются **как отдельные страницы**, возврат восстанавливает исходную страницу. Два historical scopes могут делить renderer; семантика SHOULD не меняется toggle на том же графе. M173 отвечает за «Решения», M190 — за остальные три и связующую навигацию.

Новая запись должна явно уточнить/заменить фразу ADR-0042 §5 «one screen», сохранить запрет §4 на смешанный DID/SHOULD и согласовать M190. Реестровые SCR IDs резервируются по agent-sync при реализации; здесь новые IDs не выдаются. Альтернатива — отдельно принять замену §4 на вкладки, но тогда надо честно изменить принятое правило, а не утверждать, что противоречия не было.

### 3.3. Принцип density уже принят; UX-цепочка требует актуализации

Ссылка на density principle ADR-0041 **корректна**: его §6 прямо принимает primary visible / один disclosure primitive и откладывает настройки ([docs/adr/0041-insights-carry-a-category-and-only-service-categories-ever-leave.md:70](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/adr/0041-insights-carry-a-category-and-only-service-categories-ever-leave.md#L70)). M187 ([docs/evidence/backlog.md:673](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L673)) — реализация и sweep принятого принципа, а не ожидающее принятия правило. Заголовок ADR про insights не исчерпывает его содержимого; замечание о неверной ссылке после перепроверки исключено.

SCR-33 одновременно built в индексе ([docs/ux/screens.md:45](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/ux/screens.md#L45)) и designed в теле (`:648`). Он смешивает направление и историю (`:628`), обещает graph decisions/tasks/goals (`:629`), но отдельно говорит «always list» (`:633`). FLW-23 ведёт через один граф назад к прошлому и вперёд к плану ([docs/ux/flows.md:752](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/ux/flows.md#L752)), хотя более поздний ADR запрещает такое смешение. SCN-046 обещает аналогичный граф ([docs/ux/scenarios.md:1143](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/ux/scenarios.md#L1143)). SCR-40 ещё не зарегистрирован. До M189/M190/M173 обновить соответствующие scenarios→flows→screens и отметить фактически реализованную часть SCR-33. Это исправление traceability, не новая функциональность.

### 3.4. Самоотчёт heartbeat нельзя повышать до наблюдаемой истины

Design называет heartbeat **phase** наблюдаемым фактом ([docs/architecture/agent-visibility-and-runs.md:43](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L43)). Но M178 получает phase в агентском `fabric_heartbeat`, а M179 прямо называет heartbeat собственным рассказом агента ([docs/evidence/backlog.md:664](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L664), `:665`). Факты Fabric: получен сигнал в seq N, прошло столько-то времени, process alive/exit, конкретный tool зарегистрирован. «Working», «thinking», «waiting on» из payload остаются заявлениями. M189 должен различать источник на уровне полей; нельзя сделать честными только plan steps, а соседнюю заявленную phase раскрасить как независимую проверку.

## 4. Недостающие производители и ошибки предположения «только readers»

| Разрыв | Receipt текущего состояния | Требование / владелец |
|---|---|---|
| Нет task-run history projection, контракта границ итерации, plan tools/events/projections | Отрицательный поиск выше; attached заменяет одну session, migration 0030 `:124` | **M188**: launch receipts отдельно до Run; TaskRun terminal reason, parent/predecessor/iteration correlation, lease отдельно; plan declaration/revision/step transitions, registry+validator+projection+replay |
| История «агента» по session не равна истории agent definition/binding | AgentScope session/task: [apps/desktop/src/main/agentSurface.ts:55](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/agentSurface.ts#L55); actor=scope.sessionId при claim `:977`; created-task assigned_by также session `:891` | **M188/M190**: зафиксировать agent identity и binding revision на старте attempt; legacy unknown оставить unknown. Разделить «этот запуск», «этот созданный агент», «этот runner» |
| `needs` есть в схеме, но tool не принимает его | [supabase/migrations/20260905000027_chains.sql:14](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/supabase/migrations/20260905000027_chains.sql#L14), `:102`; `fabric_task_link` input [apps/desktop/src/main/agentSurface.ts:1100](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/agentSurface.ts#L1100), append `:1126` | **M190 prerequisite в существующем chain/link владельце**: schema + UI/tool writer для named inputs, подтверждение read-back; не объявлять plan fully composed по одной колонке |
| Переданный результат хранится как последнее значение task+name | [supabase/migrations/20260905000027_chains.sql:22](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/supabase/migrations/20260905000027_chains.sql#L22), `:53`, `:59` | **M188 + M190**: attempt/source event correlation; historical DID берёт версию результата на handoff seq, а не сегодняшнюю строку. Для ребра «получил» нужно событие потребления/доставки, не только «произвёл» |
| Смешаны направления и значения рёбер | `task_links` rel=blocks/follows/spawned, migration operating_surfaces `:111`; автоматический spawned идёт child→parent, [apps/desktop/src/main/agentSurface.ts:896](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/agentSurface.ts#L896); cycle RPC вызывается без rel `:1112` | **M190 prerequisite**: нормализовать значение prerequisite→dependent для SHOULD; created/spawned и handoff — другие типы. Проверять DAG только нужного отношения/версии, не всю историю одним cycle guard |
| Записанное ребро не обязательно попало в проекцию | [supabase/migrations/20260905000016_operating_surfaces.sql:265](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/supabase/migrations/20260905000016_operating_surfaces.sql#L265) проверяет цикл внутри projector; tool комментарий [apps/desktop/src/main/agentSurface.ts:1108](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/agentSurface.ts#L1108) обещает обратное | **M97/M109 + M190**: согласовать append/read-back; в historical query сохранять outcome rejected/unknown, не выдавать записанный command за accepted связь; диагностировать projection gaps |
| Вопросы и решение не замкнуты производителями | M149 ask-tool и M152 answer→decision ещё proposed: [docs/evidence/backlog.md:635](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L635), `:638`; question_blocks схема: [supabase/migrations/20260906000028_questions.sql:62](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/supabase/migrations/20260906000028_questions.sql#L62) | **M149→M151→M152 перед полным M173/M190**: question→answer→decision→affected task имеет явные ссылки, авторство и seq; ответ с тем же idempotency key не создаёт второй decision |
| Scalar blocked_by не покрывает несколько вопросов | Схема questions `:100` создаёт N question_blocks; `:105` пишет только первый blocked_by; answer `:124` очищает scalar | **M149/M152 + M189**: read model считает все открытые блокирующие вопросы. Ответ на Q1 не снимает Q2. Названия блокировок в widget являются ссылками |
| История задач заведомо усечена | [apps/desktop/src/main/index.ts:965](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/index.ts#L965), `:979`: только 20 closed; terminal history `:2398`, `:2403`, `:2405`: payload session/owner и 200 events | **M190**: отдельный pagination/history query с cursor/as-of seq. Не переиспользовать ограниченный dashboard DTO для «всего проекта» |
| История решений теряет авторство и связи | IPC [apps/desktop/src/main/index.ts:2026](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/index.ts#L2026) без actor_id/task/session/pack и limit200 `:2030`; DecisionFact [apps/desktop/src/shared/decisions.ts:19](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/shared/decisions.ts#L19); source в UI простой текст `DecisionsSection.tsx:73` | **M173**: query DTO с точной авторской identity, typed source refs, question/answer/task/attempt/pack event evidence; переход к источнику и honest missing state |
| Результат lineage helper может скрывать данные | [apps/desktop/src/shared/decisions.ts:64](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/shared/decisions.ts#L64) reverse Map хранит только одного predecessor; roots `:69`; depth50 `:59` | **M173**: reverse multimap, visited/cycle diagnostics, dangling/truncated branches видимы. Два predecessors у одного replacement не должны молча схлопнуться; rootless cycle — видимая проблема данных |
| UI ошибочно подписывает system/unknown как agent | [apps/desktop/src/renderer/src/DecisionsSection.tsx:45](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/renderer/src/DecisionsSection.tsx#L45) | **M173**: четыре честных вида person/agent/system/unknown; node label и текстовое основание, цвет дополнительный |
| План не умеет сохранять denominator прогресса | [apps/desktop/src/renderer/src/PlanSection.tsx:78](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/renderer/src/PlanSection.tsx#L78) исключает done/cancelled и показывает число оставшихся `:93` | **M188/M190**: membership выбранной plan revision + completion outcomes; исторические completed не исчезают из обещанного объёма. Пока этого нет — «N открытых задач», не процент готовности |
| Доказательства плохо раскрываются | [apps/desktop/src/renderer/src/evidence.ts:53](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/renderer/src/evidence.ts#L53) только scrollIntoView `:63`; не раскрывает секцию и не переносит focus; Plan row `PlanSection.tsx:98` без перехода | **M187 + M173/M190**: typed navigation/reveal contract раскрывает цепочку родителей, выбирает entity, ставит focus, возвращает на исходный node |

Уточнение происхождения решения: M173 обещает «what did the agent know» и «could not have known more than lockfile lists» ([docs/evidence/backlog.md:659](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L659)). Второе утверждение неверно как модель. Pack фиксирует **переданный подготовленный контекст**, а не всё знание агента: агент может позже читать память и transcript через tools; эти retrievals уже журналируются ([apps/desktop/src/main/agentSurface.ts:404](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/agentSurface.ts#L404), `:409`), читать repository/tools вне pack. Доступность факта не доказывает, что он использован при решении. Поэтому показывать три разные вещи: «предоставлено при запуске», «дополнительно получено по журналу», «автор прямо сослался». Только последнее — заявленное основание решения. Если нет causal citation — «основание не записано».

Context pack тоже нужно выбирать исторически: `context.compiled` пишет sha/fact_ids/fact_seqs/transcript_ids ([apps/desktop/src/main/index.ts:320](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/apps/desktop/src/main/index.ts#L320); [supabase/migrations/20260906000030_dissolve_legacy_projector.sql:176](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/supabase/migrations/20260906000030_dissolve_legacy_projector.sql#L176)), но проекция upsert по session_id (`:190`). JOIN решения с текущим pack той же session способен показать более поздний context. Нужна ссылка на точный pack event/seq или snapshot, действовавший к decision event; legacy-восстановление маркируется как inferred. SHA и IDs без возможности прочесть соответствующую версию содержимого не обеспечивают обещание «открыть точные факты»; M173/M191 должны проверить retention/version retrieval.

## 5. Предлагаемые контракты данных

Все ниже — **proposed**, имена событий окончательно резервируются и валидируются в M188/согласующем ADR. Они описывают необходимую информацию, а не добавляют новую authoritative graph DB.

### 5.1. Корреляция выполнения, плана и событий

Минимум TaskRun: `run_key:{task_id,session_id}`, `project_id`, `estate_id`, `workflow_run_id?`, `predecessor_run_key?`, `iteration_index?`, `iteration_scope?`, `launch_request_ref?`, `agent_binding_id?`, `binding_revision?`, `requested_by`, `started_seq`, `finished_seq?`, `lifecycle`, `terminal_reason?`. Состояние вычисляется из lifecycle events; projection rebuildable. Ключ сохраняет ADR-0042; `launch_request_ref` указывает на запрос до spawn, включая отдельный failure receipt, не притворяющийся TaskRun. Неподдерживаемые адаптером поля null + capability status. `iteration_index` выдаётся только для реально наблюдаемой границы; повтор в той же паре не получает второй Run без принятого расширения контракта.

Lifecycle producers: requested/starting/rejected admission как launch events; session attached начинает TaskRun; дальше active, waiting/cancel requested, terminal success/failure/cancelled/interrupted. Причина и источник классификации раздельны. Терминальное состояние immutable; следующий TaskRun имеет predecessor. Запрос отмены не равен подтверждённому завершению. Состояние `unknown`/`observation gap` не превращается в done или stalled по отсутствию строк. Если позже принимается отдельный execution attempt ID для внутренних итераций, этот контракт мигрирует через новый ADR и версию события, а не под теми же именами с другим значением.

`plan.declared`: run_key, plan_revision, declaration_seq, previous_revision?, ordered steps `{step_id,title,depends_on?,task_ref?}`, author, idempotency key. `plan.step`: run_key, plan_revision, step_id, closed status enum, note?, blocked_on typed references[], evidence_refs[], reported_by, seq. Не принимать чужой Run/step, повторный id внутри revision, циклы зависимостей, переход терминального Run или stale revision без явного conflict. Перепланирование не удаляет старые статусы: новая revision, изменённые/снятые steps видимы в history.

`step_id` не `task_id`. Лёгкий шаг принадлежит плану одной попытки; самостоятельная задача имеет собственный brief, владельца, результат и lifecycle. Если шаг декомпозирован в задачи, нужна явная `task_ref/derived_from_step` связь. Статус родителя не выводится механически из статусов дочерних без объявленного правила проверки. Это сохраняет отличие плана «что попробую» от командной работы «кто обязан доставить результат».

Для numbered runs показывать «попытка 3; в истории 3», либо «итерация 3 из лимита 5», если лимит объявлен. «Run 3 of 3» из design `:51` без смысла denominator двусмысленно: пользователь может принять известное количество за обещанный последний run.

### 5.2. Query contract для всех четырёх графов

```ts
// Предложение: один envelope, четыре явных kind; реализации readers отдельные.
type GraphKind = 'agent_history' | 'project_history' | 'decision_history' | 'target_plan'
type GraphSnapshot = {
  kind: GraphKind
  scope: { estateId: string; projectId: string; agentBindingId?: string; sessionId?: string }
  asOfSeq: number
  projectionVersion: string
  planRevision?: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  coverage: { complete: boolean; gaps: string[]; truncated: boolean; cursor?: string }
}
// У каждого node/edge: стабильный id, typed entity refs, source event seqs,
// statementKind = observed | reported | declared | inferred,
// outcome = accepted | rejected | unknown, если источник является command.
```

Edge kinds должны отвечать на разные вопросы: `created_from`, `assigned_to`, `claimed_by`, `blocked_by_question`, `question_answered_by`, `decision_supersedes`, `decision_cites`, `produced_artifact`, `consumed_artifact`, `requires`, `member_of_goal`. Соседство по времени — layout, не causal edge. Для migrated/legacy refs без валидного target сохранять узел-заглушку «источник недоступен», а не изобретать связь.

История: стабильный journal seq задаёт порядок регистрации; отдельно показывается occurred_at/author timestamp, если отличается. Snapshot не смешивает страницы до и после live updates: догрузка использует тот же asOfSeq; новые события показываются счётчиком до применения. Все запросы наследуют estate/project access, включая связанный question_blocks и context pack. Межпроектные edges не раскрывают чужие titles/IDs; typed denied/missing состояния различаются по допустимой информации.

«Every graph is a query» остаётся правилом: graph layout/cache могут быть производными и перестраиваемыми; canonical truth — события/декларации. Но это не отменяет необходимости добавить отсутствующие **source events, IDs, projections, versions и producers**. Формулу design «E zero new storage/readers only» ([docs/architecture/agent-visibility-and-runs.md:177](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L177)) можно сохранить для конечного renderer, лишь вынеся перечисленные зависимости в M188/M149/M152/существующие chain contracts заранее.

### 5.3. Evidence контракты решения M173

Decision view: immutable decision fact ID + valid period; actor `{kind,id,displayNameAtTime?}`; decision event seq; typed question/answer refs; task/attempt refs; reason as author statement; cited refs с версиями; supplied-pack event ref; subsequent retrieval event refs до decision seq; supersedes edges; declared affected task/goal refs. `source_ref` свободной строкой допустим для legacy, но не заменяет typed причинную ссылку.

Нельзя автоматически рисовать стрелку «решение привело к задаче» по совпадению автора, времени или наличию в context pack. Допустимы явно записанная связь и отдельно маркированная гипотеза, если такую функцию когда-нибудь добавят. В текущей итерации гипотезы не нужны: deterministic readers достаточно.

## 6. UX: preview → раскрытие → полный экран → evidence → назад

### Точки входа и обратные ссылки

| Вход | Минимум на исходной поверхности | Куда открывает | Что восстановить при возврате |
|---|---|---|---|
| Project overview | Отдельные компактные previews: «История», «Решения», «План»; состояние актуальности; одно значимое число и следующее действие | Соответствующая отдельная полная страница в scope проекта | Project tab, scroll, раскрытия |
| Agent tile / agent page | Текущая task, конкретная attempt, последний сигнал, blocker; ссылка «История агента» | Agent history с точной identity; отдельная ссылка на текущую task/run | Агент и его task selection |
| Task page | M189 plan/attempt summary; блокирующие вопросы и родительская цель; происхождение | Run history для task; выделенная task в Project DID; target plan на этой task | Task route, выбранная attempt, scroll |
| Board card / question | Статус, исполнитель, blocker, current attempt badge; из ответа — decision | Task page или соответствующий graph с selected entity; question→decision evidence | Board filters/column/position и вопрос |
| Graph node | Краткая entity summary, source/claim label, действия «Открыть задачу/вопрос/источник» | Subject page или evidence drawer с адресуемым состоянием | Тот же graph kind/scope/asOfSeq/zoom/pan/selection |
| Decision | Кто/когда/что заменяет; source link; явное основание если есть | Вопрос/ответ, точный факт/pack/transcript version | Выбранный decision и lineage branch |

Это дополнительные читательские переходы, не полные формы создания в каждой точке. Preview должен иметь нормальную ссылку/кнопку с accessible name; вложенная кнопка в кликабельной кнопке tile недопустима. Изменение task state из graph допустимо только через существующую предметную команду и её проверку, не запись layout напрямую в projection.

### M189: пять разных аспектов состояния

1. **План агента:** «агент сообщил: 4 из 7 шагов выполнены»; done/skipped/failed отдельно; без плана — «план не объявлен», не 0%.
2. **Наблюдение процесса:** process/session alive, exit, last contact received, источник и возраст; самоописание phase рядом как report.
3. **Ожидания:** все open blocking questions и missing named inputs, с действиями/ссылками; unknown blocker не превращать в «ничего не мешает».
4. **Попытка и итерация:** ordinal/history/predecessor, выбранная vs текущая; pending cancel/restart/conflict видимы.
5. **Результат и проверка:** что было предоставлено, verification receipt/критерии, кем принято. «Process exited 0», «agent marked done» и «task accepted» различаются.

В компактном виде видны task, жизненное состояние, заявление о шагах, свежесть и blocker/следующее действие. Полная таблица переходов, timings, tool activity и technical IDs раскрываются. Новое событие не сворачивает выбранную пользователем попытку и не перехватывает focus. При live stream gap сохраняется последний успешный snapshot с пометкой возраста и retry; initial empty, verified empty, error и stale — четыре состояния, не один список `[]`.

### M187: одна семантика раскрытия, несколько предметных представлений

Общий disclosure primitive отвечает за keyboard/focus, `aria-expanded`, `aria-controls`, именованный заголовок, reduced motion, контролируемое состояние и адресуемое раскрытие. Он не обязан превращать любой graph, transcript и форму в одинаковую карточку. Главное содержимое/действие/блокировка/ошибка остаются видимы. Дополнительные provenance, длинный журнал, technical metadata, редкие controls раскрываются по запросу. Ошибки и действия, требующие оператора, нельзя прятать за закрытым disclosure.

Четыре уровня плотности: **preview → локальные подробности → полная предметная страница → точный источник**. Не вкладывать бесконечные disclosure в disclosure. Deep link раскрывает нужных родителей и переносит focus на найденную entity; Back возвращает focus к источнику. Настраиваемые пользователем плотность/раскрытия остаются после sweep, как требует M187, без преждевременной платформы preferences.

Визуально различать назначение заголовком, подписью источника/времени и формой размещения. DID — последовательность с причинными edges; Decisions — lineage + основания; SHOULD — зависимости и обязательства. Цвет усиливает смысл, но не несёт его один. Не кодировать agent/person только оттенком и не обозначать reported status тем же знаком, что подтверждённый outcome. Для большого graph есть эквивалентное клавиатурное list/table-представление и поиск; pan/zoom не единственный способ найти узел. На компактной ширине preview остаётся строкой с главным действием; full graph получает горизонтальный viewport и отдельный читаемый inspector, а не уменьшение текста до нечитаемого.

## 7. Проверяемые acceptance cases

Это будущие проверки реализации; в данном аудите не выдаются за пройденные tests.

| Case | Проверка результата | M |
|---|---|---|
| RUN-01 | Spawn отказан до session: launch receipt виден с причиной отдельно от Run counter; retry связан с запросом/тем же work, rejection не теряется и не помечен успешным | M188 |
| RUN-02 | Одна session последовательно работает над A и B; история обеих корректна, lease renew не добавляет run; созданный child связан с актуальным task/step | M188 |
| RUN-03 | Две итерации с новыми sessions дают два TaskRuns. Внутренние iterations той же task/session не превращаются в два Runs без принятого расширения; runner без boundary показывает ограничение наблюдения, requirement остаётся явно непокрытым | M188 |
| RUN-04 | Late terminal/step event предыдущей attempt не меняет текущую; terminal immutable; replay строит тот же результат | M188 |
| PLAN-01 | Revised plan сохраняет старые шаги/статусы и denominator прошлой revision; новые steps не наследуют done случайно; concurrent stale update получает конфликт | M188 |
| PLAN-02 | Несуществующий step, чужой task/attempt, duplicate step id, недопустимый status, dependency cycle и повтор idempotency key проверены на tool→journal→projection→read-back пути | M188 |
| PLAN-03 | Done/skipped/failed не схлопнуты в один success; завершённая task остаётся в denominator выбранного goal plan; ноль steps показывает «план не объявлен» | M188/M189/M190 |
| LIVE-01 | Агент сообщает working, watchdog не видит ожидаемого сигнала: видны оба источника и возраст; phase не превращается в независимое подтверждение | M178–181/M189 |
| LIVE-02 | Task блокируется Q1 и Q2; ответ Q1 оставляет Q2; закрытая/withdrawn/stale question трактуется по явной политике; counter и link согласованы | M149/M152/M189 |
| LIVE-03 | Pending cancel, failure, disconnected, stale snapshot и verified empty имеют разные состояния; поздний ответ предыдущего project/attempt не перезаписывает текущий экран | M102/M189 |
| DID-01 | 500 закрытых задач и несколько агентов: pagination даёт все события в стабильном asOfSeq; dashboard cap20 не обрезает graph; догрузка не дублирует/пропускает nodes | M190 |
| DID-02 | Task created ≠ assigned ≠ claimed ≠ worked ≠ done: каждому действию свой edge/source; actor/binding/session не смешаны | M188/M190 |
| DID-03 | Named handoff X исправлен в run2: история run1 показывает прежнюю версию; produced не становится consumed без receipt; follows без needs не обещает удовлетворённые входы | M188/M190 |
| DID-04 | Spawned + follows + blocks между одними task не дают ложный causal cycle из-за смешения направлений; отвергнутая command не рисуется как состоявшееся действие | M97/M109/M190 |
| DEC-01 | person/agent/system/unknown отображаются честно; два predecessors одного replacement оба видимы; rootless cycle/dangling refs/depth cap дают диагностику, не исчезновение | M173 |
| DEC-02 | Pack обновлён после решения: показывается pack на момент решения; последующий retrieval не включён в основание; отсутствующее rationale называется отсутствующим | M173/M191 |
| DEC-03 | Answer→decision→affected task проходит с idempotency, authorship и backlinks; повторный ответ не создаёт дубль; заменённое решение доступно | M149/M152/M173 |
| UX-01 | Из project/agent/task/board открыт правильный graph kind/scope/selected node; Back восстанавливает фильтры/scroll/focus; direct link работает после reload | M173/M189/M190 |
| UX-02 | История и план — разные адресуемые страницы; изменение графа не выдаёт SHOULD за DID; решения доступны своим назначением, M173 не потерян | M173/M190 |
| UX-03 | Keyboard-only путь preview→disclosure→graph list→node→evidence→Back; понятные accessible names; нет nested buttons; reduced motion; компактная ширина и zoom200% без потери главного действия | M187/M189/M190 |
| ISO-01 | Подмена project/estate/entity refs на query и tool границе не раскрывает соседние данные; related question/decision/pack применяют тот же scope | M188/M173/M190 |

В дополнение нужен один связный end-to-end fixture: **цель → задача → attempt1 → декомпозиция → вопрос → ответ/решение → attempt2 → handoff → проверка → принято**. Один журнал восстанавливает все четыре графа, widget, links и «что было известно тогда» без ручных вставок в projections. Это ключевой exit gate блока visibility: он проверяет совместимость продукта целиком, а не наличие четырёх canvas.

## 8. Как встроить в M-план без потери номеров

| Очерёдность | Существующие M | Конкретный результат | Gate / зависимость |
|---|---|---|---|
| 0 | Общая foundations/security линия родительского плана | Сначала устранённые boot/data-loss/scope blockers; сохранить M195/M196/M197 и M97/M109/M98/M102/M105 в своих местах | Графы не обходят базовые P0 и isolation; этот annex не меняет их статусы |
| 1 | **M188 + M190 + M173**, документальный вход | Согласующий ADR по уровням WorkflowRun/TaskRun, launch receipt и отдельным screens; четыре semantic contracts; исправленная traceability; определить exact identity/iteration/correlation | Существующий density ADR-0041 §6 сохраняется. Без семантики Run нельзя утверждать размеры и контракт M188. Новые M IDs не нужны |
| 2 | **M187**, первая часть | Inventory существующих раскрытий, один primitive/reveal contract, состояния и keyboard pattern; спецификация новых previews | До M189/M173/M190 UI; полный sweep M187 не считать закрытым одним компонентом |
| 3 | **M178–M181 → M188** | Наблюдение отдельно от отчёта; task-run lifecycle/iteration producers и launch receipts; plan tools, events, validators, projections, replay, legacy coverage | Tool→journal→projection probes, RUN/PLAN/LIVE cases. M188 больше «два tools» по объёму |
| 4 | **M149 → M151 → M152**, плюс существующие chain/link producers | Реальные вопросы, ответы, decision provenance; needs writer, handoff version/correlation/consumption | Не задерживать независимую часть M188; нужен до обещания полного graph Board/decision cycle |
| 5 | **M189** | Current-task widget на agent/task, честный live статус, selected attempt history, blockers, переходы | M188 + M102; M178–181 дают source-aware health. Начинать с одного vertical slice, потом переиспользовать |
| 6 | **M173** | Decision graph/query + точные authorship/lineage/evidence + preview/backlinks | M152 для answer decisions, provenance contract; legacy list можно улучшить раньше без обещания полноты; не ставить в жёсткую зависимость от всех retro M153/M154/M184 |
| 7 | **M190** | Agent DID, Project DID, SHOULD как отдельные destinations; общий scoped query envelope; pagination, evidence links, project/agent/board previews | Производители и contract gates готовы; M173 подключается четвёртым назначением. Не достаточно «три tabs» |
| Независимо после read contract | **M191**, затем оставшаяся **M187** | Pack preview/lineage/drift используют тот же versioned evidence contract; sweep плотности по всем SCR | Не дублировать M173 logic pack/history; M187 завершить по coverage inventory всех SCR |
| 9 | **M173/M188/M189/M190** общий gate | Сквозной fixture из §7 и `/ux-audit` по обновлённым цепочкам | Полный UX audit полезен после сборки, но не заменяет scenario+probe каждого M до shipping |

Это уточнение зависимостей принятого порядка, а не его сброс. Текущий backlog ставит M178→M188 ([docs/evidence/backlog.md:84](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/evidence/backlog.md#L84)), M173 рядом с retro (`:93`), M189→M190→M191 (`:96`). Текущий design также ставит M179/M180/M181 до M188 ([docs/architecture/agent-visibility-and-runs.md:167](https://github.com/passioncode-ai/fabric/blob/153b4f029e626230d465d5d21d02fb8c9de5fadf/docs/architecture/agent-visibility-and-runs.md#L167)) и связывает visibility с вопросами (`:169`). Новое требование — явно включить correlation/provenance producers и не откладывать M187 primitive до конца. M173 не обязан ждать качества всего retro: его необходимая связь — decision producers и точное evidence, а не общий заголовок «гигиена».

**Definition of done блока:** оператор видит, какая попытка идёт; отличает заявленные шаги от наблюдения и принятого результата; открывает нужный граф из любого предметного контекста; восстанавливает происхождение task/decision по конкретным событиям; видит пробелы наблюдения; возвращается без потери места. Новый, более сильный агент автоматически приносит более качественные планы, решения и результаты в тот же проверяемый контракт. Fabric сохраняет ценность как общая память, состояние, ответственность, контроль и рабочая навигация команды независимо от конкретного runner/model.

## 9. Границы проверки и использованные навыки

Прочитаны: attachment пользователя, agent-visibility-and-runs, ADR-0030/0041/0042, актуальные M-строки и SCN-046/FLW-23/SCR-33, renderer PlanSection/DecisionsSection/evidence, main task launch/claim/link/finish/readers, shared plan/decisions и migrations operating_surfaces/chains/questions/projectors. Это статический и contract audit; runtime graph UI ещё отсутствует и не тестировался. Ранее полученные boot/editor/board probes основного аудита остаются отдельным evidence, не выдаются за тесты M188/M190.

Использовано: **ux-audit** — сопоставление пользовательских цепочек с данными, producers, readers и точными receipts; **sheleg-design** — прогрессивное раскрытие, различимость источника/семантики, плотность и навигационная форма. Изображения и дизайн-макеты не генерировались; никакой proposed контракт здесь не записан как already accepted или shipped.

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
