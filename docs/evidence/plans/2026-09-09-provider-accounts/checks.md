# Design verification receipts · 2026-09-09

- `bash scripts/ci.sh fast` — exit 0; [selected real output](fast-check.txt). 86 Vitest files / 907 tests. Existing brand/design warnings are retained in the receipt; no stack-backed probes were run for this documentation/prototype iteration.
- `node scripts/check-product-model.mjs`, `node scripts/sync-product-ux.mjs --check`, `node scripts/build-product-report.mjs --check`, `node scripts/build-mockup-coverage.mjs --check` — passed in the fast gate. Coverage is registry/fixture consistency, not runtime acceptance.
- `FABRIC_PLAYWRIGHT_MODULE=/tmp/fabric-accounts-browser/node_modules/playwright FABRIC_ACCOUNT_SCREENSHOTS=/tmp/fabric-accounts-visual node scripts/test/product-provider-accounts.browser.cjs` — exit 0; [browser output](browser-check.json). Temporary Playwright dependency, existing Google Chrome in headless mode; all account data fictional.
- `node scripts/check-registers.mjs` — [output](register-check.txt). CO-112 remains open; M199 proposed; no account implementation marked shipped.
- `git diff --check` — exit 0. `node scripts/check-design-map.mjs --refresh` and `node scripts/check-design-map.mjs` — passed after reviewing the new map entry and account contract.

Visual inspection: [accounts, desktop](accounts-desktop.png), [switch, dark](switch-desktop.png), [switch, light](switch-light.png), [switch, mobile](switch-mobile.png). Both views checked at 1440px and 375px with no document overflow. Native select truncation and the existing floating CEO launcher are visible in the mobile screenshot; scrolling exposes the full content. This is not a comprehensive accessibility audit.

No real login, provider refresh, native resume, database migration, external tool replay or account deletion was performed. The account fixtures are illustrative acceptance journeys, not proof of provider support.
