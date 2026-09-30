# Fabric workspace host follow-up review · 2026-09-07

Changes are confined to the isolated workspace checkout. Generated content is unchanged; no deploy or push occurred.

- `lib/documents.mjs`: parse5 source-offset rewrite of navigation href attributes only. Exported directories open filtered library; identifiable absolute Fabric paths open exported documents; non-exported code opens immutable Fabric commit on GitHub. Inline script/style bytes and existing anchors remain unchanged.
- `server.mjs`: authenticated version endpoint adds `deployment.workspace_commit` from valid `HEROKU_BUILD_COMMIT` and `deployment.release` from valid `HEROKU_RELEASE_VERSION`. Missing/invalid metadata is null. No expected-source or legacy slug fallback. No additional environment variables or secrets are exposed.
- `docs/DEPLOYMENT.md`: requires both dyno metadata labs flags before deployment and verifies source/digest/build/release against active successful Heroku API record. Official reference: https://devcenter.heroku.com/articles/dyno-metadata, fetched2026-09-07.
- `docs/ux/scenarios.md`: navigation and provenance behavior updated in the same change.

Verification on Node24.19.0:

- 14 host tests PASS, including historical link repairs, untouched script/style/anchors/snapshot and identical CSP, valid/absent/invalid runtime metadata, no expected-source substitution and protected metadata.
- Actual336-file snapshot verification PASS, still sourcefce89652754c21ce4538fbdea11d6556ac351469 and digestd53252b9ec6bdcd1a7078ed967754b7e4935cf740ba3d262971974f7d3a214bd.
- Full actual exported HTML inventory:16pages,4952navigationhrefs, exactly7brokenlocal links before,0after. CSP unchanged for every page. Receipt `/tmp/fabric-workspace-html-link-checks.json`.
- Actual-content browser PASS:12viewport/theme/page combinations, keyboard, primaryabovefold, search/recovery, deep-linkredirectfragments, no-JS directory/Markdown, no page errors or CSP violations. Receipt `/tmp/fabric-workspace-browser-host-fix/checks.json`.
- `git diff --check` PASS.

Root owns integration, current release verification and deployment. Existing local8771server predates this fix; do not use it as the fix verification receipt. Browser test launches a fresh isolated server.

Skills applied: maintaining-fabric-workspace (read source/publication ownership; status correctly names missing initialreceipt and nextpublish action), existing ux-scenarios (same-change navigation/provenance records), existing webapp-testing (real browser verification). Toolbox measured527reachable. No new visual system, copy rewrite, subagents, product sources or shared registers changed.
