# Checks — current account backlog and auto design

Scope: planning, task contracts, generated reports and synthetic prototype interactions.
No provider authentication, live quota polling, native resume or paid execution was performed.

- `node scripts/check-system-model.mjs` passed: 58 parent task cards, 75 execution nodes and 141 named dependency edges. This verifies task structure/source references, not future acceptance cases.
- `node scripts/test/check-system-model.test.mjs` passed: 17 planted failures, including undeclared additions, removed baseline task, duplicate extension and changed extension requirement. The historical audit is retained unchanged.
- `node scripts/check-product-model.mjs` passed: 89 scenarios, 53 flows, 63 screens, 37 journeys; all new scenarios are draft / Product unobserved.
- `FABRIC_PLAYWRIGHT_MODULE=/tmp/fabric-accounts-browser/node_modules/playwright FABRIC_ACCOUNT_SCREENSHOTS=/tmp/fabric-auto-backlog-visual node scripts/test/product-provider-accounts.browser.cjs` passed against the generated report; [actual output](browser-check.json). Auto remains off until enabled, proceeds without per-switch confirmation, retains fixture history/draft, waits for certified boundary, permits pause and holds excluded/unknown candidates and cooldown.
- Each of the nine parts is read through `node scripts/task-spec.mjs <ID>`; the [receipt](task-spec-check.json) records exit codes and addressed titles.

Visual inspection: [automatic controls](auto-controls.png), [mobile](auto-mobile.png), [light theme](auto-light.png). Existing paperclip tokens/components reused.

- A headless Chromium inspection opened all nine generated system-report deep links and checked visible purpose and acceptance text; [actual output](task-cards-browser.json), [automatic task screenshot](task-auto.png). This is a report-card check, not runtime acceptance.
- `bash scripts/ci.sh fast` passed; [complete output](fast-check.txt). Vitest: 86 files and 907 tests passed; the additional Node checks also passed. Stack-backed full probes were not run.
- `node scripts/check-registers.mjs` passed; [output](register-check.txt). M199 and CO-112 remain open; no runtime implementation is marked shipped.

Publication is verified by the standard publisher after the source commit. Exact source/workspace commit identity and release live in the [parent publication receipt](../../../workspace-receipt.json).
