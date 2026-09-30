# Fabric conversation workspace · 2026-09-26

<sub>ssheleg skills — task-pipeline · super-ux · sheleg-design · copywriting · agent-sync · maintaining-fabric-workspace</sub>

Scope: first-release interactive prototype and target contracts. Operator request is the accepted brief. Existing branch and publication authorization retained. Native Coverage is unchanged.

## Requirements and work order

1. CW-01: context chips none / one / many / all; default open Project, global none. Preserve draft and transcript; scope is knowledge, never authority. Test snapshots and explicit action target.
2. CW-02: compact floating composer and icon-only launcher/minimize, accessible names; transcript dominates. Inspect desktop and narrow viewport, keyboard Enter/Shift+Enter/Escape.
3. CW-03: attachment tray for fixture files and links, remove/cancel/error, sanitize before storage. No native file access or network fetch.
4. CW-04: typed inline widgets: shortcuts, context/plan, destination choice, outcome/action receipt. Unknown/stale actions fail closed; no arbitrary executable model markup.
5. CW-05: typography, buttons and control states share existing brand tokens; small option sets visible, long lists searchable. Preserve profile and ticket ownership.
6. CW-06: propagate scenarios → flows/screens → model → prototype, tests, independent review, map, Git source and private wiki publication.

Sources: SCN-042, FLW-24 (CEO refinement), SCR-44 (chat; SCR-41 is its Board entry), ADR-0065, agent-first-contract.md, brand UI/voice/terminology, scripts/product/first-release.mjs. Vision: keep Project-owned plans/history while reducing operator effort. No new model/vendor runtime. No fresh ontology.

Design rubric: one right floating panel, content-first transcript, context chips above composer, one primary send/action, no decorative animation. Existing brand and fonts retained; no alternate brand needed. Small sets need one click; attachment/large-list controls open only on demand. Initial composer target ≤ 180 px desktop without attachment tray. Type: existing body token for messages/input; caption token for context/status; semibold body for card headings; mono only for code/paths. Icon buttons retain tooltip and accessible name. This is a visual target, not a WCAG certification.

CW-01…05 implemented in the target prototype; CW-06 checks and publication recorded below. Native widget/attachment/context bindings remain under CO-168 / FR-A,C,F,G and require real handler receipts, authorization, pre-persistence filtering, token budgets and persistence checks.

## Component and interaction contract

| Component | Visible by default | Action and recovery |
|---|---|---|
| Launcher | one avatar; no adjacent controls | Opens/focuses chat directly; name, appearance and style live in Settings. Refined by [single entry](single-entry.md) |
| Header | identity + history/new/minimize icons | Tooltips and accessible names. New conversation does not delete old drafts; history includes draft-only entries |
| Context rail | None, up to four Project chips, All, add, info | Toggle in one click without clearing text. More than four Projects: selected chips remain, searchable full list in add tray. Horizontal overflow remains bounded |
| Knowledge index | On request in transcript, not above input | Included plan/decision/source counts and primary/related names; explicit read-only reference meaning. Message snapshot persists old revisions |
| Transcript | User bubbles, assistant text, typed cards | Body token and normal line spacing; status is caption. Long text wraps; user can read older text without every rerender jumping down |
| Composer | One-line textarea, voice and send icons | Grows only to seven rem; Enter sends, Shift+Enter newline, IME Enter does not submit. Empty send disabled unless attachments exist |
| Attachments | Removable chips immediately above input | Tray offers fixture files and HTTP(S) URL. Cancel retains text; invalid/credential-bearing URL gives inline error. Send records refs, clears pending attachments; outcome refinements retain prior evidence |
| Ticket outcome | Summary, next step, criterion and one primary action | Conversation owns discussion, Project owns result. Apply once, start separately, stale revision refuses. Related Projects never become write targets implicitly |

Product body/input and caption use `--app-fs-body` / `--app-fs-caption`, `--app-lh-body`, `--font-body`; title uses existing `--fs-card-title`. Existing Paperclip semantic colors, spacing ladder and radii remain. Monospace is reserved for technical paths/code. No new decorative motion, fonts, brand palette or dependency added. Source: `scripts/product/first-release.css`, conversation workspace section.

## Widget system

The native interface accepts a closed union of versioned widget data. A renderer owns layout and controls; the model provides validated data and proposes actions. No script, arbitrary HTML, direct handler name or permission can arrive from message content. Unknown type/version renders readable text with an unsupported notice and no executable control.

| Kind | Content | Prototype today | Native binding / checks |
|---|---|---|---|
| Quick prompt | Three relevant next questions | Initial shortcuts; empty draft sends, existing draft is preserved and extended | Contextual suggestions from approved capabilities; never execute privileged effects on suggestion display |
| Context index | Project/plan/decision/source references | Selected Project snapshots and linked-source index | Policy-filtered reads, freshness and unavailable source states; no bulk inclusion of whole repository/history |
| Plan preview | Goal and next tasks | Compact first three task rows + open-plan action | Canonical plan query with remaining count/cursor, immutable response revision |
| Destination choice | Eligible Project buttons | One-click explicit target, original request retained | Context selection grants no authority; target and source revisions validated before effect |
| Task outcome | Intent, criterion, resulting task | Ticket discussion → accept → task → run → result | Existing command handler/idempotency/receipt, no second task store |
| Run action | Bound target and Stop | Command pins observed Run ID; changed run refuses | Request vs observed stop, unknown/reconcile and retry same command; real provider evidence |
| Attachment | Name, type, status, remove | Example files and unfetched HTTP(S) references | OS chooser, size/type/permission limits, cancellation; scan before persistence/model inclusion; retained ref lifecycle |
| Question / grant | Small choices and consequences | Existing ticket outcome surface; no new native permission feature | Use canonical Question/grant contract; never treat chat sentiment or selected context as grant |
| Execution / receipt | pending, running, succeeded, failed, unknown | Existing fixture run/outcome status; no real streaming | Subscribe to canonical events; unknown retains command ID; retry cannot duplicate effects |

Native minimum envelope: `widget_id`, `type`, `version`, `conversation_id`, `message_id`, data/source references, `revision`, allowed action descriptors and receipt reference. Action descriptors carry bound resource IDs and operation intent; server-side handler resolves authority. Render states: proposed → checking → admitted/running → succeeded/failed/rejected/unknown. `stale` offers refresh; `unknown` offers reconciliation of the same command, not a new attempt. Accessibility names, keyboard order, structured copy and fallback text are renderer responsibilities.

## Context lifecycle and cost

Conversation identity, context selection and command destination are distinct. Starting inside a Project preselects that Project; global starts with none. A minimized existing conversation resumes unchanged. All means the explicit current Project ID set; later additions do not silently expand it. A ticket keeps its owner mandatory while reference Projects are optional.

Plans/decisions/main and related sources are included as a bounded index. Each sent message retains the exact selected IDs/revisions and attachments; later chip changes do not rewrite it. A Project change forces a fresh command proposal when its revision is stale. Stop additionally pins the observed Run ID. Accepted task context retains relevant discussion evidence across criterion refinements. Removing context affects future material selection; previously discussed information is still in conversation history. New conversation starts without that history.

Native context assembly must apply visibility, relevance and token budget before model dispatch: instructions + current request + compact referenced state + relevant recent excerpts; fetch older details by reference. Usage counts are numeric events, not repeated transcript dumps. Secrets, auth headers and private keys never enter the journal or model input; content classification/redaction and retention run before persistence. The fixture regex and URL checks cover known examples only, not arbitrary secrets. No hidden reasoning is requested or logged. Voice text follows the same attributed message path; raw audio retention must be separately specified.

## Native implementation packets (CO-168 remains open)

| Packet | Inputs / dependencies | Deliverable | Required negative checks |
|---|---|---|---|
| CW-N1 / FR-A | Existing conversation/Project identity and ADR-0067 | Persist draft, history, context selection and immutable message snapshot with versioned refs | Restart before send; draft-only history; switching Projects; denied history access; no silent scope expansion |
| CW-N2 / FR-C | N1, canonical Project plan/source readers and policy | Bounded context compiler for primary/related sources, plans and decisions | Missing/revoked/partial source; stale revision; token budget; references cannot widen write scope |
| CW-N3 / FR-F | N1/N2, existing command handlers and receipts | Typed widget renderer/actions with object-bound IDs and idempotent commands | Unknown widget/version, malicious markup, forged target, old Stop after replacement, double click, unknown result and reconnect |
| CW-N4 / FR-G | N1/N2, native chooser and sanitization | Attachments and dictated text attribution, cancel/remove/retention | Unreadable/oversized file, unsafe URL, secret before any log/model request, cancelled selection, audio consent/retention |

Exact next work: bind CW-N1 to existing canonical conversation/Project producers and define persisted snapshot/attachment references; do not promote the in-memory arrays or regex intent parser into production. Each packet must show actual handler/read receipts and cold-restart evidence before updating native Coverage. Renderer-only tests cannot close those requirements.


## Review, receipts and handoff

Independent read-only reviewer `chat_workspace_review` found four P2 defects: old Stop could affect a replacement Run, criterion refinement lost attachments, draft-only conversations were unreachable, and encoded/fragment token parameters bypassed the fixture URL check. Each was corrected and has a named regression in `scripts/test/chat-workspace.test.mjs`. Generic “Create task” now asks for intent before proposing an outcome; it cannot create a meaningless task by itself.

Observed checks (2026-09-26):

- `node --test scripts/test/chat-workspace.test.mjs scripts/test/first-release.test.mjs scripts/test/folder-picker.test.mjs scripts/test/adoption-*.test.mjs scripts/test/product-*.test.mjs`: **239 passed, 0 failed**.
- Browser through CUA: one-click context toggle and prompt; inline plan; attachment/link chips; Shift+Enter newline then Enter send; draft-only history; Escape/reopen; second Project → All → explicit Website task destination. Final artifact reloaded after the last code change.
- Desktop DOM measurement at 1280 × 720: panel 608 px high, composer 109.03 px, transcript 413.74 px; input 14.4 px, Inter/system stack. Narrow viewport 390 × 844: document width 390 px, composer 109.03 px, send control within viewport. Temporary viewport reset. These are observed geometry and interaction checks, not full accessibility conformance.
- [Final screenshot](../reports/previews/chat-workspace-review.png) shows the plan widget in the current build. Native microphone, upload, screen-reader, model response and persistence acceptance were not run.
- Gallery regenerated by CUA from all 97 model routes at 1240 × 820; screenshots converted to 620 px JPEGs with `sips`, manifest pins the actual generated HTML/model digests. This uses the same built artifact; default gallery route states are not proof that all user scenarios passed. `node scripts/build-mockup-previews.mjs --check` verifies manifest coverage.

No subordinate edits or member branches are pending. The existing native gap is CO-168; the precise next task is CW-N1 above, within FR-A. Do not reconstruct implementation from this chat. Source facts: this document, SCN-042/FLW-24, ADR-0067, `chat-workspace.mjs` and its tests. The publication receipt and workspace gitlink identify the published source snapshot. A pushed branch is not a merge or product runtime release.

Actual skills: task-pipeline — scoped brief, checks, independent review and delivery; super-ux — scenario/flow/screen propagation; sheleg-design — retained brand tokens, component anatomy and type hierarchy; copywriting — short controls, own humanization pass removing repeated instructions; agent-sync — lease, ADR reservations and record; maintaining-fabric-workspace — generated views and verified source/wiki publication. No new design, browser or accessibility plugin installed. Accessibility scope is the listed keyboard and geometry checks only.

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

Final repository checks: `bash scripts/ci.sh fast` exited 0; full/stack-backed probes and hosted CI were not run. `git diff --check` passed. Design-map check: 1665 source files, 278 anchors, 956 link targets. The initial checks caught stale generated completeness/preview outputs and one blank line splitting the ADR table; outputs and table were repaired before the passing run. Coordination record for ADR-0067 succeeded. `reconcile` still exits 1 for historical unmatched ADR/CO records; this iteration does not claim that inherited backlog implemented or the entire external mirror reconciled.
