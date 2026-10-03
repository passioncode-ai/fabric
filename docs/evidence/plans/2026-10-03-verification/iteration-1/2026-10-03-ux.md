# Iteration 1 review — scenarios / UX / UI / visual (first run and start paths)

Inputs: all 42 screenshots (walk-dark-en, walk-dark-ru, walk-light-ru 01–14), walk.json, app.log; SCN-126..131, SCR-70..75; FirstRun.tsx, StartPaths.tsx, start.css, Onboarding.tsx, App.tsx, i18n en/ru, main/{startPaths,executorDetect,digestRead}.ts, shared/agents.ts; `npx vitest run src/renderer/src/start src/renderer/src/Onboarding.test.tsx` → 2 files, 20/20 pass.

## Findings (most severe first)

1. **The first new project opens on an error banner.** error · blocking. dark-en/12 and dark-ru/12 show "Something did not work — the digest could not be read: column memory_facts.supersedes does not exist". The banner stays on 13 and 14, and app.log has the same stack. `digestRead.ts:83-85` selects and filters `supersedes`, but no migration defines that column: grep finds only `supersedes_requested` (`20260909000050_insight_category.sql:52`). The defect predates this change, but it is the first thing the operator sees at the end of the first run. The RU UI shows it as raw English SQL text. Fix: query the real column, add a digest-boundary test against the migrated schema, and give the banner localized text.

2. **The documented rationale "grouping keeps worktrees from becoming duplicate projects" (SCN-128) is false.** scenario · blocking. The walk ticked `billing-service` and its worktree `billing-hotfix`, and that produced two Projects on one repository (dark-en/08, sidebar). Every non-imported row can be ticked (`StartPaths.tsx:347-350`), and "Tick all shown" (`:333`) also ticks worktrees and nested repositories. Fix: leave worktree and nested rows unticked by default, and either attach them to the parent's Project or warn before importing them. Otherwise rewrite the rationale and ADR-0100 §3.

3. **"Nothing is written until you save" is false.** UX · blocking. The string is `en.ts:75` / `ru.ts:159`, shown on dark-en/11. "Create a new folder for it" runs `mkdirSync` and `git init` at click time (`startPaths.ts:77-78`). Cancel or Remove then leaves the folder on disk. Clicking again with the same name is refused as `exists` (`:76`). That includes the case where `git init` failed after mkdir, which contradicts SCR-73 "retry reuses a made folder". Fix: create the folder as part of Save, or remember the folder Fabric made and reuse it on retry. Offer to remove an empty folder on Cancel, and correct the lede.

4. **Codex is shown as "ready".** UI/copy · blocking. On dark-en/03 the pill says `first.exec.state.found = "ready"`. `shared/agents.ts:155-162` says Codex "is NOT a ready Fabric executor" (no surface adapter, no result channel). The step's own note says "Found means the program is on this Mac". The New-project select then labels every agent other than claude-code as "Terminal" (`Onboarding.tsx:223`), so Codex appears there as "Terminal". Fix: change the pill to "installed" and add a per-agent caveat. Label select options with `o.label`.

5. **The persona name is collected and then shown nowhere.** UX · major. `persona.name` is read only in `FirstRun.tsx:46,53,187`. The dock, sidebar and project header keep saying "Fabric" after the operator chose "Atlas" (dark-en/04, 05, 12). PersonaScreen cannot edit the name either. Fix: show the name in the dock, the avatar label and the project header, or drop the field.

6. **The import summary copy is wrong when nothing failed.** copy · major. dark-en/08 and dark-ru/08 read "Not added: 0 — they stay ticked, so Add retries them" (`en.ts:1598`, `ru.ts:1469`). Fix: use separate strings for the all-ok and partial cases.

7. **Focus is never moved.** a11y · major. Headings carry `tabIndex={-1}` (`FirstRun.tsx:78,140,187`, `StartPaths.tsx:64`), but no `.focus()` exists in the renderer outside the terminal and editor (checked with grep). Continue, Back and the path cards unmount the focused button, so focus drops to body and the next step is never announced. Fix: focus the heading on every step or path change.

8. **A row whose agent did not answer `--version` (state `unresponsive`) offers `npm install -g …` with Copy** (`FirstRun.tsx:154`, shown when `state !== 'found'`). The row's own text says "Run it once in a terminal", and `executorDetect.ts:8` names "telling the operator to install what they already have" as the failure to avoid. UX · major. Fix: show the install command only for `missing`. For `unresponsive`, show `<program> --version`.

9. **"Add N as projects" is only at the end of the list** (`StartPaths.tsx:384-389`). UX · major. With only 5 rows at 1360×900 it is already below the fold in RU (dark-ru/06, 07). With this operator's 141 repositories it would be thousands of pixels down. Fix: a sticky footer carrying the count.

10. **The walk reports PASS over broken screens.** harness · major. `scripts/walk/start-paths.mjs` checks for no `[role=alert]` banner, so steps 9–10 pass while the error is on screen. Its "add" step inspects a folder the scan already imported, so the ready → Add project → created path is never exercised. Fix: assert after each step that no alert banner is present, use a fresh folder for "add", and add fixtures for missing and unresponsive executors.

11. **The Onboarding form jumps to a different visual language.** visual · minor. Compare dark-en/10 with dark-en/11. Buttons are larger and use a different style (old `.onboarding`, not `.lp-button`). Radios and checkbox are native blue while the scan uses amber. The primary is amber instead of the `.lp` white/black. The sidebar widens from about 179 to about 191 px. The nav highlights "Fabric" on start screens but "+ Project" on the form. The git checkbox sits beside "Choose folder…" but applies only to a new folder.

12. **A failed import row hides its reason in `title`** (`StartPaths.tsx:374`). a11y · minor. The reason cannot be read by keyboard or screen reader. Also, the "In <project>" button is nested inside the checkbox's `<label>` (`:346-371`), which is an invalid content model, and the checkbox's accessible name becomes the whole row.

13. **RU copy problems.** copy · minor. "Project — устойчивая единица…" uses the English word while the same screen says "проект" (`ru.ts:1400`, dark-ru/10). "worktree" is left untranslated (`ru.ts:1428`). Step label "Исполнители" does not match the heading "Какие агенты…". "эстейтов" is a transliteration. EN `first.exec.unresponsive` shows literal backticks.

14. **The convert steps lose their numbers.** visual · minor. `.st-steps li { display:flex }` removes the list marker (dark-en/14). The "Planned" pill is sentence case on the screen and uppercase on the card. Today's command has no Copy button, unlike step 2.

15. **Scan grouping display.** UI · minor. A worktree group is headed "billing-service and its parts". Uppercasing alters repository names. "in 3 groups" counts the singleton group, which has no heading, so only 2 headings show (dark-en/06). The disabled button reads "Add 0 as projects". The ticked count includes rows hidden by the filter.

16. **Spec and code disagree on some states.** spec · minor. SCR-73 `no-parent` ("Create disabled; location prompt") is not drawn: picker cancel returns silently (`Onboarding.tsx:69`). SCN-128 `cancelled` silently goes back to idle (`StartPaths.tsx:252`). The SCN and SCR state lists differ: SCR-70 lacks check-failed and skipped; SCR-72 lacks idle, failed and cancelled.

17. **Smaller error and visual issues.** minor.
    - `settings.write` rejecting in `onFinish` (`App.tsx:679`) is unhandled, so the operator is stuck on step 3 with no feedback.
    - `git init` runs as `execFileSync` on the main process (`startPaths.ts:78`) and can freeze every window for up to 10 s.
    - The duplicate Add page still shows an editable name field with no action (dark-en/09).
    - Step 1 uses two selection styles: a white border for the character, amber for the variant.
    - The card marks are Unicode glyphs; ⌕ renders as an unclear speck.

## Checked and correct
- Five cards in the first run and in the menu. Convert is dashed, marked planned, and offers no action.
- Duplicate notice with Open that project, and no Add button for that folder.
- Imported rows are locked, with an "In <project>" link. Sidebar lists the projects the scan created.
- `firstRunDue` handles an unknown project list. The Continue label switches when no agent is found.
- Dark and light themes are legible. RU text wraps without overflow.
- App icon: 1024 px, alpha, macOS 824-px tile, manifest hashes. The mark reads clearly.
- `npx @passioncode-ai/passioncode@latest update` resolves: `npm view` → 0.1.21.

## Not checked, and why
These states are not in the screenshots: executor unresponsive, missing and check-failed (this Mac has both agents); scanning and Stop; truncated, empty and failed scan; partial import; Add ready, not-git, creating and failed; new-folder refusals; agent no-project; team-anchor scroll after choosing a project; Help reopen. Also not checked: a real screen-reader pass, and the icon at Dock size.
