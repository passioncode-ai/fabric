# Fabric 0.3.5 release recheck after iteration 3: UX (scenarios, UI, text)

- **Level:** UX: scenarios, UI, text (ids UX-Rn)
- **Final candidate:** `89718e92704981809f7dc5a7d7e2c4cc64de7bf3`, a read-only detached checkout at `.claude/worktrees/rv-035`
- **Previous candidate (iteration 3 read it):** `01783787665f400a8a7b7f2ec804ad5b6be9c87e`
- **Delta read:** `git diff 01783787..89718e92`, two commits (`ab21e2dd`, `89718e92`), 116 files. Of those, 87 are regenerated preview JPGs plus `previews.json`, `product.html`, `map.html`, `completeness.html`, `plan.json` and `resolution-matrix.json` stamps. I read the rest line by line: `apps/desktop/src` (`en.ts`, `ru.ts`, the new `harnessAgentWords.test.ts`, `seedRepair.ts` region anchor), `CHANGELOG.md`, `README.md`, `CONTEXT.md`, `AGENTS.md`, `docs/ux/screens.md`, `docs/brand/strings.md`, `docs/launch/release-mac.md`, the ledger and carry-over rows, `.github/workflows/{ci,platforms}.yml`, `apps/desktop/package.json`, the test files.
- **Reviewer run id:** release-035-i3-recheck-ux-20261012
- **Date:** 2026-10-12
- **Read-only:** nothing in the repository was edited, committed or pushed. No app was launched. Ports 54321/54322 were not touched. The only files I wrote are scratch scripts and this report, all under the session scratchpad (`rc3/`).

## What I ran

| Command | Exit | Result |
|---|---|---|
| `git rev-parse HEAD` | 0 | `89718e92704981809f7dc5a7d7e2c4cc64de7bf3` |
| `apps/desktop/node_modules/.bin/vitest run src/renderer/src/harnessAgentWords.test.ts src/renderer/src/HarnessSection.test.tsx src/renderer/src/WhoIsWorking.test.tsx` (from `apps/desktop`) | 0 | 3 files, 35 tests passed |
| Planted-defect replay (`rc3/plant/check.mts`, `node --experimental-strip-types`): the new test's exact logic run against `git show 01783787:…/en.ts` and `…/ru.ts` | 1 | `en ["codex","kimi-code"]`, `ru ["codex","kimi-code"]`. The test catches the iteration-3 defect in both locales. |
| The same replay against the candidate's `i18n/` | 0 | `en []`, `ru []` |
| en/ru parity (`rc3/plant/parity.mts`) | 0 | 2105 keys, 0 missing in ru, 0 placeholder mismatches |
| `python3 docs/ux/lint.py` | 0 | "OK — docs/ux is consistent" |
| `python3 docs/brand/lint.py` | 0 | 0 errors, 1674 warnings. That is the same count iteration 3 recorded, so the delta adds none. |

**NOT_RUN:** the app (launches are forbidden); DB-backed suites (they need the local stack); `bash scripts/ci.sh fast` (no builds).

## Verdicts per checked item

- **UX-1 (project page called Codex and Kimi Code not connected): FIXED.**
  - `harness.agent.codex` now reads "An agent session in the project directory, connected to Fabric (its own per-session Codex home)", and Russian «…подключённая к Fabric (свой домашний каталог Codex на сессию)». `harness.agent.kimi-code` now uses the same sentence Claude Code, Kilo and Hermes use, in both locales (`en.ts:599,601`, `ru.ts:1601,1603`).
  - `harness.agent.cline` still says not connected. That matches `agents.ts`: cline has `surfaceAdapter: 'none'` and `connectsToSurface: false`.
  - The new `harnessAgentWords.test.ts` derives "connected" from `surfaceAdapter`. For every agent, `surfaceAdapter` agrees with `connectsToSurface` (`agents.ts:145–316`).
  - The test passes on the candidate, and I watched it fail on the old strings (above).
- **UX-5 (release-failed line said "below"): FIXED.** The text now says "The list above is read again." / «Список выше прочитан заново.». The `failure` line renders after the claim, unclaimed-session and held rows and before the leases (`WhoIsWorking.tsx:196`), so "above" is now true. `strings.md:845` was updated in the same change. No other file still quotes the old text (`git grep`).
- **UX-11 / SCR-78 status: FIXED (acceptable).** The index row now says `built` with `launch/WhereWorkScreen.tsx` (`screens.md:94`). The record keeps `Status: designed`. That is this file's existing convention: SCR-31, SCR-75 and SCR-76 are all `built` in the index and `designed` in their records. Its Coverage line says "partly" and names the consent sheet as REQ-17, wave 5. The SCR enum has no "partly built" value (`lint.py` `STATUS_ENUMS`), so `built` plus a partial Coverage line is the most the layer can say. `ux/lint.py` exit 0.
- **The other iteration-3 findings: all on record, none dropped.** UX-2, -3, -4, -8, -9 and -10 are CO-272; UX-6 and UX-7 are CO-271. Both rows are new in `2026-08-16-software-fabric-carryover.md`, and the next free id moved to CO-274.
- **en/ru strings in the delta: no regression.** Six values changed (three per locale). The keys are unchanged and placeholders are at parity.
- **CHANGELOG wording: no regression of meaning.** The two edits are the Windows `fabric-mcp.cmd` path and the Codex isolation sentence, and both agree with the code. The isolation sentence matches `sessionBundle.ts` region `codex-config-home`: its own `CODEX_HOME`, `config.toml` and `AGENTS.md` written there, `auth.json` copied, the bundle dir removed with the session. The README now names which runners get the surface: Claude Code, Codex, Kilo Code, Hermes Agent and Kimi Code, but not Cline or a plain terminal. That matches `agents.ts`. Two wording nits follow (UX-R1, UX-R2).
- **The rest of the delta (CONTEXT/AGENTS door-token text, the release-mac migration note, the workflows' cron gate, the test additions): nothing at UX level.** They contain no user-facing strings.

## Findings (only ones the delta caused)

| ID | Blocking? | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| UX-R1 | no | The new CHANGELOG sentence "a Codex session Fabric starts does not read your own `~/.codex/config.toml` or `AGENTS.md`" can be read as "the project's `AGENTS.md` is ignored". It means Codex's global `~/.codex/AGENTS.md`. "It signs in with a copy of your Codex login" holds only when `auth.json` exists; with none, Codex asks the person to sign in, and that sign-in dies with the session. | `CHANGELOG.md` 0.3.5 bullet "Codex and Kimi Code connect…". `sessionBundle.ts` region `codex-config-home`: `AGENTS.md` is written into the per-session `CODEX_HOME`, and `auth.json` is copied only `if (existsSync(operatorAuth))`; the comment there names the no-login case. | "…does not read your `~/.codex/config.toml` or `~/.codex/AGENTS.md` (the project's own `AGENTS.md` still applies); it signs in with a copy of your Codex login if there is one, removed when the session ends." |
| UX-R2 | no (nit) | The new Windows path sentence is hard to parse: "where the install folder is `%LOCALAPPDATA%\Programs\` and the app's folder there". The README's new wording ("the install folder under `%LOCALAPPDATA%\Programs\`") is clearer and says the same thing. | `CHANGELOG.md` 0.3.5 first bullet; `README.md` MCP bullet. | Use the README's phrasing in the CHANGELOG: "where `<install folder>` is Fabric's folder under `%LOCALAPPDATA%\Programs\`". |

Not a new finding: the Codex harness row now names "its own per-session Codex home", which is true. It still sits under `harness.strict` ("Exactly one, and that is enforced…"), which iteration 3 flagged as UX-2. That is now CO-272 and is unchanged by this delta.

## Counts

- Iteration 3 items rechecked: UX-1 (blocking) fixed, UX-5 fixed, UX-11 fixed. UX-2, -3, -4, -6, -7, -8, -9 and -10 are recorded in CO-271 and CO-272, and the delta does not change them.
- New findings caused by the delta: 2, both non-blocking (UX-R1, UX-R2). 0 blocking.
- **Verdict at UX level: no blocker. The final candidate is releasable from the UX side.**
