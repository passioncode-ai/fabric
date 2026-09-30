# AD03 — one target creation journey

<sub>ssheleg skills — task-pipeline · agent-sync · super-ux · copywriting · maintaining-fabric-workspace</sub>

Objective: make each first-project entry reach the same addressed draft, review and Project result. Input receipt commit: [e26a4eeeabecfef7c97cdefabd76fa83def8a7d0](https://github.com/passioncode-ai/fabric/commit/e26a4eeeabecfef7c97cdefabd76fa83def8a7d0), containing passed [AD00](../receipts/AD00.json) and [AD01](../receipts/AD01.json). Architecture: [ADR-0061](../../../adr/0061-project-setup-precedes-managed-activation.md). This is the report's page-local target implementation; native creation is AD04.

## Target and scope

- One creation authority in `scripts/product/new-project.mjs`. `onboarding` remains a supported alias of `launch-start`; old links do not create a separate state store.
- Source → purpose/expected result → reviewed payload. Executor, starter, software stages and observer scope are optional details. Saving does not admit an agent, activate PM, issue a grant or enable a cycle.
- Resolve Estate before draft hydration. Global add, empty Estate, persona save/skip and Help resume converge by Estate/draft identity. Another draft is an explicit action; discard is addressed to it alone.
- An idea excludes the old repository before duplicate lookup, review and commit. Switching back may recover the typed path. Active/archived duplicate handling uses only the selected Estate and effective source.
- Reviewed/pending payload is immutable. Editing invalidates review; a changed retry cannot report that its new fields were saved under an old command. Unknown response retains the original identity and payload for reconciliation.
- Existing project help resumes the Project; creating an example cannot borrow Atlas work/history. Page-local data after reload is not presented as durable native data.

Exact product files: `new-project.mjs`, `guided.mjs`, `controller.js`, `workbench.mjs` under `scripts/product/`; `guided.css` only for three-step narrow-screen composition; `launch.mjs` updates the existing screen-map label from four stages to three. Tests own their explicit create/alias/controller regressions. The two existing browser suites are migrated with preserved original scenarios, but not claimed executed. The guarded mockup resolution matrix is rebound after source review; historical browser receipts stay historical. Canonical SCN-031/FLW-18/SCR-27, visual model, report and previews are integrated by the parent. Composition review expands the exact write set to `scripts/product/operations.mjs::registerOperationsProject`: deferred executor selection must create no fictional `later` provider, binding or session. Explicit chosen candidates remain unverified; cycles start paused. An actual controller-bridge regression exercises both registration adapters. Native IPC/storage/provider files are outside this packet.

## Required acceptance matrix

| Case | Required observable outcome |
|---|---|
| Global add, both empty Estate entries, persona save/skip, CEO entry, old URL | Same creation state and three stages; no mandatory avatar/provider/account setup |
| Help while editing, two drafts, two Estates | Exact draft content and step return; no cross-Estate hydration |
| Repository → idea with active/archived duplicate | Effective source none; valid idea reaches review/create; switching back restores real duplicate handling |
| Advanced software/observer | Optional fields survive the same review; observer target/future consent explicit; cycles paused |
| Edit after review, repeated click, changed replay | Review invalidated or old result stated accurately; no second Project or silent changed-payload success |
| Unknown after actual fixture creation, malformed callback, exception | Frozen original request survives; explicit reconciliation returns one result |
| Denied/loading/partial/stale/conflict/read-only | No mutation; input retained and usable recovery shown |
| Folder denied/partial/cancelled/empty | No implicit import/create; explicit candidate choice/manual fallback |
| Reload and expired own example | Honest page-local expiration; no foreign fixture substituted |
| Narrow viewport, keyboard and focus | Three steps readable, one primary action, optional details reachable, focus visible and predictable |

## Evidence and limits

- `node --test scripts/test/adoption-creation.test.mjs scripts/test/ceo-onboarding.test.mjs scripts/test/calm-*.test.mjs`: 43/43 passed after integration and independent review.
- `scripts/test/adoption-creation.test.mjs` covers archived-repository → idea normalization and exact draftId Help resume through exported handlers/renderers. The immutable baseline is the input commit above; current assertions are executable in a fresh checkout.
- Independent review found and resolved two additional defects: existing-project Help could resume an unrelated new Project, and folder manual fallback omitted its required path input. New regressions assert explicit project/draft links and complete manual source → review → create.
- `node --check scripts/test/product-workbench.browser.cjs` and `node --check scripts/test/product-report.browser.cjs`: syntax only; browser execution remains pending. Original literal check names/policy loops and report receipt kinds are retained; source alias/Help path added.
- `node --test scripts/test/adoption-*.test.mjs`: 61/61 passed (contract/plan validators and creation regressions). The first broader `product-*.test.mjs` run passed 130/131; its only failure was stale symbol citations, corrected through independent source re-review of the guarded resolution matrix rather than bypassing the gate. Final rerun: 131/131 passed. The reviewed matrix preserves all 105 row identities/dispositions and historical browser receipt objects; 372 current source anchors/hashes resolve. `bash scripts/ci.sh fast` completed with exit 0, “fast tier green”; stack-backed full probes were not run.
- Product/adoption reports and 85 preview artifacts regenerated through the repository builders. The generated first-source screenshot was inspected as a static artifact; no click, focus or keyboard outcome is inferred. The adoption report adds current implementation status while preserving the original plan and historical evidence.
- Brand lint: 0 errors, 753 existing/new coverage warnings; UX lint: 0 errors, 1 inherited vision-rule warning. Product model and source-binding checks pass; source-only capability readiness remains six partial, two missing, zero ready.

 A fresh remote clone of the input commit also passed `check-adoption-bindings.mjs`; final delivered source is checked again after push.

Actual-handler tests, VM execution of the controller's routing prefix and artifact generation are not a browser click/keyboard or native acceptance claim.

Native acceptance of AD02 remains blocked by macOS Computer Use Accessibility/Screen Recording permissions (two observed tool refusals). Local map browser opening was also rejected by the browser URL policy; no alternative browser or indirect URL is used to bypass it. Browser interaction and native checks are therefore not marked passed. An AD03 passed output must not be produced until its remaining prototype checks are actually exercised.

## Handoff and next task

First complete the named AD03 UI cases in an authorized browser and AD02's isolated Electron fixture checks after Computer Use permissions are available. Rebuild the desktop before preparing fresh native fixtures. Preserve all four drafts across Electron quit/restart, then verify empty-install save, delayed hydration and repeated corrupted-file reads. Use `apps/desktop/test/adoption-native-harness.mjs`; never import production main or use the operator's userData to make this test pass.

Only passed native AD02 + passed prototype AD03 + source AD01 permit AD04 dispatch. AD04 then binds an immutable create command/payload identity, transactional outcome and attachment partial/recovery semantics. Native conversation, voice and measured human return value remain downstream; CO-167 retains the open work. No member repository changes.

Rollback the target creation authority and its alias callers together; preserve old view IDs. Do not delete native Projects/drafts. All fixture effects stay page-local.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

Task-pipeline: bounded implementation and independent review. Agent-sync: claims and ADR allocation. Super-ux: scenario/flow/screen propagation. Copywriting: existing brand terms and explicit state/result wording. Maintaining-fabric-workspace: source/snapshot publication; this private skill is not a skill the family ships. Design pack measured; no new visual identity or motion layer introduced.
