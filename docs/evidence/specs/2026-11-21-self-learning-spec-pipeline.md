# The self-learning spec pipeline, the template graph and the organization graph (the owner's order No. 1 of 2026-11-21)

Date: 2026-11-21. Owner of this document: this repository (Fabric). Owners of the parts: §4. Board request `135c2d6b`
(thread `e3c20e5e`), relayed verbatim from the owner's Telegram through Personal Communicator by the operator's
own personal project (provenance `trusted`); the task file named in the request is on the operator's machine only.

**Status.** Program spec, stage «decomposition». Nothing in it is built yet. It **amends the plan of record**, the
system design of 2026-11-21 (fabric-workspace `docs/plans/2026-11-21-system-design/`, commit `ea088d67`), and does not
run beside it: what the design already holds is cited, and only the gaps get new small specs (§3, §4).

## 0. The order, verbatim

> ЗАДАЧА №1 ОТ СЕРГЕЯ (максимальный приоритет). Самообучающийся пайплайн спек + граф темплейтов + граф организации.
>
> ГРАФ ТЕМПЛЕЙТОВ: микроблоки/микроинтерфейсы, из которых на лету собираются дашборды и репорты. Best practices для мобилки/веб/SaaS/суппорт/SMM/контент. Покрытия: kickstarter, SaaS, мобилка, TG-бот, Discord, WhatsApp, соцсети.
>
> ДЕФОЛТНЫЕ ТЕМПЛЕЙТЫ-АГЕНТЫ (без UI или базовый): мобилка, SaaS-веб, TG-бот, мультипродуктовый борд, борд аналитики, борд продаж, Data API и ML.
>
> ГРАФ ОРГАНИЗАЦИИ: Assessment собирает граф по людям/процессам/связям/таскам, PM дополняет. Единый граф, без дублирования.
>
> КОММУНИКАТОРЫ МЕЖДУ ГРАФАМИ: доверенные без гейтов, с гейтами (область данных, динамические, жёсткие). Агенты сами настраивают на основе владения данными.
>
> АНАЛИЗАТОРСКИЙ СЕТАП: Fable 5.5 + Opus 5.5 на подписках, Sonnet + Haiku для ресерча, Pi для анализа кода/математики.
>
> МЕХАНИЗМ СЛОЖНЫХ СПЕК: сложная задача → сложная спека → декомпозиция на мелкие → раскидка по проектам. Спеки с векторами на графах, привязаны друг к другу.
>
> ОБУЧЕНИЕ ПАЙПЛАЙНА: скиллы жёстко завязаны, harness контролирует что повлияло, A/B тесты в разных worktree/ветках, ретро пайплайна.
>
> ЦИКЛ: сначала прогон через Fable 5.2 за токены → улучшить → запечь в протокол → отдельная спека про обучение/хранение → пересмотреть существующие спеки.
>
> ВЕРИФИКАЦИЯ: проверка на шагах пайплайна, волны вычистки, таск-пайплайн.
>
> ПОРЯДОК: ядро пайплайна → графы → верификация.

Orders of the same night on Fabric's board that touch this one, read and answered in their own threads, not here:
`f55c1105` (the model strategy; it refines §3.7), `ae493fde` (research methodologies and TRIZ; it feeds the learning of
§3.2), `204ecd3a` (smart matching of tasks arriving on the board; it reads the spec graph of §3.1).

## 1. Vision check

Aligned. It serves the system design's Layer A (the learning loop: a failure ends in a check) and Layer B (Memory and
graphs, the graph of graphs), and Fabric's coordination layer
([ADR-0133](../../adr/0133-agents-are-created-composed-and-fixed-in-fabric-and-fabric-is-the-harness-every-coding-agent-reaches.md)).
No person-facing surface changes at this stage.

## 2. What already exists

| Block of the order | What exists | Where | State |
| --- | --- | --- | --- |
| Complex specs | the guided flow requirements, vision, spec, phases | ADR-0158, roadmap RM-29 | designed |
| Complex specs | decomposition of a platform into bricks with their own specs; the work graph | task-pipeline `references/decomposition.md`, `references/work-graph.md` | shipped |
| Complex specs | the whole estate's design decomposed into 49 project specs and distributed by board | system design `specs/`, `distribution.md` | done by hand, 2026-11-21 |
| Specs on graphs | the estate index and graph in Fabric's core: nodes, edges, local vectors, two doors | [ADR-0200](../../adr/0200-the-estate-index-and-graph-live-in-fabrics-core.md), [spec](2026-11-19-estate-index-and-graph.md) | shipped in the candidate |
| Pipeline learning | retro, `retro.publish`, the improvement loop | task-pipeline `HOW-IT-WORKS.md` §10 | shipped |
| Pipeline learning | lesson to rule to check, fingerprints, second sighting | system design Layer A item 7, SD-ADB-03 | designed |
| A/B in branches | branching from any step, compared variants | agents database pattern `pipeline-branching` 1.3.1 (D-49) | shipped for media and content, not for specs or skills |
| A/B measured | `agent-change-measure/1` | agents database D-28, R31 | designed |
| Template graph | Create screen with templates; Dashboards embedded | system design SD-FAB-13, SD-DSH-03 | designed |
| Template graph | the data room's blocks as tiles in Dashboards | unified plan row 2.10 | done |
| Default agents | 25 templates and their etalons | agents database `templates/`, `docs/template-repos.md` | §3.4 maps them |
| Organization graph | `process-graph/1`, the business manager and the process map | agents database pattern `process-graph` (D-80), template `org-administrator` 1.35.8 §6b | shipped in the template, not wired in passioncode-pm-agent (its K-129) |
| Organization graph | the organization level of Memory | system design Layer B, levels table | designed |
| Gates between graphs | graph of graphs: named gates, windowed grants, owners approve | system design Layer B; `memory-grant/1`, `owns` edges; pattern `scope-gate` (D-67) | designed |
| Model setup | tiers, not names; fallback inside a tier | system design Layer H, `model-policy/1` | designed |
| Verification | gates, certification tiers, waves, residue | task-pipeline `references/verification.md`, `gates.md`, `waves.md`, `residue.md` | shipped |

## 3. The design of the gaps

### 3.1 The mechanism of complex specs (the pipeline's core)

1. **A spec is a node.** `spec/1`: id, parent, owner project, the order it serves (verbatim reference), acceptance,
   dependencies, state (`draft`, `distributed`, `accepted`, `building`, `verified`, `superseded`), source (path, commit).
   Edges: `decomposes` (parent to child), `depends-on`, `implements` (spec to backlog row, commit, release),
   `supersedes`, `relates-to`. Vectors from the same local embeddings as the estate index (`embedding-policy/1`), so a
   new spec finds its neighbours by meaning and by edge.
2. **The flow.** A complex task is grilled to a complex spec (task-pipeline stages 1 to 4, ADR-0158's flow). The
   decomposition step cuts it into small specs, each with exactly one owner project and its own acceptance. The
   distribution step sends each as a board request (`com.submit`, capability `change.request` or the owner's declared
   one) carrying the spec id, and holds a receipt per send (SD-FAB-03). The owner's backlog row names the spec id; the
   request's states flow back into the spec node.
3. **First proof.** The system design of 2026-11-21 is exactly this flow done by hand. Re-expressing its 49 specs and
   this one as spec nodes, with a walk from the order to each project's row, is the acceptance of the core.

### 3.2 The pipeline learns

1. **Skills bound to stages.** Each pipeline stage declares the skills it loads, by name and version. A stage that runs
   without its declared skills fails its gate instead of running quietly without them.
2. **The harness records what influenced.** Each run writes one `pipeline-run/1` record per stage: skills and versions,
   model and tier, the hash of the rules and prompt it read, the inputs' ids, the outcome (gate verdicts, defects found
   later, time, cost). Counts and ids only, no content. With it a defect found later is traced to the stage, skill
   version or model that let it through.
3. **A/B in worktrees.** A variant of a stage (a skill version, a prompt, a model tier) runs on the same input in its
   own worktree and branch (`pipeline-branching`). Objective checks first; then a judge of another model family than
   the one that produced the variant (the operator's two-model rule). The result is an `agent-change-measure/1`; the
   loser's branch is archived under `refs/archive/<date>/`, never just deleted.
4. **Retro per run.** Every run ends in a retro; its lessons enter Layer A's ladder (second sighting, a candidate rule
   with its check).

### 3.3 The template graph

1. **A micro-block is a node.** `block/1`: id, the data it needs (a door operation and its fields), the view kinds it can
   take (tile, table, chart, timeline, list, form), domain tags, the best-practice notes it carries, accessibility.
   Edges: `composes`, `requires-data`, `variant-of`, `replaces`.
2. **Composed on the fly.** A dashboard or a report is a composition: block ids, layout and bindings, generated from a
   goal and the data doors a service has, then kept as a versioned recipe (never overwritten, R28).
3. **Coverage.** Domains: mobile, web, SaaS, support, SMM, content. Product kinds: Kickstarter, SaaS, mobile, Telegram
   bot, Discord, WhatsApp, social networks.
4. **Owners.** The catalogue as data: the agents database (like `model-policy/1`). Rendering a live page: Fabric
   Dashboards (SD-DSH-03). Fabric's Create screen consumes it (SD-FAB-13). A static report: Reports.

### 3.4 Default agent templates

«Без UI или базовый»: headless by default, with a basic page composed from §3.3's blocks.

| Asked for | Nearest etalon today | Gap |
| --- | --- | --- |
| mobile | `store-publisher` (store work) | an app-operations agent (releases, crashes, reviews) as a variant |
| SaaS web | none | new template |
| Telegram bot | `product-bot`, `chat-assistant`, `support-answerer` (private-chat-bot) | pick one as the default variant |
| multi-product board | `org-administrator` (in part) | new variant over several products |
| analytics board | `growth-analytics` 1.10.2 | the board composed from blocks |
| sales board | `sales-leads`, `deal-desk` | the board composed from blocks |
| Data API | `data-room` 1.11.1 (`facts-server`, `database-query`) | none for the API itself |
| ML | none | new template |

New templates and variants go through the architect's design workflow and are etalons on PassionCode.ai (R27, D-23).

### 3.5 The organization graph

1. **One store.** The organization level of Layer B, with `process-graph/1` as its schema, held by the organization's
   PM agent (template `org-administrator`, §6b). Assessment writes into it as a source lane (processes, task classes,
   links between teams and projects, activity units) and keeps no graph of its own. The PM agent adds what people tell
   it (roles, owners, decisions). Duplicates are prevented by node ids and Layer B's merge rules, not by convention.
2. **People.** The base's trap and company-assessment-agent's recorded decision forbid a reading of a person beyond
   North Star principle 10 (EU AI Act Annex III, GDPR Art. 22). So people appear as roles and as owners of processes and
   tasks; there is no edge that scores a person, and collaboration edges stay at the team and process level (Q-2).

### 3.6 Gateways between graphs (the order's «коммуникаторы»)

Named **gateways** here, because «communicator» already names the owner's own notice channel (Layer G).

| Class | When | What crosses | Recorded |
| --- | --- | --- | --- |
| `trusted` | same owner and the same organization context (a project and its organization's graph) | reads, no gate | every read logged |
| `scoped` | a partial or shared ownership | only the data scope the matrix allows (`scope-gate`) | grant and reads |
| `dynamic` | a temporary need | a windowed `memory-grant/1`, asked and expiring | grant, window, reads |
| `hard` | personal workplace, `know-how`, another organization without a share grant | nothing; a hit is not said to exist | the refusal |

**Set up by the agents from ownership.** The class is derived from the ownership records (`owns` edges whole, partial,
share, temporary; `org-authority/1`; `levels/1`): same owner gives `trusted`, partial or share gives `scoped`, temporary
gives `dynamic`, personal, know-how or another organization gives `hard`. Owners and administrators may change a
class; every change and every crossing is recorded.

### 3.7 The analyzer setup

Onto Layer H's tiers and the model strategy of `f55c1105`: `strong` is Opus 5.5 on a subscription by default, Fable 5.2
rarely and only where a decision needs it; research swarms are Sonnet 5.5 and Haiku 5.5; code and mathematics go to
the model the order calls «Pi» (Q-1). Every orchestrator and plan reads the setup first (which accounts, models and
limits are available now, through Switchboard and `model-policy/1`) and keeps the alternatives ready, not looked up
after a failure.

### 3.8 The cycle

1. Run the core (§3.1, §3.2) once with Fable 5.2 on a real complex task. Proposed task: this program's own distribution.
   Tokens are spent here because the order says so, inside the per-run line of USD 100 and the estate's limits.
2. Improve it from that run's retro.
3. Bake it into the protocol: `spec/1` and `pipeline-run/1` in fabric-agent-contract, the stages in a task-pipeline
   release.
4. A separate spec on learning and its storage: which record lives where (Observatory lessons, the agents database's
   rules, the graph), and how long.
5. Revisit the existing specs: the 49 of the system design re-expressed as spec nodes and checked against §3.1.

### 3.9 Verification

Checks at every pipeline step (task-pipeline gates and certification tiers); cleanup waves over specs (superseded,
orphaned or stale spec nodes, each wave with its receipt; task-pipeline `waves` and `residue`); the pipeline itself
verified by Layer A's drills.

## 4. Decomposition: small specs, owners, order

Order of the owner: core, then graphs, then verification. Dates are targets (§6, D-2).

| Id | What | Owner project | Order | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| SP-01 | `spec/1` and `pipeline-run/1` schemas | fabric-agent-contract | core | none | schemas on its main with fixtures |
| SP-02 | decomposition and distribution step with receipts | task-pipeline | core | SP-01 | a complex spec becomes small specs and board requests with receipts |
| SP-03 | spec nodes and edges in the estate graph; `spec.tree`, `spec.distribute` behind the knowledge doors | fabric | core | SP-01, SD-FAB-07 | §3.1 item 3 walks from this order to each owner's row |
| SP-04 | skills bound to stages; the influence record | task-pipeline, sshlg-skills, project-observatory (store) | core | SP-01 | a planted defect is traced to its stage and skill version |
| SP-05 | A/B of stage variants in worktrees; the retro into Layer A | task-pipeline, fabric-agents-database (`pipeline-branching`) | core | SP-04 | one variant comparison judged by another family, recorded |
| SP-06 | the template graph catalogue `block/1` | fabric-agents-database | graphs | none | blocks for the six domains, with best-practice notes |
| SP-07 | the on-the-fly composer | fabric-dashboards, fabric (SD-FAB-13) | graphs | SP-06 | a dashboard and a report composed from a goal and a service's doors |
| SP-08 | default agent templates of §3.4 | fabric-agents-database | graphs | SP-06 | each row of §3.4 has an etalon or a variant |
| SP-09 | the organization graph in one store | passioncode-pm-agent, company-assessment-agent (source lane) | graphs | Layer B organization level | one graph per organization, Assessment writing into it, no duplicate store |
| SP-10 | gateway classes and their setup from ownership | fabric-agent-contract (`memory-grant/1` class), fabric (Memory), fabric-agents-database (`scope-gate`) | graphs | SP-09 | a planted node behind a `hard` gateway is unreachable from every door |
| SP-11 | setup check before every plan | fabric-switchboard, fabric-agents-database (`model-policy/1`) | graphs | none | an orchestrator names the available models and accounts before planning |
| SP-12 | verification at steps and cleanup waves over specs | task-pipeline, fabric-workspace (the pulse) | verification | SP-03 | one cleanup wave over spec nodes with its receipt |

## 5. Fabric's own part (SP-03)

A node type `spec` in `@fabric/graph` and the estate index, with the edges of §3.1. The index already reads document
files cut into sections (ADR-0200, Consequences); the new pass reads a spec's header fields (id, owner, acceptance,
dependencies) into the node. Two operations behind `fabric_knowledge_execute`: `spec.tree` (a spec, its children and
their state) and `spec.distribute` (the board requests for the children, with receipts, through the board door).
Waits on SD-FAB-07 (the Memory engine in one package).

## 6. Decisions taken in this run

Taken by the project's recorded decisions, then its goal, then the safest reversible option.

- **D-1. Amend the plan of record, no second plan.** The system design of 2026-11-21 already orders the estate; a
  parallel program would split the order. Its owner, fabric-workspace, is asked on the board to fold this in.
- **D-2. Start with specs now, build Fabric's part after wave 0.** The design's wave 0 (stabilize, exit target
  2026-11-27) holds new screens; the owner's «сначала чиним» stands beside «максимальный приоритет». The schemas and
  specs (SP-01, the design of SP-02 to SP-05) start at once, since they change nothing that runs; Fabric's SP-03 build
  starts on 2026-11-28 or when wave 0 exits, whichever is first. Reversible by the owner's word (Q-3).
- **D-3. «Коммуникаторы» are called gateways** in specs and code, to keep one word for one thing.
- **D-4. One organization graph at the PM agent, Assessment as a lane, no person scoring** (§3.5).
- **D-5. «Fable 5.5» is read as Fable 5.2**, the newest Fable available (model id `claude-fable-5-2`); the order's own
  cycle names Fable 5.2.

## 7. Open questions for the owner (the default holds until answered)

- **Q-1.** Which model is «Pi» for code and mathematics? Default: the tier `work` coding model.
- **Q-2.** Person-level collaboration edges in the organization graph? Default: no (§3.5).
- **Q-3.** Build before wave 0 exits? Default: no, from 2026-11-28 (D-2).

## 8. Not done in this run

No code, no schema, no row in another project's backlog. Fabric's carry-over row for SP-03 is filed by the next Fabric
session under the register's lease. The distribution of SP-01 to SP-12 goes through fabric-workspace (D-1).
