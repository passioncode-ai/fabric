# First release: CEO-first product strategy

Status: target-design specification, 2026-09-25. Authorised direction: operator's first-launch feedback and voluntary stop/replace clarification. This document specifies behaviour; it does not claim native implementation, browser acceptance, provider compatibility or a shipped release. Canonical behaviour is [scenarios](../ux/scenarios.md), navigation is [flows](../ux/flows.md), screen states are [screens](../ux/screens.md). [Release map](../reports/product.html#view-r0-map) · [first launch](../reports/product.html#view-r0-setup).

## Product promise and first value

Choose the project; Fabric explains what is there, keeps the working context and helps advance the work. The operator sets direction and authority. CEO Fabric coordinates. A replaceable executor observes or acts inside its admitted scope. Project facts, decisions, tasks and history outlive every executor session.

First value is a sourced understanding of the selected real project plus a saved next action. Picking a folder, creating a database row or displaying a synthetic congratulation is not value. Return value is resuming a task after a pause or executor replacement without retelling the history. The colour avatar identifies Fabric; no level, streak or decorative profile work blocks either value.

This serves [vision principles 1–5](../ux/vision.md#5-principles). It does not turn Fabric into a terminal-tab cockpit: each execution remains attached to a durable Project/Task and an explicit authority boundary.

## Entry, aliases and authority

New estate: `r0-setup → r0-provider → r0-source → r0-discovery → r0-home → r0-project`. The persona has usable defaults; selecting them takes one action. Existing ready CEO: New project opens `r0-source`. Existing CEO with unavailable executor: readiness recovery comes before agent discovery. A persistent exit opens saved work; missing agent never blocks reading.

`launch-start` and `onboarding` are compatibility entry points. They resolve through saved persona/readiness, retain estate/draft/source identity and never restore the superseded manual name/purpose/review gate. Historical route IDs and source-purpose-review snapshots remain for comparison, not as the default first-launch experience.

Selecting a folder permits bounded observation of that selection; it is not permission to run build scripts, follow arbitrary external links, install dependencies, modify files or adopt repository instructions. A remote URL has separate authentication and fetch scope. The trusted host validates access and candidate boundaries; CEO prose cannot bypass it. Technical validation is automatic. A separate human review is needed only when the action actually requires a new decision or authority, not for confirming derived metadata.

## Ownership across the release

| Capability | Human supplies/decides | CEO Fabric owns | Executor/host owns | Visible result and boundary |
|---|---|---|---|---|
| Persona | Optional name/avatar preference | Consistent identity and introduction | Persist selected asset revision | Same identity everywhere; no authority change |
| Base executor | Provider choice and required login/access | Explain missing capability; propose recovery | Detect binary/version/auth; verify adapter readiness | Ready, missing, auth-required or unsupported; not inferred from selection |
| Add project | Select folder/root or URL | Interpret observed sources; derive display name and suggested purpose | Native picker, source access, Git/read adapters | Sourced overview; no required typed path/name/purpose |
| Parent-folder discovery | Choose root and candidate project(s) | Group candidates, explain likely projects | Bound traversal and canonicalise identities; no secret/ignored paths by default | Candidate selection; no silent batch imports |
| First insight | Correct uncertain intent if necessary | Separate facts, inference and unknowns; propose next useful work | Provide source revisions and coverage | One useful next action and expandable sources |
| Task/plan | Set goal, priorities and acceptance when absent | Propose decomposition and compatible assignment | Persist commands, validate authority and dependencies | Goal → tasks → runs/results; plan is not historical fact |
| Execute | Authorise bounded work through current policy | Dispatch eligible work and monitor exceptions | Admit, spawn, deliver and observe real run | Spawn ≠ acknowledgement ≠ accepted outcome |
| Stop/replace | Stop voluntarily; choose continuation mode/provider | Assemble context and explain gaps | Observe process tree, reconcile effects/worktree, fence old writer | Stopping ≠ stopped; exact successor linked to old run |
| Board | Decide exceptions and assess result when required | Prioritise actionable matters, attach evidence, resurface deferred items | Write source resolution and delivery receipts | Reading or discussing never resolves implicitly |
| CEO chat | State intent in text/voice, change scope | Interpret intent, ask only material ambiguity, reuse canonical commands | Persist conversation/references; execute trusted command path | Sourced answers or concrete action receipt, not unsupported promises |
| Voice | Record, edit transcript, send/cancel | Same scoped interpretation as text | Capture/STT with permission/error handling | Transcript logged and attributed; audio retention explicit, no auto-send |
| Return/live | Choose next work; optionally pause feed display | Summarise since last seen and point to next decision | Observe timestamps/cursors, preserve unread boundary | Stale/unknown distinct from inactivity; pause feed ≠ stop agent |
| Basic cycle | Select purpose/cadence/bounds; enable | Propose a simple observe → triage → act loop | Schedule only supported windows and track actual execution | Enabled/next due/last observed/result separate; missed window not executed |
| Guide/settings | Skip/resume lessons; change future defaults | Reveal relevant capability when useful | Save per-scope settings/drafts with revisions | Lessons never gate business actions; defaults do not rewrite active runs |

CEO can perform permitted routine managerial actions without asking for a second ceremonial confirmation. Ambiguous destination, new authority, destructive effect and unsettled prior outcome require an actual decision/reconciliation. Every direct UI operation and CEO operation uses the same command boundary. The executor's output is evidence or proposal, never independent authority.

## Screen contract and composition

All routes below are target variants bound to existing canonical screens. The common shell exposes project context, CEO launcher and return navigation. One primary action per state; technical detail is disclosed. Failure, blocked work and pending/unknown outcomes are never hidden for calmness. Selected source, draft and scroll/focus survive a round trip. At narrow width panels stack; source/primary action remains reachable. Colour has text equivalents; reduced motion leaves all meaning intact.

| Route / canonical | First layer and main action | Next state | Alternate and failure states |
|---|---|---|---|
| `r0-setup` / SCR-36 | Fabric name and colour avatar defaults; Continue | `r0-provider` | Customise optional; save failure preserves draft; saved work exit; repeat entry uses saved identity |
| `r0-provider` / SCR-05 | Claude Code/Codex with observed readiness; current recovery or Continue | `r0-source` when ready | Missing: official install guidance; auth: login/recheck; incompatible: reason/change; unknown: retry; keep reading saved work |
| `r0-source` / SCR-27 | Choose project folder; optional parent-folder selection or URL | `r0-discovery` after permitted observation starts | Cancel keeps prior selection; duplicate opens exact project; archived offers restoration; invalid URL/denied local recovery |
| `r0-discovery` / SCR-27 | Source and truthful observed stages; Cancel | `r0-home`/`r0-project` | Parent candidates return to selection; partial insight names gaps; empty offers another source/idea; timeout/unknown reconciles; changed source fences late results |
| `r0-home` / SCR-30 | Compact avatar/pulse; Board then Projects, Resume then Live | Exact project/task/decision | No history means no fake statistics; new source CTA; stale snapshot names age; read failure is not zero work |
| `r0-project` / SCR-31 | What this is, now/next, sourced insight; continue useful work | Task, Board or Plan | Purpose inference is editable after first value; no Git/guide/history is explicit; sources disclose exact revisions |
| `r0-work` / SCR-32 | Goal, observed run status, terminal, Stop or Continue | Confirmed stop/context/successor | Hung process, stop timeout, uncertain effects, changed branch, stale pack, missing provider, failed spawn and pending delivery each keep own recovery |
| `r0-board` / SCR-41 | Prioritised actionable questions/results; resolve selected item | Source-backed decision/receipt | Defer with return condition; conflict preserves draft; delivery pending remains distinct; denied source hidden |
| `r0-plan` / SCR-40 | Goals, tasks, dependency/blocker and next action; list/graph | Exact task/goal detail | Planned vs occurred distinct; inaccessible node local failure; list offers same actions as graph |
| `r0-settings` / SCR-52 | Persona, base executor, scope/default permissions | Saved future configuration | Dirty revision conflict; provider recheck; agent default change does not swap active sessions; all source selection uses picker |
| `r0-map` / SCR-30 | Release journey and navigable R0 screen cards | Exact selected route/state | State labels show designed/simulated scope; full historical catalog linked separately; never imply all catalog features launch |
| `r0-guide` / SCR-44 | One relevant next lesson and practical CEO examples | Real project action or skip | Skip/resume saved; links do not complete milestones; missing project offers source; no mandatory product tour |

| `r0-memory` / SCR-34 | Search permitted session sources; inspect exact context and add a reference to CEO chat | Source/run detail or existing conversation | Partial capture, empty matches, denied/revoked source, index lag and query errors stay distinct; draft/query survives return |

Right-side CEO chat is available throughout working screens and source/readiness recovery. On setup it can explain the current step without pretending it has an executor. Header shows name and status; scope sits above composer; conversation scrolls independently; close returns focus to launcher. Global scope is default outside a project, current project inside one, with explicit override. Attached context is visible/removable and captured on send. A scope change preserves separate drafts. Voice includes record → stop → transcript → edit → send; microphone denied/device/STT/silence errors retain a text path.

## Folder picker contract everywhere

One interaction primitive serves onboarding, project repository attachment, root discovery, configuration and terminal working-directory selection. Control: named Choose folder button; result: readable selected-folder chip with Change/Remove. Full path is readonly detail, never required text input. Cancel produces no mutation and restores focus. Denial retains selection and explains retry/change. The native bridge returns a scoped source reference; renderer strings cannot broaden host access. Existing URLs remain typed URL inputs with inline validation.

A browser mockup without host access offers an explicitly labelled fixture chooser; this demonstrates the selection interaction rather than claiming a native scan. No fallback asks the operator to type an absolute path. Real native acceptance must exercise the operating-system dialog, cancellation, non-ASCII/spaces, denied/deleted folder, alias/canonical duplicate and retry.

## Continuation is separate from stop

The first release must support deliberate stop even when no failure occurs. Stop sends a request and exposes observation; it does not destroy task history or require a successor. Force termination targets the owned process tree after timeout, and uncertain remote/tool effects remain named even if the local process has exited. No second writer starts in the same worktree while the old writer is unaccounted for.

After observed stop, Continue offers three distinct modes:

1. Resume the original conversation through a verified provider capability.
2. Start a fresh session of the same provider with a prepared context pack; the old process stays dead.
3. Start a fresh session of another ready provider with that pack.

The pack contains task/criteria, accepted decisions/constraints, sourced compact history, precise recent actions/results/errors, repository/worktree/branch/HEAD, uncommitted changes, checks performed, unsettled effects and next plan. It excludes credentials and hidden model reasoning. Copy/inspect is possible without launching. A crashed agent's cooperation is not required to reconstruct the pack from saved observations and files. New runtime session/run identities link to the same Task and old run. Existing accepted results are not overwritten; materially new work becomes a linked task.

At admission, compare pack revision and actual workspace; stale HEAD/permission/source requires reconciliation. Do not reset, discard changes or create commits merely to make transfer convenient. Retry keeps one continuation request identity; unknown spawn/delivery outcome is checked before another start. Stop, spawn, delivery and independent result verification need separate receipts.

## Progressive adoption across visits

| Moment | Useful work | What is introduced | Deliberately not forced |
|---|---|---|---|
| First visit | Select own project, inspect sourced insight, save next step | Fabric identity, base executor, source scope | Project naming, full organisation, advanced grants, long tutorial |
| First working session | Run one bounded task and understand its result | Task/terminal, status, criteria, stop | Full automation, multiple agent roles, large graph |
| First interruption/return | Restore last state and continue the same task | Checkpoint, since-last-seen, continuation chooser | Repeating onboarding or retelling history |
| First real exception | Resolve one sourced question | Board and decision receipt | Seeded fake urgent tasks or forced tutorial completion |
| Repeated useful work | Enable one bounded review cycle | Cadence, authority, missed-window/result semantics | Full workflow/DAG editor |
| More projects | Choose priority and move between contexts | Featured projects, global Board/Live and plan overview | Portfolio import of every discovered folder |

The hook hypothesis is saved context → low-effort useful return → accumulated decisions and outcomes. It is a product hypothesis to validate with users, not a measured retention claim. Avatar/level/streak cannot substitute for usable continuation.

## Bounded native implementation packets

These are execution specifications supplementing existing AD packets, not a new task registry and not evidence of completion. Original packet IDs/acceptance histories remain. A packet stops at its named boundary; mockup tests do not satisfy native acceptance. Every packet must attach exact source revision, tests actually run, observed failures and unresolved scope before closing.

| ID | Packet | Dependencies and owned boundary | Deliverable | Required acceptance and negative checks | Status |
|---|---|---|---|---|---|
| FR-A | persona and entry routing | AD00/01 contracts; draft integrity from AD02; canonical SCN-095/FLW-55 | Persist CEO defaults, source draft and alias resolution; no metadata prerequisite | Fresh/repeat/restart entry; same estate/draft identity; local save failure; stale hydration; no cross-estate state; saved work accessible without provider | open — first parts built 2026-10-03 by the start paths (P-01); acceptance not met |
| FR-B | early readiness | FR-A; reuse AD15 readiness/admission contracts, before AD05 scan | Observe installed provider/auth/capability; explicit install/login/recheck; choose future default | No binary/auth/capability produces no ready; cancellation preserves choice; stale readiness rechecked; Codex terminal launch alone not an admitted executor; no active-session mutation | open — first parts built 2026-10-03 by the start paths (P-01); acceptance not met |
| FR-C | picker and source observation | FR-A/B; AD04 idempotent identity and AD05 source producer; AD24 candidate discovery | Native picker bridge across source entry points; bounded automatic read-only scan; derived metadata/source receipts | OS dialog/cancel/denied/deleted/non-ASCII paths; duplicate/archived identity; URL error/auth; empty/partial/timeouts; changed-source late response; no hidden writes or instructions executed; restart reconciles old scan | open — first parts built 2026-10-03 by the start paths (P-01); acceptance not met |
| FR-D | insight and first return | FR-C; AD06/07 checkpoint/read boundary; AD08 when CEO projection exists | One sourced first dashboard and Project view; next task with receipt; exact resume | Missing facts stay unknown; inference labelled; selected project only; source link resolves; first checkpoint survives restart; late events stay unread; no fake success from create click | open |
| FR-E | stop and portable continuation | FR-B/D; AD16 real run/receipt lifecycle and SCN-096/FLW-56 | Scoped stop observation, force termination, context pack, three continuation modes | Real process and child-command termination; hung/crashed agent; unknown remote effects; same-provider fresh/native resume/other-provider; branch/worktree change; uncommitted files retained; duplicate requests; lost ACK; no overlapping writer; previous pack immutable | open |
| FR-F | managerial interaction and adoption | FR-D/E; AD09–14 conversation/voice/Board; AD17 bounded cycle; AD18–21 adoption | CEO/direct UI same commands, scoped transcript attribution, relevant guide and single useful cycle | Text and voice record/review/send/cancel; failed STT; project switch mid-recording; durable transcript/source attribution; unsupported intent truthful; Board resolution vs delivery; cycle due/observed/result separate; skip lessons without losing data | open |
| FR-G | release integration | FR-A…F; AD22/23 integration/user pilot | Native walking skeleton and observed user-value receipt | Own repository → insight → task → stop → fresh same provider → other provider → restart → exact return; keyboard/narrow viewport/reduced motion; failure recovery; preserve existing projects/history | open |

### Sequencing delta to the AD plan

- **AD03**: previous source/purpose/review mockup target is superseded by CEO-first aliases and native picker contract; prior checks remain historical. Re-run acceptance against the new flow.
- **AD04**: keep stable identity, immutable request, unknown reconciliation and draft safety. Remove human metadata/review prerequisites; derived metadata and observation receipts must not create duplicate Projects.
- **AD05**: agent-powered observation now depends on the minimal ready executor slice from **AD15**, not merely later delegation. Saving a source and reading old work remain possible without it.
- **AD15**: pull installation/auth/capability readiness forward; broad role/team management can still follow first insight. Readiness does not grant write execution.
- **AD16**: add an explicit observed-stop/portable-continuation acceptance slice; do not equate existing account switching with cross-provider context handoff.
- **AD24**: parent-folder candidate scan uses the same picker/permission/readiness controls; selecting one project is sufficient for first value and full-folder import is optional.
- Existing conversation, voice, Board, return and basic cycle scope remains required. Advanced organisation/starter setup, foundry, comprehensive graph exploration and full workflow editor remain in the wider backlog with their original ideas preserved.

## Current evidence and exact next task

Baseline source commit: [`473ba9a4d3ba3250c6d41e7e0007b2ece256533c`](https://github.com/passioncode-ai/fabric/tree/473ba9a4d3ba3250c6d41e7e0007b2ece256533c).

- [AD plan at baseline](https://github.com/passioncode-ai/fabric/blob/473ba9a4d3ba3250c6d41e7e0007b2ece256533c/docs/launch/adoption/README.md#L11) records three-step target creation and pending native/browser acceptance. This strategy supersedes its entry sequencing, not its evidence requirements.
- [Executor distinction at baseline](https://github.com/passioncode-ai/fabric/blob/473ba9a4d3ba3250c6d41e7e0007b2ece256533c/apps/desktop/src/shared/agents.ts#L91) distinguishes a terminal from a ready executor; [adapter readiness boundary](https://github.com/passioncode-ai/fabric/blob/473ba9a4d3ba3250c6d41e7e0007b2ece256533c/apps/desktop/src/shared/agents.ts#L207) is a producer constraint, not a UI preference.
- This revision adds SCN-095/096, FLW-55/56, twelve `r0-*` routes and first journey `PJ-R0-FIRST`, reusing canonical screens without upgrading native coverage.
- Validation run for these sources: `node scripts/sync-product-ux.mjs`; `node scripts/check-product-model.mjs` (PASS); `python3 docs/ux/lint.py` (0 errors, existing U077 vision-rule warning). These validate registry/model structure, not runtime or rendered usability. Root iteration records final generated/rendered checks in [first-release brief](first-release.md).

Exact next native task after target review: FR-A and the bounded FR-B readiness slice, using AD02 draft acceptance as prerequisite; then FR-C native picker/source observation. Do not begin by implementing another manual name/purpose/review wizard. Do not claim a completed scan, stopped process, voice capture or portable handoff from a fixture demonstration. No member-repository changes are required by this planning supplement.

## Conversation and context refinement · 2026-09-26

[ADR-0065](../adr/0065-conversation-led-work-and-context-bundles.md) and [agent-first contract](agent-first-contract.md) refine FR-A/C/E/F/G: one Project with primary/related sources (**amended 2026-10-03 by [ADR-0100](../adr/0100-first-run-and-start-paths.md) §3:** a scanned folder is a checklist and each ticked repository becomes its own Project; the start paths delivered first parts of FR-A — persona — and FR-B/FR-C — coding-agent readiness and the folder picker with candidates — while those rows keep their own status), ticket-owned CEO conversations, outcome/command/receipt separation, pre-log secret handling and bounded context retrieval. The plan UI becomes a projection with a CEO entry, not a mandatory task form. [Iteration and checks](context-board.md). Existing native prerequisites and open CO-168 remain.
