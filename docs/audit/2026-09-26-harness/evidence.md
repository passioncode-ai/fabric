# Harness: доказательства на 2026-09-26

Базовая ревизия Fabric: [`019a23eaad9169e1e8b0751da8230f939ea76839`](https://github.com/passioncode-ai/fabric/tree/019a23eaad9169e1e8b0751da8230f939ea76839). Номера строк ниже относятся к ней. Ссылки на локальные файлы дают актуальный checkout; для воспроизводимого сравнения использовать этот commit. Исследованы native desktop, существующие тесты и два sibling owner repository; product demo не использован как runtime evidence.

## Source ledger

| ID | Наблюдение | Источник, точка проверки |
|---|---|---|
| E01 | Claude MCP/result adapter есть; Codex — `none`; readiness — структурный verdict | [agents.ts](../../../apps/desktop/src/shared/agents.ts):67,108–164,214–286; [pty.ts](../../../apps/desktop/src/main/pty.ts):145 |
| E02 | AgentSpec: name, instructions, runner, servers; нет набора skills/hooks | [agentSpec.ts](../../../apps/desktop/src/shared/agentSpec.ts):24–63 |
| E03 | Authoring adapter исключает host provisioning; два installer режима; разные contract pins | [adapter @ 5d2ccd7](https://github.com/passioncode-ai/fabric-agent-adapter/tree/5d2ccd7a124d7052f743529d8dcf0caf294bfdfd): `plugins/fabric-agent-adapter/skills/adapting-projects-to-fabric/SKILL.md`:19–26; `scripts/adapt_project.py` внутри этого skill:17–19,354–389,456–469; `bin/fabric-agent-adapter.js`:47–56,90–100; `install.sh`:16–24. [Contract @ 1eeb5a3](https://github.com/passioncode-ai/fabric-agent-contract/tree/1eeb5a302518a25af4c3ef82f1942aa3288bc9b9): `README.md`:20–21,57–59 |
| E04 | Grant preflight, restricted session files, context materialization, Claude args, cleanup; нет полного skills compiler | [sessionBundle.ts](../../../apps/desktop/src/main/sessionBundle.ts):49–79,97–148,153–184,191–246; [executionPacket.ts](../../../apps/desktop/src/main/executionPacket.ts):19–94 |
| E05 | Orientation записывает сам запрос и protocol hash; запись до построения ответа; ошибка записи допускает ответ | [agentSurface.ts](../../../apps/desktop/src/main/agentSurface.ts):637–738; [preamble.ts](../../../apps/desktop/src/shared/preamble.ts):19–26; [harnessBreak.ts](../../../apps/desktop/src/shared/harnessBreak.ts):104–130 |
| E06 | Kill без observed-stop receipt; explicit stop не помечает cancellation как quitting | [pty.ts](../../../apps/desktop/src/main/pty.ts):400,491–517; [index.ts](../../../apps/desktop/src/main/index.ts):575–589,3779 |
| E07 | Read-before-write не атомарен; любая existing delivery → alreadyDelivered | [continuationDelivery.ts](../../../apps/desktop/src/main/continuationDelivery.ts):95–98,144–170; реальный caller [index.ts](../../../apps/desktop/src/main/index.ts):2708,2731–2743; воспроизведение ниже |
| E08 | 4 enforced, 2 observed, 4 advice; enforced scope ограничен Fabric boundary | [protocolObligations.ts](../../../apps/desktop/src/shared/protocolObligations.ts):59–151; [agentSurface.ts](../../../apps/desktop/src/main/agentSurface.ts):290–311,619,1854; [agents.ts](../../../apps/desktop/src/shared/agents.ts):123 |
| E09 | Текущие builds 2.1.283 / 0.157.1 имеют unverified receipts; switch coordinator без native caller | [providerCapabilityMatrix.ts](../../../apps/desktop/src/shared/providerCapabilityMatrix.ts):28,205–217; [switchCoordinator.ts](../../../apps/desktop/src/main/switchCoordinator.ts):74; bounded search ниже |
| E10 | Статический scanner не распознаёт CLI loops; billed model call scan ничего не находит | [scanner.json](scanner.json); `node scripts/check-no-hidden-model-call.mjs`; scripts/check-hooks.mjs проверяет React hooks, не lifecycle hooks агентов |
| E11 | Память частично реализована, дальнейшие gaps и sources уже разобраны | [MEM evidence](../../launch/memory/evidence.md), [MEM-P0…P7](../../launch/memory/plan.md); эти native задачи этим аудитом не закрываются |
| E12 | CEO/bundle/foundry wider target хранится отдельно от реализации | [system-contract](../../architecture/system-contract.md):232–254; [agent-composition](../../architecture/agent-composition.md):94–129; [agent-production](../../architecture/agent-production.md):1–5,109–170 |
| E13 | Harness snapshot различает unavailable/partial и estate-wide grants | [harnessRead.ts](../../../apps/desktop/src/main/harnessRead.ts):40–104,140–199; `node --experimental-strip-types apps/desktop/test/harness-read.test.mjs` |
| E14 | Existing-task admission → spawn без compensation; lease update error и bind verdict не проверяются | [index.ts](../../../apps/desktop/src/main/index.ts):1517–1593; сравнить обработанный failure в startTask:1291–1325. Это source finding, не выполненный DB integration repro |
| E15 | deliverWhenReady возвращает до записи; единственный pendingDelivery заменяется; written event вызывается преждевременно | [pty.ts](../../../apps/desktop/src/main/pty.ts):244–273; [continuationDelivery.ts](../../../apps/desktop/src/main/continuationDelivery.ts):165–170; [index.ts](../../../apps/desktop/src/main/index.ts):1593 |

| E16 | Compile вызывается до spawn try/catch; ошибка после mint (например mkdir/write или propagated verification failure) может обойти discard | [pty.ts](../../../apps/desktop/src/main/pty.ts):330–358; [sessionBundle.ts](../../../apps/desktop/src/main/sessionBundle.ts):110–117,125–148,176–182; source-only finding, failure-injection acceptance H01/H04 |

Bounded source searches на базовой ревизии:

```sh
git grep -n -E 'skills/|bundle\.lock|settingSources|--bare|canUseTool|PreToolUse|PostToolUse' -- apps/desktop/src packages
# no matches (exit 1); это граница поиска, не доказательство отсутствия всех эквивалентов
rg -n createSwitchCoordinator apps/desktop/src
# apps/desktop/src/main/switchCoordinator.ts:74 — только определение
```

Contract pins: Fabric README:107 ссылается на `489737051828fafec92463df04b6a6fd3280c7b7`; authoring adapter фиксирует `20a818e648a4c09a60df0126d11626922e8b9094`; исследованный checkout contract — `1eeb5a302518a25af4c3ef82f1942aa3288bc9b9`. Разница SHA **не доказывает несовместимость**. Нужен semantic/schema diff и conformance по явно выбранному release; нельзя просто обновить pin до latest. Соседние репозитории не изменены, не опубликованы этой итерацией; их README ссылки выше — owner entry points.

## Диагностическое воспроизведение H02

```sh
node --experimental-strip-types docs/audit/2026-09-26-harness/reproduce-continuation.mjs
```

На исходном native модуле:

```json
{"case":"concurrent_same_decision","writes":2,"queued":2}
{"case":"crash_after_queue_before_write","writes":0,"alreadyDelivered":true}
```

Используется настоящий `createContinuationDelivery` и `createScopedStore`, синтетический PostgREST-shaped fake и fake PTY sink. Первый случай — две конкурентные доставки одного решения. Второй — durable queued row без записи в PTY. Это **детерминированное воспроизведение дефекта**, не live system certification и не положительный acceptance test. Exit 0 означает исполнение диагностики; значения выше являются провалом требуемого поведения. Script не включён как «зелёный тест правильности» в CI. После H02 заменить baseline diagnostic полноценными assertions желаемого поведения и DB/crash tests, сохранив исходные receipts.

Дополнительные risks из E07/E15: helper игнорирует query error; queued write не подтверждает actual PTY write; отсутствует proof consumer dedup. «Exactly once» нельзя обещать на основании одного уникального delivery id.

## Выполненные проверки

| Команда | Результат | Что НЕ доказывает |
|---|---|---|
| `python3 <agent-harness>/scripts/audit_agent.py apps/desktop/src/main --json` | 55 файлов рассмотрено, 0 agent-loop candidates, 0 findings; полный список blind spots в scanner.json | Отсутствие CLI loops в распознаваемом формате не означает отсутствие ошибок harness |
| `node apps/desktop/test/session-bundle.test.mjs` | exit 0, 26 `ok` checks | Live skills load, CLI conformance |
| `node --experimental-strip-types apps/desktop/test/harness-read.test.mjs` | exit 0 | Native process control |
| `node --experimental-strip-types apps/desktop/test/continuation-exactly-once.test.mjs` | exit 0, существующий последовательный retry | Concurrency/crash окна, найденные выше |
| `pnpm --dir apps/desktop exec vitest run src/shared/agents.test.ts src/shared/continuation.test.ts src/shared/providerCapability.test.ts src/shared/runOutcome.test.ts src/shared/runStatus.test.ts --maxWorkers=2` | 5 файлов / 59 tests passed | Provider execution |
| `node --experimental-strip-types apps/desktop/test/switch-operation.test.mjs` | исходно exit 1; после узкого исправления выбора exact pinned build exit 0 | Реальный switch driver; он не подключён |
| `node --experimental-strip-types apps/desktop/test/provider-capability-upgrade.test.mjs` | exit 0, historical receipts сохранены | Обновлённый CLI проверен живым запуском |
| `node scripts/check-obligations.mjs` | exit 0: 4 enforced symbols, 2 observed, 4 advice | Поведенческое соблюдение советов, native-tool containment |
| `node scripts/check-no-hidden-model-call.mjs` | exit 0: 339 source files, 1 allowed usage-read URL | Отсутствие затрат внутри внешнего CLI; runtime traffic не измерялся |
| В adapter @ 5d2ccd7: `python3 -m unittest discover -s test -v` и `python3 test/validate.py` | 8 tests PASS; distribution valid | Ownership-safe install/upgrade и загрузка skill живым host |

Scanner взят из `agent-stack/0.25.2/skills/agent-harness`; его машинный абсолютный путь нормализован в receipt. Проверки sibling adapter выполнены read-only audit agent; установка не запускалась. Точное совпадение contract checkout для schema validator не проверялось — **NOT_RUN**, не downgrade к structural-pass.

**NOT_RUN:** реальные Claude/Codex launch/stop/resume; изолированный Supabase lifecycle failure injection; полный Electron walkthrough; native tool interception; поведенческие evals выполнения skills. Это явные release gates H00/H09. Не были запущены установка skills, login, reset базы, миграции или внешние side effects. Итог локального fast и публикации записывается в [handoff](README.md).

## Классы выводов

- **Source invariant:** E01–06, E08–09, E12–16 с указанными границами.
- **Deterministic reproduction:** две поломки E07, последовательные и pure checks.
- **Proposal / judgement:** manifest, plan order, UX labels и рекомендуемая R0 boundary в architecture/plan.
- **Behavioral estimate:** не получен; live model evals отсутствуют в этой проверке.

Это сохраняет различие между кодом, вызываемым production, чистой моделью состояний, конфигурацией конкретного host и поведением агента.
