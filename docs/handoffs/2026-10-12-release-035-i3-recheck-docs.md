# Fabric 0.3.5 — iteration 3 recheck, level code ↔ documents

- **Final candidate:** `89718e92704981809f7dc5a7d7e2c4cc64de7bf3`, in the detached checkout `.claude/worktrees/rv-035`
- **Previous candidate (iteration 3 read):** `01783787665f400a8a7b7f2ec804ad5b6be9c87e`
- **Delta read:** `git diff 01783787..89718e92` (commits `ab21e2dd` and `89718e92`) for `CHANGELOG.md`, `README.md`, `CONTEXT.md`, `AGENTS.md`, `docs/launch`, `docs/ux`, `docs/evidence` and `apps/desktop/src/main/seedRepair.ts`. I also read the parts of the rest of the delta that bear on documents: `i18n/en.ts`, `docs/brand/strings.md`, `docs/handoffs/2026-10-12-release-035-fix-wave.md` and `apps/desktop/package.json`.
- **Reviewer run id:** `release-035-i3-recheck-docs-20261012`
- **Read-only:** I edited, committed and pushed nothing. I launched no app and touched no port. `git status --short` was empty after the gates ran.
- **Date:** 2026-10-12

## What I ran

| Command | Exit | Result |
|---|---|---|
| `bash scripts/check-docs.sh` | 0 | PASS, relative links resolve (717 files) |
| `node scripts/check-registers.mjs` | 0 | PASS: 273 carry-over rows, 197 milestones, 1618 verification rows |
| `node scripts/check-regions.mjs` | 0 | PASS: 327 markers, all closed, every `docs:` reference resolves |
| `node scripts/check-design-map.mjs` | 0 | PASS: stamp 4787 files, 590 anchors, 1802 link targets |
| `python3 docs/ux/lint.py` | 0 | OK. Notes only: U057 (23 of 83 flows), U078 (1) |
| `gh run view 38207098935` / `38210310607` (read-only) | 0 | Both match the ledger's V2-38 receipt. `38207098935`: dispatch on `8c1c279e`, fast success, full failure. `38210310607`: push on `8af4b08f`, fast success. |
| `gh run list -w ci.yml -c 89718e92` | 0 | dispatch `38219258686` success; one push run cancelled, one in progress |
| `node -e sanitizeFileName('@fabric/desktop')` with electron-builder 26.15.3's own `builder-util` | 0 | `"@fabricdesktop"` (used in RC-6) |

Logs are next to this file: `check-docs.log`, `registers.log`, `regions.log`, `map.log`, `uxlint.log`.

## Verdict per item

| Item | Verdict | Evidence |
|---|---|---|
| **DO-2**: Windows `fabric-mcp.cmd` path placeholder | **Fixed** (one low remainder: RC-6) | Both documents now use `<install folder>\resources\bin\fabric-mcp.cmd` with the install folder under `%LOCALAPPDATA%\Programs\`: `CHANGELOG.md:19-20` and `README.md:122-123`. This agrees with `` `<Fabric>/bin` `` = "the install folder's `resources/bin`" (`CHANGELOG.md:25-26`, `README.md:124-125`). In the code it agrees with the launcher `apps/desktop/resources/bin/fabric-mcp.cmd:3,5` (`%~dp0..\..\Fabric.exe`) and with `scripts/lib/smoke-platform.mjs:39` (`dirname(exe)\resources\bin\fabric-mcp.cmd`). The doubled `resources\resources` is gone. |
| **DO-3**: Codex sessions get their own `CODEX_HOME` (CHANGELOG) | **Fixed, true** | `CHANGELOG.md:52-53`: "does not read your own `~/.codex/config.toml` or `AGENTS.md`; it signs in with a copy of your Codex login, removed when the session ends". The code agrees: `apps/desktop/src/main/sessionBundle.ts:357,376-389` writes `config.toml` and `AGENTS.md` fresh, copies `$CODEX_HOME`/`~/.codex/auth.json` (`:381-385`) and sets `env: { CODEX_HOME: codexHome }`. `discard` removes the folder (`:69`; called from `pty.ts:483,610` and `index.ts:1109,1169`). The refresh-token question stays unmeasured. It was passed to the errors and data levels and is not a docs defect. |
| **DO-4**: CONTEXT.md door and binding terms; AGENTS.md | **Partly fixed** (RC-2) | `AGENTS.md:159-160` is right. *Binding credential* (`CONTEXT.md:369-373`) is right per `sessionEnroll.ts:220-223`. *Door token* (`CONTEXT.md:358-362`) is new wording, and it contradicts the code and ADR-0134. *Hub* (`CONTEXT.md:308`) is unchanged. |
| **DO-6**: README, which sessions get the surface | **Fixed, true** | `README.md:117-118` names Claude Code, Codex, Kilo Code, Hermes Agent and Kimi Code, and says Cline and a plain terminal get none. The code: `apps/desktop/src/shared/agents.ts:146,193,210,245,299` (adapters) and `:273,316` (`'none'` for `cline` and `shell`). Every session gets an `mcp.json` (`sessionBundle.ts:153`), so "a scoped, single-use `mcp.json` per session" still holds. |
| **DO-7**: `seed-retire` region reference | **Not fixed. The change hit the wrong region and regressed it** (RC-1) | The delta repointed `seed-repair` (`seedRepair.ts:1`) to `#amendments`. `seed-retire` (`seedRepair.ts:122`) still points at `#decision`. |
| **DA-3**: the runbook's floor grants | **Fixed, true** | `docs/launch/release-mac.md:257-258`: 91 "projects the floor's `grants` (money, deletion and publication effects) from the journal". Migration 91's header agrees (`supabase/migrations/20261011000091_grants_from_the_journal.sql:4,18-21`: `grants`, `apply_grants`), and so does the class set `('money','deletion','publication')` (`20260831000001_migration_one.sql:83,98`). The remedy paragraph `:268-271` is consistent with it. |
| **No regression from the delta** | **One regression (RC-1) and one new drift (RC-3)**. Everything else checked holds. | See below. |

Checked in the delta and true:

- **`CHANGELOG.md`:** the only hunks are DO-2 and DO-3.
- **`README.md`:** the only hunks are DO-2 and DO-6.
- **`en.ts` Codex and Kimi project-page words** (`en.ts:599,601`) match the catalogue. No document still says "Not connected to Fabric" for them (grep of `docs`, `README.md`, `CHANGELOG.md`, `CONTEXT.md`: none).
- **`work.release.failed.unconfirmed`:** identical in `en.ts:2285` and `docs/brand/strings.md:845`.
- **Backlog:**
  - P-17's "read-only Comms screen … (COM-06/07 open beyond it)" matches COM-06 and COM-07 `open` (`docs/evidence/plans/2026-10-04-project-communications.md:44-45`).
  - Lane 12 lists CO-270…CO-273.
  - The numerator 208/273 recomputes (gate).
- **CO-270…CO-273:** every cited file and symbol exists: `workTools.ts`, `workRead.ts`, `shared/linkRoute.ts`, `index.ts` region `fabric-link-handler` (`:426`), `links.notice.*` (`en.ts:2227-2235`). CO-271's "link(s)" quote matches `en.ts:2235`.
- **Next free id:** `CO-274`. It matches the last row, CO-273.
- **`docs/ux/screens.md:94`:** `WhereWorkScreen.tsx` exists.
- **Ledger V2-38:** its receipts match the runs above.
- **`apps/desktop/package.json`:** only its `test` script changed in the delta. The version is still 0.3.4, which is expected before the release commit.

## Findings

| ID | Blocking? | Finding | Evidence | Suggested fix (files) |
|---|---|---|---|---|
| RC-1 | No (low) | **DO-7's fix went to the wrong region, so both ADR-0131 pointers are now wrong.** The delta repointed `seed-repair`, which is the grant to the local operator and is described by ADR-0131 *Decision* items 2–5. It now points at `#amendments`, which describe only the retirement of `…0002`. `seed-retire` (`retireSeedOwner`, CO-242), which DO-7 named, still points at `#decision`. The gate passes because both anchors exist. | Code: `apps/desktop/src/main/seedRepair.ts:1` (`#region seed-repair — docs: …0131-…md#amendments`, delta `ab21e2dd`); `:122` (`#region seed-retire — docs: …#decision`, unchanged); `:3-12` (the repair's own description). Doc: `docs/adr/0131-…md:29-58` (*Decision*: the grant) vs `:91-103` (*Amendments* 1–2: the retirement). | Swap them: `seed-repair` → `#decision`, `seed-retire` → `#amendments`. Needs `seedRepair.ts`, which is **not on the allow-list**. Either make a new candidate, or record a ruling in the ledger (allowed) with a carry-over to the first 0.4.0 change of `seedRepair.ts`. A carry-over row would also need the register, which is not on the list, so add it after the tag. |
| RC-2 | No (low) | **DO-4 is half fixed, and the new *Door token* sentence says what the door does not do.** `CONTEXT.md` now says that through the door `fabric.session.enroll` "only asks to join a Project and is answered by the operator's consent". In the code, with no binding, `enrollSession` resolves the folder and returns `needs-grant` straight away. It never creates a request and never reaches the operator. Asking goes through `fabric.access.request` (callee `fabric`, capability `session.enroll`). ADR-0134 says the same: "through the door … it only names the project". *Hub* still says "door toward agents registered on this Mac". Separately, the `hubTools.ts` header comment says the door has "exactly two tools" and a binding "four". `HUB_TOOLS` lists 3 and 5. | Doc: `CONTEXT.md:358-360` (Door token); `CONTEXT.md:308` (Hub, unchanged); `docs/adr/0134-…md:67-69`. Code: `apps/desktop/src/main/sessionEnroll.ts:192` ("the door asks — the folder is resolved and the project named (`needs-grant`), never a session"), `:214-223`; `apps/desktop/src/main/hubTools.ts:158` (tool description: "Through the door this only names the project … ask for it with fabric.access.request"), `:3-4` vs `:63-66`. | *Door token*: "…and, from 0.3.5, `fabric.session.enroll`, which through the door only names the Project a folder belongs to (`needs-grant`); the ask itself is `fabric.access.request` (ADR-0134)". *Hub*: "toward agents registered on this Mac and coding agents enrolled through `fabric-mcp`". `hubTools.ts:3-4`: "three … five". `CONTEXT.md` (guarded) and `hubTools.ts` are **not on the allow-list**. Make a new candidate, or rule it in the ledger and fix it in the first change after the tag. |
| RC-3 | No (low) | **SCR-78's status disagrees across the UX layer.** The delta marks SCR-78 *Where work is* `built` in `screens.md`. The visual route model still says designed, not built. `docs/reports/product.html` is generated from that model. The iteration contract asks that screen changes reach `product-model.json` in the same change. The UX linter does not compare the two, so its exit 0 does not cover this. | Doc: `docs/ux/screens.md:94` (`built`, `launch/WhereWorkScreen.tsx`) vs `docs/ux/product-model.json:10436` (`"current_status": "Спроектировано 2026-10-11 (0.4.0 REQ-17, REQ-38); не построено."`). SCR-81's entry was updated when it was built (`"Построено …"`). | Update SCR-78's `current_status` in `docs/ux/product-model.json`, then run `node scripts/sync-product-ux.mjs` and `node scripts/build-product-report.mjs`. **Not on the allow-list.** Fix it in the first change after the tag, or rule it in the ledger. |
| RC-4 | No (low) | **P-17's status is stale again, as in iteration 2's PL-4 (V2-41).** It says "iteration 3 next". On this candidate, iteration 3 has read `01783787`, opened CO-270…CO-273 (in the same `backlog.md`, lane 12 and the numerator sentence), and its fixes are the candidate. `backlog.md` is not on the allow-list, so the tagged tree will carry "iteration 3 next". | Doc: `docs/evidence/backlog.md` P-17 row (status cell: "iteration 3 next"); the same file's numerator sentence ("after the 0.3.5 verification's iteration 3 opened CO-270…CO-273"); `docs/handoffs/2026-10-12-release-035-fix-wave.md` *Status at 09:15*. | Fix it in the release-close change after the tag, when P-17 becomes **done**. Add it to the ledger's *Release close* list (allowed) so it is not forgotten. No new candidate needed. |
| RC-5 | No (condition) | **The ledger's Iteration 3 section still reads "_Not started._"** The protocol says iteration 3 ends with zero open blocking findings, each finding `V3-n` with a disposition. The handoff's step 2 plans this for the release commit. | Doc: `docs/evidence/plans/2026-10-12-release-035-verification.md:171-173`, `:15-19` (protocol); handoff *Open work* 2–3. | Ledger (allowed): record V3-1…V3-n with dispositions, including the recheck findings above, and name `89718e92` as `verifiedCommit`. It must be done before `release-gate.json` names 0.3.5. |
| RC-6 | No (info) | **DO-2 remainder: no document names the Windows folder.** The text says "the install folder is `%LOCALAPPDATA%\Programs\` and the app's folder there". That is true, but a reader cannot type it, and the sentence reads oddly. From the build configuration, electron-builder 26.15.3 names a one-click per-user NSIS folder after the sanitized package name, so it should be `%LOCALAPPDATA%\Programs\@fabricdesktop`, not `Fabric`. That is derived, not observed: no Windows install has been read. | Doc: `CHANGELOG.md:19-20`; `README.md:122-123`; `AGENTS.md` *On Windows and Linux* (`<package name>`). Code and build: `apps/desktop/package.json:2` (`@fabric/desktop`); `apps/desktop/electron-builder.yml:94-96` (`oneClick: true`, `perMachine: false`); app-builder-lib 26.15.3 `NsisTarget.js:166` and `targetUtil.js:40-41` (`getWindowsInstallationDirName` → `sanitizedName` when one-click per-user); `sanitizeFileName('@fabric/desktop')` = `@fabricdesktop` (run above). | CHANGELOG (allowed): after the rc's Windows job confirms the folder (e.g. print `$exe` in `release.yml:187-188`, or read the receipt), write "…`%LOCALAPPDATA%\Programs\@fabricdesktop\resources\bin\fabric-mcp.cmd`". If it is not confirmed, write "the folder that holds `Fabric.exe` (Start menu → Fabric → *Open file location*)". README's copy can follow after the tag. |

**Counts:** 6 findings, 0 blocking:

- 4 low: RC-1 to RC-4.
- 1 condition the release commit must meet: RC-5.
- 1 info: RC-6.

## Which fixes need another file

- **Within the allow-list, no new candidate needed:**
  - RC-5: the ledger.
  - RC-6: the CHANGELOG.
  - RC-4: as a *Release close* item in the ledger. The fix itself goes into `backlog.md` after the tag.
- **Outside the allow-list (new candidate, or a ruling in the ledger and a fix after the tag):**
  - RC-1: `apps/desktop/src/main/seedRepair.ts`.
  - RC-2: `CONTEXT.md` (guarded), plus the `apps/desktop/src/main/hubTools.ts` comment.
  - RC-3: `docs/ux/product-model.json`, then regenerate `docs/reports/product.html`.
  - RC-4: `docs/evidence/backlog.md`.

None of these leaves an install, upgrade or registration instruction false.
