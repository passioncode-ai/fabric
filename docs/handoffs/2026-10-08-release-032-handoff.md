# Handoff · 2026-10-08 · Fabric 0.3.2 published, smoked, on the site and in the knowledge base

Entry point for the next agent. It records a moment; it is not rewritten later.

## Objective

Finish the 0.3.2 release that two sessions carried on 2026-10-07: a Claude Code session cut the release
commit and the landing merge, a Kimi Code session took over at the load-gated CI run and drove the release
through publication and the packaged smoke. This session checked what the second one did and closed
steps 8–9 of [the release runbook](../launch/release-mac.md#how-a-release-is-made) and the plan rows.

## Done

| Step | What | Receipt |
|---|---|---|
| Land | `main` fast-forwarded to the landing merge `bbc69103`; tag `v0.3.2` on the release commit `c3543227` (`verifiedCommit` `61dfff1d`) | `git rev-parse v0.3.2^{commit}` → `c3543227…`; `git merge-base --is-ancestor bbc69103 origin/main` → 0 |
| 3–6 | Release run: `preflight`, `macos` and `publish` success; the operator approved both environments | [run 37564162445](https://github.com/passioncode-ai/fabric/actions/runs/37564162445); [release v0.3.2](https://github.com/passioncode-ai/fabric/releases/tag/v0.3.2), prerelease, published 2026-10-07T09:10:38Z: `Fabric-0.3.2-arm64.dmg`, `fabric-0.3.2-mac.json`, `SHA256SUMS`, `SHA256SUMS.asc` |
| 7 | Packaged smoke of the installed DMG: PASS (chat active, sent from the composer, journalled once, cold restart read back and not resent, operator estate untouched, `packaged: true`) | Kimi session 2026-10-07; the first attempt stopped on schema readiness (the stack was at 75), as designed |
| Download | Anonymous download, 2026-10-08: `shasum -a 256 -c SHA256SUMS` OK (`db0f1a2adcc3aae96100e98194268826b1514b26dd0d35e62fd2301e7337457b`), `gpg --verify SHA256SUMS.asc` good signature (key `63B30DC3…C803B6A7`), `spctl -a -t open` accepted, Notarized Developer ID, `xcrun stapler validate` worked; receipt: DMG notarization `c8ccafa8-b500-465c-9ec9-b86a326d8677` Accepted | this session |
| 8 | Site screenshots from the installed 0.3.2 app, 1440×900, on a fresh English launch estate `e9789f9c-efc8-4f61-af81-a5bd9ff1a8c3` (`launch-estate.sql` from the tag, `-v lang=en`, receipt `backwards_steps = 0`), throwaway user-data folder, no console errors; the operator's running Fabric kept the hub (`hub.json` pid unchanged) | site `assets/fabric-{home,board,releases}.jpg` |
| 9 | Website: the release sync, the screenshots, `/fabric/agents/` (Kilo Code and Hermes Agent connected in 0.3.2, Cline runs in Fabric — `apps/desktop/src/shared/agents.ts#AGENTS`, `connectsToSurface`), the usage-count disclosure on `/fabric/` and `/privacy/` (version 2026-10-08), brand facts. Deployed from `main` `0677deb`, Worker version `ebfe7dcf-a294-4a9d-92ff-46cbad27f69a`; `verify-live.py` PASS (44 assets, 7 download routes, 5 not-found addresses); live screenshots equal the build | [site PR #66](https://github.com/passioncode-ai/passioncode-ai.github.io/pull/66), receipt [PR #67](https://github.com/passioncode-ai/passioncode-ai.github.io/pull/67) |
| Knowledge | `knowledge/products.md`, `roadmap.md`, `plans.md` name 0.3.2 (the knowledge-base half of 0.3.2 verification PL-13, CO-221) | [fabric-workspace PR #72](https://github.com/passioncode-ai/fabric-workspace/pull/72) |
| Plan | P-11 done, P-09 released in 0.3.2, the Now line says so; CO-224 records the red hosted `ci` | this change |

## What went wrong, and what was done about it

**The operator's database was migrated without the runbook's backup and rehearsal.** For the smoke, the Kimi
session ran `supabase migration up --local` from the release worktree against the local stack every Fabric
estate on this Mac lives in (migrations 76, 77, 80, 81). The app's startup message names that command, but the
runbook's [upgrade procedure](../launch/release-mac.md#upgrading-an-existing-database) puts a backup and an
owned-copy rehearsal before it. It also quit and reopened the operator's Fabric itself (`open -a Fabric`),
where the machine's rule is the lifecycle broker. Measured on 2026-10-08, read-only: `public.schema_version()`
79, 79 rows in `supabase_migrations.schema_migrations` (newest `20261005000081`), `public.journal` 161 916 rows,
769 estates; Fabric 0.3.2 runs on it. The only earlier backup is `pre-0.3.1.dump` (2026-10-05, schema 75, with
its rehearsal receipt), so two days of journal before the migration have no pre-migration copy. A backup after
the fact was taken with the PostgreSQL 17 client: `~/Library/Application Support/Fabric/backups/post-0.3.2-migration-2026-10-08.dump`
(mode 600, 184 708 416 bytes, `pg_restore --list` 1 427 lines). No restore into a disposable stack was run.

## Open

- **CO-224** — the hosted `ci` workflow is red on `main` (the unified-plan tests need the private `workspace`
  submodule). Its own iteration decides between a CI deploy key and a fixture fallback.
- The site's brand-facts rows for Switchboard, Inbox, Dashboards and Observatory describe earlier releases; the
  sync moved only their versions. Each product's release updates its own row.
- The pin of `workspace` in the operator's main checkout lags the recorded gitlink (`git submodule update`
  there is the operator's checkout, left as found).
- Carried by the release, unchanged: CO-215…CO-222; shipped open: CO-179, CO-206, CO-212.

## Next task

Fabric's plan Now line after 0.3.2: P-12 (self-update, 0.3.3) and the route-aware host (CO-223, ADR-0125) are
the rows in motion on `main`; which goes first is the operator's call, not this record's. CO-224 is the first
task to pick up if a hosted run must gate anything again.
