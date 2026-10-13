# Retrospective — Fabric

Read **in full** at the start of every run: the standing instructions bind that run,
and the bounded run stamps expose recent evidence. Legacy rows still lack the class/exposure
metadata needed for a reliable cold-retirement decision. The recent log below is
*queried* by the task's nouns, never read end to end.

Seeded 2026-08-16 by run `2026-08-16-software-fabric`.

## Standing instructions

Maximum ten. Apply the [class-aware retirement contract](https://github.com/ssheleg/task-pipeline/blob/52fa75d/plugins/task-pipeline/skills/task-pipeline/references/retrospective.md#the-prune--mandatory-and-it-runs-after-the-stamp): a verified replacement check or removed surface can retire a rule; absence of a rare event cannot retire a safety invariant. Situational coldness calls for review against exposure opportunities, not automatic deletion. Legacy rows below have no declared class/exposure metadata; do not invent it or infer permission to delete from age. Every retirement requires recorded evidence and an archive entry.

| id | Born | Commit | Instruction | Because | Retire when | Last fired | Fired at |
|---|---|---|---|---|---|---|---|
| R-001 | 2026-08-27 · ontology propagation | `b68eae9` | When an ADR changes hierarchy, ownership or cardinality, enumerate and inspect the glossary, vision, affected architecture, schemas/examples, UX sources and derived reading surfaces in the same run. | ADR-0010 made Project the top-level organisation while the glossary still defined it under Goal; both remained plausible alone and contradictory together. | a mechanical semantic-contract check or one generated ontology source covers every named surface | 2026-08-27 | `b68eae9` |
| R-002 | 2026-08-31 · security-wave-1 | this merge | A deferral that leaves as a COUNT is not a deferral. Any finding not fixed in the run leaves with its id written into the register in the same commit — never as a promise of ids, never as "eight findings will be filed". | The tasks-and-editor run's ledger said eight audit findings "leave with ledger ids CO-089…096"; no rows were ever written, and the register's next free id was still CO-089 five runs later. The only surviving record of eight findings was the word "eight". | a check compares every id cited in `verification.md` against the registers and fails on a citation with no row | 2026-10-13 · harness-waves | `e169e3c3` |
| R-003 | 2026-08-31 · security-wave-1 | this merge | A structural gate proves structure, never authority. Any change touching database privileges, credentials, or the filesystem boundary must be probed by ATTEMPTING the thing it forbids, from the role that would attempt it. | Every gate this repository owns was green while the anon key could write projections with no event behind it, and while `readFile` served `~/.ssh/known_hosts` to any window. Types, tokens, strings and schema constraints cannot see a grant or a path. | a permissions probe runs in CI against a fresh stack for every role the API exposes | 2026-10-13 · harness-waves | `e169e3c3` |
| R-004 | 2026-08-31 · next-three | this merge | When a verification fails to REACH the thing under test, record it as inconclusive about the harness — never as an open risk about the product. Reproduce the real path (the spawn, the transport, the role), not merely the invocation. | CO-093 said the credential handshake was unproven against the shipped CLI. It was proven first try over node-pty; the three failed attempts used `execFileSync`, which gives no TTY. A run's own limitation had been filed as a defect risk in the product. | a verification harness distinguishes "did not reach" from "reached and failed" by construction | 2026-10-13 · harness-waves | `e169e3c3` |
| R-005 | 2026-09-08 · s14-read-envelope | this commit | A type that names a boundary has ONE definition. Before extending a contract that crosses main/renderer, grep for its name across `shared/` and the process that owns it, and collapse a duplicate in the same run rather than filing it. | `AppSettings` was declared twice — three fields in `shared/types.ts` and five in `main/settings.ts`. Neither was wrong alone; together the renderer's type asserted that settings carry no `workspace` and no `tabs` while the main process was sending both, and a hardcoded three-field fallback in the renderer kept the contradiction invisible for as long as nobody read those fields. | a check fails on an exported type name declared in more than one place across `shared/` and `main/` | 2026-09-11 · uxac06 | stage 2 — the canonical resolver decides where a row opens; the subject map answers only what it is about |
| R-006 | 2026-09-09 · fa01-cold-build | widened 2026-09-10 · fa04-link-command | **Any check — structural or behavioural — is trusted only after the thing it tests has been REMOVED and the check watched going red.** For a structural rule, plant a defect that removes the behaviour while leaving every neighbouring token in place: the import, the comment, the adjacent key. For a behavioural probe, remove the mechanism and confirm the probe can even REACH the condition it asserts. | Born from two of seven plants walking past gates written in the same run: a rule requiring the identity formula to come from one home was satisfied by an unused import, and a rule requiring the manifest to ship was satisfied by the YAML comment explaining why it ships. **Widened one run later**, when the same discipline caught two BEHAVIOURAL probes that could not fail: a concurrency assertion stayed green with the estate lock removed, because two PostgREST calls are not obliged to overlap; and a replay assertion was green because the probe deleted its journal and left the projections, so the comparison depended on what an earlier run happened to leave. The original wording said *structural*, and both of these were green tests of live behaviour. | a plant harness generates the mechanism-removing variant of every rule and every probe automatically | 2026-10-13 · harness-waves | `e169e3c3` |
| R-007 | 2026-09-10 · fa02-chain-admission | this commit | **A check that carries its own copy of the mechanism proves the model, not the product.** Where a test re-implements what it tests — a simulation, a fake store, a second copy of the rule — it must be replaced by one that drives the real path, or state in the file, in words, exactly which property it does NOT prove. | `fix-pf-07.02.py` asserted the chain's dispatch two ways: by SOURCE STRING, requiring `if (!casWon?.length) continue` verbatim, and by a Python `Store` class with its own `cas()` that always succeeds, driven through a crash script. Both halves passed from the day they were written. The real mechanism wrote `status = 'dispatching'`, which the database has never allowed; every write was rejected, and the rejection was read as another process winning the race. NO CHAIN HAD EVER ADVANCED, and the suite reported the mechanism sound on every run. R-006 would have caught half of this — removing the mechanism reddens the source assertions — and the model half would have stayed green, which is the tell. | a check exists that fails a suite whose assertions can all pass with the subject deleted | 2026-10-13 · harness-waves | `e169e3c3` |
| R-008 | 2026-09-27 · branch-consolidation | this commit | **Ancestry is not integration, and a worktree is not removed until its files are.** Before deleting a branch, test it with `git merge-tree --write-tree <base> <tip>` and the share of its added lines present in the base; before removing a worktree, commit its uncommitted files to a tagged snapshot through a temporary index and verify every blob against the file on disk. | The R0 wave was integrated as rewritten commits: 0 of 28 tips were ancestors of the base while their content was 91.8–99.8 % present. Three member packets existed only as untracked files; an ancestry-only cleanup would have deleted the one finished packet with its worktree. | [CO-170](specs/2026-08-16-software-fabric-carryover.md) ships a script that performs both checks and refuses removal of unpreserved files | 2026-09-27 · branch-consolidation | stage 0 — the harvest measured every branch and worktree before any deletion |
| R-009 | 2026-09-29 · agent-registry AR-0 | this commit | **A gate that stops at an environment step is not a verdict on the steps after it.** When `ci.sh` (under `set -e`) fails on something outside the change — a pinned tool version, a load-timed test — run every later step on its own and read each exit code before calling the change green. | The CO-AR-07 pin stopped `ci.sh fast` at "provider capability"; run one by one, the later steps found a real collision (`fix-pf-06.03`: ADR-0090 written past the prose reservation 0089). | the fast gate reports every step and fails once at the end | 2026-10-13 · harness-waves | `e169e3c3` |
| R-010 | 2026-09-30 · agent-registry wave 2 | this commit | **A surface is verified the way its user meets it: an MCP surface by a real client, a public repository on a fresh clone.** Any change to a server's tools, schemas or handshake is checked by connecting the installed agent CLI; any change to a public repository is gated on a clone that shares no objects with a private history. | The adapter kit never answered `initialize`, Observatory 0.9.0's root-`oneOf` schema was rejected by Claude Code, and after Fabric went public a gate passed locally (old objects in a shared `.git`) while GitHub CI failed on receipts pinned to vanished commits. | a conformance probe that drives a real client runs in each surface's gate | 2026-10-13 · harness-waves | `e169e3c3` |

## Run stamps

Maximum ten. Older stamps are preserved in the [Q3 archive](retro/2026-Q3.md).
The 2026-10-13 rotation selected nine historical rows by explicit Date, with original
row order breaking same-day ties; these dates do not establish exact within-day chronology.

| Run | Date | Commit | Stages completed | Instructions that fired |
|---|---|---|---|---|
| `2026-09-12-workspace-ui` | 2026-09-12 | this commit | 0–10 (task-pipeline; the operator's instruction, delivered with a screenshot) | **R-004 FIRED TWICE, and both times it stopped me filing my own impatience as a defect.** A probe that measured mid-animation reported all eighteen of the map's section links as landing in the wrong place; waiting for the scroll to settle showed every one landing at 43 px. A second probe called `completeness.html`'s theme button dead because its DOM signature did not include background colour. Neither was a product defect and neither reached a report. **R-006 fired** — four new plants, one of which escaped first time round because it rebuilt the defect out of the new code instead of restoring the handler that caused it. **R-007 checked:** the row and scroll-spy claims are browser geometry, so they went into the repository's own harness rather than a Node assertion that would have proved the markup and not the page. R-002 checked: nothing left as a count. |
| `2026-09-12-v1-fabric-profile` | 2026-09-12 | this commit | 0–10 (task-pipeline; прототип + реестры — профиль Fabric, таймлайн, ориентация графов) | **ОПЕРАТОР ЗАКРЫЛ ВОПРОС БРЕНД-РЕВЬЮ ВСЛУХ, И ГЕЙМИФИКАЦИЯ ПОЛУЧИЛА ЛИЦО, ОСТАВШИСЬ ЧЕСТНОЙ:** персональный ИИ-генерируемый Fabric у каждого пользователя (в макете — градиентные капсулы орнаментного слоя, демонстрация подписана), и УРОВЕНЬ, который никогда не хранится — пересчитывается из именованных регистров, со строкой формулы РЯДОМ с числом (`уровень = 1 + log₂(1 + задачи + решения + агенты + дни) · v1`). История стала одним таймлайном: «мы сейчас здесь» сверху, скролл в прошлое, раскрытие до основания; граф объявлен ВТОРЫМ представлением тех же записей, и правило ориентации (каждый граф растёт слева направо либо сверху вниз) записано в дизайн-язык с гейтом монотонности в Accept T-21 — а не выполнено наполовину по 340-строчному graphs.mjs с ручными координатами. R-005 решил форму дважды: один `renderDecisionTimeline` для полосы главной и вью решений (второго стора истории нет), один `wbAvatar` для главной и профиля. R-002: T-20/T-21 и вехи V1-M6/M7 с id. R-006: контракт 72×7 держит; продуктовые подсадки уровня/таймлайна закреплены в Accept пакетов. Приёмки перегнаны: report/workbench/operations зелёные; CEO-скоуп-тест (черновики чата по областям) пережил новую страницу профиля. R-001 checked: ADR не тронут — облик и уровень не меняют иерархию/полномочия, ADR-0057 стоит как есть. R-003, R-004, R-007 не применялись. |
| `2026-09-12-v1-home-prototype` | 2026-09-12 | this commit | 0–10 (task-pipeline; прототип — главная V1) | **ОПЕРАТОР НАЗВАЛ ТРИ ПРОПАЖИ С ГЛАВНОЙ — АВАТАР, СТАТИСТИКА, ФОКУС ВОЗВРАТА — И ВСЕ ТРИ БЫЛИ СПРОЕКТИРОВАНЫ, НО НЕ ДОНЕСЕНЫ ДО МАКЕТА.** Главная прототипа пересобрана по дизайн-языку 4·3·5: приветствие Fabric (озвученный дайджест с возрастом старейшего ожидания), лист персонажа (каждая цифра именует регистр — правило SCN-044 поднято на главную), пять полос в фиксированном порядке с одной раскрытой. **Blast radius уважён вместо героизма:** project/agent-detail держит operations.mjs с плотными приёмками — их пересборка названа вехой, не сделана наполовину. **R-004 fired:** приёмки падали на «Executable doesn't exist» — несовпадение playwright-модуля и скачанных сборок; это ограничение харнесса, решённое подбором совместимого модуля (another project's playwright 1.58.2 ↔ 1208), не дефект прототипа. **Гейт превью доказал себя обратной стороной:** вчера он краснел на подсадке, сегодня он ПОТРЕБОВАЛ пересборки 72 кадров после реального изменения прототипа — обе половины контракта наблюдены. R-005: полоса — один локальный хелпер lane(); переиспользованы renderObligationRows, wbTable, wbDetails, routineStore. R-002: пересборка project/agent-detail в прототипе — внутри V1-M1 (доска). R-006: state-контракт 72×7 держит (empty-тест 6/6 после перепина). |
| `2026-09-12-wiki-ia-refactor` | 2026-09-12 | this commit | 0–10 (task-pipeline; вики: хост + два родительских генератора) | **ВХОДАМИ САЙТА БЫЛИ ЧЕТЫРЕ ГИГАНТА, И НАВИГАЦИЯ ИМЕНОВАЛА ФАЙЛЫ, НЕ НАМЕРЕНИЯ.** Разделы стали намерениями (Макеты/Экраны/План/Архитектура), гиганты — глубиной; галерея показывает НАСТОЯЩИЙ кадр прототипа (72 превью из его же hash-роутера, 1.1 МБ) и открывает его кликабельным. Честность купирована гейтами без браузера: превью пиннятся к sha256 прототипа+модели, план — байтовая парность с доской; **оба наблюдались красными**. **R-006 УКУСИЛ ОБРАТНО: подсадка на грязном дереве была восстановлена `git checkout` и снесла НЕЗАКОММИЧЕННУЮ работу над pages.mjs** — час работы переписан заново; правило на будущее: подсадка на незакоммиченном файле восстанавливается сохранённой копией, никогда индексом. R-005: один резолвер секций (`sectionOf`) для обеих панелей; один парсер таблиц для проекции. R-002: named remains — TOC внутри гигантов, веер состояний превью, полный рендер батчей (§5 плана WIA). R-001, R-003 (private boundary не менялась; auth путь не тронут), R-004, R-007 не применялись. |
| `2026-09-12-v1-design-gamification` | 2026-09-12 | this commit | 0–10 (task-pipeline; docs-only — дизайн-язык, честная геймификация, пакеты исполнения) | **ДВА ЗАПИСАННЫХ РЕШЕНИЯ ПЕРЕОПРЕДЕЛЕНЫ ОПЕРАТОРОМ ВСЛУХ, И ОБА ПЕРЕОПРЕДЕЛЕНИЯ ЗАПИСАНЫ ТУДА ЖЕ, ГДЕ ЖИЛИ ОРИГИНАЛЫ:** «Engagement mechanics: none» и плотность 7 — foundation теперь несёт override с датой, причиной и запретами (без очков, наград, daily-login). Геймификация легла в грамматику пака БЕЗ изобретений: приветствие = озвученный дайджест (вторая сводка запрещена доводом FLW-21), веха = орнаментный бейдж (ярлык, не контрол), предложение автономии = interrupt-чип (единственная пружина пака, для элемента «пришедшего незваным»), серии = ledger row с заполнением `--ink` (количество — не вердикт). **R-005 решил форму дважды:** директорский форк ОТКЛОНЁН по собственному правилу скилла (система записана — форк изготовил бы выбор), и каждый пакет T-плана называет механизм, который переиспользует. **R-006 перенесён в контракты пакетов:** «убрать журнальное событие — момент не рисуется» стоит в Accept T-03/T-16/T-18, а правило достижимости journey наблюдалось красным этим же днём (V1P-REQ-004) — не переигрывалось. R-002 fired: пакеты и вехи связаны на доске; deferral-ов без id нет. R-001 checked: ADR не тронут; циферблаты и механики — слой foundation, не иерархия. R-003, R-004, R-007 не применялись. |
| `2026-09-12-v1-reentry-deep` | 2026-09-12 | this commit | 0–10 (task-pipeline; docs-only — the operator asked to map the context re-entry model against CURRENT features, correct their implementations, and fix the V1 vision and roadmap) | **THE MAP FOUND THE VALUE ALREADY 2/3 BUILT AND SCATTERED, AND THE GAP EXACTLY WHERE THE OPERATOR SAID IT HURTS.** 15 lanes measured against the renderer: built 4 / partial 6 / absent 5, and all five absents cluster on the console surface (SCR-39/SCR-25) — the place the operator lives. The single genuinely new read in all of V1 is the per-agent command/answer chronology; everything else is assembly of mechanisms that exist (`AnswerForm`, `nextDue`, `destinationOf`, `goalProgress`, an orphan i18n string). **R-006 FIRED** — the load-bearing new claim (a scenario unreachable from any journey is refused) was watched RED: SCN-091 unwired from PJ-08 → `FAIL product model: Journey SCN coverage`, restored → PASS. **R-002 FIRED** — the road to V1 leaves as board ids V1-M1..M5 in this commit, not as a plan's prose. **R-005 checked and it shaped §15** — every correction names the mechanism it reuses; a second citation resolver and a second answer form were refused on paper before anyone could build them. R-001 checked: ADR-0057 changes a NAME, not hierarchy/ownership/cardinality; its three homes (ADR, vision, brand facts) are named in the record itself. R-003, R-004, R-007 did not apply (no privilege boundary, no probe failed to reach, no check models its subject). Grill answers recorded in the plan's amendment banner; the operator's console-first correction (extra windows open where the console is open) overrode the morning draft's optional drawer, and the contradiction it left in §5 was corrected the same day rather than shipped. |
| `2026-09-12-mockup-states` | 2026-09-12 | this commit | 0–10 (task-pipeline; the operator asked to go through the mockups) | **R-004 FIRED FOUR TIMES IN ONE RUN, and that is the finding.** Of five candidate mockup defects, four were the measurement: a probe reading mid-animation, a focus ring only Playwright's own select produces, kanban columns that measure identical, and a `<br>` read as a missing space. The tell each time was that the failure was TOTAL — all eighteen links, all four columns — and a defect that uniform is usually the instrument. **R-006 fired** — P15 and P16, both caught; and the receipt-line invariant was watched RED first, naming exactly the one stale receipt it was written for. **R-007 fired** — the first version of this run's state audit measured a hidden zero-size element and reported 0 findings across 72 views; a check that cannot see its subject reports the same green as one that passed. |
| `2026-09-27-branch-consolidation` | 2026-09-27 | this commit | 0–10 (task-pipeline; branch and worktree consolidation, plan restated; docs plus one isolated module) | **R-006 fired:** the integrated registry test was trusted only after a planted defect (authority change no longer fences the owner) failed group 6; the full `ci.sh fast` then caught what the member packet's focused checks could not — eight `catch` blocks that neither recorded nor explained. **R-008 born.** R-001 checked: ADR-0079 changes no hierarchy, ownership or cardinality of Project, Person, TaskRun or membership (its own text says so). Prune: all seven instructions were applied in 2026-09-12 stamps — within sixty days and the last five stamps; none retired. |
| `2026-09-29-agent-registry` | 2026-09-29 | `f9891f5` (published pin), close-out on `agent/closeout-ar0` | 0–4 for the whole design; 5–10 for module AR-0 | **R-001 fired** — ADR-0090 changes naming and ownership; the inventory is brief §8, swept across 11 repositories. **R-006 fired** — every new gate watched red on a planted defect (narrative, regions, sources ×2, N2 wrap, heroku preflight). **R-009 born.** |
| `2026-10-13-harness-waves` | 2026-10-13 | `e169e3c3` | modular plan, four source repairs and independent module/seam review; first-wave fast gate passed, resource continuation is separately reviewed; owner/native acceptance still open | R-002/003/004/006/007/009/010; scoped commands and contributor disclosure in [wave review](../execution/harness-waves/review.md); publish: local lessons recorded, Observatory NOT_SENT pending Fabric enrollment |

## Recent log

### 2026-10-13 · CO-282 fixture defaults are part of a negative test

A static byte comparison of unchanged test bodies missed their dependency on fixture defaults. Raising ordinary setup budgets to5000ms also changed an implicit1000ms deadline under a1100ms injected native delay; the actual rerun failed28/29. Two timed cases now explicitly retain1000ms while ordinary setup gets headroom. The corrected29-case run passes; original failed run remains archived. Reused R006: acceptance comes from reaching the actual negative boundary, not only unchanged assertions. No production timeout was changed and load was not proved the sole cause of the earlier failures.


### 2026-10-13 · CO-282 actual outcome types and earlier refusal checks

The concrete factory reused the retained-uncertainty lesson, but independent review found its success predicate compared against a raw database delivery state after the continuation layer had already mapped it to another result domain. Use the actual consumer type and an explicit successful-state allowlist; preserve a started native result even when delivery is uncertain, while refusing a clean handoff. A caller-visible timeout or ambiguous unlink cannot prove all underlying work stopped. Current focused execution and original negative replay remain separate from final integration acceptance.

The existing observability lesson fired again: two combined candidates spent2047.37 and2078.94seconds before static refusals. N036 moves the identical expensive compiler command behind source-only gates and removes six duplicate checker invocations in assertions. This is a concrete check-order correction, not a gate waiver or a measured performance claim. R004 applies to six legacy cases that failed during setup under load: they remain unaccepted until the intended targets are reached and checked. No new standing rule or automatic lesson authority is inferred; Observatory delivery remains NOT_SENT.


### 2026-10-13 · CO-282 retained registry review

Passing assertions do not imply a clean check process: the initial N034 real-filesystem run passed22 assertions but exited1 when abandoned lifetime FileHandles were collected. Its lock is an O_EXCL file, not flock; retain the identity-checked lock file while closing temporary descriptors explicitly. Independent review also requires validating the exact handle before returning any cached seal receipt, and hashing verified canonical stored bytes. Keep all three original failures and test actual clean exit. This lesson applies to retained filesystem ownership and idempotent result caches; it does not authorize deleting a crashed writer or changing policy. N034 consumes the earlier caller-visible confirmation lesson; source receipts follow in the resource report.

### 2026-10-13 · actual consumer boundaries · success must cross the return boundary

- Reused the N031 retained-uncertainty lesson at two N032 boundaries. Independent
  review found that a failed final preparation could still expose an assignment;
  another review found a native token allocated just past the admission deadline.
  Both corrections separate retained internal work from caller-visible confirmed
  success. Preserve exact retry; do not discard durable intent or mint a new unit.
- Composition review then found a real missing consumer: N028's child environment
  producer was implemented but unused by PTY. N033 carries its exact allowlisted
  run key through the owned token and applies it last; legacy precedence remains.
  A producer's existence is not evidence that the actual consumer receives it.
- These are source-bound review findings, not new global policy or proof of native
  agent behavior. The original failed controls, corrected tests and later combined
  gate remain separate receipts. Observatory publication is still NOT_SENT.


### 2026-10-13 · durable worker entry · retained bytes are not a durability receipt

- Reused R006/R007 and the earlier retained-uncertainty lesson: independent review
  failed a real file `sync` after writing a complete intent, then retried the same unit.
  Original N031 source7ddd2dc6 returned success without re-establishing durability.
  Corrected source2ff89b1f validates the retained bytes/inode and syncs both the file
  and its directory before confirming either an initial write or an exact retry.
- The source correction passed18 focused and4 independent controls. Portable replay
  exposed a separate fixture issue: a30ms recovery budget timed out under load.
  The reviewer raised only that test budget to1000ms; an unresolved dependency still
  forces the actual timeout. Preserve the failed packaging logs and distinguish a
  test-budget correction from another product defect.
- Reuse in N032: an admission summary cannot stand in for the adapter's actual owned
  attempt/reservation/input binding. The concrete consumer reads that retained binding;
  callback labels, copied handles and an empty process map cannot prove retirement or
  complete inventory. These are implementation requirements, not native acceptance.
- Evidence: [worker intent contract](../execution/harness-waves/resource-worker-inventory.md),
  [wave report](../reports/2026-10-13-resource-admission-contract/README.md).
  Observatory delivery remains NOT_SENT; no new standing rule or run stamp is inferred.

### 2026-10-13 · harness input wave · metadata and composition are separate evidence

- Reused R006/R007: test the actual production reader against real Git changes.
  The selected bytes stayed constant, but `git update-index --assume-unchanged`
  changed promised metadata; the original reader incorrectly returned same. The
  independent negative now detects it; index flags/stat-cache are included.
- Reused retained-I/O and rejected-clock lessons from N022/N023/N025 in N026;
  repeat timeout calls do not free an unresolved operation or fabricate time.
- A module passing its own contract does not fill every composition input. The
  review found N025's eight-field read lacks R1 reserved totals; N027 owns the
  separate coherent read. Existing source work is not labelled COM-blocked.
- [Evidence](../reports/2026-10-13-resource-admission-contract/raw/n026/README.md).
  Lesson publication to Observatory remains NOT_SENT until the actual board works.

### 2026-10-13 · harness-waves continuation · local progress and operational authority

- **Applied:** R-003/006/007 led the resource review to execute real SQL with adversarial client roles and restore/replay cases; pure preflight results explicitly cannot grant execution. R-009 keeps earlier candidate checks separate from the expanded source.
- **Observed:** board access blocks cross-project delivery, but not injected Fabric implementation. The plan now separates local R1, pending R2 and opt-in adapter preparation from schema activation and native coverage. This corrected an overly broad dependency assumption before stopping work.
- **Error boundary:** the builder found that an accidentally async proof provider could refuse admission and still emit an unhandled rejection. Independent review reproduced it; the corrected native-Promise boundary passes both tests. See the [source-bound receipt](../reports/2026-10-13-resource-admission-contract/raw/r1-review-receipt.json).
- **Timeout correction reused:** R4 review found that a finished timeout did not cancel its underlying I/O. The same probe was applied to R5 and then the launch adapter (N-020), exposing the same accumulation defect at both seams. Each corrected instance retains operation ownership until actual settlement; late replies never grant permission. This is a concrete reuse of a finding across modules, not evidence that Observatory consumed it.
- **Real-role correction:** a service_role without BYPASSRLS saw zero held rows despite a table SELECT grant. The actual SQL caller exposed this; pending107 now carries explicit read policies, client denials and service-write negatives. A privileged fixture would have missed it.
- **Combined checkpoint:** [ae197a15 receipt](../reports/2026-10-13-resource-admission-contract/raw/recovery-wave-fast.json) passed the full fast tier. New N019/N020 work requires its own later gate; this checkpoint does not certify later edits.
- **Merge review reused:** the N001 per-binding serialization lesson was applied to incoming board joins (N021). The new path had bypassed the existing queue; eight concurrent retries exposed the cap defect. The fix reuses that queue, and original-source negative probes fail. Separate board/coding caps and exact runtime identity remain tested.
- **Authority:** this is a run lesson, not a newly promoted standing rule or an Observatory delivery receipt. No new run stamp is added for this continuation.

### 2026-10-13 · harness-waves · a pending bearer still belongs to a runtime

- **Symptom:** negative enrollment tests showed a second native runtime reusing the first runtime's pending bearer, and a concurrent retry reading a bearer before validation/journaling completed.
- **Surfaced at:** independent module reproduction and review, before combined acceptance.
- **Owned by:** enrollment admission and its original negative-test coverage.
- **Root cause:** binding equality did not require exact runtime identity, and pending credentials were visible across asynchronous validation.
- **Fix:** grade 1, executable mechanism: exact identity matching and a per-binding admission queue; unrelated bindings remain parallel. Two null-ID callers remain a disclosed legacy identity limitation.
- **The check:** `node --experimental-strip-types --test apps/desktop/test/session-enroll.test.mjs apps/desktop/test/session-enroll-request.test.mjs`, builder 35/35; independent enrollment-only 25/25. These are real module tests with injected boundaries, not native agent acceptance.
- **Commit:** `0a4ae694`; [scoped evidence](../reports/2026-10-13-harness-wave-review/README.md#n-001--enrollment-identity-and-pending-admission).

### 2026-10-13 · harness-waves · a context budget includes the rendered envelope

- **Symptom:** a regression emitted 1104 UTF-16 code units for budget 1000 despite bounded fact selection.
- **Surfaced at:** N-003 negative test before the repair.
- **Owned by:** context compilation and bundle fallback, not individual source collectors.
- **Root cause:** fact selection did not enforce the complete rendered size: essential-head overflow, separators, final newline and omission notice were not bounded together. The new budget refusal needed to preserve the existing mandatory-context no-fallback boundary.
- **Fix:** grade 1, executable mechanism: account for the complete rendered pack and refuse an oversized mandatory head through the existing mandatory-context error boundary.
- **The check:** context-mandatory 10 and context-privacy 8 scenarios; saved seed7321 invariant check 500 cases, 471 valid packs/29 explicit refusals. Synthetic combinations are not native agent obedience.
- **Commit:** `1ddf43fd`; [scoped evidence and saved fixture](../reports/2026-10-13-harness-wave-review/README.md#n-003--exact-context-budget-and-refusal-propagation).

### 2026-10-13 · harness-waves · asynchronous errors cross more than one boundary

- **Symptom:**40 MCP tests passed while an independent SDK-background429 fixture still sent the next POST; closing could attach a late link or discard a received one-shot consent.
- **Surfaced at:** independent negative review after builder tests, before combined acceptance.
- **Owned by:** transport retry enforcement and proxy close/admission lifecycle.
- **Root cause:** foreground rejection was treated as every error path; cancellation was checked after a result that required durable local persistence.
- **Fix:** transport-wide monotonic fence, late-link disposal and persistence before the no-new-network close boundary. Process-local only; no shared poll leader is claimed.
- **The check:**43 builder tests and three independent negative controls. The rejected source capsule and commands remain in [N-011 evidence](../reports/2026-10-13-harness-wave-review/README.md#n-011--mcp-cooldown-and-close-boundaries), bound by exact source hashes. A green suite alone did not close the module.
- **Commit:** `de50e9e0fddf9f5fa37cd063fb3659cdc274bbff` (reviewed pre-main-integration MCP fix; integrated source has its own receipt).

### 2026-10-13 · harness-waves · retrospective maintenance receipt

- **Stamp then prune:** one current stamp added; 127 historical rows become 9 active plus 118 archived, byte-for-byte, with row-hash multiset conservation. Live total:10. The original table was not chronological, so retention uses explicit dates rather than the last nine physical rows.
- **Standing rules:**10 → 10; retired0; added0. Retirement is inconclusive for legacy class/exposure metadata and historical provenance. No verified replacement or removed surface was established. Coldness does not authorize deletion. This run records only its observed firings.
- **Limits:** historical placeholder/pre-public-history references are preserved, not repaired. Narrative archive migration was not completed; the Recent log remains queried, not read wholesale. No new standing rule was added from these two call-site repairs.
- **Publication:** canonical local lessons recorded here; Observatory lesson delivery NOT_SENT while Fabric MCP awaits project access. The [owner packet](../execution/harness-waves/owner-packets.md#pipeline-and-observatory-lessons-remain-evidence-until-adopted) carries the producer/consumer and authority boundary. No retrieved note was promoted into policy.
- **Evidence:** [lossless rotation receipt](../reports/2026-10-13-harness-wave-review/raw/retro-rotation-receipt.json), source `e169e3c3`.

### 2026-10-01 · green locally, red on GitHub: the shared .git still had the old history

**Symptom.** After the four products were re-created as public repositories with one clean history, `ci.sh fast` passed in the operator's worktree and failed on GitHub at the product model: `git show 9133739…:App.tsx` — a commit only the old history had. **Surfaced at** stage 7 (GitHub CI, first run on a public repo). **Owned by** stage 6: the gate ran in a worktree whose `.git` is shared with `~/DATA/fabric`, which still holds the old objects. **Root cause.** A gate environment richer than the one the product is consumed in. **Fix.** Code grade: 283 receipts repinned (identical bytes), 385 re-verified, 325 marked stale (CO-173), gate rule for dated records (`repin-public-history.mjs`), two load-sensitive tests fixed, a CEO conversation test given the product's default deadline; `sourceChangedSince` and `syncLeftovers` make the publisher and the scheduled sync survive the re-created history and their own unfinished runs. Rule grade: R-010 widened. **Check next time:** R-010 — a fresh clone that lacks the old objects (`git cat-file -t <old sha>` must fail) before calling a public repository green.

### 2026-09-30 · green SDK tests over surfaces no real client could use

**Symptom.** Fabric Agent Adapter 0.5.0/0.5.1 kits returned `-32601` to `initialize`, so Claude Code marked every kit-built service `failed`; Observatory 0.9.0 advertised a union `outputSchema` without an object root and Claude Code 2.1.285 rejected its whole `tools/list`. All suites were green. **Surfaced at** stage 8 (the newcomer path, run with the real CLI). **Owned by** stage 6: the tests reached the server through the Python SDK or a direct dispatcher call. **Root cause.** A test harness that is more lenient than the client the product is for. **Fix.** Code grade: adapter v0.5.2 answers `initialize`/`ping` and carries `test_real_client` (red on 0.5.1, green on 0.5.2); contract DEC-0018 + FAC-SEM-023; Observatory 0.9.1 requires an object root for every tool. Rule grade: R-010. My own share: I wrote the union ruling (DEC-0017) without checking it against a real client. **Check next time:** R-010.

### 2026-09-29 · the gate stopped early, the fixtures were too clean, and the lease came late again

**Symptom.** Three divergences in one run. (1) `ci.sh fast` was red for CO-AR-07 alone and every later step went unread; run one by one they found `fix-pf-06.03` failing, a real collision between ADR-0090 and the pipeline reservation 0089. (2) The source exporter passed nine fixture tests, then its first live export of 13 repositories was refused by the host: four hidden files (`.gitkeep`, `.docpaths-allow`) inside tools' `docs/`. (3) The brief, design, contracts and plan were written into guarded `docs/evidence/` before the lease was taken (recorded then as "LATE LEASE"); on 2026-09-30 the same slip almost repeated after the lease was released, and was reverted before the lease was re-taken.
**Surfaced at** stage 6 (gate), stage 8 (live export), stage 5 (lease). **Owned by** stage 6 for (1), stage 5's test design for (2), the agent-sync cycle for (3).
**Root cause.** (1) `set -e` makes the first environment failure the last thing checked. (2) Fixtures written from the exporter's own model of a repository, not from a real one. (3) Treating "I hold a lease" as a state of the session instead of checking it at each guarded edit.
**Fix.** (1) Rule grade: R-009; the pin itself re-pinned (CO-AR-07 resolved). (2) Code grade: the exporter skips hidden segments for sources and refuses any path the host cannot serve (`scripts/workspace-snapshot.mjs#hostServable`), with tests. (3) Rule grade exists (AGENTS.md rule 1); the check is `git ls-remote origin 'refs/agent-sync/leases/*'` before the first guarded write of each iteration.
Also: `check_names.py` N2 read a line-wrapped "Fabric Switchboard" as a bare name twice; the check now reads the whole text (org-index #8). The publisher ran ten minutes of gates in a worktree whose submodule had no `heroku` remote; it now checks the remote first.
**Check next time:** R-009; a live export before calling an exporter done; `ls-remote` for the lease before the first guarded write.

### 2026-09-27 · a parallel wave ends as untracked files, and my own numbers drifted three times

**Symptom.** The R0 wave stopped at 07:49 with 37 worktrees; the one finished packet (owned backend process registry, 17 test groups), two unfinished ones and the root's ADR-0079 draft were uncommitted, reachable from no ref. Evidence: [consolidation record](../evidence/plans/2026-09-27-branch-consolidation.md).
**Surfaced at** stage 0 (the harvest's blob comparison) and stage 6 (`ci.sh fast` exit 1 on `check-ops`). **Owned by** the wave's handoff: member packets stated "root owns integration" and ran focused checks only, so nothing forced a commit or the full gate before the root stopped.
**Root cause.** A handoff contract that let a finished result live outside Git. **Fix, rule grade:** [development.md](../launch/harness-r0/development.md#after-consolidation--2026-09-27) now says a member packet commits on its own branch before handing off; R-008 guards removal; CO-170 turns the measurement into a script.
**Second divergence, mine.** Three numbers I wrote from memory were wrong before commit: "84 `never` rows" (it counted a different column; the gate's figure is 190 of 1549), and two worktree counts (Orca had removed its own worktree at 21:27, between my listing and my count). Each was caught by re-measuring before commit; the record names the chronology. Two zsh traps nearly shipped a wrong action: `$T:refs/...` applies the `:r` modifier, and an unquoted list is one word — both failed loudly and were rerun with `${T}` and `xargs`.
**Check next time:** CO-170's script, and quoting a count only from the command that produces it.

### 2026-09-25 · continuation must name the exact work

Independent review of the first-release prototype found that a pending provider setup could override a later explicit continuation choice in another project, and that a second task overwrote the only stored run. The fix separates `resume-pending` from an explicit choice, retains runs by ID and opens work by task. Receipt: `scripts/test/first-release.test.mjs` cases for pending continuation and task history. An in-memory guard-removal probe made the stop assertion fail as intended (R-006). Prototype checks do not close native process-stop/IPC acceptance; CO-168 retains it. Delivery and next packet: `docs/launch/first-release.md`.

### 2026-09-12 · a state offered on seventy-two screens and drawn on six

- **Symptom, with evidence:** the prototype's state picker lists «Пусто» for every screen.
  Walking 72 views × 7 states in a browser, **66 of 72 returned the populated screen** —
  the select's value changed, the screen did not. A reviewer asking what a screen looks like
  before there is any data was shown data.
- **Surfaced at:** stage 0 of this run, by enumerating states rather than by looking. Nobody
  would find it by eye: to see it you have to know what you expected instead.
- **Owned by** the module split. `renderers.mjs` has drawn the empty state all along; the
  dispatch line routed only `denied` and `loading` to it, and each of the nine module
  renderers below carries its own list of states it honours — `operations.mjs` lists six,
  `workbench.mjs` three, `assistant.mjs` four, and **not one of them lists `empty`**. This is
  the repository's own named family: a rule that reached one site of nine.
- **The data was never missing.** 63 of 72 views declare `empty_action` with a label and a
  description. The screens were showing fixtures over the top of an answer the model already
  had.
- **THE OTHER HALF OF THIS RUN WAS NOT FINDING THINGS.** Five candidates, four rejected: a
  scroll measured mid-animation called all eighteen map links dead; a focus ring appeared
  only because Playwright's `selectOption` is keyboard-like, and a mouse path shows none; four
  kanban columns measured `top: 684`; and «продолжается.Агенты» was a `<br>`. **A defect
  whose failure is TOTAL — every link, every column — is usually the instrument, not the
  product.** That heuristic is worth more than any of the four fixes would have been.
- **Fix, by grade.** (1) `empty` joins `denied` and `loading` in the dispatch. (2) `th,td`
  moves from `overflow-wrap: anywhere` to `break-word`, so a column sizes to its longest word
  instead of cutting «Установлен» in half. (3) `repin-mockup-receipts.mjs` writes the object
  it verified — it had been reporting a moved line and discarding it, so the same refusal
  came back every time.
- **The check that catches it next time:** `scripts/test/product-empty-state.test.mjs`, six
  assertions over the real renderer, in the fast tier. What it does NOT prove is that an
  empty state is well designed — only that it exists, differs from the populated screen and
  carries its declared action.


### 2026-09-12 · two navigations, and the probe that cried wolf twice

- **Symptom, with evidence:** the operator asked for the dashboard's controls to be normal
  and working, then sent a screenshot of a report's own header and asked for rows by level
  from the top, with the side navigation removed everywhere. The site had two navigations — a left rail on the
  layout pages and the bar injected into reports — which is why a report never felt like part
  of the site even after it gained the bar.
- **Surfaced at:** stage 0, from the operator. **Owned by** the previous iteration, which
  added the injected bar and left the rail standing beside it. Making the two consistent was
  never a separate decision anybody took; it was a decision nobody noticed they were making.
- **What the audit actually found, after two false alarms.** Walking every control on eight
  surfaces produced four candidate defects. Two dissolved under R-004: eighteen "dead" map
  links were a probe measuring during a smooth scroll across ninety-eight thousand pixels,
  and a "no-op" theme button was a DOM signature that did not include colour. **The tell in
  both cases was the same — the failure was total.** All eighteen links, not three; a button
  whose whole job is one attribute. A defect that uniform is usually the instrument.
- **The two that survived were both invisible to sight.** `<a id="work-s02"></a>` came out as
  `<a id="work-s02" href>`, because the Markdown renderer set `href` on every anchor it saw —
  an empty href means "this page", so a register document carried 217 focusable tab stops
  that reload it. And every page asked for `/favicon.ico` and received the error page. Nobody
  would ever see either by looking at the screen; both were found by enumerating controls and
  by reading the console.
- **Root cause of the shape, not the bugs:** the layout and the reports each grew their own
  navigation because nothing in the repository said there should be one. There is now one
  component and one scenario clause, and a browser check that fails if a surface renders the
  rows in the wrong order or renders anything above the first one.
- **Fix, by grade.** (1) One shared top row on every surface; the rail and 640 characters of
  CSS that only served it are gone. (2) Rows 2 and 3 for identity and the page's own controls.
  (3) Anchor targets stay targets. (4) The tab icon is served, reports included. (5) The map
  marks the section being read, ordered by the document rather than by the nav's own order.
- **The check that catches it next time:** `workspace/test/browser.mjs` now asserts row
  geometry on six surfaces and drives the scroll-spy at three depths — the first geometry
  assertion this repository has ever had, and the reason CO-162 was filed a day earlier.
  What it still does not do is run in CI, because no runtime is decided; that half of CO-162
  stays open and is not claimed here.


### 2026-09-10 · the browser found the defect, the diff could not, and another agent's `git add -A` found me

- **Symptom, with evidence:** the operator reported that switching sections on the hosted
  workspace "breaks everything". Measured before touching anything: `rail=False top=False
  theme=False` on `/docs/reports/product.html` and `/docs/reports/map.html`, against `True`
  on `/`, `/library` and every `.md`. The host served snapshot `.html` raw (`server.mjs`
  html branch), so the three destinations its own navigation points at were the three that
  left the site.
- **Surfaced at:** stage 0, from the operator. **Owned by** the iteration that shipped the
  host: the rail and the raw-report branch were written in the same change and never
  compared, and no check asked whether a served page carries the chrome.
- **The finding no gate could have produced.** The unit and server tests were green with the
  bar in place on all four reports. A real browser measured `top: -471` on `system.html`
  alone. `system.html` had ALWAYS opened 425 px down — `route()` resolved
  `location.hash.slice(1) || 'system'` and scrolled to it unconditionally — so the report
  every reader reaches from the rail put them past its own title with no header. `scrollY=425`
  with scripts on, `0` with them off, traced to `system.html:429` by instrumenting
  `scrollIntoView`. **The stage-6 rule "a web surface is checked in a browser, not in the
  diff" earned its keep here**: every assertion about the bar was true and the page was still
  wrong.
- **Root cause, both halves.** The chrome half: a document served raw is not a page the site
  owns, and nothing in the test suite distinguished "served" from "rendered". The scroll
  half: a default value (`|| 'system'`) was used for two different jobs — choosing which view
  to show, and deciding whether the reader asked to be moved. One of those has a correct
  default and the other does not.
- **What the run cost me that was not mine.** Another agent staged with `git add -A` and
  carried this run's in-flight files into two of its commits (`d8de66c`, `d951c06`); it then
  recorded the crossing honestly in `4db0695` rather than rewriting history. Nothing was
  lost. Separately its uncompiled work sat in the shared tree for the rest of my run, so
  `scripts/ci.sh fast` could not be green in the main checkout at all — I verified in a
  worktree at HEAD carrying only this run's files, and said so rather than reporting a green
  I did not have.
- **A blocker that was stopping everyone.** `agent_sync.py guard` turned an absent
  `.claude/agent-sync.json` into exit 2, so no file in the `workspace` submodule could be
  committed through the tool — while that submodule's AGENTS.md requires it to have "no
  independent agent-sync identity". Two runs stalled on it in one evening and both read it as
  the publish script being strict. Fixed at the source with the boundary pinned: an absent
  config allows, an unreadable one still denies.
- **Fix, by grade.** (1) The host injects the bar at the byte seam that already rewrites
  links, and the section list has one home. (2) Authorized bodies revalidate; refusals stay
  `no-store`. (3) The generator scrolls only for a fragment the reader named. (4) The
  publication rail refuses the index rather than the working tree. (5) `agent-sync` stops
  denying uncoordinated repositories.
- **The check that catches it next time.** `scripts/test/plants-workspace-navigation.mjs`
  removes each mechanism and watches the suites redden — ten for ten. What it still does NOT
  catch is the class this run's worst defect belonged to: a page that is correct in the DOM
  and wrong on screen. The honest next step is a layout assertion in the browser harness
  (`workspace/test/browser.mjs` already exists and takes a Playwright module) asserting that
  the bar is inside the viewport after load on every report — filed as CO-162 rather than
  claimed here.
- **The third artifact stage 9 asks for could not be used, and that is recorded rather than
  skipped.** `graphify-out/graph.json` is dated 2026-09-01 and holds 1580 nodes and **zero
  edges**, and names no part of the workspace host. A graph with no edges cannot answer
  reach, which is the only question it exists for. Filed as CO-164; rebuilding ten days of
  drift belongs to its own change.


### 2026-09-12 · close-out · датированный заголовок над живой инструкцией

- **Symptom:** раздел «Final audit review — 2026-09-09» датирован заголовком, а телом — ЖИВАЯ инструкция: «начните с FA-01 и UX28-01, unattended активацию гейтите на FA-03/FA-04». Обе карточки закрыты вместе со всей очередью; документ звал читателя начать то, что кончилось.
- **Root cause:** дата в заголовке читается как «весь блок — запись момента», и поэтому его тело никто не перечитывает. Но запись момента — это утверждение о прошлом, а «начните с» — распоряжение на будущее. Одно и то же место несло оба, и устаревало только второе.
- **Fix:** датированный заголовок не переписан; ниже добавлен абзац со своей датой, диапазоном коммитов и родом каждого остатка. Правило, которое из этого следует: **дата на заголовке не консервирует ИМПЕРАТИВ под ним** — если абзац говорит «сделайте», его срок годности идёт от состояния очереди, а не от даты сверху.
- **Чужой прогон закоммитил мою незакоммиченную полосу карты** — и сделал это правильно: назвал это в своём сообщении, оставил остальные мои файлы нетронутыми и не стал форс-пушить. Урок не про них, а про меня: **полоса карты живёт в файле, который правит каждый прогон**, поэтому между её написанием и моим коммитом есть окно, и в нём она чужая. Исправление committed-записи — НОВОЙ полосой, а не правкой: закоммиченная полоса это запись момента.
- **И снятая аренда — это событие, а не отсутствие события.** Девять строк называют `r-a04c79b93` причиной, по которой их не сделали. Прогон закончился, и без записи об этом следующий агент выводит статус заново по девяти строкам вместо одной.

### 2026-09-11 · UXA-C06 · подсадка, оставшаяся зелёной, — находка о ПРОБЕ, и на этот раз о моей

- **Symptom:** лента журнала — сорок строк, рисующих фразу, номер и имя проекта; ни одна строка ничего не открывала. Журнал объявлен хребтом продукта, и он был единственным местом, откуда нельзя было дойти от события к тому, с чем оно случилось.
- **Surfaced at:** stage 0. Пакет назвал это прямо — и в той же приёмке назвал ловушку: неизвестный субъект обязан сказать, что не проверен, и НЕ ВЫДУМЫВАТЬ идентификатор.
- **Root cause и главный урок карточки:** правило по ПРЕФИКСУ неверно внутри того же семейства. Два объявленных события задачи пишут `id`, два — `task_id`. Правило «событие про задачу несёт id в ключе id» открыло бы страницу по идентификатору, которого в строке нет. Поэтому карта объявляется по одному ПРОЧИТАННОМУ писателю за раз — десять типов из семидесяти двух, и число объявлено модулем, а не пересчитывается читателем.
- **Подсадка оставила всё зелёным — и это была находка о ПРОБЕ.** Я подсадил ровно тот префиксный fallback, который запрещает приёмка, и ни один случай не покраснел: все мои «неизвестные» случаи брали `agent.heartbeat@1`, а подсадка действовала на необъявленные `task.*`. Правило из UXA-C03 («пойманная одним слоем из двух — находка о пробе») получило новую форму: **подсадка, не покрасневшая НИГДЕ, это либо нерабочая подсадка, либо дыра в пробе — и различить их можно только назвав условие, которое она создала.** Недостающий случай дописан до повторного прогона.
- **Вторая подсадка не скомпилировалась чисто** — размеченное объединение резолвера не даёт выдать неадресуемое за адрес. Это свидетельство МЕХАНИЗМА, а не плохая подсадка (AX-15).
- **И указатель продавал экран, который его же запись сняла.** Запись SCR-23 с 31 августа: «заменён, никогда не был построен и не будет»; строка указателя в том же файле: «построен», с исходником. Датированную запись не трогал — живую таблицу привёл в согласие и поставил забор. Заметил и собственную оплошность в заборе: его нота печатала «1 запись СОГЛАСУЕТСЯ» в том же выводе, где ошибка говорила обратное. Счёт того, ЧТО ПРОВЕРЕНО, — измерение; счёт того, что прошло, напечатанный независимо от исхода, — тот самый уверенный ответ, который весь этот набор отказывается давать.

### 2026-09-11 · UXA-C05 · довод против дефекта был написан в том же списке пропсов

- **Symptom:** одно значение — список сессий — доходит до четырёх поверхностей. Домашний экран эстейта держит `null` и проговаривает M108 в своих пропсах; остальные три сворачивают его на вызове в пустой массив, и «никто не смотрел» приходит как «ничего нет».
- **Surfaced at:** stage 0. Пакет назвал ОДНУ дверь из четырёх; остальные нашлись за один греп по шаблону `={… ?? []}`.
- **Root cause:** свёртка на ВЫЗОВЕ. Внутри панели проекта пометка чтения уже была написана — и не могла стать ложной, потому что родитель убирал `null` на двери; строка ожидания, которую эта пометка несёт, была недостижимым текстом. В представлении агентов пометка была зашита в «измерено» безусловно.
- **Худшее место — ЧИСЛО.** У числа пометки чтения нет вовсе, и строка состояния писала «агентов не работает» до первого чтения. **Довод против этого написан В ТОМ ЖЕ СПИСКЕ ПРОПСОВ, о поле прямо под ним:** `blocked` необязателен намеренно, «потому что зашитый ноль рисуется как измерение, которого никто не делал». Восьмой за цикл случай «правило не у всех дверей» — и первый, где возражение лежит на соседней строке объявления.
- **Тип этого запретить не может.** Массив присваивается в «массив или null», поэтому расширение пропса оставляет вызывающего свободным сворачивать дальше: пробел в ВЫЗЫВАЮЩЕМ, и единственное лекарство — невозможность забыть. Отсюда забор, и он честно называет, чего НЕ ловит (свёртку, написанную иначе), потому что забор без охвата неотличим от забора с дырой.
- **Сужать — один раз и ВНУТРИ.** `?? []` не запрещён сам по себе: он верен там, где различие уже отрисовано. Запрещено место — дверь, где различие ещё нужно и уже потеряно.

### 2026-09-11 · UXA-C04 · шестьдесят четыре строки и четыре способа потерять правду

- **Symptom:** окно сессии держало сессию и ошибку рядом; отрисовка проверяла ошибку ПЕРВОЙ и возвращала только её, и ничто её не сбрасывало. Одно отказавшее чтение при монтировании убивало окно на всю жизнь процесса, пока опрос под ним успешно отвечал.
- **Surfaced at:** stage 0, и пакет на этот раз назвал предмет ТОЧНО — но только три пункта из пяти; `null` как выброшенный ответ и отсутствие охраны поколений он не называл.
- **Root cause:** опрос написан как «поставить сессию, если она истинна», а чтение отвечает `null` для сессии, которой у главного процесса больше нет. Обработчик выхода в собственном комментарии ручается, что заголовок не напишет «работает» над мёртвой оболочкой, — и невзятый `null` ломал ровно то, ради чего он существует. Девятый запах (комментарий, ручающийся за соседний механизм) в форме, где ручается ЗА СЕБЯ и всё равно неверен.
- **Два вызова из четырёх без обработчика отказа** — необработанное отклонение каждые пять секунд; vitest зафиксировал два до починки. Опять «ко всем ли дверям», седьмой раз за цикл, и опять внутри одного файла.
- **Запуск не говорил, где он запустится.** Правило `репозиторий проекта, иначе домашняя папка` жило только в `index.ts`, поэтому лаунчер не мог его назвать, а агент с инструментами записи стартовал в домашней папке молча. Переезд правила в общий модуль — не удобство: деривация в главном процессе недостижима подсадкой (M110), а поверхность, повторяющая её словами, — это второе правило.
- **Двухрежимный компонент не носит трёхзначный факт.** Экран «прочитать не удалось» я сперва собрал на `EmptyState`: `read` поставил бы маркер ИЗМЕРЕНИЯ над чтением, которое ничего не измерило, а `read={false}` напечатал строку ожидания — противоположное случившемуся. Правило: **если у компонента два режима, а у факта три, компонент не тот.**
- **И я потерял собственную правку `git checkout`-ом.** Восстанавливая подсадку, для одного файла взял резервную копию, а для второго — `git checkout`: база у git это HEAD, а не моя незакоммиченная работа, и файл откатился к дефектной версии. Поймал сразу, потому что после восстановления смотрю diff. Правило усиливается: **восстановление подсадки — ТОЛЬКО из копии, снятой перед ней, и никогда через git.**

### 2026-09-11 · UXA-C03 · стирание ответа сидело в АННОТАЦИИ ТИПА

- **Symptom:** три действия хозяйства на экране эстейта шли через один помощник, объявленный принимать `Promise<unknown>`. Выбор папки возвращал, стал ли каталог репозиторием и почему нет; принятие возвращало отказ, который контракт делает НАМЕРЕННО, и счётчики того, что вошло. Ни одно из этого не доходило до экрана.
- **Surfaced at:** stage 0. Названное карточкой — типизированный отказ решения по предложению — уже сделано UX28-12; проверил восемь случаев его пробы, а не принял на веру. Живым было то, что доктрина применена к одному действию из четырёх.
- **Root cause:** `Promise<unknown>` — это дефект одним словом. Шестой за цикл случай семейства «правило держится не у всех дверей», и первый, где стирание не в забытой ветке, а в ПОДПИСИ: типу нечего было ронять, потому что тип уже всё выбросил.
- **Приоритет оператора достигнут со стороны отчёта, а не записи.** Папка без репозитория — не хозяйство: ADR-0048 называет его версионированной частной публикацией. Правда вычислялась, возвращалась и выбрасывалась единственным вызывающим; на машине без git оператор остаётся с папкой и узнаёт об этом, когда захочет сравнить.
- **Три исхода там, где форма несла два.** Отмена диалога отвечала отказом, чьё основание — слова «ничего не выбрано», поэтому различить закрытый диалог и хозяйство, которое действительно нельзя принять, значило сопоставлять сообщение. Правило «кажется, что состояний два — искать третье», применённое к контракту, а не к экрану.
- **Канал без последствий в чистом виде:** брошенное исключение клалось в значение, единственный читатель которого — атрибут `disabled`, и `finally` обнулял его на том же ходу. Две независимые причины, по которым ошибка не могла дойти.
- **И первая подсадка поймалась ТОЛЬКО модульным случаем.** Чистое правило держалось, а у поверхности свидетеля того же правила не было — та самая асимметрия, которую цикл находит по одной двери за раз, обнаруженная на этот раз ВНУТРИ МОЕЙ СОБСТВЕННОЙ ПРОБЫ. Вывод: **подсадка, пойманная одним слоем из двух, — это находка о пробе, а не о продукте**, и второй свидетель дописывается тут же.

### 2026-09-11 · UXA-C02 · вызов удался, и ответ не был всем ответом

- **Symptom:** очередь обязательств читается из пяти таблиц. Когда одна отказывает, остальные отвечают — и `attention.list` РАЗРЕШАЕТСЯ, отдавая очередь без целого класса обязательств. Баннер, поставленный вчера, на этом пути не срабатывает вовсе: ничего не упало.
- **Surfaced at:** stage 0. Вчерашняя итерация закрыла отказ вызова; пакет UXA-C02 назвал тот случай, при котором вызов УСПЕШЕН, — и это более глубокая половина той же дыры.
- **Root cause:** расписки измерялись всё это время и выбрасывались на границе. `readAttentionWithSources` собирал отказавший источник и обрезанное окно, а канал был подключён обёрткой, чей комментарий ручался за соседний механизм: «вызывающим некуда положить расписки» — при том, что `board.query`, читающий эту же функцию, место имел. Девятый запах из списка, в чистом виде.
- **И объявление контракта говорило правило ПЯТЬЮ СТРОКАМИ ВЫШЕ.** Свойство `board.query` в том же интерфейсе: «ReadEnvelope, поэтому источник, который отказал, никогда не нарисуется тихой доской». Соседнее свойство раздавало голый массив. Правило было не забыто — оно было применено не ко всем дверям, четвёртый раз за цикл.
- **Список отказов не умеет описать неполное чтение.** Доступность выводится сравнением ответивших с опрошенными, поэтому источник, о котором не сказали, считается не ответившим: один отказ из пяти сделал бы конверт `unavailable` и обнулил бы всё уцелевшее — ровно то, что приёмка карточки запрещает. Называется каждый источник, в обе стороны.
- **Вынес вывод расписок из главного процесса**, потому что `index.ts` не импортируется: подсадка не смогла бы достать деривацию, оставшуюся там. Правило про Electron-модуль, применённое к куску логики, а не к целому модулю.
- **Забор не видел ровно тот обработчик, о котором карточка.** Шаблон требовал списка параметров после канала, поэтому переданный ПО ИМЕНИ не попадал ни в находки, ни в счёт. Один из восьмидесяти восьми был таким — и это был он. Забор печатал «87 обработчиков», не говоря, из скольких: **забор, сообщающий улов и не сообщающий охват, неотличим от забора с дырой.**
- **А потом расширенный забор поймал МЕНЯ — на комментарии.** Фраза, называющая старую форму внутри нового пояснения, была прочитана как сама форма: 89 обработчиков в файле с 88. Вырезание комментариев уже жило в соседнем заборе; теперь у него один дом. Это стоящая инструкция, записанная в моём же списке, — и я вошёл в неё в тот же час, когда её писал. Вывод не «помнить лучше», а: **забор, который читает собственное пояснение как улику, — это забор, рядом с которым нельзя написать пояснение.**

### 2026-09-11 · UXA-C01 · названное было сделано два прохода назад, живым была строка приёмки

- **Symptom:** эффект карточек эстейта читал очередь обязательств и был написан как `catch`, ставящий пустую запись. Отказ чтения становился фразой «никого не ждут» — на всех карточках сразу и молча. Отказ отказа: беда самого высокого ранга в этой очереди — блокировка, где кто-то стоит прямо сейчас.
- **Surfaced at:** stage 0, и не оттуда, откуда ждал пакет. Названное решение — вести свежесть по метке журнала, а не по длине видимой ленты — уже сделано M42, FA-08 и UX28-02; пакет датирован ревизией, где этого не было.
- **Root cause:** ТРИ читателя одного запроса на одном экране. Панель CEO держит флаг живости и сообщает об отказе, `BoardPanel` на десять строк выше держит флаг живости и рисует проблему, собственный эффект карточек не делал ни того, ни другого. Это третий за цикл случай семейства «доктрина применена не ко всем», и здесь она не через файл, а через десять строк одного файла.
- **И это нарушение M147 со стороны ошибки:** карточки и панель делят один запрос именно затем, чтобы не было двух рассказов об одном факте. На отказе панель поднимала баннер, карточки показывали штиль — ровно то, что M147 запрещает, но по пути, о котором он не думал.
- **Третье состояние — в уже существующей форме.** `QuotaReading` из AX-14 решает этот же класс ошибки тремя ветками; взял её, а не придумал четвёртую. «Никто не смотрел» намеренно рисуется молчанием, а не оговоркой, и это записано с причиной: чтение занимает миллисекунды, надпись на каждой карточке при каждой отрисовке была бы шумом, а отказ держится. Та же асимметрия, что в AX-07 и AX-16, третье применение.
- **Ветку без читателя не завожу.** Соблазн был описать «ещё не смотрели» и оставить её без потребителя — ровно тот дефект, который цикл закрывает тринадцатую итерацию. Ветку различает `waitingFailed`, и потому она не два состояния об одном факте.
- **Названо с различением вида:** реестр сценариев ЗАБЛОКИРОВАН арендой соседнего прогона — это не отложено по выбору (UXAC01-REQ-004); семейства событий, которые эта очередь охватывает, НЕ ИЗМЕРЕНЫ, и сузить по догадке значит заморозить полосу, которую никто не проверил (UXAC01-REQ-005); счётчик непрочитанного ИЗМЕРЕН и отложен — он фильтрует ленту, обрезанную до пятисот, тогда как действие метит прочитанным всё до последней записи, так что кнопка предлагает пятьсот и метит шестьсот (UXAC01-REQ-006).

### 2026-09-11 · AX-16 · порядок двух строк и был дефектом

- **Symptom:** уведомитель помечал id как told ДО показа, весь тик в try с проглатыванием в `ops.failed`. Показ, бросивший исключение, оставлял обязательство помеченным — и о нём не говорили НИКОГДА за жизнь процесса.
- **Surfaced at:** stage 0. Обратное тому, о чём предупреждает карточка, и направление хуже.
- **Root cause:** запись о доставке ставилась до доставки. Асимметрия решает: сказать дважды стоит взгляда, не сказать — стоит того, о чём не сказали. Та же, что в AX-07 для курсора; это уже ВТОРОЕ место, где она применяется, и стоит носить её как правило: **при неопределённости выбирать ту ошибку, которая дешевле для читателя, и говорить, что выбрана она**.
- **Третье состояние, которого не было:** бросок ЗДЕСЬ — наблюдённый отказ; процесс, умерший посреди показа, — исход, которого никто не видел. Второй не записывается ни доставкой, ни отказом.
- **Проба поймала меня ВТОРОЙ раз за цикл, в новой форме.** Первая версия сравнивала ключи ЭКЗЕМПЛЯРА, а утверждение было про ТИП: подсадка добавила НЕОБЯЗАТЕЛЬНОЕ поле, у значения ключей не прибавилось, забор остался зелёным. AX-11 сказал «проба может быть слишком точной»; здесь видно, ГДЕ это прячется — **всякий раз, когда утверждение смотрит на значение, а claim про форму**. Чтение объявления ту же подсадку роняет.
- **Приёмку проверил на СВОЕЙ работе двухитерационной давности**, а не принял на веру: курсор, который я поставил, полосу обязательств не трогает — и держится это структурно, потому что отмечать прочитанным негде. Измерено, а не поверено.
- **Названо с различением вида:** связанного маршрута нет и модели личности нет — две вакуумные истины ОТДЕЛЬНЫМИ строками (AX16-REQ-005/006).

### 2026-09-11 · AX-15 · та же форма, что вчера, но дверь шире

- **Symptom:** SEC-REQ-016 ограничил три файловых примитива корнями, которые оператор открыл, и оставил четвёртый — тот, что отдаёт путь ОПЕРАЦИОННОЙ СИСТЕМЕ. `shell.openPath` просит ОС открыть файл закреплённым обработчиком: это строго больше, чем чтение.
- **Surfaced at:** stage 0, ПЕРВЫМ же измерением — потому что я применил вчерашний вопрос: не «есть ли граница», а «ко всем ли дверям она поставлена». Две итерации подряд дефектом оказался ПРОБЕЛ В ДОКТРИНЕ, а не её отсутствие.
- **Root cause:** правило записано в шапке модуля и применено в трёх его функциях; четвёртая живёт в `index.ts`, куда шапка не смотрит. Пробелы селятся там, где доктрина и её применение лежат в разных файлах.
- **Fix, by grade:** `resolveForOpen` переиспользует НАСТОЯЩИЙ `roots.resolve`, поэтому наследует симлинк-случай и случай соседнего каталога с общим префиксом; обработчик отказывает с причиной, а не бросает, потому что его контракт уже отвечает причиной.
- **Вторая подсадка НЕ СКОМПИЛИРОВАЛАСЬ, и это другое, чем плохая подсадка.** Размеченное объединение делает `path` доступным только в ветви `ok`, поэтому «вычислить проверку и проигнорировать» невыразимо. Обычно несобирающаяся подсадка доказывает подсадку; здесь она доказывает МЕХАНИЗМ. Записал как есть, а не засчитал пойманной: это разные утверждения о коде.
- **Капкан обратных кавычек стоил прогона ЧЕТВЁРТЫЙ раз** — в пробе, чей внутренний скрипт есть шаблонный литерал. Правило известно, гейт существует, и я всё равно их написал. Это не про знание, а про порядок: комментарий пишется раньше, чем вспоминается ограничение файла.
- **Названо с различением вида:** браузера нет и читателя медиа нет — две вакуумные истины, записанные ОТДЕЛЬНЫМИ строками, чтобы построенная одна не оставила вторую выглядящей покрытой (AX15-REQ-004/005); «закрытие вкладки не останавливает сервис молча» предмет имеет и не измерено (AX15-REQ-006).

### 2026-09-11 · AX-14 · доктрина, применённая к трём читателям из четырёх

- **Symptom:** фраза «Claude Code не залогинен на этой машине» печаталась как ИЗМЕРЕНИЕ (`EmptyState read`) в трёх ситуациях: читателю нечего было сказать; чтение по IPC отказало и перехват записал `null`; чтения ещё не было, потому что начальное состояние и есть `null`. Последнее — диагноз машине оператора на первой же отрисовке.
- **Surfaced at:** stage 0, измерением.
- **Самое острое: правило уже существовало здесь.** M108 — «null пока не прочитано; пустой ответ есть ИЗМЕРЕНИЕ» — написано словами про `projects`, `sessions` и `feed`. К квоте его не применили. **Доктрина, применённая к трём читателям из четырёх, — это не доктрина, а привычка с пробелом, и утверждение приземляется ровно в пробел.** Искать стоит не «есть ли правило», а «ко всем ли оно применено» — и список исключений почти всегда пуст не потому, что их нет, а потому что никто не считал.
- **Root cause:** одно значение (`null`) несло три факта, и ни один из них не был выбран сознательно — два приехали из перехвата и из инициализации.
- **Fix, by grade:** трёхзначное чтение (`read: false` / ответ / отказ); отказ несёт причину и говорит, что про аккаунт не сообщает ничего; шесть причин `Quota.problem` называются собой, а не возрастом.
- **Фикстура снова поймала меня:** первая проба задала `utilization: 0.42`, тогда как продукт оперирует целыми процентами, и случай упал на числе, а не на поведении. Правило «фикстура обязана быть той формы, которую производит продукт» работает и для единиц измерения.
- **Одна приёмка переизмерена и держится сильнейшим способом:** ноль стоимости из отсутствующего измерения невозможен, потому что ячейки НЕТ. Отсутствие сильнее нуля, и `quota.ts` хранит измерение, почему так.
- **Названо с различением вида:** экспорта нет вовсе — вакуумная истина (AX14-REQ-005); проверка сохранений с диска предмет имеет и просто не измерена (AX14-REQ-006).

### 2026-09-11 · AX-13 · комментарий, ручающийся за СОСЕДНЕГО сторожа

- **Symptom:** цикл в `spawned` записываем по замыслу (ADR-0053 не отказывает провенансу по топологии), а обход глубины отвечал на цикл небольшим ЧИСЛОМ — и граница читала его как короткую цепочку. Убегание, ради остановки которого граница существует, достижимо ровно сквозь неё; живо на двух путях рантайма.
- **Surfaced at:** stage 0 — и нашёл это КОММЕНТАРИЙ, а не код. Существующий случай утверждал дефект и оправдывал его ссылкой на сторожа «на границе записи», которого ADR-0053 явно не предоставляет.
- **Самый сильный запах, найденный за цикл:** комментарий, ручающийся за СОСЕДНИЙ механизм. Он не просто описывает свойство, которого нет, — он останавливает читателя от проверки, потому что перекладывает ответственность на файл, который читатель открывать не станет. Комментарий про собственный код проверяется чтением ниже; комментарий про чужой требует пойти и посмотреть, и почти никто не идёт.
- **Root cause:** одно значение несло два факта — как далеко уходит происхождение и что оно возвращается к себе. Цепочка, замыкающаяся на себя, не имеет длины.
- **Fix, by grade:** `chainReach` отвечает обоими фактами; граница отказывает циклу независимо от числа пройденных звеньев; отказ называет причину, на которую агент может ответить, а не счётчик, который он обойдёт.
- **Две приёмки переизмерены, и одна даёт различение, которое стоит сохранить:** счёт раундов переживает перезапуск ПО ПОСТРОЕНИЮ — он нигде не хранится. Долговечность, которую никому не пришлось устраивать, отличается от устроенной: только первая не может протухнуть.
- **Названо с различением вида, и появился ТРЕТИЙ ответ, которого леджеру раньше не требовалось: ПОЛОВИНА держится.** «missing / empty / stale»: отказ есть у обоих, но оператору они приходят одной фразой — агент, вернувший пустой отчёт, это находка о нём самом, а отсутствующее имя это ошибка проводки, и человека они посылают в разные места (AX13-REQ-006). А «stale» не имеет предмета: у переданного значения нет ревизии.

### 2026-09-11 · AX-11 · проба может быть слишком точной, чтобы заметить то, ради чего написана

- **Symptom:** `evidenceOf` вычисляет ЧЕТЫРЕ акта — открыть, найти, повторить и НИКАКОЙ, — а `action` не читал никто. Экран делился по булеву и предлагал кнопку в обеих ветвях, поэтому источник, записанный как удалённый, получал «попробовать открыть» рядом с фразой модуля, объясняющей, что открыть нельзя. Двенадцатый случай формы.
- **Surfaced at:** stage 0, измерением. Пакет смешан: половина про исходящую приватность НЕ ИМЕЕТ ПРЕДМЕТА, половина про повторяемость уже держится, а живой оказалась третья — акт на экране.
- **Главный урок прогона — про мою собственную пробу.** Первая подсадка оставила всё зелёным. По правилу AX-17 я не стал называть это находкой о покрытии, а проверил, создала ли подсадка условие. Создала: кнопка вернулась, но её подпись провалилась в «Try again», а утверждения искали кнопку ПО ИМЕНИ `/open/i`. Акт был на экране, и ни один случай его не видел. **Проба может быть слишком ТОЧНОЙ, чтобы заметить то, ради чего написана** — и это отличается от «слишком слабой»: она проверяла настоящее свойство, но одним конкретным способом, который дефект обошёл, сменив подпись.
- **Fix, by grade:** экран читает названный акт, а `null` означает отсутствие кнопки; утверждения требуют отсутствия ЛЮБОЙ кнопки там, где акта нет.
- **Привычка, которую стоит назвать:** две приёмки я переизмерил именно потому, что модуль ОБЪЯВЛЯЕТ их в шапке. Прозой объявленное правило — то место, где цикл раз за разом находит код, его не держащий; шапка это место ПРОВЕРКИ, а не доверия. Здесь обе держались, и это тоже результат.
- **Собственная проверка труб поймала литеральный `|` в ячейке пятый раз** — и, что показательно, во второй раз в этой же итерации: в записи ретро О ЭТОМ ЖЕ уроке.
- **Названо с различением вида:** состояния проверки урока нет — подлинно отсутствующая способность, поэтому ни один урок сейчас не ЗАЯВЛЯЕТ себя проверенным (AX11-REQ-005); исходящего пути нет вовсе, поэтому «работает при выключенной отправке» истинно вакуумно, и галочка читалась бы как проверенная деградация (AX11-REQ-006).

### 2026-09-11 · AX-09 · самым трудным было НЕ СТРОИТЬ

- **Symptom:** карточка ограничивает путь активации менеджера/расчёта, которого НЕТ. `ModelPort` — ноль файлов, «settlement» — ноль, «failover» — ноль; «activation» — про устройство в `identity.ts`, «manager» — про эвал.
- **Surfaced at:** stage 0, измерением. Третий тип расхождения из четырёх, встреченных за цикл: не «устарело» и не «уже сделано», а **предмета не существует**.
- **Самое трудное в прогоне — не построить.** Я дважды потянулся поставить забор вокруг отсутствующей способности и оба раза остановился: забор над тем, чего нет, — это пустая истина, которую цикл ловит через итерацию. Отсутствие работы — законный результат, и сказать это прямо дешевле, чем изобрести пункт.
- **Две приёмки ПРОВЕРЕНЫ, а не пересказаны, и одна из проверок стоит правила:** `rankBoard` выглядел очевидно детерминированным, поэтому я проследил ключ разрыва ничьих до `BoardEntry.ref` и убедился, что он ОБЯЗАТЕЛЕН. Разрыв ничьих через необязательный ключ — ровно тот способ, которым детерминированная на вид сортировка перестаёт быть таковой, и прячется он именно за «тут очевидно всё в порядке».
- **Урок AX-07 обобщён:** инвариант, записанный про будущее, охраняет ровно столько, сколько существует сейчас. Правило «вердикт не выдаёт разрешения» читало ОДИН жёстко прописанный файл; расширено на семейство, к которому будущий модуль присоединится сам. Покрытие — в шапке правила: два файла сегодня, по имени экспортируемой функции, слепо к методу и const-стрелке.
- **Названо, а не подразумевается, с РАЗЛИЧЕНИЕМ вида:** четыре строки помечены `never`, и каждая говорит, какого рода это «никогда» — предмета нет против построено-и-не-измерено. Таблица покрытия, сливающая их, теряет разницу, а вместе с ней и то, что следующему прогону делать.

### 2026-09-11 · AX-07 · инвариант без вызывающих истинен самым слабым способом

- **Symptom:** весь `shared/inbox.ts` — 144 строки, десять экспортов, две полосы, курсор с CAS, словарь пустоты — потреблялся только собственным юнит-тестом. Одиннадцатый случай формы за цикл и первый, где непрочитан ЦЕЛЫЙ МОДУЛЬ.
- **Surfaced at:** stage 0. Пакет здесь ТОЧЕН и сам называет форму: «типы построены, продукционного маршрута нет».
- **Root cause и самое важное наблюдение прогона:** в шапке модуля стоит «курсор не может быть вызван ничем, что просто получило данные». При нуле вызывающих это истинно ВАКУУМНО — и перестаёт что-либо значить в ту секунду, когда маршрут появляется. Инвариант, записанный про вызывающих, охраняет ровно столько, сколько вызывающих существует.
- **Дефект, который теряет видимое:** `throughSeq` — позиция в ОДНОМ журнале, восстановление минтит новое поколение. Позиция 9000 против максимума 12 помечает прочитанным всё, и оператор, ни разу не смотревший на хозяйство, видит пустую ленту с надписью «всё прочитано».
- **Направление сброса — это и было решение.** К «не прочитано ничего», а не к «прочитано всё»: показать строку дважды стоит взгляда, скрыть — стоит того, о чём она. То же рассуждение оставило хозяйство без событий с его нулём: «ещё ничего не произошло» — не восстановление, и объяснение там стало бы мебелью.
- **Тип сделал работу вместо чеклиста:** обязательный проп заставил TypeScript назвать все пять мест вызова. Это «невозможно забыть» в действии — я не искал их грепом и не мог пропустить.
- **Названо, а не подразумевается, и это ПЕРЕВОД молчаливого долга в измеренный:** девять из десяти экспортов модуля по-прежнему без потребителя (AX07-REQ-005), и сказать, какие именно, — не то же самое, что не сказать ничего. Приёмка про needs-you не имеет предмета (AX07-REQ-006).

### 2026-09-11 · AX-06 · ложная дыра — зеркало ложной полноты

- **Symptom:** `missingPredecessors` считался внутри каждой линии перебором ВСЕХ фактов партии, поэтому каждый корень нёс один и тот же общий список. Решение с целой историей подписывалось «часть этой истории не попала в прочитанную партию» — из-за дыры у постороннего решения.
- **Surfaced at:** stage 0, измерением. Пакет здесь ТОЧЕН в одной приёмке (два предшественника видны — уже выполнено), устарел в никакой и НЕИЗМЕРИМ в двух: графа, о совпадении с которым говорит первая приёмка, не существует вовсе.
- **Root cause:** утверждение про субъект, вычисленное из глобального множества. Это тот же класс, что и «ответ обязан быть ключован» из UX28-02, только в обратную сторону: не чужой ответ подставлен, а чужая беда.
- **Самое важное решение прогона — УДАЛИТЬ поле, а не чинить.** `missingPredecessors` нельзя было заполнить правдиво ни при какой реализации: отсутствующий предшественник — это строка, которую не отдали, и увидеть её из пришедших строк нельзя. Поле держало отсутствующих ПРЕЕМНИКОВ и называлось предшественниками. Починка на месте сохранила бы имя, которое лжёт. Поле, которое не может быть истинным, хуже отсутствующего.
- **Вопрос перенесён на уровень, где на него можно ответить:** `orphansOf` говорит один раз, про партию, сколько историй не показано ВООБЩЕ. До этого панель перечисляла только целые линии, и партия с тремя невидимыми историями читалась как «вот решения проекта».
- **Ратчет сработал тремя ветвями сразу** — два поля обрели читателя, одно исчезло — и каждое вычёркивание проверено КОМАНДОЙ. Дисциплина из AX-10 держится третью итерацию.
- **Существующий тест утверждал дефект** (линия `new` обязана нести дыру постороннего `orphan`) — переписан, а не удалён. Второй такой случай за цикл.
- **Названо, а не подразумевается, и в двух РАЗНЫХ формах:** графа нет — это отсутствие, а не расхождение (AX06-REQ-005); а отрицательные приёмки про план НЕ ИЗМЕРЕНЫ, поэтому не утверждаются НИ В КАКУЮ сторону (AX06-REQ-006). Сказать «выполняется, потому что ничего явно не нарушает» было бы тем самым уверенным ответом, который цикл ловит с первой итерации.

### 2026-09-11 · AX-17 · двадцать одно вечное предупреждение — это мебель

- **Symptom:** 21 поток из 53 несёт вердикт, который нельзя измерить — только унаследовать, — и каждый уходил ПРЕДУПРЕЖДЕНИЕМ в канал, который CI гоняет без `--strict`. Вечное предупреждение не читают.
- **Surfaced at:** stage 0, измерением — и измерение же показало, что **два из трёх утверждений пакета устарели**: SCN-068..078 все на месте (0 ошибок линта), все три строки M152 читаются `shipped`. План поправлен, а не исполнен. Второй устаревший пакет после AX-04, и правило той итерации сработало во второй раз.
- **Root cause:** канал без последствий. Предупреждение, которое ничего не роняет и никем не разбирается, — это не сигнал, а фон; и чем их больше, тем надёжнее его не видно.
- **Fix, by grade:** (1) ратчет с базлайном — растёт долг, валит; появилось измерение и не вычеркнули, валит; строка про несуществующий поток валит; (2) счёт демотирован до ЗАМЕТКИ — измерение, которое держится, печатается и не стоит ни в чьей очереди; (3) размер долга и знаменатель (21 из 53) написаны там, где долг живёт, при постройке, а не потом.
- **Две подсадки из трёх были НЕВЕРНЫМИ, и это главное за итерацию.** Они правили строку `Coverage`, найденную поиском вперёд от первого упоминания `SCR-04` — а оно в индексной таблице. Забор оставался зелёным, и это ВЫГЛЯДЕЛО как находка о покрытии; я почти записал её как таковую. Спасла дисциплина фикстуры: подсадка обязана СДВИНУТЬ измерение, и пока 21 оставалось 21, зелёное не означало ничего. Третья попытка целилась парсером самого линта, счёт упал до 20, и погашающая ветвь сработала.
- **Урок, который шире этой карточки:** «подсадка оставила зелёное» — это находка ТОЛЬКО если подсадка доказанно создала условие. Иначе это плохая подсадка, и разница между ними видна лишь по измерению, а не по цвету.
- **Названо, а не подразумевается:** реестр сценариев ЗАБЛОКИРОВАН арендой шестую итерацию подряд (AX17-REQ-004); датированный отчёт очереди НЕ переписан НАМЕРЕННО (AX17-REQ-005) — переписать его значило бы уничтожить свидетельство, что состояние менялось.

### 2026-09-11 · AX-12 · продукт обещал резервную копию, которой у оператора нет

- **Symptom:** три утверждения, поддерживающие друг друга, и все три ложны. `restorability()` — «функция, которая отказывает слову backup» по словам `archive.ts` — вызывалась только собственным юнит-тестом. Онбординг говорил «без папки нет резервной копии», то есть с папкой она есть. А `archive.ts` оправдывал маркировку тем, что «экран называет пробелы», — при том что ни один файл рендерера не импортировал контракт вообще.
- **Surfaced at:** stage 0, измерением. Пакет здесь точен.
- **Root cause:** правда была записана в контракте (`NOT_MIRRORED`, строка про `goals`) и не имела ни одного пути к оператору. Это не «текст расходится с кодом» — это КОНСТАНТА, которую никто не читает, плюс предложение, написанное руками вместо того, чтобы быть вычисленным.
- **Fix, by grade:** (1) фраза вычисляется из `declaredCoverage()`, поэтому переставшая переноситься таблица меняет её сама; (2) оговорка стоит рядом с решением и исчезает, когда решение принято, — вечная оговорка становится мебелью; (3) забор отказывает ОБЕЩАНИЮ, а не слову.
- **Забор построен сразу с ИЗМЕРЕННЫМ покрытием, и это первый раз, когда правило применено при постройке, а не обнаружено после.** В его шапке написано: два реестра, 967 литералов, и обещание во встроенном тексте компонента или в диалоге главного процесса ВНЕ его досягаемости. Узкий забор вокруг места, где дефект найден, честнее широкого забора, про который никто не знает, где он слеп.
- **Вычеркнута строка долга перевода — и на этот раз по правде:** русский текст написан в этом же изменении и проверен чтением файла. Это дисциплина, установленная в AX-10 после ложного вычёркивания.
- **Названо, а не подразумевается:** восстановленное окружение не удерживается read-only до активации (AX12-REQ-005); у приёмок про аутентификацию нет предмета — потока авторизации человека не существует, десктоп ходит служебной ролью, и это ПЕРЕПРОВЕРЕНО, а не пересказано (AX12-REQ-006).

### 2026-09-11 · AX-10 · эвалюатор безопасности не мог провалить настоящие данные

- **Symptom:** каждый критерий охранялся наличием собственной улики (`if (s.scope && s.touched)`), а настоящая трасса улик не несёт — `toolTrace.ts` пишет транспортный исход и id. Значит реальная траектория получала чистый пропуск по КАЖДОМУ критерию безопасности всегда, а корпус рукописных фикстур делал эвалюатор на вид работающим.
- **Surfaced at:** stage 0, измерением. Пакет здесь точен, как и AX-08.
- **Root cause:** «нарушения не найдено» и «вопрос не задавали» были одним значением. Это та же «пустая истина», что и в UX28-08 и AX-08, но на вершине стека безопасности, где цена ошибки наибольшая.
- **Fix, by grade:** (1) улики критерия вычисляются явно, и незаданный критерий даёт `inconclusive`, а не `pass`; (2) проверка стоит ПОСЛЕ поиска нарушений — частичная трасса доказывает неисправность, но не её отсутствие; (3) отчёт несёт `unaskedCriteria` рядом с `clean`; (4) гейт ГОНЯЕТ корпус и отказывает, если критерий не спрашивали.
- **Демонстрация вместо аргумента:** на прореженном до реальности корпусе прежний гейт печатает «все 8 нарушений засеяны» и проходит, новый — отказывает поимённо. Это сильнее любого объяснения в комментарии.
- **Третье слепое пятно моего забора, и его закрытие было УСЛОВИЕМ КОРРЕКТНОСТИ, а не улучшением:** `CorpusReport` не имеет потребителя внутри `apps/desktop/src` вообще — отчёт гейтовый по замыслу, — а забор ходил только туда.
- **Главный отказ прогона:** расширенный забор объявил девять записей погашенными. Восемь подтверждены наведением команды на каждую. Девятая совпала ЕДИНСТВЕННЫЙ раз — фразой «canonical scenarios» в сообщении гейта. Вычеркнуть значило бы сократить долг на совпадении (урок AX-04 повторяется), поэтому сужено ПРАВИЛО: список колонок обязан содержать запятую. Ложная запись выпала, восемь настоящих остались.
- **Названо, а не подразумевается:** импортёра трассы нет (AX10-REQ-006) — и следствие переформулировано честно: до его постройки каждая реальная траектория `inconclusive` ПО ПОСТРОЕНИЮ, это верное чтение, а не регресс. Отчёт не пинит версии (AX10-REQ-007).

### 2026-09-11 · AX-08 · значение по умолчанию было утверждением

- **Symptom:** внешний цикл начинал с `state = 'completed'` и уходил оттуда только через исключение; `tick()` возвращал `void`, поэтому вычисленный `partial` до расписки не доходил. Зубы у этого такие: `advancesWatermark('completed')` истинно, то есть окно, в котором ничего не прочиталось, помечалось пройденным.
- **Surfaced at:** stage 0, измерением дерева — и на этот раз пакет аудита оказался ТОЧЕН во всех четырёх утверждениях. Это стоит записать рядом с прошлой итерацией, где он устарел: пакет не «ненадёжен вообще», он датирован, и проверять надо каждый раз.
- **Root cause:** умолчание, которое читается как измерение. `completed` не было вычислено ни разу — оно было начальным значением, которое ничто не могло опровергнуть, потому что единственный источник правды (`tick`) возвращал `void`.
- **Fix, by grade:** (1) тик возвращает исход, а не `void`; (2) первое чтение читает свою ошибку и отвечает `outcome_unknown`; (3) состояние СОСТАВЛЯЕТСЯ (`worstOf`), причём `outcome_unknown` выше `failed_known` — увиденный отказ учтён, неучтённый нет; (4) одна расписка на окно, поэтому join-id не нужен; (5) `advancesWatermark` записывается в расписку и наконец применяется.
- **Самая ценная подсадка ОСТАЛАСЬ ЗЕЛЁНОЙ.** Возврат старого умолчания в `runCycle` компилируется и не роняет ни одной пробы: `index.ts` не импортируется (M110). Это утверждение о ПОКРЫТИИ, а не о корректности, и оно записано строкой AX08-REQ-006, а не сглажено.
- **Существующий тест утверждал дефект.** Случай «says the app was CLOSED» кодировал ложную уверенность. Переписан, а не удалён: удаление скрыло бы, что он когда-то проходил.
- **Мой собственный забор поймал моё собственное новое поле** в той же итерации — `CycleGap.explained` не имел читателя, пока его не прочитал `needsIntervention`. Механизм сработал на своём авторе.
- **Обратные кавычки в пробе снова стоили прогона:** эта проба пишет внутренний скрипт ШАБЛОННЫМ ЛИТЕРАЛОМ — ровно то, о чём предупреждает `check-probes.mjs`; ответ был в стиле самого файла (конкатенация).
- **Названо, а не подразумевается:** путь пробуждения не сверен с арендами и допуском (AX08-REQ-007).

### 2026-09-10 · AX-04 · запись сохранялась, и её не читал никто

- **Symptom:** пакет аудита утверждал, что контекст сессии живёт в удаляемом бандле. Измерение показало другое: PF-05.02 давно закрыл половину ЗАПИСИ — байты лежат в `{root}/packets`, вне сессионной папки. Не построено было ЧТЕНИЕ: у `readPart` ноль потребителей во всём репозитории, включая тесты, а `verify` звался один раз на старте против блобов, записанных строкой выше.
- **Surfaced at:** stage 0 — и это главное за итерацию: **пересказ пакета дал бы правку дефекта, которого уже нет, при живом настоящем**. Пакет — гипотеза с датой, а не факт.
- **Root cause:** способность чтения без единого вызывающего. Со стороны оператора долговечная запись, которую нечем достать, неотличима от потерянной. Седьмой случай формы за цикл и первый, где непрочитанное — не поле, а целый путь.
- **Fix, by grade:** (1) путь чтения с ЧЕТЫРЬМЯ именованными исходами и без пятого, который пересобирает пак из сегодняшней памяти; (2) сверка дайджестом на выходе — переписанный блоб отказывается, а не выдаётся за запись; (3) потребитель в продукте рядом с расшифровкой, иначе я построил бы восьмую непрочитанную способность в итерации, называющей седьмую.
- **Подсадка как находка, а не подтверждение:** отключение пере-хеширования дало необработанный ENOENT вместо упавшего утверждения. Финальное чтение блоба было не защищено, а `verify` и чтение — разные системные вызовы. Модуль, обещающий именованные исходы и способный бросить, ненадёжен. После защиты та же подсадка отчиталась чисто.
- **Ратчет пришлось не послушать буквально, чтобы послушать честно:** он объявил запись базлайна погашенной, потому что ищет читателей по ИМЕНИ поля. Вычеркнуть по совпадению имён — сократить долг на лжи. Полю дан настоящий читатель, и это оказалось настоящей дырой: `readManifest` сверял `format` и не сверял версию, которую сам же объявляет.
- **ASI в третий раз за две итерации.** Инстанс не чиню — убираю ФОРМУ: регулярки теперь именованные константы в начале файла, и строка утверждения не может начинаться со слэша.
- **Названо, а не подразумевается:** сухой предпросмотр следующего контекста (AX04-REQ-006) и обязательные источники при неподнадзорном запуске (AX04-REQ-007) не тронуты.

### 2026-09-10 · AX-03 · коммит был exactly-once, доставка — нет

- **Symptom:** `answer_question` сравнивает и подменяет: повтор той же команды возвращает ПЕРВОЕ решение с `repeated: true`. Доставка следом брала свежий `randomUUID()` при каждом вызове и звалась безусловно — `repeated` не спрашивали. Потерялся ответ IPC, оператор нажал снова, агенту сказали дважды: одно решение под двумя id доставки.
- **Surfaced at:** stage 0, из пакета аудита. **Owned at:** stage 5 — это не отображение, а дублированный акт, поэтому взята именно эта половина пакета: приоритет оператора — сохранность прежде автономии.
- **Root cause:** идентичность доставки минтилась, а не выводилась, и никто не сверялся с уже существующей распиской. **Инвариант при этом был записан дважды** — в шапке `continuation.ts` и шестью строками выше самого минта. Оба предложения верны про КОММИТ и ни одно не верно про эффект. Комментарий, описывающий свойство, которого код не держит, — форма, которую цикл встречает не впервые.
- **Fix, by grade:** (1) механизм — id выводится из решения и цели, поэтому первичный ключ делает проекцию идемпотентной сам; (2) механизм — сверка читает расписку ДО отправки байтов, то есть закрывает ту половину, которую база не может обеспечить; (3) видимость — расписка наконец читает `repeated` и говорит «уже записано», а не повторяет фразу первого коммита; (4) объявление — `alreadyDelivered` объявлен на проводе, иначе рендерер читал бы его по случайности.
- **Три находки о самих проверках:**
  - Случай, начинающийся с regex-литерала, — ASI, `SyntaxError`. Своё же правило, нарушенное снова.
  - Фикстура без `task_id` перестала находиться, как только подделка начала фильтровать: случаи прошли бы, **ничего не доставив**. Поэтому ПЕРВОЕ утверждение теперь доказывает, что фикстура — живой прогон.
  - Настоящий `createScopedStore` отбросил фикстуры без `estate_id`. Это не помеха, а доказательство: фильтр области ставит стор, и модуль не пишет его сам.
- **Самое неприятное, и поэтому названное первым:** забор `check-written-never-read.mjs`, построенный ВЧЕРА ровно для семьи «поле записывается и не читается», этот случай не увидел. Измерено: он матчит `export interface (\w+)\s*\{([^}]*)\}`, `[^}]*` останавливается на первой закрывающей скобке, и из 1163 видимых полей на `FabricApi` с его 86 обработчиками приходится ПЯТЬ. Расширять внутри коммита про другое нельзя — это ратчет с базлайном на 66 записей (AX03-REQ-005).
- **Названо, а не подразумевается:** четыре из пяти шагов пакета AX-03 не тронуты (AX03-REQ-006) — сказано прямо, а не оставлено выводиться из таблицы покрытия.
- **Check that catches it next time:** `apps/desktop/test/continuation-exactly-once.test.mjs`, вписанная в `ci.sh`; четыре подсадки увидены пойманными.

### 2026-09-10 · AX-05 (остаток) · у сущности появился адрес, и второе состояние об одном факте удалено

- **Symptom:** оболочка умела назвать ПРОЕКТ и ничего уже́е. То, что оператор открыл, жило в состоянии `Focus` рядом с маршрутом, и собственная документация поля объясняла почему: «отдельно от маршрута, потому что ПОТРЕБЛЯЕТСЯ». Экран, исполнивший запрос, обнулял его — и через мгновение маршрут больше не мог сказать, где оператор. Не на что сослаться, нечего сравнить, нечего восстановить. AX-03, AX-04 и AX-06 ждут этого по `depends_on` самой AX-05.
- **Surfaced at:** stage 0 — прошлая итерация оставила это измеренным отложением (AX05B-REQ-007), а не догадкой.
- **Owned at:** stage 2. Соблазн был написать второй резолвер: маршрут «знает» про сущности, значит пусть сам решает, какие адресуемы. R-005 остановил — `destinationOf` уже отвечает на этот вопрос и имеет ЧЕТЫРЕ исхода, включая «отказано» и «неадресуемо». `routeToEntity` собран поверх него, поэтому адресом становится ровно один исход, а остальные три несут запасной маршрут и причину.
- **Root cause:** не отсутствие поля, а **два состояния об одном факте**. Маршрут говорил «где», `Focus` — «что», и они обязаны были совпадать, но одно из них потреблялось. Такое расходится всегда. Поэтому показ теперь ВЫВОДИТСЯ из адреса, а потребление стало защёлкой визита; `Focus.returnTo` удалено, а не оставлено рядом с `cameFrom`, появившимся прошлой итерацией ровно потому, что `returnTo` не справлялось.
- **Fix, by grade:** (1) механизм — адрес нельзя собрать руками, он проходит через резолвер; (2) механизм — показ выводится, а не хранится; (3) проверка — ссылка с диска валидируется по словарю сущностей; (4) доказательство — адрес пишется на диск, что и делает его наблюдаемым для пробы.
- **Три находки о самих проверках, а не о коде:**
  - Приземление на проект было истинным и ДО правки, поэтому проба, останавливающаяся на нём, зелена при обоих состояниях мира. Пришлось найти то, что отличает: записанный маршрут.
  - Четыре подделки были неверной ФОРМЫ — `tasks.list`, `diagnostics.read`, `meta.info`. Каждая роняла уже отрисованный экран. Это близнец правила «подделка не щедрее базы»: подделка, не совпадающая с контрактом, не проверяет ничего.
  - Подсадка `false ? active.at : {}` **не скомпилировалась** — сужение типа терялось. Переписана чистым пропуском. Подсадка, которая не собирается, доказывает подсадку, а не тест.
- **Названо, а не подразумевается:** сброс защёлки в оболочке не покрыт ни одним случаем (AX05C-REQ-005); `evidence.ts#reveal` по-прежнему прокручивает секцию (AX05C-REQ-006); фраза сценария ЗАБЛОКИРОВАНА арендой соседнего прогона на `docs/ux/scenarios.md` (AX05C-REQ-007) — не сложностью, а чужим замком, и писать под ним значило бы затереть соседа.
- **Check that catches it next time:** `check-written-never-read.mjs`, построенный прошлой итерацией, обязан был бы упасть, если бы `at`/`asOf` появились без читателя. Он проверен на этом изменении и остался зелёным на базлайне 66 — то есть новые поля прочитаны продуктом, а не только пробой.

### 2026-09-10 · AX-05 (остаток) · забор для самого повторяющегося дефекта цикла — и он поймал свой же случай только со второй попытки

- **Symptom:** `Focus.returnTo` записывается при КАЖДОЙ навигации, над ним комментарий, объясняющий, зачем он нужен («„Назад“, приводящее на домашнюю вместо поиска, который дал попадание, заставляет оператора набирать запрос дважды»), — и его не читает НИЧТО. Никакого «Назад» в продукте нет.
- **И это ПЯТЫЙ случай одной формы за тридцать восемь итераций:** линтер, которого никто не запускал (UX28-15); ревизия, которую не несла ни одна команда (UX28-11); расписка, которую единственный вызывающий выбрасывал (UX28-12); две колонки, выбранные запросом и отброшенные до вызова (AX-02); и обратный маршрут без «Назад» (здесь).
- **Почему это хуже отсутствующей функции:** отсутствующая функция объявляет себя сама. Поле с именем, типом и абзацем обоснования читается как возможность всеми ниже по течению — включая следующего автора, который на нём строит.
- **Surfaced at:** stage 0. После четвёртого случая я сказал, что если встретится пятый — предложу забор. Встретился.
- **Fix, by grade:** `scripts/check-written-never-read.mjs` — 1163 объявленных поля в общих контрактах, для каждого вопрос «читает ли это хоть что-нибудь» (structural); «назад» получило читателя, а происхождение вынесено в состояние оболочки, потому что фокус ПОТРЕБЛЯЕТСЯ и `returnTo` исчезал раньше, чем оператор приходил (structural); осознанный переход очищает происхождение, иначе «Назад» переживает три вкладки и указывает на место, которое оператор забыл выбирать, — то самое «наваждение», о котором предупреждает шапка `appRoute.ts` (mechanical).
- **Забор поймал свой же мотивирующий случай только СО ВТОРОЙ ПОПЫТКИ.** Первая версия считала ТЕСТ читателем: `appRoute.test.ts` проверяет `focus.returnTo`, то есть единственным потребителем поля было утверждение, что его записали, — и забор его пропустил. Это дословно находка M113: «ничего не ломается, ничего не бросает, и юнит-тест на читателе остаётся зелёным». После исключения тестов счёт вырос с 29 до 66.
- **R-005 изменило конструкцию, а не подтвердило её.** M113 уже встречал этот класс и построил СИЛЬНУЮ форму проверки: `halfShipped.test.tsx` утверждает, что конкретные ЧИСЛА доходят до экрана, «потому что доска — это то, по чему кто-то действует». Это по-числу и осознанно. Поэтому новый забор назван в шапке своего базлайна широким и дешёвым ДОПОЛНЕНИЕМ, а не заменой.
- **И это РАТЧЕТ, а не стена.** Забор, приезжающий красным на 66 существующих записях, — это забор, который кто-то выключит. Механизм взят тот, что в репозитории уже есть для переводов: базлайн может только УМЕНЬШАТЬСЯ. Новое непрочитанное поле валит; запись базлайна, у которой ПОЯВИЛСЯ читатель, валит, пока её не вычеркнут (иначе долг читался бы уплаченным, пока растёт); запись про поле, которого больше нет, валит как устаревшая строка, притворяющаяся долгом. Обе валящие ветки подсажены.
- **И я правил файл, который правит другой прогон, — сознательно и аккуратно.** `scripts/ci.sh` несёт их незакоммиченный шаг, поэтому мой хунк извлечён и застажен отдельно через `git apply --cached`. Не застажить его значило бы оставить новый забор неподключённым — ровно тот дефект, для которого он и построен, совершённый рукой, его построившей.
- **Check that catches it next time:** `scripts/check-written-never-read.mjs` в `ci.sh` плюс `scripts/written-never-read-baseline.txt` (66 записей, только вниз), и `appRoute.test.ts#returnableTo`.

### 2026-09-10 · AX-05 · черновик, который не переживал закрытие окна, и проба, поймавшая мою собственную правку

- **Первым действием была проверка аренд, и она изменила весь прогон.** Все охраняемые реестры держал прогон `r-a04c79b93`, продолжавший обновлять аренды, — значит stage 10 закрыть было нельзя. Поэтому сначала код и пробы, а запись — когда три реестра из четырёх освободились. Реестр переносов не освободился, поэтому две отложенные части записаны строками экспозиции, которые НАЗЫВАЮТ реестр занятым и передают id следующему прогону: отложенное без дома лучше сказать, чем молча потерять.
- **Symptom:** черновик онбординга жил в `useState` в `App.tsx`. Оператор, наполовину описавший проект — название, назначение, выбранные репозитории, — терял всё при закрытии окна.
- **И `shared/tabs.ts` ЗНАЛ об этом,** что и есть самая интересная часть. Он отказывался восстанавливать вкладку черновика, объясняя: «выход забирает его содержимое, что бы этот файл ни делал. Восстановить вкладку без содержимого — значит показать пустую форму, называющую себя черновиком оператора». То есть продукт верно рассуждал о потере, которую не мог предотвратить, и выбрал честную половину плохой пары: скрыть вкладку, а не лгать о ней.
- **Owned by:** тем прогоном, который сделал черновик достоянием памяти рендерера. Убрать потерю — и вторая половина (восстановление вкладки) становится честной, а не утверждением поверх пустоты.
- **Fix, by grade:** `shared/onboardingDraft.ts` — форма, строгий валидатор и правило «что стоит хранить» (structural); `main/onboardingDrafts.ts` — модуль над инъектируемым стором, БЕЗ импорта electron (structural); IPC с ТРЕМЯ ответами чтения (structural); `tabs.ts` восстанавливает черновики по одному правилу с проектами, читая и старую форму файла (structural); пять рукописных копий сохраняемой формы свёрнуты в одну (R-005).
- **ПРОБА ПОЙМАЛА МОЙ КОД РАНЬШЕ ЛЮБОЙ ПОДСАДКИ, и это результат, который я оставил бы, если бы можно было оставить один.** Эффект гидратации вызывал `setDraftsLoaded(true)` всякий раз, когда промис разрешался, — включая случай, когда чтение ПРОВАЛИЛОСЬ. Значит следующий эффект записывал пустой набор поверх черновика оператора: ровно та потеря, которую карточка убирает, воспроизведённая её же починкой. Комментарий прямо над кодом утверждал обратное. Корень — мой собственный контракт: полезная нагрузка плюс строка проблемы это ДВА состояния там, где их три, и `recovered` (годен, и запись обратно ЧИНИТ файл) с `unreadable` (значение по умолчанию вместо непрочитанного) было не различить.
- **Подсадка, оставившая зелёное, — находка в четвёртый раз за цикл.** Снятие фильтра «что стоит хранить» не сломало НИ ОДНОЙ пробы, потому что модуль вообще нельзя было запустить: он импортировал `localStore`, а тот — `app` из electron, и node-проба падала на ЗАГРУЗКЕ МОДУЛЯ. Фильтр был покрыт только как чистая функция, которую никто не показал вызванной, — та самая подмена, которую карточка AX-02 называет в своих исключениях. Привязка к Electron ушла в `main/index.ts`, стор приходит аргументом.
- **Одно утверждение карточки оказалось УЖЕ ЗАКРЫТЫМ, причём этим же циклом.** «TaskPage load has no generation guard» было верно на `d28c321`, а `git log -S` называет коммит, добавивший защиту: `39929c4`, UX28-01. Снимок аудита стареет, пока цикл, читающий его, работает.
- **Отложено намеренно, с измерениями:** канонический адрес сущности и ревизии в `AppRoute` (его ждут AX-03, AX-04 и AX-06 — так говорит `depends_on` самой AX-05) и фокус на сущности вместо прокрутки секции в `evidence.ts#reveal`. Причина одна: вторая половина карточки — сохранность данных, а это первая ось приоритета оператора; достраивать маршрут под карточкой про черновики значило бы построить его наполовину.
- **Check that catches it next time:** `apps/desktop/test/onboarding-drafts.test.mjs` (11 утверждений через инъектированный стор), `src/renderer/src/onboardingDraft.persist.test.tsx` (четыре случая через оболочку, включая тот, который поймал меня), `src/shared/onboardingDraft.test.ts` и обновлённые `tabs.test.ts` / `appSettings.test.ts`, где прежние случаи СОХРАНЕНЫ как тесты миграции.

### 2026-09-10 · AX-02 · одна производная, два вызывающих, пять разных ответов — и три подсадки, нашедшие дефекты в моих проверках

- **Symptom:** `deriveLiveness` аккуратна и верна, а ОБА её вызывающих строили её вход литералом — значит каждый сам решал, что подставить там, где ответа у него нет, и решили они по-разному. Наблюдатель классифицировал разрыв наблюдения и читал `session.oriented@1`; читатель виджета не передавал разрыв ВООБЩЕ и подставлял `orientedAt: null` на каждом вызове, а цель ожидания выбирал из `session_heartbeats` и выбрасывал до вызова производной.
- **Измерено на ОДНОЙ свежей, ориентированной, бьющейся сессии:** наблюдатель ответил `working` при полном покрытии, виджет — `stalled` при полном покрытии. Здоровый агент, показанный оператору как сломанный, поданный как уверенность, с причиной «Fabric has no record of it reading its rules» — про запись, которая существовала и которую этот читатель не спрашивал.
- **Surfaced at:** stage 0, чтением двух мест вызова рядом. Карточка сама говорит: «reproduced pure-function divergence».
- **Owned by:** stage 3 того прогона, который построил производную и оставил сборку входа на усмотрение вызывающих.
- **Root cause, и он в ТИПЕ:** `classifyOrientation` принимает три значения одного поля и трактует `null` и `undefined` одинаково — значит «записи об ориентации нет» и «ориентацию никто не читал» были одним значением с двумя смыслами, и виджет говорил тревожное каждый раз. Починка — ТРЕТИЙ ОТВЕТ, а не более аккуратный вызывающий: `livenessInputFrom` принимает размеченные объединения, поэтому читатель без ответа обязан сказать это и не может подставить null, читающийся как измерение.
- **Одна обёртка вместо восьми правок.** Производная — цепочка из восьми возвратов, каждый со своим `coverage`; править все восемь работало бы до девятого. Обёртка понижает только `available`, потому что `unsupported` и `unobserved` уже говорят, что ответ частичный, и перезапись потеряла бы, какая именно часть.
- **ТРИ подсадки из девяти нашли дефекты в моих проверках, а не в коде.**
- **Первая:** подсадка дала ОДНО падение там, где ожидались два — так я обнаружил, что два случая дописаны НИЖЕ блока `process.exit`: они исполнялись после вердикта, их падения не считались, процесс выходил нулём, и треть пробы не могла уронить прогон. Проверка, которая не может упасть, — не проверка.
- **Вторая:** подсадка оставила зелёное, потому что поддельный стор возвращал строку целиком, какие бы колонки ни просил запрос. **Подделка щедрее базы не может увидеть колонку, которую никто не запросил** — то есть ровно тот дефект, о котором эта карточка, воспроизведённый внутри её же теста.
- **Третья:** подсадка оставила зелёное, потому что разрыв наблюдения был ПАРАМЕТРОМ сервиса чтения — пропуск жил в вызывающем, а сервис получал лишь то, что ему дали. Лекарство — сделать забывание невозможным, а не добавить случай: сервис принимает обязательное окно хоста и классифицирует разрыв сам. Окно хоста при этом поднято выше обработчиков — оно лежало ниже них, и именно поэтому виджет не мог до него дотянуться.
- **И моя собственная ошибка повторила форму предыдущей итерации:** я поверил запросу вместо того, что он выбирает. Первый вариант чтения ориентации забирал ВСЕ `session.oriented@1` в хозяйстве — 121 штуку — и спрашивал, не ноль ли счёт: значит сообщил бы «ориентирована» про сессию, потому что ориентирована была ДРУГАЯ. Ответ выглядел правильным и был ни о ком.
- **Fix, by grade:** `shared/livenessInput.ts` — одна сборка на двух вызывающих (structural); третий ответ ориентации и обёртка покрытия (structural); `main/livenessRead.ts` — чтение виджета с обязательным окном хоста и собственной классификацией разрыва (structural); цель ожидания выбирается и доезжает до производной и до поверхности, а её разрешение читается оттуда, где живёт — `answered_at` вопроса (structural); `blockers` стал явным неизвестным вместо нуля (structural); свежесть виджета — от ограниченного тика, а не от печати терминала, с показом ВОЗРАСТА снимка (structural).
- **Check that catches it next time:** `apps/desktop/test/liveness-callers.test.mjs` (27 утверждений, оба вызывающих, вердикт последним) и `AgentTile.test.tsx` (пять случаев на фальшивых часах).

### 2026-09-10 · UX28-14 · карточка, чью приёмку нельзя выполнить машиной, и четыре числа, которым я поверил вместо того, что они описывают

- **Symptom:** приёмка требует прохода по потокам с клавиатуры, а потом со СКРИНРИДЕРОМ, на трёх ширинах и при 200% зуме, со скриншотами и DOM-квитанциями. Исключение карточки запрещает ровно то, что я мог бы подделать: «no accessibility PASS from static CSS, jsdom, axe alone».
- **Surfaced at:** stage 0, чтением исключений раньше шагов. И положительная приёмка сама разрешает честный ответ: «observed result **или precise blocked reason**».
- **Owned by:** никем — это не дефект, а свойство карточки. Наблюдателя, которого она требует, у прогона нет.
- **Precise blocked reason:** у jsdom нет раскладки — он не считает грид, не применяет media query и возвращает ноль на любое измерение; «скринридер сообщает об ошибке» — утверждение о том, что произносит VoiceOver; контраст — отношение отрисованных пикселей. Это не ограничение, которое надо обойти, это и есть находка: **приёмка этой карточки требует человеческой сессии, и честная поставка — сделать эту сессию дешёвой, повторяемой и трудной для подделки.** CO-160.
- **И то, что построить было можно, нашло настоящие дефекты.** `.project-columns` объявлял ДВА трека, а `EstateAgents` кладёт в него ТРИ ребёнка: список сессий забирал широкий `1.6fr`, консоль — узкий, третья панель уезжала во вторую строку. Это названная цель карточки — и моё же изменение UX28-13 поставило терминал в узкую колонку. `.board` был `repeat(4, minmax(0, 1fr))`, а в `components.css` НЕТ НИ ОДНОГО media query: около 93 css-пикселей на колонку при целевых 375, на любой ширине, и жёсткая четвёрка рядом со списком колонок, который строится из данных. И три из тридцати трёх полей ввода не имели доступного имени; показательное — селектор перемещения на карточке задачи, чей placeholder-ОПЦИЯ описывает контрол, только пока ничего не выбрано, потому что скринридер произносит ЗНАЧЕНИЕ. Имя — не значение.
- **`col-main` и `col-side` не имеют правил ни в одном стайлшите.** Размещение позиционное, поэтому `ProjectHome` верен СЛУЧАЙНО: порядок его детей совпал с именами его классов. Записано, а не переименовано — имена это комментарий, а дефект в арности.
- **Две подсадки из шести нашли дефекты в САМИХ заборах, а не в продукте.** Счётчик треков сообщил «1 fixed track» про `repeat(4, minmax(0, 1fr))`, потому что не разворачивал `repeat`. А забор имён матчил JSX-тег до первого `>`, который содержится в инлайновом стрелочном обработчике, — поэтому два контрола, чей `aria-label` стоял ПОСЛЕ обработчика, читались как безымянные. Оба вердикта были **верны случайно**: контролы действительно были безымянными, доска действительно была фиксированной, — то есть ничего не падало из того, что должно было пройти, и оба забора соврали бы на следующем случае. Забор, печатающий неверное число, — это забор, которому следующий читатель перестаёт верить.
- **Три моих ошибки поймала ПРОВЕРКА, а не подсчёт, и у них одна природа: я верил числу вместо того, что оно описывает.** Квитанция сказала «четыре задачи» — и все четыре стояли в `backlog`, потому что payload перемещения называл задачу `id`, а проектор читает `task_id`. Квитанция сказала «journal head 123537» — эта последовательность принадлежит ДРУГОМУ хозяйству и не изменилась за прогон, добавивший восемь событий. Первая перепись безымянных контролов сказала «пять» — два совпадения были `<select>`, написанным ПРОЗОЙ, одно из них в шапке того самого компонента, который решает эту задачу. Четвёртую поймал счёт колонок реестра: литеральный `|` внутри grep-альтернации, то есть ловушка FA-05, второй раз за цикл дошедшая до моих рук.
- **Fix, by grade:** трёхтрековый шаблон для экрана агентов и коллапс для обоих (structural); `.board` переведён на `auto-fit`, что отвечает и на ширину, и на связь с числом колонок (structural); три контрола названы через `t(...)`, потому что `check-design.mjs` требует переводимых значений (mechanical); два забора добавлены в `ci.sh`, каждый со своей шапкой о том, чем он НЕ является (structural); фикстура прохода журналируется через `append_event` на фиксированных id, идемпотентно (structural).
- **И тир был КРАСНЫМ на этом коммите, и это записано, а не обойдено.** Две пробы падают на `rebuild_estate_projections` с `57014`: разделяемое служебное хозяйство `…00ff` держит 123 790 событий, все датированы сегодняшним днём, 77 999 из них `routine.paused@1` — их пишет модуль, которого эта карточка не касается, через десять проб, делящих один жёстко прописанный id и не убирающих за собой. Перестройка стоит 7.56 с при `statement_timeout=8s` у роли, поэтому она проходит в одиночку и падает под нагрузкой. Каждый прогон добавляет ~27 событий, запас исчерпан. **Удаление, которое сделало бы число зелёным, я проверил ВНУТРИ транзакции и откатил:** забор, позеленевший от вычистки append-only журнала, — это ровно та подмена, которую цикл отказывался принимать тридцать пять итераций. Остальные пробы проверены по одной и зелёные; собственные доказательства карточки зелёные. CO-161 несёт диагноз и три кандидата, и выбор за оператором, потому что один из них трогает позвоночник.
- **Check that catches it next time:** `check-grid-arity.mjs` (треки против детей и коллапс на узких ширинах) и `check-control-names.mjs` (контрол, которого скринридер не может представить). Оба заявляют в своих шапках, что не являются проверкой доступности, — потому что это и есть исключение карточки, а забор, притворяющийся большим, чем он есть, хуже отсутствующего.

### 2026-09-10 · UX28-13 · снимок вместо сессии, и две подсадки, оставившие зелёное там, где охраняли одно и то же

- **Symptom:** середина SCR-39 держала `decodePty(agent.excerpt)` — хвост, который несёт каждый листинг сессий, снятый тем опросом, который случился последним. Он честно ПОДПИСАН как устаревший, поэтому ложью это не было; это просто была не сессия. Значит шаг 5 сценария SCN-049 («Operator types into the console -> the agent receives it without the session moving to another window») было некуда исполнять: печатать было не во что.
- **Surfaced at:** stage 0, чтением сценария до кода. SCN-049 описал ВСЁ это в день, когда был написан: ожидающие наверху, живая консоль в центре, задача в шапке, законченная сессия с кодом выхода, и «ответ, пришедший для агента, которого оператор покинул, отбрасывается».
- **Owned by:** stage 3 того прогона, который построил `TerminalView` для собственного окна и оставил экран estate со снимком.
- **Root cause:** компонент существовал и использовался ровно в одном месте. Экран, которому он был нужен, получил вместо него поле, которое честно предупреждало, что оно не то.
- **Одиннадцатый раз за цикл сценарий был прав. Но документ оказался не просто устаревшим — он СПОРИЛ С СОБОЙ.** Запись SCR-39 в `screens.md` в одной строке состояний говорила, что центр «does not update as the agent runs», а её же строка Elements обещала «the selected agent's live console with its input», и в таблице состояний стоял `detached` — для консоли, которая НЕ СМОГЛА подключиться. У экрана, чей центр никогда не подключается, нет состояния «не смог подключиться». Это хуже устаревания: какую половину читатель ни выбрал бы, он мог сослаться на документ. Устаревшая, но связная запись объявляет себя сама; эта — нет.
- **Две подсадки из восьми оставили зелёное, и обе оказались находками.**
- **Первая:** сортировка на месте (`sessions.sort` вместо `[...sessions].sort`) не сломала ни одного из тридцати девяти рендерных случаев — каждый передаёт свежий литерал массива и больше в него не смотрит. В продукте этот массив — состояние родителя, разделённое с `Workspace`, который рисует те же сессии в своём порядке: сортировка на месте переупорядочивает чужой список и мутирует состояние, про которое React сказали, что оно неизменяемо. Теперь чистая проба утверждает, что вход не тронут и порядок ПОЛНЫЙ.
- **Вторая, и она важнее:** чтение сырого состояния вместо `forSubject` тоже оставило зелёное. Эффект, сбрасывающий чтение в `pending` при смене субъекта, закрывает случай переключения сам — значит два забора охраняли ОДИН случай, и ни один из них не был несущим ни в одной пробе. Решает же случай ПОЗДНЕГО ответа — того, что приходит для агента, которого оператор уже покинул, — и его утверждал только юнит-тест `keyedRead`. Теперь проба гонит его через настоящую панель, и снятие защиты внутри `settled` валит обе.
- **Fix, by grade:** `TerminalView` подключён для живой сессии, ключуясь по `sessionId` (structural — один рендерер, размещённый дважды, а не второй); `focusOnMount` сделан opt-OUT, чтобы встроенная панель не забирала каретку у списка, по которому оператор идёт стрелками (structural); порядок вынесен в `shared/sessionOrder.ts` и переиспользует правило `attention.ts` (structural); код выхода показан у законченной сессии (mechanical); задача в шапке — третье независимо ключёванное чтение, приходящее внутри `ReadEnvelope`, так что два слоя говорят разное: ключ — ЧЕЙ это ответ, конверт — НАСКОЛЬКО это ответ (structural); история следует тем же часам, что состояние репозитория, и немедленно при завершении сессии, потому что это событие ПРИХОДИТ (mechanical).
- **Две незапланированные правки тестовой инфраструктуры, обе вызваны моим изменением и обе записаны.** `ResizeObserver` ушёл в `test/jsdom-gaps.ts`: без него эффект падал, React разворачивал дерево, и ШЕСТЬ утверждений в двух соседних пробах падали против пустого body с сообщениями про совсем другие чтения — причина в трёх файлах от симптома. Этот файл существует ровно для такого и в своей шапке объясняет, почему заглушка внутри одной пробы — это заглушка, которую следующий автор не найдёт; я написал свою внутри своей пробы прежде, чем прочитал шапку. И `stubFabric` теперь сливает пространство имён на один уровень: подмена `terminal` целиком удаляла `onData`, и падало утверждение про строку отказа истории.
- **Check that catches it next time:** `EstateAgents.terminal.test.tsx` (16 случаев: подключение, окно полёта, утечка слушателя, `terminal.end` при размонтировании, отказ replay, порядок, задача в шапке, поздний ответ) и `shared/sessionOrder.test.ts` (порядок полный, вход не тронут).
- **CO-159:** действие «завершить сессию» и контрол запуска названы двумя реестрами и не построены ни одним. Завершение РАЗРУШИТЕЛЬНО, а на этом экране нет идиомы подтверждения — кнопка, убивающая работу агента, рядом со списком, по которому щёлкают для переключения, в один промах уносит то, что нечем восстановить. Оставлено намеренно, а не забыто.

### 2026-09-10 · UX28-12 · расписка, которую M168 сделал нарочно, и единственный вызывающий, который её выбрасывал

- **Symptom:** `proposals.decide` возвращал `void`, и M168 изменил это НАМЕРЕННО — контракт в `shared/types.ts` говорит это своими словами: «отказу было некуда деться, и единственным способом сказать нет было бросить исключение… теперь он несёт расписку проверяющего: код причины, что с этим делать, и может ли повторная попытка вообще сработать». `AttentionPanel` вызывал его как `void … .catch(onError)`. `decideProposal` отвечает `ok: false` в ЧЕТЫРЁХ местах и ни из одного не бросает — значит `.catch` не срабатывал никогда, и отказ был невидим.
- **Отказанное принятие выглядело в точности как успешное:** на экране не происходило ничего. Это отрицательная приёмка карточки — «advice cannot be shown as committed artifact» — с другой стороны: оператор верит, что задача создана, потому что отказ не показан. И `taskId` выбрасывался тоже, так что оператор не узнавал, что именно создало принятие.
- **И строка оставалась решаемой.** Очередь перечитывается по 15-секундному таймеру и НЕ перечитывалась по решению, поэтому оба действия жили на уже решённом предложении до пятнадцати секунд; второй клик отказывался с `already_decided` тем самым revalidate-ом, который существует ровно для этой гонки, — и тот отказ выбрасывался так же.
- **Surfaced at:** stage 0, чтением карточки против реестра: восемь её зависимостей (M153, M158, M166, M167, M169, M171, M175, M194) — строки из четырёх колонок без прозы `shipped`, тогда как у любой поставленной вехи в строке дата и рассказ. Положительную приёмку строить было не на чем, и собственное исключение карточки это запрещает.
- **Owned by:** stage 3 того прогона, который расширил контракт и не изменил единственного вызывающего. Расширить ответ и не прочитать его — это половина работы, выглядящая как целая.
- **Root cause:** контракт и его потребитель меняются в разных изменениях. M168 сделал отказ выразимым; никто не сделал его видимым.
- **Пятый раз за цикл карточка просит поверхность, чьих продюсеров нет.** Диспозиция та же, что у UX28-08/CO-156: недоставленное уходит строкой с измерением, а не наполовину построенным. Заведено CO-158.
- **Забор вместо строки экспозиции.** Отрицательные приёмки про модель («model verdict cannot grant authority», «no-provider path makes no hidden paid call») выполняются ПУСТО: в `apps/desktop/src` вообще нет вызова модели, а `judge()` — чистая детерминированная функция. Пустая истина стоит забора, а не записи: `check-no-hidden-model-call.mjs` откажет в день, когда вызов появится, и назовёт роутер, через который он должен был пойти. Разрешение одно и сматчено по ТОЧНОМУ URL, а не по хосту — подсадка того же хоста в тот же модуль ловится.
- **Первый раз за цикл сценарий оказался ВПЕРЕДИ кода, а не позади.** SCN-011 описывает SCR-11, предпросмотр резолюции и `supersede`, которых нет; но его Errors & recovery («already-resolved proposal shows the existing resolution and disables duplicate action») описывает ровно то, что было сломано. Правильный ответ — не «правь код» и не «правь документ», а «сохрани оба и скажи, какая половина какая»: Coverage теперь называет покрытую половину и перечисляет непокрытое.
- **Fix, by grade:** решение хранит ответ, КЛЮЧУЯ его предложением (structural — очередь держит несколько, и один общий слот печатает отказ строки A под строкой B); принятое называет созданную задачу, отказ показывает `says` и `remedy`; действие снимается по СОБСТВЕННОМУ решению панели, а не по исчезновению строки, потому что read-your-own-write через проектор не мгновенный (structural); `disabled` в полёте (mechanical); повторное чтение очереди по решению (mechanical); `DecideOutcome` свёрнут на `ProposalDecideResult` (R-005).
- **Check that catches it next time:** `AttentionPanel.test.tsx` — восемь случаев, из них два про то, чего раньше не наблюдал никто: окно полёта и КЛЮЧЕВАНИЕ ответа. Плюс `check-no-hidden-model-call.mjs` в `ci.sh`.
- **И меня поймало правило, которое я сам починил итерацию назад:** в поправке к SCN-011 я сослался на `apps/desktop/test/proposals.test.mjs` — правдоподобное имя файла, которого нет. Через один прогон после того, как разрешил 37 украшательских цитат руками. Проба поймала и свою фикстуру: первая версия искала кнопки «Accept» и «Decline», а продукт говорит «Make it a task» и «Let it end», поэтому все шесть случаев падали против панели, которая ни разу не отрисовала строку.

### 2026-09-10 · UX28-11 · две записи под одним catch, черновик, который стирал фоновый агент, и две подсадки, оказавшиеся находками

- **Symptom:** панель настроек проекта посылала ДВЕ команды на одно нажатие одной кнопки — `projects.update`, затем условно `projects.updateSettings` — внутри одного `try` с одним `catch`. Ревизия с миграции 37 ЕСТЬ последовательность события, её установившего, поэтому одно сохранение давало две ревизии; а когда падала вторая, первая уже была в журнале и в проекции, и оператору сообщалось, что сохранить не удалось.
- **И потеря данных, которая в приоритете оператора стоит первой.** Эффект сброса шёл по `[project.id, project.config_revision]` и копировал пропсы поверх всех полей: фоновый агент, меняющий конфигурацию этого проекта, ЗАМЕНЯЛ недописанное назначение сохранённым. Ни баннера, ни отмены, ни следа. Воспроизведено ДО правки: `Unable to find an element with the display value: half a sentence I am still`.
- **Surfaced at:** stage 0, чтением подписей до кода: `UpdateProjectInput` и вход `updateSettings` не несут `config_revision` — значит устаревшую базу нечем отказать, и это не дефект реализации, а невыразимость в подписи.
- **Owned by:** stage 3 (contracts). Обе команды честно делают то, что объявляют; неверно объявлено, что сохранение настроек — это два независимых факта.
- **Root cause:** «сохранить настройки» моделировалось как «обновить строку», а не как «записать одну ревизию». Строку можно обновлять по частям, ревизию — нельзя.
- **Девятая карточка цикла, где сценарий был прав.** SCN-028 своим разделом Errors & recovery обещает ровно обратное наблюдаемому: «a failed append surfaces the error banner and leaves the header unchanged», а SCN-003 и SCN-004 давно называют правило для конфликта — «shows the newer diff and asks the operator to reapply the draft», «the project draft remains intact».
- **Пять исходов, и это не украшение подписи.** Один атомарный append УБИРАЕТ полусохранённый случай по построению, а не отчитывается о нём лучше. Остаётся возможным другое: append лёг, а перечитать строку не удалось — и назвать это `failed` значило бы показать записанный факт как ничто, то есть тот же дефект цикла (отказанное чтение как уверенный ответ) со стороны записи. Это `written`. Первая форма моей пробы утверждала частичную фиксацию из двухкомандного мира — архитектура поправила пробу, а не наоборот.
- **Две подсадки из семи оказались НАХОДКАМИ, а не подтверждениями.** Подсадка в `landed` оставила рендерную пробу ЗЕЛЁНОЙ: проба утверждала ФРАЗЫ панели, а они одинаковы в обеих ветках; `landed` решает СОСТОЯНИЕ — закроется ли форма и перечитается ли проекция, — и ни то, ни другое не наблюдалось. Подсадка в guard чтения тоже оставила зелёное: у отказанного чтения `data: null`, и guard отсутствующего проекта уже отвечает `failed` с нулём appendов — значит тот guard несущий для ПРИЧИНЫ, а не для статуса, и «этого проекта нет в этом хозяйстве» про обрыв связи посылает оператора починить не то. Обе проверки усилены и переподсажены прежде, чем им поверили.
- **R-005 сработало, и компилятор поймал то, чего не поймал мой grep.** Я искал ФОРМУ — `committed`, `conflict`, `stale` — нашёл `LocalWrite`, свернул в `shared/casWrite.ts`. И тут же назвал свой результат `SettingsWrite`, ни разу не грепнув это ИМЯ: такой тип уже был в `shared/types.ts` для локального файла настроек приложения. Правило говорит «грепнуть имя», а я грепнул понятие.
- **Исключение карточки закрыто структурно, а не проверкой.** У новой руки проектора нет присваивания `repo_path`, у `payloadOf` нет такого ключа, а `repoPath` удалён из `UpdateProjectInput` — измерено, что у него НЕТ ни одного вызывающего: дверь ровно в то, что карточка запрещает, которую никто не держал открытой.
- **Прополка вскрыла свою же слепоту.** Колонка `Last fired` у R-002 стояла на 2026-08-31, хотя R-002 срабатывало и в UX28-02, и в этом прогоне: триггер снятия («не применялось пять штампов») читает колонку, которую никто не обновляет, тогда как штампы, где срабатывание записано, обновляются всегда. Снять R-002 по слову этой колонки значило бы удалить правило, срабатывающее почти каждый прогон. Колонка обновлена для R-002, R-005, R-006, R-007; ничего не снято, удалять нечего.
- **Fix, by grade:** одна команда `projects.saveSettings` с `baseRevision` и compare-and-set ПЕРЕД append (structural — журнал не может отказать факту, который уже записал, поэтому проверка живёт на приёме, а не в руке проектора); `project.configured@1` с рукой проектора, строкой `event_types` и двуязычной фразой ленты (mechanical); сброс формы по СУБЪЕКТУ, а сдвинувшаяся ревизия под грязным черновиком сообщается и не меняет ничего (structural); уведомление рендерится и в read-only заголовке, потому что `written` закрывает форму, а его оговорка принадлежит значениям, которые она делает сомнительными (найдено пробой).
- **Check that catches it next time:** `apps/desktop/test/project-settings.test.mjs` — каждый случай утверждает КОЛИЧЕСТВО appendов рядом с ответом, потому что команда, отказавшая и всё равно записавшая, отказалась только на словах; `ProjectHeader.test.tsx` утверждает ПЕРЕХОД, а не только текст. И проба зарегистрирована в раннере: из 50 проб в `apps/desktop/test` 49 были названы каким-нибудь заборам, а не названа была моя, возрастом в минуты — итерация после UX28-15 и та же форма моей же рукой.
- **CO-157:** тот же сжатый до двух исходов ответ стоит на соседней поверхности — `settings.write` отдаёт `{ settings, saved, reason? }` поверх трёхрукого `writeLocal`, поэтому конфликт приходит в `SettingsBar` как отказ. Заведено, а не вкручено: что панель настроек должна ДЕЛАТЬ с конфликтом — вопрос сценария, а его нет.

### 2026-09-10 · UX28-15 · линтер, который семь итераций знал ответ и которого никто не запускал

- **Symptom:** `docs/ux/lint.py` проверяет, ссылается ли Coverage на существующий файл, входит ли Status в объявленную четвёрку и есть ли у каждого сценария строка индекса. Его не запускал **ни один** забор: ни `ci.sh`, ни `check-docs.sh` — только `docs/brand/lint.py`.
- **Surfaced at:** stage 0, при попытке измерить «lint warning causes» из приёмки карточки: пришлось запускать линтер руками, и это и был ответ.
- **Owned by:** тем прогоном, который добавил линтер и не подключил его. Инструмент без вызывающего — это не инструмент, а файл.
- **Root cause, и он про этот цикл, а не про файл:** **семь итераций подряд я находил РУКАМИ ровно тот класс дефектов, который этот линтер задаёт вопросами.** Сценарий прав, код нет; цитата, которую никто не разрешает; статус, который никто не проверяет. Всё это время проверка лежала в дереве, верная и невызванная. Стоимость не в 41 предупреждении — стоимость в том, что каждую находку приходилось делать чтением.
- **И он поймал меня в тот же момент, как был подключён.** Я написал `Status: external` для SCN-038; линтер отказал: «нераспознанный статус читается как отсутствие статуса, и каждое правило, завязанное на него, молча перестаёт применяться». Это правило оператора (Status is a vocabulary token; caveats belong in Coverage), которое я знал словами и нарушил через двадцать минут после того, как получил его снова. **Правило в промпте — не привычка; исполняет забор.** Второй раз за три итерации с тем же выводом.
- **37 цитат были украшением, и линтер не мог их увидеть.** Его правило `unfalsifiable` срабатывает, только когда НИ ОДНА цитата в поле не разрешается. Поэтому один настоящий путь рядом с пятью голыми базовыми именами проходил, а имена не проверял никто. **Я перенял эту привычку у файла и продолжал её весь цикл сам** — то есть проверка была слепа именно к тому, что я в неё добавлял.
- **Fix, by grade:** линтер подключён, ошибки валят (mechanical) — это единственное изменение, которое делает всё остальное устойчивым; 37 цитат разрешены в единственный настоящий путь, каждая проверена на однозначность против `git ls-files` (evidence); 14 строк индекса добавлены из полей самих сценариев (evidence).
- **U003 остаётся предупреждением, и это РЕШЕНИЕ, проверенное, а не предположенное.** `sync-product-ux.mjs` строит модель из ТЕЛ разделов, значит реестр — это `product-model.json`, а индекс — удобство для чтения. Повышать серьёзность чужого инструмента на документационной карточке было бы превышением; записать причину — нет.
- **И впервые за восемь итераций разрыв оказался на другой стороне.** SCN-028 описывал свободно вводимый путь к репозиторию — код был прав всё время. Это стоит записать отдельно, потому что семь совпадений в одну сторону начинают читаться как закон, а закон бы сказал «правь код». Правило остаётся симметричным: **читать сценарий до кода, а потом решать, какая сторона стареющая.**
- **Порядок взят из карточки, а не из очереди.** UX28-11 объявляет UX28-15 зависимостью исполнения, и её шаг 4 просит согласование, которое решает эта карточка. Сделать 11 первой значило бы угадать или сделать дважды — и это сказано вслух, а не переставлено молча.

### 2026-09-10 · UX28-10 · подпись, делавшая предел невыразимым, и тип, объявленный дважды

- **Symptom:** предела в пять избранных не было, порога в шесть проектов не было, вопроса «какой освободить» не задавали, а пропавшее избранное исчезало молча. Все четыре описаны в SCN-043 с того дня, как он написан.
- **Surfaced at:** stage 0, из сценария. Правило «читать сценарий поверхности до кода» отработало седьмой раз подряд.
- **Owned by:** stage 3 работы M120 — и не как забывчивость.
- **Root cause: подпись функции делала предел невыразимым.** `togglePin(favourites, id): string[]` умеет вернуть только список. Значит «это был бы шестой» негде сказать, и предел неизбежно оказался бы в UI — то есть в каждом месте вызова по отдельности, где его однажды забудут. **Дефект был в типе возврата, а не в пропущенном `if`.** Результат вместо массива заставляет каждого вызывающего посмотреть, что произошло, потому что списка, за который можно схватиться не глядя, больше нет.
- **И `at-limit` — ни отказ, ни успех.** Ничего не записано, ничего не сброшено. Свернуть это в `saved: false` значило бы сообщать про полный диск и про полный список избранного одной фразой — а действовать оператор может только по одной из них. Третий раз за цикл, когда правильным ответом оказалось **третье состояние**, а не выбор из двух (не прочитано/пусто/отказ; целое/обрезано/никто не считал; и вот это).
- **Fix, by grade:** предел и порог — числа в контракте (structural); `togglePin` возвращает результат (structural); замена — одна запись с compare-and-swap по ревизии (structural); пропущенное избранное названо и остаётся закреплённым (evidence).
- **Порог подтверждён как СУЖДЕНИЕ, а не измерение.** Карточка прямо просила проверить, в силе ли он. Аргумент сценария стоит сам, но наблюдения оператора с шестью проектами нет — и это записано именно так, потому что «подтверждено» без указания, чем именно, через месяц читается как «измерено».
- **Моя реализация спорила с моей же проверкой, и права была проверка.** Я поставил новый пин на МЕСТО освобождённого, аргументируя сохранением расстановки. Верно другое: освободить один и добавить другой — это и есть изменение расстановки; замена это всё ещё закрепление; **согласованность с правилом, которое оператор уже выучил, сильнее аргумента, который я только что придумал.**
- **И тип был объявлен дважды — ровно случай R-005.** `PinResult` жил в `shared/types.ts` и в `main/favourites.ts`: комментарии в main, три голых поля в shared. Я расширил main — и оставил рендерер типизированным против формы, которую продукт больше не возвращает. **TSC возразил только на месте вызова**, то есть дубль был обнаружен случайно, а не проверкой. Свёрнуто в одном прогоне, как инструкция и требует: «прежде чем расширять контракт, пересекающий main и renderer, поискать имя и свернуть дубль в том же прогоне» — не «завести на это тикет».
- **Первый прогон за шесть, где ни одна подсадка не промахнулась.** Пять из пяти воспроизвели свой дефект с первой попытки — после итераций, где промахивались три из десяти. Изменились две вещи, и обе появились прошлой итерацией: приземление измеряется `before -> after` с утверждением разницы, а восстановление файла — отдельная команда, поэтому упавшая проверка больше не оставляет дерево подсаженным.

### 2026-09-10 · UX28-09 · честное обещание про дверь, которая уже продукта, и две подсадки, доказавшие обратное

- **Symptom:** поиск обещал пять хранилищ и спрашивал три. Название самого проекта и записанное решение нельзя было найти из поля, которое сценарий называет «одной дверью ко всему».
- **Surfaced at:** stage 0, из сценария — по правилу, которое я внёс итерацией раньше: читать сценарий поверхности ДО кода. Оно сработало сразу.
- **Owned by:** stage 5 работы M141.
- **Root cause и почему это худший вид неверности:** обещание шага 4 — «пустой результат называет, где искали, чтобы „никто не записал“ отличалось от „не искали“» — выполнялось **честно**. Просто про дверь, которая на два хранилища уже продукта за ней. **Ничего на экране не было ложью**, и поэтому это не находится чтением экрана: расходились не утверждение и факт, а ОБЪЁМ обещания и объём продукта.
- **Fix, by grade:** пять хранилищ объявлены **данными** (`SEARCH_STORES`), и `SearchStore` выводится из списка (structural) — набор, который ищут, и набор, который называют, теперь один объект, а не два места, которые надо держать в согласии. `facts` сужен до «помнится и не решение» (structural): решение это `memory_facts` с `kind='decision'`, и группа решений рядом с несуженными фактами вернула бы строку дважды. Пустой результат называет хранилища (evidence).
- **ДВЕ ПОДСАДКИ ДОКАЗАЛИ ОБРАТНОЕ ТОМУ, НА ЧТО БЫЛИ НАЦЕЛЕНЫ, и обе кончились удалением.** Первая: я убрал написанный руками `.eq('estate_id', …)`, ожидая падения — не изменилось ничего, потому что `createScopedStore.select` уже применяет фильтр. Все шесть ручных были **дублированием**. Вторая: фильтр «не показывать отказавшее хранилище в списке искомых» не мог сработать, потому что `outcomeOf` отдаёт `nothing` только когда молчащих нет.
- **И это уже система, а не совпадение.** Недостижимая (UX28-02), невидимая (UX28-03), дублирующая (UX28-05), неисполнимая (здесь) — **четыре формы одной ошибки за пять итераций**, и каждый раз она выглядела как забота о правильности. Общее у всех: защита от состояния, до которого код не доходит. И каждый раз находила её не проверка кода, а **подсадка, оставшаяся зелёной**.
- **Три моих проверки были неверны, и все три по-разному.** (1) Присваивание `input.value` не обновляет контролируемое поле React: он следит за значением через свой дескриптор и игнорирует запись — панель ничего не искала, и три случая падали против работающего кода. (2) Ожидание ОТСУТСТВИЯ «Nothing matches» проходило мгновенно: отсутствие было верным до того, как сработал дебаунс. **Сначала дождись положительного, потом утверждай отсутствие** — иначе ждёшь того, что и так верно. (3) Проверка приземления подсадки считала фильтры и посчитала неверно (шесть, а не пять), поэтому скрипт вышел до пробы **и до восстановления** — файл остался подсаженным до следующей команды.
- **Вывод про (3), который стоит держать:** проверка приземления — самая ненадёжная часть цикла, потому что её саму никто не проверяет. Лучшая форма — не «grep нашёл строку», а **измерение до и после**: `before -> after` с утверждением, что разница именно такая.

### 2026-09-10 · UX28-08 · третий ответ, которому некуда лечь, и правило, которое я нарушил через итерацию после того, как его записал

- **Symptom:** цель на панели плана отчитывалась настоящей дробью, построенной на числе, которого никто не брал. Проект с тремя открытыми и сорока сделанными, обрезанный на двадцати, показывал «2 of 3 done» как измерение.
- **Surfaced at:** stage 0, при чтении панели — карточка этого не называет прямо, но это дословно её отрицательная приёмка.
- **Owned by:** stage 5 работы M190, которая построила честный контракт и потеряла его в одном сравнении.
- **Root cause:** **у значения три ответа, а у сравнения место только для двух.** `coverageOfList` возвращает `true`, `false` и `'unknown'` — «никто не считал». `=== true` читает третий как «ничего не отрезали», то есть **самый успокаивающий из трёх**. Пропущенное покрытие (`null`) — то же утверждение, и оно проваливалось туда же.
- **И честное чтение уже было написано в шести файлах отсюда.** `DecisionsSection` разбирает оба случая по имени; `SearchPanel` спрашивает `!== false`. Одно значение, три прочтения, неверным было одно. **Это не «забыли правило» — правило было написано трижды, и один раз неправильно.**
- **TypeScript тут не помогает, и это решает форму починки.** `boolean` или `'unknown'` в сравнении с `true` — легальный, хорошо типизированный и неверный код. Та же форма, что молча выброшенный `data-testid` прошлой итерации: **тип разрешает ошибку молча, поэтому нужен забор, а не внимательность.**
- **Fix, by grade:** сравнение читает `!== false` (structural, и это идиом, уже живущий в `SearchPanel`); забор `check-coverage-reads.mjs` отказывает сравнению, которому некуда положить третий ответ (mechanical) — **и разрешает оба честных идиома**, потому что в репозитории есть по одному каждого, а забор, требующий одного, переписывал бы работающий код под предпочтение. Это важнее, чем выглядит: забор, навязывающий стиль, теряет доверие, и тогда его отключают в тот раз, когда он прав.
- **Забор обязан уметь сказать, что потерял предмет.** Подсадка «убрать третье значение из типа ВЕЗДЕ» роняет забор с прямым сообщением; подсадка «убрать у одного поля» его не роняет, потому что это законное изменение. Разница проверена обеими подсадками: правило считает поля, а не запрещает их менять.
- **И две вещи, которые работали без теста, покрыты.** Работа без цели всегда в списке; нераспиленная цель — `nothing_planned`, а не 0 %. Обе были построены и обе не проверялись — то есть держались на том, что никто их не тронет.
- **ПРАВИЛО, КОТОРОЕ Я НАРУШИЛ ЧЕРЕЗ ИТЕРАЦИЮ ПОСЛЕ ТОГО, КАК ЕГО ЗАПИСАЛ.** В ячейку реестра я вставил литеральный `|` — внутри обратных кавычек, в записи про тот самый тип, — и это ровно трап FA-05, в том самом реестре, где FA-05 его и нашли. Забор поймал (9 колонок вместо 6). **Вывод не «быть внимательнее», а тот же, что абзацем выше: правило в промпте — это не привычка, и защищает от него забор, а не память.** Здесь забор был, и он сработал.

### 2026-09-10 · UX28-07 · упавшая подсадка, которая доказала больше, чем поймавшаяся, и четвёртый раз, когда документ был прав

- **Symptom:** шесть счётчиков панели памяти считали через `db.from(table)` — сырой клиент — и написанный руками `.eq('project_id', …)`, минуя `store.select`, где применяется `scopeFilters` с фильтром `estate_id`.
- **Surfaced at:** stage 0, при чтении файлов карточки; сама карточка этого не называет — она просит `holds/writer/source/last read/coverage`.
- **Owned by:** stage 5 исходной работы M135.
- **Root cause:** у обработчика **был в области видимости сырой клиент**. Пока он есть, «пойти в обход» — это не ошибка, а один из доступных способов; и однажды кто-то торопится. Дефект не в восьми строках, а в том, что альтернатива существовала.
- **Fix, by grade:** вынос в `memoryOverviewRead.ts` (structural) — функция получает `ScopedStore` и больше ничего, поэтому обхода **нет в природе модуля**. Это третий вынос той же формы после `digestRead.ts` и `harnessRead.ts`, и все три вынесены по одной причине: решение внутри обработчика нельзя прогнать без Electron.
- **И утечка тут узкая и хуже по форме, чем «сложили два эстейта».** Строки всё ещё одного проекта: ничего лишнего не суммируется. Плохо то, что **ответ дан про проект, читать который у этого скоупа не было права**, — а `scope.ts` прямо говорит, что ответ должен быть «нет такого проекта».
- **Первая подсадка уронила пробу вместо того, чтобы её покраснить — и доказала больше, чем поймавшаяся.** Я попытался вернуть сырой клиент; модулю его негде взять, поэтому код упал, а упавшая проба не доказывает ничего. Но **причина падения и есть искомое свойство**: обход недостижим, а не «избегаем». Записано так, и добавлено структурное утверждение (отсутствие вызова нельзя увидеть, запустив код), плюс вторая подсадка — которая **компилируется, работает и ловится**.
- **Третье состояние вскрыло скрытый дефект в помощнике, который был верен ровно пока состояний было два.** `fullyRead` спрашивал «ни у кого нет проблемы?». У непрочитанного стора проблемы нет — поэтому обзор называл себя полным про сторы, в которые ни разу не смотрел. **Добавление состояния — это не только новая ветвь: это переоценка каждого предиката, который перечислял старые.**
- **И моё утверждение снова было слишком широким.** Проверка «непрочитанный стор не рисует фразу отказа» матчила `/could not be read/i` — и попала в **собственную лид-строку панели**, которая объясняет это правило теми же словами. Заменено на точный артефакт: фраза отказа, отформатированная с пустой причиной. Третий раз за цикл, когда проверка сообщает о прозе про себя.
- **Четвёртая итерация подряд, где документ был прав, а код нет.** Шаг 4 SCN-039: «оператор находит стор, который никогда не читали → поверхность говорит это прямо вместо льстивого итога». Alt path: «стор, который не удалось прочитать, показывает отказ и возраст последнего успешного чтения, никогда — устаревшее число как текущее». Оба стояли в сценарии с самого начала. Так же было со строкой Errors у SCN-041, с SCN-047 и SCR-35, со строкой Errors у SCN-040. **Это перестало быть совпадением: сценарии этого проекта описывают продукт честнее, чем он себя ведёт, и разрыв систематически на стороне кода.**

### 2026-09-10 · UX28-06 · починка, которая была тем же дефектом, и карточка, у которой названного больше сделанного

- **Symptom:** `destinationOf` принимал «проект строки» и не имел способа узнать, чей сам реф. `RetroSection` передавал проект СТРАНИЦЫ рядом с рефом из `item.evidence` — факта, записанного где угодно, — поэтому источник из другого проекта открывался внутри этого, с id того проекта.
- **Surfaced at:** stage 0, из карточки; воспроизведено пробой до правки — две из семи новых проверок резолвера падали на отгруженном контракте.
- **Owned by:** stage 3 исходной работы S13. Контракт назвал один аргумент `projectId` там, где фактов было два.
- **Root cause:** **два разных факта делили одно имя.** «Где оператор находится» и «чему принадлежит реф» — не одно и то же, и функция, у которой для них один параметр, заставляет каждое место вызова помнить разницу. Два вызова помнили, третий нет. Дефект не в третьем вызове, а в том, что помнить приходилось.
- **И моя первая правка была тем же дефектом в одежде починки.** Я передал владельца **обоими** аргументами: сравнение `owner !== projectId` стало недостижимым, а destination — `exact` с проектом-владельцем. То есть источник другого проекта открывался бы и дальше, только теперь «правильно». **TSC был совершенно доволен**: оба аргумента — строки. Поймала это существующая проверка, утверждавшая старое поведение.
- **Fix, by grade:** резолвер получил второй факт и отказывает по расхождению, **не перенаправляя** (structural); строка, не знающая владельца, не предлагает открыть (structural) — откат на проект страницы и есть дефект, а не запасной путь; владелец приходит из чтения одним ограниченным `selectIn`, и упавший поиск оставляет его неизвестным, а не локальным (structural).
- **Существующая проверка утверждала старое поведение — и стала тремя.** Она открывала источник, не имея никакого свидетельства о владельце: ровно та утечка. Не удалена и не ослаблена: фикстура получила владельца этого проекта, и рядом встали два новых случая — другой проект отказывается, неизвестный владелец не предлагается. **Красный существующий тест — это иногда сообщение о том, что он проверял дефект.**
- **Шестая подсадка применена и не поймана ничем, и это записано как экспозиция.** Чтение retro встроено в обработчик, а не вынесено, поэтому рендер-проба (она подменяет IPC) его не видит, а main-пробы у него нет. `digestRead.ts` и `harnessRead.ts` показывают вынос, которого не хватает. Строка в леджере стоит с `never` — потому что покрытие, которого нет, хуже всего именно когда его назвали.
- **И главное про эту карточку: названного в ней больше, чем сделанного.** Пять строк переноса и шесть строк `never`; экспозиция выросла с 64 до 70 за одну итерацию. Карточка P2 просила точные адреса для пяти видов сущностей, историю маршрутов, историю брифов, квитанции у семи цифр профиля и пришпиливание ревизии документа — то есть **пять поверхностей и схемное решение**. Сделаны три честные починки; остальное названо с причиной, по которой это не правка рендера. Зелёный прогон из трети карточки был бы худшим из возможных исходов, и цена честности здесь — шесть строк в счётчике, который ведёт план.

### 2026-09-10 · UX28-05 · пустой ответ, который льстит системе, и тип, который уже существовал ради него

- **Symptom:** три цифры полномочий в панели harness приходили из трёх `{ count: 'exact', head: true }`, чей `error` никто не смотрел, и дальше `live.count ?? 0`. Отказавшая таблица грантов читалась как «здесь нет открытых полномочий».
- **Surfaced at:** stage 0, из карточки; воспроизведено пробой до правки — десять из одиннадцати рендер-проверок падали на отгруженном коде.
- **Owned by:** stage 5 исходной работы M145.
- **Root cause:** тип не мог выразить отказ. `Harness` был четырьмя простыми полями, поэтому обработчику **некуда** было сказать, что чтение отказало, — и он не сказал. Дефект не в забытом `if`, а в форме, в которой честный ответ негде разместить.
- **Пятое появление одной формы — и первое, где пустой ответ ЛЬСТИТ.** FA-04, FA-03, FA-02 и 414 закрыли по одному, и все четыре давали **пропавший список**: пустая доска, пустой проект, «нет ждущих followers». Этот давал **успокоение**: «0 открытых грантов» — ровно то, что аудитор надеется увидеть, поэтому второй раз никто не смотрит. Ошибка в сторону хорошей новости живёт дольше, чем ошибка в сторону плохой, и это стоит записать отдельно от самой формы.
- **Fix, by grade:** каждая цифра из чтения — `ReadEnvelope` (structural). Один отказ из трёх — `partial` (structural): три счёта одной таблицы делят один конверт, потому что «часть ответила» одним булевым не выражается. Скоуп объявлен данными (structural): список эстейтных полей — данные, поэтому панель не может забыть подписать, а грант, который однажды получит проект, просто уйдёт из списка.
- **И R-005 изменил дизайн, а не только код.** Я начал изобретать свой `{ state: 'ready' | 'failed' }`. `ReadEnvelope` из S14 существует ровно для этого, и его собственное сообщение об ошибке формулирует дефект этой карточки дословно: «ответ, не несущий измерения, — это тот самый уверенный нуль, ради предотвращения которого этот тип существует». Свой тип выброшен; фикстуры пробы построены через **настоящий** `envelope`, поэтому не могут выразить состояние, которого продукт не производит, и `availability` в них **выводится**, а не утверждается мной.
- **Третья ненесущая защита за три прогона.** Страж «не показывать цифры при отказе» был **инертен**: `envelope` уже обнуляет данные. До этого была недостижимая (UX28-02) и невидимая (UX28-03). Форма одна: защита от состояния, до которого код не доходит, читается как покрытие. Лечение одно: сделать защищаемое настоящим или удалить защиту — не покрывать её тестом.
- **Найдено по пути: панель говорила оператору неверное число.** Её собственная строка утверждала «Sixteen tools exist and eleven write to the journal». Измерено: 22, 17 и 5. **Аргумент был верен, числа разъехались на шесть** — и та же фраза жила в спеке экрана SCR-35. Число в прозе нечем перевычислить, поэтому оно теперь рендерится из списка, а забор запрещает счёт словами и в продукте, и в документе.
- **И забор дважды пришлось учить не флагать собственную документацию.** Сначала он матчил «one of them» в чужой строке реестра; потом — мою же историческую цитату старого числа. **Во второй раз правильным ответом было изменить документ, а не ослабить правило:** читатель, скользящий по спеке экрана, видит цифру, и кавычки не мешают прочесть её как текущую. Это третий раз в этой кодовой базе, когда проверку учат не сообщать о своей же документации, и первый, когда менять надо было документ.
- **Названо, а не подразумевается:** обязательный task-скил описан в SCN-047 шаг 5 и в элементах SCR-35, а слова `mandatory` на пути привязки нет вовсе — машинерии не существует. Это M123, и строка M146 уже это записала. Пустая строка скилов читалась бы как «скилов не установлено» для того, что никогда не строили, поэтому строки нет совсем.

### 2026-09-10 · UX28-04 · три проверки, которые не могли увидеть свой дефект, и крючок, который TypeScript пропустил

- **Symptom:** три подсадки из десяти прошли мимо, и ни в одном случае код не был прав — просто проверки смотрели не туда. Это самая частая форма в этом цикле, и здесь она встретилась трижды за один прогон, каждый раз по-новому.
- **Surfaced at:** stage 5, на подсадках.
- **Owned by:** stage 5. Все три проверки написал я в этом же прогоне.
- **Первая: утверждение о том, что и так верно.** Проверка «строка, ушедшая из списка, уносит свой оверлей» утверждала, что карточки на экране НЕТ. Она и так ушла из списка — утверждение выполнялось при любом коде. Утечка (запись в `moving` для строки, которую никто не держит) видна только когда строка **возвращается**: устаревшая догадка поставит её в колонку, которую оператор просил когда-то, что бы запись ни говорила сейчас. Проверка переписана на возврат.
- **Вторая: окно, которое не наблюдалось.** Проверка «строка „не подтверждено“ не мелькает на каждом ходе» перерисовывала доску **уже устоявшейся** строкой — а в этот момент догадка снята и строки нет ни при какой подсадке. Единственный способ увидеть мельтешение — **держать команду неразрешённой** и посмотреть на экран в этот момент. До этой правки подсадка «убрать сторожа `inFlight.length === 0`» оставляла все проверки зелёными.
- **Третья: подсадка, которая ломала не то.** Клавиатурное исключение карточки («не заменять на drag-only») я сначала подсадил переименованием класса — сломал селектор, на котором едет вся проба, получил девять красных и **ни слова о клавиатуре**. Вторая версия (`select` → `div` с теми же `option`) не скомпилировалась, а файл, который не компилируется, доказывает подсадку, а не тест. Третья — `div` из кликабельных спанов — компилируется, оставляет остальные проверки красными по своей причине, и ловится именно тем утверждением, которое про клавиатуру.
- **Root cause, общий для всех трёх:** утверждение писалось про **состояние после**, а дефект жил в **переходе**. Ушедшая строка, окно полёта, подменённый контрол — во всех случаях наблюдаемое различие существует лишь в момент, который проверка проскакивала.
- **Fix, by grade:** три проверки переписаны на наблюдение перехода (evidence); правило прежнее и подтверждено ещё раз — **подсадка, оставившая зелёное, не доказала правило, а сообщила, что проверка слепа**.
- **И одна вещь, которую TypeScript поймать не может.** Первым делом я поставил на баннер `data-testid="board-problem"`. Он **молча пропал**: `Banner` не принимает rest-props, а TS не возражает, потому что **атрибут с дефисом в JSX обходит проверку лишних свойств**. `TSC` вернул 0, крючка в DOM не было, и четыре проверки падали так, будто дефект в продукте. Это R-004 в чистом виде: проверка не дошла до предмета, и это факт о стенде, а не о продукте.
- **И решение лучше, чем починка крючка.** `Banner` уже несёт `role="alert"`. Проверка спрашивает роль — то, что компонент действительно имеет, чего нельзя молча выронить, и что заодно утверждает, что отказ **объявлен**, а не просто отрисован. Тестовый крючок в общий компонент не добавлен.

### 2026-09-10 · UX28-03 · обновление, подтверждавшее новость, за которой оно обновлялось

- **Symptom:** дайджест опустошал себя обновлением. Пришедшее событие двигало метку журнала → эффект панели перезапускался → cleanup предыдущего прогона вызывал `digest.seen(projectId)` → главный процесс спрашивал у журнала ТЕКУЩУЮ голову и отмечал её прочитанной. То есть отмечал прочитанными те самые события, которые обновление и вызвали. Оператор видел «ничего нового»; события исчезали навсегда.
- **Surfaced at:** stage 0, из карточки — и подтверждено пробой ДО всякой правки: девять из десяти рендер-проверок падали на отгруженном коде.
- **Owned by:** stage 2 исходной работы M133. Доктрина «метка двигается, когда оператор уходит» верна; не была решена вторая половина — **до какого места**.
- **Root cause:** чтение и подтверждение отвечали на **разные вопросы**. Чтение спрашивало «что произошло с метки», подтверждение — «где журнал сейчас». Пока панель читалась один раз за визит, оба вопроса давали один ответ. Как только к ней добавили метку журнала (правильно — иначе панель расходилась с доской рядом), они разошлись, и никто не заметил: каждый шаг по отдельности вёл себя ровно так, как был задуман.
- **Почему это выжило:** дефект не давал ни ошибки, ни пустого экрана, ни неверной строки. Он давал **корректный экран с меньшим содержимым**, и отличить «ничего не произошло» от «произошло и потеряно» изнутри продукта было нельзя. Единственный след — отсутствие того, чего никто не видел.
- **Fix, by grade:** граница едет **вместе** с чтением (structural) — `digestFor` возвращает голову, на которой чтение взято, и в системе больше нет места, где «сейчас» подставляется вместо «что прочитано»; граница помнится только для нагрузки, **дошедшей до экрана** (structural); подтверждение больше ничего не спрашивает у журнала, и это проверено структурно, потому что свойство — **отсутствие** чтения (mechanical).
- **И опасение прежнего кода сохранено, а не отброшено.** Cleanup срабатывал на упавшем чтении намеренно: непоказанный дайджест не должен становиться вечно растущим бэклогом. Поэтому граница — это **голова**, а не последняя строка на экране: событие вида, который дайджест не рисует, стоит между ними и должно быть сметено. Верное опасение с неверным средством — не повод выбросить опасение.
- **Две подсадки прошли мимо, и обе — вина фикстуры, а не кода.** В головной проверке метка ленты и граница были **одним и тем же числом**, поэтому «подтверждай метку» и «подтверждай показанное» соглашались, и подмена одного другим оставалась незамеченной. Это та же форма, что «размеры, при которых оба правила согласны», уже виденная в этом цикле: **фикстура, в которой две гипотезы неразличимы, делает подсадку слепой.**
- **И страж, который был косметически инертен.** `{digest === null && failedWhy === null && <EmptyState read={false}>…}` выглядел как защита от показа пустого состояния рядом с ошибкой. Но `EmptyState` с `read={false}` и без `waiting` рисует **пустой абзац**: текст не появлялся ни при какой ветви, поэтому и утверждение не могло упасть, и защищать было нечего. Это второй раз за два прогона, когда защита оказалась ненесущей — в прошлый раз недостижимой, здесь невидимой. **Лечение оба раза одно: сделать защищаемое настоящим, а не покрывать защиту тестом.** Панель получила фразу «читаю…», которой у неё не было вовсе — до этого она молчала, пока шло первое чтение, — и страж стал несущим.
- **Найдено по пути: у поверхности не было сценария, а реестр говорил обратное.** Единственное упоминание дайджеста в `scenarios.md` — строка Coverage у SCN-044, которая **про профиль менеджера**. Файлы `digest.ts`/`DigestSection.tsx` были процитированы сценарием про другое, поэтому поверхность читалась как покрытая. Написан SCN-090, покрытие SCN-044 исправлено — и обнаружено правило самого реестра: каждый сценарий обязан быть достижим из journey (`check-product-model.mjs`), поэтому SCN-090 добавлен в PJ-04 шаг 1.
- **И ещё одно моё число было неверным.** Экспозицию я посчитал руками и получил 56, взяв не то смещение колонки; забор сказал 63. Число в документе взято **из забора**, а не из моего счёта — ровно то, для чего забор и существует.

### 2026-09-10 · UX28-02 · защита, которая не могла сработать, и обход списка, слепой к удалению из списка

- **Symptom:** подсадка не воспроизвела дефект. Я убрал защитную ветвь `read.state === 'ready'` из списка репозиториев, ожидая увидеть «репозиториев не подключено» на месте упавшего чтения, — и все 23 проверки остались зелёными.
- **Surfaced at:** stage 5, на девятой подсадке итерации.
- **Owned by:** stage 5. Ветвь написал я сам двадцатью минутами раньше, в этом же прогоне.
- **Root cause:** асимметрия, которую я же и внёс. На всей остальной странице чтение разворачивается как `read.value ?? []`; здесь я оставил `read.value` — то есть `null` при отказе и при загрузке. Поэтому `repos?.length === 0` при отказе давало `undefined === 0`, ложь, и **ветвь не могла сработать никогда**. Она читалась как защита от показа отказа в виде пустоты, а защищала от состояния, до которого код не доходит.
- **Почему это не «лишняя проверка, и ладно»:** недостижимая ветвь **читается как покрытие** и им не является. Через месяц кто-то «упростит» её как избыточную — и упростит правильно, потому что она действительно избыточна **при этом развороте**; и в тот же день кто-то другой добавит `?? []`, чтобы страница была однородной, и снимет защиту, о существовании которой уже не будет знать. Два верных по отдельности изменения, дающих дефект вместе.
- **Fix, by grade:** асимметрия убрана — `?? []`, как везде на странице (structural); ветвь стала load-bearing, пересажена и **увидена ловящей** (evidence). Не «покрыть недостижимую ветвь тестом», а сделать так, чтобы она была достижима или её не было.
- **Второе за итерацию: обход списка слеп к удалению из списка.** `FACTS_QUERY_KEYS` перечисляет поля, участвующие в ограждении, и тест ходит по этому списку, проверяя, что смена каждого поля меняет субъект. Подсадка «убрать `category` из списка» **не была поймана этим циклом** — потому что цикл после удаления просто не проверяет удалённое поле. Поймало другое утверждение: сравнение списка ключей с ключами самого интерфейса. **Обход данных проверяет содержимое данных, а не их полноту**; полнота требует второго источника, и здесь им служит сам тип.
- **И две моих проверки были неверны там, где код был прав.** `vi.fn()` создан и **не передан** в компонент — утверждение спрашивало у мока, которого в дереве не было. И категория `decision`, которой у продукта нет: её поймал **TSC, а не тест**, потому что vitest не типизирует. Это тринадцатый и четырнадцатый случай за цикл, и форма ровно та же: утверждение спрашивает об одном, прогон делает другое.

### 2026-09-10 · M199.acceptance · «не выполнено» как результат, и подсадка, которая не применилась

- **Symptom:** приёмка блока M199 не может быть выполнена на этой машине. Разрешённых тестовых аккаунтов нет, и получить их нельзя без последствия, которое M199.probe измерил: второй логин Claude Code перезаписывает единственный элемент Keychain на пользователя ОС и **разлогинивает оператора из живой сессии**.
- **Surfaced at:** stage 0, из карточки — которая говорит свой исход своими словами: «без test accounts статус остаётся not executed, не passed», «fixture tests alone cannot pass acceptance».
- **Owned by:** никем как дефект. Это состояние, а не ошибка, и вся работа итерации — сделать так, чтобы его нельзя было выдать за другое.
- **Root cause of the design:** у отрицательного результата три разных вида, и они не взаимозаменяемы. **`not-executed`** — не измеряли. **`failed`** — измеряли, и прошло то, что должно было быть отвергнуто. **`inconclusive`** — измеряли, и доказательств не хватает. Назвать первое вторым — выдумать дефект; назвать первое третьим или тем более `passed` — выдумать возможность. Три состояния, потому что их три.
- **И подмена, которую карточка называет первой, потому что она больше всех похожа на доказательство:** показать сохранённую стенограмму вместо настоящего resume. Стенограмма Fabric доказывает, **что записал Fabric**. Поэтому `transcript-read` исключён **по имени**, в списке, а не решением на месте вызова: решение на месте вызова однажды примет тот, кто спешит.
- **Fix, by grade:** судья с тремя отрицательными исходами (structural); забор, запрещающий матрице объявить `supported` для возможности, отвечаемой только живым прогоном, без квитанции (mechanical); план как **данные** — девять шагов с «что нужно» и «что доказывает» у каждого (durable: план в прозе перевыводит тот, кто его запускает; план списком — исполняют).
- **R-004 в новой форме: подсадка не применилась.** Я попытался пометить CO-112 как `resolved`, ожидая голого `| open |` в конце строки. Там `open — nine M199 tasks are in the current queue…`: токен, за которым идёт проза. Подмена **ничего не изменила молча**, и забор показал зелёный — то есть подсадка не доказала ничего, пока я не посмотрел на настоящую ячейку. **Это второй раз за цикл, когда «зелёный после подсадки» значил «подсадка не применилась», а не «правило работает».**
- **И она же указала на лучшее решение.** Раз статус — токен с прозой, забор не должен иметь своего мнения о том, что значит «закрыт»: он читает диспозицию через **объявленный словарь** из FA-10. Второе мнение отъехало бы от счётчика самого реестра — ровно тот дефект, который FA-10 и закрыл.


### 2026-09-10 · M199.ui · подсадка прошла, и это привело к удалению кода

- **Symptom:** подсадка сняла половину правила `isStaleForDisplay` — проверку статуса рядом с пределом возраста — и **ничего не упало**.
- **Surfaced at:** stage 6, девятой подсадкой из девяти.
- **Owned by:** мной, в этой же итерации. Помощник выглядел разумно: «показание старое ИЛИ его статус не является чтением».
- **Root cause:** у `ShownHeadroom` **один** производитель, и он уже отвечает `known: false` для любого статуса, который не является чтением. Значит вторая половина условия недостижима через любого вызывающего — она защищала от формы, которую тип не может произвести. И **никто помощника не вызывал**.
- **Fix: удаление, а не покрытие.** Соблазн был написать случай, конструирующий `ShownHeadroom` руками, чтобы ветвь стала «покрытой». Это проверяло бы инвариант, который производитель и так гарантирует, и оставило бы в коде ветвь, существующую ради своего теста. **Недостижимая защитная ветвь читается как покрытие и им не является** — то же, что FA-09 записал про недостижимую ветвь в `containmentFor`, только теперь применённое к своему коду в тот же час, когда он был написан.
- **И главное решение итерации — про то, чего нет.** Компонент отрендерен и проверен двадцатью семью утверждениями, но **до него нельзя дойти из приложения**: IPC-канала и точки входа нет. Соблазн был поставить сценариям `ready` — покрытие же есть. Но покрытый компонент, к которому нельзя перейти, это не доставленный сценарий, и `ready` в источнике истины прочитали бы как «работает». Поэтому статус остался `draft`, **а причина написана внутрь сценария**, не только в леджер: тот, кто откроет `scenarios.md`, увидит и покрытие, и почему этого недостаточно.
- **Дефект, против которого сформирован весь слой, стоит записать целиком.** `usedPct ?? 0` — одна строка, выглядит безобидно, рисует **полный бак** для аккаунта, которого никто не спрашивал. Ноль на этой шкале значит «свободно», отсутствие значит «не спрашивали», и это противоположные вещи. Ответ — не ревью и не правило, а **тип**: объединение вместо nullable-числа, чтобы подставлять было некуда. Подсадка, вернувшая `{ known: true, freePct: 0 }`, уронила пять утверждений разом.


### 2026-09-10 · M199.auto · утверждение о выдуманной константе и ветвь, которую подавил кулдаун

- **Symptom:** два моих утверждения из шестидесяти проверяли не то, о чём просил прогон. Первое сравнивало год в `nextCheckAt` с «2026», хотя `NOW = 1_757_000_000_000` — это 2025-09-04: утверждение о **моей же фикстуре**, не о коде. Второе называлось «один интент на наблюдение», а второй тик подавлял **кулдаун**, потому что первый тик записал `lastSwitchAt = NOW` и второй шёл на тех же часах.
- **Surfaced at:** stage 6, первым же прогоном. Оба упали — и это единственная причина, по которой они не уехали зелёными: если бы код совпал с моим ошибочным ожиданием, я бы получил две строки «ok», не проверяющие ничего.
- **Owned by:** мной, и это девятый и десятый случай за цикл. Форма одна и та же: **утверждение спрашивает про одно, прогон делает другое.**
- **Root cause:** оба раза я писал утверждение, глядя на код, а не на прогон. Год я вывел из того, что «сейчас 2026-й», а не из константы двумя строками выше. Дедуп я проверил в самом естественном месте — сразу вторым тиком, — где раньше срабатывает другая защита. **Ветвь, до которой не доходят, и ветвь, которая работает, в отчёте выглядят одинаково.**
- **Fix:** первое утверждение больше не спрашивает год — оно спрашивает, что `nextCheckAt` разбирается как момент и лежит в будущем от `NOW`, то есть проверяет свойство кода, а не совпадение с календарём. Второе перевело часы за кулдаун при **тех же показаниях**, и только тогда ветвь дедупа стала достижимой.
- **И главное про саму карточку: она обязана не включаться, и это её результат.** Автопереключение — и есть то расширение автономии, перед которым оператор поставил сохранность данных и надёжный запуск. Всё здесь работает, когда никто не смотрит, поэтому первым делом файл **отказывает**: `native-resume-ack` измерен как `unverified` у обоих билдов, значит ни один аккаунт не кандидат, каждое решение — `hold`, отправка приостанавливается. Соблазн был включить и «посмотреть, что будет».
- **Два решения, которые стоят отдельного упоминания.** Первое: **движок чистый**, а всё, что может отвалиться, — в петле вокруг; часть, решающая, двигать ли чужую работу, — это часть, в которой нечего подменять. Второе: **счётчик смен — список отметок времени, а не число**, потому что число не умеет выпадать из скользящего часа; подсадка, сделавшая его числом в памяти, немедленно сбросила часовой предел при рестарте — ровно то, что карточка запрещает своими словами.


### 2026-09-10 · M199.resume · утверждение о том, что чего-то не произошло, ничего не стоит, пока детектор не показан видящим

- **Symptom:** проверка «новая сессия не сбрасывает объемлющий бюджет» сравнивала `before` и `after` и проходила. Она прошла бы и с детектором, который не умеет замечать сброс вообще.
- **Surfaced at:** stage 6, при написании самой проверки. Не пробой и не подсадкой — вопросом «а от чего именно это меня защищает».
- **Owned by:** мной. Форма «assert not X» выглядит завершённой и не является: у неё две половины, и вторая — что детектор X вообще работает.
- **Root cause:** отрицательное утверждение проходит двумя разными способами — потому что X не случился, и потому что проверяющий не умеет X видеть. В отчёте это одна и та же зелёная строка. **Восьмая моя ошибка за цикл, и первая, где ошибкой была форма утверждения, а не его содержание.**
- **Fix:** рядом с «сброса не было» стоит «а вот сброс, и он замечен». Две строки вместо одной, и вторая — единственное, что делает первую доказательством.
- **И главное про саму карточку: она обязана отказываться, и это её результат, а не её недоделка.** `native-resume-ack` измерен как `unverified` у обоих билдов, поэтому переключатель отказывает **до** остановки чего-либо. Соблазн был построить путь до `committed` и «пока не включать»; это дало бы код, который однажды объявит успех, которого никто не наблюдал. Вместо этого выполнимость решается первой, а `mayCommit` — единственная дверь в `committed`, и подсадка, разрешившая войти туда переходом фазы, поймана.
- **Порядок оказался важнее фаз.** Остановить сначала и спросить потом — так разговор оказывается ни идущим, ни возобновимым, и **у этого состояния нет владельца**: ни оператор, ни продукт не знают, чья теперь очередь. Поэтому выполнимость, все блокеры сразу, и **ничего не записано**, если она отказала: строка, которую надо закрывать, для работы, которая не начиналась, — второй повод ошибиться.
- **Фаза пишется до своего эффекта, и это вся реконсиляция.** Фаза, записанная после, делает крах между ними неотличимым от краха до, и повтор повторяет эффект. Одна строчка порядка стоит всей схемы восстановления.
- **И один случай обязан коммититься.** Девять отказов без единого принятия — это функция, которая всегда говорит «нет», и её зелёные строки ничего не значат.


### 2026-09-10 · M199.binding · гарантия в том, что функция не может дотянуться

- **Symptom:** ничего сломанного — карточка требует РАЗДЕЛИТЬ два действия, которые в интерфейсе выглядят одним: сменить аккаунт для будущей работы и переместить разговор, который уже идёт.
- **Surfaced at:** stage 2, при решении, где живёт гарантия «смена default не трогает живое».
- **Owned by:** этой итерацией. Развилка была настоящей: поставить проверку внутри записи — или сделать так, чтобы у функции не было пути к живым привязкам.
- **Root cause of the choice:** проверка внутри записи защищает от того, что я подумал; отсутствие пути защищает от того, о чём я не подумал. Подсадка, которая **дала** `setProjectBinding` доступ к списку привязок, немедленно передвинула разговоры A и C — то есть у неё не было бы никакой работы, если бы доступ уже был, и вся защита сводилась бы к тому, чтобы каждый следующий автор помнил условие.
- **Fix, by grade:** одна функция, пишущая одну карту и ничего больше (structural). Durable — три вещи. Первая: **ответ говорит, чего он не сделал** — сколько живых разговоров осталось на своих аккаунтах. Изменение, чей радиус невидим, оператор угадывает. Вторая: **сравнение дрейфа идёт по ревизии, а не по id аккаунта**, потому что id переживает переаутентификацию, сменившую план, организацию или субъекта: запись выглядела бы правильной, пока работа шла бы от чужого имени. Третья: **нечитаемая ревизия останавливает dispatch и не называется дрейфом.** Два разных факта, и назвать первое вторым значило бы утверждать про credential, которого никто не прочитал.
- **И отказ, который проще всего забыть.** Заменённая сессия ещё имеет callback'и в полёте. Поздний callback говорит **правду** — о процессе, за которым уже никто не смотрит. Его легко применить, потому что он не выглядит ошибочным; поэтому он отвергается по имени (`old-generation`), а устаревшая ревизия — по другому имени (`stale-revision`). Конкурирующий писатель и призрак — разные вещи, и оператору с одним сообщением на оба не различить.
- **Закрепление обещается только там, где измерено, и это ограничение пришло из чужой итерации.** M199.probe измерил, что у Claude Code один элемент Keychain на пользователя ОС. Значит логин может смениться под идущим разговором, и никакая запись здесь этого не остановит. Дизайн сам просит **показывать дрейф, а не обещать закрепление** — поэтому у `PinStrength` два значения, слабое несёт причину, и две подсадки (принять любой статус изоляции; объявить системный логин закреплённым) поймали попытку обещать больше.
- **И моё собственное утверждение проверяло не то, о чём просило.** `patch` заменяет, а не сливает; я передал только generation, а потом проверял, что переехал nativeRef. Седьмая такая ошибка за цикл — и снова её поймал не забор, а несоответствие между тем, что утверждение говорит, и тем, что прогон сделал.


### 2026-09-10 · M199.usage · проверка, которая существовала и которую никто не запускал

- **Symptom:** датированная проба `docs/audit/2026-09-09-provider-accounts.probe.mjs` печатала `REPRODUCED` для двух дефектов, и это было верно сегодня утром: чтение credential шло по фиксированному пути мимо `CLAUDE_CONFIG_DIR`, а кеш квоты выдавал чтение аккаунта A за B до истечения TTL.
- **Surfaced at:** stage 0, и **не пробой, а тем, что пробу никто не гонял.** Её нет ни в `ci.sh`, ни в workflow. Она существовала девять дней, честно воспроизводила два дефекта — и ни один прогон её не исполнил. Это ровно класс, который FA-10 нашёл в реестрах (`agent_sync.py check` существует и не гоняется), в другом файле и с другим владельцем.
- **Owned by:** тем, кто написал пробу как *документ*. Она лежит в `docs/audit/` рядом с отчётом, и это правильное место для записи, но неправильное для исполняемого: каталог документов ничто не запускает.
- **Root cause:** датированная характеризующая проба — гибрид. Как запись она принадлежит дате; как программа она принадлежит забору. Положив её в одно место, автор получил половину пользы: запись сохранилась, исполнение — нет.
- **И один из двух дефектов опаснее, чем звучит.** «Кеш A выдаётся за B» — это не отсутствие данных, а **уверенно неверные данные, смотрящие не в ту сторону**: у A есть запас, оператор переключается на исчерпанного B, и продукт две минуты сообщает запас. Гейт автономной работы стартует на аккаунте, который не может её обслужить. Пустой кеш был бы безопаснее полного.
- **Fix, by grade:** ключ наблюдения из шести частей и одна карта вместо двух переменных (structural); длиннопрефиксные части ключа, чтобы null и пустая строка не схлопывались (mechanical); чтение файла credential из config home (mechanical). Durable — две вещи. Первая: **проба теперь в `ci.sh`**, и она утверждает починку, а не дефект. Вторая: **окно, которого провайдер не вернул, — неизвестно, а не свободно**, и только `fresh`/`exhausted` считаются чтением. Исчерпанный аккаунт — это чтение, потому что ноль это число; `stale` и остальные четыре — утверждения о чтении, а не об аккаунте.
- **Доктринальный вопрос решён вслух, потому что два правила столкнулись.** `CLAUDE.md`: датированный документ никогда не переписывается под сегодняшнее дерево. Карточка: обе пробы должны сменить ожидаемый дефект на исправленное поведение. Разрешение: **характеризующая проба — исполняемое, а не отчёт.** Оставить её красной значило бы держать сломанный забор; переписать утверждения, сохранив дату и запись словами, — это то, что просит карточка. Дата осталась, что она воспроизводила — написано текстом, утверждения переехали на починку. Там, где починка невозможна (Keychain на macOS), проба печатает `STILL TRUE` с измерением, а не замолкает.
- **И полный тир нашёл второй дефект — у которого нет автора и нет даты.** Зелёный утром, красный днём, между ними пустой коммит. `chainAdvance` читал все follows-связи, затем спрашивал последователей через `.in('id', followerIds)`; при 294 id фильтр — 10 879 символов, шлюз отвечает **414 URI too long**, а `.data ?? []` превращает отказ в «никто не ждёт». **Автономные цепочки молча перестали продвигаться.** Список растёт вместе с данными, поэтому URL переходит предел сам — без коммита, без автора, без даты. **Четвёртое появление формы FA-04/FA-03/FA-02 и первое, где спусковой крючок — РАЗМЕР**, поэтому починка — функция (`selectIn`: нарезает и возвращает ошибку), пять мест переведены, забор запрещает шестое, а два фильтра, ограниченных словарём, названы по одному с причиной.
- **Забор пометил своё же объяснение.** Правило нашло `.in('id', …)` внутри комментария, документирующего починку. Это читается как находка, пока не посмотришь на номер строки, — и это уже случалось в этом цикле с другим забором. Комментарии теперь снимаются до сопоставления.
- **А случай для ветви ошибки не проверял ничего, пока утверждение не спросило по имени.** Он звал `advance.tick()`, тогда как фабрика возвращает сам тик: падал сразу — и **проходил**, потому что мой же `catch` наполнял список, который читало утверждение. Ужесточение («назван ли отказ по имени и с кодом») вскрыло обе ошибки одним прогоном. **Утверждение «что-то произошло» проходит всегда: что-то происходит всегда.**
- **И подсадка, которая не доходила до утверждения, в четвёртый раз за цикл.** Первая версия подсадки на общий backoff писала его в ключи, уже присутствующие в карте, — а второго аккаунта там ещё не было. Форма дефекта была не та: исходный дефект — **одна переменная, которую читают все**, а не запись во множество. Переделана в исходную форму и поймана. **Подсадка должна воспроизводить дефект, а не что-то похожее на него.**


### 2026-09-10 · M199.auth · «не смогли проверить» вместо «проверили, и это другой»

- **Symptom:** правило сравнения личностей отвечало `unknowable`, когда у выбранного аккаунта есть организация, а читатель провайдера не вернул никакой. Три утверждения упали на этом разом.
- **Surfaced at:** stage 6, пробой. Ни один из девяти подсадок этого бы не нашёл: подсадки проверяют, что правило применяется, а здесь неверным было само правило.
- **Owned by:** мной, в этой же итерации, при написании `identityAgrees`. Третий ответ («ничего сравнимого») был введён осознанно и правильно — и применён на один случай шире, чем следовало.
- **Root cause:** «нечего сравнить» и «сравнили, и не совпало» различаются тем, у кого чего нет. Если у выбранной стороны есть организация, а у наблюдаемой нет — это **не** отсутствие информации: это ровно та измеренная подпись, которую оставляет действующая подмена (`apiKeySource`, `oauth_token`, `third_party` — все три обнуляют личность). Я обобщил «одна сторона пуста» в «сравнить нечем», не заметив, что пустота наблюдаемой стороны сама является наблюдением.
- **И это была бы самая дорогая ошибка карточки.** `mayLaunch` отказывает и на `blocked`, и на `cleaned-unverified`, так что запуск не произошёл бы ни при какой из формулировок. Но оператор получил бы «мы не смогли проверить» там, где правда — «мы проверили, и работа пойдёт от чужого имени». **Одинаковый исход, противоположный смысл**, и различие между ними — это то, ради чего вся карточка.
- **Fix, by grade:** одна ветвь в `identityAgrees` (mechanical). Durable: **пустота наблюдаемой стороны — это наблюдение, а не его отсутствие.** Асимметрия имеет направление, и правило должно спрашивать «у кого чего нет», а не «есть ли у обоих».
- **И то, что сделало карточку измерением, а не догадкой:** переменных, «которые обычно бывают», семь; подменяют личность **четыре**, а детекторов — два, и они видят разные подмножества. `apiKeySource` показывает одну из четырёх. Проверка, построенная на очевидном поле, пропустила бы `ANTHROPIC_AUTH_TOKEN` целиком — и выглядела бы работающей на самом заметном случае. **Список, полученный перебором по одной переменной за раз, стоил десяти минут и не имеет альтернативы.**
- **Свободный терминал оставлен как был, и это стоило отдельного решения.** Соблазн — снимать переменные всегда. Но `sessionEnv.ts` уже объясняет, почему сессия получает ключ оператора: это настоящая оболочка в настоящем проекте. Той же переменная становится подменой ровно тогда, когда появился выбранный аккаунт, — так что список условный, и условие — единственный факт, меняющий её смысл.


### 2026-09-10 · M199.accounts · «неразличимо» — это третий ответ, а не округление до одного из двух

- **Symptom:** контракт требует хранить `subject` и различать дубликаты по `provider/subject/org/runtime`. Предыдущая итерация измерила, что ни один установленный провайдер `subject` не отдаёт. Значит поле, на котором держится вся защита от «добавил аккаунт, а заменил чужой», недоступно.
- **Surfaced at:** stage 0, из **собственного измерения прошлой итерации**, а не из карточки. Карточка M199.accounts ничего про это не знает: она написана до probe и специфицирует поле как имеющееся.
- **Owned by:** stage 3 предыдущей волны — тем, кто фиксировал контракт `ProviderAccount`. Поле было взято из того, что *должно* быть у провайдера аккаунтов, а не из того, что у этих двух есть.
- **Root cause:** нормальная форма записи «subject + org» пришла из мира, где identity-провайдер сам отдаёт субъекта. Здесь identity-провайдер — CLI чужой программы, и он отдаёт то, что решил отдать.
- **И правильный ответ оказался не «убрать поле» и не «взять почту».** Оба варианта тихие: без поля дубликаты не ловятся вовсе, а почта запрещена дизайном как личность именно потому, что её меняют. Третий ответ — **назвать незнание**: `identityConfidence` из трёх значений, и у сравнения личностей третий исход `indistinguishable`. Логин с таким исходом **не завершается**. Это дороже для пользователя (второй аккаунт в той же организации добавить нельзя) и единственное, что не заменяет чужую запись молча.
- **Fix, by grade:** реестр поверх `localState`, а не рядом (structural — ревизия, атомарность и карантин куплены один раз в S14); отказ второго логина там, где секрет не следует за домом, с цитатой измерения (structural); проверка утечек и тип без поля для секрета (mechanical). Durable: **первый логин разрешён всегда.** Соблазн был запретить всё, где изоляция не `supported`, — и это сделало бы функцию недостижимой там, где изоляция просто не доказана. Перезаписывать нечего, когда нет чего перезаписывать; правило про второй логин говорит именно про второй.
- **Две мои собственные ошибки поймала проба до отправки, и обе — R-004 в чистом виде.** Проверка утечек искала слово `subject` и падала на **своём же очищенном виде**, где `confidence` законно принимает это значение: утверждение дошло не до того предмета. А утверждение про повреждённый реестр говорило «читается пустым» — неверно про **дизайн**, а не про код: `localState` восстанавливается из последней хорошей копии, и пустой ответ молча потерял бы аккаунты оператора. **Оба выглядели как дефекты продукта, оба были дефектами проверяющего.** Это третья итерация подряд, где так; счёт: FA-10 — три, здесь — два.


### 2026-09-10 · M199.probe · два провайдера дали противоположные ответы, и узнать это можно было только спросив

- **Symptom:** девять детей M199 проектируют переключение аккаунтов и продолжение разговора поверх двух программ, которые Fabric не поставляет. Всё это держится на том, что эти программы умеют, а карточка запрещает один способ узнать: выставлять `supported`, прочитав чужой README.
- **Surfaced at:** stage 0 — но это не находка, а **задание**: карточка целиком про измерение, и её ценность в том, что она запретила короткий путь заранее.
- **И запрет оказался не общей осторожностью.** «Одной переменной окружения недостаточно для изоляции Keychain» — это утверждение **верно ровно про одного из двух провайдеров и неверно про другого**. Codex держит секрет файлом в доме: два дома — два аккаунта. Claude Code держит его в одном элементе Keychain на пользователя ОС, а читатель личности отвечает **по дому** — значит перенаправленный дом выглядит изолированным, и второй логин пишет в единственное место. Обобщённая осторожность («переменные не изолируют») закрыла бы Codex зря; обобщённое доверие («переменная изолирует») сломало бы Claude Code. **Ни одно из двух общих правил не верно, и это ровно тот случай, когда список из двух измерений дороже принципа.**
- **Owned by:** stage 2 предыдущей волны — тем, кто писал таблицу «провайдерских швов» в `provider-accounts.md`. Она перечисляет правильные вопросы («config/Keychain resolution … tested by CLI version») и в той же строке предлагает первый срез, как будто ответы известны. Вопрос и план стояли рядом, и план читался как следствие.
- **Root cause:** проектирование поверх чужой программы по её интерфейсу, а не по её поведению. Интерфейс говорит, что можно попросить; поведение говорит, что произойдёт. Между ними — место, где живут все семь измеренных возможностей.
- **И главное: механизм, который изолирует, — это механизм, который продолжает.** У обоих провайдеров сохранённые разговоры лежат в том же каталоге, что и секрет. Дизайн обещает и локальность секрета, и продолжение существующего разговора под другим аккаунтом того же провайдера — **два обещания одним каталогом не выполняются**. Это не дефект реализации, потому что реализации нет; это противоречие в обещании, найденное до того, как под него написали код. CO-140 с тремя выходами и ценой каждого.
- **Fix, by grade:** типизированная квитанция возможности и матрица на **закреплённый билд** (structural); забор, отказывающий `supported` без наблюдения, `unverified` без названного теста, дыре вместо строки и билду, который не установлен (mechanical). Durable — две вещи. Первая: **дыра и `unverified` читаются одинаково, и это разные вещи** — одно измерение никто не снял, другой вопрос никто не задал; поэтому отсутствующая строка падает. Вторая: **обновление возвращает строки в `unverified`.** Возможность чужой программы — свойство её версии, и перенос вчерашнего ответа на новый билд был бы той же ошибкой, что чтение README, только медленнее.
- **Где я остановился и почему это записано словами, а не «не сделано»:** ни одного логина не выполнено — на Claude Code второй логин перезаписал бы единственный элемент Keychain и разлогинил оператора из живой сессии. Карточка оставляет настоящие аккаунты отдельно допущенной сертификации; я записал **конкретное последствие**, а не сослался на правило. Resume Codex падает с «stdin is not a terminal» прежде, чем что-либо проверит: псевдотерминал в репозитории есть, и это следующая проба.


### 2026-09-10 · FA-10 · сорок пять процентов журнала доказательств не были таблицей

- **Symptom:** `verification.md` держал 969 строк в 70 блоках вертикальных черт. У 54 была шапка с разделителем; у остальных шестнадцати — нет: это продолжения таблицы сверху, отделённые пустой строкой, а пустая строка **завершает** markdown-таблицу. 434 строки — 45% журнала — рендерились абзацами из литеральных `|`.
- **Surfaced at:** stage 0, и **только потому, что два независимых чтения не сошлись**: 535 против 969 на первом прогоне нового структурного счётчика. Ни один существующий забор этого не видел и не мог: все они сопоставляют шаблон id со строками, а не читают таблицу. Числа были верны всё это время. Документ — нет.
- **Owned by:** тем, кто добавлял очередную секцию строк, отделяя её пустой строкой для читаемости источника. В исходнике это выглядит аккуратнее; в рендере это конец таблицы.
- **Root cause:** реестр читали как текст, а предъявляли как таблицу. Пока каждый счётчик работает по шаблону id, различие между «строка есть в файле» и «строка есть в таблице» ничем не наблюдается — и оба ответа одинаково уверенны.
- **И третий раз про один класс, впервые про форму.** M115: пять строк `BRAND-REQ` вне всех чисел, найдены тем, что кто-то дописал строку и увидел, что итог не двинулся. FA-01: префикс с цифрой, невидимый так же — десять строк добавили, одиннадцать открылось. Оба раза шаблон **расширяли**. Расширенный шаблон ждёт четвёртого префикса, о котором никто не подумал; поэтому теперь строка, которая не разбирается, **ломает забор**, а не уходит из счёта.
- **Fix, by grade:** структурное чтение по членству в таблице плюс фикстура, посчитанная руками (mechanical); словарь диспозиций как поле вместо первого слова предложения (structural). Durable — три вещи. Первая: **второй счётчик — не доказательство, пока сам не проверен.** Карточка просит числа, посчитанные независимо, и очевидное чтение — «напиши второй счётчик» — недостаточно: **три моих собственных независимых подсчёта были неверны прежде, чем один оказался верен** (шапки как данные; пустая ячейка от завершающей черты как статус; необрезанные ячейки, не подходящие ни под один шаблон), а четвёртый оказался мягче забора, который проверял. Каждый был бы доложен как дефект реестра. Вторая: **замороженный список вместо перенумерации.** 22 id называют больше одной строки, 49 строк в коллизиях; перенумеровать — значит переписать старый аудит под сегодняшний счёт, что карточка запрещает, и оставить висящими ссылки в других документах. Список из 22 может только сокращаться, а двадцать третья коллизия падает: долг стал счётным и не может вырасти. Третья: **«UI» — это место, а не причина.** Семь неувиденных строк говорили «no — UI»; теперь каждая называет шов, а где утверждение — правило, а не раскладка, названа и подсадка. Счёт превратился в работу, которую можно взять.
- **И две проверки самого аудита не подтвердились.** Числа в предложении об экспозиции все пересчитываются, включая числитель отгруженных (я решил обратное по своему же сломанному счётчику и проверил прежде, чем записать). `AGENT_SYNC.md` не устарел — слепок конфигурации совпадает с живым. Ложных находок сканера в плане не было вовсе. **Записано именно потому, что отсутствие, которое кто-то проверил, и отсутствие, которое никто не искал, читаются одинаково.**
- **Одна подсадка увидена сообщающей, а не падающей,** и это записано как отдельный результат: устаревшая запись в замороженном списке — подсказка сократить его, а не красный забор. Подсадка, которая «не сработала», и подсадка, которая подтвердила намеренное поведение, в логе выглядят одинаково — различает их только то, что было решено заранее.


### 2026-09-10 · FA-08 · измерить, потом менять — и что показала третья строка таблицы

- **Symptom:** обработчик данных писал в буфер и тут же читал его целиком. На каждый чанк: склейка, срез до 400 000 символов, регулярное выражение по всем 400 000 и три промежуточных массива — чтобы получить 120 символов последней строки, которая для большинства этих чанков не менялась. На единственном потоке главного процесса, который вместе с этим держит MCP-сервер, писателя журнала и IPC для четырёх окон.
- **Surfaced at:** stage 0, из карточки, и она же задала порядок: сначала baseline, потом изменение. Это не формальность — при обратном порядке числа перестают быть сравнением и становятся заявлением.
- **Owned by:** тем, кто добавил `tail`. Задача была «показать в плитке последнюю строку», и полный проход по буферу — самый прямой способ её решить, если не спрашивать, кто платит и как часто. Вопрос «сколько раз в секунду это выполнится» не задаётся сам.
- **Root cause:** производная величина считалась там, где меняется вход, а не там, где её спрашивают. Между этими двумя местами — три порядка по частоте, и ничто в коде этой разницы не показывает: и запись, и чтение выглядят как одна строчка.
- **И то же изменение закрыло потерю байтов, которую никто не заводил.** Вид проигрывал снимок буфера, взятый чьим-то опросом до двух секунд назад, и только потом подписывался. Всё, что сессия сказала в промежутке, исчезало — молча, и тем больше, чем она была активнее. Это не находка карточки; это то, что стало видно, когда пришлось решать, откуда вид берёт буфер, если листинг его больше не возит. **Вопрос «кто это читает» вытащил дефект, которого не искали.**
- **Fix, by grade:** кольцо целых чанков и хвост, читаемый с конца (mechanical); марка на семейство событий вместо одного числа (structural). Durable — три вещи. Первая: **третья строка в таблице измерений.** Новая форма читает хвост лениво, старая читала жадно, и без пессимистической строки таблица приписывала бы структуре экономию, которая частично «ещё не сделано». Сравнение двух форм, у которых разные моменты вычисления, честно только если показать оба режима. Вторая: **ни один забор не читает эти числа.** Порог здесь был бы бюджетом, которого никто не согласовывал, — карточка запрещает это прямым текстом, и вместо порога проверяется форма: обработчик не читает буфер, листинг не несёт буфер, чанк несёт свой счётчик. Третья: **ненаречённый читатель следует всему.** Значение по умолчанию выбрано в сторону лишней работы, а не лишней тишины: неверно суженный читатель стоит не работы, а правды.
- **Три подсадки не сработали с первого раза, и все три по разным причинам.** Две не доходили до предмета: в одной размеры чанков делали оба правила одинаковыми, в другой ветвь была недостижима, потому что окно берёт **целые** чанки — одночанковый буфер оно разрубить не может, и случай пришлось строить из пятнадцати. Третья не применилась вообще — якорь в файле не был уникален, — и это записано как «ничего не доказано», а не как «прошло». **Подсадка, которая не применилась, и подсадка, которую поймали, в логе выглядят одинаково: обе зелёные.**
- **И одна часть находки оказалась неверна на той ревизии, где её измеряли.** M105 утверждал, что регулярному выражению хвоста не хватает ESC, из-за чего `[link]` превращается в `ink]`. Проверено через `git show d28c321:…/pty.ts` — байт там был. Он виден только под `cat -v`, и находка прочитала невидимый управляющий символ как отсутствующий. Новый модуль пишет `String.fromCharCode(27)` именно поэтому: то же поведение, но прочитываемое глазами. **Аудит — это тоже текст, который читают как истину, и его собственные утверждения проверяются так же, как чужие.**


### 2026-09-10 · FA-09 · разрешение спрашивать — это не разрешение делать

- **Symptom:** `fabric_effect_request` — инструмент, который агент **может** вызвать. Ничто в системе не заставляет его вызывать. У каждого раннера, запускаемого этим продуктом, есть собственный shell, собственный писатель файлов и собственный HTTP-клиент, которых Fabric не видит и не посредничает. Значит `allow` на floored-эффект санкционировал **спрашивание**, а делание было доступно всё это время — и запись в журнале о выданном гранте выглядела ровно так же, как если бы она что-то значила.
- **Surfaced at:** stage 0, из карточки. Она формулирует это как выбор из двух ответов, и это её главная ценность: перехватить обход **или** явно не допустить профиль к действию.
- **Owned by:** stage 3 предыдущей волны — тот, кто закрепил контракт эффекта. Пол был спроектирован как ворота, а построен как форма заявки: контракт описывал, что делает вызывающий, и молчал о том, что вызывающий может не звонить.
- **Root cause:** пол моделировал **запрос**, а не **способность**. Между двумя есть зазор ровно в размер родных инструментов раннера, и он не сужается ужесточением проверок над запросом — там нечего ужесточать, эта дорога и так под контролем. Единственная точка, где зазор измерим, — пара (раннер, режим разрешений): она и решает, есть ли между агентом и миром хоть что-нибудь.
- **Первый ответ карточки проверен и отвергнут, а не пропущен.** Перехват обхода означал бы сидеть внутри цикла инструментов чужой программы — ни один установленный раннер этого не отдаёт, и вероятность, что отдаст, близка к нулю. Это записано как CO-133 с причиной, а не как «не сделано».
- **Fix, by grade:** сдержанность объявляется в дескрипторе и **перекрёстно проверяется забором** против флагов рядом (mechanical): режим с флагом обхода не может заявлять о шлюзе, режим без объявления — не «по умолчанию», а тот, о котором никто не решал. Выводить сдержанность из имени флага было бы догадкой, которая читает раннер с иначе названным обходом как сдержанный. Durable: **две границы оставлены на месте намеренно.** Ниже пола ничего не изменилось — гейт на такие действия остановил бы агента, читающего файл, потому что он мог бы файл прочитать; и человек, действующий своими руками, правилу не подчиняется — у него нет родных инструментов, которые надо прятать, он и есть пол. Правило, которое ловит всех, ловит и того, кого защищает.
- **И дефект, которого карточка не заказывала, нашёл полный тир — не мысль.** Чтобы спросить, КТО просит, поверхность читает менеджер терминалов. Он конструируется на три обращения к базе позже, чем поверхность начинает слушать, а тип обещал, что он есть всегда: `ptys?.()` защищал функцию, а не её результат. В этом окне чтение падало вместо ответа. **500 — это не отказ:** в нём нет причины для агента и он не оставляет строки для оператора. Оба читателя менеджера теперь тотальны, и соседний `fabric_agents_list` — он читал менеджер так же и падал так же с самого начала — отвечает «отчёта нет» вместо пустого списка: превратить его в `?? []` было бы ровно той ошибкой, которую чинили три итерации подряд, когда несостоявшееся чтение выдаётся за факт. Агент, которому сказали, что проект пуст, действует как одиночка.
- **И обратная кавычка в комментарии пробы — седьмой раз за десять итераций.** Забор ловит её каждый раз, цена — один круг. Правило простое и живёт только в `check-probes.mjs`: внутри шаблонного литерала пробы нельзя писать имя функции в кавычках. Пишу словами.
- **И подсадка, которая ничего не доказывала, потому что ветвь была недостижима.** Пятая из шести прошла: `?? 'none'` в `containmentFor()` не мог быть достигнут ни одним настоящим режимом — TypeScript требует поле от каждого. Ветвь существовала для формы, которую тип запрещает. Диагностировано как утверждение, не дошедшее до предмета; случай, спрашивающий режим, которого у раннера нет, написан ДО того, как что-либо было заключено. **Недостижимая ветвь и покрытая ветвь в отчёте выглядят одинаково — различает их только подсадка.**


### 2026-09-10 · FA-05 · the file that already knew the rule

- **Symptom:** the carry-over register held 102 open rows and every number quoted about it said 100. Two rows — CO-050 and CO-060 — contain an escaped pipe inside a cell, and the counter split on a bare `|`, so their status was read as a fragment of the sentence before it.
- **Surfaced at:** stage 0, from the packet, which had measured it at 81 against 79 on the audit's own baseline. The same two rows, the same two-count gap, nine weeks of rows later.
- **Owned by:** whoever wrote the width check in that same file. It has used the escaped-pipe rule since it was written and names CO-050 in its own comment — and the status counter three hundred lines below it split naively. One file, one rule, applied in one of the two places that needed it.
- **Root cause:** the rule was learnt as a fix to a symptom rather than as a property of the format. A row is a row wherever it is read, and the fix went in where the failure showed. Nothing connected the two readers, because nothing had to: they are both four characters long and neither looks like a parser.
- **And it closed a flake nobody could explain.** CO-125 recorded a probe that failed once in a full run, passed alone, and whose cause I could not establish — recorded honestly as inconclusive about the harness. It failed again here, and this time it was legible, because the FA-02 run had taught that probe to read the error it was swallowing. The cause: the case granted Carol a role using a retried command id, and Carol's role at that point is decided by a concurrent-revoke race above it. When the race left her the estate's last owner, granting her `member` demoted the only owner and the floor refused — correctly. **A flake that needed a coin toss AND a swallowed error to hide.** Fixed by giving the case its own person, run three times consecutively green, and CO-125 is closed with its cause rather than with a shrug.
- **Fix, by grade:** one `cells`/`cell` for three scripts, one home for an id's aliases, and a gate that refuses a row becoming shipped with nothing behind the word (mechanical). Two durable halves. First, **the discrepancy was published rather than hidden** — the exposure sentence carried both numbers and let the reader choose, which reads as honesty and functions as an unfixed defect with a note attached. A number a document cannot settle is not a measurement. Second, on the plants: the first shipped-receipt plant landed on a row whose long prose already contained the words the gate looks for, so it passed and proved nothing. **A plant on a document has to be placed where the document is silent, and finding that place is part of the plant.**


### 2026-09-10 · FA-07 · the defect I would have shipped, and the tier that could not see it

- **Symptom:** building the identity port made a fresh install unable to start. An estate created by the bootstrap gets no membership, so the port could not establish a subject, and the bootstrap I had just written throws on that deliberately. Every existing estate was fine, because the migration seeds them; only a NEW one broke, and only through the path the application actually takes.
- **Surfaced at:** stage 6, by asking the database directly what a brand-new estate contains — not by any test. `ci.sh full` was green with the defect in place.
- **Owned by:** this run. It is not an inherited defect; I introduced it by making identity load-bearing without asking where an estate's first owner comes from.
- **Root cause:** the full tier creates estates by inserting events, never by running the bootstrap. `index.ts` cannot be imported (M110), so the one path a real launch takes is the one path nothing exercises — the same gap AX-01's card names when it forbids counting a SQL probe as runtime proof. A change that makes bootstrap stricter is invisible to a suite that never boots.
- **Fix, by grade:** the founding owner travels in `estate.created@1` and the projector writes the membership from it, guarded on the person existing so a replay can never abort (mechanical). The durable half: **the tier is blind in a specific, nameable place**, and I found this by luck rather than by process — I happened to ask what a fresh estate held. What would have caught it deterministically is a probe that runs the bootstrap's *sequence* against a fresh estate, which is now what the identity probe's last case does. Anything that tightens a precondition at startup needs one.


### 2026-09-10 · FA-06 · a success that produced an empty estate

- **Symptom:** a restore standing beside its source answered `restored: true, events: 2` and produced an estate holding nothing at all. Projection rows are keyed by the entity's own id globally, so the copy collided with the original row for row, and the projector's `on conflict do nothing` turned every collision into silence. Worse than the silence: the case asserting that two restores produce identical results PASSED, because both produced nothing.
- **Surfaced at:** stage 6, by comparing the restored projections against the source column by column — not by reading the projector, which is correct, and not by the restore's own receipt, which said yes.
- **Owned by:** nobody, and that is the point. The projector's `on conflict do nothing` is right for a replay: an event applied twice must not double a row. The global entity key is right for a product where an id names one thing. The restore is right to replay in order. Three correct decisions compose into a silent no-op, and no single one of them can be pointed at.
- **Root cause:** `on conflict do nothing` is an instruction to be quiet about a collision, and a restore is the one context where a collision means the whole operation is meaningless. The idempotence a replay needs and the completeness a restore needs are opposite requirements on the same statement.
- **Fix, by grade:** the command counts what the archive declares and what landed, and raises when they disagree — so the transaction rolls back and the operator gets a sentence instead of an empty estate (mechanical). Two durable halves. First, **the same comparison found a second defect nobody was looking for**: `goals.created_at` fell back to `default now()`, so a restored goal was dated at the moment of its recovery — nine milliseconds in a probe, years on a real archive. It was found only because the comparison covers every column of every estate-scoped table, measured from the schema rather than listed; a chosen five would have missed it, and the first version of the probe chose five. Second: three of eight plants passed at first, and none of the three was about the product — a loose assertion that accepted two reason codes, a plant applied to the live database while the probe reads the migration files, and a plant that broke the file instead of the behaviour. **A plant harness needs the same scrutiny as the thing it plants into.**


### 2026-09-10 · AX-01 · a complete table with no runtime behind it

- **Symptom:** `task_runs` had five states, an outcome vocabulary, an `outcome_only_when_ended` constraint, an `ended_has_a_receipt` constraint, a trigger refusing to reopen an ended run, a registered `run.ended@1` with a projector arm and a sentence in both string registries — and **zero producers of that event in the whole main process**. Every admitted run stayed `admitted` for ever, so the estate's account of what it did was a list of things that started.
- **Surfaced at:** stage 0, from the packet, and confirmed by counting: `grep -rn 'run.ended@1' apps/desktop/src/main apps/desktop/src/preload` returns 0.
- **Owned by:** M188, and by the shape of how the work was cut. The schema half was finishable alone and its tests pass the moment it is written — a constraint can be probed by attempting a bad row, and every one of those probes was green. The runtime half needs a session, a spawn and an exit, which is the expensive side. What made the gap invisible is that the cheap half tests beautifully.
- **Root cause, and it has a name in this repo already:** the same shape as M186, M179 and M189 — a correct derivation with no caller — arriving at schema scale. Here it is worse than a function nobody calls, because the table's own constraints made the incomplete lifecycle look deliberate: a run stuck at `admitted` satisfies every rule the schema knows.
- **Fix, by grade:** three commands under the estate lock, a runtime module extracted from `index.ts` so it can be driven, and an additive re-declaration of `admit_task_launch` for the estates that missed the in-place edit to migration 44 (mechanical). The durable half is about the probe: **one assertion could not fail.** A dropped RPC error and a read one both end at `unavailable`, because a dropped error leaves a null answer and a null answer is also unavailable. The reason code could not tell the branches apart; only the database's own words could. A plant walked straight past it, which is R-006 doing exactly what it was written for — and the lesson underneath is narrower than R-006 states it: **an assertion on a code is only as sharp as the number of ways that code can be produced.**


### 2026-09-10 · FA-02 · a whole feature that had never worked, under a suite that said it did

- **Symptom:** no chain in this product had ever advanced. A finished predecessor with its hand-off recorded left its follower in backlog forever. Three separate failures, each sufficient alone: the dispatch guarded itself with a conditional update to `status = 'dispatching'`, which `project_tasks_status_check` has never allowed; the intent record `chain.dispatch@1` was never registered in `event_types`, and `append_event` refuses an unregistered type by design; and one try/catch around the whole tick turned either into a line in an operations log.
- **Surfaced at:** stage 0 of the PREVIOUS run, as CO-118, from a probe that had been failing on `main`. Diagnosed here by instrumenting the real path rather than reading it: every input the reader consumes was correct in SQL, so the defect had to be between reading and dispatching.
- **Owned by:** PF-07.02, and — more importantly — by its own regression suite. That suite asserted the mechanism by source string, including `if (!casWon?.length) continue` verbatim, and then re-implemented it as a Python `Store` whose `cas()` always succeeds. It was green about a mechanism that had never run once.
- **Root cause:** the same shape as FA-04's and FA-03's, at a higher price. `const { data } = await …` drops `error`; a rejected write returns an empty answer; and the empty answer is read as a *decision somebody else made*. Three cards in a row have now found it. What made this one invisible for so long is that the failure mode it imitates — losing a race — is healthy, expected and unremarkable in a log.
- **Fix, by grade:** the chain calls `admit_task_launch`, the command the operator's Run already used, so the second path is deleted rather than repaired; the event type is registered additively; the lease is re-pointed at the session that holds it and released when a spawn fails (mechanical). The durable half is **R-007**: a check that carries its own copy of the mechanism verifies the model. R-006 would have caught half — removing `dispatching` reddens the source assertions — and the model half would have stayed green, which is exactly the signal to look for. **A suite whose assertions can all pass with the subject deleted is not a suite.**


### 2026-09-10 · FA-03 · a header that was right and code that was not

- **Symptom:** an HTTP 200 with an empty body authorised unattended agents. The producer built `problem: null` — nothing had failed — and the gate skipped both absent windows and returned ok. Four more on the same floor: `NaN >= 90` is false so a corrupt number read as an idle account; one `mayStart` outside the loop authorised up to three starts; chains asked nothing at all; and `index.ts` imported the gate and never called it.
- **Surfaced at:** stage 0, from the packet's evidence lines, and then read against the file's own header — which states the rule correctly and completely. Nothing had to be discovered; the two just had to be put side by side.
- **Owned by:** the run that shipped M94. It wrote the right rule in prose at the top of the file and implemented a narrower one below it: an unknown quota blocks, said about a reading that FAILED and not about one that arrived empty. Those are the same thing seen from two sides, and only one side was coded.
- **Root cause:** a type that could not tell an absence from a failure. A plan with no seven-day window and a reading with no windows were both `null`, so the code had to guess which it was holding — and it guessed the direction that starts agents. Every other defect here is downstream of that: the skip existed to protect the narrow plan, and the skip is what let the empty reading through.
- **Fix, by grade:** a validated snapshot with a typed refusal, the producer naming an empty body as empty, one shared admission door, and one-reading-one-start — DERIVED from the threshold's own recorded meaning rather than invented (mechanical, and ADR-0054 records it). Two durable halves. First, **a plant read as CAUGHT because the probe was already red**: the chain probe fails on CO-118, so every plant makes it fail and every plant looks caught. Re-run against my own assertions, two of four were green under the plant — they assert that nothing started, which is true whatever the quota says while CO-118 stands. The evidence is the RECEIPT the new branch writes, plus a positive control proving a roomy reading does not write it. **A red suite cannot verify a plant, and a plant harness that reads the exit code will say it did.** Second: the claim had to become the LAST question asked, and the probe found that, not review — claiming before the instruction check let a routine skipped for an empty backlog spend the account's headroom without running anything.


### 2026-09-10 · UX28-01 · the fix for one field, not applied to the field beside it

- **Symptom:** typing a brief into task A, following a link to task B and clicking away saved A's words into B — measured before any edit as `tasks.brief('B', 'what', 'this belongs to A')`. No error, no undo, and the operator's own words now describe somebody else's work.
- **Surfaced at:** stage 0, from the packet, and then reproduced in the renderer harness before touching anything.
- **Owned by:** the run that shipped S01. It found exactly this defect on the NOTE box — its own comment says so: *"type a note about task A, follow a link to task B, press the button — the text belonged to A and the row it landed on did not"* — and fixed it with a keyed draft store. The brief fields, three inches up the same file, kept `defaultValue` and an `onBlur` reading the DOM. The lesson was learnt and applied to one instance of it.
- **Root cause:** the fix was shaped as *"give the note a key"* rather than as *"any text a person types belongs to the thing they typed it for"*. A rule stated about the instance cannot be checked against the neighbours; a rule stated about the class can. Nothing in the tree could have told anyone the brief was the same defect, because the note's key made the file look like the problem had been handled.
- **Fix, by grade:** a task+section draft key, controlled fields, stale answers discarded rather than stored, the draft held until the save lands, and Back reachable from a failed load (mechanical). Two durable halves. First, **my own first fix was worse than the defect**: it STORED the stale answer and filtered at render, so a late response for A blanked B's page instead of showing A — caught only because the probe asserted what the operator SEES rather than what the state holds. Second, the eighth plant found a regression I was about to ship: the note rule rejects empty text, which is right for a note and would have made a brief section impossible to clear. Reusing a rule because the shapes match is how the previous run's fix stopped one field short, and it nearly happened again in the same run that was fixing it.


### 2026-09-10 · FA-04 · the packet named two defects and the reproduction found five

- **Symptom:** the audit packet named a fail-open check and a check-then-append race. Reproducing them against the running stack surfaced three more, and one of them is worse than either named defect: the race appended **two** `task.linked@1` events while the board kept **one**, because the projector drops a cyclic edge with a warning rather than aborting a replay. The estate's history recorded something its projection does not contain, and the only trace was a Postgres warning no surface reads. Also: `task.linked@1` had THREE writers and one of them checked anything; and `would_close_cycle` walked provenance as if it were dependency, so with a parent that blocks its child, recording *"this child was spawned by that parent"* reported as a cycle.
- **Surfaced at:** stage 0, by running the defect rather than reading about it. The packet's two lines are what a source trace can see; the other three needed the database to be up and the interleaving to actually happen.
- **Owned by:** the run that built the operating-surfaces layer. Its own §4.1 states the rule correctly — a guard belongs at the write boundary, never on the replay path — and stops one sentence short. It does not say the guard and the append must be the **same act**, and that gap is where all three concurrency failures lived.
- **Root cause:** the lock was already there. `append_event` takes `pg_advisory_xact_lock` on the estate and runs the projector in the same transaction; everything needed for atomicity existed, and the check simply stood outside it, in the client, one round trip early. A correctness property was one line away and nobody was looking for it, because in a single-writer test the check and the write are indistinguishable from one act.
- **And running the full tier found it had been RED on `main` in two places, unnoticed.** `scripts/ci.sh full` needs the local stack, is not run before most commits, and its CI job `needs: fast` — so a stack-backed test can stay red across many green fast runs and nothing says so. `session-bundle.test.mjs` asserted an adapter refusal by naming an agent that a later change had made unready, so an earlier gate answered first and the branch the case was written for had no test at all; repaired here. `chain.test.mjs` does not start a follower whose predecessor finished and handed over; every input it reads is correct in SQL, so the defect is inside `chainAdvance.ts` — filed as CO-118 for FA-02, whose subject it is, rather than fixed inside a concurrency change. Both reproduced on `main` in a clean worktree and against a freshly reset database.
- **Fix, by grade:** `link_tasks` takes that same lock before the first question; all three writers call it; `check-commands.mjs` refuses a second door; ADR-0053 splits provenance from dependency (mechanical). The durable half is about the PROBES, not the code: **two of them were green without ever reaching the condition they asserted.** The concurrency probe fired two HTTP calls and hoped they overlapped — with the lock removed it stayed green. The replay probe deleted its journal and left the projections, so its comparison measured what an earlier run had left behind. Both were found by removing the mechanism and watching for red, which is R-006 — written one run earlier about structural gates, and now widened to say the same thing about any check at all.


### 2026-09-09 · FA-01 · a card that read `shipped` over a build nobody could make

- **Symptom:** `S07` was recorded as shipped and named its own remaining gaps honestly — no macOS runner, no notarization, `toolchainDigest` null. None of those was the problem. From a fresh worktree the producer exited 1 with `ENOENT` *before the build*, because `apps/desktop/resources` is generated and git-ignored and nothing created it; the manifest was stamped twenty steps *before* `electron-vite build`, so it described the previous artifact or none; `buildId` hashed `files.length`, so a changed byte left two different bundles sharing an identity; the manifest was not in the packaging config at all, so all three runtime lookup paths missed and the product built to say which build it is answered `null`; and `sameBuild` compared source and dependencies, so a rebuilt byte compared equal to the release it was not.
- **Surfaced at:** stage 0, by running the thing rather than reading about it. The audit packet named the first two; the last three were found by asking, for each acceptance line, *what command proves this* — «manifest находится внутри артефакта» has no proof that is not a packaged app.
- **Owned by:** stage 6 of the run that shipped S07. Every gate it wrote was green, and all three of its rules were true — about a build nobody could produce, ship or trust. A gate can be completely correct about the wrong subject.
- **Root cause:** the release path was verified in the only environment where it could not fail — a warm checkout with `resources/` and `out/` already on disk from a previous run. Every precondition the producer silently assumed had been met by an earlier run of a *different* command. Warmth is invisible: it leaves no artifact, no log line and no diff, and it makes the cold path untested rather than failing.
- **Fix, by grade:** the producer creates its own output directory and derives the repository from its own location; the order is build → manifest → gate; the identity formula lives in one file both the producer and the gate use; the schema is `BuildManifest@2` with a required `artifactDigest`; the packaging config carries it (mechanical). The durable half is **R-006**: two of seven plants walked past gate rules written in this same run, because both rules were satisfied by a *mention* — an unused import and a YAML comment — rather than by the mechanism. And a third, smaller instance of an older lesson: ten new verification rows did not move the ledger's total, and widening the counter's prefix pattern revealed eleven, because `HARNESS-REQ-004` had been outside every number ever quoted about that ledger. M115 recorded this as a lesson about the WIDTH; it is a lesson about narrow counters reporting smaller registers with total confidence.


### 2026-09-09 · M186 · the third derivation this session that nothing read

- **Symptom:** `readCycleGap` — written in S15 specifically so a quiet estate is distinguishable from an absent one — had no caller. The receipt it reads was being written every minute and consumed by nothing.
- **Surfaced at:** stage 0, by the question added to the loop after M189: for anything whose purpose is to be read by a person, ask who shows it.
- **Owned by:** S15, and by the same shape M179 and M189 already recorded. This is the third instance in one session: a correct derivation, tested, recorded, and unreachable from any screen.
- **Root cause:** unchanged from the previous two — a pure function is finishable alone and its tests pass the moment it is written. What is new is that the question now finds them in step 0 rather than three iterations later.
- **Fix, by grade:** `observationOf` composes it (mechanical). The durable note is about the CHECK rather than the code: three findings from one question in three consecutive iterations is the strongest evidence any step-0 rule has produced this session, and it costs one grep.

### 2026-09-09 · M173 · a comment that reasoned about the map the code does not build

- **Symptom:** `lineagesOf` built its reverse index as `Map<string, DecisionFact>`, so two decisions superseded by the same one kept only the second — a predecessor vanished from the screen entirely.
- **Surfaced at:** stage 0, from the card's source note, and then confirmed by reading the comment that defended it.
- **Owned by:** whoever wrote the comment. It argued no cycle guard was needed because "each id maps to at most one fact, since a fact has exactly one `superseded_by`" — which is true of the FORWARD map. The code builds the REVERSE one, keyed by the successor, and reverse maps are many-to-one. The reasoning was sound about a map that is not there.
- **Root cause:** a justification written from the domain rather than from the data structure. "A fact has one successor" is a fact about facts; "this Map has one value per key" is a claim about the Map, and only the second one licensed the single `set`.
- **Fix, by grade:** a list per key, a breadth-first walk with a visited set, and the comment rewritten to say which map its predecessor described (mechanical). The durable half: **a comment defending an absent check is the highest-value thing in a file to re-derive** — it is where somebody already thought hard and may have thought about the wrong object.

### 2026-09-09 · M190 · a cap that had been silent since the read was written

- **Symptom:** `tasks.list` returned open tasks plus the twenty most recent closed ones, as one flat array, with nothing saying it had cut anything. Any consumer counting that array counted a truncated set as the whole — and `PlanSection` did exactly that, showing a goal's open count as a bare figure with no denominator at all.
- **Surfaced at:** stage 0, from the card's own source notes, which named both sites. It had never failed a test because every test fixture has fewer than twenty closed tasks.
- **Owned by:** whoever wrote the cap, and nobody since. A `.limit(20)` is a reasonable thing to write and an unreasonable thing to leave undeclared, and the difference only shows on a project older than any fixture.
- **Root cause:** a cap is invisible below its own threshold. Fixtures are small by construction, so the one condition that makes truncation observable is the one no test creates.
- **Fix, by grade:** the read declares its coverage and the count beside it is measured (mechanical). The durable half: **a `limit` in a read is a claim about completeness, and it needs the same treatment as any other claim** — say the number, and say whether it is all of them. A fixture will never catch it.

### 2026-09-09 · M189 · six iterations of correct machinery that nobody could see

- **Symptom:** the agent tile showed `session.state` — `running | idle | ended` from a sixty-second timer. M178 replaced that derivation six iterations earlier, M179 wired an observer to record it, M181 made its coverage honest and M188 gave the run an identity. Not one line of the renderer read any of it.
- **Surfaced at:** stage 0, by grepping the renderer for the symbols those iterations produced. The answer was two i18n strings and nothing else.
- **Owned by:** every one of those iterations, and none of them individually. Each shipped a correct half and each verified its own half; the seam to the surface was nobody's stated deliverable.
- **Root cause:** a derivation, an observer and a projection are all finishable without a reader, and the register counts them as shipped because they are. The gap is invisible to a milestone-shaped ledger: nothing in it asks "who displays this".
- **Fix, by grade:** `runs.status` composes the recorded facts and the tile renders them (mechanical). The durable half is the third question for step 0, now standing: after "who calls this" and "what do they pass", **who SHOWS it** — for anything whose whole purpose is to be read by a person.

### 2026-09-09 · M191 · the gate written last iteration caught the same defect twice more

- **Symptom:** step 0 reported 30 of 60 with `M152` unparsed — the identical missing-space defect the previous retro had just written up, in a row my own script had rewritten. Then, an hour later inside this same iteration, the new gate caught me doing it a THIRD time to `M191`.
- **Surfaced at:** stage 0 by the total moving the wrong way, and then at stage 9 by the gate itself.
- **Owned by:** stage 9's row-rewriting, every time. The script that ships a queue row builds the line by concatenation, and the separator's leading space is the easiest character to lose.
- **Root cause:** none remaining. This is the entry recording that the previous retro's instruction — "a finding class seen twice becomes a script" — was followed, and the script earned its keep inside the iteration that added it.
- **Fix, by grade:** `check-registers.mjs` now refuses a batch-named node with no parseable row (mechanical, durable). Nothing further to carry: the failure mode is now impossible to ship, which is the correct end state for a class that had produced two silent miscounts.

### 2026-09-09 · M152 · a register that a script reads, broken by a missing space

- **Symptom:** the previous iteration reported "F3 is closed". It was not — the parent node M152 was still open — and the recount that should have caught it silently dropped the row instead.
- **Surfaced at:** stage 0 of the NEXT iteration, when the batch summary said F3 was "all blocked" while the queue total fell from 61 to 60.
- **Owned by:** stage 9 of the previous run. The queue row was rewritten by a script that left `...(#work-m103)| **shipped` — no space before the separator — and the parser's `\| ([^|]*) \|` stopped matching. One row vanished from every count, and the node depending on it read as blocked.
- **Root cause:** a Markdown table is prose to a human and a format to a script, and only one of those notices a missing space. The register gate checks the numbers it asserts; it does not check that every row still parses as a row.
- **Fix, by grade:** the space restored (mechanical). The durable half is the shape: **a total that moves in the wrong direction is the cheapest possible signal, and it was there** — 61 to 60 with a row shipped. Reading the ready set without reading the total would have missed it entirely, which is why step 0 prints both.

### 2026-09-09 · M188 · a plant that was caught by a different mechanism than the one it targeted

- **Symptom:** removing the terminal trigger failed only ONE of the two assertions that depend on a run being terminal. Reopening an ended run was still refused.
- **Surfaced at:** stage 5, watching the plant.
- **Owned by:** nobody — this is the good case. The reopen is refused by `outcome_only_when_ended`, because a run moving out of `ended` while holding an outcome violates the constraint independently of the trigger. Two mechanisms, and the plant is what revealed which carries which assertion.
- **Root cause:** none. Recorded because the *reading* is easy to get wrong: a plant that half-fails looks like a weak test, and here it was a strong schema. Diagnosing it as "my test is inadequate" would have led to weakening a constraint to make a plant tidier.
- **Fix, by grade:** nothing to fix; the finding is written into the verification row so the next reader knows which mechanism holds which line. The durable half: **when a plant fails less than expected, ask what else refused before concluding the test is weak** — the answer is sometimes defence in depth doing its job.

### 2026-09-09 · M155 · a rule that asked for something no mechanism holds

- **Symptom:** every agent was told "Claim a task with fabric_task_claim before working on it" in the same voice as "You can only see and touch this project". The second is refused by the scoped store. The first is checked by nothing — no lease is consulted anywhere before a move.
- **Surfaced at:** stage 0, by classifying each of the eight rules against the code rather than reading them as a set.
- **Owned by:** nobody yet, which is why it survived. The rules were written as guidance and read as a contract, and no gate ever asked whether a sentence had a mechanism behind it.
- **Root cause:** prose is the cheapest way to add a rule and the only kind that cannot refuse. A list of imperatives has no place to record which of them are backed, so the backing is remembered rather than stated — and it decays silently when an enforcement point is renamed.
- **Fix, by grade:** each rule carries its mode, a REFUSED one names `file#symbol`, and `check-obligations.mjs` resolves it (mechanical). The durable half is the shape rather than this instance: **a claim of force is checkable, and an unchecked one drifts toward being firmer than it is** — nobody ever weakens a rule's wording by accident.

### 2026-09-09 · M181 · a mechanism defeated by a literal at its only call site

- **Symptom:** `deriveLiveness` takes `beatsSupported`, and the runtime observer passed `true`. Three of the four runners the product offers declare `surfaceAdapter: 'none'` — no MCP surface, so no heartbeat is possible — and every one of their sessions was reported stalled fifteen minutes in, forever.
- **Surfaced at:** stage 0, by grepping the callers of a symbol the card named. The grep found two: the test, which passes both values, and the observer, which passes a literal.
- **Owned by:** stage 5 of M179. The observer was written to call a derivation whose whole point was the `unsupported` branch, and it hardcoded the input that reaches it. The suite stayed green because the only caller passing `false` was the unit test.
- **Root cause:** a boolean parameter whose correct value requires a lookup will be passed as a literal by the first caller written, and nothing about the type says otherwise. The unit test covering both values makes it look covered.
- **Fix, by grade:** the observer asks a capability report derived from `AGENTS` (mechanical). The durable half is a sharpening of the standing grep: **a caller is not enough — look at what it PASSES.** A well-tested branch reachable only from a test is the same island M179 recorded, one layer in.

### 2026-09-09 · S15 · a green probe that was starting twenty-five sessions a tick

- **Symptom:** adding a cap of three starts per poll broke eight assertions in `routine-tick.test.mjs` that had been green for weeks.
- **Surfaced at:** stage 6. The first read was "my change is wrong"; the measurement said otherwise — the first tick of the suite had **twenty-five** routines due.
- **Owned by:** the probe, and it had been wrong the whole time. Its estate id is a fixed constant, so every previous run left its never-run routines behind. Each tick was starting all twenty-five, and the suite stayed green because `spawnsIn(project)` counts one project and no assertion ever asked how many sessions a tick opened in total.
- **Root cause:** an assertion scoped narrowly enough to be isolated is also scoped narrowly enough to miss the thing it is standing in. The probe's own comment records the within-run version of this lesson; the across-run version had no reader.
- **Fix, by grade:** the probe clears its routines at start (mechanical). The durable half is the question the suite never asked: **how much did this action do in total**, not only how much did it do to my fixture. A cap is exactly the kind of change that finds these, because it is the first thing that ever cared about the total.

### 2026-09-09 · M179 · a correct, tested rule that had never been applied

- **Symptom:** `deriveLiveness` — eighteen tested cases, five states, a coverage vocabulary — had exactly one caller in the tree, and it was its own test file.
- **Surfaced at:** stage 0, by grepping for callers before reading the card, rather than by any test failing. Nothing could fail: the function was correct.
- **Owned by:** stage 5 of the PREVIOUS run. M178 shipped a derivation and a tool and left the seam between them unbuilt, then reported the milestone as delivered. The queue row said what was built and did not say what would call it.
- **Root cause:** a pure function is finishable on its own, and its tests pass at the moment it is written. Nothing in the pipeline asks "who calls this" — the register counts rows, the gates count structure, and a well-tested island passes both.
- **Fix, by grade:** the observer, and a probe that drives the derivation against a real store (mechanical). The recurring shape is the one S04 recorded a day earlier from the other side — a feature whose consumer does not exist passes every test it has — and the cheap check is the same one that found it here: grep for callers of anything shipped as a module (durable; it is now the first thing step 0 does on a card that names an existing symbol).

### 2026-09-09 · M103 · a plant that could not reach the thing it was planted in

- **Symptom:** the planted defect that removed the digest comparison from the PROJECTOR changed nothing. Every assertion stayed green.
- **Surfaced at:** stage 5, watching the plant — the run's fourth, and the only one that did not fail.
- **Owned by:** stage 5. The tool refuses a mismatched digest before any event is appended, so no test could reach the projector's own copy of the check. The comment above it claimed the projection compares too; nothing proved it.
- **Root cause:** defence in depth is two checks, and a test that exercises the outer one can never see the inner. The probe drove the tool, which is the right way to test the tool and the wrong way to test what protects against the tool being bypassed.
- **Fix, by grade:** an assertion that appends `delivery.accepted@1` directly, with a wrong digest, and reads the projection back (mechanical). The general rule is already standing as R-003 — attempt the forbidden thing from the role that would attempt it — and this run is evidence that it applies to a PROJECTOR and not only to a privilege: the role that would bypass the tool is any writer to the journal (durable, no new instruction needed).

### 2026-09-09 · S04 · a whole subsystem nothing could reach

- **Symptom:** nothing in the product could start a task that already existed. Every launch path called `startTask`, which appends a fresh `task.started@1`.
- **Surfaced at:** stage 0, by measuring the card's first claim ("introduce startExistingTask") against the tree rather than reading it as a refinement of something present.
- **Owned by:** stage 0, and this is the interesting part. Three shipped features rested on the missing command without any of them failing: S06 computed a blocking set nothing consulted, M151's Board ranked tasks nothing could launch, and the ladder's `backlog` state was unreachable in the direction that matters. Each was green in its own tests, because each tested its own half.
- **Root cause:** the seam between "work exists" and "work runs" was never built, and every feature on either side was verified against the side it was on.
- **Fix, by grade:** `admit_task_launch` plus `tasks.startExisting` (mechanical). Recorded because the shape is not a bug: a feature whose consumer does not exist passes every test it has, and the only thing that finds it is measuring a card's claims against the tree instead of against the neighbouring cards (durable).

### 2026-09-09 · S02 · a refusal that arrived for the wrong reason

- **Symptom:** the P29 assertion "a task in one estate citing another estate goal" refused — with SQLSTATE 23502, a not-null violation, because the fixture omitted required columns. The estate constraint was never reached.
- **Surfaced at:** stage 6, and only because `expectError` compares the SQLSTATE. Without that comparison the probe would have printed `ok` and proved nothing about the boundary it exists to test.
- **Owned by:** stage 5. A probe that asserts "this was refused" without asserting WHY is satisfied by any refusal, and a fixture is the easiest way to produce the wrong one — three of this run's four fixture columns were wrong on the first attempt.
- **Root cause:** the fixture was written from the table's conceptual shape (title, status) rather than from its actual NOT NULL columns (`option_id`, `seq`), so the insert failed before the foreign key was evaluated.
- **Fix, by grade:** the columns were read from `information_schema` and supplied (mechanical). The general lesson is already enforced here — `expectError` takes a `wantCode` — and this run is the evidence that the enforcement earns its keep: it caught a false green three times in one probe (durable, no new instruction needed).

### 2026-09-09 · M168 · a comment that claimed what the code did not do

- **Symptom:** `proposalCommands.ts` shipped with a header saying it "REVALIDATES at commit before appending anything". It did not: it read the facts, ran the pure check, and appended. Two windows could still both pass.
- **Surfaced at:** stage 5, while writing the module's own documentation — the sentence was written from the design and the code beneath it was written from the old path.
- **Owned by:** stage 5. A comment is a claim, and this repository's own doctrine says a claim without proof is not documentation. It reached a file before anything made it true.
- **Root cause:** the design named three steps — check, revalidate, commit — and the implementation collapsed the middle one because the first entry point being ported did not obviously need it. The prose kept the design's shape.
- **Fix, by grade:** the commit moved into `decide_proposal`, which locks the row, repeats the check under it and appends both events in one transaction (mechanical). Recorded because the failure mode is specific and recurring: prose written from a design describes the design, and the only thing that catches the gap is reading the comment back against the code beneath it (durable).

### 2026-09-09 · S12 · an existing test caught a defect in the change that added it

- **Symptom:** `writeWorkspace` rewrote `workspace/manifest.json` on every append, because `generatedAt` differs each time. The existing assertion "a second write touches nothing" went red.
- **Surfaced at:** stage 6, from a test written five iterations ago for a different reason — the mtime churn that makes a file watcher fire and a backup tool copy for nothing.
- **Owned by:** stage 5. A new file added to a set that already has a "write only what changed" rule inherits the rule, and the rule was not applied because the new file is generated rather than mirrored.
- **Root cause:** the manifest carries a timestamp, so byte equality is the wrong test for whether it changed. The digest is what the manifest is FOR, and it is what should decide.
- **Fix, by grade:** the manifest is rewritten only when `contentDigest` differs (mechanical). Recorded because the general shape recurs: a field that changes on every write makes "did this change?" unanswerable by comparison, and every generated artifact this repository writes has one (durable).

### 2026-09-09 · S03.effects · an assertion that failed against leftovers, not against a defect

- **Symptom:** `permission-not-execution` counted every `succeeded` effect in the estate and required zero. It failed reporting "2 effects succeeded without a dispatch" — both left by an earlier run of the same probe, which does not clean up.
- **Surfaced at:** stage 6, on a run where the product was already correct. The failure said the floor was open when it was closed.
- **Owned by:** stage 5. An assertion over a shared, accumulating store measures the store's history as well as the change; a red that a `db reset` turns green is not evidence about the code.
- **Root cause:** the property was written as a COUNT ("no succeeded effects exist") rather than as the INVARIANT ("no succeeded effect lacks an attempt carrying an observation"). The invariant is true whatever previous runs left behind; the count is not.
- **Fix, by grade:** rewritten as the invariant, joining intents to attempts (mechanical). Recorded here because the same shape appeared twice in two consecutive runs — S05's "some refusal carries a reason" and this one — and both times the weakness was that the quantifier was chosen for convenience rather than from the defect (durable).

### 2026-09-09 · S05 · an assertion that passed against its own planted defect

- **Symptom:** the plant that moved the trace installation BELOW the credential check did not fail anything. The assertion said "some refusal carries a reason", and the budget and session-mismatch refusals happen after the credential resolves — so they satisfied it while the earliest four exits recorded nothing at all.
- **Surfaced at:** stage 5, at the moment the plant was watched. Nothing else would have found it: the suite was green, the feature worked, and the assertion read as though it covered the case.
- **Owned by:** stage 5. Watching a plant is not a formality that confirms a test; it is the measurement that says WHICH defect the test can see, and an assertion quantified over "some" answers about the easiest member of the set.
- **Root cause:** the assertion was written from the feature's description rather than from the defect it must exclude. "Refusals carry a reason" is a property of the log; "the FIRST exit is traced" is a property of where the mechanism sits, and only the second is falsified by the plant.
- **Fix, by grade:** the assertion now names the earliest exit by its refusal string, and the plant fails it (mechanical). Recorded here because two other assertions this run had the same shape and were rewritten before being watched (durable).

### 2026-09-08 · M149 · a script that reported success without checking

- **Symptom:** the probe cases for the new tools were added by a script that printed "cases added" and inserted nothing. The anchor it searched for did not exist in the file. The probe then ran green — with five assertions that were never there.
- **Surfaced at:** stage 6, and only because the expected lines did not appear in the output. Nothing else would have caught it: a probe missing assertions passes.
- **Owned by:** stage 5. A patch script that prints its own success is the same class as a green from a check nobody has watched fail — a claim with no measurement behind it.
- **Root cause:** `print("cases added")` ran unconditionally after a `str.replace` whose result was not compared.
- **Fix, by grade:** the insert now asserts the anchor exists and re-reads the file to confirm the text landed (mechanical); recorded here because it will recur otherwise — this run edited files by script dozens of times (durable).
- **The check that catches it next time:** the assertion inside the patch, and the habit of grepping for the expected new output rather than for the absence of failures. A green run and a run with nothing in it look identical from the exit code.
- **Boundary:** the idempotency plant was not separately watched — with the tool check disabled, the append raised inside the projector instead of producing a clean assertion failure. That turned out to be the stronger fact and is recorded as such: a unique index on `asked_command_id` refuses a second question with one command id at the database level, which was then demonstrated directly.

### 2026-09-08 · M81 · the monitor that was already designed

- **Symptom:** asked whether the platform has operations monitoring, the honest answer was no — 51 journal event types and every one a business event, 31 `console.error` calls in a process without a terminal, 18 `catch {}` blocks swallowing entirely. The instinct was to design one.
- **Surfaced at:** stage 0, by looking before building. **M81 already existed**, proposed and unbuilt, and it already carried the rule the design would have had to derive: *the journal and the log are different planes and must never be confused.*
- **Owned by:** stage 0 permanently. The harvest is not a formality; it is the difference between building the thing and building a second thing beside it.
- **Root cause:** none, in the code. The near-miss was procedural, and it is the one this pipeline's harvest exists to prevent.
- **Fix, by grade:** built M81 as specified rather than a parallel design (mechanical); the reason it was taken out of queue order is recorded on the row itself rather than left to be inferred (durable).
- **The check that catches it next time:** the harvest already did. Worth an entry because it nearly did not — the measurement was convincing enough on its own to start designing from.
- **Boundary:** the probe found a real defect in my own trim: the check interval was fixed at 1000 appends, so a log capped at 50 reached 250. A cap the log exceeds fivefold is not a cap. Scaled to the cap.

### 2026-09-08 · S03.boundary · a pure read that quietly became a side effect

- **Symptom:** `policy.decide()` was a query. Adding the reservation made it write, and the policy probe went red with *"that grant is already reserved by another command"* — the command being refused by its own earlier reservation, because `decide` is called twice for one act: once to answer the operator and once before the effect is recorded.
- **Surfaced at:** stage 5, by an existing probe that had encoded the old contract.
- **Owned by:** stage 3. A function whose category changes — read to command — is a contract change, and the spec named `command_id` as the caller's own idempotency key without my noticing that the existing caller has none.
- **Root cause:** a fresh uuid per call. Two calls about one act became two commands.
- **Fix, by grade:** `reserve_effect` returns an existing reservation for the same command instead of raising (mechanical); the command id is derived from what makes the attempt what it is when the caller brings none (durable); and the probe found a second, separate defect on the way — the selection took the oldest live grant even when another command held it, refusing a caller while an unreserved grant sat beside it.
- **The check that catches it next time:** the policy probe now exercises `decide` twice for one act, which is what made this visible; and P27's race case asserts one winner between DIFFERENT commands, so the two behaviours cannot be confused again.
- **Boundary:** the plant was watched turning the suite red at the floor assertion, where the error code falls back from 42501 to 23514. P27's own line was not reached in that run because the suite stopped earlier, and that is stated rather than implied.

### 2026-09-08 · S14 · nine rows the counter could not see

- **Symptom:** the nine verification rows this run wrote were filed as `S14-REQ-001…009`. The register gate reported the totals unchanged. the counter in `scripts/check-registers.mjs` matches `^\| [A-Z]{2,6}-REQ-\d+`, and `S14` contains digits — so nine rows sat in `verification.md`, invisible to the exposure line that prints beside every gate verdict.
- **Surfaced at:** stage 8, and only because the asserted total refused to move. Nothing named the rows; the evidence was an absence.
- **Owned by:** M115, the row that exists because "suite now N probes" was a number with no referent. Its blind spot was widened once already — from three letters to six — when `FEED-REQ` would not count. The pattern was never the problem; the unstated CONVENTION was, and this run broke a convention nobody had written down.
- **Root cause:** a prefix is letters only, and that was true of every existing prefix (`ENG`, `PVR`, `BRAND`, `SCOPE`) and written nowhere.
- **Fix, by grade:** renamed to `ENVL-REQ` (mechanical); the near-miss recorded on M115 itself rather than in a new row, because that row owns the counter (documentation); the convention now stated in M115's own text (durable).
- **The check that catches it next time:** the totals are already asserted and recomputed, so the gate DID catch it — one turn later than it should have. The stronger check is a gate that refuses a `*-REQ-` row whose prefix the counter's own pattern does not match, and that is one line in `check-registers.mjs` when this recurs. First occurrence gets the instruction; a class seen twice becomes a script.
- **Boundary:** this run did not refresh the code graph or the wiki. Both are present and both are deferred to the end of the Board-unblocking chain, with the reason recorded in the brief. That is a decision, not an omission, and the map entry says so.

### 2026-09-07 · product walkthrough · a prototype can falsify its own contract

- **Found:** independent review showed a newly named fixture project inheriting Atlas history and a saved task dropping editable verification/owner/context fields. Source references and exact pre-fix mechanisms are retained in [independent review](plans/2026-09-07-product-walkthrough/2026-09-07-independent-review.md).
- **Changed:** draft scope has its own empty/summary views; switching to Atlas explicitly clears fixture state. Saved task intent retains all editable fields, while chosen owner remains unadmitted. Scope, process exit, delivery and acceptance remain separate.
- **Checked:** `custom_project_has_no_atlas_history`, `task_intent_fields_preserved`, `admission_not_reused_across_providers` and other browser cases in [receipt](plans/2026-09-07-product-walkthrough/browser-check.json). Native Fabric was not run.
- **Boundary:** CSS/script target review cannot certify RLS, manager wake or product data recovery. Those retain existing owners and require their runtime probes. No new standing instruction is needed; existing R-002/R-004 cover the distinction.


An entry is written **only when a run diverged**: the symptom with its evidence, the
stage it surfaced at, the stage that *owned* it, the root cause, the fix by grade, and
the check that catches it next time.

### 2026-09-07 · a report is not the living map

The operator's map/anchor/retro rule already existed in `CLAUDE.md`; the audit
produced separate reports without updating `docs/reports/map.html`. The owning
stage was delivery/docs propagation, not analysis. This commit moves the common
entry rule to `AGENTS.md`, retains the audit behind an index, and updates the map
with exact graph/run/manager/memory/priority anchors. The queue no longer schedules
M97/M196/M197 as unfinished foundations.

A fingerprint alone did not enforce the rule: the first gate could refresh the
old iteration and ignored ADRs/plans. Independent negative probes caught those
holes and HTML quoting/parser bypasses. The gate now uses a standards parser,
compares committed anchors/iteration and passes 19 isolated Git-fixture cases.
The probe is in CI. It proves mechanics; prose completeness still needs review.
Receipt: [priority brief and checks](plans/2026-09-07-foundation-priorities.md).


### 2026-09-05 · the gate that could not catch its own example

- **It tested the wrong thing, and the row said so in its own reproduction.**
  The check failed a citation when the file was too short or the line blank.
  The milestone's worked example is a line that held `ptys.resize(...)` — not
  blank, so green. Measured again today on live data: an audit row cited line
  132 of `ProjectHome.tsx` as a Workflows panel, the line held a statistics
  loader, the gate passed it.
- **A line number cannot be verified in substance by anything.** That is not a
  gap in the implementation, it is the form. The milestone's last sentence
  already knew: cite a symbol, which moves with the code. Living documents now
  do, a bare `file:line` in one is refused, and all six were converted first so
  the rule starts from zero rather than from a backlog nobody clears.
- **It read 4 of 97 documents while reporting "all citations resolve".** The
  same green-over-nothing shape its own header warns about, one layer along.
- **And the exclusion that remains is counted out loud.** 307 citations in 24
  dated snapshots are not checked, deliberately: an audit report records a
  moment and rewriting its receipts to match today destroys the record. A gate
  that quietly covered 2% while printing success would be worse than no gate.
- **Four refusals watched**: a line citation, a symbol the file no longer holds,
  a file that does not exist, and a basename five files share.

### 2026-09-05 · an audit row half-closed by an earlier commit in the same session

- **The Workflows panel was gone before the row was worked.** `a97a1e4` (M65)
  deleted `workflows.title` and `workflows.body` at 18:37; this iteration opened
  the row at about 21:00. The cited line — line 132 of `ProjectHome.tsx` — now holds
  a statistics loader — the citation rotted along with the claim, which is the pair M96
  exists to catch and did not, because it checks documents against code and not
  audit rows against commits.
- **Second audit row in three iterations with an expired half.** M106's (b) was
  fixed by a migration the same day it was written; M99's first half by a commit
  the same session. Measuring first is no longer a precaution, it is the step.
- **And the surviving half was described too harshly.** It was never a dead
  button: the radio was disabled and carried "Hosted estates are not built yet",
  which is more honest than the row suggests. The real defect is smaller and
  sharper — a radiogroup with one selectable option ASKS a question with one
  answer, in the form where a person is deciding what their project is.
- **Nothing is lost by taking it off.** The main process still declares `cloud`
  with `available: false` and its reason; when that turns true the choice
  returns by itself. The option was kept on screen to save that one moment of
  work, and the price was a year of showing a person a choice they cannot make.
  The test for it is written as a promise rather than as a comment.
- **A latent lie neither the row nor I was looking for.** The label came from
  `id === 'local' ? … : 'Cloud'` and the hint from `available ? localHint : …`.
  The first second available backend would have been labelled "Cloud" and
  described as living in this machine's database — a screen that lies on the day
  the data changes, which is the same shape as M113's three.

### 2026-09-05 · the board was more generous than the product, three times

- **Measured before fixing, and this time the row was right.** After M106, where
  a third of the accusation had expired, every claim here was checked first:
  `byModel` rendered in zero files, `lastCommit` existed only in `types.ts` and
  `main/`, and `ProjectStats` held nothing but facts about our own storage.
- **A reader test stays green through exactly this defect.** All three numbers
  were measured, cached and unit-tested from the day their milestone shipped.
  Nothing broke, nothing threw, and no test failed — because every test was on
  the reader. `verification.md` was honest because it verifies the reader; the
  board was not, and the board is what someone acts on.
- **The plants had to be VALID CODE.** Deleting the JSX broke the file, and a
  file that will not compile is a weaker signal than an assertion catching a
  silent omission — it proves the plant, not the test. Replacing the condition
  with `false &&` keeps the code valid and says nothing: 3, 4 and 1 red
  respectively, which is the defect as it actually was.
- **My fixture and my parser shared an assumption, so the probe passed while the
  parser was wrong.** `git log --numstat --format=''` emits no blank-line
  separators at all; against this repository's real output the parser counted 0
  commits where git counts 162. A fixture encodes the author's belief about a
  format; only the format can refute it. The probe now reads real history and
  compares against `git rev-list --count`.
- **Two of the five numbers cannot be shipped, and the row says so now.** "Lines
  of code" is not what a tracked-line count measures — on this repository its
  two largest entries are a 32 582-line icon JSON and a 20 185-line font licence
  — and tokens and cost do not exist at all per CO-096. Correcting the claim is
  the fix for those; shipping something and calling it by the wrong name would
  be the same defect wearing a tick.
- **A security control nearly got a second copy.** `HARDENED` neutralises
  `core.fsmonitor`, which a repository can use to run code in the main process,
  and it was exploited once. A second git reader made copying it the obvious
  move. It moved into `main/gitRun.ts` instead, with the hostile-config probe as
  the net.

### 2026-09-05 · a third of an audit row was wrong, and the plant that passed

- **Claim (b) was false and only driving it said so.** The row said the spawn
  failure's message reached no column. Reading the SQL suggested otherwise;
  appending a real `task.abandoned@1` against the live database settled it —
  both `abandoned_reason` and `closed_reason` receive it, and the project page
  renders it. Migration `…0016` had fixed the projector the same day the row was
  written. An audit finding is a measurement with a date on it, and this one had
  expired before it was ever worked.
- **What remained under (b) belonged to (c).** The text reaching the board read
  "the session could not start: Error: claude could not start in /repo: …" —
  the same sentence twice with a transport prefix wedged between them.
- **Forty-eight, not roughly fourteen — and that made the fix SMALLER.** Every
  one of them is the same `setError`, so all forty-eight reach the operator
  through a single banner. Fixing the display rather than the call sites covers
  them all and makes the forty-ninth right on the day it is written.
- **A plant that passed, and what it exposed.** Reverting App's early return to
  the bare `<div className="booting" />` broke NOTHING in the whole renderer
  suite: three tests exercised the surface and not one asserted that anything
  rendered it. The defect could have walked straight back in. The test that
  closes it renders `App` whole with a rejecting `meta.info()`.
- **And that test could not run at all.** Importing `App` pulls Monaco, which
  probes `document.queryCommandSupported` while its module is evaluated — before
  any spec's first line. The polyfill went into a setup file rather than into
  the spec that hit it, because the next test to render the app whole would have
  hit the same wall and would not have found a fix hidden inside one file.
- **The design gate caught a string I registered and never rendered.** A key
  nothing asks for is a sentence the brand registry still reviews and a reader
  still believes is on a screen.

### 2026-09-05 · settle the unverified half first, because it changes the answer

- **The row said UNVERIFIED and a previous probe had hung.** The bounded version
  took one run: a six-second block, and the page reporting its OWN clock. It ran
  at +6387 ms against a block ending at +6328 ms — the renderer never executed
  the page during the wait. The text was not late; it was absent.
- **Why the renderer's clock and not the main process's.** Every event a blocked
  main process would have recorded is merely DELIVERED after the block, so
  main-side timestamps cannot separate "it happened late" from "it happened
  during and was reported late". An in-page timestamp can, and that is the whole
  difference between settling this and guessing again.
- **The screenshots were worthless and I nearly used them.** Screen-recording
  permission is not granted here, so `screencapture` returned uniformly blank
  images. My first check said "the capture has real content" — it counted
  distinct bytes in a COMPRESSED file, which vary even for a blank image.
  Reading actual pixels said two distinct values across the whole frame. A
  verification method that cannot fail is not a verification method.
- **Moving the call changed what its failures look like.** Measured: a timeout
  is `spawnSync … ETIMEDOUT` synchronously and `Command failed: supabase start`
  with code NULL and `killed: true` when awaited — indistinguishable by message
  from a non-zero exit. Shipping the async conversion alone would have silently
  downgraded every four-minute timeout to "the stack refused to start", breaking
  the diagnosis shipped one iteration earlier. This is what the audit-from-above
  step is for.
- **And a defect the streaming made visible.** `execFile` kills a child whose
  output overflows `maxBuffer`, default 1 MB. A first-ever start pulling images
  could exceed it and be reported as a timeout, because a killed child looks
  like one. It predates this change; it is fixed here because reading the output
  is what made it legible.

### 2026-09-05 · three causes on the row, seven on the machine

- **Two pairs that look identical and mean opposite things.** `execFileSync`
  reports a missing binary, a missing working directory, and a timeout in two
  shapes that share a prefix: `spawnSync supabase ENOENT` for the first two and
  `spawnSync supabase ETIMEDOUT` for the third. A matcher keyed on the prefix
  tells an operator with slow Docker to install software they already have. The
  cwd case was resolved where the knowledge lives — `repoRoot` now checks that
  FABRIC_REPO exists — rather than guessed at downstream.
- **A pure function in a file that imports Electron is not testable, only
  tidier.** The first attempt left `chooseRepoRoot` in `env.ts`; the probe
  refused to load, because `import { app } from 'electron'` runs at module
  level. `menuTemplate.ts` had already been split from `menu.ts` for exactly
  this and the lesson did not transfer until the loader said so.
- **The seventh cause was found by driving, not by reading.** With an explicit
  SUPABASE_URL pointing at a stopped stack, a real run produced
  `estates read failed: TypeError: fetch failed` and landed in "we could not
  work out why" — the commonest failure there is, unnamed. Reading the code
  would not have produced that string.
- **And the run that contradicted the test was the stale build.** The unit test
  went green while the real run still said `unknown`, because `npx electron .`
  reads `out/` and nothing had rebuilt it. Same rule as before: evidence from a
  build artefact is evidence about a previous build.
- **The modal is the hazard the smoke path exists to avoid.** A
  `showMessageBoxSync` in a headless run does not fail, it WAITS — a broken-build
  check becomes a hung job. Classification happens first and the smoke branch is
  taken before any dialog, which the three terminating runs demonstrate.

### 2026-09-05 · the row was right, and incomplete in the direction that mattered

- **A push channel sharing a name with a request channel.** The watcher
  broadcast on `projects:repo-states`, which `ipcMain.handle` also answers on.
  One name, two protocols, and nothing listening to the push half — so the
  collision never showed. Splitting the name was the smallest part of the fix
  and the part that stops it recurring.
- **The watch was not inert, and saying so mattered.** Its callback drops the
  cache before notifying, so the next read was already fresh. What was dead was
  only the notification. A retro that recorded "the watch did nothing" would
  have sent the next reader looking for a bug that is not there.
- **And the part that changed the shape of the fix.** `.git` is watched
  non-recursively on purpose — watching objects is thousands of events for one
  commit — so a file EDITED in the working tree touches nothing under `.git`
  and fires nothing. The row's own consequence sentence, "an agent can rewrite
  twelve files while the strip says clean", is therefore NOT fixed by adding a
  listener. It needed a second source. That is now a probe against a real temp
  `.git` rather than a claim in a comment.
- **Three plants, three catches.** Subscription removed: 3 of 4 red. Unsubscribe
  removed: 1 red. Filter forced true: 1 red. A dead push channel breaks no
  build and throws no error, so the test is the only thing that would ever
  notice — which is exactly why the defect survived from M56 to here.
- **A test that passed for the wrong reason, and only a full run said so.** It
  waited on the SPY rather than on the reading, so the panel still held no
  paths and every broadcast went through the "not told yet" branch — the filter
  under test was never exercised. It survived five single-file runs and the
  three plants, and fell over once thirty-eight files shared the environment.
  Waiting for the branch to be on screen is both deterministic and stronger:
  the ignore case now proves the filter says no, rather than proving nothing.
- **A fixture that cast past its own contract.** `as TerminalSession` on a
  partial object hid a required `scrollback`, and the first run crashed inside
  `decodePty` instead of failing on the thing under test. The cast is gone; the
  fixture is spelled out and `tsc` now checks it against the interface it claims.

### 2026-09-05 · three drifts, and the reason there could be three

- **Nothing connected a handler to its declared return.** The preload types the
  calls, so `tsc` checked the renderer against a promise and never checked
  whether anything kept it. Three drifts had accumulated in that gap and none of
  them broke anything, which is why they lasted.
- **A failure indistinguishable from success.** `shell.openPath` resolves to an
  error string; the contract said `Promise<void>` and the handler discarded it.
  The operator pressed the button, nothing happened, and nothing said why.
- **A failed read rendered as a fact.** `RepoState.error` was produced by the
  reader and rendered by nobody, so a repository whose git call failed showed its
  stale branch with full confidence — the same class as M108, one layer down and
  found by a different route.
- **And a bridge carrying more than it promised.** `journal.replay` selects every
  column; the channel declares a narrower shape. Nothing broke, and that is the
  problem: a contract stops being a boundary the moment more than it says goes
  through, and the next column added to the journal would have travelled to the
  renderer without a decision.
- **The mechanism is applied three times and about forty handlers are
  unannotated.** That is a sweep, and the row says so rather than reading as
  closed — a milestone marked shipped for a mechanism half-applied is what I
  corrected three iterations ago.

### 2026-09-05 · the safe answer was the default

- **`EmptyState` already took `read`, and its own comment named M108 as the
  reason it existed** — and the prop defaulted to `true`. So a caller who forgot
  it claimed to have looked, and fifteen were taking that default, four of them
  the surfaces the milestone names. **A safety question you get right by not
  thinking about it is not being asked.**
- **The durable half is a TYPE rather than a gate.** Making the prop required
  turned every one of those sites into a compile error, which is a stronger check
  than any linter I could have written and cost one line. The suite carries a
  `@ts-expect-error` on an omitted prop, so the requirement itself is what is
  tested.
- **Nine of the fifteen were honest**: an error state, a missing repository path,
  the operator's own in-progress selection. Deciding each one individually was
  the work; a blanket `read` would have re-told the same lie in a new syntax.
- **The other six carry the `null` sentinel** repos and transcripts already used
  — the row's own point was that the pattern was known and unevenly applied. And
  filtering keeps the distinction: null in, null out, so a panel cannot mistake
  "no rows for this project" for "no answer yet".

### 2026-09-05 · a plant that passed, and the honest reading was "I did not reproduce it"

- **Four defects in the door every agent uses.** No `.catch` on the request
  handler, no cap on the body, a handshake that could fail silently, and an
  ordering the row called a race.
- **The first three are real and two are watched.** An agent that HANGS is worse
  than one that fails — it looks like work in progress, and its call budget is
  already spent. A body past the cap is refused BY NAME rather than truncated,
  because a truncated body parses to undefined and the agent is told its call was
  malformed, which sends it to fix a message that was fine. Watched failing: the
  oversized request answered 401 instead of 413.
- **THE FOURTH I COULD NOT REPRODUCE.** Moving the assignment back after
  `handleRequest` changed nothing either probe could see: the assignment is
  synchronous after the await, so the window the row describes is not one this
  harness can open. The reorder — minting the session id ourselves, so the state
  is set before the client can possibly know it — removes any window BY
  CONSTRUCTION, and that is a different claim from fixing a demonstrated bug.
  The verification row says the second thing, because borrowing the green from
  the other three fixes would be exactly the kind of claim this ledger exists to
  refuse.

### 2026-09-05 · the column without its writer

- **Three of five probe cases failed with one cause.** The migration added
  `task_links.needs` and the projector that fills that table was written before
  the column existed — it lists its columns explicitly, so a new one arrives at
  its default and the names the event carried are dropped on the way in. The
  RULES were right and the wiring lost the data, which is exactly the shape a
  fixture cannot see and a probe against the real store can.
- **The design's split is the point.** What a follower NEEDS is part of the plan,
  written when the chain is drawn. What a predecessor PRODUCED is part of the
  record, written when the work happens. In one place they would be
  indistinguishable, and the whole question at a chain boundary is whether what
  was promised arrived.
- **An empty value under the right name is missing.** It is the shape a
  well-meaning agent produces and it passes any check that only asks whether the
  key is there — and started on it, the follower's brief reads "review the
  report:" with nothing after it.
- **A chain counts against the loop bound.** It is exactly the hand-off M68
  bounds, and a step starting its follower outside that count would be a way
  around the only thing between a hand-off and a runaway — the prettiest way,
  because it would look like a feature.
- **A third copy of the tool list, kept on purpose.** The surface probe carries
  its own expected list beside the manifest check, so adding a tool to a
  credentialed surface requires acknowledging it where a reviewer looks. Its
  message said "the sixteen tools" as a word; the count is computed from the list
  now, because a number beside the thing it counts is one more number that can
  disagree with it.

### 2026-09-05 · I marked a milestone shipped for a mechanism it did not describe

- **M140's row said `canUseTool` into the approval queue.** What I built this
  morning is `fabric_effect_request`: the agent asks, presenting nothing, and the
  surface finds the grant. Both satisfy "the agent asks and the operator grants",
  and they differ in the way that matters: **the hook intercepts every tool call
  the runner makes; the tool intercepts only what the agent chooses to ask
  about.** An agent that does not ask is not stopped.
- **It was caught by reading the PLAN against the code**, not by any gate — the
  commit-scope gate only checks that a shipped id has a row that is not
  not-started, and this row was not-not-started and wrong. Corrected to partly
  shipped, with what closes it named: the runner's own permission hook, which is
  per-runner, and only Claude Code has one this product has verified.
- **The canonical ladder had two deferrals that shipped today** and were still
  listed as deferred — the git mirror and the first notification transport. A
  stale plan is the same defect class as a stale register, which is what this day
  has mostly been about.
- **And what remains is mostly not blocked on effort.** A model provider, an
  external service the operator runs, a second person, a per-runner hook — four
  waits that are not in this repository, and one thing (chains) that is simply
  unstarted. Saying which is more useful than another estimate, and it is the
  answer to the question this session opened with.

### 2026-09-05 · a derived queue notified naively rings forever

- **The gap the automation work opened.** Routines fire at three in the morning,
  the nightly agent takes the backlog, a hand-off reaches its bound and stops.
  All of it lands in the attention queue — which is a screen, so the operator
  learns about it when they next open the app.
- **And the queue is DERIVED**, recomputing on every read. Told about naively,
  one refusal rings every minute until it is granted. That is not an annoyance:
  it is how a product's notifications get switched off, and after that it can
  never tell the operator anything again. Each item is told about once, and the
  set forgets what has left — so a thing that comes back is told about again,
  which is right, because it is waiting again.
- **A burst is ONE notification.** Twelve at once is twelve dismissals and the
  same decision to turn it all off.
- **One transport of the four, and the other three are named rather than built.**
  Mail, a chat channel and a phone each need a credential, a budget and somewhere
  to put a failure. The one shipped needs none of that, which is why it is the
  one that could ship today.
- **`readAttention` extracted so the notifier and the screen read the same
  thing.** Two similar queries are two answers that can differ, and the operator
  would be told about something the panel does not show.

### 2026-09-05 · the fix was more dangerous than the bug

- **The bug:** no menu installed, so Electron binds Cmd+W to Close Window. Five
  projects open, one reflex keystroke, the whole working set gone with no undo —
  and no restore on relaunch either, because tabs were plain component state.
  Two defects, joined: fixing the key without persistence still loses everything
  on quit, and fixing persistence without the key leaves the reflex fatal.
- **AND INSTALLING A MENU REPLACES THE DEFAULT ENTIRELY.** The default is where
  Cmd+C, Cmd+V, Cmd+Q and the window controls come from. A hand-written minimum
  binding Cmd+W to the tab would take copy and paste away from every field in the
  product — a worse regression than the data-loss key, and one nobody would
  connect to a menu they cannot see. The template is built from Electron's ROLES
  so the platform fills them, and the probe asserts the roles survive rather than
  that the tab item exists.
- **The unimportability wall, one level down.** `menu.ts` imports
  `BrowserWindow`, `Menu` and `shell`, so it could not be loaded outside
  Electron and the risk could not be read. The SHAPE moved to a module that
  imports nothing executable and takes its actions as arguments — the same split
  the routine tick needed yesterday and the bundle compiler needed before that.
- **A draft tab is not restored, and that is the kinder answer.** Its content
  lives in renderer memory and quitting takes it whatever this does; the tab
  without it is a shape that says "your work is here" over nothing.

### 2026-09-05 · the number I could not define, and did not publish

- **M115's tally adds up to nothing** — 11, 15, 19, 22, 25, 29, 33 across seven
  rows, while the suite has neither 33 probes nor 33 assertion sites. Those rows
  are HISTORICAL and each was true at its own merge; rewriting them to make the
  arithmetic work would falsify the record. They stay, labelled, and the current
  count moved to a place a command recomputes.
- **AND I ALMOST PUBLISHED A SECOND UNDEFINABLE NUMBER.** I wrote a gate counting
  assertion sites, and it said 95 while a green run printed 65 — sites including
  the failure branch, versus assertions actually reached. Two honest measures of
  two different things, and no reason to prefer either. So none is published, and
  the ledger says why. A number I cannot define is precisely what M115 is about,
  and I was one commit from adding one to the row that complains about them.
- **M114's four-digit references were typos with an unambiguous fix:** every
  `CO-00NN` had a `CO-0NN` that exists. Corrected, and gated on the FORM — which
  is stated as what it is, because `CO-999` pointing at no row is a different
  defect and this check cannot see it.
- **THE GATE CAUGHT MY OWN PROSE.** The verification row describing the fix
  quoted the malformed id as its example, and the check flagged it — correctly.
  Documenting a bad form by writing it out makes the document an instance of what
  it describes. The rows now name the shape ("four digits where the register uses
  three") without reproducing it, which is also easier to read.
- **The M80 hole stays a hole.** An id nobody used is not a defect, and
  renumbering to close it would move every reference to every row after it.

### 2026-09-05 · twenty-eight sentences on no screen

- **M112 was cited five times this session and closed on the sixth.** The design
  gate has checked since M117 that every key a component uses exists; the reverse
  was open. A string nobody renders is a sentence the brand registry still
  reviews, the locale files still carry, and a reader still believes is on a
  screen somewhere.
- **The difficulty is dynamic keys, and a hand-written allowlist would have been
  the same failure relocated into the checker.** The prefixes are derived from
  the code instead. Two versions were too narrow: the first excluded the whole
  `i18n` directory, where `describeEvent` lives, and reported all thirty-eight
  event sentences as dead; the second required the template to sit inside
  `t(...)`, and `describeEvent` builds the key into a variable first. Widened, it
  errs towards missing a dead key rather than calling a live one dead — the right
  direction for a check whose failure blocks a build.
- **One of the twenty-eight was an hour old.** `agents.newRunner` was written for
  a control I then did not build. The gate caught my own work on its first run,
  which is the third time this session a check has done that.
- **A SLOW SEARCH FINISHED AFTERWARDS AND SAID THE OPPOSITE.** A repo-wide grep
  for the same twenty-eight keys, started before the targeted one and completed
  after the deletion, reported twenty-six of them as live. Every hit was in
  `apps/desktop/out/` and `apps/desktop/dist/` — a vite bundle and a packaged
  `.app` from a build at 16:11, both git-ignored. **Evidence from a build
  artefact is evidence about a previous build.** Had that output arrived first it
  would have argued convincingly for leaving twenty-eight dead rows in place. The
  rule this earns: a search for "is this used" reads SOURCE, and a repo-wide grep
  in this repository is not that — it includes a photograph of the past.
- **And the scenario that lied.** SCN-037 promised two cells on the statistics
  strip that M57 removed; their strings sat unrendered in the registry, so the
  document described a screen nobody could see for three weeks. The counts are
  not lost — the memory surface shows them, beside the store they are about
  rather than in a strip of unrelated numbers.

### 2026-09-05 · the skip was right about absence and wrong about presence

- **Forty-four of forty-nine scenarios said "Coverage: none yet"** while twenty
  of them had shipped, tested code. Same drift as the screens register, same
  cause: naming it was never part of the work. Twenty are connected now, and the
  remaining twenty-four are genuinely unbuilt.
- **THE GATE DID NOT HOLD WHAT I HAD JUST WRITTEN.** `check_observables` skips
  scenarios whose status is `draft` — which is nearly all of them — so every
  citation I added was validated by nothing. They are correct because I verified
  each path with a script before writing it, which is precisely the guarantee a
  gate exists to replace. Found by planting a bad path and watching it pass.
- **The fix names the distinction:** the skip is right about ABSENCE (a draft is
  not nagged for an observable it has not written) and wrong about PRESENCE (a
  draft that names a file has made a claim about that file). The coverage check
  moved above the skip.
- **A new check, narrowed after its first run.** A scenario starting on a screen
  the register calls `built` and saying only "none yet" contradicts itself. It
  found three; one was a real gap and two were a built screen hosting behaviour
  nobody has written — a legitimate state. A check that fires on a legitimate
  state teaches the reader to skip it, which is how this morning's grants gate
  earned its deletion. So the finding is "no code AND NO REASON", and saying why
  there is none is the other way out. `none yet` was a default nobody wrote;
  `none yet — the starter mechanism is not built` is a claim.

### 2026-09-05 · the code that starts agents unattended had never been run by a check

- **What was covered and what was not.** Which routines are due, whether the
  quota allows it, what the backlog brief says — all tested from the day they
  were written. The code that puts the three together and actually launches an
  agent had been executed by nothing, because it lived in `index.ts` and
  `index.ts` cannot be imported (M110). **"The file is unimportable" is a fact
  about the file, not a reason** — everything else in this repository that needed
  testing was extracted and given its dependencies as arguments.
- **The probe fakes exactly two things** — the quota, which would call Anthropic,
  and the spawn, which would start an agent on this machine. Everything between
  them is the code under test, against a real database and a real journal.
- **MY FAKE POLLUTED THE STATE IT WAS ASSERTING ABOUT.** The first `startTask`
  created real tasks, and every one landed in the backlog — so the empty-backlog
  case was asserting about a backlog its own fake had filled. It failed in the
  direction that looks like a code bug. A fake that writes to the state under
  test is not a fake.
- **And the cases could see each other.** Sharing one project made every later
  tick re-start the routines earlier cases had left never-run, so a case
  asserting "nothing started" counted spawns belonging to its predecessors. The
  tick is estate-wide by design; the assertions are now scoped the way it is not.
- **A PLANT THAT PASSED, AND IT NAMED A MISSING CASE.** Removing the overlap
  guard changed nothing, because every case awaited its tick and the overlap it
  defends against never occurred. Two concurrent ticks now start the work once —
  watched failing at two sessions. Third time this session a passing plant has
  been the finding rather than the confirmation.

### 2026-09-05 · a missing grant looks exactly like an empty table

- **Two tables shipped dead and nothing noticed.** `routines` (M13) and
  `proposals` (M68) were created with indexes, projector clauses and event types
  — and with no GRANT and no row-level security. Every surface built on them
  would have answered `permission denied` and rendered an empty list, because the
  supabase client returns `{ data: null, error }` rather than throwing and the
  calling code reads `data ?? []`.
- **THE CAUSE WAS MY OWN MIGRATION, EARLIER TODAY.** `20260905000017` closed a
  real hole and its durable half was `alter default privileges … revoke truncate`.
  Revoking from a default with no explicit entry does not subtract from
  Supabase's grant-everything default: it CREATES an entry equal to Postgres's
  built-in one minus the revoked bit — and the built-in default gives other roles
  nothing. Every table created after that migration arrived unreadable.
- **Measured, not reasoned about.** A table created in the live database today
  inherited `service_role=xtm`: references, trigger, maintain, no select. `goals`,
  created before 17, has `arwdxtm`. That single measurement settled it after two
  wrong guesses about where the grants came from.
- **I WROTE A STATIC GATE FOR THIS AND DELETED IT.** Reading the migrations for a
  missing `grant … to service_role` reported eight tables that predate 17 and work
  because they inherited. A gate with eight false positives is worse than none:
  it trains the reader to skip it. The answer is not in the migrations, and only
  the database knows it — so the check is a probe (P21) that asks the database,
  which is also how the bug was found: a probe asserting a row it had just
  written was readable back.
- **The class, stated once:** a check that the query COMPILES cannot see this. The
  one that catches it asks whether the answer comes back.

### 2026-09-05 · a collapsed panel making a false claim

- **What it said:** routines and chains "arrive with the agent runtime; today
  agents are launched by hand above". True when written, false the moment the
  routine tick shipped one iteration earlier. **A collapsed panel with a false
  claim is worse than an empty one** — it answers the question wrongly for
  anybody who opens it, and being collapsed is what stops anyone noticing.
- **The history includes what did not happen.** `routine.paused@1` exists so a
  refusal can be seen; a surface listing only successes would have made that
  journalling pointless, and the operator would learn from the absence of a
  report days later.
- **A run of pauses is a fact, not a list.** Seven rows are seven things to
  count; "has not run three times in a row — the five-hour quota window is at
  95%" is the same information as a sentence somebody reads. Left as rows, the
  operator does the derivation late, which is the same as not doing it.
- **The brand gate caught what the i18n gate cannot.** Deleting the dead string
  left its row in `docs/brand/strings.md`, and the brand linter failed the build
  on a registry row whose text is no longer in the code. That is exactly the
  reverse-direction check M112 records as MISSING from the design gate — present
  here, and it earned its keep on the first deletion of the session.

### 2026-09-05 · a bound that never trips looks exactly like one nobody has reached

- **Two silent failures, opposite directions.** Count every task in the project
  and a busy project trips the bound and stops working for a reason that has
  nothing to do with looping. Count only the immediate parent and it never trips,
  because each hand-off is depth one. The right answer is the `spawned` chain
  back to a task nothing spawned, and it needed its own tested function.
- **The chain has to be RECORDED for the bound to exist at all.** The tool now
  writes a `spawned` link on every task an agent files from the one it is
  working. Planted its removal: all four hand-offs became tasks and the bound
  never fired — indistinguishable, from outside, from a bound nobody has hit.
- **The chain parent is the session's own task, not the origin the agent named.**
  `origin` is the agent's claim about why; `scope.taskId` is what Fabric
  observed. Counting the claim would let a chain hide itself by naming something
  else.
- **A refusal an agent reads as an error is one it routes around.** The message
  says this is the bound working and that a person will decide — so the agent
  reports rather than filing the same card by another route, which is the only
  thing standing between a hand-off and a runaway.
- **A proposal is not a task and must not reach the board**, or the bound has
  renamed the thing it was meant to stop. Asserted directly.
- **Accepting does NOT reattach the new task to the chain.** A person deciding is
  what makes it a new beginning rather than round five; reattached, the bound
  trips again on the next hand-off of a chain the operator has already looked at.

### 2026-09-05 · the bound built before the thing it bounds

- **The milestone warned about itself.** M132 says a daily unattended agent
  without a quota gate and a loop bound "is exactly the shape that burns an
  account overnight", and named three unbuilt dependencies. Building the schedule
  first would have been building that shape and trusting the warning to be read
  later. The gate landed first and the schedule landed behind it.
- **The gate applies to work nobody is watching.** The operator's own hands are
  never blocked: at 99% that is their call, they are present, and they will see
  it stop. And the argument for a threshold is not about the account — it is that
  a run needs room to FINISH, because half-done unattended work leaves the board
  holding a card nobody can tell apart from one that failed.
- **An unknown quota blocks unattended work**, because absent is not zero and not
  a hundred, and a reading that failed is exactly the moment nobody is looking.
- **A refusal is an event.** M94's own words are "pause and say so rather than
  failing one by one". A routine that did not run and left no trace cannot be
  told apart from one that ran and did nothing — and the operator finds out days
  later, from the absence of a report.
- **Three ways a scheduler is quietly wrong**, each with its own test and plant:
  a catch-up reading of missed windows (a week away becomes a queue of agents
  starting together), a run started over its own predecessor, and an unreadable
  timestamp read as "a long time ago" (one corrupt row runs every tick forever).
- **A gate I wrote two iterations ago caught this work.** Four new event types
  reached the feed as machine identifiers and the design gate failed the build,
  naming the migration. That is the first time this session a check written
  earlier caught something later without me looking for it.

### 2026-09-05 · the reader refused the file the writer had just written

- **Caught by the only round trip that matters.** The mirror reader was written
  from the format in my head; run against the writer's real output it refused it
  on the first line that opens a list — `mcp_servers:` with nothing after the
  colon, which the writer emits for every non-empty list. Reasoning about the
  format would not have found it. Reading one against the other did.
- **A plant that passed, for the second time today, and it was the PLANT that was
  wrong.** I disabled the "not a field at all" branch and every test stayed
  green — because the tampered fixture (`status: active`) still matches the field
  pattern and is refused by the value check instead. Two branches, one test. The
  missing test now exists and both branches were watched failing separately. A
  plant that passes says *something*; last time it was the test, this time it was
  the aim.
- **One unreadable line refuses the whole file**, because a mirror is
  machine-written: an unreadable line is a hand edit or a newer format, and
  importing most of it drops something the operator has with nobody seeing which.
- **The setting is written only on a successful import.** A failed import that
  still pointed Fabric at the folder would leave the next mirror write
  overwriting the files it had just refused to read — the operator's estate
  destroyed by the recovery path.
- **A question is not a warning.** The banner took `tone="warn"` because that was
  the tone that compiled; the neutral one is no tone at all, and a first-run
  question dressed as an alarm teaches people to dismiss alarms.

### 2026-09-05 · a mirror that reorders is worse than no mirror

- **The rule that fails invisibly.** The point of mirroring the declared layer is
  diff and blame. A mirror whose output depends on row order still produces a
  file, still passes a round-trip, and makes every write a whole-file diff — so
  `git blame` answers "everything changed, by whoever saved last". It looks like
  it works and destroys the only reason to have it. Sorted rows, sorted arrays,
  a fixed field order, and a test that gives the same estate twice in different
  orders.
- **The allowlist is the security boundary.** The mirror names its fields and
  never spreads a row, so a column added later — a token, a cached credential —
  cannot reach the operator's git history because somebody widened a select. It
  holds by default rather than by review, and the planted row-spread proved it.
- **A fixture cannot check a mapping.** `readEstate` renames `role` to `name` and
  `provider_ref` to `runner_id` by hand. Get that wrong and the mirror is
  perfectly deterministic and describes the wrong estate — so the probe reads the
  real store, and a planted rename reported 666 projects with missing fields.
- **YAML without a YAML library, and honestly.** No dependency was added: every
  scalar is emitted as a JSON string, which is valid YAML because YAML 1.2 is a
  superset of JSON. Quoting is then correct by construction, and the strings at
  risk are exactly the operator's own — a purpose with a colon, a name with a
  quote, a Windows path.
- **What Fabric does NOT do is commit.** A product that commits for you produces
  a history in which no line was ever reviewed, which is a worse lie than having
  no history. It writes the files and initialises the repository; the commit is
  the operator's, because a commit is a claim that somebody looked.

### 2026-09-05 · a test that passed against the defect it was named for

- **The probe said** "a grant withdrawn after the agent was created stops it at
  launch". I removed the check it was testing and **it stayed green** — because
  the fixture's gateway did not serve the withdrawn server either, so
  `planServers` refused for its own reason and the assertion could not tell the
  two apart. One assertion, two rules, and the weaker one was doing the work.
- **Fix:** the fixture's gateway now serves the server, so only the project's
  ceiling can withhold it, and the assertion also requires the words "does not
  grant". Re-planted: the removal now produces no error at all — the agent WOULD
  have started — and the probe fails.
- **The lesson is about plants, not about this test.** A plant that fails is
  evidence; a plant that PASSES is evidence too, and it says the test is not
  covering what its name claims. I nearly recorded the first green as a watched
  failure.
- **`agents.ts` predicted this migration and named its trigger** — "the first
  agent that must exist without a release". The distinction that let the
  prediction come true without the registry moving is one the note did not draw:
  a runner is a program, an agent is a configuration of one. Nothing in
  `agents.ts` grew.
- **Measured, not assumed:** a launch option is either `claude-code` or a uuid,
  and asking a uuid column about `claude-code` is an ERROR rather than an empty
  row. Unguarded that query breaks every ordinary launch in the product.

### 2026-09-05 · a grant that would have pointed at nothing

- **The guess I nearly shipped:** the planner composed a gateway URL as
  `<origin>/<name>`. The real route on this machine is `<origin>/mcp/<name>`,
  read from the gateway's own config. Every granted server would have been
  written into the bundle pointing at nothing, and the agent would have found out
  mid-run — the exact failure the all-or-nothing rule exists to prevent, arriving
  through the door that rule does not watch.
- **Fix:** the route is READ, never composed. `GatewayFacts` carries `name → path`
  as the gateway declares it, and a test asserts a server served at an arbitrary
  path is honoured. A convention Fabric cannot verify is one it must not invent.
- **The second thing I nearly assumed:** that a URL was enough. The gateway
  authorises each hop with an `x-agw-key` header, so a keyless entry answers 401
  the first time it is used. Measured by looking at the shape of a working entry
  — keys only, never values.
- **And the key is GIVEN, not discovered.** One is sitting in the operator's own
  agent configuration on this machine. Reading it to borrow it is precisely the
  move this product refuses elsewhere, so it comes from the environment and is
  stored nowhere: a key in `projects` is a key in every backup of it.
- **I took an ADR number that was taken.** `0032` already belonged to "project
  memory is verbatim-first". The docs gate caught it — `ERR: duplicate ADR
  numbers` — which is the second time today a gate has caught an id I invented
  rather than looked up, after `M146`. Looking up the next free number is one
  `ls`; the habit is to run it, not to count from the last one I remember.
- **Refused by design, worded as such.** "Direct is not implemented" reads as an
  oversight somebody fills later. The refusal names the credential rule instead,
  and a test asserts the wording — the only place I have made a test assert
  *prose*, and it is load-bearing here.

### 2026-09-05 · the backlog was a place a person could not write to

- **Measured, not assumed:** `task.created@1` had exactly ONE writer — the agent
  surface — and the operator's only door was `tasks.start`, which spawns a
  session immediately. There was no way to put a thought on the board without
  starting something.
- **The collision, and how the rule survived it.** `fabric_task_create` refuses a
  card with no origin, and that rule is what stops an agent filling the board
  with hunches. An idea has no evidence — that is what makes it an idea. It is
  not an exception but an instance: the origin is the PERSON who had it, which is
  a real answer at the operator's door and an unverifiable one at an agent's.
- **Researching an idea is not doing it.** A session attached to the idea's own
  card would be claimed and moved, and the board would then say the idea is done
  when what is done is the reading. Research spawns a linked task; the idea stays
  until a person decides.
- **A BUG I WOULD HAVE SHIPPED, caught by reading the projector instead of
  assuming its shape.** The note event needs `note_id` — it is the row's primary
  key, not a label — so without it the insert fails on a null key and takes the
  whole append with it. The idea would have been filed and its note silently
  lost. Read the clause before writing the event.
- **`startTask` extracted** rather than copied: the research door needs the same
  act, and two implementations of "start a task" are two implementations free to
  disagree about what gets journalled.

### 2026-09-05 · a figure that cites a source it will not open

- **The rule was written and applied nowhere.** Thirteen numbers on two screens
  named their register in words; none was pressable. It is the same defect this
  session spent a day removing from the DOCUMENTS, standing in the interface.
- **Two ways to reintroduce it, both closed.** A pressable figure that goes
  nowhere: the existing pattern was `getElementById(a)?.scrollIntoView(…)` and
  the `?.` swallowed a missing target — rename a section and the number stays
  pressable and dead. And a figure wired to a section nobody renders: the anchors
  are a union type, and the gate holds that list equal to the ids the screens
  draw. Watched failing on a rename, which is how it will actually happen.
- **What was NOT wired, and why that is the same rule:** seven figures have no
  register surface. They stay unpressable and name nothing. Giving one a tooltip
  saying where the rows "would" be is the original defect with extra steps.
- **I ASSERTED A GAP THAT WAS NOT THERE.** I wrote that `Stat` "was imported by
  this suite and asserted about nowhere", having grepped for it and stopped at
  five matches — the existing test lives in a `describe('Toolbar and Stat')`
  block below the cut. My planted defect failed TWO tests, and the second one was
  the evidence that my claim was false. Duplicate removed; only the genuinely
  missing half kept. **`head -5` on a grep is a sample, and a sample cannot
  support the word "nowhere".**

### 2026-09-05 · a status with no provenance is a claim with no owner

- **What was missing:** the board showed a column position and not the hand that
  put the card there. For `review` those are opposite statements — an agent
  saying "I believe this is done" and a person saying "come back to this" — and
  the whole product rests on an agent's account being a claim.
- **The display is the last place 4.1 can be broken.** `ladder.ts` forbids an
  agent reaching a terminal state in two places, and the tool's schema cannot
  phrase it. If the journal says it happened anyway, the card SAYS SO in a
  different colour. A projection may not quietly disagree with the journal, and
  neither may a stylesheet.
- **The function is deliberately quiet.** It speaks twice and is silent
  everywhere else — a line under every card is a line nobody reads, and the
  silence around `done` is what makes the warning loud.
- **TWO WRONG PREMISES, both found by running the probe rather than reasoning:**
  a move to an invented state is not a refusal (the CHECK rejects it and
  `append_event` rolls back whole — atomic, nothing poisoned, unlike the DAG
  failure); and `abandoned` never exists at rest, because the post-fix
  normalises it in-transaction. Both are now written into the probe, next to the
  case that IS reachable.
- **A third thing that looked like a defect and was not:** the probe moved a
  cancelled task back to running. The ladder is enforced at both write
  boundaries; a direct journal append bypasses them, which is what a harness does
  and no product code does.
- **AND I SILENCED A GATE AGAIN — the same mistake, one hour after writing the
  rule down.** `node scripts/check-probes.mjs >/dev/null && node <probe>`: it
  caught my bare backtick, `&&` short-circuited, and I read Node's syntax error
  instead. The written rule did not stop me; what does is a habit, stated as a
  procedure rather than a principle: **when a chained command fails, re-run the
  first element ALONE before diagnosing anything.** I did that the first time
  and skipped it the second.
- **A probe asserting against its own history:** the test estate is not reset
  between runs, so a fixed actor name matched a row the same probe wrote an hour
  earlier. Unique per run now.

### 2026-09-05 · a reverse lookup that would have looked built and done nothing

- **The trap:** `origin_ref` is a free string, and the obvious reverse lookup
  compares it whole. `docs/adr/0014.md:22` and `docs/adr/0014.md:40` are two
  tasks from one document, and compared whole they are strangers. Every task
  would show its origin, the sibling list would be empty forever, and nothing
  about the screen would say so. **A feature that silently does nothing is worse
  than one that is missing**, because the missing one is on a list.
- **Fix:** the location is separated from the document, and the comparison is a
  named function with its own test rather than an expression inside a query.
- **And the naive split is its own defect:** `ref.split(':')[0]` turns
  `https://example.com/decisions` into `https`. Only a TRAILING `:12` or
  `:12-40` is a location. Watched failing on exactly that.
- **Coverage stated rather than implied:** the rule is tested, the main-process
  query that honours it is not. `index.ts` is unimportable (M110), so all ~35
  IPC handlers need Electron. The verification row says so instead of borrowing
  the unit test's green.

### 2026-09-05 · a shortcut that reads the project is a briefing, not a slogan

- **What changed:** three presets existed and all three were constants. M121 asks
  for the other kind, and a preset that reads the project is a different object:
  it hands the agent what Fabric already knows instead of a sentence telling it
  to go and find out.
- **The rule with teeth:** a truncated list must SAY it was truncated, and the
  count must be the true one. Pasting the first eight rows and saying nothing is
  how an agent concludes the backlog holds eight things. Silent truncation reads
  as completeness — the same family as "absent renders as zero", pointed the
  other way.
- **An empty source is not offered.** Not a lie by omission: the list is a set of
  OFFERS and the board is where an empty backlog is stated. An offer that cannot
  be honoured is worse than no offer.
- **What was NOT built, and named rather than implied:** M121 also lists "errors
  in production". Nothing here observes production (M129). A shortcut opening a
  session to inspect a signal we do not collect is a promise the product cannot
  keep, so it is absent and the scenario says why.
- **A finding that changed the plan.** This iteration nearly went to surfacing
  `session.oriented@1`'s ABSENCE in the attention queue. It would have broken
  that module's own stated rule — "a queue that names a problem and offers no act
  is a list of complaints" — because there is no act for a session that never
  read its rules. The signal is a diagnostic about our delivery, not an operator
  alert, and it stays a query until it has somewhere honest to go.

### 2026-09-05 · every fraction was half-checked, and every numerator was wrong

- **Symptom:** the exposure sentence carries three fractions. This gate had
  recomputed all three DENOMINATORS since M96 and no numerator ever. Checked for
  the first time today, **all three were wrong**: milestones 23 against 22,
  verification rows 97 against 59, carry-over 78 against 76.
- **Root cause:** a fraction is one claim, and half-checking it is worse than not
  checking it — the verified half lends its credibility to the half nobody read.
- **How the second one surfaced:** I wrote a `FEED-REQ` row and the total did not
  move. The counter matched a prefix of two to three letters, so four-letter
  prefixes were invisible — **the blind spot M115 already records about the five
  `BRAND-REQ` rows.** I had read that row this session. Reading it did not stop
  me writing a four-letter prefix; walking into the wall did.
- **Fix, grade 3:** the pattern widened to two–six letters, and every numerator
  recomputed by the gate. Three fractions, six halves, all measured.

### 2026-09-05 · the receipt was a machine identifier

- **Symptom:** the feed rendered `e.type` — `task.note.promoted@1` — into the
  interface, on the estate home, the project home and the task page at once.
- **Why no gate saw it:** every check in `check-design.mjs` reads SOURCE, and
  this text arrived as data. The literal rule is blind to a variable by
  construction. The product asks an operator to check an agent's claim against
  the journal; a receipt nobody can read is not a receipt.
- **Fix, grade 3:** one sentence per registered event type, and the gate holds
  the two sets equal in BOTH directions — including the orphan direction M112
  records as unchecked everywhere else.
- **The gate's first version was wrong in a way that named itself:** it bounded
  the insert statement at the first `;`, and several event notes contain a
  semicolon mid-sentence. It found 16 types and reported the other 22 as orphan
  sentences. A bidirectional check catches its own parser; a one-directional one
  would have said "all 16 have sentences" and passed.
- **The brand linter caught my copy, correctly.** Two strings used an em-dash
  where the real mark was a colon and a comma. B062 is right: a dash stands in
  for the mark you did not choose.
- **AND THE RELATIVE-PATH TRAP, AGAIN.** Restoring a planted file, I ran `cd ..`
  from `apps/desktop` and landed in `apps`, so the `cp` failed and the plant
  stayed in the tree. Same family as the backup incident already in this log.
  The rule now has no exception: **a restore path is absolute, and the restore is
  verified by CONTENT before moving on.** Here it was — `grep -c` returned 1.

### 2026-09-05 · the rules were served and nothing delivered them

- **Symptom:** M123's tools shipped and the register said the skill half had not.
  What actually asked an agent to read its rules was one sentence inside a tool
  description. An agent that never called `fabric_whoami` never learned it may
  not close its own task — and nothing noticed.
- **Fix, grade 3:** a preamble the adapter carries, a test forbidding it to name
  any tool but `fabric_whoami`, and `session.oriented@1` journalled so the
  instruction is OBSERVED rather than assumed to have worked.
- **The flag was checked against the binary, not against memory.** `claude
  --help` lists `--append-system-prompt`, and a print-mode call with a planted
  codeword returned it. A flag a runner silently ignores passes every test
  written here and delivers nothing — reading the help would not have caught
  that; running it did.
- **I SILENCED THE GATE THAT HAD THE ANSWER.** A bare backtick went into a probe's
  template literal — the exact defect `check-probes.mjs` exists for. I ran it as
  `node scripts/check-probes.mjs >/dev/null && node <probe>`; it exited 1 with the
  file and line named, `&&` short-circuited, and I read Node's syntax error and
  went looking for why the gate had missed it. It had not missed it. **Never
  redirect a gate's output to /dev/null in the same command that depends on its
  result** — the exit code tells you something failed and throws away what.
- **And a table name written from assumption:** the probe queried `events`; the
  journal table is `journal`, and the same file already read it correctly three
  lines further down. The test failed for a real reason and the code was right,
  which is the good version of this mistake.

### 2026-09-05 · ten commits shipped a milestone id that did not exist

- **Symptom:** the register said `proposed` about nine milestones that had
  shipped, and the scope `M146` appeared in ten commit subjects while no row
  M146 existed anywhere. The asserted shipped count was also already wrong by
  one before I touched it.
- **Root cause:** a status column nothing could contradict. `check-registers.mjs`
  recomputed every DENOMINATOR the documents assert and never a numerator, and
  nothing ever compared a row against the history that names it.
- **THE FINDING IS A REPEAT OF ONE THIS REPOSITORY ALREADY RECORDS.** M114 says
  "two register id spaces leak — M80 does not exist". I then invented M146 the
  same way, in the same file, three weeks later. Writing a finding down does not
  prevent it; only a gate does.
- **Fix, grade 3:** a milestone id in a `feat`/`fix` commit scope must have a
  row, and that row may not read as not-started. It was watched failing against
  reality rather than a plant — the strongest form available, because the defect
  was already there.
- **Degradation stated on purpose:** a shallow clone sees fewer commits, so the
  check finds fewer contradictions. The failure mode is a missed finding, never
  an invented one. With no git at all it says so instead of passing quietly.
- **A green line over an empty measurement, found in the same file:** the
  citation check printed "all 0 file:line citations resolve" while the only
  citation in those documents was skipped as unresolvable, under a comment
  claiming another gate would catch it. That gate checks markdown links; this is
  inline code. Bare basenames now resolve against the tree and an unresolvable
  citation fails.
- **And a plant that failed to fail because the PLANT was wrong:** the first
  citation plant was written with `\`` inside single quotes, so the closing
  backtick sat behind a backslash and the regex correctly ignored it. Checked
  rather than assumed — a silent gate is a hypothesis about the gate OR about
  the plant, and the second is likelier.

### 2026-09-05 · the register said "designed" about seventeen shipped screens

- **Symptom:** every screen in `screens.md` carried status `designed`, including
  ones shipped weeks ago and ones whose STATE ROWS I had been updating in the
  same file, in the same edit, every iteration.
- **Root cause:** "built" was a word in a column and not a claim about anything.
  Nothing could check it, so nothing did, and updating it was never part of the
  work — while the rows RIGHT BESIDE IT were kept current, which is what made
  the drift invisible from inside.
- **Fix, grade 3:** a built screen must name its component and the linter
  resolves the path. "Built" is now a claim that can be wrong, which is the only
  kind worth writing. It caught my own error on its first run: I had written the
  path without `src/` for all seventeen.
- **AND I DESTROYED MY OWN WORK UNDOING A PLANT.** `git checkout screens.md`
  reverted the file whole — the planted line and the seventeen real edits with
  it, because the file had uncommitted work in it. Same family as restoring from
  a backup I had not verified: an undo that is coarser than the change it is
  undoing.
- **Check that catches it next time:** never `git checkout` a file that holds
  uncommitted work to undo a plant — reverse the plant by the same edit that
  made it, or commit first. The plant is one line; the file is not.

### 2026-09-05 · the architecture record stood still for ten iterations

- **Symptom:** nine surfaces were built after the eight-step order finished, and
  `operating-surfaces.md` still described only the eight. Decisions that shaped
  them — where a model is missing build the half that needs none; operator-local
  state is not estate truth; a duplicated list needs a gate — existed only in
  commit messages and code comments.
- **What was NOT neglected, which is why it went unnoticed:** screen states,
  verification rows and retrospectives were written every single iteration. The
  documentation that says WHAT a surface does was current; the one that says why
  the pieces are shaped as they are was not, and nothing distinguishes those two
  from inside a run that is producing plenty of documentation.
- **Root cause:** this repository's rule is "documentation ships in the same
  change as the code", and I read that as satisfied by the registers. The
  architecture record answers a different question and has a different reader —
  the person returning in a month, who reads a document rather than a git log.
- **Fix, grade 2:** §9 written, covering what the nine surfaces settled. Written
  in the same change as the last of them rather than as a separate documentation
  task, because a documentation task is the thing that never ships.
- **Check that catches it next time:** none automated, and saying so is the
  honest part. `check-docs.sh` verifies structure and links, not whether the
  architecture describes what exists — a gate for that would have to know what
  "described" means. The signpost is in §9's own opening paragraph, which says
  the catch-up is what it is correcting.

### 2026-09-05 · M17 · a field only a test read, and the test made it look implemented

- **Symptom:** `surfaceAdapter` was declared on every agent descriptor in step
  6 and nothing in production read it. The bundle compiler hardcoded Claude
  Code's flags for every agent that connects, so a second one would have been
  launched with another program's arguments — failing to start, or starting
  with no Fabric tools and no complaint.
- **What made it invisible:** a test. `expect(describeAgent('claude-code')
  ?.surfaceAdapter).toBe('mcp-config-flag')` asserts that a constant equals
  itself, and it reads exactly like coverage of a dispatch that did not exist.
- **Root cause:** step 6 designed the seam and implemented one side of it,
  because with a single connecting agent both sides look identical. The claim
  "a third agent is one descriptor row" was never exercised.
- **Fix, grade 3:** the compiler dispatches, an unimplemented adapter REFUSES
  by name, and the descriptor gained `env` — which a third agent needs and
  could not express, making the one-row claim false on a second count.
- **Check that catches it next time:** the claim was tested by DOING it. A
  design assertion about extension ("adding one is one row") is worth exactly
  the first time somebody adds one, and until then it is a hope with a test
  beside it.

### 2026-09-05 · audit · a warning I wrote did not survive my own next edit

- **Symptom:** a bare backtick inside a probe's script template, for the FOURTH
  time in one run — in the file that already carried a warning about exactly
  this, written by me, two edits earlier.
- **Root cause:** the warning was prose inside the file. Reading it requires
  opening the file at the top and remembering it while editing the middle, and
  neither happens when the edit is scripted.
- **Fix, grade 3:** `scripts/check-probes.mjs` fails the build on a bare
  backtick inside any `const script = \`` template, and runs in CI's fast tier.
  On its first run it found a SECOND occurrence in the block I had just written
  and not noticed — which is the whole argument for a gate over a note.
- **The general lesson, and it has now cost four incidents:** a rule that
  depends on being remembered is not a rule, it is a hope. Three earlier retros
  this run ended with a comment in a file; this is the first that ends with
  something that fails.

### 2026-09-05 · M140 · a clickable container with a button inside it, three times

- **Symptom:** `Panel onClick` and `Row onClick` both render a real `<button>`,
  and three separate surfaces put another button inside one — the estate card's
  pin, the attention queue's grant, and nearly the task card before it was
  caught by design in step 4.
- **Root cause:** the rule lived in ONE component's header, where only someone
  reading `TaskCard` would meet it. Every other author reaches for the
  interactive container because it is the shortest path to a clickable card.
- **What did NOT catch it:** the typechecker (both are valid React), the design
  gate (the classes are all declared), and the component tests (neither surface
  is rendered). Only reading `Panel` did.
- **Fix, grade 2:** the rule moved into the REGISTRY, on `Row`, where every
  author of a list row already looks — and it names the shape that replaces it:
  a plain row with two sibling controls where both a navigation and an action
  are needed.
- **Check that catches it next time:** none, honestly. Enforcing "no interactive
  descendants" needs either a runtime check in the component or a lint rule, and
  neither is written. The registry note is a signpost, not a gate, and this
  entry says so rather than implying the class is closed.

### 2026-09-05 · R4 · I restored a file from a backup that was not mine

- **Symptom:** `digest.ts` became 448 lines of unrelated Python. The module was
  new and untracked, so git could not restore it; I rewrote it from context.
- **Root cause, and it is worse than a slip.** The backup `cp` used a RELATIVE
  path from a directory a previous command had changed, so it failed. `/tmp/dg.bak`
  nevertheless EXISTED — written by something else entirely — and the restore
  `cp` copied a stranger's file over my module and reported success.
- **My own guard fired and I did not read it.** The command was
  `cp … && test -f … && echo "backup exists"`, and the echo never printed.
  Verifying existence was the right idea and existence was the wrong property:
  a shared path can exist for reasons that have nothing to do with you.
- **Fix, grade 3, three parts.** Backups go to the session scratchpad, which is
  isolated, rather than to `/tmp`, which is everyone's. The verification checks
  CONTENT — `grep -q digestOf` — not existence. And the plant is not applied
  until that check passes.
- **The other half is a repeat.** Three `cd` chains failed again, and vitest ran
  from the repository root twice more, producing 37 failures where I predicted
  one — the exact trap I documented ONE ITERATION EARLIER. A warning in a config
  file did not survive contact with the next command I typed.
- **Check that catches it next time:** every vitest invocation names its
  directory in the same command, and no chain relies on the cwd a previous
  command left behind. Written here because the last version of this lesson was
  written as prose in a config file and did not hold.

### 2026-09-05 · R3 · a test runner that lies from the wrong directory

- **Symptom:** planted defects produced failure counts that made no sense — 37
  where I expected 1, and unrelated component tests failing beside the real one.
  Twice in one run I went looking for a defect that was not there.
- **Root cause:** `vitest` from the REPOSITORY root finds no config, because
  vitest is a dependency of `apps/desktop` and not of the root. It scans with
  its defaults, without jsdom, and four component tests fail for want of a DOM.
  The tests were fine; the invocation was wrong.
- **Fix, grade 2, and the smaller option was chosen deliberately:** a root
  config was written and then REMOVED — it needs vitest in the root's
  dependencies, which is a real dependency added to fix a mistyped command, plus
  a second copy free to drift. The warning now sits in
  `apps/desktop/vitest.config.ts`, where someone configuring a run will read it.
- **The other half, and it is mine:** three separate `cd` chains failed this
  iteration, one of them leaving TWO planted defects in place with no backup,
  because the backup command was in the half of the chain that never ran. The
  file was new and untracked, so git could not restore it either.
- **Check that catches it next time:** absolute paths in every plant-and-restore
  sequence, and the backup verified to EXIST before the plant is applied — the
  same "assert your own premise" the single-instance experiment taught, applied
  to the setup rather than to the measurement.

### 2026-09-05 · R1 · the same structural defect, in a second file, one iteration later

- **Symptom:** assertions appended to `reconcile.test.mjs` never ran. The file's
  summary and `process.exit(0)` sat mid-file, exactly as `transcripts.test.mjs`
  did — a defect I had found, fixed and written a retro about ONE ITERATION
  EARLIER.
- **Surfaced at:** stage 7, when the new assertions produced no output at all.
- **Root cause:** the previous fix repaired one file and the retro described the
  incident rather than the class. Nothing checked whether any OTHER probe had
  the same shape, so the second instance was waiting to be walked into.
- **Fix, grade 3:** the summary moved, a comment in each file says why it must
  stay last, and — the part that closes the class — every probe was swept for
  the same shape. Exactly one other file exits mid-body, and it is a `done()`
  helper called from many places rather than a summary, so it is correct.
- **Check that catches it next time:** when a defect is found in one file, SWEEP
  for it before writing the retro. A retro that describes an incident teaches;
  a retro written after a sweep is the only one that can claim the class is
  closed.

### 2026-09-05 · R1 · an experiment whose control arm never ran

- **Symptom:** I concluded that removing the single-instance lock let a second
  app reach bootstrap — from a run where the holder process had never started.
  A `cd` in a compound command failed, the `&&` chain skipped the launch, and I
  read the result as if the setup had held.
- **Surfaced at:** re-reading my own transcript before writing the verification
  row · **Owned by:** the experiment, which asserted nothing about its own
  premise.
- **Root cause:** a two-process experiment has a SETUP that can fail silently,
  and I checked the outcome without checking the setup. The earlier prediction
  in the same iteration was also wrong — I expected removing the `isPrimary`
  flag to let the second instance through, and `app.quit()` alone was fast
  enough that it did not.
- **Fix, grade 2:** the experiment was rerun as a matched pair, each arm
  verifying `kill -0` on the holder before drawing any conclusion, and only then
  recorded.
- **Check that catches it next time:** an experiment must assert its own
  premise. "Did the thing I am measuring against actually exist" is the first
  assertion, not an assumption — and a result read from a failed setup is worse
  than no result, because it is confident.

### 2026-09-05 · R1 · a scripted rewrite over code structure, and backticks for the third time

- **Symptom, twice in one iteration.** A Python script rewrote six database
  reads by matching "lines that start with a dot" and mangled a multi-line
  `.select(` into unparseable code. And a `${...}` inside `agent-surface.test.mjs`
  was interpolated by the FILE rather than reaching the script it writes — the
  third time in this run, in the same file family.
- **Surfaced at:** the typechecker and the parser, immediately in both cases.
  Cheap, but only because those gates exist.
- **Root cause:** a clever transformation over code SHAPE is fragile in a way a
  transformation over code TEXT is not; and a file whose content is a template
  literal is hostile to every backtick written into it, which is invisible until
  the parser complains.
- **Fix, grade 2:** the six reads were edited by hand, one anchor at a time. And
  `agent-surface.test.mjs` now carries a warning at the top of its template
  literal saying what it eats, because the lesson evidently did not survive two
  earlier repetitions.
- **Check that catches it next time:** for the first, prefer six exact anchors
  over one heuristic — the anchors fail loudly and individually. For the second,
  the warning is in the file where the trap is, which is the only place a note
  gets read.

### 2026-09-05 · R0 · a probe whose exit code was decorative

- **Symptom:** the transcript probe printed `FAIL` and exited 0. The suite was
  green over a real failure, and the exit code — the very thing an earlier retro
  this run established as THE check — was the thing lying.
- **Surfaced at:** stage 7, planting a defect and reading `$?` instead of the
  output · **Owned by:** the probe's own structure, and then by me for appending
  to it without looking at where it ended.
- **Root cause:** `if (failures > 0) process.exit(1)` sat in the MIDDLE of the
  file. Everything below it — including two blocks added over this run — ran
  after the count was taken, so their failures were counted by nobody.
- **Fix, grade 3:** the summary moved to the end of the file, with a comment
  saying why it must stay there.
- **Check that catches it next time:** when adding to a probe, plant a defect
  and confirm the EXIT CODE moves, not just the output. An assertion whose
  failure cannot change the exit code is a printed opinion.
- **The wider lesson:** "verify by exit code" was the right rule and is not
  self-enforcing. A harness can produce an exit code that means nothing, and the
  only way to know is to make it fail on purpose.

### 2026-09-05 · R0 · predicting the failure count found a hole in the test

- **Symptom:** a planted defect failed as expected, and the NUMBER was wrong —
  five failures where I had predicted seven.
- **Surfaced at:** stage 7 · **Owned by:** stage 7, in a fixture written by hand
  beside a list it was supposed to cover.
- **Root cause:** `WITHHELD_FROM_SESSIONS` names six variables; the fixture set
  four of them by hand. The stripping of the other two was asserted by nothing,
  and the suite was green either way.
- **Fix, grade 2:** the fixture is built from the list —
  `Object.fromEntries(WITHHELD_FROM_SESSIONS.map(...))` — so a name added to the
  denylist is tested by the act of adding it.
- **Check that catches it next time:** predict the COUNT, not just the fact, of
  a planted defect's failures. The previous retro said to name the assertion
  that must fail; this one extends it — name how many, because a fixture that
  covers a list partially is invisible to any check that only asks "did it
  fail".

### 2026-09-05 · M146 · three plants that changed the code without changing the measurement

- **Symptom:** across steps 4, 7 and 8 a planted defect failed to fail. Removing
  the ladder's terminal branch still refused the move; flipping one null-branch
  of a comparator left an inconsistent comparator whose output on that input was
  unchanged; unprefixing one of two id namespaces left them still distinct.
- **Surfaced at:** stage 7 each time · **Owned by:** stage 7, in how the plant
  was chosen rather than in the tests.
- **Root cause:** I was planting where the code LOOKED responsible instead of
  where the assertion actually reads. Each plant changed a line the test does not
  observe, so a passing suite proved nothing either way.
- **Fix, grade 2:** before planting, name the exact assertion that must fail. If
  it cannot be named, the plant is aimed at the wrong line — and if the named
  assertion then passes, the TEST is the thing to fix, which is how the terminal
  branch's message came to be asserted at all.
- **Check that catches it next time:** a plant that does not fail is a finding,
  never a reassurance. Two of these three turned into real test improvements
  precisely because the silence was treated as a defect.

### 2026-09-05 · M146 · counting FAIL lines is not running the tests

- **Symptom:** for six commits I verified with `pnpm test | grep -c '^  FAIL'`
  and read `0` as green. The suite had been exiting 1 the whole time. A schema
  probe package I never looked at was failing, and among its failures was a
  door I had opened myself.
- **Surfaced at:** stage 8 of step 7, when a probe crashed on a syntax error and
  printed no FAIL lines at all — `0` again, from a probe that never ran. That is
  what made the measure visibly wrong.
- **Owned by:** stage 8 of step 1, where the habit started.
- **Root cause, and it has two halves:** grep counts a STRING, and a run that
  dies produces no string; and I was reading one package's output as if it were
  the workspace's. `pnpm -r test` fails the run, not the grep.
- **What it hid, which is the reason this entry is grade 3:**
  `create or replace function apply_projections` RESETS privileges to the
  default, and the default is EXECUTE to PUBLIC. Migration 6 had closed that
  door on purpose — "a projection can be written with no event" — and step 1
  reopened it. `packages/schema`'s P12 probe existed for exactly this and had
  been reporting it since the first commit of this run.
- **Fix, grade 3:** verification is `pnpm test >/dev/null; echo $?`. An exit code
  cannot be produced by a process that died before printing.
- **Check that catches it next time:** the exit code IS the check. Where a
  summary line is read instead, it must come from the runner rather than from
  grep over its output.

### 2026-09-05 · M146 · the planted defect that failed to fail

- **Symptom:** removing the ladder's terminal-state branch broke nothing. Every
  test still passed, which looked like the branch being redundant.
- **Surfaced at:** stage 7, watching a defect fail · **Owned by:** stage 7, in a
  test that asserted the verdict and not the sentence.
- **Root cause:** the move IS still refused without the branch — by the empty
  row in `LADDER` — so `ok === false` held. What changed was the words: the
  operator would have read "done does not lead to running — from here a task
  goes to ", trailing off into nothing. In a product whose refusals are read by
  a person, THE EXPLANATION IS THE FEATURE, and the test could not see it.
- **Fix, grade 2:** the terminal test asserts the reason contains "closed
  state", and re-planting now fails as it should.
- **Check that catches it next time:** where a refusal is shown to a person,
  assert the words and not only the verdict. A defect that fails to fail is
  worth more attention than one that fails — it means the test was measuring
  something other than what it claimed.

### 2026-09-05 · M146 · a planted defect wrote data that outlived the plant

- **Symptom:** disabling the DAG trigger to watch the probe fail let three
  cyclic edges reach the test estate's JOURNAL. Re-enabling the trigger did not
  undo them — the journal is append-only. `rebuild_estate_projections` then
  aborted at that event and the estate could never be rebuilt again. The memory
  eval, which rebuilds as its third act, failed twenty minutes later and looked
  unrelated.
- **Surfaced at:** stage 8, running the suite · **Owned by:** stage 7, in a
  watched-failing method chosen without asking what the defect WRITES.
- **Root cause, and it is two:** (1) planting a defect by disabling a guard on
  durable writes leaves the bad writes behind when the guard returns; (2) the
  guard was in the wrong place to begin with — a projector that can refuse makes
  the estate unrebuildable, which the plant merely exposed.
- **Fix, grade 3:** the check moved to the write boundary, so the projector
  drops and warns instead of aborting — and the poisoned journal healed itself
  with no data surgery. The probe now plants nothing: it asserts the function,
  attempts a direct write, and rebuilds the estate WITH the bad event in it.
- **Check that catches it next time:** watched-failing on anything that guards
  durable writes must plant by ATTEMPTING the forbidden thing, never by removing
  the guard. If the only way to see it fail is to turn it off, the assertion
  belongs one layer up.

### 2026-09-05 · M117 · the chain was written from one side and checked from the other

- **Symptom, twice:** seven screens registered as orphans, then two more, because
  each screen carried `Used by: FLW-x` while `docs/ux/lint.py` checks the opposite
  direction — a flow must NAME the screen inside its mermaid. Both times the linter
  found it; both times the fix was writing flows I should have written first.
- **Surfaced at:** stage 9, running the linter · **Owned by:** stage 3, where the
  screen and its flow are one thought and were written as two.
- **Root cause:** the screen entry has a field that LOOKS like the link
  (`Used by`), so writing it feels like closing the loop. It is a label, not an
  edge. The edge lives in the flow.
- **Fix, grade 2:** whenever a screen is registered, the flow that names it is
  written in the same edit — not after a linter says so.
- **Check that catches it next time:** the linter already does. What was missing
  was running it before believing the work was done, which is now the habit.

### 2026-09-05 · M117 · a replacement whose anchor did not exist wrote nothing and said nothing

- **Symptom:** a scripted edit to `flows.md` silently changed nothing — the anchor
  string had a `F` where the file had an `E`. The script printed success. The gap
  it was meant to close stayed open and was only found by re-running the
  cross-check.
- **Surfaced at:** stage 9 · **Owned by:** stage 5, in a helper written without an
  assertion.
- **Root cause:** `str.replace` with a missing needle is a no-op, and a no-op that
  reports success is indistinguishable from work.
- **Fix, grade 3:** every scripted replacement in this repository asserts its
  anchor before writing. Several edits this run already did; the one that did not
  is the one that failed.
- **Check that catches it next time:** `assert old in s` before `write_text`, with
  no exceptions — a scripted edit that cannot find its anchor must fail loudly.

### 2026-08-27 · project-workspace ontology · contradictory hierarchy reached the next run

- **Symptom:** at parent commit `5bb9874`, `CONTEXT.md:17-31` said Project was beneath
  Goal while ADR-0010:21-30 said CEO decomposes into Projects and agents belong to them;
  `agent-composition.md:154` additionally stored recurrence on Goal.
- **Surfaced at:** stage 2 architecture · **Owned by:** the earlier decision-propagation
  step: ADR-0010 named affected files but did not close the contradictory definitions.
- **Root cause:** a project-first organisation decision was treated as an org-chart
  addition rather than an ontology migration, so no propagation inventory forced every
  authoritative and derived surface to be compared.
- **Fix:** grade 2 → R-001. ADR-0013 now explicitly supersedes the old clauses; commit
  `b68eae9` updates the glossary, vision, architecture, derived-page warnings, schemas,
  examples and UX together.
- **The check:** at stage 0, build the explicit propagation inventory required by R-001;
  schema/examples then run through `scripts/check-project-schemas.py`. Semantic equivalence
  across prose remains a judgement and is why this is not falsely labelled grade 1.
- **Commit:** `b68eae9`.
- **Upstream?** no — the rule names this repository's intent surfaces and ontology.

### 2026-08-31 · iteration-ladder · a silent renew let the lease expire mid-run

- **Symptom:** two guarded writes were blocked at the build stage; `agent_sync.py status`
  showed `ITERATION-LADDER [reapable] … expired 1h ago` while an earlier `renew` had
  exited 0 with no output, and a subsequent `acquire` printed "won" over the dead lock
  without actually restoring guard-visible tenure.
- **Surfaced at:** stage 5 build · **Owned by:** stage 0's autonomy sweep — the run
  recorded the lease but not a renew cadence against its 2700 s TTL.
- **Root cause:** design work between write batches exceeded the TTL; `renew` on a
  non-held lease is a silent no-op, so nothing failed until the guard did.
- **Fix:** grade 3 (procedure) — renew before every write batch and verify with output,
  not exit code; on any guard refusal, `reap` then `acquire` rather than re-acquiring
  over an expired lock.
- **The check:** the guard itself caught it — nothing was written unleased; the cost was
  two blocked calls, not corruption.
- **Upstream?** yes — worth filing against agent-sync: `renew` holding nothing should
  exit non-zero, and `acquire` over this run's own expired lock should reap it first.

### 2026-08-31 · walking-skeleton · node-pty's prebuilt spawn-helper ships non-executable

- **Symptom:** every `pty.spawn` died with `posix_spawnp failed`;
  `prebuilds/darwin-arm64/spawn-helper` was `-rw-r--r--` after `pnpm install`.
- **Surfaced at:** stage 6 tests (the live PTY probe) · **Owned by:** stage 5 — the
  dependency was assumed working because it installed green.
- **Root cause:** node-pty 1.1.0's published prebuilds lose the exec bit on the macOS
  spawn-helper; the smoke test did not exercise a PTY, so nothing failed until the
  dedicated probe ran.
- **Fix:** grade 1 — root `postinstall` chmods the helper on every install, and
  `apps/desktop/test/pty.test.mjs` is a permanent live probe wired into `pnpm test`.
- **The check:** the probe was watched failing before the fix and green after — a
  fresh clone or a dependency bump that regresses this fails `pnpm test`, not the
  operator's first terminal click.
- **Upstream?** yes — packaging defect worth reporting to microsoft/node-pty.

### 2026-08-31 · tasks-and-editor · the audit found two data-destroying defects the gates could not

- **Symptom:** (1) with the save-conflict diff on screen, the header Save button stayed
  enabled and pointed at an editor instance that had already been disposed, so `getValue()
  ?? ''` wrote an empty string over the file — with a hash that matched, so the guard let
  it through. (2) Any write error unmounted the whole editor, disposing Monaco and losing
  the operator's unsaved buffer, leaving a dead screen with no retry.
- **Surfaced at:** stage 6, by the commissioned UX audit · **Owned by:** stage 5 — both were
  written in the same pass that built the conflict path, and both survived typecheck, the
  design gate, the planted-probe suite and a smoke run.
- **Root cause:** the conflict path introduced a second editor instance and a second source
  of truth for "the current content", and neither the disable condition nor the error branch
  was re-derived for that second state. `?? ''` turned an absent editor into a valid write.
- **Fix:** grade 2 — never synthesise content (`null` refuses the write), the header Save is
  inert while a conflict owns the screen, and a write failure is a banner beside a living
  editor rather than a replacement for it.
- **The check:** the file-conflict probe (`apps/desktop/test/files.test.mjs`) covers the
  refusal contract but could not have caught either of these: both are renderer state, not
  file semantics. The check that did catch them was an adversarial read of the code against
  the scenarios. Recorded as such rather than pretending a test now guards it.
- **The wider lesson, and why it is worth a standing rule:** every gate this repository owns
  is structural — types, tokens, strings, schema constraints. All of them were green while a
  button destroyed files. Commissioning an independent read before shipping an interface is
  not ceremony; here it was the only thing between the operator and data loss.
- **Upstream?** no.

### 2026-08-31 · security-wave-1 · a deferral that left as a count left nothing

- **Symptom:** `verification.md` stated that eight unfixed UX-audit findings "leave with
  ledger ids CO-089…096 rather than as silence". Those rows were never written:
  `grep -rn "CO-089" docs/` returned only the sentence itself and the register's
  `**Next free ID:** CO-089`, five runs later.
- **Surfaced at:** stage 10, reserving ids for this run's own carry-overs ·
  **Owned by:** the tasks-and-editor run's stage 10, which wrote the promise instead of
  the rows.
- **Root cause:** the ids were cited in the ledger sentence and reserved nowhere. The
  sentence was written in the same breath as the intention, and reads as a record of
  something done.
- **Fix:** grade 2 → R-002. The claim is corrected in place rather than deleted — the
  correction is the evidence — and CO-089 now tracks recovering the findings by
  re-running the audit. They are **not** reconstructed from memory: eight invented rows
  would be worse than an honest gap.
- **The check:** none yet that is mechanical; R-002's retirement condition names it.
- **Upstream?** no — but it is a general failure of evidence ledgers and worth carrying.

### 2026-08-31 · security-wave-1 · every gate was green over two open doors

- **Symptom:** the anon key could call `apply_projections` and write a projection row
  with zero journal rows behind it (measured: RPC returned 204, `projected=1
  journalled=0`); and `readFile` took any absolute path, serving `/etc/passwd` (9 344
  bytes) and `~/.ssh/known_hosts` (10 402 bytes) through the same typed bridge every
  window holds. Separately, `append_event` accepted `totally.unknown@9`, gave it a
  gapless seq and projected nothing, and blocked past 6 000 ms under contention.
- **Surfaced at:** an adversarial read commissioned outside the pipeline ·
  **Owned by:** every stage that shipped those files green.
- **Root cause:** all seven gates this repository owns are structural — types, tokens,
  strings, schema constraints, links, narrative, brand. Not one of them can see a
  `GRANT`, a path, an unbounded lock wait or an open type set. The one thing they all
  share is that they read the code as text rather than exercising it as a system.
- **Fix:** grade 2 → R-003, plus the mechanisms: migration 6 (the revoke, probe P12),
  migration 7 (the registry and `lock_timeout`, probes P13/P14), `FileRoots`
  (`file-roots.test.mjs`), and the credential handshake and budget
  (`agent-surface.test.mjs`, `session-bundle.test.mjs`). Suite: 26 → 28 planted probes;
  77 green checks across four suites.
- **The check:** each of the above was watched failing first, and the transcripts are in
  `verification.md`. What is still missing is the CI half — R-003's retirement condition.
- **Upstream?** no.

### 2026-08-31 · security-wave-1 · the seam the run could not close

- **Symptom:** SEC-REQ-010 makes the credential a one-initialize handshake, so every tool
  call must carry the `mcp-session-id` the transport returned. Three attempts to prove
  that against the real Claude Code CLI produced **zero requests at the surface** — the
  nested CLI never loaded `--mcp-config` in this sandbox, so nothing was learned in
  either direction.
- **Surfaced at:** stage 10's ladder walk, which is where it should surface ·
  **Owned by:** stage 6 — the change was tested against an SDK client and treated as
  covered.
- **Root cause:** the bundle path has never had an end-to-end test (AS-REQ-005 already
  read `never`); this run made that path stricter without being able to exercise it.
- **Fix:** grade 3 — stop at three attempts rather than keep digging, record CO-093, and
  add the one thing that costs nothing: the main-process log now distinguishes "no
  session id at all", which is what a non-compliant client looks like, from "the wrong
  session id", which is what a second party holding a copied token looks like. The first
  real session diagnoses itself in one line.
- **The check:** the operator's first agent session after this merge. Named in CO-093
  rather than assumed.
- **Upstream?** no.

### 2026-08-31 · next-three · the seam was fine; the way I reached for it was not

- **Symptom:** CO-093 recorded that the credential handshake could not be verified
  against the shipped Claude Code CLI — three attempts, zero requests at the surface.
  Through node-pty it worked first try: `initialize` 200, then `mcp-session-id` echoed on
  all three subsequent calls, and the project marker came back through `fabric_whoami`.
- **Surfaced at:** stage 5 of this run, one command in · **Owned by:** the previous run's
  stage 6, which reached for `execFileSync`.
- **Root cause:** `execFileSync` gives the child no TTY. `PtyManager` spawns through
  node-pty. I reproduced the *invocation* and not the *path*, then recorded the silence as
  an open risk about the product rather than about my harness.
- **Fix:** grade 2 → R-004. The e2e now runs over a real PTY and is kept as an opt-in
  suite (`pnpm --filter @fabric/desktop test:e2e`).
- **The check:** the suite itself, and it distinguishes INCONCLUSIVE from FAIL — a run that
  reaches the surface not at all now says so rather than reading as a broken handshake.
  Its first verdict got this wrong too: it counted `server/discover`, which the CLI sends
  BEFORE initialize, as a post-handshake refusal. The probe now slices by position.
- **Upstream?** no.

### 2026-08-31 · next-three · a measurement that changed the design before it was written

- **Symptom:** none — this is the counter-example, recorded because the retro otherwise
  only remembers failures. The transcript projection wanted a generated `tsvector`, and
  the projector runs inside the append transaction, so a `to_tsvector` that throws rolls
  back the session's own exit record.
- **What was done:** measured the limit first. 400 000 chars of high-entropy text →
  491 164 bytes of tsvector; 900 000 → 1 105 182; 2 000 000 → fails 54000. The index was
  bounded to 400 000 characters with the column left unbounded, and P15 now journals a
  1 980 000-character transcript whole.
- **Why it is here:** the version of this that ships without the measurement looks
  identical, passes every test written against small fixtures, and loses a session's
  record the first time somebody runs a long build. It cost one psql command.
- **Upstream?** no.

### 2026-08-31 · next-three · a probe found a design wart and I fixed the product

- **Symptom:** the transcript-search probe passed `query: 'x'` alongside a `sessionId` and
  hit the schema's two-character minimum.
- **Root cause:** `query` was required even when reading one session by id — an agent
  opening a record it already has the id for had to invent search words.
- **Fix:** grade 1 — `query` is optional, and calling with neither returns a refusal that
  says which of the two it needs. The temptation was to change the probe.
- **Upstream?** no.

### 2026-09-01 · reconcile-provenance · the fix uncovered an older lie next to it

- **Symptom:** while wiring M43 I read the task history row and found
  `t('tasks.finished', { code: task.exit_code ?? 0 })`. A task with no exit code — which
  is exactly what an abandoned one has — rendered as *finished with code 0*. A success
  invented from an absence, in code that predates this run.
- **Surfaced at:** stage 5, reading the neighbouring component before changing it ·
  **Owned by:** the tasks-and-editor run, which wrote the `??`.
- **Root cause:** `?? 0` on a nullable field reads as a tidy default and is a claim. It is
  the same shape as `getValue() ?? ''`, the defect that wrote an empty string over a file
  in the tasks-and-editor run — a nullish coalesce turning "we do not know" into a
  confident value.
- **Fix:** grade 2 — the row now distinguishes running, finished with its real code, and
  not accounted for with its reason. No further rule: **R-003 already covers this ground**
  from the other side, and the pattern is worth naming in the log rather than spending one
  of ten standing slots on a second entry about `??`.
- **The check:** none mechanical. Recorded as a pattern to look for: `?? 0`, `?? ''` and
  `?? false` on a field whose null means "unknown" are all the same defect.
- **Upstream?** no.

### 2026-09-01 · reconcile-provenance · a probe that measured the suite instead of the feature

- **Symptom:** the retrieval-log probe asserted two misses and found three.
- **Root cause:** it counted every `memory_retrievals` row in the project, and earlier
  sections of the same suite had already searched. The extra miss was real, correct and
  none of that probe's business.
- **Fix:** grade 1 — snapshot the row ids before, and assert only on what these three calls
  added. The temptation was to loosen the assertion to `>= 2`, which would have kept it
  green while measuring nothing.
- **The check:** the probe itself, now scoped. Worth carrying because a suite whose probes
  share a project accumulates this failure quietly as it grows.
- **Upstream?** no.

### 2026-09-01 · bitemporal-contextpack · the same template-literal trap, three times

- **Symptom:** three separate syntax errors while editing test files, all the same: a
  backtick in a comment, or a `\n` in a string, inside a script held as a template
  literal and run with `--eval`.
- **Surfaced at:** stage 5, each time · **Owned by:** the harness pattern itself, which
  predates this run.
- **Root cause:** four suites embed their real body in a template literal so an
  `execFileSync` can inject environment. Every backtick closes the template and every
  escape needs doubling, which is invisible until it is a syntax error.
- **Fix:** grade 3 — the newest suites (`handshake-e2e`, `context-pack`, `memory-eval`,
  `reconcile`, `transcript-live`) are **plain modules**: Node imports the TypeScript
  natively, and the environment is read in-process from `supabase status -o env`. Nothing
  needed the wrapper. The older suites still use it and are not rewritten in this run.
- **The check:** none mechanical. The rule is simply: a new suite is a plain module, and
  the wrapper is legacy rather than a pattern to copy.
- **Upstream?** no.

### 2026-09-01 · bitemporal-contextpack · a probe failed on precision, not on the product

- **Symptom:** P17's "what was believed then" assertion failed against a correct schema.
- **Root cause:** `valid_from` came back to JavaScript as a Date, which has millisecond
  resolution, and Postgres stores microseconds. Passing it back as a parameter made
  `valid_from <= $2` false for the very row being asked about.
- **Fix:** grade 2 — the as-of instant is computed IN SQL. Recorded here rather than only
  fixed, because the same trap will bite any as-of query written from the client, and the
  symptom is a silently empty result rather than an error.
- **The check:** the probe, now correct. Named in the migration's comments too.
- **Upstream?** no.

### 2026-09-09 · S13 · a green test agreeing with a comment that both described a format the code never produced

**Symptom.** The Board's `ref` — documented in `board.ts` as "one string that
addresses exactly one thing, so a deep link survives a re-rank" — was
`review:review:t1` for every derived row, and had been since the two files were
written a fortnight apart. `attentionOf` emitted `review:<taskId>` as an *id*;
`boardEntries` then computed `${kind}:${id}` over it.

**Evidence, and how it was got.** Not by reading: by running the producer into
the consumer in a throwaway test and printing the result —
`["refused:refusal:7","proposal:proposal:pr1","review:review:t1","abandoned:lease:w1"]`.
Reading them separately, each file is correct.

**The stage that owned it.** Stage 6. `board.test.ts` asserted
`ref === 'review:task-1'` and passed, because its fixture hand-wrote
`id: 'task-1'` — a shape `attentionOf` cannot emit. **A fixture the producer
cannot produce tests nothing**, and it is worse than no test: it makes the
defect look checked. The same file's `BoardPanel.test.tsx` had the same shape,
and `BoardPanel` parsed the ref with `slice('question:'.length)` — a parse this
change would have silently broken, which no type could catch.

**Root cause.** Two vocabularies for one identity, each with a local reason.
R-005 already says a boundary type has one definition; it was written about a
type NAME, and this was a *format*, so the grep it prescribes did not fire.

**The fix, by grade.** The identity has one home (`entityRef.ts`) and both sides
compose it; the fixtures the Board is tested against are built by the producer;
the subject travels typed on the entry so no surface slices a string.

**The check that catches it next time.** The producer-built fixture in
`board.test.ts` ("the ref is what the producer actually emits") — it asserts the
ref splits into exactly two parts, and the original defect takes three
assertions down.

**And the mirror, which was worse.** `taskIdOf` sliced `lease:` off and passed
`work_id` as a task id. The caller had already looked that id up in
`project_tasks` — for a title — and thrown the answer away, so an expired lease
over anything that is not a task opened a page for a task that does not exist.
The rule: **a caller that already asked a question should not discard the
answer for a second consumer to guess at.**

### 2026-09-09 · M182 · a projector arm that read the state its own previous application had written

**Symptom.** `packages/schema` P24 — "a rebuild reproduces every projection
exactly" — failed with `memory_facts 150->150`: same rows, different values.

**Evidence.** Dumping the differing rows showed two corrections that were
`superseded` before the rebuild and `conflict_proposed` after it.

**Root cause.** `rebuild_estate_projections` replays the journal **over the
existing rows**, not into an empty table, so every projector arm has to be
idempotent. The new conflict branch was written `elsif v_target.valid_to is not
null` — and after its own first application, the target IS closed. The arm read
its own output and demoted itself.

**Why no unit test could see it.** The defect exists only on the SECOND
application. A fixture, a unit test and a single-pass probe all agree with the
code; the disagreement needs a replay.

**The fix, by grade.** The branch asks whether the target was closed by somebody
OTHER than this correction — stable under re-application, and it says what was
actually meant.

**The check.** A replay assertion inside the probe itself, so the property is
tested where the behaviour lives rather than only by P24 three packages away.

**And the rule this run adds, which cost two plants.** A plant that fails LESS
than expected asks two questions, not one: does the assertion reach the target,
AND did the machinery the assertion rests on actually run? The second plant here
passed because `db.rpc('rebuild_estate_projections', …)` had been refused every
time and nobody read `.error` — every line under it passed for free. One
assertion on the error turned the block into evidence and immediately exposed a
second defect: a trigger raising inside a projector arm does not refuse one
write, it makes the whole estate unrebuildable for as long as the offending pair
sits in the journal.

**A third, found by the full run rather than by any test I wrote.** The first
version of the migration replaced `apply_memory_facts` with a body handling ONE
of the two event types the original projected, silently dropping every
`memory.retrieved@1` row — the miss backlog and the retrieval count are made of
those. **Replacing a projector means carrying every arm it had**, and the case
list is the register of what projects what.

### 2026-09-09 · M154 · the fifth correct derivation this session that nothing rendered

**Symptom.** `kind: 'finding' | 'trap'` has been on the agent tool since M149
and on the note-promotion path since M52. Nothing reads it. The memory list
renders every fact identically — no filter by kind, no lineage, no way to ask
whether a trap has been hit before.

**Evidence.** `grep -rn "'finding'\|'trap'"` over the whole tree: four hits,
three of them the writer and one a comment. Zero readers.

**The stage that owned it.** Stage 0's third question — *for anything a person
must read, ask who shows it*. It has now found five instances in one session
(`deriveLiveness`, the runtime observer, `readCycleGap`, `memory_occurrences`,
and this), and it costs one grep.

**And a defect the render test found that review did not.** `EmptyState`'s
`read` prop means *have we looked yet*, and its false branch renders the
`waiting` slot. The section passed `read={failed.length === 0}` — meaning to say
"a source failed, so this is not a confident empty" — which rendered the empty
`waiting` slot instead: **a blank panel where the explanation should be**. The
assertion that caught it was written against the SENTENCE the operator should
see, not against the absence of the wrong one. A test that asserts a thing is
missing cannot tell a correct absence from a blank screen.

**The rule.** Assert what the reader SEES. `queryByText(...).toBeNull()` is a
weaker claim than `getByText(...)` on the sentence that should have replaced it,
and the difference is exactly a panel with nothing in it.

### 2026-09-09 · M176 · a probe that died reported less than a probe that fails

**Symptom.** `ci full` exited 1 with a bare `Error: Command failed: git … log
--since=30 days ago --numstat`. No `FAIL` line, no `ok` line — the whole
`code-stats` probe file produced nothing at all.

**Evidence.** `git log --since="30 days ago" --numstat` over this repository:
**140 kB and 2.3 s** on an idle machine, against `gitRun`'s five-second timeout.
Under a full run — the local stack, 855 vitest cases and the probe at once — it
went over.

**The stage that owned it.** Stage 6. The probe called `gitRun` unguarded, so a
rejection escaped and killed the file. It already knew how to say this: two
lines above, "not inside a git repository — the live check is SKIPPED, and says
so rather than passing quietly". The same sentence was needed for a call that
fails rather than a repository that is absent.

**Root cause, and what it is NOT.** The product is fine: `codeStats.read`
catches this and returns nulls with the reason, which is the honest degradation
it was built for. This was a verification failing to reach its subject (R-004),
and the temptation was to widen the product's timeout to make the probe pass —
which would have changed the product to suit the harness.

**The general shape, worth more than this instance.** A probe that CRASHES
reports less than a probe that fails. A failure names what was wrong; a crash
names nothing and, in a suite that stops at the first non-zero exit, hides
everything after it. Every unguarded call in a probe is a place where the
harness can go quiet at exactly the moment it is most needed — and the fix is
the same sentence the probe already writes for its other unreachable case.

### 2026-09-09 · S07 · a gate that fired on the sentence explaining the gate

**Symptom.** `check-release.mjs`, written to refuse `git rev-parse` in the main
process, failed on its first run — pointing at the
**comment** in `apps/desktop/src/main/index.ts#installedBuild` that explains why runtime git is forbidden.

**Why it matters more than the ten seconds it cost.** A gate that refuses the
prose describing its own rule teaches exactly one lesson: delete the
explanation. The next author does not weaken the rule, they remove the sentence
that would have told the author after them why it exists — and the gate goes on
passing.

**The fix, by grade.** The scan blanks comments while preserving offsets, so
line numbers stay true and the rule applies to code. Six lines, and it is the
difference between a gate that protects an explanation and one that punishes it.

**The general rule.** A structural gate reads CODE. Any gate matching source
text needs to say what it does with comments, and the default — matching them —
is wrong in the one direction nobody notices, because the failure looks like the
gate working.

**And the measurement that shaped the whole node.** Nothing in the running
application identified the build: no version, no commit, no schema window, on
any screen. The temptation was `execSync('git rev-parse HEAD')` in the main
process — instant, correct in development, and in a packaged app a confident
report about whatever directory the operator launched it from. **A cheap answer
that is right where you test it and wrong where it ships is worse than no
answer**, because no answer is visibly missing.

### 2026-09-09 · S08 · the negative control belongs on the judge, not only on the subject

**What was built.** A controlled cycle: a service with a defect planted in it,
observed failing, repaired, observed again, and checked by an actor that is not
the worker.

**The assertion that makes the other eight worth having.** A planted
always-pass verifier, run against a service nobody repaired, must not produce
`verified`. Without it, every other line in the probe is measuring a scale whose
needle is glued down — and it would read exactly the same in the output.

**The general shape.** This session has planted defects into the SUBJECT
repeatedly and watched them caught. The failure mode that discipline does not
cover is a judge that cannot fail: plant into the subject and a broken judge
still reports the plant as caught, because it reports everything as caught. The
control has to go into the INSTRUMENT as well, and the two are different
experiments.

**Where the honesty is.** The probe starts a real HTTP server rather than
carrying `observedAfter: 'healthy'` as a fixture value. A test whose observation
is a string somebody typed is asserting its own input — and the whole subject
here is the gap between "the process exited 0" and "the service answers", which
is invisible to any test that never asks the service.

**The ordering that is a design and not an accident.** Scope and forbidden
effects are judged BEFORE the result. A worker that repairs the endpoint by
editing the checker has fixed the symptom and removed the instrument; scoring
the HTTP result first would reward precisely the behaviour that must never be
rewarded, and the probe asserts that case with HTTP genuinely returning 200.

### 2026-09-09 · S09 · the fixture that failed told me about a path I had not tested

**Symptom.** One assertion failed: "the conflicted command still changed the role
to owner". The conflict had been returned correctly, so the code under test was
right and the assertion was still red.

**Diagnosis.** The section's SETUP granted `member` to whoever had survived the
concurrency case two sections earlier — who by then was the estate's only owner.
The new trigger correctly refused that demotion, the setup silently did nothing,
and the assertion was reading a role that had never been set. A fixture that
never reached its subject, presenting as a product defect.

**What it was worth.** Fixing it independently (a fourth person, so the setup
cannot depend on a race) was two lines. But the reason it failed is a case the
probe did not have: **a demotion is a `grant` of a lesser role**, so the
last-owner floor has to hold on the grant path as well as on delete and update.
It does — which is exactly why the setup was silent — and that is now its own
assertion rather than an accident I got away with.

**The rule.** When a fixture fails for a reason that is not the product, ask
what the failure is evidence OF before repairing it. A silently-refused setup is
a gate firing where no test was looking, and the cheapest new test case is the
one the failure just handed over.

**A second slip, in my own tooling, worth the line.** The script that inserted
this run's map entry printed `map ok` unconditionally — `str.replace` returns a
copy and raises nothing when the anchor does not match, so a no-op reported
success and the entry was absent two commands later. The fix is an assert on the
EFFECT (`out != s`) rather than on reaching the end. **A tool that reports
success without checking it is the same defect as a read that returns an empty
array past an error**, and it is easier to write in a throwaway script than
anywhere else — which is where the ledgers get maintained from.

**And the measurement that framed the node.** Nothing protected the last owner,
and the path is the one the product itself uses: the application connects with
the service role, so `delete from memberships` is not a hypothetical route
through an API. **A floor that only exists inside a command is not a floor when
the caller can write the table directly** — and here the caller is us.


### CO-282 N028/N029: reuse a discovered boundary across modules

The N029 reviewer reproduced wrong estate scope and nested compiler query accumulation.
Root applied that lesson to N028: checking `store.scope` only before asynchronous reads
missed an in-flight mutation, while checking equal field values missed replacement of the
object captured by ScopedStore's query closure. Preserved original RED controls led to
reference plus exact-value checks before/after reads and final result; independent N028
supplement passed6 controls. Keep historical acceptance receipts immutable and publish
corrections separately. A timeout or rejected outer Promise does not prove sibling I/O
finished; await settlement of every started request before releasing its occupancy slot.
These lessons are evidenced locally, not submitted to Observatory while COM is unavailable.
