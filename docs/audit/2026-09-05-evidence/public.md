# Public surface audit — 2026-09-05

Read-only ux-audit supplement · `$HOME/DATA/passioncode-ai.github.io` · HEAD `0a5f69980820604458d6942c21d634d06e9c2618`.

**PARTIAL: source and production delivery verified; two minor contract differences.** Active-development label is explicit. Future runtime capabilities are not public-site defects.

## Receipts

- Tracked tree clean;2 untracked OS metadata files only. No repository mutations.
- `npm run check` exit0:20 locked files,27 exports,7 aliases,12 required files. All20 locked assets match current Fabric canonical assets.
- Static HTML:1 h1,0 executable scripts,12 links,5 fragment links and0 unresolved fragments,2 identical GitHub primary CTAs. Metadata, Organization JSON-LD, skip link, focus styles and reduced-motion CSS exist.
- Production curl:11/11 public URLs200;10/11 exact source hashes. robots.txt is1904B:1836B Cloudflare-managed prefix plus exact68B source.4 nonpublic paths404. www preserves path/query with301.
- Latest8 GitHub checks:8 success,0 failure; includes PR/main, not deployment reliability. Current HEAD [run33742620830](https://github.com/passioncode-ai/passioncode-ai.github.io/actions/runs/33742620830) passed check/build.
- Documented deploy d5c168d→HEAD changes3 documentation files only. Manual Wrangler deployment and unavailable automatic Cloudflare Git connection are accurately documented. Audit did not deploy or rerun local build.
- Parent actual-browser responsive receipt:390px scrollWidth390 and major sections1 column;700px scrollWidth700, Project frame324+324px and other grids2 columns. See docs/audit/2026-09-05-evidence/public-responsive.json.

Python urllib default gets403/error1010 for ordinary assets; default curl and parent browser succeed. This client boundary does not prove general outage or indexing failure.

## Findings and proposed plan

### PUBLIC-01 · minor · Secondary CTA destination differs from SCN-038

SCN-038 step6 promises an in-page repository-map CTA; shipped secondary CTA says See the Project model and targets #project. Both sections exist and the primary GitHub CTA is consistent. Documentation mismatch, not broken link.

Evidence: docs/ux/scenarios.md:949; $HOME/DATA/passioncode-ai.github.io/index.html:73; $HOME/DATA/passioncode-ai.github.io/index.html:181.

Fix: Align SCN-038/FLW-20 to the chosen Project-model discovery path, or deliberately change destination and label together. Prefer documenting current successful path if intent is unchanged.

Map: CO-089 canonical UX reconciliation. Verification: Scenario step, visible label, fragment and target heading agree; same-page anchors resolve.

### PUBLIC-02 · minor · Narrow-screen breakpoint differs from screen contract

SCR-29 requires Project frame one column below720px; CSS retains two between621–719px and collapses at620px. No overflow claim inferred from source. Parent live browser confirms at700px Project frame324+324px, document scrollWidth700; at390px main sections one column, scrollWidth390. This is contract drift without observed overflow.

Evidence: docs/ux/screens.md:530; $HOME/DATA/passioncode-ai.github.io/styles.css:402; $HOME/DATA/passioncode-ai.github.io/styles.css:410; $HOME/DATA/passioncode-ai.github.io/styles.css:429; docs/audit/2026-09-05-evidence/public-responsive.json.

Fix: Use the parent700px reading-order measurement to choose accepted breakpoint; update screen contract or CSS in the same change.

Map: CO-089 canonical UX reconciliation. Verification: Check620,621,700,719,720px; column count, reading order and document scrollWidth match accepted contract.

## Published tree

| File | HTTP | Bytes | Exact source |
|---|---:|---:|---|
| index.html | 200 | 13236 | yes |
| styles.css | 200 | 15164 | yes |
| robots.txt | 200 | 1904 | managed prefix |
| sitemap.xml | 200 | 265 | yes |
| assets/passioncode-mark.svg | 200 | 2975 | yes |
| assets/favicon-64.png | 200 | 5013 | yes |
| assets/icon-256.png | 200 | 40679 | yes |
| assets/icon-1024.png | 200 | 437457 | yes |
| assets/passioncode-social-card.svg | 200 | 4781 | yes |
| assets/passioncode-social-card.png | 200 | 529680 | yes |
| assets/passioncode-social-card.jpg | 200 | 123778 | yes |
| assets/README.md | 404 | 0 | not public |
| brand/LOCK.json | 404 | 0 | not public |
| package.json | 404 | 0 | not public |
| docs/DEPLOYMENT.md | 404 | 0 | not public |

## Evidence boundary

- Cloudflare dashboard/bot/security settings and actual deploy execution not inspected.
- GitHub8-run sample validates checks/builds, not manual-deploy reliability or product telemetry.
- No traffic, conversion, indexing, reader comprehension or product outcome measurement.
- 390/700px responsive geometry directly measured by parent. Full VoiceOver, image-block and reduced-motion behavior are not proved by this source subaudit.

## Reviewed files

- $HOME/DATA/passioncode-ai.github.io/package.json
- $HOME/DATA/passioncode-ai.github.io/README.md
- $HOME/DATA/passioncode-ai.github.io/index.html
- $HOME/DATA/passioncode-ai.github.io/styles.css
- $HOME/DATA/passioncode-ai.github.io/robots.txt
- $HOME/DATA/passioncode-ai.github.io/sitemap.xml
- $HOME/DATA/passioncode-ai.github.io/worker/index.js
- $HOME/DATA/passioncode-ai.github.io/wrangler.json
- $HOME/DATA/passioncode-ai.github.io/scripts/build-site.mjs
- $HOME/DATA/passioncode-ai.github.io/scripts/check-site.mjs
- $HOME/DATA/passioncode-ai.github.io/scripts/check-brand-lock.mjs
- $HOME/DATA/passioncode-ai.github.io/scripts/check-worker.mjs
- $HOME/DATA/passioncode-ai.github.io/brand/LOCK.json
- $HOME/DATA/passioncode-ai.github.io/brand/brand-pack/manifest.json
- $HOME/DATA/passioncode-ai.github.io/.github/workflows/check.yml
- $HOME/DATA/passioncode-ai.github.io/docs/DEPLOYMENT.md
- $HOME/DATA/passioncode-ai.github.io/docs/CUTOVER_RECEIPT.md

Used: ux-audit — SCN-038/SCR-29/FLW-20 source conformance, production/CI receipts and parent responsive measurements. No status or repository changes.
