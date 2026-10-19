# Fabric status and next task (2026-10-19)

The operator's instruction of 2026-10-19, relayed by fabric-workspace on the project board (thread `bd1c9611`): every
coding agent reports its state, then continues its work. The same report was posted there (message `78e94e3c`).
Measured on `origin/main` at `42aad991`.

**Status:** 0.3.6 released and installed; 0.3.7 "simple" in progress, waves 0 to 3 of 5 on `main`; hosted `ci` green
on `42aad991` (run 39214466516); `workspace publication` red since 2026-10-17 (see Blocked by).

**What we worked on (since v0.3.6, 2026-10-15):** P-19 / 0.3.7 waves ([plan](../evidence/plans/2026-10-15-fabric-simple/README.md));
RM-09 automatic project registration ([ADR-0164](../adr/0164-a-folder-with-no-project-is-attributed-by-fabric-never-handed-to-the-person.md));
the operator's one attribution across Fabric, Switchboard and Observatory
([ADR-0166](../adr/0166-one-attribution-of-folders-to-projects-across-fabric-switchboard-and-observatory.md), CO-331);
the hub's rate limits (CO-334); the local stack's excluded containers (CO-333); CO-323; FAB-H01.

## Done (merged on `main`, not yet released)

- 0.3.7 wave 1 (scenarios and prototype) `e8fb4fd8`; wave 2 (every operator act with its inverse, the История read)
  `f913eef4`; wave 3 (the five-place rail, Создать, no confirmation dialogs, the act line with Отменить, Отключить as a
  real inverse) `df9edcc6`.
- Automatic project registration (a Git or plain folder becomes a project, worktree and clone join, detach tombstone,
  schema 92) `238714df`, `8bdad97c`.
- ADR-0166 part 1 (a subfolder rooted at its Git top level, a tombstone per folder) `f7c71cba`; the cross-repository
  run is org-index `docs/runs/2026-10-19-unified-attribution` (`5fb77fe`, `03ee611`).
- CO-334 (the enrollment cap per project, a ceiling of 64 per binding, a call budget per coding-agent session,
  Retry-After jitter) `42aad991`; CO-333 (excluded Supabase containers removed at stack start) `f7fa9ee2`; CO-323
  `61dceffd`; FAB-H01 `c38bb516`.

## Left, in priority order

1. 0.3.7 wave 4: the five places rebuilt to the prototype, onboarding in the new frame, the walk on a disposable stack.
2. 0.3.7 wave 5: three verification iterations, CHANGELOG, tag `v0.3.7` (released by checks, ADR-0145).
3. CO-322: the always-on lifecycle rule and the self-updater with the 5-minute check (board threads `cb31a510`,
   `92c37fc0`). P-12 in the general plan still says 0.4.0; reconcile before the release.
4. CO-331's remainder (contract vectors, `projects.observatory_id`, Observatory's attribution call), waiting on the
   owners on thread `617c8cbe`; CO-329 (owner and work rules).
5. CO-324, CO-325, CO-326 (harness host gaps); CO-327; CO-335 (refusals logged as failures).
6. CO-336 (DEC-0087, the hub as a caller of jobs), CO-337 (SD-2 TA-04, run in the cloud and organizations), CO-338
   (SD-1 PA-02 with Vesta), filed today.

## Blocked by

- **Workspace publication.** The local publish runs the whole fast gate on this machine, and under load (average 30
  to 200) its timing tests fail or the run times out: 2026-10-19 `delivery.test.mjs` (fixed in `7108574f`), a 1800 s
  timeout, then `git-lease-snapshot.test.mjs`. Not a code defect.
- **The machine's disk:** about 2.4 GB free; OrbStack crashed three times on 2026-10-19 with I/O errors and took the
  local database down (restored by reconnecting it to its network). Freeing the large volumes is the operator's call.
- CO-331's remainder waits on fabric-agent-contract, project-observatory and fabric-switchboard (thread `617c8cbe`).

## When it can ship

0.3.7 after wave 4 and wave 5's three verification iterations; no human approval (ADR-0145). Gates: hosted `ci` per
landing, the three review iterations, the release run. Estimate: two to three working days, if the machine's disk
and load allow the local verification runs.

## Exact next task

Make the workspace publication robust under load (it should not need a quiet machine to publish a commit whose hosted
`ci` is already green), then 0.3.7 wave 4 from the plan's §6.
