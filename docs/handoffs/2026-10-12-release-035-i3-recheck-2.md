# Fabric 0.3.5 — independent recheck 2, all five levels (UX, errors, docs, data, plan)

- **Candidate:** `816d22844ff6bef41c27a2d028d35b22ee09a811` (detached, `<candidate>`, `git status` clean before and after)
- **Previous final candidate:** `89718e92704981809f7dc5a7d7e2c4cc64de7bf3`; release commit `cae773ff`; rehearsal `v0.3.5-rc.1`, run 38235005334 (Windows: "Unknown argument: Sheleh")
- **Delta read:** `git diff cae773ff..816d2284`: 7 commits (`fc4ccf69`…`816d2284`). Read in full: scripts, `hubTools.ts`, `seedRepair.ts`, `CONTEXT.md`, ADR-0144, the roll-call audit, the 0.4.0 plan, the carry-over ledger, the backlog, `product-model.json`, `plan.json` and `MERGES.md`. Generated files (`docs/reports/previews/*`, 85 files with 2+/2−; `completeness.html`; `product.html`) were checked only for being generated. The ru.ts copy pass (894 lines) was out of scope and not reviewed.
- **Reviewer run id:** `release-035-i3-recheck2-20261012`
- **Read-only:** nothing was edited, committed or pushed, no app was launched and ports 54321/54322 were not touched. The only file written is this report, in the scratchpad.

## What I ran

| Command | Exit | Result |
|---|---|---|
| `node --test scripts/test/package-platform.test.mjs` | 0 | tests 7, pass 7, fail 0 |
| `bash scripts/check-docs.sh` | 0 | PASS: Fabric documentation structure (727 files; 3 links into the uninitialised `workspace` submodule NOT CHECKED) |
| `node scripts/check-regions.mjs` | 0 | PASS: 327 markers |
| `node scripts/check-registers.mjs` | 0 | PASS: 276 carry-over rows, 197 milestones, 1618 verification rows |
| `node scripts/check-design-map.mjs` | 0 | PASS: stamp of 4802 files, 594 anchors, 1808 link targets |
| `python3 docs/ux/lint.py` | 0 | OK: docs/ux is consistent (notes U057 and U078 only) |
| `node scripts/check-plan-ids.mjs` | 0 | (extra check) every open CO row is in a lane |
| `node scripts/sync-product-ux.mjs --check` | 0 | PASS UX projections match canonical registries |
| `node scripts/build-product-report.mjs --check` | 0 | PASS product.html matches its canonical inputs |
| `git diff 89718e92..816d2284 -- supabase` | — | empty (0 lines) |
| planted-defect replay (`node -e`: old join vs `cmdArg`) | 0 | old line gives 10 space tokens for 9 args. The new line is `… "-c.win.azureSignOptions.publisherName=Siarhei Sheleh"`, and only that argument is quoted |

## Verdict per level

- **Errors/build: PASS.** `scripts/lib/package-platform.mjs:46-49` `cmdArg` puts double quotes around any argument that contains whitespace or `"`, and doubles the inner quotes. `scripts/package-platform.mjs:41-42` applies it only when `process.platform === 'win32'`. That is the only case where `pnpm` runs with `shell: true` (`:32`). On macOS and Linux the argument array goes through unchanged, with no shell. `${ext}` (`:53/55`), the `=` values and the endpoint URL contain no whitespace or quote, so they reach the shell as they were. They are the same bytes that passed the shell in rc.1, where only `Sheleh` was refused. The test (`scripts/test/package-platform.test.mjs:64-84`) round-trips the signed win32 args through a cmd-style tokenizer and fails on the old join (replayed above). Other calls on the Windows release path were checked and none can split an argument:
  - `run(process.execPath, …)` (`:30`) and `git rev-parse` (`:51`) use `execFileSync` with no shell.
  - `smoke-platform.mjs:41,46` uses `spawn` with no shell.
  - The steps in `release.yml`'s windows job run in `bash` with quoted `"$installer"`, `"$exe"` and `"$(dirname "$exe")/Uninstall Fabric.exe"`.
  - `pnpm install --frozen-lockfile` and `pnpm exec electron-vite build` carry no whitespace.

  The one remaining caveat, that only a real Windows run proves this, is N-2.
- **Docs: PASS.**
  - CONTEXT.md *Door token* (`CONTEXT.md:358-362`) matches the code. Through the door, enroll only names the Project and answers `needs-grant`: `sessionEnroll.ts:192` ("binding null: the door asks … `needs-grant`, never a session") and `:215-218`, with the door passing `binding = null` (`hubTools.ts:168`).
  - The `hubTools.ts:3-4` header ("three tools, a binding's has five") matches the manifest at `:64-65` and the registrations. Three tools are registered for every principal (`:115,134,153`), plus `fabric.access.grants` and `agent.call` under `principal.kind === 'binding'` (`:174-195`).
  - The `seedRepair.ts` regions now point the right way. `seed-repair` → ADR-0131 `#decision` (`## Decision`, ADR `:29`, the CO-241 grant), and `seed-retire` → `#amendments` (`## Amendments`, `:91`; Amendment 1 is the CO-242 retirement, `:93`).
  - ADR-0144 amendment 5 only appends 16 lines after the end of amendment 4. No existing line was changed.
  - The roll-call audit correction is 5 added lines, a dated, italic sub-bullet under the "Prose or HTTP status only" line. That line itself is unchanged in the diff.
- **UX: PASS.** In `product-model.json`, SCR-78 `current_status` now reads «Построено в 0.3.5 (REQ-17, REQ-38; `launch/WhereWorkScreen.tsx`); согласие на запись сессии в проект ещё не построено.» (that is, built in 0.3.5; the consent to log a session under a project is not built yet).
  - This agrees with `screens.md:94` (status `built`) and with `screens.md:1968` (Coverage "partly": the consent sheet is REQ-17's, wave 5).
  - It also agrees with the header of `WhereWorkScreen.tsx:7-8` ("offers nothing yet").
  - `product.html` was regenerated with that sentence, and `build-product-report --check` exits 0.
  - One wording point that predates the delta is listed as N-3.
- **Data: PASS.** Nothing under `supabase/` changed.
  - The CO-274, CO-275 and CO-276 rows are well-formed: 7 columns, with status `open`, `partially — …` and `open`.
  - The "Next free ID" moved to `CO-277`, and the `refs/agent-sync/ids/CO` counter object agrees (`{"reg":"CO","next":277,…,"rkey":"agent-launch-settings"}`).
  - The backlog numerators moved 208→211 and 273→276, and lane 12 gained CO-274…CO-276. `check-registers` and `check-plan-ids` both pass.
  - The `plan.json` and `resolution-matrix.json` re-pins carry the new backlog sha256 `dad23296…`.
- **Plan: PASS.** The 0.4.0 plan (`2026-10-11-release-040-agents-first.md:481-482`) now says "the operator's read-only Comms screen over the project board (COM-06/07 open beyond it)". That is true: COM-06 and COM-07 are `open` in `plans/2026-10-04-project-communications.md:44-45`. The clean-first-run wording ("dumped first … verified, then dumped again") is a stricter order and contradicts nothing.
  - CO-275 honestly records the analytics read (10 000 rows against the API's 1000) as **not** fixed. It is carried with CO-273.
  - CO-276 (agent launch settings) is placed at 0.4.0, with REQ-45.

**Overall: PASS. 0 blocking findings, 3 non-blocking.**

## Findings

| ID | Blocking? | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| N-1 | no | `cmdArg` protects only whitespace and `"`. Other cmd.exe metacharacters are not escaped: `& \| < > ^` in an unquoted value, `%VAR%` even inside quotes, and a trailing `\` before the closing quote. The values that ship today contain none of them (endpoint `https://…/`, Azure account and profile names, `${ext}`, `=`), so this is latent. | `scripts/lib/package-platform.mjs:46-49`; the values come from `release.yml` windows job `:51-53` (repo vars) | Make `cmdArg` throw on `[%^&\|<>]` or a trailing backslash, so a future variable fails loudly rather than splitting or expanding. Or record it in a CO row. |
| N-2 | no (proof owed before the final tag) | The test models cmd.exe and MSVCRT tokenizing; it does not run cmd.exe. Two things only a Windows rehearsal can prove: that the `pnpm.cmd` `%*` hop keeps the quoted argument whole, and that `pnpm exec` → `electron-builder.cmd` (execa/cross-spawn) keeps it whole too. | `scripts/test/package-platform.test.mjs:64-84`; rc.1 failed at exactly this hop (run 38235005334) | Push a rehearsal tag (`v0.3.5-rc.2`) of `816d2284`. Read both Windows jobs green, including `windows-signing/verify` (`expected-subject: "O=Siarhei Sheleh"`), before tagging `v0.3.5`. |
| N-3 | no (predates the delta) | SCR-78's `no-project-sessions` state says the last row lists sessions "with «Log under a project…»", and Elements describe the consent sheet. The shipped screen "offers nothing yet". The Coverage line qualifies this, but the state row reads as shipped behaviour. | `docs/ux/screens.md:1948,1960` vs `apps/desktop/src/renderer/src/launch/WhereWorkScreen.tsx:7-8` and `screens.md:1968` | Mark the action in the state row "(wave 5, REQ-17)", or fold it into CO-272's wording row. |
