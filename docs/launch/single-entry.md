# Fabric: one chat entry · 2026-09-26

<sub>ssheleg skills — task-pipeline · super-ux · sheleg-design · copywriting · agent-sync · maintaining-fabric-workspace</sub>

## Scope and accepted brief

Operator request: move CEO identity/persona controls to Settings; the avatar opens chat directly; make tasks, plans and insights discussable with their context and continuation. This refines ADR-0067 and SCN-042, not the Project ownership or command authority model. Target prototype only. The existing CO-168 native gap remains open.

Work order: single entry and Settings → typed contextual discussion → repeat discussion and result isolation → scenario/model propagation → independent review and browser acceptance → generated gallery, local gates, source Git and wiki publication. Existing task branch is retained. The bounded renderer change was implemented inline; independent read-only review covers the complete affected behavior.

## Components and acceptance

| Surface | Primary interaction | Retained state / negative case |
|---|---|---|
| Floating avatar | One button opens chat or focuses its composer | No profile intermediate step, adjacent button or hidden settings popup. Minimize/Escape stays inside chat; reopen retains the conversation |
| First welcome | Connect executor | Name/appearance no longer delay first useful result |
| Settings | Name, three avatar choices, three response styles; executor and scope | Existing colors/type tokens. Example statistics remain; preferences are page-local until native persistence |
| Task title / active work | Open exact task discussion | Owner, task ID, current state, criteria and Run ref included; no launch or acceptance on open; missing task refuses without fallback |
| Project insight | Discuss the overview | Project/source reference retained, distinct from Plan discussion |
| Plan | Discuss next step | Reuses conversation, transcript and draft; does not create duplicate questions when reopened |
| Accepted discussion | Continue in the same chat | Previous outcome remains immutable in history; new proposal needs explicit apply; task next-step action creates a new task, does not silently rewrite original work |
| Multiple results | Review each exact task | Several tasks from one conversation have independent review targets; result discussion takes precedence over generic task discussion |

Shared anatomy: one colored avatar at lower right; one floating right conversation; static header identity, history/new/minimize; compact bottom composer and context chips. No new palette, fonts, animation or nested navigation. Task titles are underlined buttons with hover and keyboard focus styling. Settings uses visible small option sets. Context inspector exposes the discussion subject without another permanent toolbar.

Opening a discussion adds its Board-backed conversation if none exists; it does not mutate Task/Run state. Existing context choices and attachments remain attached when returning. A new message resolves the current subject while previously sent snapshots remain immutable. Command execution continues through the existing explicit apply/run boundary; prototype keyword responses are not a production agent.

## Contract and native task packet

Inputs: ADR-0067; [conversation workspace](chat-workspace.md); SCN-042 / FLW-24 and first-launch FLW-55; SCR-31/32/36/40/44/52; `first_release.conversation_workspace` in `docs/ux/product-model.json`.

References: `{kind: task|plan|insight|question, id, project, title, revision}`; Task material additionally has current state, criteria and Run ref. New messages snapshot resolved material. Persisted identity must use stable object IDs, never display titles. Additional Projects remain references, not implicit write destinations. Multiple outcomes must never share one mutable result target.

Exact next native task: **CW-N1 / FR-A** from chat-workspace.md. Bind canonical conversation and Project producers to persistent draft/history and typed object refs. Add a unique conversation lookup by owner/source, enforce access and source resolution before materializing a new snapshot, retain immutable sent snapshots and separately addressed result reviews. Readiness requires cold restart, concurrent entry/double-click, renamed/missing/denied source, changed Task state, multiple results, permission loss and reopen tests against real handlers. Follow-on CW-N2/FR-C context compiler and CW-N3/FR-F widget commands consume the same refs. Do not promote page-local fixture arrays or the intent regex into production. No hidden reasoning or credential logging.

## Evidence and handoff

Implementation: `scripts/product/first-release.mjs` (`discuss`, `deliver`, `send`, Settings and launcher); `scripts/product/chat-workspace.mjs` (`chatSubjectSnapshot`, message snapshots and context inspector); shared style in `first-release.css`.

Named regression tests in `scripts/test/first-release.test.mjs` cover: one avatar/Settings-only controls; source owner and draft preservation; independent Plan/insight sessions; missing source refusal; repeated applied outcomes; all task states reachable; separately reviewable results; live subject state with immutable previous snapshots. Focused first-release + chat-workspace run: **48 passed, 0 failed** (2026-09-26).

Independent reviewer `single_entry_review` found three P2s: multiple outcomes overwrote one review target; resumed chats sent stale task state; opening a result replaced the originating conversation routing identity. All were reproduced and corrected with named regressions. No subordinate edits or pending member branch. Broader/browser/repository receipts follow below after execution.

Durable entry: this document. Source baseline is commit `19134f385acb0c7f88002517113d988f6dbfa2a2`; this iteration remains on `codex/context-audit-2026-09-14`. Publication receipt/gitlink will identify the exact committed snapshot. Not a merge, runtime release or native coverage claim.

Actual skills: super-ux — scenario/flow/screen alignment; sheleg-design — existing visual tokens and component hierarchy; copywriting — short entry/action labels; task-pipeline — bounded implementation, independent review, checks and handoff; agent-sync — live coordination lease; maintaining-fabric-workspace — canonical builds and wiki publication. No extra plugin installed.

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

### Verification receipts

- Broader focused run: `node --test scripts/test/chat-workspace.test.mjs scripts/test/first-release.test.mjs scripts/test/folder-picker.test.mjs scripts/test/adoption-*.test.mjs scripts/test/product-*.test.mjs` — **246 passed, 0 failed**.
- CUA browser: avatar opens and focuses composer; task title opens exact owner/subject; typed draft survives minimize/reopen; Enter produces next-step proposal; Settings reached via More, appearance and style selected; Project insight opens distinct discussion and context inspector. Final generated build reloaded before final artifact capture.
- Final DOM geometry: active product screen has exactly one launcher button; panel 608 px, transcript 413.74 px, composer 109.03 px at 1280 × 720. At 390 × 844, document width 390 px, send right edge 364 px and bottom 742 px; composer remains 109.03 px. Viewport override reset. These are geometry/interaction checks, not complete assistive-technology certification.
- [Final screenshot](../reports/previews/single-entry-review.png). All 97 model routes captured through CUA at 1240 × 820; converted to 620 px JPEG previews; manifest hashes the actual HTML/model. Gallery route coverage does not prove all scenario states.
- Independent focused re-review: original three findings fixed; plan, insight and task-originated conversations preserve their route/draft while resolving exact pending results. No remaining finding in that bounded review.
- Not run: native microphone/filesystem/provider operations, production persistence, hosted CI or full stack probes. Native acceptance remains CW-N1 / CO-168, as described above.

Documentation follow-up: Settings corrected to SCR-52. The pre-publication attempt was stopped during parent gates before any child mutation. Regenerated HTML differs from ae3c72c only in the 64-character source fingerprint (normalized full-file equality asserted). A second gallery capture refreshed 86 routes, then CUA timed out. The remaining 11 R0 screenshots retain the already checked, identical renderer bytes; the hidden report fingerprint does not change those screens. All 97 preview files remain present. Browser checks above apply to the unchanged renderer, not a new runtime version. No publication was claimed for the interrupted attempt.

Repository receipts: `bash scripts/ci.sh fast` exited 0 for ae3c72c's source tree, and the documentation follow-up reruns that gate before commit/publication. Fresh GitHub clone of ae3c72c: 48 focused tests passed and generated report parity passed. Agent-sync record for ADR-0067 succeeded; reconcile exits 1 for inherited unmatched ADR/CO records, not a claim those native gaps are implemented. Exact next work remains CW-N1 above.
