# Handoff: the owner's package 4 (2026-11-20), paused for the strategic plan

Session `f6c9238c`, Fabric board task `93b9b440`. The owner's order: brief
`ceo/inbox/2026-11-20-fabric-focus-protocol-backup-billing-brief.md` (package 4), then the additions
`2026-11-20-release-ui-rounds-and-graph-docs-brief.md` (item 1) and `2026-11-20-create-screen-templates-brief.md`
(all in the Fabric data folder's `ceo/inbox/`).

**Pause.** The owner, relayed 2026-11-21 00:30: new features wait for the strategic plan (fabric-workspace session
`2d03ce15`, brief `2026-11-21-strategic-plan-fable-brief.md`); only the bug of the second icon after an update goes
on. So this entry is the state for the strategist: what landed, what waits on which branch, and the next step of each.

## Landed: one Fabric icon after an update (the bug)

- Cause, measured on the owner's Mac on 2026-11-20: the 0.3.26 apply renamed `/Applications/Fabric.app` away and a
  staged copy in; the Dock tile (a bookmark to the folder) followed the old copy, and `persistent-apps` held two
  `ai.passioncode.desktop` tiles. `/Applications/Fabric-0.3.20.app` and five rollout copies stayed registered with
  LaunchServices under the same id.
- Fix: `scripts/install-mac-update.mjs` (decisions in `scripts/lib/install-mac-update.mjs`, test
  `scripts/test/install-mac-update.test.mjs`, in `scripts/ci.sh`); how to use it:
  [release-mac.md, Installing an update on a Mac](../../launch/release-mac.md#installing-an-update-on-a-mac).
- Applied on the owner's Mac on 2026-11-20 21:47 with `--tidy`: `Fabric-0.3.20.app` zipped into
  `~/Library/Application Support/ai.passioncode.fabric/previous/Fabric-0.3.20.zip` and removed; five stale
  registrations removed; the Dock left with one Fabric tile (read back: one `ai.passioncode.desktop` in
  `persistent-apps`, and a screen capture of the Dock).
- **For whoever installs the next release on this Mac (0.3.27 included):** use
  `node scripts/install-mac-update.mjs --dmg <dmg> --schedule`, not a hand-written `mv` apply.

## Waiting, by branch

| Branch | Commit | What | Next step |
|---|---|---|---|
| `feat/dock-icon-face` | `486e1f72` | Plan wave I (mockup 08, option A): the Dock icon is the CEO's face. `shared/avatarSvg.ts` (one markup for the avatar and the icon), `renderer/launch/dockIcon.ts`, `setDockIcon` in `main/appIcon.ts` (kept in `userData/dock-icon.png`), IPC `persona:dock-icon`. Typecheck, vitest of the face and the icon, design gate green; generated reports rebuilt. It also carries the installer commit, which is on main now. | Rebase on main (drop the installer half), rerun `scripts/ci.sh fast`, land. The shipped `.icns` as the default face needs a new decision beside ADR-0100 §8. |
| `feat/ui-kit` (on `feat/dock-icon-face`) | `c1b42b8c` | The Fabric UI kit: `docs/brand/ui-kit.md` (recipes for buttons, chips, cards, plates, popups, lists), `docs/brand/ui-kit.html` built by `scripts/build-ui-kit.mjs` from the app's stylesheets and registry; a ratchet in `scripts/check-design.mjs` over raw px in the screen sheets (`docs/brand/ui-kit-baseline.json`); the interface rounds in the release gate (`uiRoundProblems` in `scripts/lib/release-gate.mjs`, from 0.3.28). | Tests for `uiRoundProblems`; an ADR for the release rule; `node scripts/build-ui-kit.mjs --check` in `scripts/ci.sh`; the path of the brand documentation (`docs/brand/`, entry `docs/brand/ui-kit.md`) in `AGENTS.md`; the first full interface round over all screens. |

Drafts and captures for the parts not started are on `feat/ui-kit` in `docs/handoffs/2026-11-21-package-4-paused/wip/`:
the call history's wording (`drafts/callHistory.ts.txt`), a stand that renders the CEO popup from a build without the
owner's Fabric (`drafts/ceo-popup-stand-*.txt`), and before captures of the popup (`captures/`).

## Not started (paused), with what was found

1. **The CEO popup and the call history.** Before (captures on `feat/ui-kit`): a call shows only its clock time,
   so yesterday's and the day before's read the same; its length `10:00` reads as a time of day; no topic, no
   transcript link; the summary text is centred because of a third flex child (`styles.css`, `.ceo-call-record
   summary::before`). The head has three equal buttons; the passed-over runners take three lines. The history waits
   on session `9cda1c0f`'s call journal (`feat/voice-retro`, CO-605 item 4); agreed on task `e7ff5556`.
2. **The Create screen** (handed over by `8343a070` on 2026-11-20, its mockup
   `docs/evidence/plans/2026-11-20-ceo-board-ux/mockups/01-create.html`, plan waves A and B, row `af9b6f47`): a field
   to describe in words what to make (with pictures) that goes to the CEO, then create project, create agent, open
   project, open a folder with nested projects, open many; agent templates from the agents database
   (`docs/template-repos.json`, `passioncode-ai/template-*`), 5 or 6 first and a gallery; templates only with a
   PassionCode subscription, the check from passioncode-platform's billing (`353fa3d7`). The architect was consulted
   on 2026-11-20 (`audit.py consult`).
3. **The welcome block of Главная** (owner: lighten it): shared with `8343a070` (task `4b894a4d`, note there).

## Found on the way

- A session window draws its terminal text torn (line starts cut, a column of letters on the right, words glued) and a
  white strip with «Завершить сессию» in a dark window: board row `e632ba41`.
- `packages/journal/node_modules` in the main checkout pointed into a removed worktree (`fabric-home-ceo`), which
  broke `tsc` for every session using that checkout; the links were repaired on 2026-11-20 (local, not in Git).
- The scripts' tests and generated reports embed `tokens.app.css`: a new token makes `build-product-report`,
  `build-mockup-coverage`, `build-adoption-report` and `build-mockup-previews` stale at once.

## Checks run

On the installer: `node --test scripts/test/install-mac-update.test.mjs` (9 tests, exit 0), `--tidy --dry-run` and
`--tidy` on the owner's Mac, `node scripts/check-private.mjs` PASS. The gates of this change are in its commit message.
