# Iter1 review — errors, failure behaviour, boundaries (main + renderer)

Probes: `scratchpad/iter1-probes/` (p1-skip, p2-create, p3-exec, p3b, p4-home, p5-data, p6-gitcfg, p7-sig). `electron` is stubbed by `register.mjs`/`hooks.mjs`. The probes write only to the system temp dir.

## Findings, most severe first

1. **Scanning runs a program named in a repository's own `.git/config`.** Level: boundary. Severity: blocking. Evidence: p7-sig. A HEAD commit carrying a `gpgsig` header, plus `log.showSignature=true` and `gpg.program=<script>` in the repo config, makes `inspectFolder` run the script (`executed by the scan: true`). Source: `projectDiscovery.ts:122`, `git log -1`. This makes "Scanning only reads" (en.ts `start.scan.readOnly`) and ADR-0100 §3 false for any folder that arrives with its `.git` (an archive, a shared drive). Fix: `git -c log.showSignature=false -c gpg.program=false -c core.fsmonitor=false log --no-show-signature …`. Better, read HEAD and the remote from the files directly. Add p7 as a test.

2. **A scan of the operator's real projects folder finds a quarter of it.** Level: boundary/scenario. Severity: blocking. Evidence: p5-data on `~/DATA`. There are 130 top-level repos and the scan found 34; `fabric` itself is missing. `visited` was 5000 and the result was truncated. An unbounded walk needs only 11,738 directories. The cause is that the walk is depth-first, sorted, and keeps going inside every repository it finds (`projectDiscovery.ts:172-186`), so early repos use up the whole `maxDirs` budget. The UI advice "scan a narrower one" cannot help, because this already is the projects folder. Fix: walk breadth-first. Inside a found repo, only probe shallowly for nested repos or worktrees, outside the main budget. Offer "continue scanning".

3. **The last scan grants its root to any window, across restarts.** Level: boundary. Severity: blocking (a documented claim is false). Evidence: `index.ts:2880` (`fileRoots.allow(kept.root, …)` in `IPC.startLastScan`), which StartMenu, FirstRun step 3 and ScanFolder call when they mount. In p2-create (g, h), a window that never opened a picker could reach `/etc/hosts` after `last-scan.json` held `/`. It could also reach a folder that a different window chose. This contradicts ADR-0100 §7, SCN-128 "chosen in this window's picker" and the S02.roots comment in `files.ts`. Fix: never grant from disk. Return the kept list read-only. Importing goes through `projects.create`, and a re-scan needs a fresh pick (or an explicit "allow again" act).

4. **Credentials in remote URLs are shown and saved to disk.** Level: boundary/data. Severity: major. Evidence: p1-skip. `remote: https://x-access-token:ghp_FAKE…@github.com/o/r.git` is returned unredacted (`projectDiscovery.ts:124`). It is rendered (`StartPaths.tsx:129`) and saved in `last-scan.json`. Fix: strip the userinfo part with `URL`, or use `shared/redact.ts`, before the facts leave main.

5. **`projects.create` attaches repositories without refreshing file roots or the git watch.** Level: boundary. Severity: major. Evidence: `index.ts:888-922`, compared with `reposAttach` at `index.ts:3423-3426`, which calls `refreshFileRoots()`. A project created by add, scan or new-folder is only reachable in the window that picked it. Once that window closes, its files are refused everywhere until restart, and `repoStates.watchAll` never sees it. Also, `attachRepos` journals any path a renderer passes, without `fileRoots.resolve`. That is a pre-existing gap, but the new boundary claim relies on it. Fix: resolve each `repoPath` against the caller's scope, then call `refreshFileRoots()`. Found by reading the code; not probed, because it needs the app.

6. **Creating a folder can fail half-way and freezes the main process.** Level: error. Severity: major. Evidence: p2-create (e, f). When git is missing, the folder is left on disk, the result is `failed`, and a retry says `exists`, with no path forward. A hanging `git` blocked the event loop for 10,003 ms (`execFileSync`, `startPaths.ts:78`), which freezes every window. EEXIST from the existence-check race is reported as `failed`. Fix: use async `execFile`. Remove the folder if `git init` fails, or report "folder created, git init failed" with the path. Map EEXIST to `exists`.

7. **The "parent" pick grants the whole parent tree for reading and writing.** Level: boundary. Severity: major. Evidence: p2-create (i). A sibling file under the chosen parent becomes reachable. The operator chose where to put a folder, not to open that tree. Fix: use the parent only for the duration of `createFolder`, then grant only `result.path`.

8. **"Tick all shown" turns worktrees and nested repos into separate Projects.** Level: UX/scenario. Severity: major. Evidence: `StartPaths.tsx:288,333`; `tickable` includes every group item. SCN-128's design rationale says "grouping keeps worktrees from becoming duplicate projects". On `~/DATA` this would create a Project per `_worktrees/*`. Fix: leave non-primary group members unticked by default (or attach them to the primary's project), and test it.

9. **Stop and the deadline cannot interrupt a stuck filesystem call.** Level: error. Severity: major. Evidence: `projectDiscovery.ts:156-161`. The abort and deadline are checked only between directories, and a pending `readdir` (for example on NFS, such as `~/OrbStack` when `~` is scanned) has no limit. The IPC call and the "scanning" state wait forever, and Stop changes nothing visible. Fix: race the walk against the signal and the deadline in `startScan`, and return `cancelled` or `truncated` straight away. Found by reading the code; not probed.

10. **Some skipped folder names drop repositories without saying so.** Level: boundary. Severity: major. Evidence: p1-skip. Nine top-level repos gave `['app']` with `truncated: false`. Repos named `build`, `vendor`, `out`, `dist`, `target`, `Library`, `coverage` or `.dotfiles` are not entered. That contradicts "A partial list is never returned as if it were the whole folder" (`projectDiscovery.ts:18`). Fix: still check whether a skipped folder is itself a repo (`.git` is present). Skip only its descendants.

11. **"Already in a project" is an exact-string match.** Level: data. Severity: minor. Evidence: `index.ts:2826-2830` compares the stored `path` with the realpath. Paths attached through `commandIngress` or older routes are not normalised (macOS `/var` vs `/private/var`, case, trailing slash), so a duplicate is offered, against ADR-0100 §2. Fix: compare `realpath` values on both sides.

12. **ScanFolder races and cleanup.** Level: renderer. Severity: minor. Evidence: `StartPaths.tsx:241`. If `lastScan()` resolves after `run()` has started, it overwrites the `scanning` state, and the old list can then be imported while a scan is running. Unmounting does not cancel the scan. Fix: guard the effect with `s.at === 'idle'` and call `cancelScan` on unmount.

13. **Executor detection edge cases.** Level: error. Severity: minor. Evidence: p3-exec and p3b.
    - A directory named `claude` earlier on PATH gives `unresponsive` even though the real binary is later on PATH. The cause is that `accessSync(X_OK)` accepts directories.
    - Output over 1 MB gives `unresponsive`.
    - SIGKILL leaves grandchildren running: 2 orphans were left.
    - Recheck has no guard against repeated clicks.

    Fix: check `isFile()`, set `maxBuffer`, kill the process group (`detached` plus `kill(-pid)`), and disable Recheck while a check runs.

14. **Error text is raw.** Level: UX/error. Severity: minor. Evidence: `errorText` in `StartPaths.tsx:26` and `FirstRun.tsx:124`. The operator sees Electron's "Error invoking remote method 'start:…': Error: …", with English text from main even in the RU locale. A failed import row shows its reason only in a `title` tooltip (`StartPaths.tsx:374`), which keyboard and screen-reader users cannot reach. Fix: map errors to i18n keys and render the reason inline.

15. **Onboarding new-folder path.** Level: renderer. Severity: minor. Evidence: `Onboarding.tsx` `newFolder`.
    - There is no busy guard, and `showOpenDialog` gets no parent window (`index.ts:2847`), so the dialog is not window-modal and a double click opens two pickers.
    - The created folder is orphaned if the draft is discarded.
    - `repoPaths` is read from a stale closure.
    - The name rule lets through the bidi override U+202E (p2-c created `ok‮exe.txt`).
    - A non-string name throws a TypeError instead of returning `invalid-name` (p2-d).

16. **Tests are missing.** Level: code-docs. Severity: minor. `createProjectFolder`, `keepScan`, `lastScan`, `validateScan`, `folderNameProblem` and the `start-paths-ipc` region have no tests (a grep of `apps/desktop/test` and `*.test.*` found nothing). A folder whose `.git` is a symlink is listed as a candidate of kind `folder`, `git: false` (p1).

## Checked and found correct

- Symlinked children are not entered, and a parent given with `..` or through a symlink that leaves the root is refused as `outside` (p2 a, b).
- Abort returns `cancelled` with no candidates (p1).
- The scan does not block the event loop: the worst gap was 22 ms over 5000 directories (p4-home).
- `core.fsmonitor`, `core.pager` and `core.sshCommand` set in the repo config are not executed (p6).
- `FABRIC_WALK_PICK` is gated on `!app.isPackaged` (`index.ts:2844`).
- Scans are tracked per window. Cancel aborts only the caller's own scan, and a superseded scan's `finally` does not remove the newer controller.
- Retries reuse project ids, and `projects.create` completes a repeated create.
- `firstRunDue` treats null and undefined correctly.
- A failed settings write when the first run finishes is reported, and `writeSettings` cannot throw.
- The existing tests `project-discovery` and `executor-detect` exit 0.

## Not checked

- A packaged build. The `isPackaged` gate was only read, not run.
- Renderer race probes (12, 15), because no React harness was run.
- A real hung NFS `readdir` (9).
- Windows PATHEXT handling in `onPath`.
- Whether `projects.list` can return `[]` while the store is still starting, which would show the first run wrongly.
