# Final delivery review — 2026-09-07

Read-only review of the target product report, not a product-runtime audit. Scope: route identity, fixture isolation, authored form data and claims. Two remaining P2 findings; no new P1 found. The provider-change `admitted` reset at `scripts/product/controller.js:87` is present and is not reported as an unresolved defect.

## P2 — Custom project inherits Atlas identity and history

**Evidence:** `scripts/product/controller.js:145` sets `state.created=true` without a new identity. `scripts/product/renderers.mjs:42–43` therefore keeps fixture project Atlas and changes only its display name; `:97` exposes ordinary Plan/History/Memory links. The project guard at `:65` excludes non-Atlas IDs but cannot distinguish this custom draft. `:145–153` then renders the Atlas graph and memory. `controller.js:88` only clears draft state when the project ID changes; an explicit Atlas link still has the same ID.

**Read-only reproduction:** import `renderProduct`, load the JSON model/fixtures, pass `{project:'atlas',state:'ready',run:'2',created:true,draft:{name:'Custom project',purpose:'Other result',repo:''}}`. Project title is `Custom project`; Plan title becomes `План проекта Atlas` and includes AT-42; Context pack includes `Atlas / AT-42`. The application chrome continues to name the custom draft. This can be reached with visible project subnavigation, without editing the URL.

**Required correction:** custom draft gets a distinct prototype identity, or a centralized created-draft guard yields its own empty/summary views and an explicitly labelled switch to Atlas that clears custom draft/task state even when the old underlying ID was Atlas. A new custom task must not inherit Atlas default goal, checked provider, historical pack or completed run. Preserve the draft until that explicit switch. Acceptance: create a named project with another purpose, visit Plan/Memory/Context/Agents, and confirm no Atlas history or grant is attributed to it; explicit switch shows Atlas and its own scope.

## P2 — First-task form silently discards verification and ownership fields

**Evidence:** `scripts/product/renderers.mjs:103` accepts `task-check`, `task-owner`, `task-goal`, `task-context` as ordinary editable form fields. `scripts/product/controller.js:148` only persists `title` and `result` into `state.taskDraft`. The saved task renderer at `renderers.mjs:106–112` only renders the latter; the entered acceptance criterion, owner and context do not enter the saved task. Form-memory restoration can retain old input visually when reopening the form, but does not make those values properties of the saved task.

**Required correction:** include these values in the fixture task draft and saved-task summary, keeping owner as a candidate rather than an admitted executor. Alternatively explicitly mark such fields as non-saving illustrative content and do not present them as an editable creation contract. Acceptance: enter a distinctive criterion, choose Reviewer or Unassigned, change the parent goal and source; save; the same values are visible in the saved task/context preview and admission remains pending. This is an interactive-prototype fidelity issue, not an assertion that production task persistence loses data.

## Limits and positive checks

No native app, database, real agent or network mutation was run. No files were changed other than this /tmp report. Existing 24 gate fixtures were not repeated. Source review covered controller, shared renderers, builder, product-spec CLI, UX synchronizer and delivery brief. A small pure-render probe checked custom-project transitions; root owns browser/HTML and final build tests.

The fixture/target disclaimers are explicit, the delivery brief does not claim all target states are implemented, and Orbit/Studio plus Q-13 intentionally have their own summary-only branches. Manager provider admission remains distinct from role binding activation; a successful admission display does not claim that manager wake or effect authority has been granted. These intentional limits are not additional defects.


## Delivery integration note

This is the retained independent review at its inspection point; line positions and temporary screenshots above are historical. The maintained final verification is `scripts/test/product-report.browser.cjs` and `browser-check.json` beside this file. Root corrected graph legend geometry and explicit keyboard region, provider admission reset, custom project isolation, preservation of all task-intent fields and added presentation mode. These changes are target-report code only; product findings remain open.
