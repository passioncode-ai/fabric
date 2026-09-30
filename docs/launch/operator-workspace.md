# Fabric · команда и единый разговор

<sub>ssheleg skills — task-pipeline · super-ux · sheleg-design · copywriting · agent-sync · maintaining-fabric-workspace</sub>

Status: target prototype, implementation reviewed · 2026-09-26. Source baseline: `3268c3c057488857bc0063979ab9cff29c287972`.

## Brief and acceptance rubric

Job: open Fabric and identify work that needs a person, the active agents and their exact Project/Task/Session; resume context in one click. In a CEO conversation, a card and a typed reply address the same versioned proposal. Serves SCN-041/042 and the existing home/project/task return flows. Project retains durable purpose and history; chat is its interaction surface. This refines ADR-0067, not a new authority boundary.

Preserve the approved quiet Paperclip token system, compact rhythm and colored Fabric avatar. Board remains the primary decision surface. Home: compact resume in the top band; Board and Projects in the main column, team opposite Board, then Live. Project: current work and questions, scoped team, context below. The roster is a current-work projection, not a second task database. Provider names never establish Agent identity, and opening a row must resolve the exact Run rather than the last selected project.

Observable rubric: status and task readable without opening a menu; attention states use both text and semantic color; stopped/unknown never look running; continuation does not duplicate its predecessor in the roster; empty team offers a useful first step; current task and provider appear in the destination. Proposal body, status and action footer are separate; one primary button; user can accept, decline, ask or refine in the same composer. Stale buttons and repeated acceptance cannot create duplicate work. Mobile reflows without hiding actions. No new settings controls around the launcher.

## Delivery packets

1. DLG-1: versioned proposal and conservative fixture intent resolver; button/text shared handler, receipts and stale/repeat/negative tests.
2. TEAM-1: Home and Project roster, attention ordering/filter, exact session navigation, empty/completed/unknown states; two-project review fixture.
3. VIS-1: message/card/action hierarchy, semantic state treatments, compact roster, desktop/narrow browser review.
4. DOC-1: scenarios/flows/screens/model, reviewed findings and native packets, map entry, generated gallery, focused gates, Git and workspace publication.

Native implementation remains CW-N1/N3 and CO-168. The prototype cannot establish microphone, real process, persistence or full natural-language understanding. Native Agent IDs and memberships must come from canonical producers; a provider or display title must not become an identity key. The first release retains one unsettled execution per Project, independent across Projects. Broader human team administration and plugins stay outside this bounded iteration.

## Reference decisions

- [Carbon conversational pattern](https://carbondesignsystem.com/community/patterns/chatbot/usage/) (read 2026-09-26): structured and typed responses represent one user intent; a selected response is reflected in conversation. Apply to button receipts and the shared command route, not its visual theme.
- [Microsoft HAX guideline 10](https://www.microsoft.com/en-us/haxtoolkit/guideline/scope-services-when-in-doubt/) (read 2026-09-26): clarify ambiguous intent before effects. Apply to multiple destinations and unclear agreement; avoid substring-based acceptance.
- Existing operator screenshot: compact composer with visible context choices. Retain the current chips and single floating launcher.

## Handoff

Implementation and verification are described below. The exact source revision is recorded by the publication receipt and Git history; no production coverage is claimed.

## Final behavior and decisions

| Operator job | Entry and result | Edge condition |
|---|---|---|
| See what needs a person | Home Board + adjacent team; `Ждут меня` narrows work | Review and unknown stop count as attention; running alone does not |
| Identify who works where | Provider/role, Project, Task, state on each row | Identical provider names stay separately addressed; there is no deduplication by label |
| Resume exact context | Row opens pinned Run and Session; context and task history are adjacent | Inspecting an old session does not change the active-work projection; old attempt cannot be resumed over its successor |
| Enter a Project | Its Board, current work and team are first; sources below | Other Projects do not leak into its roster; related sources stay contextual references |
| Accept or return a result | Run → exact result discussion → proposal → explicit decision | Accepted result leaves attention; rework preserves original result, creates a separate task and moves resolved review to History |
| Reply to Fabric | Text, card and reviewed dictation normalize to one addressed command | Generic assent is distinct from task/review/rework/stop action labels; mismatched action has no effect |
| Refine or decline | Question retains proposal; refinement creates a new version; decline removes proposal | Board topic remains; saved effects are never silently undone; stale/repeated acceptance creates no duplicate |
| Select destination | Exact project name or visible choice | Several candidates or no proposal means clarification, never default-project execution |
| No current work | Clear empty state and `Поручить работу Fabric` / project planning shortcut | Planned tasks are not reported as completed or as running agents |

Visual roles: Board titles identify decisions; task titles identify work; provider/state are compact metadata. Green = running; amber = review/stopping; danger = unknown stop; muted = stopped/history. Labels remain visible independently of color. Proposal header carries Project/version, body carries result/criteria, footer carries one primary action and `Не сейчас`. Existing font/token layer and launcher retained; no added settings controls. Copy was checked for short action verbs and explicit outcomes; no public marketing claims added.

The roster is an actionable projection of current task executions, not yet a full Agent directory. Fixture Agent references survive continuation, but real role, provider revision, membership and authority must come from canonical producers. R0 retains one unsettled execution per Project and concurrent work across Projects. No claim of arbitrary parallel execution inside one Project or an unlimited-team performance measurement.

## Native architecture and bounded next tasks

Shared contract for every packet: [ADR-0067](../adr/0067-conversation-context-and-typed-chat-widgets.md), [agent-first contract](agent-first-contract.md), [conversation workspace](chat-workspace.md), CONTEXT Agent/Provider/Run/Session definitions. Keep canonical storage and command authority in the native layer. Do not promote the prototype arrays, generated Agent refs or grammar to runtime implementations.

**Exact next task — CW-N1 / FR-A: persist conversation and object identity.**
- Inputs: conversation owner, Project/Task/Agent/Run/Session refs, immutable sent context and typed attachments. Define IDs and membership from the canonical producers before adding a UI store.
- Output: one conversation lookup per owner/source, persistent draft/history, immutable message snapshots, source links. Preserve role/provider separation; losing a provider does not lose the Project or discussion.
- Acceptance: cold restart; two entries opening the same source; concurrent/double submit; renamed/missing/denied source; permission revoked mid-conversation; source changes between draft and send; repeated continuation with old sessions intact. No credentials or hidden reasoning in persisted transcript. Persist reviewed voice transcript plus origin/attribution, not secret raw payloads.

**TEAM-N1: observation projection and exact navigation.** Depends on canonical Agent bindings and Run observations, independently of broad workflow editing.
- Read model: `AgentRef → project/role/providerRevision`, `TaskRef → currentRun`, Run/session status and `observedAt`, open review obligations and continuation edges. Membership changes and provider swaps are separate events.
- Output: Home Estate projection, Project projection, exact work destination and history. Status precedence uses open obligations and receipts, not the last viewed Run. Partial/stale/denied are separate read states; missing observation never means idle or completed. Last observation time appears in details; stale source signals on the row before resumption.
- Acceptance: same provider across Projects; two tasks with different current attempts; continuation closes predecessor row; old attempt still inspectable; accepted/reworked review clears attention; stale/missing/out-of-order observation; loss of permission; sorted attention with stable ordering and keyboard focus during updates; no data from another Estate. Define pagination/windowing from real volume measurements before expanding team scale.

**CW-N3 / FR-F: shared intent and command gateway.** Depends on CW-N1 and the target command handlers; the model proposes an intent, never bypasses validation.
- Envelope: `conversationId, messageId, inputChannel, proposalId, proposalVersion, ownerProjectId, verb, objectRefs, expectedRevision, idempotencyKey`. A reviewed transcript, a button and typed text reach this same path.
- Resolver handles dialogue/clarification separately from effects. Pin the visible proposal version; after a new proposal, old actions expire. Generic “yes” can refer only to one unambiguous current proposal. Specific action labels must match its kind. Multiple targets require explicit resolution.
- Gates: membership/access, object existence, expected revision, command-specific authority, input sanitization, effect idempotency. Receipt links command, message, Task and Project timeline. Unknown result queries the original command before retry. Starting a Task is a separate command from adding it to a plan.
- Acceptance: all three input channels produce the same canonical effect and receipt; questions/negative/mixed intent never apply; contradictory action names; two pending choices; attachments/context changed after proposal; stale/double click; timeout before/after commit; duplicate callback; lost permission; no token/secret leakage in errors or logs. Use semantic evals for the native resolver in addition to handler tests.

**VIS-N1: native operator shell.** Bind the proven views to TEAM-N1 and CW-N1/N3. Keep Board first, team visible immediately, compact return, context on demand. Acceptance uses real native keyboard/focus, reduced motion, light/dark contrast measurement, long localized names, screen-reader labels, large team lists, and window resizing. Browser fixture geometry below is not native or WCAG certification.

## Findings reviewed and corrected

Independent read-only reviewer `operator_dashboard_review` identified missing team inventory, wrong default-provider display, selected-vs-active Run confusion, review status remaining after acceptance, text/button divergence, missing proposal versions, rework falsely remaining in attention and cross-command acceptance. Corrections have named regression tests in [operator-workspace.test.mjs](../../scripts/test/operator-workspace.test.mjs). Final bounded re-review: 57 focused tests passed; no additional direct regression in the two final corrections. No subordinate edits or pending member branch.

Implementation: [team-workspace.mjs](../../scripts/product/team-workspace.mjs) (`teamRunState`, `teamWorkRows`, roster renderer); [conversation-intent.mjs](../../scripts/product/conversation-intent.mjs) (bounded fixture intents); [first-release.mjs](../../scripts/product/first-release.mjs) (`outcomeTarget`, common outcome handlers, exact `open-run`, Home/Project/Work); [chat-workspace.mjs](../../scripts/product/chat-workspace.mjs) (active observation snapshot). Bundle list includes the new modules.

## Checks actually run

- `node --test scripts/test/first-release.test.mjs scripts/test/chat-workspace.test.mjs scripts/test/operator-workspace.test.mjs`: **57 passed, 0 failed**. Includes text/button/dictation parity, version rejection, question/decline/refine, wrong-command rejection, multi-project choice, old/current Run distinction, accepted/rework projection and continuation identity.
- Broader focused run adding `folder-picker.test.mjs`, `adoption-*.test.mjs`, `product-*.test.mjs`: **255 passed, 0 failed** (2026-09-26).
- CUA browser: populated two-project Home; attention filter; Project membership; exact Codex/orbit task/session destination; question retains proposal; typed `Да` accepts; typed `Не сейчас` declines; new proposal accepted by button; Enter submits; accepted review clears Project attention and checkpoint agrees.
- 390 × 844 viewport: document scroll width **390 px**, composer **109.03 px**, Send right edge **364 px**, bottom **742 px**. Chat actions remain visible; Project also has no horizontal overflow. Override reset after check. Desktop captures at 1280 × 720 show Board and both work rows in the first viewport.
- Visual artifacts: [before](../reports/previews/operator-before.png), [Home](../reports/previews/operator-home.png), [Project](../reports/previews/operator-project.png), [conversation](../reports/previews/operator-dialogue.png), [narrow conversation](../reports/previews/operator-mobile.png). Locale Russian, dark theme, CUA browser capture of the generated target, CSS has no new animation. Final artifact/source hashes are in `docs/reports/previews/operator-captures.json`.
- Not run: real microphone/filesystem/provider/process operations, native persistence, assistive-technology certification, hosted CI/full stack suite. CO-168 remains open.

Actual skills: super-ux — scenario/flow/screen alignment; sheleg-design — task-based layout and visual hierarchy using the existing tokens; copywriting — consistent visible verbs and state text; task-pipeline — bounded delivery and independent review; agent-sync — live lease for guarded documentation; maintaining-fabric-workspace — canonical report builds and publication. No extra plugin installed. Router source: repository `AGENTS.md`; design references were read from the installed sheleg-design skill, plus Carbon and HAX above.

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

Gallery: all **97** model routes recaptured via CUA on the final generated source at 1240 × 820; `node scripts/build-mockup-previews.mjs --check` passes with actual HTML/model digests. This is route coverage, not exhaustive state coverage. Documentation gate found the previous long apply label in the brand string registry; updated its canonical entry to `Добавить задачу` and registered the new roster/decline labels.

Coordination: ADR-0067 as-built refinement was recorded. Reconciliation still reports inherited unmatched ADR/CO entries (26 ADRs and 112 COs after baseline, plus unevaluated pre-baseline entries); this iteration does not mark those built. Source handoff stays on `codex/context-audit-2026-09-14`, not merged. The source commit message records the completed local fast gate; workspace publication subsequently reruns gates on exact committed source and pin. The publication receipt is the authority for release and child revision.

Fast-gate retry note: the initial unbounded-worker run reported a 5-second failure in the existing native `EstateAgents.reads.test.tsx` case “keeps a history that resolved when the repositories failed”; the remaining run was stopped. No native test/source or timeout was changed. Retry uses Vitest's supported `VITEST_MAX_WORKERS=2` setting (installed runner `coverage.DM_a_rWm.js` resolves this environment variable), first for that file and then for the full fast gate. Only the completed retry can count as passing; final result is in the source commit receipt.

Focused native retry completed: `VITEST_MAX_WORKERS=2 pnpm --filter @fabric/desktop exec vitest run src/renderer/src/EstateAgents.reads.test.tsx` — **23 passed, 0 failed**, 9.20 s total. This is the unchanged existing test file, distinct from the 255 prototype/adoption tests above.
