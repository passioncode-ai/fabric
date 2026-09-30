# Fabric — финальный аудит и пакеты исполнения · 2026-09-09

<sub>ssheleg skills — project-audit · ux-audit · sheleg-design · agent-harness · agent-evals · agent-interop · task-pipeline · evidence-docs · agent-sync · maintaining-fabric-workspace</sub>

**Главный вывод:** основания заметно продвинулись, но завершённость внутренних механизмов опережает их сквозное подключение. Аудит привязан к `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`. Последний входной отчёт — [очередь 9 сентября](../../reports/2026-09-09-queue-progress-report.html); глубокий исходный снимок — [7 сентября](../2026-09-07-deep-audit.md).

Проверены 80 сценариев, сопоставлены 43 прежние находки, 61 узел основной очереди и четыре ранее поставленных основания. В пакете 59 подробных корректирующих/активационных записей и 75 карточек существующего каталога. Это разные измерения одного плана, их нельзя складывать как число независимых проектов.

По реестру: 44/61 shipped, 17 open; это **статусы записанных подмножеств**, не 72% готовности продукта. Сценарные вердикты: `{"PARTIAL": 44, "FAIL": 31, "BLOCKED": 5}`. Итог UX: REFINE для работающих поверхностей и NEW/implementation для отсутствующих целевых потоков; оснований для тотального визуального переписывания нет.

**Начать исполнение:** [COMMON](COMMON.md), затем [FA-01](packets/FA-01.md) в build lane и [UX28-01](packets/UX28-01.md) в независимой lane сохранности. Для unattended activation первыми [FA-03](packets/FA-03.md), [FA-04](packets/FA-04.md), затем [FA-02](packets/FA-02.md). Они защищают Project как долговечную единицу, наблюдаемую историю и явные границы действия — vision principles 1–4; новые agent-chat surfaces не добавляются.

## Последнее уточнение: автоматическая смена аккаунтов

[Аудит новой дельты](provider-auto-addendum.md) закреплён на `8a0e9dbc17ac251e543b26653f64540a24ff0a8a`: ещё SCN-088/089 и девять частей M199. Требование opt-in auto принято оператором в ADR-0052; детали/defaults proposed. Раннее исключение auto больше не действует. В каталоге ниже сохранены M199-агрегат и все девять дочерних контрактов. Новые fixture defects переданы M199.ui/auto/resume с негативными проверками; runtime не изменён. Общий охват: 80 baseline + 7 account + 2 auto = 89 сценариев.

## Более поздний дизайн аккаунтов

После основного среза проверен [provider addendum](provider-addendum.md), source `25026daef6dc1829581ca9fe1f68495761dfd1cf`: ещё семь SCN-081–087, M199/CO-112 и существующие PA-01–06. Runtime не изменился; все семь runtime paths BLOCKED до реализации/наблюдения. ADR-0051 остаётся proposed. Три delta-пакета уточняют контракт, отсутствующие состояния макета и сохранение источников; ADD-PA-03 выполнен интеграцией этого отчёта. Исходный queue report сохранён.

## Что действительно проверено

- Локальный исходный checkout: `bash scripts/ci.sh fast` прошёл; full DB tier не запускался. Свежий isolated checkout reproduces manifest ENOENT; после явной подготовки пустого `apps/desktop/resources` fast прошёл. Подготовка не является исправлением cold-build defect.
- CI: 60 последних runs, `{"failure": 57, "success": 1, "cancelled": 2}`. На baseline [fast](https://github.com/passioncode-ai/fabric/actions/runs/34364871647) падает в build-manifest, full skipped. [workspace](https://github.com/passioncode-ai/fabric/actions/runs/34364871632) падает на stale source receipt. Это не выборка release runs, поэтому release failure rate не вычисляется.
- Без DB/agent effects воспроизведены duplicate chain launch и malformed quota allowance: [проба](runtime-probes.mjs), [вывод](runtime-probes.log).
- На настоящих React-компонентах воспроизведены wrong-task brief save и digest read mark on refresh: [пробы](reader-probes.test.tsx), [вывод](reader-probes.log), [запуск](reader-probes-README.md).
- Liveness: различающиеся caller inputs воспроизведены через фактический pure derivation: [вывод](scenarios-050-078-reproduction.txt). Это доказывает неправильные входные данные, не частоту false alarms у пользователей.
- Реестры: [команда и фактическая арифметика](registers.log). Повторный независимый подсчёт по anchored queue даёт 44 shipped / 61 active; по catalog execution_nodes — 65 включая DONE 4. Независимый разбор CO обнаружил дефект gate: 81 open вместо 79 — cell() делит escaped pipes в CO-050/CO-060; FA-05 включает исправление парсера.
- Ограничения: не запускались production agents, full shared DB suite, реальные paid trials, внешние effects и authentication; native app/screen reader/zoom acceptance не сертифицированы. Их отсутствие измерения вынесено в конкретные activation packets.

## Отсев и уточнение старого отчёта

Не брать заново: исправленные scope predicates, atomic reservation/answer, shell hook floor, replay revisions, sandbox, redaction, transport trace и eval corpus. Их текущие остатки сохраняются отдельно. Не удалять auth, backup, native enforcement и manager лишь потому, что тест pure function зелёный. Не строить абстрактный effect dispatcher без provider, не делать ребрендинг prerequisite для безопасности, не чинить чужой публичный npm `fabric` (наш manifest private).

`closed-subset` ниже означает, что старое конкретное описание отсутствия больше не верно и foundation существует. Это не новая полная runtime certification. Проверяемые current receipts находятся в карточках и сценарных батчах.

| Старый ID | Решение | Owner | Основание |
|---|---|---|---|
| RT-01 | closed-subset | S02 | Scope filters and projector guards exist; retain new tenant/auth probes, no rewrite. |
| RT-02 | keep | FA-02 | Repeated follower spawn reproduced. |
| RT-03 | keep | FA-03 | Malformed quota allows; chain bypass retained. |
| RT-04 | closed-subset | FA-09 | ADR-0050 lifecycle replaces false executed; actual adapters still absent. |
| RT-05 | closed-subset | S03.boundary | Atomic reserve_authority now exists; native interception remains separate. |
| RT-06 | closed-subset | S03 | Authority ingress redaction exists; do not rebuild M195. |
| RT-07 | narrow | UX28-02 | Board foundation exists; old attention consumer still erases quality/freshness. |
| RT-08 | closed-subset | M198 | config_revision from journal seq; preserve replay invariant. |
| RT-09 | narrow | FA-10 | Target vs current contract drift remains; inspect exact surfaces rather than generic architecture rewrite. |
| RT-10 | keep | FA-04 | RPC error and check/append race remain. |
| UV-01 | closed-subset | S01 | Shell hook floor shipped; do not recreate old crash task. |
| UV-02 | keep | S01 | Saved-work acceptance remains independent of shell hooks. |
| UV-03 | closed-subset | S01 | Empty board door shipped; error/optimistic paths still need probes. |
| UV-04 | closed-subset | M17 | Agent descriptor display corrected; interoperability admission remains distinct. |
| UV-05 | narrow | UX28-14 | Interaction semantics need runtime keyboard/native validation; do not claim freshly reproduced. |
| UV-06 | closed-subset | S13 | Single active surface and destination resolver exist. |
| UV-07 | keep | S01 | Project creation/retry/draft persistence remain. |
| UV-08 | merge | UX28-02 | One read lifecycle task covers incomplete/failed/empty states. |
| UV-09 | merge | UX28-06 | Exact evidence resolver remains; do not equate project navigation with source. |
| UV-10 | merge | UX28-02 | Subject/generation keyed reads. |
| UV-11 | narrow | FA-02 | Durable delivery table+ack exist, but runtime admission integration/fencing incomplete. |
| UV-12 | merge | FA-02 | startExisting has no renderer entry; avoid second launch architecture. |
| UV-13 | merge | UX28-02 | Freshness/source-specific invalidation. |
| UV-14 | keep | UX28-14 | Native terminal/editor light/dark validation remains unmeasured. |
| UV-15 | merge | UX28-14 | Accessibility baseline plus named controls. |
| UV-16 | merge | UX28-14 | Contrast/token roles need measured visual check, not taste. |
| UV-17 | merge | UX28-14 | Narrow/zoom/layout acceptance. |
| UV-18 | merge | UX28-15 | Runtime vs target screen/flow statuses. |
| UV-19 | narrow | UX28-15 | Public narrative is separately hosted; current live deployment unverified. |
| PLAN-01 | closed-subset | S06 | Atomic answer recomputes blocking set; continuation wiring still in FA-02. |
| PLAN-02 | keep | UX28-03 | Real component reproduction marks digest seen on refresh. |
| PLAN-03 | keep | UX28-01 | Real component reproduction writes task A brief into B. |
| PLAN-04 | keep | UX28-10 | Favourite ceiling/replace flow absent. |
| PLAN-05 | keep | UX28-09 | Search stores still narrower than promise. |
| PLAN-06 | merge | UX28-06 | History/evidence exact destination. |
| PLAN-07 | keep | UX28-05 | Project id ignored and failed grant count shown zero. |
| PLAN-08 | closed-subset | M190 | Goal denominator fixed; graph screen not delivered. |
| PLAN-09 | merge | UX28-02 | Wrong-subject stale reads one root cause. |
| PLAN-10 | narrow | FA-05 | Engineering catalog added exact contracts; historical absence rationales need current delta. |
| PLAN-11 | narrow | M152.commit | Atomic answer exists; all remaining multi-write command paths retain own tasks. |
| PLAN-12 | closed-subset | M176 | Transport trace+corpus exist; real-runner and native coverage not proven. |
| PLAN-13 | narrow | FA-05 | Canonical edges improved; scratchpad alias failure and activation-vs-subset remain. |
| PLAN-14 | keep | FA-10 | Milestone proposal rows and shipped queue rows still coexist. |

<a id="plan"></a>
## Общий план исполнения

1. **Доказуемость и сохранность сейчас:** FA-01, FA-05, UX28-01/03/04. Независимые lanes, не общий waterfall.
2. **Безопасное исполнение:** FA-03 + FA-04 → FA-02; привязать run/session/ack/close, полное множество blockers и follows. Вернуть типизированные отказы в UI.
3. **Честное чтение и интерфейсы:** UX28-02/05/06/09/11, затем живые Inbox/cycles/pack/graph потребители; minimum cursor и scoped source quality сохраняются на каждой границе.
4. **Менеджер без магии:** M153 + M158 → M157/M184/M166; M183.local отдельно. M166 → M167 → M169 + M171; M194 после core, M175 после router/usage/binding. M176 остаётся обязательной проверкой до activation, а не поводом переписать готовый corpus.
5. **Команда и восстановление:** FA-07 и FA-06 проектируются сейчас; rollout после role/revoke/restore probes. Внешний pilot FA-09 требует выбранного provider, ресурса и бюджета.
6. **Качество и горизонт:** FA-08 и UX28-14 по измеренному bottleneck, RU/EN в каждой UI задаче. S11 только после brand decision. Foundry, external MCP, connectors, support/content и Telegram сохраняют свои existing owners и explicit activation gates, не теряются и не маскируются generic manager.

P0 здесь означает блокер включения соответствующей автономии, а не доказанный production incident. P1 — сохранность/доверие/сквозной путь; P2 — управляемое качество. Оценки длительности не выдуманы: исполнитель оценивает после failing baseline и подтверждения локального delta. Неснятый внешний gate не мешает чистому контракту/fixtures.

## Корректирующие пакеты

Каждая строка открывает context, решение, точные точки чтения, шаги, positive/negative acceptance, зависимости и запреты. Поля на английском оставлены там, где это точная терминология существующих агентных контрактов.

| ID | Приоритет | Задача | Owner |
|---|---|---|---|
| [FA-01](packets/FA-01.md) | P1 | Воспроизводимая сборка из чистого checkout | S07 |
| [FA-02](packets/FA-02.md) | P0 | Запуск цепочек: одна существующая задача, полный join, общий admission | S04, M188, M103 |
| [FA-03](packets/FA-03.md) | P0 | Fail-closed квота на каждом unattended admission | S04, M94, CO-063 |
| [FA-04](packets/FA-04.md) | P0 | Атомарный DAG command вместо check-then-append | S04, M146, M190 |
| [FA-05](packets/FA-05.md) | P1 | Одна проверяемая очередь без alias-блокировок и ложного done | S10, M96, CO-108 |
| [FA-06](packets/FA-06.md) | P1 | Сохранность: mirror, backup, restore и runtime generations | S12, M198, S14 |
| [FA-07](packets/FA-07.md) | P1 | Настоящая identity и членство перед командным доступом | S09, M38, CO-069 |
| [FA-08](packets/FA-08.md) | P2 | PTY и обновление readers: ограниченная стоимость работы | M105, M102, M98 |
| [FA-09](packets/FA-09.md) | P1 | Подтверждённые внешние эффекты и runner admission | S03.effects, M140, S08, M176 |
| [FA-10](packets/FA-10.md) | P1 | Долговечность доказательств, документации и handoff | S10, S07, M96, CO-074 |
| [UXA-C01](packets/UXA-C01.md) | P1 | Use journal revision, not visible feed length, for home freshness | M42, M102 |
| [UXA-C02](packets/UXA-C02.md) | P1 | Keep partial attention and source freshness visible across all consumers | S14, M147, M151, M190 |
| [UXA-C03](packets/UXA-C03.md) | P1 | Render typed proposal decision refusal at the action | M168, M106 |
| [UXA-C04](packets/UXA-C04.md) | P2 | Recover terminal metadata loading and name launch cwd | M16, M17, M106 |
| [UXA-C05](packets/UXA-C05.md) | P2 | Preserve unread session state through AgentsSection | M108 |
| [UXA-C06](packets/UXA-C06.md) | P2 | Reconcile terminal/feed UX contracts and add real receipt navigation | S13, M42, M112 |
| [UXA-F01](packets/UXA-F01.md) | strategic | Capability bindings, replacement, and starter activation | M32, M34, M35, M17, M66 |
| [UXA-F02](packets/UXA-F02.md) | strategic | Account/resource connection product | M4, M9, M127 |
| [UXA-F03](packets/UXA-F03.md) | strategic | Observer evidence and cross-project proposal authority | M20, M129, M4, M9 |
| [UXA-F04](packets/UXA-F04.md) | strategic | Receipt-first run detail and independent project health | M5, M65, M188, M186, S13 |
| [UXA-F05](packets/UXA-F05.md) | strategic | Foundry host integration using existing adapter and contract | M32, M34, M37 |
| [UXA-F06](packets/UXA-F06.md) | strategic | Reviewed estate memory promotion and target transfer | CO-081, M135, M182, M154 |
| [UXA-F07](packets/UXA-F07.md) | strategic | Real membership and role interaction delivery | M38, M39, S09, M149, M151, M152 |
| [UXA-F08](packets/UXA-F08.md) | strategic | Constrained provider-view workspace host | M37, CO-091 |
| [UXA-F09](packets/UXA-F09.md) | strategic | Close one bounded operating loop at a time | M27, CO-085, M39, M25, M129, M21, M128, CO-036, S03.effects, S08 |
| [UXA-F10](packets/UXA-F10.md) | strategic | Northbound MCP binding lifecycle | M15, M188, S03 |
| [UXA-F11](packets/UXA-F11.md) | strategic | Complete per-runner permission interception and approval interaction | M140, M155, S03, M152 |
| [UX28-01](packets/UX28-01.md) | P1 | Bind task detail, brief drafts and writes to the task identity | S01 / M143 / M146 corrective continuation |
| [UX28-02](packets/UX28-02.md) | P1 | Make renderer reads keyed, current, independently failed and visibly stale | M102 + S14 / CO-111 corrective readers |
| [UX28-03](packets/UX28-03.md) | P1 | Stop marking unshown digest entries seen | M133 + M102 + S14 / CO-111 |
| [UX28-04](packets/UX28-04.md) | P1 | Recover optimistic board state on transport failure | M146 / S01 correction |
| [UX28-05](packets/UX28-05.md) | P1 | Scope harness to project and expose unknown grant reads | M145 + S14 + S02 authority display |
| [UX28-06](packets/UX28-06.md) | P2 | Complete exact evidence destinations and task history reading | S13 + M143/M133/M135/M141/M142 |
| [UX28-07](packets/UX28-07.md) | P2 | Finish inspectable memory stores beyond counts | M191 + M135 + S14 |
| [UX28-08](packets/UX28-08.md) | P2 | Implement target plan and distinct project history routes | M190 / SCR-40 |
| [UX28-09](packets/UX28-09.md) | P2 | Make search promises match searched stores | M141 correction |
| [UX28-10](packets/UX28-10.md) | P2 | Implement declared favourites threshold and replacement choice | M120 correction |
| [UX28-11](packets/UX28-11.md) | P2 | Make project settings save an honest single result | M17/M127 + S01 command integrity |
| [UX28-12](packets/UX28-12.md) | P2 | Manager interaction to confirmed artifact (existing future delivery) | M166–M175 / M194 + M153/M158 |
| [UX28-13](packets/UX28-13.md) | P2 | Complete estate agents control surface | M71 / SCR-39 + M187 |
| [UX28-14](packets/UX28-14.md) | P2 | Verify real runtime accessibility, resizing and native integration | M187 + M110/M117 + relevant scenario owners |
| [UX28-15](packets/UX28-15.md) | P2 | Reconcile scenario wording and shipped claims with evidence | evidence-docs + existing M/S ownership |
| [AX-01](packets/AX-01.md) | P0 | One admitted task → actual session → immutable ended TaskRun | S04, M188, M103, M152.continue |
| [AX-02](packets/AX-02.md) | P1 | One observed liveness result for watcher and live widget | M178, M179, M181, M189, S14 |
| [AX-03](packets/AX-03.md) | P1 | Recoverable question detail, receipt and exactly-once continuation | M151, M152.commit, M152.continue, S13 |
| [AX-04](packets/AX-04.md) | P1 | Immutable past context and safe next-context preview | M191, M49, S14, S12 |
| [AX-05](packets/AX-05.md) | P1 | Typed exact destinations and scope-safe async readers | S13, S01, M102, M187 |
| [AX-06](packets/AX-06.md) | P2 | Distinct graph/history/plan and decision readers | M190, M173, M188, M144 |
| [AX-07](packets/AX-07.md) | P2 | Cursor-aware Inbox as reader, not task store | M185, S14, CO-111 |
| [AX-08](packets/AX-08.md) | P1 | Cycle receipts carry actual pass outcome and visible coverage | S15, M186, M179 |
| [AX-09](packets/AX-09.md) | P2 | Safe manager/settlement activation path | M153, M158, M157, M166, M167, M169, M171, M194, M175, M168 |
| [AX-10](packets/AX-10.md) | P1 | Real trace-to-eval pipeline and evidence completeness | S05, M176, S08, M194 |
| [AX-11](packets/AX-11.md) | P2 | Retro review and privacy-separated feedback | M182, M154, M153, M184, M183.local, M183.upstream |
| [AX-12](packets/AX-12.md) | P1 | Storage, backup and authentication remain distinct gated capabilities | S12, S09, S07, M198 |
| [AX-13](packets/AX-13.md) | P2 | Versioned pipeline and routine editing | M18, M66, M67, M68, M90 |
| [AX-14](packets/AX-14.md) | P2 | Settings, usage and diagnostics finish their actual user paths | M72, M73, M83, M94, M81, M171 |
| [AX-15](packets/AX-15.md) | P2 | Service terminal, isolated browser and media readers | M10, M74, M75, M76 |
| [AX-16](packets/AX-16.md) | P2 | Notification identity and transport contract | M159, M160, M161, M162, M163, M164, M165 |
| [AX-17](packets/AX-17.md) | P1 | Repair scenario/owner and claimed delivery evidence drift | S10, CO-108, M189, M191, M152, M74, M75, M76 |

## Каждая существующая карточка: сохранить основание или доделать остаток

- [S01 — Сохранность пользовательской работы](packets/S01.md) · retain-delivered-foundation · delta: UX28-01, UX28-04, UX28-11, AX-05
- [S02.store — S02.store](packets/S02.store.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [S02.roots — S02.roots](packets/S02.roots.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [S02.acl — S02.acl](packets/S02.acl.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [S02 — Граница estate/project и файловых корней](packets/S02.md) · retain-delivered-foundation · delta: UX28-05, AX-01, AX-12
- [S03 — Полномочие, исполнение и доказательство — разные состояния](packets/S03.md) · retain-delivered-foundation · delta: FA-02, FA-09, UXA-F02, UXA-F04, UXA-F07, UXA-F09, UXA-F10, UXA-F11, AX-01
- [S04 — Надёжный запуск существующей задачи](packets/S04.md) · retain-delivered-foundation · delta: FA-02, FA-03, FA-04, AX-01
- [S05 — Безопасная полная трасса вызовов](packets/S05.md) · retain-delivered-foundation · delta: AX-10
- [S06 — Множество блокировок и атомарный ответ](packets/S06.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [S07 — Поставка, которой можно доверять](packets/S07.md) · retain-delivered-foundation · delta: FA-01, FA-10, AX-12
- [S08 — Один полный рабочий цикл и второй исполнитель](packets/S08.md) · retain-delivered-foundation · delta: FA-09, UXA-F09, AX-10
- [S09 — Командный доступ и первый полезный результат](packets/S09.md) · retain-delivered-foundation · delta: FA-07, UXA-F01, UXA-F02, UXA-F06, UXA-F07, AX-07, AX-09, AX-12, AX-16
- [S10 — Термины и доказательства с одним источником](packets/S10.md) · retain-delivered-foundation · delta: FA-05, FA-10, AX-17
- [S11 — PassionCode.ai → Fabric](packets/S11.md) · open-canonical-node · delta: UX28-15
- [S12 — Восстановление данных и честный sync contract](packets/S12.md) · retain-delivered-foundation · delta: FA-06, AX-04, AX-12
- [S13 — Достижимые действия и согласованные рабочие экраны](packets/S13.md) · retain-delivered-foundation · delta: UXA-C06, UXA-F04, UX28-06, AX-03, AX-05, AX-15
- [M103 — Доставка задания без ложного подтверждения](packets/M103.md) · retain-delivered-foundation · delta: FA-02, AX-01
- [M195 — Redaction: сохранить сделанное и закрыть обход](packets/M195.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [M196 — Sandbox уже включён в HEAD](packets/M196.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [M197 — RU/EN ratchet уже есть](packets/M197.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [M97 — Projector dissolve завершён](packets/M97.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [M198 — Детерминированная config_revision](packets/M198.md) · retain-delivered-foundation · delta: FA-06, AX-12
- [M109 — Завершить IPC Returns sweep](packets/M109.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [M98 — Извлечение по бизнес-границам](packets/M98.md) · open-canonical-node · delta: FA-08
- [M102 — У каждого reader свои причины обновления](packets/M102.md) · open-canonical-node · delta: FA-08, UXA-C01, UX28-02, UX28-03, AX-05
- [M105 — Убрать стоимость полного scrollback на байт](packets/M105.md) · open-canonical-node · delta: FA-08, UX28-13
- [M177 — Агент знает время, правила и происхождение](packets/M177.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [M155 — REFUSED / OBSERVED / ADVICE как контракт](packets/M155.md) · retain-delivered-foundation · delta: UXA-F11, UX28-05
- [M178 — Heartbeat с ожидаемым объектом](packets/M178.md) · retain-delivered-foundation · delta: AX-02
- [M179 — Наблюдатель вне агента](packets/M179.md) · retain-delivered-foundation · delta: AX-02, AX-08
- [M180 — Типы отказов и причинная связь](packets/M180.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [M181 — Честная деградация](packets/M181.md) · retain-delivered-foundation · delta: UX28-05, AX-02
- [M188 — Прогон, версия плана, шаги и чекпоинты](packets/M188.md) · retain-delivered-foundation · delta: FA-02, UXA-F01, UXA-F03, UXA-F04, UXA-F10, UX28-08, AX-01, AX-06
- [M149 — Агент задаёт и проверяет вопрос](packets/M149.md) · retain-delivered-foundation · delta: UXA-F07
- [M151 — Одна Board query, три масштаба](packets/M151.md) · retain-delivered-foundation · delta: UXA-C02, UXA-F07, AX-03
- [M152 — Ответ становится решением и доходит до работы](packets/M152.md) · retain-delivered-foundation · delta: UXA-F07, UXA-F11, UX28-08, AX-01, AX-03, AX-14, AX-17
- [M153 — Гигиена CEO без потери вопросов](packets/M153.md) · open-canonical-node · delta: FA-05, UX28-12, AX-09, AX-11
- [M154 — Ретро получает рабочий reader](packets/M154.md) · retain-delivered-foundation · delta: UXA-F06, AX-11
- [M182 — Закрытая категория инсайта](packets/M182.md) · retain-delivered-foundation · delta: UXA-F06, AX-11
- [M183.local — Local default-on service intake и durable suppression](packets/M183.local.md) · open-canonical-node · delta: FA-05, AX-11
- [M183.upstream — Versioned external feedback DTO, immutable preview и opt-out fencing](packets/M183.upstream.md) · open-canonical-node · delta: AX-11
- [M184 — Ретро как повторяемая работа CEO](packets/M184.md) · open-canonical-node · delta: AX-11
- [M173 — Граф решений — отдельная семантика](packets/M173.md) · retain-delivered-foundation · delta: AX-06
- [M157 — Settlement только по действующему основанию](packets/M157.md) · open-canonical-node · delta: AX-09
- [M158 — Criticality до включения автоматического settlement](packets/M158.md) · open-canonical-node · delta: FA-05, UX28-12, AX-09
- [M185 — Единый Inbox: нужно участие / произошло](packets/M185.md) · retain-delivered-foundation · delta: AX-07
- [M186 — Экран циклов с настоящими источниками состояния](packets/M186.md) · retain-delivered-foundation · delta: UXA-F04, AX-08
- [M187 — Плотность и единый disclosure](packets/M187.md) · open-canonical-node · delta: UX28-13, UX28-14, AX-05
- [M189 — Live виджет текущей задачи](packets/M189.md) · retain-delivered-foundation · delta: AX-02, AX-17
- [M190 — История агента, задачи проекта и целевой план](packets/M190.md) · retain-delivered-foundation · delta: FA-04, UXA-C02, UX28-08, UX28-15, AX-06
- [M191 — Память, pack preview, lineage и sync](packets/M191.md) · retain-delivered-foundation · delta: UX28-06, UX28-07, AX-04, AX-17
- [S14 — Read envelope и сохранение пользовательских настроек](packets/S14.md) · retain-delivered-foundation · delta: FA-06, UXA-C02, UX28-02, UX28-03, UX28-05, UX28-06, UX28-07, UX28-08, UX28-09, UX28-10, AX-02, AX-04, AX-05, AX-07, AX-14
- [S15 — Общий контракт повторяемого цикла](packets/S15.md) · retain-delivered-foundation · delta: AX-08
- [M166 — Детерминированное ядро CEO](packets/M166.md) · open-canonical-node · delta: UX28-12, AX-09
- [M167 — ModelPort может отсутствовать](packets/M167.md) · open-canonical-node · delta: UX28-12, AX-09
- [M168 — Checker перед любой записью предложения](packets/M168.md) · retain-delivered-foundation · delta: UXA-C03, UXA-F03, AX-09
- [M169 — Provider router с общим бюджетом попыток](packets/M169.md) · open-canonical-node · delta: UX28-12, AX-09
- [M171 — Учет model usage](packets/M171.md) · open-canonical-node · delta: UX28-12, AX-09, AX-14
- [M176 — Trajectory eval до настройки manager prompt](packets/M176.md) · retain-delivered-foundation · delta: FA-09, AX-10
- [M175 — Встроенный loop как один вариант manager](packets/M175.md) · open-canonical-node · delta: UX28-12, AX-09
- [M194 — Manager/CEO: выбираемый binding и полный lifecycle](packets/M194.md) · open-canonical-node · delta: UX28-12, AX-09, AX-10
- [S03.boundary — S03.boundary](packets/S03.boundary.md) · retain-delivered-foundation · delta: контракт/приёмка в карточке; foundation не переписывать
- [S03.effects — S03.effects](packets/S03.effects.md) · retain-delivered-foundation · delta: FA-09, UXA-F09
- [M152.commit — Ответ атомарно становится решением](packets/M152.commit.md) · retain-delivered-foundation · delta: AX-03
- [M152.continue — Доставка ответа существующей работе с подтверждением](packets/M152.continue.md) · retain-delivered-foundation · delta: AX-01, AX-03
- [M199 — Аккаунты провайдеров и автоматическое продолжение разговора](packets/M199.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.probe — Проверить изоляцию входа и возможности native resume](packets/M199.probe.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.accounts — Локальный реестр аккаунтов и официальный вход](packets/M199.accounts.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.auth — Изолированный auth context и координация refresh](packets/M199.auth.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.binding — Закрепить аккаунт и native conversation при запуске](packets/M199.binding.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.resume — Транзакция смены аккаунта с checkpoint и восстановлением](packets/M199.resume.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.usage — Квота того же аккаунта, который запускает работу](packets/M199.usage.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.auto — Автосмена по квотам: политика, выбор, polling и защита от циклов](packets/M199.auto.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.ui — Экран аккаунтов и управление автопереключением](packets/M199.ui.md) · open-later-canonical-node · delta: provider-auto-addendum
- [M199.acceptance — Проверить manual и automatic A→B→A на реальных CLI](packets/M199.acceptance.md) · open-later-canonical-node · delta: provider-auto-addendum

## Все вопросы последнего отчёта

| № | Вопрос | Решение для плана / gate | Owner |
|---|---|---|---|
| 1 | Auth provider | Предлагается Supabase Auth, потому что persons.auth_user/RLS уже проектируют этот seam. Provider choice требует предметного design review; offline contract/fixtures готовы к работе без credentials. | FA-07 |
| 2 | Invite transport | Сначала signed/scoped invite + same-invite return; email как adapter после выбора транспорта. Не смешивать token lifecycle с отправкой письма. | FA-07 |
| 3 | Project visibility | Сохранить явно estate-wide v1. Per-project ACL — отдельная смена scope/ADR, сейчас не блокирует single-estate pilot. | FA-07 |
| 4 | macOS runner/signing | Unsigned reproducible artifact и Linux checks делать сейчас; signing/notarization только на указанном runner с существующими credentials. | FA-01 |
| 5 | Toolchain lock | Фиксировать проверяемые tool versions/digests вместе с первой fresh+upgrade матрицей; до этого null честно, но не завершённая поставка. | FA-01 |
| 6 | Second real runner | Fixture без платных вызовов сейчас; owner выбирает runner, test resource и budget перед paid activation. Не изобретать сумму. | FA-09 |
| 7 | Manager admission owner | Named accountable operator принимает профиль после независимого eval; сам manager не утверждает свой допуск/повышение. | M194 |
| 8 | ModelPort first provider/key | ModelPort nullable; первый provider через существующий capability/account contract. Ключ только на доверенной стороне/gateway по правилам апстрима; OAuth не проксировать вопреки metadata. | M167 |
| 9 | Failover budget | Один AttemptBudget на invocation; попытки всех providers, timeouts и unknown usage входят в него. Значение лимита — recorded operator policy, не константа, угаданная агентом. | M169 |
| 10 | Recurrence threshold N | Считать unique verified occurrences, сохранить provenance и regression window. Порог policy-configured, не hardcode неподтверждённого N; критерий escalation отдельно от auto-fix. | M184 |
| 11 | superseded_by vs MemoryRevisionDTO | Сохранить semantic lineage через superseded_by; revision DTO нужен для точного исторического содержания/pack, одно не заменяет другое. Reuse M182 категории/occurrence IDs. | M191 |
| 12 | Rename S11 | Отложить механическое переименование до review границ бренда по ADR-0018. Не менять wire IDs, old events и public links массовым replace. | S11 |
| 13 | Screen order | Сначала saved work/Board/error states, затем Inbox и cycles, pack provenance, затем graph families по готовности producer. Не ждать весь manager для read-only views. | UX28-02 |
| 14 | First effect provider | Выбрать одну реальную операцию на ограниченном test target. Общий dispatcher без consumer убрать из ближайшей очереди, контракт и активационный gate оставить. | FA-09 |
| 15 | Backup archive/fencing | Отдельный archive manifest, detached restore и generation; место/retention требует policy выбора. Mirror не переименовывать в backup. | FA-06 |
| 16 | Queue script in Git | Да: parser/alias/DAG/ready integrity с negative fixtures. Исправление scratchpad не является воспроизводимой поставкой. | FA-05 |
| 17 | Retro on queue failure | Да: dated entry с фактическим report/source и тестом alias bug; historical cause не выдавать за наблюдённый в этом run scratchpad. | FA-10 |

## Полнота, границы и передача

- [SCN-001–027](scenarios-001-027.md), [SCN-028–049](scenarios-028-049.md), [SCN-050–078](scenarios-050-078.md): каждый сценарий с verdict и file:line.
- [Carry-over inventory](carryover.json): все 111 исходных CO rows, включая 81 open при корректном разборе escaped pipes; старый gate пишет 79, теряя CO-050/CO-060; historical external estate debts не объявлены новыми дефектами Fabric. [Milestones](milestones.json): все 196, с исходным владельцем и статусом.
- [Машинный индекс](index.json): baseline, зависимости, пакеты, вопросы, ограничения, cross-batch adjudication и owner repositories.
- [COMMON](COMMON.md): инварианты и протокол для каждого агента. [Handoff](../../evidence/plans/2026-09-09-final-audit.md): единственный entry point следующего исполнителя.

Нельзя гарантировать, что агент не ошибётся. Этот пакет делает ошибку обнаруживаемой: baseline, named contract, ограниченный diff, отрицательная проба, независимый consumer check и явный activation gate. Непроверенное не объявлено закрытым.


**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`project-audit`](https://github.com/ssheleg/task-pipeline) — проверка состояния и предыдущих находок
- [`ux-audit`](https://github.com/ssheleg/super-ux) — проверка сценариев
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — проверка визуальных ограничений
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — проверка инструкций и вызовов
- [`agent-evals`](https://github.com/ssheleg/agent-stack) — разделение тестов и наблюдений
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — проверка границ контрактов
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — декомпозиция и передача
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — проверяемые ссылки
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — lease и резерв CO
- `maintaining-fabric-workspace` — публикация карты — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
