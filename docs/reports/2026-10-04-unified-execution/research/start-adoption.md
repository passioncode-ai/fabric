# Start, CEO-first, progressive adoption and launch fit — research/design slice

As of 2026-10-04. This is a proposed execution design grounded on canonical rows, source inspection and primary web research. It does not change product code, canonical statuses or claim native/user acceptance. The owning report is [../README.md](../README.md); task detail is [../packets/start-adoption.json](../packets/start-adoption.json), source records are [../raw/start-adoption-sources.json](../raw/start-adoption-sources.json).

## Goal and alignment

The priority is a durable Project operating loop: own repository → sourced understanding → saved next action → admitted Run → independently verified outcome → exact return or executor replacement. This serves vision principles 1–5 and avoids the anti-vision of a multi-chat cockpit or a provider-dependent private session format. See `docs/ux/vision.md:13–58`, `docs/launch/first-release-strategy.md:5–20`, SCN-095/096 and SCN-126…129 (`docs/ux/scenarios.md:107–141`). P-08 remains first in the unified queue; these lanes supply its downstream integrity and product-value work without duplicating active hubfix2 branches.

## What the evidence says

**SA-F1 — A released start screen does not close its native draft prerequisite.** P-01 is partial, P-02 verification is done and P-03 distributed 0.3.0, while AD02 receipt remains blocked and CO-187 requires its native restart acceptance before FR-A. Sources: `docs/evidence/backlog.md:73–75`, `docs/launch/adoption/README.md:11–15`, `docs/evidence/specs/2026-08-16-software-fabric-carryover.md:198`. Continue with an isolated native fixture, preserve renderer/disk proof as its own tier, and do not create another wizard.

**SA-F2 — The old adoption prerequisites need explicit factoring, not a silent cycle.** The strategy pulls AD15 readiness ahead of AD05 observation, while legacy AD15 depends on AD04/AD09 and AD05 depends on AD04. A pre-Project executor readiness receipt must be a separate bounded `AD15.readiness` subpacket; role/grant configuration stays in AD15. Sources: `docs/launch/first-release-strategy.md` “Sequencing delta”, `docs/launch/adoption/packets/AD15.md:10–15`, `AD05.md:10–15`. This is a proposed graph refinement, not an accepted new producer or completed capability. Binary detection, auth status, observation capability and execution grant must remain separate. Electron also requires trusted IPC caller validation ([official checklist](https://www.electronjs.org/docs/latest/tutorial/security)).

**SA-F3 — Current scan semantics are already hardened; preserve them.** ADR-0100 defines checklist selection with one Project per repository. `startChoices.ts:20–44` limits chosen parents to child creation, and `startChoices.ts:64–129` records scan identity without re-resolving replaced paths and revalidates candidates. The historical r0 source/discovery variants still describe one Project with related sources (CO-180). Node developers reported recursive traversal following symlinks outside its selected tree ([issue #51858](https://github.com/nodejs/node/issues/51858)); the report is old Linux/Node21 evidence, so it motivates a current negative test rather than claiming Fabric is affected. Retain no-follow traversal, boundary checks, cancellation and admission-time revalidation. The picker’s cancellation/alias behavior is explicit in [Electron dialog documentation](https://www.electronjs.org/docs/latest/api/dialog). A remembered scan is evidence, never a persistent grant; CO-177 stays decision gated.

**SA-F4 — Project/Run identity must outlive folder location.** A VS Code contributor describes chat sessions becoming inaccessible when folder-URI keyed workspace locations move or disappear ([issue #305818](https://github.com/microsoft/vscode/issues/305818)). Fabric must keep stable Project/Run/conversation IDs, with source location as revisioned data and explicit relink when needed. This is a transferable failure case, not a Fabric reproduction. FR-E consumes immutable MEM-P4 checkpoint and MEM-P5 per-build provider conformance receipts. Same-provider native resume, fresh same-provider and fresh other-provider are separate; the last starts a new Run. A summarized chat or a provider thread ID alone is no continuation receipt. [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) supports bounded context, persistent notes and focused subagents; the packet preserves source permissions, gaps, decisions and unfinished effects rather than only a polished summary.

**SA-F5 — Voice acceptance needs samples in the installed signing state.** A developer reported live MediaStream tracks with no actual audio/video delivery in particular ad-hoc macOS builds ([electron-builder #9529](https://github.com/electron-userland/electron-builder/issues/9529)). The closed report does not establish a defect in Fabric’s Developer ID build. AD13 nevertheless must verify real audio bytes/samples and RU/EN transcription on the actual package; permission granted or getUserMedia resolved is insufficient. [Electron media permissions](https://www.electronjs.org/docs/latest/api/system-preferences) and [MediaRecorder’s final dataavailable event](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) ground denied/restricted/cancel/late-chunk states. AD12 compares local multilingual [Whisper](https://github.com/openai/whisper) and [whisper.cpp](https://github.com/ggml-org/whisper.cpp) candidates against an explicitly authorized network option using identical consented samples. No installation, upload, STT choice or latency/accuracy measurement was performed here.

**SA-F6 — Late replies and lost responses are product behavior, not transport details.** AD04/09/11/14/16 need immutable request identity, durable outcome and reconciliation after an unknown completion. [Stripe’s primary engineering explanation](https://stripe.com/blog/idempotency) describes success with a missing response; it supplies a distributed-systems rationale, not a new payment dependency. Changed payload under an old id refuses; a new update waits for reconciliation. Direct UI and CEO use one typed boundary, and source prose/instructions cannot authorize an action.

**SA-F7 — One disclosure must preserve critical truth.** M187/AD19/AD20/CO-179 should share a button-based disclosure with expanded state, controls relationship and keyboard behavior from the [W3C APG](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). Main action/data and blocking error/authority remain visible; optional settings, evidence and secondary detail fold. User-customized disclosures remain later work. Native draft persistence survives visual refactoring. CO-179 says “before the next release after 0.3.0” (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md:190`); a release-policy owner must resolve its interaction with P-08 instead of this research silently relaxing it.

**SA-F8 — Read age, display acknowledgement and page cursor are different contracts.** CO-144 leaves quota/repository age open; CO-145 forbids minimumCursor without actual displayed-payload receipt (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md:155–156`). AD07 captures the read head with the displayed snapshot; an append between display and leave remains unread. Hidden panels do not acknowledge. CO-185 requires a stable unique keyset order when deletions can occur during full reads (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md:196`); [PostgreSQL ordering documentation](https://www.postgresql.org/docs/current/queries-limit.html) confirms that deterministic unique ordering is necessary. A keyset alone is not a transaction snapshot: choose an initial upper watermark and document concurrent-insert semantics, with per-page scope checks.

**SA-F9 — S11’s historical recipe conflicts with the current naming ADR.** `docs/reports/system.html#task-S11` cites old ADR0018 and older source receipts. ADR0090:1–40 already supersedes that rule: PassionCode.ai is organization; Fabric is product and CEO; Fabric X are its tools. Start S11 by computing current live residues, retain dated old ADRs/snapshots and preserve bundle/data/package/route identifiers. Do not reimplement the obsolete historical recipe. M98 similarly starts by measuring current responsibilities: legacy 894/863 line counts are historical, not current measurements or a universal feature blockade.

## Proposed execution order and carried contracts

1. Keep P-08 release verification first, under existing hub ownership. No adoption report claim changes its receipt gates.
2. Run AD02 isolated native restart acceptance and AD03 current CEO-first prototype/keyboard acceptance independently. Their passed native/prototype tiers respectively unlock AD04; AD00/01 source receipts already exist.
3. Factor AD15.readiness with CO-176 exact-build auth passport; FR-A/FR-B reuse P-01 components. AR2 registry-ready and AD05 observation consume measured readiness, not version detection. CO-179/CO-180 can run as separate visual/prototype iterations after their own inputs, with shared UI/model integration serialized.
4. AD04 durable create → AD05 bounded observation → AD06 checkpoint → AD07 display-boundary return. AD09 durable conversation can proceed after create/contract readiness; AD08 integrates all three return consumers after AD07/09. This produces first own-project value and useful cold return before full adoption breadth.
5. AD10/11 scope/attribution, AD12 accepted STT benchmark → AD13 real voice, AD14 Board receipts, full AD15 binding → AD16 real Run → FR-E observed stop and portable continuation. Consume MEM-P4/MEM-P5/N1 receipts from memory/provider lanes. Active old writer or unknown remote effect blocks replacement.
6. AD17 one bounded cycle; AD18 receipt-based adoption projection → AD19 contextual optional lessons → AD20 shell and AD21 invited/advanced entries. AD24 current implementation gets its own candidate receipt and retains partial states; it does not hold idea/no-source entry hostage.
7. AD22/FR-G native walking skeleton and failure matrix; AD23 consented moderated first-use and delayed-return pilot. Hook/retention remains a hypothesis until observed, with baseline unknown and denominator/abandonment explicit.
8. Supporting lane is per-capability: L3c exact Board return/deep-link identity, CO-144/145 read integrity and CO-185 pagination can proceed independently with nonoverlapping files. M98 extracts one seam at a time; M187 reviews one SCR at a time; S11 reconciles current naming. CO-177 persistent scan grant and CO-178 RU Estate term require an accepted decision before implementation.

Every dependency in the JSON carries an output/proof tier or explicit contract. Scope conflicts on App/index/preload/types/schema/journal/canonical UX/generated model are serialized even when the dependency graph permits parallel study. Current schema head is 77 in converged work, so later adoption migrations are allocated after integration under lease; old 75/76 prose is not a license to choose a number.

## All named work retained

The table below is computed from the packet file; each row links to its embedded complete context via ID lookup. Parent carryovers are closure/accounting rows, not duplicate implementation tasks. `AD15.readiness` is a proposed bounded child preserving canonical AD15.

| Lane | ID | Classification | Bounded objective |
|---|---|---|---|
| 1 | CO-176 | bounded-implementation-after-passport | Verify coding-agent sign-in per exact installed CLI build |
| 1 | CO-177 | decision-gated | Define persistent revocable scan grant before any scheduled rescan |
| 1 | CO-178 | terminology-decision-gated | Set Russian form of Estate in brand pack before string sweep |
| 1 | CO-179 | bounded-visual-iteration | Restyle New Project form while retaining native draft persistence |
| 1 | CO-180 | prototype-reconciliation | Align r0 source/discovery target views to checklist-per-project |
| 1 | P-01 | partial-parent | Close start-path remainder without relabeling FR/AD native acceptance |
| 3 | CO-168 | umbrella-tracked-by-child-packets | Retain canonical carryover and close only the exact remaining child acceptance set |
| 3 | FR-A | blocked-on-native-draft-receipt | Finish persona/entry defaults and repeat routing |
| 3 | FR-B | split-readiness-before-project | Expose early observed readiness without circular Project prerequisite |
| 3 | FR-C | blocked-on-create-readiness-contracts | Integrate picker, immutable create and scoped observation |
| 3 | FR-D | blocked-on-checkpoint-contracts | Deliver sourced first insight and exact return |
| 3 | FR-E | blocked-on-portable-context-and-provider-receipts | Observe stop and safe three-mode continuation |
| 3 | FR-F | capability-composition-not-single-dispatch | Compose durable CEO interaction, voice, Board and one useful cycle |
| 3 | FR-G | integration-acceptance | Close native walking skeleton and measured value before calling CEO-first release ready |
| 4 | AD02 | acceptance-only | Сохранить native черновики при новом старте |
| 4 | AD03 | prototype-reconciliation | Единый target-сценарий создания |
| 4 | AD04 | blocked-on-receipts | Один durable create и восстановление неизвестного исхода |
| 4 | AD05 | blocked-on-receipts | Минимальный порт источника и честное отсутствие данных |
| 4 | AD06 | blocked-on-receipts | Первый полезный checkpoint на своём проекте |
| 4 | AD07 | blocked-on-receipts | Возврат: общий снимок и прочитанная граница |
| 4 | AD08 | blocked-on-receipts | Одинаковый возврат в Home, Project и Fabric |
| 4 | AD09 | blocked-on-receipts | Durable текстовый разговор и общий command path |
| 4 | AD10 | blocked-on-receipts | Composer: понятный scope, shortcuts и сохранность ввода |
| 4 | AD11 | blocked-on-receipts | Исправление атрибуции и точные ссылки на разговор |
| 4 | AD12 | blocked-on-receipts | Выбрать и проверить STT-порт для R0 |
| 4 | AD13 | blocked-on-receipts | Реальный voice capture → правка → отправка |
| 4 | AD14 | blocked-on-receipts | Доска: решение и возврат отложенного |
| 4 | AD15 | blocked-on-receipts | Минимальная настройка допущенного исполнителя |
| 4 | AD15.readiness | bounded-pre-project-readiness-subpacket | Factor immutable observed executor readiness before Project creation, breaking legacy AD15→AD04→AD05 ordering |
| 4 | AD16 | blocked-on-receipts | Один Run без ручной имитации механики |
| 4 | AD17 | blocked-on-receipts | Один понятный повторяемый цикл |
| 4 | AD18 | blocked-on-receipts | Durable прогресс знакомства из результата |
| 4 | AD19 | blocked-on-receipts | Плавное знакомство в точке потребности |
| 4 | AD20 | blocked-on-receipts | Спокойная оболочка и честная пустота |
| 4 | AD21 | blocked-on-receipts | Потребностные входы к глубине и приглашению |
| 4 | AD22 | blocked-on-receipts | Интеграционная приёмка всех обязательных R0 путей |
| 4 | AD23 | blocked-on-receipts | Пилот ценности и следующее решение по данным |
| 4 | AD24 | blocked-on-receipts | Найти проекты в выбранной папке |
| 4 | CO-166 | umbrella-tracked-by-child-packets | Retain canonical carryover and close only the exact remaining child acceptance set |
| 4 | CO-167 | umbrella-tracked-by-child-packets | Retain canonical carryover and close only the exact remaining child acceptance set |
| 4 | CO-187 | umbrella-tracked-by-child-packets | Retain canonical carryover and close only the exact remaining child acceptance set |
| 9 | CO-144 | bounded-reader-ui | Show surviving read age and freshness on quota/repository/facts |
| 9 | CO-145 | read-cursor-contract-first | Introduce display receipts before minimumCursor consumption |
| 9 | CO-185 | bounded-integrity-fix-before-pruning | Replace offset full-read paging with stable scoped keyset cursor |
| 9 | L3c | bounded-navigation-fix | Restore Board filter/selection on Back and exact ?item= route |
| 9 | M187 | screen-by-screen-design-review | Keep main data/action visible and use one accessible disclosure primitive |
| 9 | M98 | bounded-refactor-by-responsibility | Extract one responsibility seam without length-based feature blockade |
| 9 | S11 | historical-card-reconciliation | Complete current ADR0090 terminology and hierarchy sweep |

## Verification and limitations

Measured artifact checks in this subagent: parsed packet/source JSON; set equality between lane 1/3/4/9 canonical IDs and packet canonical IDs; all IDs distinct; exact existing file scopes re-resolved after correcting renderer locations. Counts: 47 canonical work items, 48 packet/closure records, 13 web source records. Three sources are developer-owned issue threads; their reports are failure-case evidence, not Fabric defects. Packet validation commands are future checks; no product test, native window, provider turn, microphone sample, STT benchmark or user pilot ran in this research slice.

Exact dispatch bindings still required: `packages/schema`, `packages/journal` and `docs/ux/audits` are directories in old AD write candidates, not broad write grants; allocate exact migration/test/audit files before mutation. `components/Disclosure.tsx` is a proposed create path; first check whether current component architecture has an equivalent primitive. All packets pin this research source HEAD and source hashes; rebase/current input receipts before execution. Target mockup checks do not certify production behavior. CO-166/167/168 remain canonical parent rows; no second task-status store was created.

## Inter-agent impact notifications and next action

The lead was notified immediately of AD02 proof-tier blocker, workspace-location identity risk, obsolete S11 recipe and CO-179 release deadline. Memory/provider researcher and this researcher exchanged FR-E portable checkpoint/passport contracts. Future discoveries travel as finding ID, evidence source/revision, impacted current/future IDs, severity and required contract change; the lead acknowledges and revises the dispatch packet before any dependent effect. Important later findings must not wait for the child’s final summary.

Next action for this slice: converge `AD15.readiness` graph refinement and CO-179 release interpretation with the unified plan owner; then complete actual AD02 native acceptance in an isolated userData fixture, keeping P-08 release work first and respecting existing shared-file holders. Open current canonical sources before dispatch, not this historical summary alone.

Primary packet context (excluding immutable historical appendix) measured as UTF-8 JSON bytes: maximum 8756 bytes; proposed dispatch budget 32,768 bytes. This is a byte measurement, not tokens. Exact shared-file integration owner, rollback boundary and decisions/exclusions are embedded in every record; context is re-materialized after actual predecessor receipts exist.
