# Iteration 1 — data, memory, orchestration and harness (whole project)

Branch `claude/onboarding-and-plan` @ `7eff2419`. Nothing in the repository was written (`git status --porcelain` was empty before and after). Probes are in `scratchpad/iter1-probes/`.

## Findings, most severe first

**1. A `project.created@1` in one estate rewrites another estate's project, and a workspace import into an empty estate says it was "adopted" while creating nothing.**
- Level: data. Severity: **blocking**.
- Evidence: in the live projector `apply_estate_and_projects`, the insert ends with `on conflict (id) do update set name=…, repo_path=excluded.repo_path…`, which has no `estate_id` predicate.
- Probe `project-created-scope.mjs` (owned cluster, full migration chain):
  - Estate B appends `project.created@1` with a project id owned by estate A. The append is **ACCEPTED**, and A's row becomes `HIJACKED ∅ repo_path=NULL`.
  - `import_declared_snapshot` into a new, empty estate C answers `COMMITTED … estate.imported@1 {"events":1}`. Afterwards C has `projects in C: 0`, and A's project has been renamed `from mirror`.
- Reach: `projects.create` checks the id only inside the active estate (`index.ts:898`). Workspace import keeps the mirror's project ids by design (`workspace.ts:280-330`). So adopting a workspace folder written by another estate on the same database silently edits that estate.
- `memory_facts` has the same shape.
- Fix: add `where projects.estate_id = excluded.estate_id` to the `do update`, or refuse in `append_event` when the id belongs to another estate. Add a planted test.

**2. `ci.sh full` is not isolated, so I did not run it.**
- Level: harness. Severity: **blocking** for the release verdict.
- What it does (`scripts/ci.sh:440-447`):
  - `supabase start`
  - `supabase migration up --local`, which mutates the schema of the stack the desktop uses. `env.ts` uses project_id `fabric` and port 54321 for both dev and packaged builds.
  - `pnpm -r test`: about 40 probes connect with the service role through `supabase status` taken from the repository root (e.g. `identity.test.mjs:229`). They ignore any override, so they cannot be pointed at another stack.
  - `planted.test.mjs:383` runs `create table _p19_probe` in `public`.
- The probes write random-id estates, persons, projects and journal rows, and clean up only part of them. Their deletes are keyed on random ids, so nothing of the operator's is deleted. I checked every fixed id: `policy.test.mjs:296` only reads org #1.
- Measured residue in the live database:
  - 768 estates
  - 3 540 projects (org #1 holds only 2 of them: "Fabric Agent", plus "Walk fixture" from 2026-09-10)
  - 996 persons
  - the operator is owner of 120 estates, 39 of them named "org #1" (left by walks, `index.ts:444-454`)
- `planted.test.mjs` P24 hashes whole tables across all estates, so a running app can make it flake (inferred).
- Fix: point the full tier at a disposable stack (its own `project_id` and ports, or an owned cluster plus PostgREST), and let the probes honour `SUPABASE_URL`.

**3. The safe database suites are run by neither tier.**
- Level: harness. Severity: major.
- Evidence: 11 `apps/desktop/test/run-*-db.mjs` runners each own a temp cluster (`initdb`, `listen_addresses=''`). `grep run- scripts/ci.sh` finds none of them; they exist only as `package.json` scripts.
- I ran all 11 and **all exited 0** (`owned-db.log`, 146 PASS lines). Their own NOT_RUN lines: native export and import, active-estate restart, HTTP/MCP transport.
- Fix: add them to the fast tier.

**4. Chain followers can start before their predecessors finish, and a failed read is treated as "nothing waiting".**
- Level: orchestration. Severity: major.
- Evidence: `chainAdvance.ts:120-124` runs `select('task_links',…)`, which is unpaged and has its `error` dropped. PostgREST caps responses at `max_rows=1000` (`config.toml:18`). The probe estate already holds 686 `follows` rows.
- The same fail-open pattern sits on the spawn-link read that the loop bound uses (`:261-266`). When that read fails, the M68 runaway guard is gone.
- Further defects from the same review:
  - The quota claim happens before admission (`:243` vs `:299`).
  - A failing step rethrows (`:357-372`) and is retried every tick, without limit.
  - `cycle.ran@1` records `completed` while chains were unreadable (`index.ts:1780`).
- Fix: page the read, check the error, claim the quota last, continue past a failing follower with a cap, and return a tick result.

**5. `runLifecycle` is never called, and its test expects a reason the SQL cannot return.**
- Level: orchestration/harness. Severity: major.
- Evidence: `runs` is assigned at `index.ts:1700`, but nothing calls `bind`, `end` or `reconcile`.
- `run-lifecycle.test.mjs:131` expects `already_bound`. The live `bind_task_run` returns only `session_conflict` (lines 21 and 26). So the full tier is red on this test (inferred, not run).
- Fix: wire the module or delete it, and correct the expected reason.

**6. Repeating a create clears the project's folder.**
- Level: data. Severity: major.
- Evidence: `index.ts:898` reads `const { data: already } = …maybeSingle()` and ignores `error`. A failed read therefore appends a second `project.created@1` carrying `repo_path: null`.
- Probe: after the repeat, `repo_path=NULL` while one primary `project_repos` row remains, and `rebuild_estate_projections` reproduces the NULL.
- `attachRepos` then skips the known path, so `projects.start` refuses with "Choose an available project folder" (`index.ts:2365`).
- Fix: throw on the read error, and make the `do update` keep `repo_path` (it is derived from the repos).

**7. The start paths attach unchecked paths, and the root set is not refreshed.**
- Level: boundary/data. Severity: major.
- Evidence: `projects.create` and `repos.attach` pass the renderer's `repoPaths` straight to `attachRepos` (`index.ts:775-789`), with no `fileRoots.resolve`, no existence check and no absolute-path check.
- `refreshFileRoots()` (`:742`) then turns every attached path into a root, so `repos.attach(id, ['/'])` would grant the whole disk.
- `projects.create` never calls `refreshFileRoots` (it is called only at `:474`, `:3425` and `:3437`). Every project made through the new start paths is therefore missing from the global roots and the git watch until a restart.
- Fix: resolve each path against the window's grants inside `projects.create` and `repos.attach`, then refresh.

**8. "Create a new folder" can leave a folder behind that cannot be used.**
- Level: data/error. Severity: major.
- Evidence: `startPaths.ts:70-83` runs `mkdirSync`, then a synchronous `git init`. Probe `create-folder-partial.mjs` shows:
  - first try: `{"ok":false,"reason":"failed","detail":"spawnSync git ENOENT"}`, with the folder left on disk
  - retry: `reason: "exists"`
- On a fresh Mac without Command Line Tools, `/usr/bin/git` is a stub that fails, so this is realistic.
- The call also blocks the main thread for up to 10 s, against the M101 rule.
- `createProjectFolder`, `keepScan` and `lastScan` have no tests.
- Fix: remove the folder on failure, or report "created, not a repository". Make the call async, and add tests.

**9. A scan silently skips unreadable folders and still reports a complete list.**
- Level: data/error. Severity: major.
- Evidence: `projectDiscovery.ts:166-170` (`catch { return }`). Probe `scan-unreadable.mjs` returns `{"candidates":["visible"],"truncated":false}` while a repository under a `chmod 000` folder is missed.
- Folders protected by macOS privacy permissions (TCC) behave the same way. This contradicts the module's own claim that "a partial list is never returned as if it were the whole folder".
- Fix: count skipped folders and report them, or set `truncated`.

**10. A failed first quota read tells the operator they are not signed in.**
- Level: harness. Severity: major.
- Evidence: `quota.ts:232`, `:237` and `:240` return `null` when nothing is cached. `QuotaPanel` shows `null` as "Claude Code is not signed in".
- Fix: return a reading with `problem` set.

**11. Reported by a sub-review, and not re-verified by me:**
- `contextPack` `mandatory`/`unmetMandatory` is never enforced on unattended starts (`contextPack.ts:95-103`, `index.ts:500-543`).
- Search reports `method:'ranked'` without ordering by rank (`searchRead.ts:129-144`), which conflicts with backlog row M141.
- Search builds an unescaped `or()` filter (`:114-124`).
- Backlog row M48 is "shipped" while its tiered fact read is not built.
- `pastContext.ts:54` puts the session id into a path without validating it.

**12. Unbounded reads in the new region.**
- Level: data. Severity: minor.
- Evidence: `importedIndex` (`index.ts:2817-2830`) and `refreshFileRoots` select every `project_repos` and `projects` row. Past 1000 rows, an imported folder looks new and the name falls back to the id.
- `importedBy` also counts archived projects, which `projects.list` hides. That is latent: no writer of `project.archived@1` exists.

## Checked and found correct
- `importedBy` goes through the estate-scoped store (`scope.ts:90,137`), so it cannot leak projects across estates; `check-scope` exits 0.
- A repeated create with the same id is idempotent: `ids.current[p] ??=` and the draft's `projectId` keep the id. A duplicate path attach is refused by the database (`project_repos_unique_path`).
- `lastScan` records an unrecorded truncation as truncated.
- Walk overrides are honoured only when unpackaged.
- These gates exit 0: check-scope, list-reads, commands, plan-ids, registers, shipped-receipt, written-never-read, coverage-reads, ops.
- These pure suites exit 0: project-discovery, executor-detect, delivery, onboarding-drafts, harness-read, memory-overview-read, search-read, list-reads, digest-boundary, liveness-callers, project-settings.
- `repin-provider-builds` never carries a verdict across builds.
- `deliveryQueue` fences, `continuation_dispatch`, and the `managedLaunch`/`managedStop` compensation hold.

## Could not check
- `ci.sh full` and every `pnpm -r test` probe that needs the live database: not isolated (finding 2).
- The browser suites and the Electron walk: these are other reviewers' levels and write to the live database.
