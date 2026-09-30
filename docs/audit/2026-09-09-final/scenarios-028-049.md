# Fabric audit SCN-028..049 · 2026-09-09


Baseline `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`. Verdict **REFINE**. {'PARTIAL': 16, 'BLOCKED': 5, 'FAIL': 1}


## Scope and evidence

- Source trace plus two renderer fault-reproduction probes; no real PTY/browser/native screen-reader run in this slice.

- External public site not inspected.

- Parent runs full repository suite and owns register/publication edits.

- No repository edits or git writes by this subagent; all artifacts in /tmp.


Applied skill: ux-audit. No visual skill or live visual verification was applied. Structural CSS concerns below are inspection targets, not screenshot-backed failures.


## Checks

- `python3 docs/ux/lint.py`: exit 0; 0 errors, 38 warnings; includes external-site coverage and 13 index-row warnings

- `apps/desktop/node_modules/.bin/vitest run --config /private/tmp/fabric-audit-20260909/vitest.config.mjs`: 2/2 reproduction probes pass (they prove presence of defects, NOT desired product correctness). Initial /tmp alias invocation failed import; corrected canonical /private/tmp config ran.


## Scenario verdicts


### SCN-028 — PARTIAL — Project tabs and settings

Evidence: source-trace; `apps/desktop/src/renderer/src/App.tsx:464`; `apps/desktop/src/renderer/src/ProjectHome.tsx:953`; `docs/ux/scenarios.md:700`

Settings saves name/purpose and agent/server settings in two independent writes; later failure can leave partial saved configuration while form suggests one failed save. The scenario still promises manually editable repo_path although SCN-033 makes primary path derived.

Packets: UX28-11 UX28-15


### SCN-029 — BLOCKED — Launch and detached session

Evidence: source-trace; `apps/desktop/src/renderer/src/ProjectHome.tsx:1060`; `apps/desktop/src/renderer/src/SessionWindow.tsx:16`

Launch selector/window/tile source paths exist. No native PTY spawn, duplicate-window focus, close-keeps-running or exit-code replay performed in this audit slice. Poll/exit handler Promise rejections lack local recovery (SessionWindow 25/28).

Packets: UX28-14


### SCN-030 — PARTIAL — Workspace canvas

Evidence: source-trace; `apps/desktop/src/renderer/src/Workspace.tsx:20`; `apps/desktop/src/renderer/src/Workspace.tsx:66`

Three tier-0 widgets and fixed revision exist; props carry null/data only, so a stale failed projection cannot declare age/failure inside its widget. Results are explicitly a placeholder.

Packets: UX28-02


### SCN-031 — BLOCKED — Project onboarding

Evidence: source-trace; `apps/desktop/src/renderer/src/Onboarding.tsx:43`; `apps/desktop/src/renderer/src/Onboarding.tsx:57`; `apps/desktop/src/renderer/src/App.tsx:35`

Draft-id, independent drafts, fields and disabled options traced. System folder picker, create + attach journal atomicity and cancellation not replayed live; no end-to-end PASS claimed.

Packets: UX28-14


### SCN-032 — PARTIAL — Work request and presets

Evidence: source-trace; `apps/desktop/src/renderer/src/Tasks.tsx:110`; `apps/desktop/src/renderer/src/Tasks.tsx:130`; `apps/desktop/src/renderer/src/Tasks.tsx:155`

Preset sources and created-agent list read only on project.id, so newly raised/finished tasks or agents while staying in project leave stale availability/count/instruction. Launch/delivery backend correctness delegated to parent harness audit.

Packets: UX28-02


### SCN-033 — PARTIAL — Repositories attach/detach and refresh

Evidence: source-trace; `apps/desktop/src/renderer/src/ProjectHome.tsx:234`; `apps/desktop/src/renderer/src/ProjectHome.tsx:856`; `apps/desktop/src/renderer/src/EstateAgents.tsx:72`

Picker/primary promotion UI and live watcher exist. Refresh readers lack request-generation fencing; rejected EstateAgents repo refresh is swallowed and can retain prior value without stale warning. Main-process atomic promotion/path boundary not replayed here.

Packets: UX28-02


### SCN-034 — BLOCKED — Editor conflict safety

Evidence: source-trace; `apps/desktop/src/renderer/src/EditorWindow.tsx:129`; `apps/desktop/src/renderer/src/EditorWindow.tsx:185`

Hash conflict/diff/overwrite grant/dirty-close paths traced; native Monaco and file conflict flow not executed. Cannot verify typing during save, permission denial or symlink/root revocation from this slice.

Packets: UX28-14


### SCN-035 — BLOCKED — Agent claim versus observation

Evidence: source-trace; `apps/desktop/src/renderer/src/ProjectHome.tsx:1636`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1650`

Tile labels claim, age and stale-vs-lastActivity; plain no-claim branch traced. Context pack start receipt and real connected reporting session not replayed.

Packets: UX28-14


### SCN-036 — PARTIAL — Recorded session reading

Evidence: source-trace; `apps/desktop/src/renderer/src/ProjectHome.tsx:1164`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1203`

Transcript open uses one shared body and loading flag without generation/session guard. Slow A response after clicking B is rendered beneath B. Read disappearance becomes empty string through full?.body ?? empty rather than unresolved receipt.

Packets: UX28-02


### SCN-037 — PARTIAL — Memory attribution and corrections

Evidence: source-trace; `apps/desktop/src/renderer/src/ProjectHome.tsx:1742`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1882`; `docs/ux/scenarios.md:957`

Attribution and superseded markers exist. Request guard keys only q: category/superseded filters with same q race and old answer can win; external writes do not refresh facts. Scenario step 5 still names removed statistics strip, contradicted by its amendment.

Packets: UX28-02 UX28-15


### SCN-038 — BLOCKED — Public positioning site

Evidence: source-trace; `docs/ux/scenarios.md:974`; `docs/ux/scenarios.md:994`

Owning external passioncode-ai.github.io repository and deployed page not inspected. A prior rendered date is historical evidence; no current public-site PASS. Resolve owner and S11 decision before dropping/renaming scenario.

Packets: UX28-15


### SCN-039 — PARTIAL — Memory overview

Evidence: source-trace; `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:73`; `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:102`; `apps/desktop/src/shared/memoryOverview.ts:18`

Per-source failures/retry exist, but StoreCount has count/problem only: no last-read/source age/writer metadata. Retrieval and pack drill-ins absent; refresh resets good counts to loading and loses last good snapshot on failure.

Packets: UX28-07 UX28-02


### SCN-040 — PARTIAL — Rejoin from decisions

Evidence: renderer-probe; `apps/desktop/src/renderer/src/DigestSection.tsx:35`; `apps/desktop/src/renderer/src/DigestSection.tsx:45`; `apps/desktop/src/renderer/src/DigestSection.tsx:65`; `apps/desktop/src/renderer/src/DecisionsSection.tsx:90`

PROVEN: every feedMark change calls digest.seen before read, including failed reads. Rows/citations are plain text, no exact link or recompile; no compiledAt. Digest is below Tasks. Composed journal digest is deliberate; do not invent model summarization solely to meet old scenario wording.

Packets: UX28-03 UX28-06 UX28-15


### SCN-041 — PARTIAL — Agent-maintained board

Evidence: source-trace; `apps/desktop/src/renderer/src/ProjectHome.tsx:443`; `apps/desktop/src/renderer/src/ProjectHome.tsx:465`

Keyboard-select alternative and journal-derived board exist. Optimistic state rolled back for resolved refusal only; IPC Promise rejection leaves moved card until later state transition. Need authoritative transport-failure recovery.

Packets: UX28-04


### SCN-042 — FAIL — Manager request to artifact

Evidence: source-trace; `apps/desktop/src/renderer/src/App.tsx:517`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:8`

Reachable CEO control opens attention queue; conversation, editable specification, confirm-create lifecycle not implemented. This is missing planned capability, not regression in shipped attention handling.

Packets: UX28-12


### SCN-043 — PARTIAL — Project favourites

Evidence: source-trace; `apps/desktop/src/renderer/src/EstateHome.tsx:97`; `apps/desktop/src/shared/favourites.ts:50`

Pin control always shown and toggle appends without cap; no <=6 suppression or sixth-pin replacement choice. Stale favourite removed from displayed partition silently. Underlying local preference model is deliberate.

Packets: UX28-10


### SCN-044 — PARTIAL — Estate profile measurements

Evidence: source-trace; `apps/desktop/src/renderer/src/ProfileSection.tsx:23`; `apps/desktop/src/renderer/src/ProfileSection.tsx:59`

Reads once, labels figures but no per-figure source register/reason/age. Five aggregates intentionally non-clickable pending destinations. Mascot/name deliberately absent CO-109; retain explicit scope rather than fake portrait.

Packets: UX28-06 UX28-02


### SCN-045 — PARTIAL — Task own page

Evidence: renderer-probe; `apps/desktop/src/renderer/src/ProjectHome.tsx:274`; `apps/desktop/src/renderer/src/TaskPage.tsx:52`; `apps/desktop/src/renderer/src/TaskPage.tsx:191`; `apps/desktop/src/renderer/src/TaskPage.tsx:217`; `apps/desktop/src/renderer/src/TaskPage.tsx:279`

PROVEN: switching A→B preserves A textarea then blur writes it to B. Async reads also unfenced. Notes omit timestamp/identity (only kind), promoted fact is badge not link, relation rows non-clickable, original agent draft not rendered.

Packets: UX28-01 UX28-06


### SCN-046 — PARTIAL — Plan and history graphs

Evidence: source-trace; `apps/desktop/src/renderer/src/PlanSection.tsx:114`; `apps/desktop/src/renderer/src/PlanSection.tsx:124`; `docs/evidence/backlog.md:123`

Goal preview, denominator coverage, orphan assignment exist. SCR-40 addressable revision/graph/history absent; listed tasks non-clickable; no back selection restore. M190 explicitly ships numeric fix only.

Packets: UX28-08


### SCN-047 — PARTIAL — Harness contract and authority

Evidence: source-trace; `apps/desktop/src/main/index.ts:2915`; `apps/desktop/src/renderer/src/HarnessSection.tsx:51`; `apps/desktop/src/renderer/src/HarnessSection.tsx:102`

harnessRead ignores projectId, returns machine launch options, one Fabric endpoint, and estate grants; null/error counts coalesce to zero. No per-server grant/required-skill/bound-agent matrix. Do not derive start authorization from this display.

Packets: UX28-05


### SCN-048 — PARTIAL — Estate search

Evidence: source-trace; `apps/desktop/src/shared/search.ts:20`; `apps/desktop/src/renderer/src/SearchPanel.tsx:35`; `apps/desktop/src/shared/entityRef.ts:119`

Only facts/transcripts/tasks are searched, not projects/decisions; all groups rendered including empty, no per-store show-all. New query retains prior hits while pending/failing. Exact task navigation works; fact/transcript open project with honest fallback, not clicked entity.

Packets: UX28-02 UX28-06 UX28-09


### SCN-049 — PARTIAL — Estate agents workspace

Evidence: source-trace; `apps/desktop/src/renderer/src/EstateAgents.tsx:39`; `apps/desktop/src/renderer/src/EstateAgents.tsx:102`; `apps/desktop/src/renderer/src/EstateAgents.tsx:137`; `apps/desktop/src/renderer/src/styles.css:146`

Three children use a two-column grid. Centre is explicitly read-only tail, no live input/task link/end action; no waiting-first sort. Session history read once, old session history/repo retained on selection/failure. Target SCN49 materially exceeds current reader.

Packets: UX28-02 UX28-13


## Agent execution packets
Packets are proposed continuations under existing owners, not newly reserved milestone ids. Every implementation must use current repository coordination and delivery contract. Read scenario/story/flow plus listed files; inspect current HEAD before adapting baseline line numbers. No packet may claim full production completion from fixtures only.


### UX28-01 · P1 · Bind task detail, brief drafts and writes to the task identity

Owner: S01 / M143 / M146 corrective continuation

Context: `apps/desktop/src/renderer/src/TaskPage.tsx:42`; `apps/desktop/src/renderer/src/TaskPage.tsx:89`; `apps/desktop/src/renderer/src/ProjectHome.tsx:274`

Dependencies: S01 command CAS contract; independent of manager/model

Solution/decomposition:

1. Reproduce with provided temporary test before any edit.

2. Represent displayed task detail with target id and request generation; clear or explicitly mark previous detail on navigation.

3. Use controlled task-keyed brief drafts; submitted payload carries immutable task id/field/body/base revision.

4. Keep draft until successful save for that task; ignore stale load completion; show local failed/loading states with Back still reachable.

5. Preserve original agent draft and append-only revision history; do not silently switch author on blur.

Positive acceptance: A edits/saves to A; B fields load B; failed save preserves text; note drafts remain separate.

Negative acceptance: A→B quick switch with A response late must never display/save A under B; use probe expecting current buggy call absent; double blur must not duplicate append.

Exclusions: No generic monolith extraction required. No new auto-save semantics without scenario amendment.


### UX28-02 · P1 · Make renderer reads keyed, current, independently failed and visibly stale

Owner: M102 + S14 / CO-111 corrective readers

Context: `apps/desktop/src/renderer/src/ProjectHome.tsx:144`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1164`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1742`; `apps/desktop/src/renderer/src/EstateAgents.tsx:39`; `apps/desktop/src/renderer/src/SearchPanel.tsx:35`; `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:41`; `apps/desktop/src/renderer/src/EstateHome.tsx:68`

Dependencies: Read envelope S14 already available; restore cursor integration CO-111 remains separate

Solution/decomposition:

1. Inventory consumers with query identity: project/session/task/store/query/category/superseded and refresh reason.

2. Fence latest generation and bind each payload to its identity; independently settle history/repositories and overview/misses.

3. Preserve last good payload only with explicit age/stale/failure; new subject never inherits old subject payload.

4. Pass monotonic feedMark to EstateHome Board/attention rather than capped feed.length; subscribe event classes for presets/created agents/facts.

5. Return honest transport errors and local retry; remove swallowing failures into empty/declined.

6. Do not blindly introduce minimumCursor until each reader can record actually displayed payload.

Positive acceptance: Refresh after 501st event updates estate Board; selected B shows only B; category changes return matching facts; current preset count changes on task events.

Negative acceptance: Resolve A late after B; same query different category; reject one source while other resolves; failed initial read never reads empty; failed refresh must not show old value as current.

Exclusions: Do not count fixture tests as live process proof; no production queries or mutations needed for regression tests.


### UX28-03 · P1 · Stop marking unshown digest entries seen

Owner: M133 + M102 + S14 / CO-111

Context: `apps/desktop/src/renderer/src/DigestSection.tsx:35`

Dependencies: CO-111 full cursor extension needed only if implementing durable feed cursors

Solution/decomposition:

1. Reproduce feedMark-only seen call with supplied test.

2. Separate fetch lifecycle from visit/display acknowledgement.

3. Record only highest successfully displayed digest boundary; failed read does not advance.

4. Use immutable displayed cursor/mark rather than now at cleanup; define whether closing task preview counts as leaving with existing journey.

5. Keep old digest visible with failed-refresh age and retry.

Positive acceptance: Refreshing feed updates digest while unread items remain available; successful visited boundary becomes seen exactly once.

Negative acceptance: Failed load/unmount and feedMark change cannot mark unseen new events seen; late cleanup cannot advance beyond shown payload.

Exclusions: Do not add a model summarizer or new digest store.


### UX28-04 · P1 · Recover optimistic board state on transport failure

Owner: M146 / S01 correction

Context: `apps/desktop/src/renderer/src/ProjectHome.tsx:443`

Dependencies: Existing task command CAS/ladder

Solution/decomposition:

1. Wrap move/close command and refetch in explicit result/error states.

2. Rollback optimistic destination on command rejection; retain authoritative previous card and show failure.

3. For success followed by refresh failure show confirmed-but-stale state and retry reconciliation rather than claiming command failed.

4. Disable conflicting same-task moves while command unresolved or carry command id/revision for ordered completion.

Positive acceptance: Successful transition reconciles; rejected command returns original column and accessible local reason.

Negative acceptance: Promise.reject from tasks.move/close cannot leave a false column or unhandled rejection; double click/out-of-order completion cannot revert newer authoritative state.

Exclusions: Preserve keyboard move alternative; do not replace with drag-only interaction.


### UX28-05 · P1 · Scope harness to project and expose unknown grant reads

Owner: M145 + S14 + S02 authority display

Context: `apps/desktop/src/main/index.ts:2915`; `apps/desktop/src/renderer/src/HarnessSection.tsx:30`

Dependencies: S02 scope/auth schema; M155/M181 existing capability semantics

Solution/decomposition:

1. Define project harness DTO separating machine available providers from bound project agents, installed mandatory skill, configured servers and per-server grant availability.

2. Filter grants by authoritative project/scope or explicitly label estate-only counts; use errors/unknown instead of null-to-zero.

3. Render per-source loading/failure/age and required grant reason; inspect registered tool contract from same runtime source.

4. Keep declarative configuration, observed capability and actual authorization distinct.

Positive acceptance: Two projects with different bindings/grants render different scoped snapshots; tool list matches live registry.

Negative acceptance: Grant query failure displays unavailable, never 0; absent skill/grant cannot appear launch-ready; cross-estate/project rows never leak into project snapshot.

Exclusions: No per-tool usage counters until real call-log producer; no fabricated zero telemetry.


### UX28-06 · P2 · Complete exact evidence destinations and task history reading

Owner: S13 + M143/M133/M135/M141/M142

Context: `apps/desktop/src/shared/entityRef.ts:119`; `apps/desktop/src/renderer/src/TaskPage.tsx:217`; `apps/desktop/src/renderer/src/TaskPage.tsx:279`; `apps/desktop/src/renderer/src/DecisionsSection.tsx:90`; `apps/desktop/src/renderer/src/ProfileSection.tsx:59`

Dependencies: S13 existing resolver; M191 store detail for pack destinations

Solution/decomposition:

1. Extend one AppRoute/EntityRef contract for fact, transcript, decision/journal/resource destinations; source ownership checked by resolver.

2. Pass exact id from search, digest, task relations, promoted notes, counts; restore prior route and selection on Back.

3. Display note author identity and time; expose original agent brief under later operator version.

4. Render unresolved target in place with original ref and reason; no silent deletion or unrelated project jump.

5. Add source-register/age/reason to profile count DTO and row; keep unmeasured metrics absent.

Positive acceptance: Every cited item opens exact id; task sibling/back, promoted fact/back, transcript hit/back preserve context.

Negative acceptance: Missing/forbidden/cross-project target says unavailable without routing to another entity; 20+ items pagination cannot imply completeness.

Exclusions: Do not duplicate resource document bodies on task page; do not fake linked aggregate destinations.


### UX28-07 · P2 · Finish inspectable memory stores beyond counts

Owner: M191 + M135 + S14

Context: `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx:102`; `apps/desktop/src/shared/memoryOverview.ts:18`

Dependencies: S14 + UX28-06; pack producer M191 shipped

Solution/decomposition:

1. Model each store read with holds/writer/source/last read/coverage/last successful refresh.

2. Add retrieval list including hits and misses; pack detail/lineage/sync pages through canonical routes.

3. Use same compiler for preview and actual launch; label preview versus delivered compiled pack; retain dry-run no-write invariant.

4. Render corrected facts destination with toggle/filter carried in route.

Positive acceptance: Four stores have drill-in; never-read differs from empty; correction opens exact historical row.

Negative acceptance: Failed one-store read keeps others; preview creates no journal/retrieval rows or process; stale source cannot present current count.

Exclusions: Do not duplicate compilation selection logic; do not reopen shipped compiler changes absent failing evidence.


### UX28-08 · P2 · Implement target plan and distinct project history routes

Owner: M190 / SCR-40

Context: `apps/desktop/src/renderer/src/PlanSection.tsx:114`; `docs/ux/scenarios.md:1154`

Dependencies: Actual producers per ADR-0042/0045, M188/M152/S14; UX28-06

Solution/decomposition:

1. Keep legacy goal preview; implement GraphSnapshot revision/coverage/source contracts and graph/list equivalent.

2. Carry target-plan vs project-history in URL/AppRoute and selected revision.

3. Open task from goal/edge and preserve revision/selection on Back.

4. Represent orphan work and undecomposed goals; validate normative dependency cycles at command boundary.

Positive acceptance: Same-snapshot total includes completed membership; intended graph/history are separate; keyboard list has same nodes/actions.

Negative acceptance: Partial/capped source never hides nodes or creates false completion; history cycles must not be rejected as normative plan errors.

Exclusions: Never treat product.html mockup GraphSnapshot as runtime data; no generic graph-engine build before concrete producer contracts.


### UX28-09 · P2 · Make search promises match searched stores

Owner: M141 correction

Context: `apps/desktop/src/shared/search.ts:20`; `apps/desktop/src/renderer/src/SearchPanel.tsx:109`

Dependencies: UX28-02, UX28-06; S14 search envelope

Solution/decomposition:

1. Add project/decision search producers, method labels and per-store independent envelopes.

2. Hide successful empty groups while retaining searched-stores summary and failed groups.

3. Per group expose count, coverage and bounded load-more/show-all, with stable query/cursor.

4. Tie visible results to current query and exact destination through UX28-06.

Positive acceptance: Queries find project titles and decision claims; zero results names all searched stores; partial failure leaves other hits.

Negative acceptance: Old query result may not look current; failed store excluded from complete-empty claim; cap=20 must show coverage and continuation.

Exclusions: Preserve grouped-by-nature semantics; no fictional cross-store ranking.


### UX28-10 · P2 · Implement declared favourites threshold and replacement choice

Owner: M120 correction

Context: `apps/desktop/src/renderer/src/EstateHome.tsx:97`; `apps/desktop/src/shared/favourites.ts:50`

Dependencies: SCN043; S14 local-state result

Solution/decomposition:

1. Confirm SCN043 threshold remains intended; if retained show pin controls only above 6 projects.

2. Cap preferred set at 5 and ask which to release when pinning sixth, preserve atomic local preference write.

3. Show removed/archived favourite reason and available recovery instead of silent disappearance.

Positive acceptance: 7 projects allow up to 5 favourites in operator order; sixth chosen atomically replaces explicit selection.

Negative acceptance: <=6 offers no unnecessary ranking; failed write leaves old set; unavailable project data cannot delete saved preference.

Exclusions: Do not migrate preference to journal; per-person persistence waits for real authentication M38.


### UX28-11 · P2 · Make project settings save an honest single result

Owner: M17/M127 + S01 command integrity

Context: `apps/desktop/src/renderer/src/ProjectHome.tsx:938`; `apps/desktop/src/renderer/src/ProjectHome.tsx:953`

Dependencies: Existing project config commands and S01; UX28-15 clarification

Solution/decomposition:

1. Capture settings draft against config_revision.

2. Submit one validated CAS command for all edited fields or explicitly return field-level partial receipt and preserve unsaved remainder.

3. Do not reset dirty draft when background config_revision changes; show conflict choices.

4. Reconcile repo_path scenario with primary-repository invariant instead of reintroducing free typed cwd.

Positive acceptance: Name/purpose/agent/server edits either commit one revision or show precisely which portion committed.

Negative acceptance: Second-write failure cannot look like nothing saved; concurrent agent update cannot erase operator draft; stale base revision refused.

Exclusions: No arbitrary direct repository-path setting that bypasses opened-root boundary.


### UX28-12 · P2 · Manager interaction to confirmed artifact (existing future delivery)

Owner: M166–M175 / M194 + M153/M158

Context: `docs/evidence/backlog.md:136`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:8`

Dependencies: M153,M158,M166,M167,M169,M171,M194,M175 in existing dependency order

Solution/decomposition:

1. Reuse existing manager work packets; deterministic core and optional ModelPort precede conversational executor.

2. Use selected project/estate binding and authority context; present editable spec then explicit confirm command.

3. On no provider or missing grant show unavailable/refused and retain spec; cross-project request becomes proposal.

4. Creation receipt is result; closing unconfirmed spec writes nothing.

Positive acceptance: Confirmed supported spec yields canonical binding/routine/task ref; refusal preserves editable draft.

Negative acceptance: Advice cannot be shown as committed artifact; model verdict cannot grant authority; no-provider path makes no hidden paid call.

Exclusions: No parallel competing CEO implementation. Keep shipped attention board and planned conversation separate.


### UX28-13 · P2 · Complete estate agents control surface

Owner: M71 / SCR-39 + M187

Context: `apps/desktop/src/renderer/src/EstateAgents.tsx:97`; `apps/desktop/src/renderer/src/EstateAgents.tsx:137`

Dependencies: UX28-02, M105 bounded PTY path, UX28-06

Solution/decomposition:

1. Use existing TerminalView for selected session with one attach lifecycle; selected agent remains stable during reorder.

2. Sort actionable waiting sessions first using observed obligation state; show ended sessions/exit code.

3. Render task link, detach, end action, live journal effects/history and scoped repo state.

4. Use explicit three-column desktop layout and narrow list/detail alternative; plan keyboard focus and reduced motion.

Positive acceptance: Typing reaches selected live session without detach; selected agent and task route stable; events update history.

Negative acceptance: Switch A→B cannot show A repo/history; attach failure isolated; repeated attach does not duplicate PTY listener; closing view does not terminate session.

Exclusions: Do not create second decoder or infer performed actions from terminal text; no stale console labelled live.


### UX28-14 · P2 · Verify real runtime accessibility, resizing and native integration

Owner: M187 + M110/M117 + relevant scenario owners

Context: `apps/desktop/src/renderer/src/styles.css:146`; `apps/desktop/src/renderer/src/styles.css:278`; `apps/desktop/src/renderer/src/components/TabStrip.tsx:55`; `apps/desktop/src/renderer/src/tokens.app.css:84`

Dependencies: Use actual native test setup after read-side fixes; existing source token system preserved

Solution/decomposition:

1. Launch known isolated fixture estate using native runtime; record exact build/database/fixtures.

2. Walk top flows via keyboard, then screen reader: onboarding, task page/save, board transition, search, agent selection, editor conflict.

3. Test 1280/640/375 CSS widths and 200% zoom; sidebar 40vw cap, four-column board and estate three-child/two-column grid are required inspection targets.

4. Verify focus on open/close/back, accessible control names, no dead-end/loading-only failure, contrast light/dark and motion reduced.

5. Attach screenshots/DOM/replay receipts; do not convert old screenshots or scanner results into current accessibility PASS.

Positive acceptance: Each scoped scenario has observed result or precise blocked reason; keyboard and pointer reach equivalent actions.

Negative acceptance: Injected missing IPC/query rejection/path denial maintains usable recovery and unsaved text; screen reader announces relevant errors.

Exclusions: No accessibility PASS from static CSS, jsdom, axe alone. No product mockup evidence substituted for runtime.


### UX28-15 · P2 · Reconcile scenario wording and shipped claims with evidence

Owner: evidence-docs + existing M/S ownership

Context: `docs/ux/scenarios.md:700`; `docs/ux/scenarios.md:957`; `docs/evidence/backlog.md:643`; `docs/evidence/backlog.md:682`

Dependencies: Full parent audit reconciliation; source git baseline d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

Solution/decomposition:

1. For each scenario separate normative expected behavior, legacy implementation, current test evidence and future target.

2. Correct SCN028 free repo path and SCN037 removed strip; retain SCN046 target graph as future with M190 scope explicit.

3. Return M141/M135/M133/M143/M145 broad shipped claims to precise partial scope with named continuation, not wholesale deletion.

4. SCN038 inspect owning external repo or explicitly block; S11 rebranding choice owns changes.

5. Use same-change scenarios/flows/screens/model/map and existing IDs; never duplicate work from queue/carryover.

Positive acceptance: Every delivered assertion cites exact runtime source or run receipt; missing capabilities have one owner and packet; lint warning causes listed.

Negative acceptance: Generated mockup/source-only test cannot mark native scenario validated; deleted requirements require explicit recorded decision, not inferred from missing code.

Exclusions: Do not add model summarizer, arbitrary graphs or mascot only to fit stale prose; preserve archived reports.


## Queue report disposition

Keep the 2026-09-09 queue report as historical delivery evidence. Its admitted missing SCR-40/pack/manager UI remain valid. Corrective work is additionally needed in already shipped reader surfaces. Do not delete capabilities only because renderer lacks them. Merge duplicates into the existing M/S/CO owner packets: task identity under S01/M143; reader freshness under M102/S14; graph routes under M190; pack memory details under M191; agent workspace under M71; no new parallel manager plan.

Parent must deduplicate UX28-02 with any S14/M102 reader findings; harness missing grant-scoping merges M145/S02; manager SCN042 is future capability owned M166–M175, not fresh regression.
