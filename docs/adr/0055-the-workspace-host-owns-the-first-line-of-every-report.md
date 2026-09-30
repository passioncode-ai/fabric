# ADR-0055: The workspace host owns the first line of every report, and authorized bodies revalidate

- **Status:** accepted
- **Date:** 2026-09-10
- **Source:** operator report — switching between sections on `wiki.passioncode.ai` loses the
  site; run `2026-09-10-workspace-navigation`.

## Context

[ADR-0048](0048-fabric-workspace-is-a-versioned-private-publication.md) made `content/` an
immutable snapshot the publishing repository never edits, and gave the host its own
navigation. The host then served the three destinations that navigation points at —
`product.html`, `system.html`, `map.html` — as raw snapshot bytes with only their links
rewritten. Measured: `rail=False top=False theme=False` on those addresses against `True` on
`/`, `/library` and every `.md` document. Choosing "Продукт" in the rail left the site.

Every response also carried `Cache-Control: private, no-store` with no validator. That is
strictly stronger than the privacy the decision needed, and it cost twice: a 3.9 MB report
was re-transferred on every visit (1.29 s measured against production), and `no-store` on a
document makes the page ineligible for the back/forward cache, so even the Back button —
the recovery path the scenarios name — paid the full transfer again.

## Decision

**The host injects a bar into the served bytes of every snapshot `.html`**, at the same seam
that already rewrites links: one insertion at a source offset, no re-serialization, the
snapshot on disk untouched. The bar renders the section list from `lib/navigation.mjs`, which
is now the single home shared with the rail.

Three constraints follow from what the reports are, and each is measured rather than assumed:

- **It is statically positioned.** Every report already claims the top edge with its own
  sticky navigation (`map.html` `nav{position:sticky;top:0;z-index:10}`; `system.html` at
  `top:0` and `top:100px`; `product.html` seven fixed or sticky rules). A sticky bar of ours
  would cover the report's own controls. Wrapping the report in a scroll container so its
  sticky elements resolve below the bar was considered and rejected: `product.html` calls
  `window.scroll*` four times and registers a scroll listener, all observing the viewport.
- **It carries no script.** The policy for a snapshot document is built from the hashes of
  the inline scripts it already contains; adding one of ours would change the policy of a
  historical document. Markup and a stylesheet leave `htmlPolicy` byte-identical, which is
  asserted rather than described.
- **It carries no theme control.** The reports disagree about what a theme is —
  `product.html` owns `data-theme="light"`/`"dark"`, `map.html` and `system.html` follow
  `prefers-color-scheme` and ship no light palette. The bar adapts to all three; a control
  meaning three different things does not.

**Authorized bodies are stored under `private, no-cache` with a strong `ETag`**, and a
matching `If-None-Match` returns 304. `no-cache` stores the response and refuses to reuse it
unverified, so a stale snapshot is never shown; it also restores back/forward cache
eligibility. **Credential prompts, refusals and error pages keep `no-store`** — they are not
content, and this is asserted for each of them.

**The publication rail refuses what can actually reach a publication, and nothing else.**
The snapshot is exported from a committed ref, and the closing commit stages the pin and the
receipt by name — but `git commit` writes the whole index, so a *staged* unrelated change
rides along while an *unstaged* one cannot. The refusal narrows to the index; work in flight
is reported and published past.

## Consequences / affects

- `workspace/lib/shell.mjs` and `workspace/lib/navigation.mjs` own the injected bar; the rail
  in `lib/pages.mjs` consumes the same list (R-005).
- `workspace/docs/ux/scenarios.md` SCN-001, SCN-002 and SCN-003 changed in the same change.
- A library filter now travels in the document's own address, so returning restores the list
  the reader left, and a shared link restores it too.
- `scripts/templates/system-map.html` no longer scrolls on load without a fragment. The
  System report had opened 425 px down since it was generated; that was found by this run's
  browser check and is not caused by the bar.
- `scripts/workspace-release.mjs` gains `publicationHazards` and `publicationPointerDirty`;
  `completedPublication` now asks about the pin and the receipt rather than the whole tree.
- Ten mechanism-removing plants in `scripts/test/plants-workspace-navigation.mjs` are run by
  `scripts/ci.sh` (R-006).

## Alternatives

- **An iframe inside the existing layout.** Needs `frame-src 'self'`, freezes the address bar
  on the shell route, and breaks every deep link and the Back button.
- **Caching only `/site/*` assets.** Leaves the 3.9 MB reload and the dead back/forward cache,
  which is where the reported pain actually is.
- **A separate `deploy-host` verb** for host-only changes. Two publication paths and one
  receipt; the existing path already supports a host-only source, so only its refusal was wrong.

## Reversal condition

Return to `no-store` on documents if the workspace ever serves content whose presence in a
reader's disk cache is itself the risk — at which point the bar and the revalidation are
independent and only the cache directive changes.
