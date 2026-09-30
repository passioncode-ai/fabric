# Fabric mockup semantic completeness audit · 2026-09-07 · baseline 82bc950

Verdict: **REFINE**. All 53 views have a visible renderer, but every view has documented observable behavior missing. Route and heading counts do not establish full mockup completeness. This is a fixture UI audit; production statuses remain untouched.

## Shared root causes

### GX01 · P1

Generic partial adds a banner but authority buttons remain active. Conflict disables type=submit only; Save file, revoke, reserve, start-run, apply manager and other data-action commands remain active. Generic error replaces entire non-form view; refresh does not retain source-scoped known data.

Required: Introduce explicit fixture read-envelope and command availability by view/action; keep last successful data with named missing source and age. For conflict/stale/denied modes disable dependent commands until current read/revalidation, preserve drafts and show current winning receipt. Browser: conflict on manager/editor/access/authority → no mutation until current revision is confirmed.

Evidence: scripts/product/renderers.mjs:191, scripts/product/renderers.mjs:206, scripts/product/controller.js:142, scripts/product/controller.js:163

### GX02 · P1

Route identity includes task/question but not agent/session/fact/decision/file/grant/proposal/episode/tool. Draft storage is project|view, so unrelated objects share drafts. Global state leaks provider/manager/credential/revocation flags across entities/scopes. Missing URL params retain old state unexpectedly.

Required: Use typed entity refs and scoped per-entity draft/operation stores, explicit navigation return context and deliberate route defaults. Browser: alternate two tasks/questions/agents/files and two projects with separate pending drafts, check every child link and Back selection.

Evidence: scripts/product/controller.js:6, scripts/product/controller.js:88, scripts/product/controller.js:214, scripts/product/renderers.mjs:7

### GX03 · P2

Seven global demo states only prove heading/nonempty text. Domain states (verifying, regressed, opted-out, reconciling, stopped, missing, unsupported, invalid layout) have no controls/render branches; generic empty often removes the required form/contract and offers unrelated Open project.

Required: Add per-view state catalogue and scenario test selectors for all documented domain states, meaningful next action and semantic interaction assertions. Keep loading/error/empty distinctions tied to the particular source; do not satisfy coverage by repeating specification prose.

Evidence: scripts/product/report-template.html:19, scripts/test/product-report.browser.cjs:21, scripts/product/renderers.mjs:57, scripts/product/renderers.mjs:61

### GX04 · P2

Many Source details are explanatory prose, not inspectable exact artifact; child links often hardcode AT42 and lose source selection. Focus always resets to h2; disclosure/selection/focus state is not restored on Back.

Required: Use named fixture receipt records with identity, timestamp/revision, contents/hash when required and missing/denied outcomes. Preserve return ref/disclosure/selection/focus separately from mutation state. Browser: open nested source then Back twice with original node/form/scroll/focus.

Evidence: scripts/product/renderers.mjs:49, scripts/product/controller.js:104, scripts/product/controller.js:105

## Per-view acceptance matrix

### estate · SCR-30/SCR-01 · PARTIAL P1

Present: Project links, attention questions, events, CEO lifecycle link, zero-project entry.

- **G01:** No pin/unpin controls, partition/order, per-project obligation counts or count-source inspector. **Fix:** Add sibling project/open and pin buttons; maintain pinned insertion order without duplicate cards; derive counts from the same unresolved Board fixture and link each count to exact scope.
- **G02:** CEO floating launcher and pushed third column, shared project/estate manager conversation absent. **Fix:** Implement shell launcher/pane that narrows content; separate estate and project thread scopes, explicit no-model readiness and artifact-producing conversation fixture. Parent owns this fix.
- **G03:** Summary lacks exact health dimensions, source age/coverage, register counts and source receipts. **Fix:** Render configured manager separately from observed detector/readiness; linked measured counts and per-source failures, including unavailable host.

Browser acceptance:

- Pin Orbit then Atlas; each appears once in selected order.
- Open estate count, answer one question, return and compare Board/Inbox/project counts.
- Open CEO pane at 1280 and 375px; existing content remains reachable.

Sources: docs/ux/screens.md:81, docs/ux/screens.md:557; scripts/product/renderers.mjs:92, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### onboarding · SCR-27/SCR-02 · PARTIAL P1

Present: Name/purpose validation, input preservation, basic project creation, draft exit.

- **G04:** No starter choice/seed preview, portfolio observer target scope, staged configuration/activation or explicit PM gate. **Fix:** Add optional empty/software/observer branch with editable seeded objects, current/future-project scope confirmation, PM/resources/config review and blocked activation branch.
- **G05:** Repository radio does not control required selection; no primary repository, multiple drafts, create pending/unknown/reconciliation or stable draft identity. **Fix:** Use named fixture draft/project ids and draft tabs; repository choice updates readiness; show pending/refused/unknown/committed states using the same identity, plus cancel preserving or discarding only this draft.
- **G06:** After creation downstream setup routes are replaced with a summary and cannot finish first-run readiness. **Fix:** Carry the created project identity and inputs through its own providers/context/launch steps; allow completing the fictional readiness path without resetting to Atlas.

Browser acceptance:

- Create idea-only and repository projects; exercise cancel, duplicate submit, lost response and retry.
- Choose observer starter; inspect seed/resources/PM before activation.
- Create a project and reach an admitted first TaskRun under that project.

Sources: docs/ux/screens.md:98, docs/ux/screens.md:498; scripts/product/renderers.mjs:98, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### project · SCR-31/SCR-03 · PARTIAL P1

Present: Task list, run progress, plan preview, questions, team, events, empty next-task path.

- **G07:** Canonical task Kanban, legal moves, return-to-backlog/close/cancel-with-reason and refusal rollback absent. **Fix:** Add four columns with provenance and counts, accessible destination controls, cancellation reason form, pending/refused/success receipts, and immutable cancelled reason.
- **G08:** No catch-up digest first-visit/nothing-new/chronological states, viewed watermark, sourced figures or manager chat. **Fix:** Add chronological receipt-linked digest with explicit first visit and advance fixture view mark on leaving; isolate stale digest from other panels. CEO/thread owned by parent.
- **G09:** Repo attach/detach/primary/current branch/file count and agent permission modes/readiness are absent. **Fix:** Add repository strip and scoped file browser; attach/detach/primary controls, current/error status; agent picker with blocked modes and reset to per-runner default.
- **G06:** New project readiness cannot advance and other project/task examples stop at summary. **Fix:** Keep actual custom identity, task fixtures and setup controls; support at least two independent project/task drafts with no silent Atlas substitution.

Browser acceptance:

- Move task to allowed state and trigger refusal; verify rollback with reason.
- Cancel requires reason; closed task exposes reuse as a new draft, not restart.
- Switch projects mid-draft; first visit/return digest and primary repo remain correct.

Sources: docs/ux/screens.md:112, docs/ux/screens.md:586; scripts/product/renderers.mjs:101, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### task-new · SCR-32 · PARTIAL P1

Present: Captures title/result/check/owner/goal/context; saving does not launch.

- **G10:** No pending/unknown save, local inline validation on blank title, idempotent task identity, or return/reuse draft confirmation. **Fix:** Create per-project draft/task ids, inline missing title and criterion validation, saved receipt, pending/refused/unknown reconciliation branch; preserve input keyed by project and draft.
- **G06:** Every saved task is forever missing launch readiness, or launch becomes AT-42. **Fix:** Complete readiness controls and create distinct TaskRun preserving the saved task title/id/context.

Browser acceptance:

- Save two differently named tasks; each opens its own detail.
- Save while response pending, move to another task/project, reconcile old response.
- Reuse a past task over a nonempty draft requires an explicit choice.

Sources: docs/ux/screens.md:620; scripts/product/renderers.mjs:108, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### launch · SCR-32 · PARTIAL P1

Present: Missing readiness disables launch; unknown launch exposes same-request reconciliation.

- **G06:** missing is permanently true for created/saved task; no way to prepare context or choose usable runner; start-run clears custom task/project flags and renders Atlas AT-42. **Fix:** Make context selection, provider/permission mode, admitted profile and receipt addressable; launch and reconcile the same created task/run while retaining custom project identity.
- **G11:** Admission, spawn, delivery and ACK are collapsed into immediate success toast; no refused/spawn-failed/waiting-ACK/unknown delivery/remaining blockers views. **Fix:** Model discrete preadmission refusal, admitted, spawn failure, listening/paste, dispatch unknown, ACK and result verification states; show exact operation ids and repair action for each.

Browser acceptance:

- Create custom task → prepare context → choose runner → admit → spawn → ACK; task stays custom.
- Try denied mode and spawn failure; verify no fabricated running state.
- Double launch and reconcile unknown preserve one run identity.

Sources: docs/ux/screens.md:620; scripts/product/renderers.mjs:124, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### task · SCR-32 · PARTIAL P1

Present: AT-42 current/prior runs, criteria, questions, past pack, stop-requested and verified fixture.

- **G12:** No authored brief editing/original comparison, append-only notes, promotion to memory, per-note authorship/time, resource receipts or task lifecycle controls. **Fix:** Add editable brief sections with original retained; append-only note composer; promote creates one linked fact then changes note control; close/backlog/cancel with mandatory reason and receipt.
- **G13:** AT-38/AT-47/AT-50 deep links stop at a summary explicitly saying actions not modeled. **Fix:** Render task-specific brief/notes/runs/related links for all fixtures; empty/unworked detail uses own origin; retain independent notes per task.
- **G14:** Question answer and note drafts are keyed only project+view, not entity; resolving Q-12 does not remove it from task/Board. **Fix:** Key drafts and state by exact task/question id and revision; derive unresolved blockers from committed decisions; link actual decisions and remaining blocker state.

Browser acceptance:

- Edit AT-42 brief; original remains beside override.
- Add note and promote twice; exactly one fact and stable link.
- Open AT-47, add another note, return; AT-42 draft unaffected.
- Close/cancel/backlog produce their own receipt.

Sources: docs/ux/screens.md:620; scripts/product/renderers.mjs:111, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### run · SCR-09 · PARTIAL P2

Present: Distinct plan-v1/v2, step statuses, claim/observation/checker separation and failure/verification example.

- **G15:** No direct exact past-pack/session links, config/binding revisions, per-attempt feed cursor or initial-vs-refresh failure distinctions. **Fix:** Add pinned run context header, exact CP/session/source links, attempt timeline and retained reconnect cursor/age.
- **G11:** Spawn failure, preadmission refusal, stopped confirmation, retry exhaustion and partial-artifact recovery absent. **Fix:** Provide fixture transitions for failure/cancel/recovery with each partial artifact preserved and no task-done inference from process exit.

Browser acceptance:

- Compare run-01/02 exact pack and pinned revisions.
- Simulate heartbeat unknown, reconnect, stop requested then confirmed, spawn failure and exhausted retry.

Sources: docs/ux/screens.md:211; scripts/product/renderers.mjs:129, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### board · SCR-41 · PARTIAL P1

Present: Scope and kind filters, task/question links, no dismiss action.

- **G16:** Board union only questions plus tasks; no review/refusal/lease/proposal obligations, rank values/age/source count, selected inspector, canonical unresolved update or resolved history. **Fix:** Build typed unresolved fixture union with age/owner/rank and scoped counts; selected item opens exact resolver, and underlying resolution updates all previews atomically.
- **G14:** Q-12 remains in unresolved list after committed answer; task/Q13 remain unchanged and resolved deep links lack immutable decision. **Fix:** Derive rows from actual fixture question status; Q12 leaves Needs-you, Q13 remains; historical Q12 opens its decision/delivery receipt.
- **G17:** Generic empty state says history appears later and generic conflict lacks current winning receipt. **Fix:** Use no-unresolved vs no-match distinctions; conflict inspector shows competing receipt and copyable unsent answer.

Browser acceptance:

- Answer Q12; compare Board, Inbox, home/project previews and remaining Q13.
- Filter typed refusal/review/proposal; exact resolver and rank/age visible.
- Open resolved Q12 URL; see receipt, not fresh form.

Sources: docs/ux/screens.md:804; scripts/product/renderers.mjs:132, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### question · SCR-41 · PARTIAL P1

Present: Q-12 allow/deny, committed decision and delivery-pending/ACK distinctions.

- **G18:** Only approval Q-12 can be answered; clarification Q-13 is explicitly read-only; answer reason is discarded. **Fix:** Provide typed response widgets for clarification/approval and entity-keyed reason/payload; bind displayed decision to the selected question.
- **G19:** No submitting/unknown answer, concurrent conflict receipt/copy, delivery retry/needs restart states or visible exact effect link. **Fix:** Add revision and operation identity, pending disabling duplicate submit, unknown commit reconciliation, winning receipt/copy control on conflict; delivery lifecycle with retry independent of answer.
- **G14:** Committed decision not reflected in unresolved collections; all decision links open D08 graph. **Fix:** Update shared question fixture and resolve D09 precisely; preserve remaining blockers and exact return target.

Browser acceptance:

- Answer Q13 with text and Q12 with denial reason; each decision preserves its payload.
- Trigger concurrent answer and timeout, copy unsent draft, reconcile once.
- Delivery retry creates no new answer/grant.

Sources: docs/ux/screens.md:804; scripts/product/renderers.mjs:135, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### authority · SCR-24 · PARTIAL P1

Present: Effect scope and one-shot bound shown; reservation and unknown execution separate; denial blocks grant.

- **G20:** Reservation available before any affirmative answer; expired/spent/floor-denied/indeterminate/revoked/reconcile receipt states absent. **Fix:** Address grant and effect identity explicitly; require committed authorized basis, render active/reserved/spent/expired/revoked and policy refusal; unknown holds reservation until receipt check.
- **G21:** Same Atlas staging effect stands in for content publishing/release; exact subject not encoded or selected. **Fix:** Create fixture grants/effects per use case and link from source module using exact scope/resource/effect id, with result/refusal history.

Browser acceptance:

- Open authority without approval then after allow/deny; availability follows basis.
- Inspect expired and spent grants; unknown dispatch cannot reserve again.
- Open content vs release grant; targets differ.

Sources: docs/ux/screens.md:449; scripts/product/renderers.mjs:259, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### inbox · SCR-42 · PARTIAL P2

Present: Needs-you/Happened lanes, mark-events-read, question links.

- **G22:** Needs-you adds Studio summary not present in Board; read state is one global boolean, no event source identity/filter/read watermark or live/reconnect states. **Fix:** Use exact Board union; event rows carry actor/project/id/source; implement per-operator read watermark and unread styling, scoped lane filters and source-specific missing coverage.
- **G14:** Resolved Q12 still appears and event decision links cannot select exact receipt. **Fix:** Reuse shared resolved state and typed references; preserve source unavailable event with safe inspector and Back.

Browser acceptance:

- Mark Happened read; Q12 unresolved remains until answered.
- Answer Q12; it leaves all Needs-you lists.
- Change operator; read watermark independent; replay event preserves watermark.

Sources: docs/ux/screens.md:826; scripts/product/renderers.mjs:141, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### agents · SCR-04 · PARTIAL P1

Present: Project role list and provider catalog link.

- **G23:** No exact binding/provider revision/profile/placement/readiness matrix or non-manager replacement/binding flow. **Fix:** Add selected binding detail, installed/certified/observed rows, role/capability-aware provider selection and future-runs-only binding preview.
- **G24:** Reviewer and other non-PM roles navigate to fixed Builder; agent identity absent from links and controller route keys. **Fix:** Propagate agent/binding/session ids through every link, selection and detail; render exact selected fixture or permitted missing-state.

Browser acceptance:

- Choose Reviewer then Builder; names, runs, session and capabilities differ.
- Bind certified candidate to role; review future runs vs existing pinned run.

Sources: docs/ux/screens.md:133; scripts/product/renderers.mjs:144, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### estate-agents · SCR-39 · PARTIAL P1

Present: Estate agent list and project context.

- **G24:** No identity-preserving selection; all non-PM rows open Builder and Orbit uses summary-only fallback. **Fix:** Implement cross-project selected agent list/detail without navigating through project first; exact agent and session ids.
- **G25:** Missing waiting-first order, decoded transcript snapshot+age, unified claims/observations chronology, branch/changed-files/permission-mode, ended exit code and detached/repo errors. **Fix:** Add source-labelled session inspector with snapshot reading, chronological events, repo status and local failures; retain selected agent during refresh.

Browser acceptance:

- Select agents across projects in one click; exact own transcript and history.
- Simulate ended, detached, repo unreadable; other details usable.

Sources: docs/ux/screens.md:756; scripts/product/renderers.mjs:145, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### agent-detail · SCR-39 · PARTIAL P2

Present: Builder detail links run/context/session/access.

- **G24:** Fixed Builder regardless selected agent, binding or session. **Fix:** Read addressed agent/binding/session fixture and pass exact references to child views.
- **G25:** Missing decoded console snapshot and source-labelled unified chronology, repo branch/count/mode, exit code and independent error branches. **Fix:** Show selected session snapshot with recorded-at label, claims and observations in one timeline, repository/permission details and per-source state.

Browser acceptance:

- Open Reviewer from team; detail must be Reviewer.
- Compare decoded snapshot with live-transport fixture; snapshot age remains explicit.

Sources: docs/ux/screens.md:756; scripts/product/renderers.mjs:148, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### agent-history · SCR-40 · PARTIAL P2

Present: Separate semantic graph routes and matching visible list exist.

- **G26:** Graph interactions lack selection/inspector, filters/asOf/revision and detailed partial/unlinked/source-missing behavior. **Fix:** Graph specialist owns semantic selection, exact references, graph/list/outline parity and coverage fixture branches.
- **G27:** Plan membership/goal creation and task dependencies cannot be edited or inspected as exact revisions; no orphan tasks list. **Fix:** Add declared goal/task membership and dependency controls with legal-cycle refusal and immutable old plan revision; show work without goal.

Browser acceptance:

- Select each typed node and return with prior view/revision intact.
- Show partial/unlinked/live pending revision and exact/at-least/unknown coverage.

Sources: docs/ux/screens.md:783; scripts/product/renderers.mjs:151, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### project-history · SCR-40 · PARTIAL P2

Present: Separate semantic graph routes and matching visible list exist.

- **G26:** Graph interactions lack selection/inspector, filters/asOf/revision and detailed partial/unlinked/source-missing behavior. **Fix:** Graph specialist owns semantic selection, exact references, graph/list/outline parity and coverage fixture branches.
- **G27:** Plan membership/goal creation and task dependencies cannot be edited or inspected as exact revisions; no orphan tasks list. **Fix:** Add declared goal/task membership and dependency controls with legal-cycle refusal and immutable old plan revision; show work without goal.

Browser acceptance:

- Select each typed node and return with prior view/revision intact.
- Show partial/unlinked/live pending revision and exact/at-least/unknown coverage.

Sources: docs/ux/screens.md:783; scripts/product/renderers.mjs:151, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### project-plan · SCR-40 · PARTIAL P2

Present: Separate semantic graph routes and matching visible list exist.

- **G26:** Graph interactions lack selection/inspector, filters/asOf/revision and detailed partial/unlinked/source-missing behavior. **Fix:** Graph specialist owns semantic selection, exact references, graph/list/outline parity and coverage fixture branches.
- **G27:** Plan membership/goal creation and task dependencies cannot be edited or inspected as exact revisions; no orphan tasks list. **Fix:** Add declared goal/task membership and dependency controls with legal-cycle refusal and immutable old plan revision; show work without goal.

Browser acceptance:

- Select each typed node and return with prior view/revision intact.
- Show partial/unlinked/live pending revision and exact/at-least/unknown coverage.

Sources: docs/ux/screens.md:783; scripts/product/renderers.mjs:151, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### decisions · SCR-33 · PARTIAL P1

Present: Separate decisions graph/list and F21/E14 story.

- **G28:** No decision list/detail identity, predecessors/current/superseded selection, source pack vs rationale, named actors/time or override form/preview/commit/conflict. **Fix:** Create decision inspector with original text, actor+time, supplied exact pack/citations, predecessor chain, affected task links and authored superseding decision preview+receipt; graph specialist can share inspector.
- **G29:** D09 created by Q12 is never shown; D08 remains fixed regardless selected receipt. **Fix:** Address decisions by id, register committed Q12 answer as D09 with payload and delivery; never substitute D08.

Browser acceptance:

- Open D09 from answer; confirm Q12 reason and payload.
- Override D08 with reason; original remains in lineage and effects are not implicitly undone.

Sources: docs/ux/screens.md:643; scripts/product/renderers.mjs:151, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### memory · SCR-34 · PARTIAL P2

Present: Fact list and past/next context navigation, storage link.

- **G30:** Missing six sourced counts, authorship, separate stores, retrieval misses/rate/never-asked, session capture/pack inventory and per-store failure. **Fix:** Render store cards with count source/coverage, authored fact rows, retrieval attempts/misses with denominator, unanswered panel and available captures/packs.
- **G31:** Every memory item opens F21; no fact filter, exact provenance target or edit/supersede/promotion controls. **Fix:** Carry fact id and render own lineage; connect task promotion to new fact; expose explicit correction/supersession preserving original.

Browser acceptance:

- Open each fact; exact own actor/source/lineage.
- Set one store unavailable and never-asked rate; others remain usable.
- Promote task note and see one linked new fact.

Sources: docs/ux/screens.md:661; scripts/product/renderers.mjs:158, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### context-pack · SCR-34 · PARTIAL P1

Present: Past CP01 and CP02 separated from next preview, included/excluded refs and source disclosure.

- **G32:** No actual immutable content, hash/compiler/version/units/budget/omission/ref table, missing historical pack branch or editable next-context readiness. **Fix:** Render exact fixture artifact bytes/digest/version and referenced sources; next preview supports selected task and compiler/budget, dry recompute/omission branches; missing old artifact never falls back.
- **G06:** Next preview cannot prepare created task context or satisfy readiness. **Fix:** Provide explicit fixture context selection/finalize preview step that sets readiness for that task only, without claiming dry preview is itself a persisted command.

Browser acceptance:

- Change next-task brief/compiler; CP01 hash/content remains unchanged.
- Open unavailable past pack and inspect missing reason.
- Prepare custom task context, return to launch with same identity.

Sources: docs/ux/screens.md:661; scripts/product/renderers.mjs:161, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### memory-lineage · SCR-34 · PARTIAL P2

Present: F21 correction chain and past-pack link.

- **G31:** All fact URLs collapse to F21; no F19 actual original detail, actor/time/hash/source metadata or missing/restricted source branch. **Fix:** Add exact fact id selection with current/superseded predecessor link, authored source receipt and immutable historical usage list.
- **G33:** No explicit fact correction or accepted cross-project artifact promotion. **Fix:** Add provenance-preserving correction and accepted-artifact review fixture with evidence/confidence gates and supersession conflict.

Browser acceptance:

- Open F19 and F21 separately; each retains own source and status.
- Follow accepted artifact into promoted fact and back; contradiction uses new version.

Sources: docs/ux/screens.md:661; scripts/product/renderers.mjs:168, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### retro · SCR-45 · PARTIAL P1

Present: R08 verifying lifecycle illustration and category control.

- **G34:** Category selector does not filter; process option absent; one episode fixed; review button toast does not run lifecycle. **Fix:** Add category-specific episodes including process; filtering returns matching list/no-match; select exact episode, source identities and dedup counts.
- **G35:** No proposed/observing/verified/regressed/dismissed transitions, corrective task/owner/checker/window, durable suppression or verification receipts. **Fix:** Implement episode inspector with independent verification criteria/window/evidence and explicit actions to propose, assign, verify, regress/dismiss; repeated source id cannot increase threshold.

Browser acceptance:

- Select Agents → R08 Harness disappears or explicit no matches.
- Verify episode with missing source refused; add evidence, verify, regress, dismiss and replay duplicate.

Sources: docs/ux/screens.md:890; scripts/product/renderers.mjs:171, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### feedback · SCR-46 · PARTIAL P2

Present: Local collection toggle and proposed outbound policy/allowlist excerpt.

- **G36:** No candidate selection, exact bytes plus metadata/retention, outbound eligible/pending/opted-out/inflight-unknown/server-receipt or re-enable suppression states. **Fix:** Provide separately gated outbound fixture section and candidate preview, policy revision, stable delivery id, pending suppression, unknown reconciliation and receipt history; local setting remains independent.
- **G37:** Local switch does not expose queued/previous collection effects or scoped setting receipt. **Fix:** Show setting persisted within fixture scope and what next collection skips; retain prior local history without pretending it was sent or erased.

Browser acceptance:

- Inspect exact candidate payload; opt out pending → suppressed.
- Opt out after unknown dispatch keeps unknown; re-enable does not send suppressed backlog.

Sources: docs/ux/screens.md:915; scripts/product/renderers.mjs:174, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### sync · SCR-47 · PARTIAL P1

Present: Storage layer table, Git mirror caveat, conflict link.

- **G38:** No export/import controls, manifest included/excluded coverage, source/export cursors, reviewed diff/digest/rebindings/empty target or operation receipt. **Fix:** Add export manifest inspector and declared import wizard: select fixture bundle, validate coverage/relations, preview stable ids/path rebindings/digest/target, confirm, pending/unknown/conflict/atomic-success or failure with unchanged old generation.
- **G39:** Configuration conflict opens unrelated return.ts editor, not purpose.md diff. **Fix:** Open exact configuration artifact with local/incoming comparison and explicit choice/revalidation in import context.

Browser acceptance:

- Preview bundle with missing relation then valid bundle; target/digest visible.
- Simulate concurrent import/unknown response; preserve same operation and no partial state.
- Compare purpose.md versions; editor file identity exact.

Sources: docs/ux/screens.md:941; scripts/product/renderers.mjs:182, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### restore · SCR-48 · PARTIAL P1

Present: Layer verification table and honest read-only/quarantine stance.

- **G40:** No backup input selection, coherent manifest proof/checksums, empty-target verification, operation phases, current-authority generation or inspectable per-capability activation. **Fix:** Implement read-only recovery wizard and operation inspector with original unchanged, coherent checks, isolated target, reconciliation of old sends/optout/revocations, active-vs-held capability table and receipts.
- **G41:** Restore check only a toast; never exposes authority-unavailable, reconciling, failed/stale or permitted success path. **Fix:** Add controllable fixture state branches for checksum failure, authority unavailable, unknown prior effects and successful limited reactivation; outbound stays separately quarantined.

Browser acceptance:

- Backup A → sent effect/optout/revoked manager → restore A; none revived.
- Try invalid checksum/nonempty target, keep original untouched.
- Revalidate current authority; inspect exactly active and held capabilities.

Sources: docs/ux/screens.md:966; scripts/product/renderers.mjs:185, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### providers · SCR-05 · PARTIAL P1

Present: Four provider choices and independent conformance links.

- **G42:** Catalog lacks capability/role filter, exact revision, provenance/trust/cost/ceiling and discovered/conformant/admitted/bound comparison. **Fix:** Add provider revision cards with named requirements, required capability filter, sourced or unknown cost and independent gates; preserve originating role/task throughout selection.
- **G23:** Compatible provider cannot complete general project role binding; admission returns only manager. **Fix:** Add role-binding review with allowed scope/modes/budget, current/future-run impact, committed revision and canary outcome.

Browser acceptance:

- Open catalog from Builder requirement; incompatible providers explained.
- Admit Codex revision then bind Reviewer, without switching PM.

Sources: docs/ux/screens.md:148; scripts/product/renderers.mjs:229, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### manager · SCR-44 · PARTIAL P1

Present: Candidate select→validation→staged binding; pause; scope differentiation text.

- **G43:** No budget/cost, host installed/configured/observed/certified readiness matrix, activation/wake control, resume after pause, stop-admission/drain/checkpoint or acknowledged handoff outcome. **Fix:** Add independent readiness fields and budget, full stop/drain/fence/staged/admit/deliver/ACK state machine with residual-process/unknown branch and explicit resume.
- **G44:** CEO/project state share one global managerSwitched/Paused; estate card manager link has no estate scope. **Fix:** Key manager assignment and lifecycle by role scope; all CEO links carry estate scope and PM links project scope; preserve independent previous binding evidence.

Browser acceptance:

- Pause project PM then open estate CEO; CEO unchanged.
- Replace manager through drain/fence/context/delivery ACK; active assignment distinct from staged.
- Resume paused manager only with current readiness.

Sources: docs/ux/screens.md:866; scripts/product/renderers.mjs:231, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### profile · SCR-36 · PARTIAL P2

Present: Counts of projects/agents link to those registries and manager configuration is separate.

- **G45:** Missing sourced tasks closed/facts/decisions/grants/events, measured history duration/first-event/empty distinction and visible empty portrait. **Fix:** Compute fixture counts from named datasets, open exact scoped registry, show days since first event or no history, unavailable per failed register, and unconfigured portrait requirement.

Browser acceptance:

- Click each figure; target contains counted rows under same estate.
- Fresh empty estate says no recorded history; first event today says started today.

Sources: docs/ux/screens.md:703; scripts/product/renderers.mjs:244, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### admission · SCR-16 · PARTIAL P2

Present: Named capability checks; unverified capability disabled; provider changes reset admitted flag.

- **G46:** Test pass and owner admission collapsed into one successful fixture; exact revision/gate receipts, independent conformance failure, owner review/canary/binding separate step absent. **Fix:** Model independent gate report with exact artifact hashes/revision, failure repair link, successful conformance then explicit owner admission and separate role binding/canary; no project context before admission.

Browser acceptance:

- Local passing report but independent failure blocks owner admission.
- Pass gates → review owner admission → bind role; new provider revision resets checks.

Sources: docs/ux/screens.md:318; scripts/product/renderers.mjs:246, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### bootstrap · SCR-15 · PARTIAL P2

Present: Repository and transport form, generated generic recipe, admission link.

- **G47:** Form inputs ignored; no Adapt/Create consumer/capability, pinned contract/adapter/skill hashes, file-change plan, dry-run, exact expiry/reissue/report upload or integrity failure. **Fix:** Generate distinct fixture recipe from selected inputs; include pins and planned paths, review/dry-run, checksum failures, report artifacts, cleanup leftovers and safe reissue for same target.

Browser acceptance:

- Change transport/repo → recipe changes and names target/version/hash/paths.
- Trigger checksum failure then regenerate; no partial recipe emitted.

Sources: docs/ux/screens.md:303; scripts/product/renderers.mjs:250, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### connections · SCR-06 · PARTIAL P2

Present: Example account/resource and external grant link.

- **G48:** Account auth, collector state and resource/agent allowlists are not separate; no reuse choice, last activity/reconnect/reselect gates. **Fix:** Render account identity, OAuth validity, collector health/age and versioned project resource+agent bindings independently; actions repair affected dimension only.

Browser acceptance:

- Collector timeout keeps valid OAuth account; reconnect only repairs auth failure.
- Reuse one estate identity with different project allowlists.

Sources: docs/ux/screens.md:164; scripts/product/renderers.mjs:255, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### connect-account · SCR-07 · PARTIAL P1

Present: OAuth cancel/return and resource checkbox display, saved notice.

- **G49:** Checkboxes unnamed/unread; save always binds atlas-app even after deselection; no agent allowlist, effect ceiling or wrong-identity gate. **Fix:** Use named resource/agent selection and state; review exact identity+environment+permissions; reject empty resources/agents or mismatched subject; preserve old binding and draft.
- **G50:** No expired callback/unknown outcome/multiple account return or actual receipt/collector result. **Fix:** Add fixture callback states with same selected project/draft, current returned subject verification, commit revision and distinct collector readiness.

Browser acceptance:

- Uncheck atlas-app, check orbit-api; review/save shows exact selected resource.
- Remove all resources → inline blocked save.
- Wrong subject and cancelled callback leave old binding untouched.

Sources: docs/ux/screens.md:180; scripts/product/renderers.mjs:257, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### access · SCR-21 · PARTIAL P2

Present: Active/revoked example list without raw secrets.

- **G51:** Create opens existing External coordinator; revoked Review agent not inspectable; no fingerprint/last use/active runs/filters. **Fix:** Separate new access draft from exact existing binding inspector; show fingerprint/principal, scopes, expiry, last use and active run refs for active and revoked rows.

Browser acceptance:

- Create blank binding; open revoked row and audit historical receipt/runs.

Sources: docs/ux/screens.md:396; scripts/product/renderers.mjs:262, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### access-detail · SCR-22 · PARTIAL P1

Present: Allowlist/expiry-looking form; revoke state distinguishes inflight work.

- **G52:** All inputs ignored by Save; scope/expiry validation, exact effect ceiling, synthetic one-time credential/config and discovery test absent. **Fix:** Persist selected named fixture scope/operations/expiry; validate future expiry/nonempty scope; use obviously non-secret demo credential shown once with exit confirmation, rotate and discovery-layer results.
- **G53:** Revoke does not update list or freeze old form; failed revocation and active-run explicit cancel boundaries not modeled. **Fix:** Share exact binding lifecycle state across list/detail; retain historical receipt, distinguish failed revoke and running task with separate cancellation action.

Browser acceptance:

- Change scope/expiry → receipt matches selected values.
- Reveal demo token once, leave confirmation then no recovery except rotate.
- Revoke → new calls denied while already running task remains until explicit stop.

Sources: docs/ux/screens.md:412; scripts/product/renderers.mjs:264, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### cycles · SCR-43 · PARTIAL P2

Present: Cycle selection, trigger/result explanation, pause/resume toggle.

- **G54:** No cadence/timezone/placement/enabled/readiness/source age, tick history, manual wake receipts, planned/skipped/not-due/inflight/unknown/exception states. **Fix:** Use selected cycle fixtures with exact window id, configured cadence vs observed tick/outcome, host coverage, due policy and action panel for coalesced/admitted/refused wake/recovery.
- **G55:** Pause changes global flag/button only; next-due rows remain hardcoded and all cycles share state. **Fix:** Key enabled/pending/inflight by cycle/scope; pause future schedule while inflight remains visible and unaffected, resume rechecks readiness.

Browser acceptance:

- Pause retro; observe schedule and other cycles unchanged.
- Wake twice same window → one invocation and coalesced receipt.
- App-off/unknown cannot become fabricated stalled.

Sources: docs/ux/screens.md:845; scripts/product/renderers.mjs:266, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### schedule · SCR-08 · PARTIAL P2

Present: Next times and two exact run links.

- **G56:** No routine configuration/agent binding revision/timezone/filtering/type identity, no-routines vs no-history distinctions or independent source failures. **Fix:** Add routines and history filters, typed runs with exact ids and coverage, selected routine cadence/timezone/binding detail, scheduled vs observed due states; use shared cycle data.

Browser acceptance:

- Filter routine with no history vs no configured routine.
- Switch provider; active run pinned, next routine uses new binding.

Sources: docs/ux/screens.md:195; scripts/product/renderers.mjs:268, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### reports · SCR-10 · PARTIAL P2

Present: E14 and E18 sourced example panels and related links.

- **G57:** No source/target-project routing, observer/severity/freshness, result selection/filter, proposal submission or unresolved routing failure. **Fix:** Add finding list and exact inspector with source/target evidence, routing proposal draft, missing target/PM/stale source branches and resolution receipt; never mutate target directly.

Browser acceptance:

- Select observer finding; route proposal to target PM.
- Retired target or stale receipt keeps unresolved with repair link.

Sources: docs/ux/screens.md:226; scripts/product/renderers.mjs:270, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### proposal · SCR-11 · PARTIAL P1

Present: AT42 acceptance missing-vs-verified criterion table; publication separate.

- **G58:** Canonical cross-project target PM accept/refuse/supersede preview and once-only resolution is replaced by AT42 task acceptance. **Fix:** Keep task acceptance intent and add distinct proposal detail: source/target authority, fresh evidence, dedup id/revision, planned task/config changes, reason and accept/refuse/supersede actions with existing receipt/conflict.
- **G59:** Verified acceptance uses shortcut that marks AT42 and AT47 done; no independent checker result interaction or resolved proposal receipt. **Fix:** Provide explicit fixture verification input/receipt before acceptance and preserve independent AT47 task state; accepted proposal links resulting work and source resolution.

Browser acceptance:

- Resolve proposal once then reopen; second action shows receipt/conflict.
- Refuse/supersede with reason; source project receives resolution link.

Sources: docs/ux/screens.md:242; scripts/product/renderers.mjs:272, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### project-settings · SCR-12 · PARTIAL P1

Present: Name/purpose/mode/repo form and related settings links.

- **G60:** Save is toast only, fields not propagated, no current/new revision diff, future-run impact, repo set/primary or membership/access local distinction. **Fix:** Persist fixture settings per project; preview expected revision diff and future-run impact then commit; live runs retain old revision. Add repo attach/detach/primary with file-state preview.
- **G61:** Empty name accepted; stale conflict just generic banner with reread losing meaningful comparison. **Fix:** Inline field/gate validation and two-version conflict rebase preserve unsaved patch, show current revision and explicitly reapply.

Browser acceptance:

- Rename Atlas, save; tab/header and revision update.
- Clear name blocks save; change primary repo shows future-run scope diff.
- Concurrent revision keeps local patch and active old run pinned.

Sources: docs/ux/screens.md:257; scripts/product/renderers.mjs:276, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### role-workspace · SCR-13 · PARTIAL P1

Present: Reviewer queue and evidence/tool links.

- **G62:** AT47 Start review opens AT42 via link default; owner-only layout control shown for Reviewer; no typed interaction detail/SLA/requester/fallback. **Fix:** Open exact AT47/interaction, show requester/SLA/evidence and editable response, resolution effect preview, authorized layout action, per-tile error/fallback/revocation.

Browser acceptance:

- Start AT47 review opens AT47; response produces its receipt.
- Revoke role or fail one provider tile; protected tile cleared, queue/fallback appropriate.

Sources: docs/ux/screens.md:271; scripts/product/renderers.mjs:278, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### membership · SCR-14 · PARTIAL P1

Present: Team roles and invite form; prepare notice.

- **G63:** Email/role ignored, empty email allowed, expiry/intended identity/permission preview absent; every resulting invite hardcoded Reviewer. **Fix:** Named invitation state stores required email, role, expiry and scope; review before prepare and show exact invite id/receipt; edit/revoke membership uses distinct revision/authority.
- **G64:** Typed role interaction half of shared SCR14 has no view, response draft or effect preview. **Fix:** Add interaction intent/detail separate from invitation with payload/evidence/SLA, requester, answer draft and existing-resolution/conflict/grant branches.

Browser acceptance:

- Prepare Viewer invitation for named email; acceptance shows Viewer scope/expiry/identity.
- Empty email blocks; revoked membership updates protected surfaces.

Sources: docs/ux/screens.md:287; scripts/product/renderers.mjs:280, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### invite · SCR-14 · PARTIAL P1

Present: Accepted and revoked example outcomes, role-workspace link.

- **G65:** No actual sign-in step/return intent, account selection/mismatch, expiry/current revision preview or existing acceptance receipt. **Fix:** Model sign-out→sign-in/cancel→same invite id return, intended/current identity comparison, expiry/revocation recheck, confirm scope and idempotent acceptance receipt.
- **G66:** Accept remains clickable after revoked example and can immediately change to accepted; invitation unrelated to prepared email/role. **Fix:** Persist invite lifecycle by id, disable acceptance for expired/revoked/wrong identity, require new invite to recover and reuse prepared fields.

Browser acceptance:

- Prepare Viewer invite; sign in as intended identity then confirm correct role.
- Revoke between open and Accept; must stay revoked.
- Repeat Accept returns same receipt/member.

Sources: docs/ux/screens.md:287; scripts/product/renderers.mjs:282, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### workspace-editor · SCR-17 · PARTIAL P1

Present: Two initial tiles, add one generic tile, save notice.

- **G67:** Both Add buttons do identical action; only one boolean tile, no remove/reorder/spans/grid, no responsive/keyboard preview, validation or published revision. **Fix:** Maintain tile array with ids/types/spans; add distinct view, remove, move controls; show narrow/keyboard order and scope/fallback validation, revision diff then publish/rollback.
- **G68:** Text explicitly claims removal/order buttons exist but none rendered; save only toast. **Fix:** Render actual controls and inspectable saved layout; preview uses saved role layout; errors identify exact invalid tile and safe placement.

Browser acceptance:

- Add Evidence and queue separately, remove and reorder by keyboard.
- Overlapping/overbroad/no-fallback tile blocks publish with named cause.
- Publish → role workspace uses exact layout; concurrent revision retains draft.

Sources: docs/ux/screens.md:333; scripts/product/renderers.mjs:284, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### workspace · SCR-26 · PARTIAL P1

Present: File list, example code and session widget.

- **G69:** Every file opens same return.ts; canonical activity/results/source-linked widget layout replaced by file/editor pane; no per-widget empty/error. **Fix:** Address file ids/path/root and render actual chosen buffer; add activity/agents/results widgets with stable spans/order and per-source errors/receipt links.

Browser acceptance:

- Open README then test file; path and content differ.
- Fail one widget; other widgets remain; 375px retains canonical order.

Sources: docs/ux/screens.md:482; scripts/product/renderers.mjs:286, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### editor · SCR-28 · PARTIAL P1

Present: Editable buffer, dirty/saved marker and conflict notice preserve text.

- **G70:** Conflict has no disk-version comparison or choice; resolve just dismisses notice; save synchronous, no late-ACK/dirty-generation, close/discard dialog or file-specific identity. **Fix:** Use addressed scoped file fixture and buffer/disk generations; conflict renders two versions and explicit keep/disk/merge choice, pending save can settle after newer typing, close asks save/discard/cancel.
- **G71:** Empty buffer resets to default via s.fileBuffer || default; save-error removes editor into generic error. **Fix:** Treat empty string as valid buffer; distinguish read error from write error retaining editable draft and status.

Browser acceptance:

- Clear file, save; stays empty.
- Save A pending, type B, settle A; B unchanged and dirty.
- External disk edit shows both versions; explicit choice then save.
- Close dirty→Cancel retains buffer.

Sources: docs/ux/screens.md:516; scripts/product/renderers.mjs:290, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### session · SCR-25/SCR-23 · PARTIAL P2

Present: Clearly illustrated transcript; stop requested and process-exited distinctions.

- **G72:** No addressed session identity/cwd/program/mode/exit code; no fixture terminal input, spawning/missing/reattach/save scrollback or close-vs-end behavior. **Fix:** Provide safe local-only terminal simulation with exact session id/cwd/runner/mode, input/resize/reopen/scrollback, ended exit code, missing/spawn failure and explicit End distinct from Close.
- **G24:** All agent session links resolve Builder/run02. **Fix:** Propagate session/task/run/project identity from selected source and retain permitted missing state, never substitute another session.

Browser acceptance:

- Open Reviewer session; exact own transcript and task.
- Type safe fixture command, close/reopen preserves buffer without new session; End gives exit code.
- Spawn failure and missing session differ from empty transcript.

Sources: docs/ux/screens.md:429, docs/ux/screens.md:466; scripts/product/renderers.mjs:292, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### harness · SCR-35 · PARTIAL P2

Present: Context/tools/authority/observation concept links.

- **G73:** No actual installed runner/blocked modes, MCP endpoint and provider qualification, full tool inventory/recording capability, grant counts active/reserved/spent/expired. **Fix:** Render fixture operational inventory with installed readiness, named blocked modes, surface-up/down and runner integration, per-tool trace coverage and exact grant inventories.

Browser acceptance:

- Surface down states no tools for dependent session; unsupported runner not called strict-MCP.
- Open silent vs journalled tool; usage unknown stays distinct.

Sources: docs/ux/screens.md:683; scripts/product/renderers.mjs:302, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### harness-tool · SCR-38 · PARTIAL P2

Present: Example question input and flow text.

- **G74:** Missing full input/output schema, policy/scope/events, instrumented attempts/refusals, sanitized payload/result and unavailable/silent coverage; tool selector absent. **Fix:** Add selected tool id and schema/returns/policy panel plus correlated attempts/refusals from named fixture source with no-instrumentation unknown; exact source/taskrun navigation.

Browser acceptance:

- Select two tools; schemas/trace differ.
- Silent tool never shows never-called from absent instrumentation.
- Read failure preserves contract and marks usage unavailable.

Sources: docs/ux/screens.md:741; scripts/product/renderers.mjs:304, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### search · SCR-37 · PARTIAL P1

Present: Query form, no-match reset, three fixed result links.

- **G75:** Regex determines match and always returns same three mixed rows; no store groups/scorers/project/session results, coverage/paging or partial-inconclusive case. **Fix:** Search actual fixture stores, group by store with matching method and own pagination/coverage; exact entity links and denied/missing source fallback. Add independent source failures and latest-query retention.
- **G76:** Estate search always Atlas; clear query form restored from old formMemory. **Fix:** Support explicit estate/project scope and maintain query in one consistent state; clear-search clears saved form state, Back restores intended query/result selection.

Browser acceptance:

- Search Atlas, F19, session, unknown; only matching grouped stores.
- Fail memory while other stores no-match → inconclusive.
- Clear query visibly empties field; Back restores previous query when desired.

Sources: docs/ux/screens.md:721; scripts/product/renderers.mjs:310, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### support · SCR-18 · PARTIAL P1

Present: Single sample request and lifecycle illustration.

- **G77:** No support inbox/SLA/sensitivity/channel/customer/thread dedup, triage, knowledge coverage, response draft, human owner/handoff or sent receipt/reconciliation. **Fix:** Build request queue+detail with requester/source identity, classification and SLA; response editor/evidence, grant preview, assign/escalate, send pending/unknown/reconcile/receipt; product defect routes as proposal.

Browser acceptance:

- Duplicate inbound event yields one request.
- Missing knowledge/sensitive issue assigns human; draft remains.
- Unknown send reconciles same id; only receipt resolves request.

Sources: docs/ux/screens.md:349; scripts/product/renderers.mjs:314, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### release · SCR-19 · PARTIAL P1

Present: Plan graph and blocked release prerequisites.

- **G78:** No selected incident/work chain, producer/checker rejection loop, release target/grant, dispatch/receipt or post-release recovery observation. **Fix:** Build incident detail and phase artifact timeline; independent checker action returns failed artifact to producer, approved target-specific grant, release pending/unknown/receipt, recovery window and observed acceptance closing incident.

Browser acceptance:

- Checker rejects → artifact retained, release blocked.
- Deployment receipt arrives → incident still open until recovery observation.
- Monitor timeout remains unresolved with recovery action.

Sources: docs/ux/screens.md:365; scripts/product/renderers.mjs:316, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### content · SCR-20 · PARTIAL P1

Present: Three static stage columns and publication/result explanation.

- **G79:** No manual brief, exact sourced research/draft/editorial+SEO+channel checkers, publisher identity/grant, publication receipt/analytics or real stage actions. **Fix:** Add item selection/brief editor and source list, distinct checker verdict controls and repair loop, typed publish approval, delivery lifecycle and measured analytics/unknown result; development finding routes to target PM.
- **G21:** Publishing link opens unrelated Atlas staging authority. **Fix:** Use content-channel publisher identity/effect id and exact grant specimen.

Browser acceptance:

- Create brief → source-backed draft → failed checker repair → publish approval.
- No channel identity/grant blocks dispatch while draft kept.
- API timeout reconciles once; analytics missing remains unknown.

Sources: docs/ux/screens.md:380; scripts/product/renderers.mjs:318, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

### landing · SCR-29 · PARTIAL P2

Present: Category story, parent/product names, demo CTA, semantic static content.

- **G80:** Current availability and repository map/GitHub organization exit required by FLW20 are absent; concept-only footer insufficient for actual current-status answer. **Fix:** Add explicit present availability/source-linked repo map and public organization CTA, distinguish product interface vs kernel/contract/adapter while retaining demo status and no invented download. Parent source specialist verifies factual links.

Browser acceptance:

- With JS disabled, explain product/kernel boundary and current availability, open verified organization/map.

Sources: docs/ux/screens.md:535; scripts/product/renderers.mjs:320, scripts/product/controller.js:140, scripts/product/controller.js:161. Full information/actions/state/acceptance contract and scenario mappings are in screen-audit.json.

## Requirements without concrete interaction

- **O01 SCN-002:** Portfolio observer branch and current/future estate scope with explicit confirmation has no real UI; empty/software/observer seeded preview absent.
- **O02 SCN-010/SCN-011/SCN-012:** Cross-project finding/proposal and accepted-artifact memory promotion have no dedicated interaction; task acceptance stands in for proposal resolution.
- **O03 SCN-014:** Typed role interaction detail/response/effect preview is missing; SCR14 only invitation forms rendered.
- **O04 SCN-033:** Multiple repository attach/detach/primary and unreadable file panel are not reachable through any view.
- **O05 SCN-036:** Finished session captured record/tool call and safe source inspector missing; illustrative live transcript is not historical capture.
- **O06 SCN-042:** Scope-specific manager conversation that terminates in artifact or named no-op has no launcher/pane/conversation UI.
- **O07 SCN-051:** Settlement review and human superseding decision editor is absent; graph cannot issue explicit override.
- **O08 SCN-023:** External-client discovery/read/request-run/result/reconnect walkthrough lacks safe simulated client or call inspector.

## Scope and evidence

- 53/53 renderers, controller, template and style read; 48 full screen contracts captured.
- 67 scenario expected results/recoveries and 36 flow success exits inspected; full Mermaid node/edge and 22 journey step/branch sets captured for acceptance. Raw scenario numbered steps and foundation are owned by the separate source pass.
- UX linter: exit 0, 0 errors, 25 existing warnings.
- Browser interactions above are acceptance specifications unless a separate probe record marks them executed.
- No production scenario delivery/outcome statuses changed, no registers edited.
- Used skill: ux-audit for semantic screen/scenario/flow evidence discipline.
