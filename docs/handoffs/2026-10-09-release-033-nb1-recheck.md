# Fabric 0.3.3 — iteration 3 — NB-1 recheck at fa9cdf6b

- Candidate: `fa9cdf6b7d3b8d05a9dc264f965241c672b10ee1` (detached checkout `~/DATA/fabric/.claude/worktrees/rc033-recheck`; `git status --short` was empty before and after)
- Date: 2026-10-09
- Mode: read-only. No repository file was changed, and nothing was committed, pushed or sent. The live Supabase stack and Fabric.app were not touched. Scratch files are under `~/.cache/fabric-release-033/recheck3/`.
- Scope: NB-1 and its thrown-`createFolder` variant (`docs/evidence/reviews/0.3.3/iteration-3/2026-10-09-final-recheck.md`), and the code in `git diff d2c20705 fa9cdf6b`. That code is `AgentPaths.tsx#CreateAgent` `keepFor`, `main/index.ts` `IPC.tasksClose` and one new test in `StartPaths.test.tsx`.

## Commands run (exit codes read directly)

| Command | Exit | Result |
|---|---|---|
| `npx vitest run --config ~/.cache/fabric-release-033/recheck3/vt/vitest.config.ts` (in `apps/desktop`). It runs the planted probes in `vt/nb1.recheck.test.tsx`: the recheck2 probe file unchanged, plus the variants E–K. They use the real `StartScreen`/`AgentPaths` with the bridge stubbed. | 0 | 20 probes ran. Observations are in `vt/probes.log`. |
| The same probe file against the `d2c20705` sources (`git archive d2c20705 apps/desktop/src apps/desktop/test` → `recheck3/old-d2c20705/`), as a control | 0 | 20 probes ran. Observations are in `old-d2c20705/vt/probes.log`. |
| The committed NB-1 test (fa9cdf6b's `StartPaths.test.tsx`) against the `d2c20705` sources, `-t "final recheck NB-1"` | 1 | Fails as it should: `expected 'support-desk' to be 'support-desk-2'` (`old-d2c20705/vt/committed-nb1.log`). The test catches the old defect. |
| `npx vitest run src/renderer/src/start` (in `apps/desktop`) | 0 | 1 file, 64 tests passed (`vitest-start.log`) |

## Recheck

| ID | Status | Evidence |
|---|---|---|
| NB-1 (blocking) | **fixed** | `keepFor` now merges `{ made: null, failed: null, flight: null, ...keptCreate, attempt: a, ...base, ...patch }`, so the name, sentence and place of the current press override the ones a refused press left behind. **N2-B** (refusal; rename to `support-desk-2` and change the sentence to "Answers tickets"; Create; leave while `projects.create` is pending; return; it fails; Try again): the screen shows `support-desk-2` / `Answers tickets` both mid-flight and after the failure. `projects.create` gets `[{support-desk-2, Answers tickets, /w/support-desk-2} ×2]`, and the instruction says "Its name is support-desk-2; what it will do: Answers tickets". **N2-C** (Back and return after the failure): `support-desk-2` is shown and sent for `/w/support-desk-2`. **F** (refusal; rename and change the place to `/v`): `/v/support-desk-2` is shown and nothing under `/w` is. `projects.create` gets `{support-desk-2, /v/support-desk-2}` twice. **H** (same screen, no leaving), **I** (two refusals, then a third name) and **J** (the refusal lands while away, rename on return): the new name and sentence each time, for the new folder, with the same Project id. **K** (refusal, rename, Codex, launch fails, leave and return, Try again): the same task with `codex` twice, and the instruction names `support-desk-2` both times. **Control at d2c20705:** N2-B, N2-C, F, I, J and K all send the old `support-desk` / "Reads mail" on the retry. H keeps the new name at both SHAs, because the screen never remounts. |
| NB-1, throw variant (pre-existing) | **fixed** | **N2-D** (`createFolder` rejects `git init failed`; rename; Create; Project fails; leave and return; Try again): the screen shows `support-desk-2`, and `projects.create` gets `support-desk-2` twice for `/w/support-desk-2`. **E** (the same, but left while `projects.create` is pending, with a new sentence): `support-desk-2` / `Answers tickets` mid-flight and after the failure. The old "git init failed" sentence is not shown. The instruction says `["support-desk-2","Answers tickets"]`. **Control at d2c20705:** both probes show and send `support-desk` / "Reads mail" for `/w/support-desk-2`. |
| N-1, N-2, N-3, UX-3 (Adapt), UX-R1 (regression check, since `keepFor` changed) | **hold** | The fa9cdf6b probe lines are identical to the d2c20705 run in `recheck2/vt/probes.log`. N1-A/B/D send the same task with `codex` twice. N1-C shows `codex` and lets it be changed. N2-A says the refusal on the returned screen (`role=alert`). N3 stays silent for "no longer exists" and says the note for a refusal or a throw. UX3 lands on the `SELECT`. UXR1 shows no start-over advice while the session runs. |
| N-3 residual (non-blocking at recheck2) | **fixed in code** (from reading the code; main was not run) | `IPC.tasksClose` now reads `error: readError` from the `maybeSingle()` read of `project_tasks` and returns `the task could not be read: <message>` before the "no longer exists" branch. `abandon` treats only the exact "that task no longer exists" sentence as silence, so a failed read now produces the note "could not be cancelled on the board: the task could not be read: …". The other renderer caller, `ProjectHome.tsx` (around line 605, the `tasks.close` call), shows `result.reason` as a refusal, so the new sentence is shown there too. Nothing matches on the old wording. |

## New blocking defects

None. The `keepFor` change affects only `name`/`purpose`/`parent`, and a press can carry different values only while no folder exists. Once `made` is set, the three fields and the place button are disabled (`disabled={busy || !!made}`). A screen mounted mid-flight is `busy` until the flight lands and then adopts `k.made`, so no press can override a kept name with a different one after the folder exists. `attempt: a` sits before `...base`/`...patch`, and neither type carries `attempt`, so the guard `keptCreate.attempt !== a` is unchanged. The `tasks.close` change only adds an early refusal. No probe or test found data going to the wrong Project or folder, a false statement on screen, a lost task or a crash.

## Non-blocking

- A rename typed after a refusal but never pressed is lost on leaving: the returned screen shows the refused name and its refusal (probe G). This is truthful, but it is the person's edit lost.
- `IPC.tasksMove` (`main/index.ts`, just above `tasksClose`) still ignores the read `error`, so a failed read is reported on the board as "that task no longer exists". It is the same class as the N-3 residual, it predates this candidate and it is outside the diff.
- The refusal sentences from `tasks.close`/`tasks.move` are English strings from main, shown unchanged inside a `ru` interface. This predates the candidate.
- On a returned screen the refusal is said in the failure callout and not under the Name field, and focus lands on the `H2` (carried over from the recheck2 observation for N-2).
- Every Try again calls `projects.create` again with the same Project id, even once `a.projectMade` is true (probes E, H, K). This predates the candidate and relies on that call being idempotent, which was not checked here.

## Not checked

- No packaged app or Electron window was used. Every renderer case ran in jsdom with the real components and a stubbed bridge, in `en` only.
- Main's `tasks.close` was not run against a real store, so the `readError` branch is reasoned from the code (supabase-js resolves `{ data: null, error }`). No main-side test covers it.
- Whether `projects.create` is idempotent for a repeated id was not checked.
- `docs/reports/map.html` was skimmed only: its new changelog lane matches the fix. The committed review report was not re-reviewed. `scripts/ci.sh`, `check-design-map.mjs`, `check-registers.mjs`, `check-regions.mjs` and `check-docs.sh` were not run at fa9cdf6b.
- Findings other than NB-1, its throw variant and the regression lines above were not rechecked.
