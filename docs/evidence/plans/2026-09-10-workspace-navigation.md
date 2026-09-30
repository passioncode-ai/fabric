<!-- Dated record of 2026-09-10. Never rewritten to match a later tree. -->

# Fabric workspace — persistent navigation, cache posture and publication rail, 2026-09-10

Run `2026-09-10-workspace-navigation`. Operator request (paraphrased; verbatim wording redacted for
publication on 2026-09-30, ADR-0096): give the wiki proper navigation that persists, because
switching between sections currently breaks everything, and fix the UX and the deploy.

## Source ledger

| Source | Read | What it bound |
|---|---|---|
| `CLAUDE.md`, `~/.claude/CLAUDE.md` | yes | gates before commit; evidence rules; ops autonomy |
| `docs/adr/0048-fabric-workspace-is-a-versioned-private-publication.md` | yes | `content/` is immutable and never edited in the publishing repo; internal facts stay authenticated |
| `workspace/docs/ux/scenarios.md` (SCN-001…005) | yes | SCN-002 step 2 currently *promises* the raw report behaviour this run replaces |
| `workspace/docs/DEPLOYMENT.md` | yes | verification trio: health, anonymous 401, authenticated `/version.json` + release |
| `docs/evidence/retro.md` — standing instructions R-001…R-007, 92 run stamps | yes | R-003, R-006, R-007 bind the test design of this run |
| `docs/evidence/backlog.md` | yes | 29 open rows at entry |
| `docs/evidence/verification.md` | yes | 214 rows at `never` at entry |
| `graphify-out/` | present, stale (2026-09-01) | refreshed at stage 9 |
| obsidian wiki (`~/.obsidian-wiki/config`) | present | stage 9 target |
| Live deployment `wiki.passioncode.ai` | probed | release v49, workspace `fc65c11`, source `8b02055` |

## Measured defects (entry state, all reproduced before any edit)

| # | Defect | Evidence |
|---|---|---|
| D1 | Snapshot `.html` reports are served raw, so the site chrome disappears on the three headline destinations | `server.mjs:96-99`; measured `rail=False top=False theme=False` on `/docs/reports/product.html` and `/docs/reports/map.html` against `True` on `/`, `/library`, `/docs/evidence/backlog.md` |
| D2 | `Cache-Control: private, no-store` on every response, including `/site/*` and the 3.9 MB reports; no `ETag`, no conditional requests | `server.mjs:51`; `curl -sI /site/workspace.css` → `cache-control: private, no-store`, no validator |
| D3 | `no-store` on the document also makes every page ineligible for the back/forward cache, so browser Back — the recovery path SCN-002 step 4 names — re-downloads 3.9 MB | web.dev/articles/bfcache: "when `Cache-Control: no-store` is set on the page resource itself … browsers have chosen not to store the page in bfcache"; measured `product.html` 3 901 773 B in 1.29 s |
| D4 | Opening a document from a filtered library and returning drops the filter and the query | `lib/pages.mjs:54` links to bare `/library` |
| D5 | Theme is applied by a deferred script after first paint, and not at all on report pages | `site/workspace.js:1-15` is loaded only by `layout()` |
| D6 | Publication refuses to run when the parent tree holds any unrelated uncommitted change, although such a change cannot reach the publication | `scripts/workspace.mjs:28-29`; the export reads a committed ref (`workspace-release.mjs:16-24`) and the final commit stages only the pin and the receipt (`scripts/workspace.mjs:59`) |

## Decisions taken in the grill

| Decision | Chosen | Rejected, and why |
|---|---|---|
| How the chrome returns to reports | inject a bar into the served bytes at the same seam that already rewrites links | an iframe would need `frame-src 'self'`, would freeze the address bar on `/` and break every deep link and the Back button |
| Cache posture | `private, no-cache` + strong `ETag` on authorized bodies; `no-store` kept on 401 and error pages | asset-only caching leaves the 3.9 MB reload and the dead bfcache in place |
| Publication rail | narrow the refusal to changes that can actually reach the publication | a separate `deploy-host` verb would leave two publication paths and one receipt |

**Deviation from the approved mockup, recorded rather than silent.** The mockup carried a
theme control in the injected bar. It is not built. Measured reason: the three reports
disagree about what a theme is — `product.html` owns `data-theme="light"`/`"dark"` itself,
`map.html` and `system.html` are driven by `prefers-color-scheme` and ship no light palette.
One control meaning three different things is worse than no control; the site layout keeps
its own toggle.

**Positioning, decided by measurement not preference.** The bar is statically positioned at
the top of the document, not sticky. Every report already owns the top edge with its own
sticky navigation (`map.html` `nav{position:sticky;top:0;z-index:10}`; `system.html` two
sticky rules at `top:0` and `top:100px`; `product.html` seven fixed or sticky rules). A
sticky bar of ours would cover the report's own navigation. Wrapping the report in a scroll
container was considered and rejected: `product.html` calls `window.scroll*` four times and
registers a scroll listener, all of which observe the viewport, not a container.

## REQ table

Frozen. Adding is free; removing needs the operator.

| REQ | What must become true | Verified by |
|---|---|---|
| REQ-01 | Every snapshot `.html` served by the host carries the workspace bar: identity, links to Обзор / Продукт / Система / Библиотека, and the current section marked | host test over the served bytes; browser walk |
| REQ-02 | The bar never covers or displaces a report's own sticky or fixed chrome | planted defect flipping it to sticky, watched failing; browser screenshots at scroll 0 and mid-scroll |
| REQ-03 | Serving never mutates the snapshot on disk | digest compared across requests; `npm run verify:content` green |
| REQ-04 | Authorized bodies carry a strong `ETag` and `private, no-cache`; a matching `If-None-Match` returns 304 with no body and the same validator | host test; `curl` against production |
| REQ-05 | 401 and error responses stay `no-store` and disclose no project data | existing `test/server.test.mjs:39` stays green, extended to error pages |
| REQ-06 | A report page is eligible for the back/forward cache | Chrome DevTools bfcache probe on the deployed site |
| REQ-07 | Opening a document from a filtered library and returning restores that filter and query | host test on the toolbar target; browser walk |
| REQ-08 | The theme is applied before first paint on every page the layout renders | CSP carries the inline script's hash; test asserts the pre-paint script and the absence of a flash path |
| REQ-09 | Publication proceeds when uncommitted parent changes cannot reach it, and still refuses those that can | unit test over the predicate plus a planted defect |
| REQ-10 | `workspace/docs/ux/scenarios.md` describes the new behaviour in the same change | scenario diff |
| REQ-11 | ADR-0055 records the decision; ADR-0048 links it | `bash scripts/check-docs.sh`, `node scripts/check-references.mjs` |
| REQ-12 | The change is live and the live site proves it | `/version.json` matches the receipt; a report fetched from production carries the bar |
| REQ-13 | A report opened without a fragment lands at the top of its own document; a fragment still selects and scrolls to its target | Playwright probe over `system.html` with no fragment, `#data` and `#cycles` |

## REQ-13, added mid-run by the browser, not by the diff

The bar measured `top: -471` on `system.html` while measuring `top: 0` on the other three.
The cause is older than this run: `scripts/templates/system-map.html` built its route from
`location.hash.slice(1) || 'system'` and then scrolled that id into view unconditionally, so
**the System report has always opened 425 px down**, past its own title — measured on the
untouched file at `file:///…/docs/reports/system.html`, `scrollY = 425` with scripts on and
`0` with scripts off, and traced to `system.html:429` by instrumenting `scrollIntoView`.
Landing mid-document with no header is a large part of what "switching sections breaks
everything" describes. The fix scrolls only for a fragment the reader actually named.

## Carry-over

| id | Item | State |
|---|---|---|
| CO-162 | reserved for this run | open |
| CO-163 | reserved for this run | open |
