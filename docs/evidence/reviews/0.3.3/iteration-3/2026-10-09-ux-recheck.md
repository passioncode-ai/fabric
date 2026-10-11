# Fabric 0.3.3 — iteration 3 — Scenarios, UX and UI — recheck at f891954c

- Candidate: `f891954c9c4848a0792f160cc7128468f4980bb6` (detached checkout `~/DATA/fabric/.claude/worktrees/rc033-recheck`)
- Findings rechecked: `docs/evidence/reviews/0.3.3/iteration-3/2026-10-08-ux.md` UX-1, UX-2 (blocking), UX-3, UX-4, UX-5, UX-7 (best-effort); UX-6 seen in passing
- Date: 2026-10-09
- Mode: read-only. No repository file changed (`git status --short` empty after the walks; the build output went to the ignored `apps/desktop/out/`). Nothing committed, pushed or sent. The operator's Fabric.app and Supabase stack were not started, stopped or killed.

## What was run

| What | Result |
|---|---|
| `cd apps/desktop && npx electron-vite build` | exit 0 |
| `npx vitest run src/renderer/src/FallbackOrderSetting.test.tsx src/renderer/src/start` | exit 0: 2 files, 66 tests passed |
| Runtime walks: Playwright `_electron` (`~/.cache/fabric-pw/node_modules/playwright/index.mjs`), `executablePath` = apps/desktop's Electron binary, args `['--use-mock-keychain', '.', '--user-data-dir=<fresh mkdtemp under ~/.cache/fabric-release-033/recheck-ux/ud-*>']`, cwd `apps/desktop`; `active-estate.json` (ActiveEstate@1, random Estate, mode 0600) and `settings.json` `{locale:'ru'}` written first (plus a four-entry `runnerFallback` for UX-1); `FABRIC_WALK_PICK` = throwaway folders under `~/.cache/fabric-release-033/recheck-ux/fx-*`; `FABRIC_NO_KEYCHAIN=1`; quit with `app.evaluate(({app}) => app.quit())` | 6 launches, all quit, no process left (`pgrep -f recheck-ux/ud-` empty) |

Walk scripts and their JSON output are in `~/.cache/fabric-release-033/recheck-ux/` (`walk-ux1.mjs`, `walk-create.mjs enter|mouse`, `walk-rest.mjs enter|mouse`, `walk-*.json`, `shots-*.png`). Every press was done twice: once with the keyboard (focus the button, then Enter or Space) and once with the mouse. Focus was read at about 150 ms and again at 1.5 s after the press.

**Handlers replaced in the walk's own main process.** `ipcMain.removeHandler` and then `handle`, inside the walk's Electron only. Nothing else was touched:
- `projects:create` returned the input as a row, so no Project reached the database.
- `tasks:start` threw `planted failure`. For UX-7 it returned session `walk-session-1` instead. No coding agent started.
- `tasks:close` returned `{ok:true}`.
- `windows:open-session` threw.
- `start:adapterSkills` returned ready. This was a precondition only: the walk's `CLAUDE_CONFIG_DIR` is empty, so Create was otherwise blocked by "install the skills first".
- `analytics:status` and `analytics:set-enabled` were replaced for UX-5, so the machine-wide analytics switch was never written.

`start:create-folder` was the real handler. "Create and open the console" made only `~/.cache/fabric-release-033/recheck-ux/fx-create-{enter,mouse}-*/new-agents/support-desk-2`.

## Findings rechecked

| ID | Status at f891954c (holds / does not hold) | Evidence |
|---|---|---|
| UX-1 | **holds** (fixed) | `walk-ux1.json`, ru, starting order Claude Code, Codex, Kilo Code, Hermes Agent. All 7 moves left focus on the moved agent, at 150 ms and at 1.5 s, and the drawn order matched `settings.json` on disk each time. Keyboard Enter "Опустить Claude Code ниже" → «Поднять Claude Code выше». A second Enter on the focused button moved Claude Code again, back to the top. Enter "Поднять Hermes Agent выше" → Hermes. Space "Поднять Codex выше" (to the top, so Up is disabled) → «Опустить Codex ниже». Mouse "Опустить Codex ниже" → Codex. Mouse "Поднять Kilo Code выше" → Kilo. Enter "Опустить Kilo Code ниже" (to the bottom) → «Поднять Kilo Code выше». Remove (the UX-6 part of the brief) puts focus on the next row, the last row once the bottom row is removed, and the add select once the list is empty: «Убрать Codex» → «Поднять Hermes Agent выше»; «Убрать Kilo Code» (the last row) → Hermes; «Убрать Claude Code» → «Убрать Hermes Agent…» (its only working button); «Убрать Hermes Agent» → `SELECT` "Какого агента для кода добавить". Code: `FallbackOrderSetting.tsx#FallbackOrderSetting` keeps `pendingFocus` (runner id) and focuses in a `useEffect` on `[order]`. Test: `FallbackOrderSetting.test.tsx` "focus follows the moved row once the saved order is drawn…" now has a save that succeeds and asserts the focused `aria-label` names Codex. |
| UX-2 | **holds** (fixed) | `walk-create-enter.json`, `walk-create-mouse.json`: after «Папка с таким названием уже есть: …/support-desk» (the real `start:create-folder` against a pre-created folder), `activeElement` = `INPUT#start-agent-name` at about 0 ms, 300 ms and 1.5 s, both by keyboard and by mouse. The next keystrokes (End, `-2`) went into the field without a click, and the value became `support-desk-2`. Code: `AgentPaths.tsx#CreateAgent` has a `focusName` counter and focuses in a `useEffect` after the commit. Test: `StartPaths.test.tsx` "after the folder-exists refusal, focus is back on the Name field (iteration 3, UX-2)". |
| UX-3 | **does not hold on Adapt**; holds on Create | **Create**, both runs: after «Взять другого агента для кода», focus = `SELECT#start-builder` (enabled) at 150 ms and 1.5 s (`AgentPaths.tsx#CreateAgent` `anotherAgent`, a `requestAnimationFrame` to `builderRef`). **Adapt** (`walk-rest-enter.json`, `walk-rest-mouse.json`): after the planted failed start, «Взять другого агента для кода» → `activeElement` BODY at 150 ms and 1.5 s, by keyboard and by mouse, even though `#start-builder` is enabled again. `AgentPaths.tsx#ConvertAgent` `anotherAgent` still moves no focus; the finding named both places. Non-blocking, as filed. |
| UX-4 | **holds** (fixed) | `walk-rest-*.json`: two repositories scanned and ticked; «Добавить как проекты: 2» → «Добавлено: 2.». Focus = «Настроить billing с агентом» (the first button of the result callout) at about 0 ms, 300 ms and 1.5 s, by keyboard and by mouse. Code: `StartPaths.tsx#ScanFolder` `importPicked`, a `requestAnimationFrame` to `imported`'s first button. |
| UX-5 | **holds** (fixed) | `walk-rest-*.json`: the notice drawn with `pending-disclosure`; focus is on «Продолжить» while it shows. On home, after «Продолжить» (Enter, and mouse) the notice is gone and focus = `H2 "Fabric"` (the screen's heading, inside `main`) at 150 ms and 1.5 s. On the start menu (mouse) → `H2 "С чего начнём?"`. Code: `UsageCountsNotice.tsx#UsageCountsNotice` `answer`. |
| UX-7 | **holds** (fixed) | `walk-create-*.json`: the session starts (planted `walk-session-1`) and the console does not open → «Сессия агента для кода запущена, но её консоль не открылась: … «Попробовать ещё раз» откроет её.» The buttons are only «Назад» and «Попробовать ещё раз»: no «Начать заново», no «Взять другого агента для кода». Focus is on «Попробовать ещё раз». Code: `AgentPaths.tsx#CreateAgent` renders Start over only when `made && !attempt.current.sessionId`, and `abandon` returns early when `a.sessionId` is set. But see UX-R1: the sentence next to the button still tells the person to start over. |

## New defects

Blocking: none found.

| ID | Blocking | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| UX-R1 | no | In the "session runs, console did not open" state, Start over is now hidden (UX-7). The failure callout still says «Чтобы выбрать другое имя, описание или место, начните заново — созданное останется…», which points to a button the screen no longer offers. English is the same ("To choose another name, sentence or place, start over; …"). | `walk-create-enter.json` "ux7 text" next to "ux7 start over offered false". `AgentPaths.tsx#CreateAgent` renders `start.createAgent.madeKept` / `madeKeptFolder` whenever `made` is set, without the `sessionId` condition the Start over button has. `ru.ts` / `en.ts` `start.createAgent.madeKept`, `start.createAgent.madeKeptFolder`. | While `attempt.current.sessionId` is set, show a sentence that says the session runs in the folder and the retry opens its console, without the start-over clause. |

## Not checked

- **Adapt's real launch and the real console.** `tasks:start` was planted on every launch, so no coding agent started and no console window was seen. For UX-7, `windows:open-session` was planted to fail.
- **Real Projects in the database.** `projects:create` was planted, so no Project was written. The project page after a real import and «Настроить … с агентом» was not walked.
- **The real adapter-skills check.** It was planted as ready. The blocked-by-skills state was seen once, before the plant: «Сначала установите скилы Fabric Agent Adapter и проверьте ещё раз.»
- **The real analytics path.** The unpackaged build has no App Key, and the notice's `failed` and `sentBefore` variants were not drawn.
- **UX-3 on Adapt with another agent actually chosen.** Only the focus after the press was read.
- **English.** All walks ran in `ru`.
- **Other conditions.** The light theme, other window widths (only 1280×900), VoiceOver, and the packaged DMG were not covered.
- **The remaining findings.** UX-8 through UX-13 (copy, scenario text, preset `aria-describedby`) were not rechecked. The diff shows `Tasks.tsx` adds `#tasks-setup-why` for UX-13, but the setup preset button is still `disabled`.
