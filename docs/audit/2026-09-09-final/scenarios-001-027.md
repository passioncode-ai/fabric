# Fabric — SCN-001..027 deep static audit, 2026-09-09

HEAD: `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`. Verdict: **REFINE**. Counts: {'PASS': 0, 'PARTIAL': 10, 'FAIL': 17, 'BLOCKED': 0}.

This audit follows ux-audit SKILL.md (super-ux 0.55.1), AGENTS.md and docs/AGENT_SYNC.md. Read-only: no shared/canonical files or Git state edited. The two /tmp artifacts are inputs for the parent consolidated repository report, not sole delivery.

## Scope and proof strength

- No native desktop/PTY lifecycle replay performed in this subaudit.
- No implementation tests executed by this subagent; parent runs coordinated suites.
- No live external OAuth/provider/service access, real multi-user identity or deployment verification.
- Product outcome remains unobserved; static source paths are not runtime verification.
- Figma disabled by foundation; no frame audit requested.
- Task proposals are recommendations for parent dedup, not reserved board IDs.

Executed: `python3 docs/ux/lint.py` → **0 errors, 38 warnings**. Warnings include missing index SCN-068..080 (outside this scope), unverifiable implementing-file screen coverage, external public coverage and installed vision rule drift. No warning becomes a runtime PASS.

## Main conclusion

The September 5 audit must not be replayed as 27 new implementation tasks. Attention navigation, named agents, routines, task-run records, local memory promotion, one-shot grants, atomic proposal decisions and addressed answer continuation now exist. The September 9 progress report accurately distinguishes those cores from missing product surfaces; its DONE rows do not close these larger scenario contracts. Strategic federation/role/observer/channel capabilities stay in their existing horizon owners. Six bounded current repair proposals are separated below from eleven strategic packages.

Current highest-value repairs: home/Board freshness stops when the feed reaches 500 rows; attention panel/card erase partial-source evidence; proposal action ignores typed failure results. Terminal error recovery and unread session-state propagation also remain incomplete. All are static caller traces, not observed runtime reproductions.

## Per-scenario verdicts

### SCN-001 — PARTIAL

Persistent project/draft/repository creation exists. No starter selection, atomic complete configuration review or exactly-one-PM creation path; purpose is optional. This is a target capability gap, not grounds to redo basic onboarding.

**Evidence:** `docs/ux/scenarios.md:91`; `docs/ux/foundation.md:214`; `apps/desktop/src/renderer/src/Onboarding.tsx:57`; `apps/desktop/src/main/index.ts:950`.

**Historical disposition:** Keep starter/PM/review residual; drop historical claim basic creation absent. Stable draft id makes repository-attachment retry resume existing creation.

**Existing owners:** M17, M35, M4, M9. **Proposals:** UXA-F01. Verification: static source trace.

### SCN-002 — FAIL

No portfolio starter/dynamic all-current-and-future scope, observer producer or cross-project read-only connection review. Ordinary project creation does not imply observer authority.

**Evidence:** `docs/ux/scenarios.md:113`; `apps/desktop/src/renderer/src/Onboarding.tsx:59`; `apps/desktop/src/shared/servers.ts:87`; `docs/architecture/iterations.md:57`.

**Historical disposition:** Retain strategic scope; do not implement an observer without named source service.

**Existing owners:** M4, M9, M20. **Proposals:** UXA-F01, UXA-F03. Verification: static source trace.

### SCN-003 — PARTIAL

Project-specific named runner configurations and MCP-server subset checks are built. Capability admission, role assignment, exact provider revisions, replacement/diff/CAS and affected-routine mapping are absent from creation form/command.

**Evidence:** `docs/ux/scenarios.md:136`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1259`; `apps/desktop/src/main/index.ts:1764`; `apps/desktop/src/main/pty.ts:280`.

**Historical disposition:** Replace old no-agent-bindings claim: M125 is real; M17 launch chooser is not full federation admission.

**Existing owners:** M17, M32, M34, M35. **Proposals:** UXA-F01. Verification: static source trace.

### SCN-004 — FAIL

Unknown/unavailable runner and unsupported surface adapters are refused, but no discovered-provider gate table/retry/adaptation UI exists. Binary availability cannot satisfy identity/protocol/semantic admission.

**Evidence:** `docs/ux/scenarios.md:157`; `apps/desktop/src/main/pty.ts:286`; `apps/desktop/src/shared/appRoute.ts:35`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1106`.

**Historical disposition:** Preserve launcher safety; keep independent admission/gate UI in federation horizon.

**Existing owners:** M17, M34. **Proposals:** UXA-F01, UXA-F05. Verification: static source trace.

### SCN-005 — FAIL

Current gateway server selector grants server names and supplies per-hop credentials without showing keys in renderer. No account OAuth/subject confirmation/resource-selector/versioned connection-binding UX.

**Evidence:** `docs/ux/scenarios.md:178`; `apps/desktop/src/shared/servers.ts:47`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1015`; `apps/desktop/src/main/index.ts:1789`.

**Historical disposition:** M127 closes server access selection only; do not equate it to external account/resource connection product.

**Existing owners:** M4, M9, M127. **Proposals:** UXA-F02. Verification: static source trace.

### SCN-006 — PARTIAL

Cards show project/purpose/repository/live-session count and derived attention. Missing projection age, independent health dimensions, PM and last/next run. Current attention badges also freeze at 500 displayed events and lose source failures.

**Evidence:** `docs/ux/scenarios.md:201`; `apps/desktop/src/renderer/src/EstateHome.tsx:59`; `apps/desktop/src/renderer/src/EstateHome.tsx:74`; `apps/desktop/src/renderer/src/App.tsx:208`.

**Historical disposition:** Drop absent-attention blanket; preserve health-dimension residual, reopen only named freshness/error regression.

**Existing owners:** M5, M42, M102, M147, S14, M186. **Proposals:** UXA-C01, UXA-C02, UXA-F04. Verification: static source trace.

### SCN-007 — PARTIAL

Attention row uses canonical EntityRef to open exact task when one exists; S13 eliminated bogus work→task route. This does not yet provide failing production dimension/observation→typed Run. Existing panel suppresses failed-source metadata.

**Evidence:** `docs/ux/scenarios.md:221`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:30`; `apps/desktop/src/shared/attention.ts:171`; `apps/desktop/src/main/index.ts:2356`.

**Historical disposition:** Historical no-deep-link claim closed for task obligations; observation and Run destinations remain separate gap.

**Existing owners:** M5, M20, S13, S14. **Proposals:** UXA-C02, UXA-F03, UXA-F04. Verification: static source trace.

### SCN-008 — PARTIAL

TaskRun identity and terminal immutability now exist; task detail offers briefs/notes/journal/session link, not SCR-09 pinned revisions/typed result/checker/artifacts/recovery preview. A task status or transcript is not a run result.

**Evidence:** `docs/ux/scenarios.md:242`; `apps/desktop/src/shared/taskRun.ts:24`; `apps/desktop/src/main/index.ts:1251`; `apps/desktop/src/renderer/src/TaskPage.tsx:117`.

**Historical disposition:** Drop assertion Run table absent; retain missing workflow graph/full revision lineage and result/recovery UI.

**Existing owners:** M2, M65, M188, S10. **Proposals:** UXA-F04. Verification: static source trace.

### SCN-009 — PARTIAL

Routines persist separately, tick with quota and loop bound, create task and journal ran/paused receipts. They retain option_id; there is no provider replacement command/atomic PM swap or future-resolution review.

**Evidence:** `docs/ux/scenarios.md:263`; `apps/desktop/src/shared/routine.ts:26`; `apps/desktop/src/main/routineTick.ts:169`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1464`.

**Historical disposition:** Historical scheduler missing is closed; exact provider-replacement contract remains unmet.

**Existing owners:** M17, M65, M66, M35. **Proposals:** UXA-F01. Verification: static source trace.

### SCN-010 — FAIL

Only loop-bound same-project proposals are produced. fileProposal has projectId/fromTaskId/depth/bound but no source/target observation/PM routing/freshness contract. Cross-project finding→proposal flow absent.

**Evidence:** `docs/ux/scenarios.md:285`; `apps/desktop/src/main/commands/proposalCommands.ts:160`; `apps/desktop/src/shared/attention.ts:87`.

**Historical disposition:** Keep cross-project residual; do not duplicate existing loop-bound proposal infrastructure.

**Existing owners:** M20, M129, M68. **Proposals:** UXA-F03. Verification: static source trace.

### SCN-011 — FAIL

Existing loop-bound proposals now decide atomically with checker and row-lock revalidation. Target PM source/target acceptance, supersession and freshness review are absent. Current caller also discards typed rejections from existing decision path.

**Evidence:** `docs/ux/scenarios.md:305`; `apps/desktop/src/main/commands/proposalCommands.ts:112`; `apps/desktop/src/shared/proposals.ts:76`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:107`.

**Historical disposition:** Duplicate-work decision race closed in core; missing target-PM scenario still open, typed refusal delivery regressed in renderer.

**Existing owners:** M20, M168. **Proposals:** UXA-C03, UXA-F03. Verification: static source trace.

### SCN-012 — PARTIAL

Task-note→same-project memory promotion, provenance, correction and supersession UI exist. No reviewed estate knowledge or target-PM transfer with confidence/expiry/contradiction review.

**Evidence:** `docs/ux/scenarios.md:327`; `apps/desktop/src/renderer/src/TaskPage.tsx:75`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1762`; `supabase/migrations/20260908000033_projector_scope.sql:339`.

**Historical disposition:** Preserve shipped local memory/promote; do not label those absent or treat local promotion as estate transfer.

**Existing owners:** CO-081, M135, M182, M154. **Proposals:** UXA-F06. Verification: static source trace.

### SCN-013 — FAIL

S09 adds last-owner floor, membership revision and ActorContext decision table; no authenticated identity, invitation transport/review acceptance or role projection. VISIBILITY is explicitly estate-wide, not project ACL.

**Evidence:** `docs/ux/scenarios.md:349`; `docs/ux/flows.md:193`; `apps/desktop/src/shared/membership.ts:1`; `apps/desktop/src/shared/membership.ts:149`; `docs/reports/2026-09-09-queue-progress-report.html:204`.

**Historical disposition:** S09 is real authority foundation; must not mark scenario implemented or open multi-user distribution from it.

**Existing owners:** M38, S09. **Proposals:** UXA-F07. Verification: static source trace.

### SCN-014 — FAIL

Generic authored question answer/CAS/continuation exists, but no role-addressed workspace, SLA/escalation/delegation/effect preview or member identity.

**Evidence:** `docs/ux/scenarios.md:369`; `apps/desktop/src/renderer/src/BoardPanel.tsx:110`; `apps/desktop/src/main/index.ts:2375`; `apps/desktop/src/shared/membership.ts:149`.

**Historical disposition:** Keep role-work residual; reuse existing question lifecycle rather than building duplicate approval queue.

**Existing owners:** M39, M149, M151, M152, S09. **Proposals:** UXA-F07. Verification: static source trace.

### SCN-015 — FAIL

Adapter CLI/source artifacts exist externally; host foundry recipe/checksum/report-return/conformance UI not wired. No author-controlled approve-plan→apply lifecycle inside Fabric desktop.

**Evidence:** `docs/ux/scenarios.md:392`; `apps/desktop/src/shared/appRoute.ts:35`; `docs/architecture/agent-production.md:162`; `$HOME/DATA/fabric-agent-adapter/README.md:32`.

**Historical disposition:** Reuse adapter repository; remove task to reinvent scaffold. Desktop host integration remains.

**Existing owners:** M32, M34, M37. **Proposals:** UXA-F05. Verification: static source trace.

### SCN-016 — FAIL

No independent conformance/admit-exact-revision/canary-binding host surface. Contract explicitly distinguishes shape conformance from admission.

**Evidence:** `docs/ux/scenarios.md:414`; `docs/architecture/agent-production.md:167`; `$HOME/DATA/fabric-agent-contract/README.md:57`; `apps/desktop/src/shared/appRoute.ts:35`.

**Historical disposition:** Strategic gate remains; passing local CLI report cannot be counted as admission.

**Existing owners:** M32, M34, M37. **Proposals:** UXA-F05. Verification: static source trace.

### SCN-017 — FAIL

No host phase/gate changed-files/rollback/fix-recipe flow; local adapter can supply artifacts but no renderer recovery loop exists.

**Evidence:** `docs/ux/scenarios.md:436`; `apps/desktop/src/shared/appRoute.ts:35`; `docs/architecture/agent-production.md:162`.

**Historical disposition:** Retain one foundry recovery package; not a separate provider implementation.

**Existing owners:** M37. **Proposals:** UXA-F05. Verification: static source trace.

### SCN-018 — FAIL

Current fixed Workspace component is a read surface, not admitted/sandboxed provider layout publication. No role scope, revisioned layout, constrained spans/canonical keyboard order/fallback review.

**Evidence:** `docs/ux/scenarios.md:458`; `docs/ux/flows.md:267`; `apps/desktop/src/renderer/src/Workspace.tsx:1`; `apps/desktop/src/shared/appRoute.ts:35`.

**Historical disposition:** Keep as later capability; do not replace current workspace with extension host before permission/sandbox contract.

**Existing owners:** M37, CO-091. **Proposals:** UXA-F08. Verification: static source trace.

### SCN-019 — FAIL

No support ingestion/customer identity/SLA/send delivery reconciliation or role-workspace loop. Ordinary tasks and effect authorization are prerequisites only.

**Evidence:** `docs/ux/scenarios.md:481`; `docs/ux/flows.md:300`; `apps/desktop/src/shared/appRoute.ts:35`; `docs/architecture/iterations.md:59`.

**Historical disposition:** Keep bounded support loop conditional on selected channel and identity policy; no invented vendor integration.

**Existing owners:** M27, CO-085, M39. **Proposals:** UXA-F09. Verification: static source trace.

### SCN-020 — FAIL

Local task execution/follows/handoffs/checker/effect lifecycle foundations do not supply production collector→owning PM→release→recovery observation loop. Latest report explicitly lists external effect dispatcher with zero providers.

**Evidence:** `docs/ux/scenarios.md:503`; `docs/architecture/iterations.md:57`; `docs/reports/2026-09-09-queue-progress-report.html:200`; `apps/desktop/src/shared/taskRun.ts:24`.

**Historical disposition:** Keep production-loop residual; retain S08 bounded fixture proof without generalizing to deployed release.

**Existing owners:** M2, M25, M129, S03.effects, S08. **Proposals:** UXA-F03, UXA-F09. Verification: static source trace.

### SCN-021 — FAIL

No research/source acceptance/channel drafting/editorial SEO checking/publish/feedback UI. Needs named channel/account, approved facts, effect adapter and observation contract.

**Evidence:** `docs/ux/scenarios.md:525`; `docs/ux/flows.md:369`; `apps/desktop/src/shared/appRoute.ts:35`; `docs/architecture/iterations.md:58`.

**Historical disposition:** Keep initial one-shot publication; recurring standing grants remain CO-036, not presumed authorization.

**Existing owners:** M21, M128, CO-036. **Proposals:** UXA-F09. Verification: static source trace.

### SCN-022 — FAIL

Session-generated MCP credential and server config exist. No estate-owner explicit project-set/scope/expiry binding, one-time reveal/rotate/receipt management surface.

**Evidence:** `docs/ux/scenarios.md:547`; `apps/desktop/src/main/agentSurface.ts:67`; `apps/desktop/src/main/agentSurface.ts:186`; `apps/desktop/src/shared/appRoute.ts:35`.

**Historical disposition:** Coverage named sessionBundle/servers must stay partial southbound evidence, not scenario closure.

**Existing owners:** M15. **Proposals:** UXA-F10. Verification: static source trace.

### SCN-023 — FAIL

Credential-scoped internal agent tools with journal receipts exist. No durable northbound binding/task negotiation/project-scoped idempotent run control satisfying external-client contract.

**Evidence:** `docs/ux/scenarios.md:569`; `apps/desktop/src/main/agentSurface.ts:515`; `apps/desktop/src/main/agentSurface.ts:328`; `docs/evidence/backlog.md:234`.

**Historical disposition:** Retain southbound foundations; do not duplicate transport or mislabel internal sessions external access.

**Existing owners:** M15, M188. **Proposals:** UXA-F10. Verification: static source trace.

### SCN-024 — FAIL

Existing unknown/expired/mismatched-session tokens fail at ingress and session revoke exists. No owner binding revoke/rotation/cache invalidation/in-flight run management surface.

**Evidence:** `docs/ux/scenarios.md:591`; `apps/desktop/src/main/agentSurface.ts:206`; `apps/desktop/src/main/agentSurface.ts:254`; `apps/desktop/src/main/agentSurface.ts:398`.

**Historical disposition:** Keep current session token denial evidence; still no end-to-end external access lifecycle.

**Existing owners:** M15, S03. **Proposals:** UXA-F10. Verification: static source trace.

### SCN-025 — PARTIAL

PTY live stream, replay, own-window session and journal lifecycle exist. Launcher omits start cwd; session initial error is handled but polling/onExit rejections are unhandled and initial error cannot recover. Foundation/FLW-13 still prescribe obsolete terminal tab. Renderer stream snapshot/live subscription race remains unverified.

**Evidence:** `docs/ux/scenarios.md:615`; `docs/ux/foundation.md:360`; `docs/ux/flows.md:444`; `apps/desktop/src/renderer/src/ProjectHome.tsx:1103`; `apps/desktop/src/renderer/src/SessionWindow.tsx:16`; `apps/desktop/src/renderer/src/TerminalView.tsx:34`; `apps/desktop/src/main/pty.ts:395`.

**Historical disposition:** Drop old all-load-errors-uncaught claim: initial error branch now exists. Retain specific async recovery, cwd and document mismatch; verify terminal race before calling it reproduced.

**Existing owners:** M16, M17, M106, M108, M105. **Proposals:** UXA-C04, UXA-C05, UXA-C06. Verification: static source trace.

### SCN-026 — PARTIAL

Durable replay polling is guarded against overlap and renders localized event sentences. No Realtime subscription; receipt links/filter/unread marker absent; capped array length freezes home dependants. Poll failure uses global banner without source stale state.

**Evidence:** `docs/ux/scenarios.md:642`; `apps/desktop/src/renderer/src/App.tsx:193`; `apps/desktop/src/renderer/src/Feed.tsx:20`; `apps/desktop/src/main/index.ts:3376`.

**Historical disposition:** Retain named feed residual; do not redo working polling, sequence ordering guard or sentence registry.

**Existing owners:** M42, M102, S13, S14. **Proposals:** UXA-C01, UXA-C02, UXA-C06. Verification: static source trace.

### SCN-027 — PARTIAL

Policy floor/one-shot grant and authored answer/CAS/targeted continuation exist. Universal canUseTool interception, autonomy-level detail/refuse-reason/timeout queue contract remain unclosed; core report explicitly says per-runner boundary incomplete. Grant act does not itself mean effect executed or continuation acknowledged.

**Evidence:** `docs/ux/scenarios.md:666`; `apps/desktop/src/main/index.ts:2678`; `apps/desktop/src/main/index.ts:2375`; `apps/desktop/src/main/index.ts:2410`; `apps/desktop/src/renderer/src/AttentionPanel.tsx:153`; `docs/evidence/backlog.md:669`.

**Historical disposition:** Discard historical no-queue/no-resumable-answer blanket. Preserve per-runner effect floor enforcement and product approval-view delta.

**Existing owners:** M140, S03, M152, M155. **Proposals:** UXA-C02, UXA-F11. Verification: static source trace.

## Agent task proposals

IDs UXA-* are local audit keys only; map to existing canonical owner, do not allocate a duplicate milestone. Current patches require UX scenarios/flows/screens changes in the same implementation where behavior changes. Follow task-pipeline/lease/map/publication contracts in owning repository.

### UXA-C01 — Use journal revision, not visible feed length, for home freshness

Priority: P1. Owners: M42, M102. Scenarios: SCN-006, SCN-026.

**Context:** App caps feed at 500; EstateHome attention effect and child BoardPanel watch length. From event 501 onward new obligations do not trigger refresh until remount.

**Solution:** Pass the existing monotonic feedMark through EstateHome and use event-aware invalidation; preserve display cap.

**Files:** `apps/desktop/src/renderer/src/App.tsx`; `apps/desktop/src/renderer/src/EstateHome.tsx`; `apps/desktop/src/renderer/src/BoardPanel.tsx`.

**Decomposition:**

1. Trace all feed-length refresh consumers and distinguish display counts from revision signals.
2. Add explicit feedMark prop to home and use it for attention/BoardPanel.
3. Where M102 supplies per-source invalidation, share it rather than add a broad second poller.

**Prerequisites:** None beyond existing reviewed source/normal implementation setup.

**Acceptance and negative tests:**

- Mount with 500 events, add event 501 while count unchanged: Board and attention reload and render new obligation.
- Slow replay does not overlap; unknown/error does not become zero; no reload from unrelated event once invalidation is narrowed.

**Exclusions:** Do not remove cap or redo durable replay.

**Unknowns:** No runtime component test run in this audit; static dependency reproduction only.

### UXA-C02 — Keep partial attention and source freshness visible across all consumers

Priority: P1. Owners: S14, M147, M151, M190. Scenarios: SCN-006, SCN-007, SCN-026, SCN-027.

**Context:** readAttentionWithSources measures failures and truncation; readAttention discards both. Panel can say clear after refused source read. EstateHome catch also clears badge. Board envelope is the stronger existing implementation.

**Solution:** Use one source-aware query contract for panel/home/board; preserve last data labeled stale; render unavailable source and capped history beside counts.

**Files:** `apps/desktop/src/main/index.ts`; `apps/desktop/src/shared/types.ts`; `apps/desktop/src/renderer/src/AttentionPanel.tsx`; `apps/desktop/src/renderer/src/EstateHome.tsx`; `apps/desktop/src/renderer/src/BoardPanel.tsx`.

**Decomposition:**

1. Map all attention.list consumers including notifier and source-appropriate error behavior.
2. Return ReadEnvelope or reuse board obligation envelope without dropping failed/truncated data.
3. Block clear/zero claims while relevant sources failed; retain accessible retry and data age.
4. Ensure authored questions and derived obligations remain separate types and obligations cannot be marked read.

**Prerequisites:** UXA-C01.

**Acceptance and negative tests:**

- Fail each source independently: unaffected rows survive; no false clear/zero; failed source named.
- 51 policy rows including older refusal show truncation or resolve complete outstanding set; one source outage does not hide other projects.
- Recover source: stale badge disappears and data refreshes.

**Exclusions:** Do not call generic polling stale evidence an authorization lease; do not invent unsupported production health.

**Unknowns:** Whether attention queue should derive unresolved policy obligations beyond fixed 50-event history needs explicit source contract; current truncation must be exposed immediately.

### UXA-C03 — Render typed proposal decision refusal at the action

Priority: P1. Owners: M168, M106. Scenarios: SCN-011.

**Context:** The command deliberately resolves {ok:false,rejection}; the only renderer caller uses .catch and discards resolved result. User sees no answer on checker unavailable/already decided.

**Solution:** Handle returned union, display says/remedy/retryability beside proposal, disable duplicate in-flight action and reload on committed result.

**Files:** `apps/desktop/src/renderer/src/AttentionPanel.tsx`; `apps/desktop/src/main/commands/proposalCommands.ts`; `apps/desktop/src/shared/proposals.ts`.

**Decomposition:**

1. Add stable pending/error/result state keyed by proposal id.
2. Handle ok:false without clearing evidence or draft.
3. On success display receipt/task destination and refresh immediately.
4. Use existing checker reason codes and translation contract.

**Prerequisites:** None beyond existing reviewed source/normal implementation setup.

**Acceptance and negative tests:**

- Mock fulfilled {ok:false} for checker_unavailable and already_decided: message rendered without unhandled rejection.
- Two clicks/windows produce one task; losing window shows existing decision/refusal, never silent success.
- Network rejection remains distinguishable from known refusal.

**Exclusions:** Do not rewrite core transaction or convert all typed refusals back to exceptions.

**Unknowns:** No independent runtime component reproduction yet; command/caller mismatch is statically certain.

### UXA-C04 — Recover terminal metadata loading and name launch cwd

Priority: P2. Owners: M16, M17, M106. Scenarios: SCN-025.

**Context:** SessionWindow catches initial get only; onExit/poll get reject without handler. Once initial error set, later successful get never clears it. Launcher hides cwd although main resolves it.

**Solution:** Use one cancellable metadata loader for initial/poll/exit/retry with last-known stale state; show effective cwd before launch and explicit ended/missing state.

**Files:** `apps/desktop/src/renderer/src/SessionWindow.tsx`; `apps/desktop/src/renderer/src/ProjectHome.tsx`; `apps/desktop/src/main/index.ts`; `apps/desktop/src/main/pty.ts`.

**Decomposition:**

1. Factor loader with request generation/alive guard and finally state.
2. Clear recoverable error after successful load; retain terminal view/scrollback on refresh error.
3. Expose effective cwd preflight including absent-repo behavior; surface SpawnFailure program/cwd.
4. Compare get snapshot versus stream subscription timing and add cursor/replay handshake only if loss demonstrated.

**Prerequisites:** None beyond existing reviewed source/normal implementation setup.

**Acceptance and negative tests:**

- Initial read fails then succeeds: window becomes usable without recreation.
- Poll/onExit failure renders recoverable stale state and no unhandled rejection.
- Spawn invalid cwd/program: no terminal.opened; success close/reopen yields same PTY and transcript.
- Continuous output during attach contains no lost/duplicated byte range, tested against real PTY.

**Exclusions:** Do not claim live PTY test passed from static code. Do not change unsupported runner permission semantics.

**Unknowns:** Snapshot→subscribe gap may drop bytes; needs deterministic real PTY race test before classification as observed defect.

### UXA-C05 — Preserve unread session state through AgentsSection

Priority: P2. Owners: M108. Scenarios: SCN-025.

**Context:** Parent accepts sessions|null but passes sessions??[] into required-array AgentsSection; EmptyState read={sessions!==null} can never represent loading.

**Solution:** Keep null through boundary and render skeleton/loading until first read.

**Files:** `apps/desktop/src/renderer/src/ProjectHome.tsx`.

**Decomposition:**

1. Change section prop contract to nullable.
2. Remove early fallback; filter only after preserving unread state.
3. Review affected count/empty copy and loader rejection branch.

**Prerequisites:** None beyond existing reviewed source/normal implementation setup.

**Acceptance and negative tests:**

- Hold terminal.list promise: reading shown, never no agents.
- Resolve []: actual empty state; reject: error/unknown not zero.

**Exclusions:** No new state framework; reuse existing EmptyState sentinel.

**Unknowns:** May overlap later-scenario audit; deduplicate with SCN-029/049 loading-state task.

### UXA-C06 — Reconcile terminal/feed UX contracts and add real receipt navigation

Priority: P2. Owners: S13, M42, M112. Scenarios: SCN-025, SCN-026.

**Context:** SCN-025 amended detached windows, ST-017/FLW-13 retain terminal tab. SCN-026 promises Realtime and per-row receipt links absent from Feed.

**Solution:** Keep canonical intended transport explicit: reconcile polling contract if intentionally accepted, or implement Realtime-as-wake without abandoning durable replay. Use canonical destinationOf for navigable event subjects, honest nonnavigable fallback.

**Files:** `docs/ux/foundation.md`; `docs/ux/flows.md`; `docs/ux/screens.md`; `docs/ux/scenarios.md`; `apps/desktop/src/renderer/src/Feed.tsx`; `apps/desktop/src/shared/entityRef.ts`; `apps/desktop/src/renderer/src/App.tsx`.

**Decomposition:**

1. Fix terminal successor chain without reviving retired SCR-23.
2. Decide whether Realtime is a requirement or obsolete implementation wording; record acceptance.
3. Map event→typed subject by registered event schemas, preserving seq/receipt.
4. Add project filter and unread cursor only with explicit durable/persisted semantics; refresh route model/mockups.

**Prerequisites:** UXA-C01; UXA-C02.

**Acceptance and negative tests:**

- Every supported feed event opens exact subject/receipt; unknown/missing subject states unverified and does not invent task id.
- Restart/reconnect replay ordering tested against gaps and duplicate wakeups.
- FLW terminal chain names detached SCR-25 and remains traceable; linter no new errors.

**Exclusions:** Do not delete historical dated audit; Product unobserved and disabled Figma are not bugs.

**Unknowns:** Realtime wording is canonical drift requiring explicit choice, not permission to silently weaken user behavior.

### UXA-F01 — Capability bindings, replacement, and starter activation

Priority: strategic. Owners: M32, M34, M35, M17, M66. Scenarios: SCN-001, SCN-002, SCN-003, SCN-004, SCN-009.

**Context:** Current agents are runner configurations; project creation has no PM starter. Provider admission and project binding are distinct durable acts.

**Solution:** Build exact-revision admission/binding command and one-for-one PM replacement before richer starter UX; derive starter review from same commands.

**Files:** `apps/desktop/src/main/index.ts`; `apps/desktop/src/main/pty.ts`; `apps/desktop/src/main/routineTick.ts`; `apps/desktop/src/renderer/src/Onboarding.tsx`; `apps/desktop/src/renderer/src/ProjectHome.tsx`; `supabase/migrations`; `docs/architecture/agent-production.md`.

**Decomposition:**

1. Inventory existing schema/contracts and M17/M125 to avoid duplicate agent entities.
2. Pin manifest/capability/effect ceilings and admission revision; fail before access on missing gate.
3. Commit replacement against expected configuration revision; keep past TaskRuns immutable and routine identity/trigger unchanged.
4. Implement provider-selection gate table and affected-routine review; activate starter atomically or retain recoverable draft.

**Prerequisites:** M34 admission probe; M32 capability vocabulary; M188 run lineage; S09 authenticated owner for multi-user authority.

**Acceptance and negative tests:**

- Unadmitted/new revision cannot inherit admission; grant above project ceiling refused.
- Two concurrent PM swaps preserve exactly one PM; old active run pins old revision; next tick uses successor.
- Cancellation before activation creates no configured project; failed transaction preserves all draft fields.

**Exclusions:** Do not reopen M17 launcher delivery; do not invent second real runner or capability vocabulary.

**Unknowns:** Named consumer/provider revision and initial supported capabilities required before implementation.

### UXA-F02 — Account/resource connection product

Priority: strategic. Owners: M4, M9, M127. Scenarios: SCN-005, SCN-002.

**Context:** Gateway server grants are not account subject/resource authorization.

**Solution:** Implement estate connection plus versioned project resource binding through explicit OAuth/static-token port and existing gateway rule.

**Files:** `apps/desktop/src/shared/servers.ts`; `apps/desktop/src/main/sessionBundle.ts`; `apps/desktop/src/main/index.ts`; `docs/ux/flows.md`; `docs/architecture/external-contracts.md`.

**Decomposition:**

1. Choose one real provider/resource and document authoritative scopes.
2. Model candidate subject confirmation, binding ceiling, selected resources/agents and expiry/health.
3. Handle denial/expiry/wrong account without losing project draft.
4. Keep secrets in approved custody; send only opaque refs and safe health to renderer.

**Prerequisites:** Named external service/account; S03 effect authorization; S09 identity for shared estates.

**Acceptance and negative tests:**

- Wrong account stops discovery and candidate can be disconnected.
- No selected resource/agent refuses save; revoked resource makes only affected binding stale.
- Tokens absent from config/journal/UI and retry does not duplicate connections.

**Exclusions:** No blanket OAuth integration and no gateway rewrite.

**Unknowns:** Provider, account, custody and callback transport must be selected; no paid/effect calls during planning.

### UXA-F03 — Observer evidence and cross-project proposal authority

Priority: strategic. Owners: M20, M129, M4, M9. Scenarios: SCN-002, SCN-007, SCN-010, SCN-011, SCN-020.

**Context:** Current proposals only restart loop-bound work in same project. No cross-project evidence/routing contract is carried.

**Solution:** Add explicit source/target observation envelope and target PM resolution contract; reuse atomic decision machinery without conflating proposal kinds.

**Files:** `apps/desktop/src/main/commands/proposalCommands.ts`; `apps/desktop/src/shared/proposals.ts`; `apps/desktop/src/shared/attention.ts`; `apps/desktop/src/main/agentSurface.ts`; `supabase/migrations`; `docs/ux/flows.md`.

**Decomposition:**

1. Select first observer source and owning-project route.
2. Define read visibility vs effect authority and dynamic scope confirmation.
3. Submit immutable evidence/freshness/idempotency envelope without target graph write.
4. Resolve accept/refuse/supersede under target authority; acceptance asks target PM to create work, preserving source links.
5. Render both project views and stale/missing-target recovery.

**Prerequisites:** UXA-F01 capability bindings; UXA-F02 first connector; M188 graph/task lineage.

**Acceptance and negative tests:**

- Duplicate same key returns same proposal; conflicting reuse refused.
- Source cannot directly write target tasks/memory; stale evidence blocks decision.
- Concurrent target decisions create at most one work request; supersession preserves history.

**Exclusions:** No separate replacement for M168; no auto-creation of target goals by source agent.

**Unknowns:** First live observation provider and retired-project routing policy must be named.

### UXA-F04 — Receipt-first run detail and independent project health

Priority: strategic. Owners: M5, M65, M188, M186, S13. Scenarios: SCN-006, SCN-007, SCN-008.

**Context:** TaskRun core exists, but task page does not expose pinned revisions, typed result/checker/artifacts/recovery preview. Cards are storage/live-session summaries.

**Solution:** Publish supported observations independently and create run-detail projection keyed by immutable TaskRun identity; distinguish WorkflowRun and verification checkpoint.

**Files:** `apps/desktop/src/shared/taskRun.ts`; `apps/desktop/src/main/index.ts`; `apps/desktop/src/renderer/src/TaskPage.tsx`; `apps/desktop/src/renderer/src/EstateHome.tsx`; `apps/desktop/src/shared/entityRef.ts`.

**Decomposition:**

1. Specify run identity and available historical revision fields with migration strategy.
2. Expose done/proof/scope/notVerified/checker and partial artifacts, plus known missing evidence.
3. Implement permitted recovery preview/retry as new admission and explicit cancellation state.
4. Attach each card health dimension to observation+timestamp and exact destination.

**Prerequisites:** M188 remaining lineage/WorkflowRun contracts per capability; UXA-C02 source envelopes; S03 authority.

**Acceptance and negative tests:**

- Old run is immutable after retry/rebinding; cancellation requested is not cancelled until observed.
- Partial artifact survives failure; missing checker does not read verified.
- One unavailable health source leaves other dimensions usable; not-configured differs from failed.

**Exclusions:** Do not promise full WorkflowRun graph from existing TaskRun table; do not invent composite health score.

**Unknowns:** Which revision snapshots already durable must be measured before additive schema design.

### UXA-F05 — Foundry host integration using existing adapter and contract

Priority: strategic. Owners: M32, M34, M37. Scenarios: SCN-004, SCN-015, SCN-016, SCN-017.

**Context:** Adapter and normative contracts already exist outside desktop; generation is not admission.

**Solution:** Host recipe/report/conformance lifecycle with exact pins and author-reviewed minimal change plan; reuse CLI artifacts.

**Files:** `docs/architecture/agent-production.md`; `apps/desktop/src/shared/appRoute.ts`; `apps/desktop/src/main/index.ts`; `$HOME/DATA/fabric-agent-adapter`; `$HOME/DATA/fabric-agent-contract`.

**Decomposition:**

1. Read exact adapter/contract pins and existing fixture schemas.
2. Create signed/checksummed/expiring recipe with no estate credentials; require dry run and review before writes.
3. Receive local report with changed files/checksums; execute independent conformance on exact revision.
4. Admit separately from project binding, canary and earned promotion.
5. Recovery preserves report and user code; rollback only generated task-owned paths.

**Prerequisites:** UXA-F01 capability/admission primitives; Pinned adapter/contract release.

**Acceptance and negative tests:**

- Tampered/expired recipe stops before write; local pass cannot override failed independent conformance.
- Unchanged rerun is idempotent; changed checksum invalidates old receipt.
- Cleanup failure lists leftovers and never deletes user-owned edits.

**Exclusions:** Do not recreate scaffold, auto-admit from schema pass, or publish/update installed plugin during audit.

**Unknowns:** Host execution sandbox and report trust model remain design decisions; no current desktop implementation.

### UXA-F06 — Reviewed estate memory promotion and target transfer

Priority: strategic. Owners: CO-081, M135, M182, M154. Scenarios: SCN-012.

**Context:** Local note promotion exists and must remain distinct from cross-project/estate authority.

**Solution:** Append destination-owned reviewed record with immutable provenance/backlink; target transfer pending until acceptance.

**Files:** `apps/desktop/src/shared/memoryContract.ts`; `apps/desktop/src/renderer/src/TaskPage.tsx`; `apps/desktop/src/renderer/src/ProjectHome.tsx`; `apps/desktop/src/main/commands`; `supabase/migrations`.

**Decomposition:**

1. Specify confidence, provenance, source reachability, expiry/decay and contradiction fields.
2. Add promotion command/checker and target acceptance transaction without source mutation.
3. Implement review UI and supersession lineage.

**Prerequisites:** UXA-F03 cross-project target authority; S09 owner identity for estate-level promotion.

**Acceptance and negative tests:**

- Missing evidence/confidence blocks promotion; conflicting knowledge requires explicit supersession.
- Refusal retains source; duplicate command does not duplicate promoted record.
- Source agent cannot directly mutate destination memory.

**Exclusions:** Do not add second local memory store or rebuild shipped M135 transparency.

**Unknowns:** Confidence/decay policy and who accepts estate knowledge need explicit product decision.

### UXA-F07 — Real membership and role interaction delivery

Priority: strategic. Owners: M38, M39, S09, M149, M151, M152. Scenarios: SCN-013, SCN-014.

**Context:** Current application is service-role plus literal operator; S09 protects last owner but does not establish identity.

**Solution:** Authenticate at trusted ingress, use existing membership revision floor, implement invitation review and role queue with truthful v1 estate-wide visibility.

**Files:** `apps/desktop/src/shared/membership.ts`; `apps/desktop/src/main/index.ts`; `apps/desktop/src/renderer/src/BoardPanel.tsx`; `supabase/migrations/20260909000052_membership_authority.sql`; `docs/ux/flows.md`.

**Decomposition:**

1. Choose identity and delivery transport; safe return intent after authentication.
2. Bind intended invitation identity/revision/expiry and reject wrong identity/revocation.
3. Acceptance/decline idempotent, renewed review on scope change; do not broaden into per-project ACL silently.
4. Build role-aware interaction projection and response/effect authorization using current answer/continuation lifecycle.

**Prerequisites:** Real second user/test estate; Identity provider and session custody; S03 external effect port.

**Acceptance and negative tests:**

- Two identities cannot access each other estate; revoked/changed membership rechecked at commit and clears private context.
- Last-owner floor survives service-role SQL and concurrent revocation.
- Lost response retries same acceptance/resolution; no duplicate external effect.

**Exclusions:** No demo login claiming security; no per-project ACL by renderer filter; no replacement approval queue.

**Unknowns:** Provider choice/transport and v1 estate-wide wording are activation prerequisites.

### UXA-F08 — Constrained provider-view workspace host

Priority: strategic. Owners: M37, CO-091. Scenarios: SCN-018.

**Context:** Fixed current workspace does not prove extension isolation or layout publish.

**Solution:** Implement admitted structured fallback and bounded sandbox bridge before configurable role grid.

**Files:** `apps/desktop/src/renderer/src/Workspace.tsx`; `apps/desktop/src/shared/appRoute.ts`; `apps/desktop/src/preload/index.ts`; `docs/ux/scenarios.md`; `docs/ux/flows.md`.

**Decomposition:**

1. Specify allowed view/data/action protocol and deny ambient IPC.
2. Build nonoverlap/span/reading-order validated layout revision.
3. Preview narrow linearization, keyboard, unavailable/revoked/denied fallback.

**Prerequisites:** UXA-F05 admitted views; UXA-F07 role permissions; CO-091 bridge boundary.

**Acceptance and negative tests:**

- Malicious provider cannot invoke ambient main IPC or broaden scope.
- Invalid span/overlap/focus order refuses publish without losing layout.
- Revoked extension preserves canonical evidence; keyboard+screen-reader walk and 200% reflow.

**Exclusions:** No unconstrained spatial canvas, drag-only editing or replacement canonical data.

**Unknowns:** Figma disabled; visual/browser keyboard verification must be newly performed when surface exists.

### UXA-F09 — Close one bounded operating loop at a time

Priority: strategic. Owners: M27, CO-085, M39, M25, M129, M21, M128, CO-036, S03.effects, S08. Scenarios: SCN-019, SCN-020, SCN-021.

**Context:** Support, reliability and growth share evidence→checker→authorized effect→observed result; none exists end-to-end. They need distinct domain packets, not a universal speculative framework.

**Solution:** Plan three bounded child tasks: support single-channel intake/reply; production single-asset incident/recovery; content single-channel approved post/measurement. Use common authority/effect receipts.

**Files:** `docs/architecture/iterations.md`; `docs/ux/flows.md`; `apps/desktop/src/main/commands`; `apps/desktop/src/main/agentSurface.ts`; `supabase/migrations`.

**Decomposition:**

1. Support: normalize/dedupe inbound, customer ambiguity and minimal role context, draft/send/reconcile delivery.
2. Reliability: source receipt→target acceptance→reproduce/fix/check→release grant→monitor new observation; rollback new effect.
3. Growth: sourced topic→accepted facts→draft→independent editorial/SEO/channel checks→one-shot grant→publication receipt→collector feedback.
4. For each freeze named provider payload/effect idempotency and negative fixtures before live pilot.

**Prerequisites:** UXA-F02 named connectors; UXA-F03 proposals; UXA-F04 run result; UXA-F07 role work where needed; External credentials/budget/test resource.

**Acceptance and negative tests:**

- Support duplicate event/ambiguous identity/failed delivery remain one honest request.
- Reliability checker rejection never advances, policy outage refuses release, monitor timeout remains unresolved.
- Growth stale evidence/absent public identity/expired grant blocks publish; lost API response reconciled before retry.

**Exclusions:** Do not implement unspecified channels; no paid live actions or standing publication grant inferred from plan.

**Unknowns:** CO-085 support channel, CO-086 crash source and CO-036 standing grant remain explicit gates; split these 3 child packets before execution.

### UXA-F10 — Northbound MCP binding lifecycle

Priority: strategic. Owners: M15, M188, S03. Scenarios: SCN-022, SCN-023, SCN-024.

**Context:** Internal session surface is scoped, but external clients need estate-owned immutable expiring binding and owner lifecycle.

**Solution:** Extend transport using durable external binding/principal and typed control commands; preserve internal session credentials as distinct kind.

**Files:** `apps/desktop/src/main/agentSurface.ts`; `apps/desktop/src/main/sessionBundle.ts`; `apps/desktop/src/shared/servers.ts`; `apps/desktop/src/main/commands`; `docs/ux/flows.md`.

**Decomposition:**

1. Issue explicit project-set/scopes/effect ceiling/expiry with one-time reveal and safe fingerprint.
2. Filter discovery/resources before read; check binding scope/idempotency/policy at every command.
3. Return durable command/artifact/TaskRun identity; negotiate MCP tasks only when supported.
4. Rotate/revoke with audit lineage/cache invalidation and distinguish active-run cancellation.

**Prerequisites:** UXA-F07 owner identity; M188 durable run controls; S03 current authorization.

**Acceptance and negative tests:**

- Future project excluded; spoofed projectId denied before read/mutation; lost secret rotates, never recovered.
- Duplicate same key yields same receipt; changed args refuse.
- Revocation stops new read/control but history remains, effect reauthorizes, cancel only reports observed state.

**Exclusions:** Do not distribute owner session or downstream credential; do not turn southbound session token into permanent access.

**Unknowns:** External endpoint deployment/auth mechanism and negotiated protocol version require explicit contract review.

### UXA-F11 — Complete per-runner permission interception and approval interaction

Priority: strategic. Owners: M140, M155, S03, M152. Scenarios: SCN-027.

**Context:** fabric_effect_request intercepts only voluntary requests; current docs correctly retain unverified per-runner hook boundary.

**Solution:** Implement verified hook for each admitted runner or expose capability as unsupported; use canonical question/grant lifecycle and separate commit/delivery/ack/effect outcome.

**Files:** `apps/desktop/src/main/agentSurface.ts`; `apps/desktop/src/main/policy.ts`; `apps/desktop/src/main/sessionBundle.ts`; `apps/desktop/src/renderer/src/AttentionPanel.tsx`; `apps/desktop/src/renderer/src/BoardPanel.tsx`.

**Decomposition:**

1. Measure runner hook support and unsafe bypass paths with concrete tools.
2. Map intercepted requested operation→floor/action target without trusting agent-supplied authority.
3. Render requested operation/autonomy/evidence, one-shot grant or refusal reason, timeout/expired state.
4. Resume addressed run after separate admission/ack; handle indeterminate as explicit refusal diagnostics.

**Prerequisites:** Verified runner hook; M152 continuation; S03 effects lifecycle.

**Acceptance and negative tests:**

- Runner skips fabric_effect_request and directly invokes floored tool: intercepted/refused before effect.
- Timeout and duplicate answer cannot double-resume; floor unknown fails closed.
- Grant issuance never displays executed, delivered never displays acknowledged.

**Exclusions:** No claim that unsupported runner is safe based on prompt instruction; no second question store.

**Unknowns:** Only known supported runner can be admitted to effect-bearing scope until hook proven.

## Historical claims to remove or narrow, without deleting history

- Remove “no routines / no agent binding / no proposal decision / no run table / no question continuation” as blanket defects. Replace with exact residual scope above.
- Keep per-runner interception incomplete; a voluntary MCP request is not universal enforcement.
- Keep strategic support/growth/foundry/northbound/member work conditional on named consumers, real services and identity prerequisites.
- Do not mark disabled unavailable memory options as dead controls: repository records explicit operator choice to show roadmap availability.
- Product unobserved is correct; Figma disabled is intentional; no telemetry emitter is explicitly out of v1 scope.
- Keep historical dated audit snapshots and link newer dispositions. Do not count existing adapter scaffolding as new desktop work.

## Proposed execution order

1. Current integrity repairs C01/C02/C03, coordinated with M102/S14/M168 owners.
2. C04/C05 and C06 terminal/feed reconciliation with targeted renderer + real PTY checks.
3. Result/receipt surfaces F04 on existing TaskRun core; complete only missing prerequisites needed for that capability.
4. F01/F02/F03 in named provider/source slices; F07 only with verified identity/test user.
5. Foundry, external MCP, provider views and three closed loops remain distinct strategic packets gated by real consumer/service—not a mandatory blanket waterfall.

## Reviewed context and convergence

Read scenario/foundation/flow/screen chain, historical docs/ux/audits/2026-09-05-all.md, current queue progress report, iteration ladder and backlog existing owners. Inspected callers as well as implementation definitions (App→EstateHome→BoardPanel; attention list→source collector→renderer; proposal action→IPC→command; project→AgentsSection→PTY→SessionWindow/TerminalView; routine→startTask; task-page→memory promotion; MCP credential ingress). External adapter and contract read-only at recorded HEADs; no pin or package changed.

Pending parent convergence. C01/C02/C05 overlap home/agents scenarios; C03 relates M168 checker callers. No independent agent spawned.

Used skill: ux-audit — scenario, flow, caller and error-state evidence; no full runtime/browser accessibility proof.
