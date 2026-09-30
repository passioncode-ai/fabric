<sub>ssheleg skills — project-audit · ux-audit · agent-orchestrator · agent-harness · sheleg-design · brand-voice · copywriting</sub>

# Независимый challenge плана 2026-09-07

Проверен `docs/audit/2026-09-07-work-plan.md` против ADR-0042/0043, M198 и PLAN-09…14. Проверка только документа и контрактов; исходники, ADR и ledger не редактировались. План трактуется как предложение. **Вердикт: направление верное; перед объявлением плана готовым к исполнению нужны следующие ограниченные уточнения.**

Примечание о движении файла: challenge ниже относится к версии, где W18 начинался «Task как намерение, Run как попытка, Session как процесс/канал». При заключительном чтении W18 уже исправлен на проекцию task+session и включил M198. Поэтому пункты 1 и 3 ниже в основной части уже закрыты текущей правкой; недостающие tests/claim-vs-observation/unknown metadata остаются checklist к приёмке.

## 1. P1 — W18 допускает второй источник истины Run и неверно приравнивает resume к новой попытке

**Место:** work-plan.md:60,64. Формулировка «Run как попытка, Session как процесс/канал; immutable execution snapshot» без ключа и источника истины позволяет исполнителю создать новую сущность с собственным `run_id` и lifecycle. «Повтор/продолжение дают новый Run» дополнительно требует новую попытку даже при продолжении того же сеанса.

**Контракт:** ADR-0042:19–26: Run — **session bound to task**, новый id не вводится; пара уже есть в `task.session.attached@1`; повтор с новым session получает свежие step statuses. ADR-0042:42 запрещает stored run table beyond projection. Продолжение существующей session и новая session — разные случаи. Сам snapshot не запрещён: неизменяемые факты execution могут жить в journal/context-lockfile, а reader/projection собирать их.

**Предлагаемая точная граница W18:** «Run — проекция `(task_id, session_id)` из `task.session.attached@1`, без отдельного authoritative store и без нового идентификатора. Новая session/loop iteration создаёт новую попытку в той же задаче; reconnect/resume той же session продолжает её. Метаданные execution фиксируются событиями и lockfile, читатель собирается из журнала. Predecessor — корреляция между session attempts, не новый workflow engine».

**Добавить acceptance:** две разные sessions одной задачи имеют независимые plans/steps; повторное attachment той же пары/reconnect не увеличивает run count; полный rebuild возвращает те же attempts/snapshots/edges; отсутствие task у session не порождает фиктивный Run; модель/graph version, которые runner не сообщил, остаются unknown, не выдумываются. DID и SHOULD остаются разными query/rendering paths (ADR-0042:31–35), step status имеет явный claim marker.

## 2. P1 — M194 помещён до обязательных core/checker/manager pack, затем эти prerequisites отложены за него

**Место:** W29 work-plan.md:92 зависит только от W11/W18/W20; work-plan.md:101 откладывает **M166–M175** до доказанного W29. Но W29 включает M194 role binding.

**Противоречие:** ADR-0043:16–29 требует фиксированные deterministic core, checker с отказами, schema floor, trust ceiling, единую manager surface, Board-delta/tick wake, heartbeat+outside watch, trajectory eval, MANAGER PACK с journalled lockfile. W29 не зависит от W19, W22–W24; M168 checker отложен после W29. Получается скрытый цикл «manager seat → core/checker после seat → безопасный seat».

**Исправление:** разделить W29a «второй обычный runner/passport» и W29b «M194 selectable manager». W29a остаётся с текущими prerequisites. W29b получает W19/W20/W22/W23/W24 + минимальные M166/M168 и manager-tool/pack contract. Собственный generative loop M175 и provider router/advisory M169–171 могут оставаться позже. Не откладывать целиком M166–M175 за W29.

**Acceptance:** fake external manager и built-in mechanical path проходят одну manager surface; оба получают отказ без basis/при превышении trust/human-decision reversal; разные prose вне tools не меняют state; wake deduplicated; manager lockfile привязан к конкретной session; смерть manager видна watcher; выбор seat показывает стоимость per wake.

## 3. P1 — M198 не получил работу и критерий выхода, хотя новая версия/снимок строятся на replay

**Место:** в work-plan.md нет M198. W12:40 проверяет миграции from-empty/upgrade, W15:50 говорит «extraction не меняет journal replay» — оба могут пройти с известным исключением колонки.

**Контракт/доказательство:** backlog.md:682: `config_revision = config_revision + 1` при replay даёт новую ревизию; P24 **исключает** эту колонку. Извлечение M97 сознательно не исправляло поведение.

**Исправление:** явная W-строка/подзадача существующего **M198** в foundation до опоры на config revision в snapshot/build/schema comparisons. Можно реализовывать параллельно W01–W10; не создавать новый milestone id. Не скрывать как «M97 уже done».

**Acceptance:** fixture с create + несколькими project/settings updates; сравнить `config_revision` и все projection checksums до rebuild, после первого и второго rebuild; колонка больше не исключена в P24. From-empty и upgrade дают ту же revision. Legacy событие, которое уже принято, не делает estate unrebuildable.

## 4. P1 — release gate W12 пропускает runner enforcement W11 при выпуске unattended поведения

**Место:** W12 work-plan.md:40: «W01–W10 до выпуска с автозапуском», но раздел 1 называется «Гарантии до любого unattended запуска», а W11:32 — capability enforcement, закрывающее половину M140.

**Исправление:** если выпуск включает unattended external effects, W12 activation gate включает **W11**. Альтернатива — явно ограничить выпускаемый automation режим по доказанному passport (read-only/observe-only без неперехваченных эффектов), с проверкой runtime, а не только надписью.

**Acceptance:** packaged app не активирует unattended effect-capable runner без соответствующего enforcement capability. Поддержанные и неподдержанные runner modes проверяются на том же SHA и артефакте, который выпускается. W13 package smoke включает этот режим.

## 5. P2 — M184 заявлен, но обязательные category/about/process-kind остались условными

**Место:** W24 work-plan.md:73: «M153/M154/M173/M184», зависимости «категории M182 только если они используются». Примечание :75 исправляет два неверных event names, но не `question.kind='process'`.

**Контракт:** M184 backlog.md:670 выполняет recurrence по `category+about` и создаёт question kind **process**; M182:668 закрывает category enum. Текущий questions CHECK в migration `20260906000028_questions.sql:27` принимает только decision/access/priority/fact/approval. Fact.about отсутствует и уже назван как новое поле в плане.

**Исправление:** M153 hygiene можно независимо делать без M182/M183, но **M184** либо имеет hard dependencies на category/about/process-kind migration + ask/write path, либо явно сужен до отдельного ещё не полного M184 slice. M183 export правильно оставлен вне hard path.

**Acceptance:** project/agents/harness/fabric/process category round-trip; три одинаковых trap category+about создают один process question, разные subject/category не объединяются; повторные тики не создают дубликат; process event реально проходит append/project/rebuild.

## 6. P1/P2 — «идемпотентное разрешение» ещё не проверяет атомарность памяти и ответа/пометки

**Место:** W21:70 требует «повторный ответ не создаёт вторую запись», W22:71 — restart не теряет решение. Это верное направление, но текущий PLAN-11 механизм касается **двух разных записей**. Второй answer уже не переписывает question благодаря `status=open`; при этом новый fact мог появиться раньше. Тест только question count пропустит дефект. `tasks.promote` использует тот же паттерн (`main/index.ts:1561–1591`) и в план явно не попал.

**Исправление:** добавить atomic idempotent answer/promote command (или durable prepared-command с постоянным fact ID/reconciler); указать, что при повторе возвращается **та же effective decision/fact**, а не только одна question resolution. Полностью зафиксировать ordering и transition ownership.

**Acceptance:** два одновременных answer/promote с одним target; crash после fact append, retry с тем же и повторным transport request; ровно один current authoritative fact и одна связь answer/promoted_fact_id, следующий context pack не получает orphan/duplicate conflicting answers. Конфликтующие ответы с разными operation IDs не превращаются в две одновременно текущие истины. Проверять task-note promotion отдельно.

## 7. P2 — PLAN-09 и обязательные reader regressions растворились в большом W26

**Место:** W26 work-plan.md:82 имеет «exact deep links; search coverage» и generic empty/error/stale, но не закрепляет исправления историй/DTO. W17:52 меняет invalidation, где эти регрессии особенно легко повторить.

**Непокрытые факты:** EstateAgents читает history один раз при selection, не очищает старую историю до нового чтения (`EstateAgents.tsx:39–58`); terminalHistory ищет payload.session_id/owner, исключая actor-only task/memory tool events (`main/index.ts:2398–2405`). MemoryOverview Promise.all с misses теряет обновление всех stores при одном throw (`MemoryOverviewSection.tsx:45–53`); project harness ignores projectId и grant failure превращается в zero (`main/index.ts:2002–2019`).

**Исправление:** добавить явные W17/W26 subtasks «subject generation + independent StoreRead DTO + correlated history». Часть DTO/ошибок можно отнести к W16. Не ждать W18/W22, чтобы исправить уже существующие чтения: эти поля и source IDs есть сейчас.

**Acceptance:** A→B с медленным/ошибочным ответом A никогда не показывает A под B; actor-only memory/task event появляется в истории правильной session; изменение журнала обновляет history без перевыбора; один unreadable store не превращает другие в empty и показывает возраст последнего успеха; разные project grants дают разные harness summaries; >200 history имеет cursor/hasMore.

## 8. P2 — W20 исправляет отсутствие trace, но ещё не определяет корреляцию, без которой M176 снова останется видимостью eval

**Место:** W20 work-plan.md:62 уже правильно добавляет все attempts до eval и не объявляет trace внутренним loop чужого CLI. В обязательных полях пока только tool/outcome/duration/scope. Для trajectory, repeat/failure и model update W30 этого недостаточно.

**Исправление:** contract scoped invocation trace должен содержать request/invocation identity, session + nullable task/run pair, event sequence/correlation, tool/schema/harness version, safe input/output reference или digest и отказ/error class; model/provider/version и budget — когда реально известны. Отдельно назвать storage/retention boundary: domain journal остаётся журналом признанных событий, диагностическая попытка не становится authoritative outcome.

**Acceptance:** один успешный write, read, refusal, thrown handler, timeout и retry дают воспроизводимую timeline без выдуманного выполненного эффекта. Repeated request связывается с первой операцией; missing trace явно blind. Корпус отличает отсутствие вызова нужного tool от отсутствие записи о вызове. Baseline и candidate сравниваются на pinned tool/contract/context/runner versions.

## Ограниченная проверка PLAN-09…14

| Исходная находка | В новом плане | Осталось |
|---|---|---|
| PLAN-09 reader freshness/history | частично W17/W26 | явная subject/correlation/per-store acceptance (#7) |
| PLAN-10 события/поля | существенно исправлено W21–24 и :75 | process enum/category dependency (#5); запрет guess model/snapshot fields (#1) |
| PLAN-11 dual append | направление исправлено W21/W22 | atomic fact+resolution и task-note promotion (#6) |
| PLAN-12 нет trace | исправлено W20, порядок trace→eval верный | correlation/version/source contract (#8) |
| PLAN-13 dependency shapes | модульный W15→W16 и M183 decoupling исправлены | hidden M194 cycle (#2), release W11 (#4); W26 existing reader fixes не должны ждать Run/Board |
| PLAN-14 stale status register | W14 сформулирован правильно | добавить absorbed_by/superseded_by + evidence SHA; не оставлять исходные M53/M54/M79 как новую работу после absorption M122 |

## Что уже выдержало challenge

- Нельзя требовать heavyweight durable engine только из-за слова Run; текущий план правильно оставляет выбор по нужде. Нужна точная граница ADR0042, а не отмена этого решения.
- Trace перед trajectory eval, независимый checker перед признанным результатом, отсутствие M183 в hard path локального retro — правильные изменения.
- Синтетические principal до живого colleague pilot, разные статусы installed/implemented/verified/observed, per-module return sweep после extraction — план улучшает именно реальные недостающие гарантии.
- Сами принятые ADR и M-статусы этим предложением не меняются. Уточнения выше делают его исполнимым внутри нынешней архитектуры; новая Run identity/store, если всё же понадобится, потребует отдельного superseding ADR, а не скрытой правки W18.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`project-audit`](https://github.com/ssheleg/task-pipeline) — проверка проекта и доказательств
- [`ux-audit`](https://github.com/ssheleg/super-ux) — сценарии и дефекты интерфейса
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — архитектура исполнения и полномочий
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — переносимый агентный контур
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — визуальная система
- [`brand-voice`](https://github.com/ssheleg/super-ux) — иерархия бренда
- [`copywriting`](https://github.com/ssheleg/super-ux) — формулировки позиционирования

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
