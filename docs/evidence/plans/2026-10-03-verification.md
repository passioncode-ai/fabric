# Release verification — three independent iterations (P-02)

Run `2026-10-03-onboarding-and-plan`. The operator's rule (2026-10-03): before the DMG and the release,
three independent testing iterations across every level of the project, every finding fixed, and only
then the release. This file is the ledger; the plan row is
[P-02](../backlog.md#general-development-plan).

## Protocol

- **Independent** means each iteration is read by fresh reviewer agents that have not seen an earlier
  iteration's findings or fixes. They read the product and the code first and form their own findings;
  only then is the ledger compared, and a finding an earlier iteration already closed is checked again
  rather than skipped.
- **Levels**, each with its own reviewer per iteration:
  1. *Scenarios, UX and UI* — every SCN/FLW/SCR of the change against the live app and the code;
     every state drawn; visual language, layout, noise; light and dark.
  2. *Errors and boundaries* — failure behaviour of every new path, the file-root boundary, retries,
     idempotency, cancellation, the main-process event loop.
  3. *Code ↔ documentation* — `#region … docs:` markers, ADRs, scenarios, CONTEXT terms, the design map,
     the knowledge base; every claim with its receipt.
  4. *Data, memory, orchestration, harness* — the whole project's stack-backed tier (`ci.sh full`),
     the journal and projections, memory, runs and the provider harness.
  5. *Plan and roadmap* — the general plan, the backlog, the workspace publication.
- **A finding** gets an id `V<iteration>-<n>`, its level, evidence (file:line, command and output, or a
  screenshot) and a disposition: **fixed** (with the commit and the test that now catches it),
  **ruled** (a register row id and the reason it is not a release blocker), or **not a defect** (with
  the measurement). A count is never a disposition (R-002).
- **Exit.** The release proceeds only after iteration 3 ends with zero open findings marked blocking.

## Iteration 1

Five fresh reviewers, 2026-10-03, against `0ca25630..8c0da657`. Reports, kept as written:
[scenarios/UX/UI](2026-10-03-verification/iteration-1/2026-10-03-ux.md) (UX-n), [errors and boundaries](2026-10-03-verification/iteration-1/2026-10-03-errors.md) (ER-n),
[code ↔ documents](2026-10-03-verification/iteration-1/2026-10-03-docs.md) (DO-n), [data, memory, orchestration, harness](2026-10-03-verification/iteration-1/2026-10-03-data.md)
(DA-n), [plan and workspace](2026-10-03-verification/iteration-1/2026-10-03-plan.md) (PL-n). Fixes landed on `claude/onboarding-and-plan` in
`c6fc3d2c` (start paths, agent form, plan gate), the merged `claude/release-review-fixes` (`90b012dc`…`745ba358`,
data and orchestration), the merged `claude/ci-full-disposable-stack` (`c0f7339f`, the full tier), and the commit
that carries this section. "Watched" names the planted defect a test caught (R-006).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1, DA-11 | The first new project opened on a digest error: the read named `memory_facts.supersedes`, which does not exist | fixed `cb3a4757`; `read-schema-db.test.mjs` checks all 462 selected columns against the real schema (watched: the old read fails) |
| V1-2 | UX-2, ER-8, DO-9 | "Tick all shown" made worktrees and nested repositories separate Projects; SCN-128's rationale was false | fixed `c6fc3d2c`: parts are not tickable, a ticked part warns; walk asserts the worktree stays unticked |
| V1-3 | UX-3 | "Nothing is written until you save" while Create a new folder writes at once | fixed: `onboarding.lede` says the folder is made at once |
| V1-4 | UX-4 | Codex shown "ready" though Fabric does not reach its session | fixed: rows carry `connected`; found-unconnected reads "installed" with a note (`executor-detect.test.mjs`, watched) |
| V1-5 | UX-5, DO-14 | The chosen name was shown nowhere | fixed: `FabricName` in the launcher, board and project; editable on the persona screen |
| V1-6 | UX-6 | "Not added: 0" summary when nothing failed | fixed: `importedAll` / `importedSome` |
| V1-7 | UX-7 | Focus never moved to a step's heading | fixed in FirstRun and StartPaths |
| V1-8 | UX-8 | An unresponsive agent was offered an install command | fixed: run-once advice, install only when missing |
| V1-9 | UX-9 | "Add N as projects" only at the end of a long list | fixed: sticky footer |
| V1-10 | UX-10 | The walk passed over screens showing an error | fixed: `visibleError()` fails a step on a visible banner |
| V1-11 | UX-11 | The new-project form keeps the older visual language | ruled CO-179 — not a release blocker: the form works and is reachable; restyling it is the AD20 shell work |
| V1-12 | UX-12 | A failed row's reason hid in `title`; a button nested in the label | fixed: visible reason with `role=status`; the button sits outside the label |
| V1-13 | UX-13 | Russian copy: "Project", "worktree", «эстейт» | fixed the first two; «эстейт» across the app is CO-178 |
| V1-14 | UX-14 | Convert steps lost their numbers | fixed: list-item display |
| V1-15 | UX-15 | Group heading uppercased names, "and its parts", "Add 0", ticked count included hidden rows | fixed: no uppercase, "· N folders", "tick to add", a hidden-ticked count in the footer |
| V1-16 | UX-16 | Screen and scenario state lists disagreed; cancel went back silently | fixed: SCR-70/72/73 state rows match SCN-126/128/129; a stopped scan says so |
| V1-17 | UX-17 | A failing first-run settings write left step 3 stuck; blocking git init; an editable name on the duplicate page; two selection styles; the ⌕ glyph | fixed: try/catch with the reason, async git init, no name field for a held folder, one ink selection style, ≡ |
| V1-18 | ER-1 | Scanning ran programs named in a repository's own git config (signature, pager, fsmonitor, hooks) | fixed: `SAFE_GIT` and `SAFE_ENV`; `project-discovery.test.mjs` signature case (watched: removing `SAFE_GIT` runs the program) |
| V1-19 | ER-2 | A scan of ~/DATA found a quarter of it | fixed: breadth-first walk with honest totals; measured 215 candidates, 129 of 130 top-level repositories, 5.3 s |
| V1-20 | ER-3, DO-7 | The kept scan granted its root to any window across restarts | fixed: shown, never granted; ADR-0100 §7 corrected |
| V1-21 | ER-4 | Credentials in remote URLs shown and saved | fixed: `shownRemote`; the walk asserts no `ghp_` reaches the facts |
| V1-22 | ER-5, DA-7 | `projects.create` attached unchecked paths and did not refresh roots | fixed: absolute, real, directory, or refused; roots refreshed on both branches |
| V1-23 | ER-6, DA-8, DO-11 | A failed git init left the folder and blocked the main process | fixed: async with a timeout, the folder removed (`start-paths-main.test.mjs`, watched) |
| V1-24 | ER-7 | The parent pick granted its whole tree | fixed: recorded per window, never granted; iteration-1 follow-up found the revocation on close was claimed and missing — `startChoices.ts`, revoked in `revokeWindowRoots` (watched) |
| V1-25 | ER-9 | Stop and the deadline could not interrupt a stuck filesystem call | fixed: each directory read races a timeout and counts as unreadable |
| V1-26 | ER-10 | Some skipped folder names dropped repositories silently | fixed: a skipped name is still reported when it holds `.git` |
| V1-27 | ER-11, DA-12 | "Already in a project" was an exact string match over an unpaged read | fixed: `indexImported` by real path over `selectAll` pages (watched) |
| V1-28 | ER-12 | Scan races: a late kept list replaced a running scan | fixed: the kept list fills only an idle screen; leaving cancels |
| V1-29 | ER-13 | Executor detection edge cases (directories, orphaned children, output size) | fixed: files only, process-group kill, 64 KiB cap (watched) |
| V1-30 | ER-14 | Raw IPC error text reached the operator | fixed: the app's one rule, `shared/errorText.ts` (R-005: the start paths' second copy removed) |
| V1-31 | ER-15 | Onboarding new-folder path could double-fire | fixed: busy guard |
| V1-32 | ER-16, DO-10 | New code without tests; `start-paths-main.test.mjs` was in no tier | fixed: tests for each module; the file runs in `ci.sh fast` |
| V1-33 | DO-1, PL-3 | ADR-0100 reversed ADR-0063 and ADR-0065 without saying so | fixed: ADR-0100 states the amendments; the index marks them |
| V1-34 | DO-2 | The app-icon region pointed at a doc that never mentions the icon | fixed: ADR-0100 §8 |
| V1-35 | DO-3 | A false "built" citation (SCR-73 `NewProject`); coverage and cross-links disagreed | fixed: product model and inventory re-derived; SCR-71…74 name P-01, not P-02…P-05 (P-05 is a persona). `task_ids` holds engineering tasks of `system.html` only — not a defect |
| V1-36 | DO-4 | REQ rows unmet but not marked | fixed: [REQ status](2026-10-03-onboarding-and-plan.md#req-status-after-iteration-1) appended to the brief |
| V1-37 | DO-5, PL-12 | The handoff was stale | fixed: [handoff](../../handoffs/2026-10-03-onboarding-and-plan.md) rewritten for this state |
| V1-38 | DO-6, PL-5 | Deferrals had no ids | fixed: CO-176…CO-184 |
| V1-39 | DO-8 | The depth limit stopped silently | fixed: `deep` is counted and said |
| V1-40 | DO-12 | Living documents stale (FLW-55, SCN-095, SCN-015, SCN-122) | fixed: amendment notes link ADR-0100 and SCN-131 |
| V1-41 | DO-13 | Glossary gaps | fixed: CONTEXT gains Coding agent, First run, Start path, Candidate |
| V1-42 | DO-15, PL-7 | The plan gate ignored ids outside its regex | fixed: unknown id forms, empty lanes and finished work fail (`plan-ids.test.mjs`, watched on the real plan) |
| V1-43 | DO-16 | The Claude Code install command was not the vendor's | fixed: the native installer |
| V1-44 | DO-17 | English folder-name problems in the Russian window; a wrong run id in the ADR index; two regions pointing at non-specs | fixed: problem codes translated in each window; `r-07dbb329a`; regions point at ADR-0100 and the REQ table |
| V1-45 | DA-1 | An event in one estate rewrote another estate's project | fixed `90b012dc` (migration 70): refused at the door, skipped by the projector (`estate-identity-db.test.mjs`, watched: 9 of 9 fail without it) |
| V1-46 | DA-2 | `ci.sh full` wrote into the operator's live stack | fixed `c0f7339f`: a disposable stack and a three-place guard against live ports (watched) |
| V1-47 | DA-3 | The owned-database suites ran in no tier | fixed: 11 in the full tier, 2 in the fast tier |
| V1-48 | DA-4 | Chain followers could start early; a failed read meant "nothing waiting" | fixed `cb4839cc` and the cycle receipt now carries the chain pass's state (`chain-advance-reads.test.mjs`, watched) |
| V1-49 | DA-5 | `runLifecycle` was never called; its test expected an impossible reason | fixed `137a59a4`; startup reconcile now records unobserved runs |
| V1-50 | DA-6 | A repeated create cleared the project's folder | fixed: the read error throws; migration 70 derives `repo_path` |
| V1-51 | DA-9 | Unreadable folders were skipped while the list claimed completeness | fixed: counted and said |
| V1-52 | DA-10 | A failed first quota read said "not signed in" | fixed `8209d923` (`quotaHonesty.test.tsx`, watched) |
| V1-53 | DA-11 | Mandatory context unenforced; search `or()` injection; session ids as paths; search called "ranked" without ranking; M48 shipped with its remainder open | fixed `47c8d804` and the context wiring; search now `words`, newest first (watched); M48 corrected to partly shipped, remainder CO-183 |
| V1-54 | full tier | Migrations 63/64 re-created `append_event` without `lock_timeout` or the event-type check: P13 accepted a violation, P14 hung | fixed: migration 71; `check-design.mjs` now fails on an appended type nobody registers (watched); the restored check refused a forged boundary event in `restore-authority-db.test.mjs`, which now asserts the refusal |
| V1-55 | full tier | A hung probe kept the full tier running forever | fixed: `scripts/with-timeout.mjs` around `pnpm -r test` (`with-timeout.test.mjs`) |
| V1-56 | full tier | An orphaned `pnpm -r test` from 03:10 held an open transaction on the live database | stopped during this iteration (2026-10-03); afterwards no idle-in-transaction session or lock wait remained on the live database |
| V1-57 | harness | Two manual probes still use the live stack | ruled CO-182 — not in any tier, so no release run touches the live stack |
| V1-58 | data | Creation events naming a foreign id are ignored, not refused, outside migration 70's tables | ruled CO-184 — no overwrite path remains |
| V1-59 | PL-1, PL-10 | Lane 5 scheduled finished work; the launch programme was in no lane | fixed: eleven lanes cite only open work (FR-A…G, AD02…AD24, AR, MEM-P, F5, F7) |
| V1-60 | PL-2, PL-8 | Lane entry rules added gates the dependency map lacks | fixed: each rule states the register's own prerequisite |
| V1-61 | PL-4 | P-01 duplicated register rows | fixed: P-01 names the rows it delivers parts of; they keep their own status |
| V1-62 | PL-6 | The common backlog would show P-01 as unknown | fixed: statuses read `partial`, `open`, `blocked`, `done` by the workspace's own `normalizeStatus` (measured) |
| V1-63 | PL-9 | The plan was reachable from no entry point | fixed: AGENTS.md, README, DOCMAP, docs/launch/README.md |
| V1-64 | PL-11 | The design map was not current | fixed: `#screens` counts 75 and shows SCR-70…75; a top entry links the changed anchors |
| V1-65 | PL-12 | No now/next marker; `knowledge/plans.md` says AR-1 done | fixed the marker; the knowledge-base page is corrected in the fabric-workspace PR at landing (P-03) |
| V1-66 | DO-5 | The operator's transcript export moved to the scratchpad was lost when it was cleared | not recoverable; the operator was told 2026-10-03 |
| V1-67 | REQ-11 | 110 new strings had no registry row | fixed: 159 rows registered; registering them exposed ten copy defects (sentence case, dashes), fixed; brand lint 0 errors, warnings 1464 against 1468 at the base |
| V1-68 | REQ-06 | The agent form had not been touched | fixed: `CreatedAgents.tsx` with every state and `CreatedAgents.test.tsx` (watched: three plants); one agent per name enforced by the handler |

Exit for iteration 1: every finding above is fixed or ruled with a register id. Blocking findings open: none.

## Iteration 2

_Not started._

## Iteration 3

_Not started._
