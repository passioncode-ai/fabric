<sub>ssheleg skills — project-audit · ux-audit · agent-orchestrator · agent-harness · sheleg-design · brand-voice · copywriting</sub>

# Fabric: UX, visual system and scenario audit, 2026-09-07

Read-only subaudit at `153b4f029e626230d465d5d21d02fb8c9de5fadf`. Scope: SCN-025–038, their stories/flows/screens, renderer callsites, selected main/shared implementations and assertion coverage. This is not a claim that every runtime path was executed. No repository files or coordination records were changed. Current application and DB were not launched or mutated. Parent owns live desktop/public-site validation. Three isolated jsdom probes render current components using fake read-only IPC; old committed screenshots are explicitly dated 2026-09-05.

Read: repository AGENTS.md, docs/AGENT_SYNC.md; ux-audit SKILL.md and sheleg-design SKILL.md, CREATIVE_DIRECTOR.md, AI_PRODUCT_PATTERNS.md. `python3 docs/ux/lint.py`: 0 errors, 14 warnings. The warnings include external SCR-29/SCN-038 coverage that cannot be mechanically resolved and several flows without implementing files. Figma is explicitly disabled in docs/ux/screens.md:56.

## Main judgment

**REFINE implementation reliability; redesign project information architecture before adding more panels.** The durable Project model, separate agent claims/observations, sourced memory and independent authority are useful foundations. Current UI does not yet deliver that model reliably. The most serious defect is a deterministic main-window boot crash, followed by data loss in the editor despite its new pure helper tests. The gap is often between a correct low-level helper and its actual component composition. A green registry/unit-test suite cannot certify that the app opens or preserves work.

Suggested work serves vision §5 principles 1, 2, 4, 5 and alignment test 1, 2, 4: the Project remains the working unit, runners can change, state is sourced and adoption is progressive (`docs/ux/vision.md:30`, `:70`). This is compatible with PasionCOde as umbrella brand and Fabric as IDE/work environment/command center. A visual repaint alone would leave the replaceability problem intact.

## Reproduced defects

### UV-01 · P0 · Main window crashes after the metadata read succeeds

`Shell` starts with `sessionWindowId=undefined` and returns before all hooks. Once metadata resolves to the main-window value null, it reaches three additional hooks. React throws “Rendered more hooks than during the previous render.” There is no production error boundary around App.

Evidence: `apps/desktop/src/renderer/src/App.tsx:97`, `:171`, `:247`, `:292`, `:304`, `:308`; `main.tsx:26`. Actual isolated repro: `/tmp/fabric-ux-probe/shell.test.tsx`, `/tmp/fabric-ux-probe/shell.log` (React hook 31 undefined→useEffect, stack at App.tsx:292). Fake IPC is deliberately successful; no backend error is needed. This invalidates current-source main-window runtime availability, separate from local scenario conformance below. It is one root cause, not thirteen separate scenario bugs.

Remedy: route window kind in a small parent and render an estate-shell child, or move every hook above conditional returns; add rules-of-hooks lint and successful root mount smoke. Acceptance: main/editor/session routing all mount under StrictMode, metadata failure renders retry, no console hook errors.

### UV-02 · P1 · Newer editor keystrokes are still lost while Save is in flight (existing UX-04)

The added `afterSave` helper correctly notices a newer buffer, but `setFile({content: submitted})` changes the effect dependency. Monaco is disposed and recreated from the old submitted content. The dirty flag says there is unsaved work while the work itself has disappeared. Ordinary successful saves also discard the editor instance/undo history/selection.

Evidence: `EditorWindow.tsx:74`, `:78`, `:94`, `:99`, `:151`, `:160`; `shared/editorBuffer.test.ts:9` tests only the helper. Repro `/tmp/fabric-ux-probe/editor.log`: typed a→ab, Save pending, typed abc, completed Save: second editor value ab. `/tmp/fabric-ux-probe/editor.test.tsx` renders actual EditorWindow with a controlled Monaco model.

Remedy: keep the Monaco model alive for the file identity; track persisted baseline/hash separately. Save snapshots must not replace the current model. Apply the same rule to conflict modified models. Acceptance: typing during ordinary/forced save and during conflict arrival preserves every newer edit, undo stack and caret; saving responses out of order cannot regress the baseline. Existing UX-05 dirty-close guard and external-open error handling are improvements, not proof that UX-04 closed.

### UV-03 · P1 · A completely empty Board has no way to file the first idea

When tasks=[], BoardSection renders EmptyState and bypasses Board entirely. Its only idea form lives inside the backlog column, which therefore does not exist for a new project. M134 is marked shipped but its first-use path is missing.

Evidence: `ProjectHome.tsx:497`, `:527`, `:539`; `docs/evidence/backlog.md:589`. Actual component probe `/tmp/fabric-ux-probe/project.log`: `emptyBoardIdeaInput:false` after the empty task read resolves.

Remedy: render the idea entry independently of populated columns, including the zero-task state. Acceptance: new empty project → file idea → one backlog task → research it, all from UI, with failure preserving the text.

### UV-04 · P1 · Codex is shown as “Terminal” in runner selectors and session headers

The runner descriptor now contains Codex, but most surfaces still have the two-value Claude/else-Terminal ternary. The dropdown contains two identically labeled Terminal options. A Codex session looks like a plain shell. Its descriptor explicitly says it does not connect to Fabric, but that capability limitation is not exposed by these selectors.

Evidence: `shared/agents.ts:114`–131; `Onboarding.tsx:194`; `Tasks.tsx:204`; `ProjectHome.tsx:969`, `:1069`, `:1557`; `SessionWindow.tsx:54`; `Workspace.tsx:55`. Actual `/tmp/fabric-ux-probe/project.log`: options `{claude-code:Claude Code,codex:Terminal,shell:Terminal}`.

Remedy: expose descriptor label, runner identity, Fabric connectivity, permission/adapter capabilities and unavailability reason in one shared presentation contract. Acceptance: adding a fourth runner only adds its descriptor; every selector/tile/header shows the proper label; a non-integrated runner is visibly distinct from an admitted agent.

### UV-05 · P1 · Ending a session also activates its enclosing session card (existing UX-02)

Panel renders a real button whenever onClick is provided. AgentTile places End, Cancel and Dismiss buttons inside it. This remains present despite a known audit finding and comments elsewhere describing the trap. Keyboard and click bubbling can focus/open the session while trying to end it.

Evidence: `components/Panel.tsx:59`; `ProjectHome.tsx:1552`, `:1597`, `:1615`, `:1620`. Actual current-component probe `/tmp/fabric-ux-probe/project.log`: one nested button, plus React invalid button-descendant warning.

Remedy: a noninteractive card wrapper with sibling Open session and End controls; distinguish card link/action composition in the component API. Acceptance: zero nested interactive controls, End does not invoke openSession, keyboard can activate both independently.

## Other confirmed code gaps and testable remedies

| ID / priority / prior mapping | Current problem and evidence | Remedy and acceptance |
|---|---|---|
| UV-06 P1, new | Global Agents mode overrides content. Home, project tab, New project, Search and Attention navigation update active but never clear showAgents. `App.tsx:252`, `:261`, `:319`, `:339`, `:386`. | One discriminated route state, or consistently exit global mode on navigation. Test Agents→each destination and back; visible selected tab must describe displayed content. |
| UV-07 P1, UX-06 partial | Create now reuses a caller ID, but appends project then attaches repos sequentially; Cancel/tab close remain possible while create is pending. A late success can activate a project after its draft tab was removed. `main/index.ts:712`, `:723`, `:729`, `:743`; `Onboarding.tsx:57`, `:69`, `:206`; `App.tsx:268`, `:282`. | Pending create is an owned operation. Prevent destructive dismissal or reconcile late success honestly. Either transactionally create config+repos or show recoverable partially configured state; retry same ID. Test append/attach/readback failures and closing/switching tabs during save. |
| UV-08 P1, UX-07 / M108 remains | null becomes zero: ProjectHome passes `sessions ?? []` to AgentsSection and computes running from [] (`ProjectHome.tsx:244`, `:297`), so unread session state appears idle. App feed returns immediately when replay yields [] and never setsFeed([]) (`App.tsx:189`), leaving an empty estate's journal indefinitely “reading”. Initial project/session fetches also have no catch (`App.tsx:215`, `:227`). Local resource errors are global banners; stale values remain unmarked. | Shared resource state: unread/loading/fresh/empty/stale/error, with observedAt and request generation. Preserve last success but mark stale. Test initial empty, initial failure, refresh failure, retry and out-of-order response. Do not treat error as empty or forever loading. |
| UV-09 P1, UX-08 / M142 | Feed rows still have no link/handler, filters or unread marker (`Feed.tsx:26`); Workspace activity prints raw event types (`Workspace.tsx:76`). `reveal()` only scrolls: it neither opens collapsed Files/Transcripts nor focuses the destination (`evidence.ts:52`; `ProjectHome.tsx:784`). Memory “superseded facts” goes to decisions (`MemoryOverviewSection.tsx:83`) even though superseded notes are not decisions. | One typed evidence-target resolver: project/task/session/event/file/fact. Open the exact record, expand necessary section and move focus; surface missing/unavailable record. Test each statistic/feed item against the actual source type, not merely an existing DOM id. |
| UV-10 P1, UX-01 / UX-12 residual | Transcript selection has one openId and one body. A slow A response can overwrite B's body after selecting B. Global project remount fixes cross-project leakage, not same-project race (`ProjectHome.tsx:1123`–1140). Main invisibly caps history to 30 (`main/index.ts:813`–819). | Key requests/cache by session ID with generation cancellation; display per-record read failure. Cursor pagination with total/hasMore. Acceptance: open A then B and resolve A last; B still shows B. Session31 reachable without DB/MCP. |
| UV-11 P1, UX-15 partial / M103 | Quiet output is treated as readiness and 15-second deadline sends anyway; warning goes to console, no visible delivered/acknowledged state (`pty.ts:198`–246). SCN-032 still says no task recorded if spawn fails, while implementation records failed attempts. | Preserve bracketed single-paste fix, then runner-specific readiness/acknowledgment and an explicit undelivered/unknown status. Require visible delivery receipt before calling the task running in the user's sense. Test delayed first-run login, trust prompt, spinner, early exit, multiline payload. Scope no claim of per-runner hook enforcement. |
| UV-12 P1, SCN-032 / ST-024 | Use again was removed with task history. BoardSection accepts onReuse but never calls it; TaskPage has no reuse control. The old promise survives in SCN-032, helper plumbing and strings. `ProjectHome.tsx:362`, `:428`, `:559`; `Tasks.tsx:89`; `TaskPage.tsx:194`–287; `foundation.md:427`; `scenarios.md:803`. | Add explicit rerun/reuse on task detail into a project-owned draft, preserve edited drafts, reset borrowed preset provenance, keep a source-task link. Test complete visible click path, not just loadInto. |
| UV-13 P1, new live consistency | New created agents are absent from the Run picker until ProjectHome remount: CreatedAgents reloads only its own made list; Tasks loads made and preset data only on project.id (`ProjectHome.tsx:1241`; `Tasks.tsx:110`–126). Backlog presets likewise don't update with the board. Memory facts only reload on search/toggle/project, while overview follows feedMark (`ProjectHome.tsx:1669`; `MemoryOverviewSection.tsx:41`). Automations read once (`ProjectHome.tsx:1358`, `:1418`). | Invalidate by affected project/object version through one query cache; share read models instead of sibling private copies. Acceptance: create agent, file idea, record/correct fact via another writer, routine starts/completes; all visible siblings agree without tab hopping. |
| UV-14 P1, light visual state | Light theme keeps terminal background #1f1d1a but EditorWindow uses light --ink #0a0a0a and Monaco vs syntax palette (`tokens.paperclip.css:248`–255; `EditorWindow.tsx:37`–49, `:76`; `styles.css:191`, `:217`). Session/editor header inherits the light foreground on a dark background. Old committed screenshot `docs/audit/2026-09-05-evidence/screenshots/editor-light-1280.png` visibly demonstrates black-on-dark code and header; current sources preserve cause. | Give terminal/editor a coherent scoped dark theme in either app theme, or provide a true light terminal palette. Test syntax tokens, selection, diff, header, controls, caret, placeholder in both themes. Never assume token use proves contrast. |
| UV-15 P2, UX-13 | Tasks and Agents runner selects have no accessible names; file folder buttons omit expanded state; close-tab controls all say only Close tab; Field hints are not described-by their controls. `Tasks.tsx:201`; `ProjectHome.tsx:1066`; `FileTree.tsx:51`; `TabStrip.tsx:80`; `Field.tsx:23`. | Add programmatic names/state and contextual close labels; hints/errors tied by IDs. Complete keyboard + VoiceOver top-flow pass; scanner alone cannot certify accessibility. |
| UV-16 P2, visual | Stale Claim label/age uses --state-idle→--warn in light theme, contrary to tokens.app comment that warning hue is never text (`components.css:245`; `tokens.app.css:58`, `:66`; `tokens.paperclip.css:271`). Small muted text on #f5f5f5 remains #737373, recorded ratio4.349 (`light-contrast.json:3`). | Separate state-ink from status-dot roles with light/dark contrast tests on actual composited backgrounds. Minimum 4.5:1 ordinary text; don't repair by removing state labels. |
| UV-17 P2, visual/contract | Workspace gives result Panel class span-2, but CSS span rule only matches `.widget.span-2`; Panel uses panel, never widget. Current result slot doesn't span both columns. `Workspace.tsx:115`; `Panel.tsx:46`; `styles.css:179`. Board remains four columns at all widths (`components.css:249`); settings/push panels lack compact mode. | Correct span selector; add content-aware board/list breakpoint and side-panel behavior at 200% zoom. Acceptance at1280×800,1024,768,640 and200% zoom: named task/move readable, primary action reachable, no unintended horizontal page scroll; preserve intentional workspace reading order. |
| UV-18 P2, docs UX-10/11 | Screen registry index/body conflicts remain: SCR-30 Estate home maps AttentionPanel, SCR-17 Workspace editor maps text EditorWindow, superseded SCR-23 marked built; source/components/assets “none yet”. `screens.md:29`, `:35`, `:42`, `:58`, `:421`. FLW-13 remains active and SCN-025 traces it; FLW-15 promises header repository-path editor, while repos are picker-driven; FLW-21 duplicates attention edge to two destinations. `flows.md:437`, `:511`, `:708`, `:714`. | Version current baseline separately from target flows; canonical screen identity with aliases, implementer receipts and state coverage. Mark superseded records retired. Linter should validate semantic implementing role rather than first filename presence. Fix all chain layers in same change. |
| UV-19 P2, public UX-16 | Local public landing still targets #project from second CTA, while SCN-038 says repository map; one-column Project frame starts620px vs registry720px. `passioncode-ai.github.io/index.html:73`; `styles.css:410`, `:429`; `scenarios.md:968`; `screens.md:533`. | Set accepted actual navigation/breakpoint in the chain or implement original intent. This is contract drift, not proof of a broken link. New parent-brand/product hierarchy must be an explicit coordinated content revision. |

## Scenario verdicts

These are local conformance verdicts, conditional on repairing the shared UV-01 boot failure. They do not label unavailable S3+ work a regression. PASS means static implementation path found, not live observed product value.

| Scenario | Verdict | Evidence and boundary |
|---|---|---|
| SCN-025 | PARTIAL | PTY start/replay/reattach/end exists (`pty.ts:259`, `:366`, `:387`; `TerminalView.tsx:13`; `SessionWindow.tsx:16`). UV-04/05/08 and stale FLW-13 prevent full launcher/lifecycle conformance. Tests `test/pty.test.mjs` verify process behavior, not actual launch UX. |
| SCN-026 | PARTIAL | Human sentences and durable replay exist (`Feed.tsx:34`; `App.tsx:189`; `main/index.ts:2290`). UV-08/09: empty read never resolves, no receipt navigation/filter/unread; realtime is polling by explicit App.tsx:18 design. `Feed.test.tsx` tests copy fallback, not ordering/reconnect. |
| SCN-027 | FAIL, planned gap | Refusal/one-shot grant UI exists (`AttentionPanel.tsx:121`; `main/policy.ts`). Scenario demands canUseTool interception, checkpoint resume, refusal reason and expiry. M140 explicitly remains partial (`backlog.md:614`; `iterations.md:79`). Do not call agent-initiated effect request universal enforcement. |
| SCN-028 | PARTIAL | Project-keyed mount/draft patches now isolate instructions (`App.tsx:417`, `:430`). Header save exists (`ProjectHome.tsx:912`; `main/index.ts:2257`). UV-06/07/08, only instruction draft persisted, and old header-path contract remain. |
| SCN-029 | PARTIAL | Detached window and live card lifecycle exist (`ProjectHome.tsx:1047`; `main/index.ts:2366`; `SessionWindow.tsx:50`). UV-04/05/08 and missing concrete unavailability reason. |
| SCN-030 | PARTIAL | Real tier0 grid and explicit empty results slot (`Workspace.tsx:30`–115). UV-09/17: no stale resource branch/receipt navigation, raw event identifiers, wrong span selector. Tier1/2 provider widgets are planned, not missing shipped work. |
| SCN-031 | PARTIAL | Independent draft data and picker/default memory inputs (`App.tsx:261`; `Onboarding.tsx:48`, `:57`, `:163`). Stable ID retry is an improvement. UV-04/06/07 prevent reliable full first-run. Onboarding tests focus memory choice, not create/cancel race. |
| SCN-032 | FAIL | Instruction and preset protection exist (`Tasks.tsx:151`, `:184`, `:265`). Current final expected result fails UV-11/12/13; shared launch label defect UV-04. Test Tasks.test.tsx only verifies preset content/availability, not run history/end/reuse cycle. |
| SCN-033 | PARTIAL | Picker attach/detach, primary confirmation, watcher+10s refresh are implemented (`ProjectHome.tsx:208`, `:825`, `:859`; `main/index.ts:2217`). Unreadable branch exists, yet “clean” is still computed unguarded when primary.error set (`ProjectHome.tsx:674`, `:685`); the tree can fail opening a file without showing a reason (`FileTree.tsx:70`). |
| SCN-034 | FAIL | Hash conflict, grant and path boundary exist (`EditorWindow.tsx:144`; `main/files.ts`; `test/file-roots.test.mjs`). UV-02 reproduces loss violating no-surprise outcome; UV-14 corrupts light readability. Guarded close exists, but its pure helper test does not verify native Electron quit sequencing. |
| SCN-035 | PASS, static behavior only | Claim author/age/stale comparison remains separate from observed state (`ProjectHome.tsx:1192`, `:1564`; `components/Claim.tsx:33`; `main/sessionBundle.ts`; `main/contextPack.ts`). Marked as local semantic PASS; current display accessibility and source-capability limitations UV-04/16 are separate. No live agent run claimed. |
| SCN-036 | PARTIAL | Automatic capture, excerpt/truncation and lazy full-body read exist (`main/transcripts.ts`; `main/index.ts:813`, `:824`; `ProjectHome.tsx:1153`). UV-10 row31 inaccessible and selection race. Transcript main tests do not cover two fast row selections. |
| SCN-037 | PARTIAL | Actor marker/correction history/retrieval bookkeeping are real (`ProjectHome.tsx:1649`, `:1744`; `main/index.ts:2306`, `:2331`). M112 correctly amends removed status-strip counts. UV-09/13: stale fact list versus overview, correction count opens wrong store; same-query/toggle race generation not guarded. |
| SCN-038 | PARTIAL, minor contract drift | Static semantic local landing includes category, role/provider distinction, human authority, availability, organization link, no JS dependence (`passioncode-ai.github.io/index.html:44`, `:63`, `:170`, `:187`). UV-19 remains. Live domain availability belongs to parent's pass; new brand hierarchy is proposal, not existing scenario defect. |

## Screen/module coverage and limits

- Main shell and onboarding: App, Onboarding, project header, TabStrip, settings routing; actual Shell boot and ProjectHome component composition probed. No production app run.
- Execution: AgentsSection, AgentTile, Tasks, SessionWindow, TerminalView, launch descriptors, PTY delivery, session capture references. No live agent started, no user work sent.
- Files: FileTree, EditorWindow, model lifecycle, file-boundary/grant callsites, editorBuffer tests. Monaco lifetime reproduced with mock; native macOS close/quit and actual Monaco keyboard/VoiceOver require live validation.
- State/read models: ProjectHome loaders, Feed, MemorySection, MemoryOverviewSection, Workspace, selected task/attention readers. Deep task/Board authority and complete operating-surface coverage remain parent/other batch scope.
- Visual: tokens.paperclip, tokens.app, styles, components, public local CSS; old three screenshots viewed. No current-layout screenshot claimed. Responsive/200% zoom limits are explicitly unverified until live run; incorrect selector and absent breakpoints are source facts.
- Chain: foundation ST-017–028, FLW-13–20 and intersecting FLW-21, SCR-23–29 and index; docs/ux/vision and brand/ui. Canonical docs were not edited by this subaudit.

## Visual and UX design proposal for PasionCOde → Fabric

Keep the approved passion-fruit parent mark and existing neutral semantic base. No evidence justifies a wholesale kit/pack migration. Use PasionCOde as family signature at installation/about/product selection and Fabric as the working application name. A small consistent “Fabric by PasionCOde” lockup makes parent/product relationship learnable. Agent portraits, status colors and parent logo must have separate meanings. The current landing says PassionCode.ai is the product and Fabric the kernel (`index.html:170`), so rebrand must update public site, app identity, brand facts/terminology, docs, metadata and release assets together.

The key redesign is task-focused progressive composition. Current ProjectHome renders Tasks→Digest→Memory overview→Decisions→Plan→Board→Agents→Transcripts→Files→Automations while a second column renders Harness→Repos→Workspace→Memory→Journal (`ProjectHome.tsx:246`–335). In a populated project the operational Board is below several independent panels; the UI repeats stores and navigation rather than making the next decision dominant. The old 2026-09-05 screenshots show a readable neutral base but equal-weight boxes, tiny upper-case labels and a large placeholder workspace. Current added panels increase this density problem; an actual current screenshot is needed to measure the fold.

Proposed information architecture, subject to updating accepted scenarios:

1. **Project overview**: purpose, current objective, next human decision, active work, last accepted outcome, current source health, meaningful change since last visit. Every item opens its durable record. Never compute a synthetic confidence/health percentage.
2. **Work**: Board/list views, task detail, dependencies, deliverables, structured review. One primary create/assign entry. Preserve draft, scroll, selection and open task per project rather than just instruction text.
3. **Team and agents**: durable role/config separate from runner/model/session, capabilities and authority visible, measured heartbeat separate from claimed progress, launch and handoff anchored to task.
4. **Knowledge and evidence**: searchable facts/decisions/artifacts/transcripts/context packs with producer, source, recorded/observed time, freshness and correction lineage. Counts are entry points into the exact records.
5. **Operations**: routines, production signals, cost/quota and policy only as their sources exist. Project-owned scheduler cycles and approvals become clear work objects, not a new generic chat pane.
6. **Files / terminal / preview**: first-class attached working surfaces that preserve task/project context. Compact project navigator persists while focus mode gives the editor/terminal space; parent brand ornament does not crowd the work.

Default product calibration can remain current 5/2/7. Improve readability by using body text for work titles/results, quieter metadata secondary to it, precise source freshness and one action hierarchy. Keep animation restrained; immediate state feedback matters more than cinematic transitions. Build visual acceptance cases from a populated multi-project fixture, slow/error/stale data, 30+ sessions, long file paths, Russian labels, two runners and a created agent. Use both themes and 200% zoom.

## Verified work ordering for this scope

1. **Restorable working app**: UV-01, then actual-source root mount and artifact/source identity smoke. No new feature surface until first launch is demonstrated.
2. **No lost work / no wrong action**: UV-02, UV-05, UV-06, UV-07, UV-10; stable editor model, owned create/save operations, scoped routing, request generation. Add interaction-level regressions for reproduced failures.
3. **Complete everyday paths**: UV-03, UV-04, UV-11, UV-12, UV-13. Fresh project→idea/task→real labeled runner→delivery receipt→result→review→reuse. This is also the acceptance path for a second provider, which is essential to the user’s model-synergy aim.
4. **Truthful evidence**: UV-08/09; typed resource state, exact evidence navigation and source-specific invalidation. This is shared architecture consumed by every screen, not per-panel patching.
5. **Coherent UX baseline**: UV-18, map implemented vs planned/superseded explicitly, target the information architecture above. Repair core names/focus/light theme UV-14–17 while composing it; accessibility is not a last polish gate.
6. **Brand and public hierarchy**: parent-approved PasionCOde/Fabric relationship, UV-19 reconciliation, one content/asset/metadata update and public render checks. Bigger-brand graphics follow verified product language.
7. **Richer automation/team surfaces**: only with explicit runtime contracts and project-local daily-use evidence. Expand from real shared artifacts, authority and outcomes; adding another session panel or free-form CEO chat alone would violate the anti-vision.

Completion criteria: exact actual-source baseline smoke; 3 reproduced component bugs become regression tests that fail before fix; no nested interactive controls or hook violations; every top-flow state has current evidence; browser/desktop keyboard and VoiceOver pass; old UX findings close only with their original failing interaction replayed. Product value still requires observing operators complete real project work—scenario PASS is not that evidence.

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
