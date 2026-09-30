<sub>ssheleg skills — project-audit · ux-audit · agent-orchestrator · agent-harness · sheleg-design · brand-voice · copywriting</sub>

# Fabric — audit runtime, architecture seams and scenario batch

2026-09-07 · 153b4f029e626230d465d5d21d02fb8c9de5fadf · read-only · project-audit + ux-audit

REFINE: retain modular monolith and journal spine; repair authority/dispatch/read-truth seams before more unattended loops

## What matters

Сильная основа уже есть: проект переживает сессию; journal single writer и synchronous projections; authority, observed state и agent claims задуманы раздельно; локальные MCP credentials ограничены проектом и жизнью сессии; код прямо называет отложенные capabilities. Дефекты сосредоточены в композиции: корректные локальные функции соединены без единого command/dispatch transaction, namespace context и completion receipt. Более сильные агенты будут чаще и быстрее попадать в эти границы; дополнительный CEO loop до их исправления увеличит, а не устранит риск.

Главный инженерный приоритет: завершить reliable project kernel — estate-scoped commands, task/run identity, idempotent dispatch, genuine effect receipts, honest unknown states — и доказать один production recovery loop на собственном проекте. Это тот слой, который сохраняет пользу при росте силы моделей: команда получает общую управляемую память, доказательства, права и координацию независимо от конкретного исполнителя.

## Scope and limits

- No production datastore reads in this subagent. Parent resolves datastore/liveness and owns all measured adoption/incident frequency.
- No live Electron UI replay in this batch; browser/a11y and other scenarios covered by sibling/parent.
- No full suite duplication; parent runs pnpm and schema fixtures. Synthetic probes use in-memory data, except real loopback MCP HTTP transport.
- Planned unmet scenarios FAIL against their future spec, never counted as shipped regressions. No product outcome PASS claimed.
- Sibling adapter/contract source not needed to establish concrete runtime findings; parent contract/research batch owns external conformance.

## Executable evidence

Command: `node --experimental-strip-types /tmp/fabric-runtime-probes.mjs`

```json
[
  {
    "probe": "chain-repeat-two-ticks",
    "spawns": 2,
    "originalFollowerStatus": "backlog",
    "spawnedLinkCount": 0,
    "expected": {
      "spawns": 1,
      "originalFollowerStatus": "running"
    }
  },
  {
    "probe": "chain-waits-all-predecessors",
    "spawns": 1,
    "stillRunningPredecessors": 1,
    "expectedSpawns": 0
  },
  {
    "probe": "chain-pause-said-once",
    "pauseEvents": 2,
    "expectedPauseEvents": 1
  },
  {
    "probe": "grant-concurrent-and-project-scope",
    "verdicts": [
      "allow",
      "allow"
    ],
    "effectReceipts": 2,
    "expectedReceipts": 1
  }
]
{"probe":"foreign-estate-routine","spawns":1,"projectStarted":"foreign-project","journalEstate":"owner-estate","expectedSpawns":0}
{"probe":"quota-shape-drift","fiveHour":null,"sevenDay":null,"problem":null,"allowed":true,"expectedAllowed":false}
{"probe":"surface-policy-redaction-bypass","eventTypes":["policy.decided@1"],"syntheticRecognizedByRedactor":true,"rawSyntheticPersisted":true,"expectedRawPersisted":false}
```

In-memory probes preserve the real code path and mock only external stores/launch. The MCP redaction probe uses the actual HTTP server, initialization, session header and tool validation. Synthetic token contents were not printed. These demonstrate mechanisms; production consequences remain unobserved.

## Scenario coverage

| Scenario | Verdict | Maturity and gap | Receipts |
|---|---|---|---|
| SCN-001 | PARTIAL | basic-project-shipped; starter/planned — Onboarding сохраняет проект и выбранные repo с caller-chosen id; нет starter/revision review/seeded PM. Unique partial index ограничивает максимум одного PM, но создание не создает ни одного. Это не регрессия: scenario Coverage уже отмечает отсутствие starter, M35 unscheduled. | `docs/ux/scenarios.md:80`; `docs/ux/foundation.md:218`; `apps/desktop/src/renderer/src/Onboarding.tsx:57`; `apps/desktop/src/main/index.ts:712`; `supabase/migrations/20260831000001_migration_one.sql:73` |
| SCN-002 | FAIL | planned — Portfolio observer starter, dynamic project scope and read-only resource binding отсутствуют; M20 предложен, slice 4. Нормальный project без repo есть; это не portfolio observer. | `docs/ux/scenarios.md:102`; `docs/ux/scenarios.md:113`; `apps/desktop/src/renderer/src/Onboarding.tsx:113`; `docs/architecture/iteration-1-modules.md:265` |
| SCN-003 | PARTIAL | prompt-agents-shipped; admission/replacement-planned — Создание именованной runner configuration и серверный ceiling реализованы; нет capability admission selector, immutable binding revision, Replace, diff и atomic PM succession. | `apps/desktop/src/main/index.ts:1245`; `apps/desktop/src/main/index.ts:1270`; `apps/desktop/src/shared/agents.ts:87`; `docs/ux/scenarios.md:125`; `docs/evidence/backlog.md:234` |
| SCN-004 | PARTIAL | local-runtime-refusals-shipped; admission-planned — Неизвестный surface adapter отказывает, недоступные binaries disabled. Registry discovery и gate table не реализованы; shell/Codex explicitly nonconnecting, поэтому их отсутствие MCP не скрытая несовместимость. | `apps/desktop/src/main/sessionBundle.ts:176`; `apps/desktop/src/main/sessionBundle.ts:185`; `apps/desktop/src/shared/agents.ts:114`; `docs/evidence/backlog.md:236` |
| SCN-005 | FAIL | planned — Project MCP server grant — не OAuth account binding. Нет account subject verification, selectors ресурсов и per-agent read/draft/effect resource ceilings. Slice 4 сознательно только boundary. | `docs/ux/scenarios.md:166`; `docs/architecture/iteration-1-modules.md:265`; `apps/desktop/src/main/sessionBundle.ts:80` |
| SCN-006 | PARTIAL | basic-cards-shipped; full-health-planned — Карточка показывает название, purpose, repo path, live sessions и attention. Нет projection freshness, last/next run, PM, connection/production health по независимым dimensions. RT-07 ухудшает даже текущую attention honesty. | `apps/desktop/src/renderer/src/EstateHome.tsx:69`; `apps/desktop/src/renderer/src/EstateHome.tsx:60`; `docs/ux/foundation.md:245`; `docs/ux/scenarios.md:197` |
| SCN-007 | PARTIAL | attention-task-navigation-shipped; evidence-run-planned — Review/lease attention открывает task через callback; grantable ведет к project без exact run. Источник evidence/пин revisions/typed NodeResult SCR-09 отсутствуют; notification только foreground app. | `apps/desktop/src/renderer/src/AttentionPanel.tsx:22`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:123`; `apps/desktop/src/main/index.ts:1738`; `apps/desktop/src/renderer/src/SessionWindow.tsx:50` |
| SCN-008 | PARTIAL | sessions-and-tasks-shipped; durable-run-planned — Task и session detail/PTY end существуют; история не имеет pinned project/provider/routine revisions, structured envelope/checker verdict и resume checkpoint. ADR-0042 и M188 уже выбрали session+task как run; durable engine сознательно отложен CO-083. | `apps/desktop/src/main/index.ts:839`; `apps/desktop/src/shared/types.ts:166`; `apps/desktop/src/renderer/src/SessionWindow.tsx:50`; `docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md:19`; `docs/architecture/iteration-1-modules.md:454` |
| SCN-009 | FAIL | planned — routines имеют option_id и last_task_id; immutable provider revision, Replace, future binding resolution отсутствуют. Не объявлять schedule replacement проверенным только потому, что routine table отделена от agent_bindings. | `supabase/migrations/20260905000022_routines.sql:15`; `apps/desktop/src/main/routineTick.ts:73`; `apps/desktop/src/main/index.ts:879`; `docs/ux/foundation.md:263` |
| SCN-010 | FAIL | planned-cross-project — Текущая proposals projection — loop-bound escalation внутри одного project (M68), не ADR-0029 cross-project observed finding. Нет source/target ownership, evidence freshness, target PM routing/idempotency. | `docs/adr/0029-a-proposal-terminates-at-the-target-product-manager.md:18`; `supabase/migrations/20260905000023_loop_bound.sql:36`; `apps/desktop/src/main/agentSurface.ts:851`; `docs/architecture/iteration-1-modules.md:270` |
| SCN-011 | FAIL | planned-cross-project — Accept/Decline текущего loop proposal — иной сценарий. Target PM accept/refuse/supersede с immutable evidence и exactly-once target work не реализован. | `docs/ux/scenarios.md:300`; `supabase/migrations/20260905000023_loop_bound.sql:58`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:101`; `docs/adr/0029-a-proposal-terminates-at-the-target-product-manager.md:18` |
| SCN-012 | FAIL | planned-estate-transfer — task note→memory текущего project реализовано, но estate knowledge / accepted cross-project transfer отсутствуют. Не путать с SCN-045 note promotion. Это явная diet row, не незамеченный пропуск. | `apps/desktop/src/main/index.ts:1561`; `docs/architecture/iteration-1-modules.md:261`; `docs/architecture/iteration-1-modules.md:456`; `docs/ux/scenarios.md:322` |
| SCN-020 | FAIL | planned-end-to-end-loop — Нет producer production observation→owning PM→independent QA→release adapter→recovery observation. Current task/chain/policy foundations не выполняют full job. Сначала RT-01..06 + measured observer slice, затем проверять этот strategic scenario. | `docs/ux/scenarios.md:485`; `docs/ux/foundation.md:335`; `docs/architecture/iteration-1-modules.md:265`; `docs/evidence/specs/2026-08-16-software-fabric-carryover.md:97` |
| SCN-021 | FAIL | planned-end-to-end-loop — Исследование можно запустить вручную как task; весь content pipeline с независимыми проверками, publication receipts, GSC/analytics feedback не создан. M21/M128, S5; реализация зависит от truthful effects и chain delivery. | `docs/ux/scenarios.md:507`; `apps/desktop/src/main/index.ts:1422`; `docs/evidence/backlog.md:214`; `docs/evidence/backlog.md:583` |
| SCN-022 | PARTIAL | local-southbound-shipped; northbound-planned — Per-session loopback secret, one initialize, scoped context bundle работают. Owner UI create access, explicit project sets/operation scopes/expiry/rotation/audit lineage отсутствуют; M15 явно не завершен northbound. | `apps/desktop/src/main/agentSurface.ts:168`; `apps/desktop/src/main/sessionBundle.ts:97`; `docs/evidence/backlog.md:179`; `docs/ux/scenarios.md:529` |
| SCN-023 | PARTIAL | local-participation-shipped; external-commands-planned — Local scoped tools читают/пишут project memory/tasks через journal. Нет external resource catalog, idempotency keys, fabric_run_start/durable handle, checker lifecycle, command receipt envelope. Возвращаемые created ids достаточны для local tool, не для обещания всего external control contract. | `apps/desktop/src/main/agentSurface.ts:787`; `apps/desktop/src/main/agentSurface.ts:805`; `apps/desktop/src/main/agentSurface.ts:760`; `docs/evidence/backlog.md:179`; `docs/ux/scenarios.md:554` |
| SCN-024 | PARTIAL | session-revocation-shipped; owner-access-lifecycle-planned — Unknown/revoked bearer и неверный session header отклоняются; discard revokes before unlink. Expiring owner bindings/current-effect policy revocation/explicit cancel UI пока нет. CO-090 same-uid race документирован; это не вновь найденный обход и не решается chmod. RT-05 текущий grant scope выделен отдельно. | `apps/desktop/src/main/agentSurface.ts:189`; `apps/desktop/src/main/agentSurface.ts:219`; `apps/desktop/src/main/agentSurface.ts:329`; `apps/desktop/src/main/sessionBundle.ts:195`; `docs/evidence/specs/2026-08-16-software-fabric-carryover.md:101` |

Totals: {"PASS": 0, "PARTIAL": 9, "FAIL": 8, "BLOCKED": 0}. PASS here would mean full scenario execution, not mere existence of a similarly named table. All product outcomes remain unobserved.

## Findings and concrete acceptance checks

### RT-01 — Фоновые запуски и зеркало читают чужие estate

**S1 · consequence latent · decided-unpropagated · existing M38, M118, M13, M94**

routineTick ищет enabled без estate_id; chainAdvance ищет follows без estate_id; readProject принимает любой id; startTask пишет ORG1 независимо от project. readEstate экспортирует все projects/agents, refreshFileRoots берет все project_repos. Service role обходит RLS. SQL apply_routines обновляет по id без estate проверки.

Consequence: Воспроизведение: routine чужого estate вызвала startTask для foreign-project, receipt записывался в owner-estate. Реальный ущерб не наблюдался; родитель установил, что локальная БД содержит отдельный fixture estate с включенными routines. Это достижимо уже до multi-tenant релиза.

Receipts: `apps/desktop/src/main/routineTick.ts:56`; `apps/desktop/src/main/chainAdvance.ts:43`; `apps/desktop/src/main/index.ts:658`; `apps/desktop/src/main/index.ts:640`; `apps/desktop/src/main/workspace.ts:26`; `supabase/migrations/20260905000022_routines.sql:59`.

Remedy: Ввести estate-scoped repository/command context и использовать его в каждом scheduler, mirror, filesystem allowlist. Проверять estate/project parentage на write boundary. Сделать тест двух estates обязательным для всех новых query/command ports; не ограничиваться проверкой RLS под authenticated.

Acceptance: Fake fixture: owner + foreign, запускаются только owner. Local disposable DB: wrong-estate project/task/routine/mirror/write_roots не читаются и не мутируют; второй estate остается byte-identical.

### RT-02 — Chain advance не запускает существующий follower и повторяет работу

**S1 · consequence latent · decided-unpropagated · existing M68, M13, M188**

startTask всегда создает randomUUID; advance не передает follower id, не меняет его backlog, не пишет запуск/родителя. По одному follows ребру принимается решение, общий AND всех predecessors отсутствует. Отказ «said once» не дедуплицируется. Tool fabric_task_link не принимает needs — только прямые SQL fixtures могут объявить именованные входы.

Consequence: Воспроизведено: два ticks дают два новых running task, исходный B остается backlog, spawned links=0; B запускается при еще running C; повторный отказ дает два events. Самоповтор может расходовать квоту каждую минуту и обрывать прослеживаемость. Пользовательский инцидент не наблюдался.

Receipts: `apps/desktop/src/main/chainAdvance.ts:68`; `apps/desktop/src/main/chainAdvance.ts:127`; `apps/desktop/src/main/index.ts:851`; `apps/desktop/src/main/index.ts:1350`; `apps/desktop/test/chain.test.mjs:30`; `apps/desktop/src/main/agentSurface.ts:1099`.

Remedy: Один dispatchExistingTask(taskId, commandKey, expectedVersion): под транзакционным claim проверяет все prerequisites и named payloads, записывает переход B и происхождение attempt/run. Сделать needs доступным через настоящий MCP contract; обычный createTask отделить от dispatch. Ограничение и quota вызываются в общей точке unattended dispatch.

Acceptance: Реальный advancer + реальный task writer: A→B→C проходит один раз; два tick и restart не создают дополнительных tasks; два prerequisites ждут обоих; cancel не запускает; отсутствующий input блокирует; B сохраняет id; все inputs можно задать через MCP без raw journal.

### RT-03 — Квота разрешает unattended work при неизвестном формате, chains обходят gate

**S1 · consequence latent · decided-unpropagated · existing M94, M68, CO-096**

HTTP 200 с пустым body object становится quota с problem:null и двумя null windows; mayStart пропускает null windows и разрешает. ChainDeps вообще не содержит quota, поэтому chains проходят мимо M94.

Consequence: Воспроизведено 200 {} → allowed:true при обоих отсутствующих окнах. Смена недокументированного usage endpoint открывает разрешение именно когда ограничение неизвестно. Реальная потеря квоты не наблюдалась.

Receipts: `apps/desktop/src/main/quota.ts:181`; `apps/desktop/src/main/quota.ts:193`; `apps/desktop/src/shared/quotaGate.ts:61`; `apps/desktop/src/main/chainAdvance.ts:24`; `apps/desktop/src/main/chainAdvance.ts:127`; `apps/desktop/src/main/routineTick.ts:88`.

Remedy: Валидировать quota response, фиксировать unavailable/unsupported отдельно от zero; при отсутствии нужного окна unknown блокирует unattended. Общий DispatchGate обслуживает routines, chains, notifiers, manager, а ручной запуск сохраняет отдельную пользовательскую политику.

Acceptance: 200 {}, неизвестные поля, null/NaN/отрицательная utilization, недоступное окно и >90% запрещают unattended; нормальная измеренная квота разрешает; chain не может стартовать без того же gate.

### RT-04 — Разрешение агенту записывается как уже совершенный внешний эффект

**S1 · consequence latent · decided-unpropagated · existing M137, M139, M140, ADR-0028**

fabric_effect_request говорит Ask BEFORE doing one, затем немедленно вызывает recordEffect; тот пишет effect.executed@1 и тратит grant, хотя публикация/платеж/удаление еще не выполнены и внешний receipt отсутствует.

Consequence: Журнал утверждает, что внешний эффект состоялся, после одного получения разрешения. Если агент завершится, публикации не будет, но effect.executed останется. Это противоречит продукту, где наблюдение сильнее утверждения агента. Успешных реальных эффектов в этом аудите не наблюдали.

Receipts: `apps/desktop/src/main/agentSurface.ts:1163`; `apps/desktop/src/main/agentSurface.ts:1209`; `apps/desktop/src/main/policy.ts:228`; `apps/desktop/src/main/policy.ts:234`; `supabase/migrations/20260903000015_authority_plane.sql:26`.

Remedy: Разделить authorization decision/reservation, execution request, observed external receipt, reconciliation/unknown outcome. External effect adapter исполняет и подтверждает; cooperative agent acknowledgement маркировать claim, не observed effect. Receipt должен содержать проверяемый внешний handle.

Acceptance: Вызов effect_request без внешнего действия не увеличивает executed count; падение после grant показывает authorized/unknown, не executed; эффект записывается только после адаптерного receipt; retry после сетевого timeout выполняет reconcile прежде повтора.

### RT-05 — One-shot grant проверяется и расходуется неатомарно и без project/action scope

**S1 · consequence latent · decided-unpropagated · existing M3, M137, M140, ADR-0028**

Grant row имеет estate/floor/target, но не project/actionClass. evaluate проверяет read unspent и позже recordEffect делает insert/update отдельно; consumed_at update error игнорируется. CHECK floor_class IS NULL OR grant_id IS NOT NULL проверяет только наличие ссылки: живой/matching/expiry/estate не гарантированы схемой. Grant issued event не содержит grant id, поэтому issuance и direct row невозможно полноценно восстановить как projection.

Consequence: In-memory repro: две конкурентные заявки (включая другую project/actionClass) получают allow и создают два receipts по одному grant. Возможны cross-project reuse, ложный consumed receipt при failed update и journal/authority drift после сбоя. Последствия латентны.

Receipts: `apps/desktop/src/main/policy.ts:77`; `apps/desktop/src/main/policy.ts:130`; `apps/desktop/src/main/policy.ts:195`; `apps/desktop/src/main/policy.ts:248`; `apps/desktop/src/main/policy.ts:257`; `supabase/migrations/20260831000001_migration_one.sql:80`; `supabase/migrations/20260831000001_migration_one.sql:104`; `docs/adr/0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md:30`.

Remedy: Сделать atomically reserve/consume exact grant через command RPC с estate/project/action/resource/expiry/revision, uniqueness per execution command; journal+grant state обновлять в одной транзакции. Невалидный grant отвергается write boundary. Исключение non-projection grants должно либо быть документированным с backup/restore, либо закрыться проекцией.

Acceptance: Два параллельных потребителя одного grant: ровно один reservation; ошибочный project/action/estate/expired/spent grant не принимается через raw RPC; ошибка persistence не выдает executed success; rebuild/restore сохраняет state и lineage grant.

### RT-06 — M195 redaction обходится через policy dependency

**S1 · consequence latent · decided-unpropagated · existing M195, M140**

Agent-supplied why/target/actionClass проходят прямо в Policy.decide и его journal.append, минуя appendRedacted. Механическая проверка raw appends внутри одного файла не видит downstream writer.

Consequence: Real loopback MCP + in-memory journal: synthetic ghp token распознается redact(), но сохраняется сырым в policy.decided. Значение синтетического токена в отчет не включено. Реальное попадание секрета не проверялось.

Receipts: `apps/desktop/src/main/agentSurface.ts:380`; `apps/desktop/src/main/agentSurface.ts:1190`; `apps/desktop/src/main/policy.ts:163`; `apps/desktop/src/main/policy.ts:175`.

Remedy: Redaction на общем boundary agent-originated events (включая policy и будущие delegates), с provenance/field policy, а не только на direct this.journal.append call sites. Inventory по dataflow всех text sinks и негативный regression test.

Acceptance: Секрет-сентинел в каждом пользовательском текстовом поле каждого MCP tool не присутствует в journal/projections/log output; dependency-generated policy events тоже проверяются; ordinary identifiers не повреждаются.

### RT-07 — Attention queue может показывать решенное как ожидающее и скрывать неизвестное

**S2 · consequence latent · decided-unpropagated · existing M140, M146, M147, M185, M186**

readAttention берет последние 50 policy.decided, затем filters refuse; не связывает отказ с grant/resolution/new allow. Ошибки Supabase игнорируются и data??[] выглядит пустотой. EstateHome catch→setWaiting({}) убирает attention. Grant button не имеет pending/idempotency и item не обновляется до poll.

Consequence: Решенный отказ остается пока не вытеснится 50 другими decisions, нерешенный может исчезнуть из-за лимита; повторные клики выдают несколько grants. При outage карточки выглядят без ожиданий. Выведено из полного read/call chain, пользовательский инцидент не измерялся.

Receipts: `apps/desktop/src/main/index.ts:1636`; `apps/desktop/src/main/index.ts:1652`; `apps/desktop/src/main/index.ts:1684`; `apps/desktop/src/shared/attention.ts:11`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:101`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:126`; `apps/desktop/src/renderer/src/EstateHome.tsx:60`.

Remedy: Строить obligation projection/query по request id и terminal resolution, дедуплицировать retries, не обрезать unresolved по общему журналу. ReadResult stale/error/fresh обязан дойти до cards/panel. Grant command idempotent по request и pending UI.

Acceptance: Refuse→grant→allow удаляет ровно этот item; >50 нерешенных все остаются доступны; 50 новых unrelated decisions не скрывают старый unresolved; backend error показывает stale/unknown; double click не создает второй grant.

### RT-08 — Project config_revision меняется при rebuild — уже учтенная работа M198

**S2 · consequence latent · decided-documented · existing M198, M97**

Replay поверх существующих rows снова инкрементирует config_revision; P24 исключает колонку явным documented exception.

Consequence: Ревизия, которую будущий run/provider binding должен pin, не является детерминированной. Новую карточку не создавать: это точное повторное подтверждение M198. Parent full suite owns DB checks.

Receipts: `supabase/migrations/20260906000030_dissolve_legacy_projector.sql:61`; `supabase/migrations/20260906000030_dissolve_legacy_projector.sql:67`; `packages/schema/test/planted.test.mjs:1020`; `docs/evidence/backlog.md:682`.

Remedy: Исполнить M198: revision из event sequence/count или полного projection rebuild baseline, убрать exclusion P24 после исправления. Связать c prerequisite любых pinned-run revisions.

Acceptance: Два последовательных rebuild и rebuild после restart сохраняют полные hashes включая config_revision; planted incremental projector обязательно ломает gate.

### RT-09 — Документированная архитектура и реальные текущие контракты разошлись

**S2 · consequence latent · decided-unpropagated · existing M97, M98, M145, M188, M194, CO-074**

Module design declares packages/policy/work/runner/memory, SDK NodeResult path and run/node event registry; actual ports reside under main, a task/startTask is PTY-based and canonical current ADR-0042 defines run as session+task. Map claims every tool call journalled, but read-only agents/leases do not journal generic invocation; M145 already states missing per-tool counters. Old design/deferred/same-change claims coexist.

Consequence: Следующий агент рискует строить второй run store, оценивать полноту по устаревшему registry или считать готовым trajectory dataset, которого нет. Это документальный дефект, не основание создавать все прежние packages или менять принятый v1 topology.

Receipts: `docs/architecture/iteration-1-modules.md:14`; `docs/architecture/iteration-1-modules.md:70`; `docs/architecture/iteration-1-modules.md:153`; `docs/architecture/iteration-1-modules.md:417`; `docs/architecture/agent-system-map.md:38`; `docs/architecture/agent-system-map.md:103`; `apps/desktop/src/main/agentSurface.ts:551`; `apps/desktop/src/main/agentSurface.ts:1218`; `docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md:19`; `docs/evidence/backlog.md:631`.

Remedy: Один generated as-built contract/module inventory, ссылки canonical/current/proposed/superseded в каждом architecture doc; executable drift checks на exports/event schemas/tool manifests/run definition. Не переписывать ADR history; явное supersession mapping и decision propagation matrix.

Acceptance: Для каждой current claim резолвится symbol/handler/schema/test; run vocabulary agrees ADR-0042; generic tool traces marked absent until implemented; inventories generated from actual code, no hand-maintained counts.

### RT-10 — Проверка task-link cycle fail-open при ошибке и не сериализована с append

**S2 · consequence latent · decided-unpropagated · existing M146, M188, M190**

would_close_cycle RPC result destructures data only; if error/null then closes!==true, append proceeds. Precheck and journal append are separate transactions; opposite edges can both pass precheck before either append.

Consequence: DAG может стать циклом, несмотря на обещание refusal at draw time. Следующий шаг исполняется на некорректном плане или никогда не стартует. Static mechanism, production consequence unobserved.

Receipts: `apps/desktop/src/main/agentSurface.ts:1112`; `apps/desktop/src/main/agentSurface.ts:1116`; `apps/desktop/src/main/agentSurface.ts:1121`; `supabase/migrations/20260831000007_write_boundary.sql:103`.

Remedy: Cycle check на command acceptance под тем же lock/transaction, который append использует; неизвестный result от query отказывает явно. Projector replay остается total, command validator несет отказ.

Acceptance: Injected RPC failure refuses/no event; parallel A→B and B→A accepts exactly one; diamond DAG remains valid; wrong-estate target refused before graph traversal.

## Module coverage

| Module | State | Findings | Receipts |
|---|---|---|---|
| schema / migration chain | implemented; partial invariant coverage | RT-01, RT-05, RT-08, RT-10 | `supabase/migrations/20260831000007_write_boundary.sql:73`; `supabase/migrations/20260906000030_dissolve_legacy_projector.sql:261`; `packages/schema/test/planted.test.mjs:1004` |
| journal | implemented; one RPC writer + bounded retry | RT-05, RT-09 | `packages/journal/src/index.ts:69`; `supabase/migrations/20260831000007_write_boundary.sql:103` |
| policy / authority | implemented narrow floor; gaps before unattended effects | RT-04, RT-05, RT-06, RT-07 | `apps/desktop/src/main/policy.ts:58`; `apps/desktop/src/main/agentSurface.ts:1158` |
| runner / session bundle / gateway | Claude Code integrated; other descriptors honestly degraded; same-uid accepted debt | RT-09 | `apps/desktop/src/shared/agents.ts:87`; `apps/desktop/src/main/sessionBundle.ts:80`; `apps/desktop/src/main/agentSurface.ts:168` |
| work / routines / chains | implemented partial; chain orchestration defects | RT-01, RT-02, RT-03, RT-10 | `apps/desktop/src/main/routineTick.ts:50`; `apps/desktop/src/main/chainAdvance.ts:36`; `apps/desktop/src/main/index.ts:839` |
| quota | implemented vendor-specific snapshot; malformed-success fail-open | RT-03 | `apps/desktop/src/main/quota.ts:128`; `apps/desktop/src/shared/quotaGate.ts:45` |
| memory / transcripts / context pack | local project memory implemented; cross-project promotion planned; dedicated parent batch owns depth | RT-06, RT-09 | `apps/desktop/src/main/agentSurface.ts:739`; `apps/desktop/src/main/index.ts:1561`; `docs/architecture/iteration-1-modules.md:261` |
| proposals | loop-bound proposals implemented; cross-project contract planned |  | `supabase/migrations/20260905000023_loop_bound.sql:36`; `docs/architecture/iteration-1-modules.md:265` |
| connectors / external accounts | not yet implemented; scheduled slice 4 boundary |  | `docs/architecture/iteration-1-modules.md:265` |
| MCP surface / preload | local session tool surface implemented; external M15 planned | RT-05, RT-06, RT-09, RT-10 | `apps/desktop/src/main/agentSurface.ts:214`; `apps/desktop/src/preload/index.ts:1`; `docs/evidence/backlog.md:179` |
| workspace mirror / filesystem scope | implemented; estate scoping gap | RT-01 | `apps/desktop/src/main/workspace.ts:26`; `apps/desktop/src/main/index.ts:639` |
| estate/project/attention UI | implemented basic monitoring; full multidimensional health planned | RT-07 | `apps/desktop/src/renderer/src/EstateHome.tsx:69`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:42` |

## Proposed order for the updated plan

1. Preserve current single-process modular monolith and journal. Before feature work, add the seven reproductions as failing regression tests; resolve the schema fixture/live-app namespace split. Measure estate-scoped rows without launching any jobs. RT-01.
2. Introduce a shared typed command boundary in Postgres plus estate-scoped repository ports. Distinguish command validation from pure replay projection; enforce ownership, expected version, command identity and atomic state transition. Do not add a message bus or distributed services. RT-01/05/10.
3. Repair existing-task dispatch and chain join semantics, expose named inputs through the actual contract, put quotas and loop lineage at every unattended entry. A routine, a chain follower and a future notifier must call the same dispatcher. RT-02/03.
4. Repair effect lifecycle and grant scoping/atomicity before publishing/payment automation. Authorization is not execution; external receipt and unknown/reconcile state are first-class. Per-runner enforced permission hook remains M140, documented and explicit, with a runner capability passport. RT-04/05.
5. Close redaction at every dependency write and make attention truth-preserving under outage, pagination and resolution. Keep last-known data labeled stale and separate no-work from unreadable-work. RT-06/07.
6. Execute M198 and remove the P24 exclusion. Make architecture/current-contract inventory generated and link old sketches to their replacement; do not implement superseded run/node storage solely because old design says so. RT-08/09, M98.
7. Make existing project harness observable: context-pack identity, task-session run history, heartbeat/outside watch, generic tool invocation outcome traces where required for eval. Use deterministic observations plus labeled agent claims. Land trajectory eval acceptance before tuning the manager prompt or expanding autonomous agents. M176/M177/M178/M179/M188/M191.
8. Prove one closed production loop (SCN-020) on a declared owner project: sourced signal → assigned task → independent check → authorized release → observed recovery. Only then promote content/research chains SCN-021 and external northbound control SCN-022..024. Avoid making all future scenario FAILs urgent implementation tasks.

## Preserved deliberate decisions

- One operator with a service role confined to main is v1 architecture; this is not by itself a leak. The mistake is failing to carry its estate through queries that already touch fixture/other estates.
- Same-uid credential race is explicitly CO-090, not a new chmod problem. It becomes an isolation gate before running untrusted code.
- Supabase is synchronous; no Temporal/Cedar/vector DB/marketplace is needed to repair the concrete seams above. Their return triggers are stated in the diet table.
- Codex is explicitly a standalone descriptor without Fabric MCP; absence is shown in source. Cross-runner conformance remains CO-074, not a proven product claim.
- Cross-project proposals, external OAuth resource bindings, northbound MCP, independent checker workflow and estate promotion are planned work. Their absence must remain visible in the verified plan, but is not a regression of shipped code.

## Cross-batch and actual skills

Parent must merge RT-07 with UI batch; RT-06 with security/memory batch; RT-09 with vision/plan batch. RT-10 may overlap graph/task audit. No duplicated board ids reserved.

Used: project-audit — checked call sites, previous decisions and observed versus latent consequences; ux-audit — traced the 17 assigned scenarios through their foundation stories/flows and actual reachable handlers. No application code, shared registers, ADRs or scenario statuses changed.

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
