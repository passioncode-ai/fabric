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

Five fresh reviewers, 2026-10-03, against `0ca25630..57f4080c`. Reports, kept as written:
[scenarios/UX/UI](2026-10-03-verification/iteration-2/2026-10-03-ux.md) (UX-n), [errors and boundaries](2026-10-03-verification/iteration-2/2026-10-03-errors.md) (ER-n),
[code ↔ documents](2026-10-03-verification/iteration-2/2026-10-03-docs.md) (DO-n), [data, memory, orchestration, harness](2026-10-03-verification/iteration-2/2026-10-03-data.md)
(DA-n), [plan and workspace](2026-10-03-verification/iteration-2/2026-10-03-plan.md) (PL-n). Two reviewers disclosed that a grep showed them
a line of an iteration-1 report before their findings were written; neither finding depended on it.
Fixes: `a58639e6` and the commit carrying this section (renderer, plan, release gate, ADR-0103), the merged
`claude/iter2-data-fixes` (`2994d790`…`76192afc`) and `claude/iter2-boundary-fixes` (`4e78f020`…`16426c0d`).
Each "Corrects V1-n" names an iteration-1 disposition this iteration found untrue.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | DA-1 | Hand-offs and heartbeats still accepted another estate's ids; migration 70's header overclaimed | fixed `2994d790` (migration 72; every create keyed on a global id refused at the door) — ADR-0103; `estate-identity-db.test.mjs` (watched: 11 failures without 72). Corrects V1-45 and V1-58; CO-184 closed |
| V2-2 | DA-2 | `ci.sh full` failed at HEAD (P21, P32, usage-observation) and `&&` chains hid ~50 suites | fixed `d0f15d62`: P21 reads `scope.ts`-private tables, P32 ends through managed stop, usage-observation expects the problem reading; `scripts/run-test-chains.mjs` runs every suite and fails listing each (95 ran, 94 passed in the worktree; the one was a missing build). Corrects V1-46/54/55 |
| V2-3 | DA-3, DO-6 | File roots refreshed from one capped page | fixed `148ba023` (`fileRootsRefresh.ts`: every page, or the roots stay; watched "reset to 1000 of 2500"). Corrects V1-22 |
| V2-4 | DA-4 | Search labels from a capped read with no error | fixed `99625313` (labels for exactly the hits' projects; a failed read sets `labelProblem`) |
| V2-5 | DA-5 | Journal lookups scanned the estate's journal every cycle | fixed `2994d790` (four partial indexes; EXPLAIN uses each); `contextDemandFor` no longer reads the journal |
| V2-6 | DA-6 | Foreign ids journalled then skipped in ~12 projector arms | fixed `2994d790` (refused at the door) |
| V2-7 | DA-7 | Context requirement guessed from the journal; missing project counted as met; facts uncounted | fixed `bbd0a1d1` |
| V2-8 | DA-8 | Port race, walk temp folders, uncounted launch failures, offset paging, agent-name race | fixed `3a988153`, `c32459b4`, `6fec77d9`, and one agent per name under the estate lock (`2994d790`); offset paging ruled CO-185 |
| V2-9 | UX-1 | Codex called "Terminal" in five selects | fixed: `runnerLabel.ts` at every call site (`runnerLabel.test.ts`). Corrects V1-4 |
| V2-10 | UX-2, ER-2 | SCN-127's "refused by main" claim false; `projects.create` exposed any folder to every window | fixed `dd2ca23b` (`admitRepoPaths`: the calling window's roots or its scan's candidates; refused before journalling; watched "the disk root is refused"); refusal codes translated in the renderer |
| V2-11 | UX-3 | Focus never moved on the start paths or in the agent form | fixed: each path's heading, the name field on open, the confirmation after create (tests watched). Corrects V1-7 |
| V2-12 | UX-4 | The section route broke the layout | fixed: `revealSection` waits for the section, scrolls only its container, focuses its heading; the sidebar marks the section |
| V2-13 | UX-5, DO-13 | One concept, several names; "agent" meant two things | fixed: "coding agent" for runners (en, ru), CONTEXT and terminology rows |
| V2-14 | UX-6 | A created agent's row showed `CLAUDE-CODE` | fixed: `runnerLabel` |
| V2-15 | UX-7, ER-10 | Raw IPC text in Onboarding and FirstRun; kept-scan failure dropped | fixed: `errorText`/`explainError`; the scan screen says an unreadable kept list. `onError(String(e))` calls reach `OperatorError`, which unwraps (M106c) — not a defect. Corrects V1-30 |
| V2-16 | UX-8 | Failures looked like information | fixed: alert callouts and `.st-warn` in the danger tone; `field-problem` for field errors |
| V2-17 | UX-9 | "N not added yet" counted parts | fixed (watched) |
| V2-18 | UX-10 | Agent form semantics | fixed: `FieldGroup` for servers, `aria-describedby`, `aria-invalid`, an empty-name reason, the existing agent's name in the duplicate message |
| V2-19 | UX-11 | Copy defects | fixed: no "Found means", no literal backticks, counts without plural errors, parts instead of "products", one casing of project, first-person lede, no second numbering, no repeated authority line. Corrects V1-13 |
| V2-20 | UX-12 | Visual consistency | fixed the uppercase card label and the sentence-case pills; the prototype's hard-coded pill size and the form's native controls are ruled CO-169 / CO-179 (the design-system adoption and the form restyle). Corrects V1-17 in part |
| V2-21 | UX-13 | Navigation marked home on start screens | fixed: start screens mark "+ Project"; the first run marks nothing |
| V2-22 | UX-14, DO-9 | Screen and flow state tables disagreed with scenarios and code | fixed: SCR-70…73, FLW-69…72, SCN-128/129/131 coverage. Corrects V1-16 |
| V2-23 | UX-15 | Dead CSS | fixed: removed |
| V2-24 | UX-16 | New agent listed archived projects | fixed |
| V2-25 | UX-17 | Create while options unread; Check again race; silent clipboard; "0 so far" | fixed (tests watched) |
| V2-26 | UX-18 | A made folder stayed silently on Remove/Cancel; no busy label | fixed: a "new folder" chip, a stays-on-disk note, a busy label |
| V2-27 | ER-1 | A partial clone ran its uploadpack during the scan and the repo watcher | fixed `4e78f020` (one hardened `gitRun`: no lazy fetch, no transport, repository filter/diff drivers neutralised — the filter driver found while fixing it); watched in both callers. Corrects V1-18 |
| V2-28 | ER-3, DO-1 | Depth-skipped folders counted and never said | fixed: deep and symlink notices on the scan screen (tests). Corrects V1-39, V1-51 |
| V2-29 | ER-4 | A hung filesystem could hang the scan | fixed `e021c4db` (no sync or untimed fs; the walk races Stop and the deadline; watched "Stop returned in 60003 ms") and the renderer leaves scanning at once on Stop. Corrects V1-25 |
| V2-30 | ER-5 | The agent list stuck in "reading" under StrictMode | fixed (a StrictMode test that fails on the old ref) |
| V2-31 | ER-6 | The test-stack guard could be bypassed | fixed `3a988153`. Corrects V1-46's guard claim |
| V2-32 | ER-7 | with-timeout reported every signal as 143 | fixed `d2e0f1df` |
| V2-33 | ER-8 | Detection misread versions, left children, missed version-manager installs | fixed `74d5716a`; sessions now get the same widened PATH (`env.ts#fixPath`). Corrects V1-29 |
| V2-34 | ER-9 | New-folder refusals without their reason | fixed `c258ce6d` |
| V2-35 | ER-11 | A `.git` symlink read as a plain folder | fixed `e021c4db` |
| V2-36 | DO-2 | The handoff's next command failed; walk statuses disagreed | fixed: the handoff and REQ status name `scripts/test-stack.mjs run --` and the walk receipts. Corrects V1-37 |
| V2-37 | DO-3 | New code without regions; migration 70's rule unspecified | fixed: 40 region markers, migrations 70–72 point at ADR-0103 |
| V2-38 | DO-4, DO-7 | README claims about probes and the runner count | fixed |
| V2-39 | DO-5 | Unregistered strings | fixed: every new key registered; brand lint 0 errors, 1457 warnings (1468 at the base). Corrects V1-67 |
| V2-40 | DO-8, DO-11 | ADR-0100 cited a moved file; "one folder" claim | fixed: ADR-0100 §5 and §7 (reusable parent, per-window admission) |
| V2-41 | DO-10 | Only http(s) remotes lost credentials | fixed `16426c0d`. Corrects V1-21 |
| V2-42 | DO-12, PL-11 | P-02 status stale | fixed |
| V2-43 | DO-14 | Region markers at the generic `#decision` | fixed: ADR-0100 items carry anchors; markers point at SCN, SCR or the item |
| V2-44 | DO-15 | The icon check ignored the mark | fixed: `build-app-icon.mjs --check` compares `markSha256` (watched) |
| V2-45 | PL-1 | The plan gate missed closing words, packet statuses and P-id collisions | fixed: the workspace's vocabulary (agreement tested), `Status:` lines and receipts, P-ids only from the plan table (each planted case watched). Corrects V1-42 |
| V2-46 | PL-2 | Lane entry rules added gates | fixed: lanes 3, 5, 6 restate their registers. Corrects V1-60 |
| V2-47 | PL-3 | Three different "now" tasks | fixed: launch README, harness README, CLAUDE.md point at Now/Next. Corrects V1-63 |
| V2-48 | PL-4, PL-12 | ADR-0101 changed ADR-0044 while claiming not to; §2 drifted | fixed: ADR-0101 amends ADR-0044 §1, §2 lists every form, §5 states the in-lane order |
| V2-49 | PL-5 | Registers P-01 delivered into were not updated | fixed: dated notes on AR-2.1, AD24, FR-A/B/C; ADR-0100 propagated into the strategy. Corrects V1-61 |
| V2-50 | PL-6 | M199 rows stale; lane 5 scheduled landed work | fixed: rows follow the merge log; lane 5 names M199.ui and M199.acceptance |
| V2-51 | PL-7 | Open work in no lane; two "lane" systems | fixed: lane 12 (CO-112, CO-158, CO-165, CO-169, CO-173, CO-175); the roadmap's column is "Track". Corrects V1-59 |
| V2-52 | PL-8 | The common backlog could not show lanes 3, 4, 7 | fixed: FR and the adoption module tables declared (collector run: FR-A…G and modules present); N1 ruled CO-186 |
| V2-53 | PL-9 | Nothing enforced the release gate | fixed: `scripts/release-mac.mjs` refuses without `docs/launch/release-gate.json`'s ledger exit (`release-gate.test.mjs`, watched) |
| V2-54 | PL-10 | 0.3.0 before N1 | fixed: P-03 states that 0.3.0 ships detection without real-provider acceptance; N1's Claude half may run inside P-02 |
| V2-55 | PL (KB) | Knowledge-base pages | ruled: corrected in the fabric-workspace PR at landing (P-03), as V1-65 records; `knowledge/plans.md` AR-1 partial, AR-2 lane 6, a link to the plan |

Exit for iteration 2: every finding above is fixed or ruled with a register id. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-03, against `0ca25630..c8debcaa`. Reports, kept as written:
[scenarios/UX/UI](2026-10-03-verification/iteration-3/2026-10-03-ux.md) (UX-n), [errors and boundaries](2026-10-03-verification/iteration-3/2026-10-03-errors.md) (ER-n),
[code ↔ documents](2026-10-03-verification/iteration-3/2026-10-03-docs.md) (DO-n), [data, memory, orchestration, harness](2026-10-03-verification/iteration-3/2026-10-03-data.md)
(DA-n), [plan and workspace](2026-10-03-verification/iteration-3/2026-10-03-plan.md) (PL-n). Each wrote its findings before opening this ledger.
Fixes: `edaca6cf`, `b655128c` and the commit carrying this section, the merged `claude/iter3-boundary-fixes`
(`362514c4`…`887ed3ee`) and `claude/iter3-data-fixes` (`83bed0dd`…`dae92af3`, migration 73).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | DA-1 | Another estate could take over a session started by managed launch (heartbeat, stage) | fixed `83bed0dd` (migration 73: a session held in any of six tables belongs to its estate; `admit_task_launch` cases watched failing without 73). Corrects V2-1, V2-6 |
| V3-2 | DA-2 | A declared import with case-duplicate agent names failed whole | fixed `83bed0dd` (`declared_import_authorizations` exempts the import; watched "refused whole"); migration 72's false sentence corrected in 73's header |
| V3-3 | DA-3 | Heartbeat rows the old projector moved could never come back | fixed `83bed0dd` (`repair_foreign_heartbeats()`; a rebuild does not take the row back) |
| V3-4 | DA-4 | Search escaping and paging never ran against the real gateway | fixed `74845b58` (`gateway-reads.test.mjs` in the full tier); it found `*` matching every project — `substringFilter` now uses escaped `imatch` |
| V3-5 | DA-5 | A failed pause receipt aborted the chain pass | fixed `5b650fb7` |
| V3-6 | DA-6 | A throwing routine tick starved the chain pass | fixed `6e37d1da` (`cyclePort.ts#runCyclePasses`) |
| V3-7 | DA-7 | The database and the form folded names differently | fixed `f63680a0` (`pg_c_utf8`; `agentSpec.ts#nameKey`, used by the form too) |
| V3-8 | DO-15 | Two estates creating one id at once were not serialised | fixed `83bed0dd` (an advisory lock per id after the estate lock; two concurrent-session tests watched failing) |
| V3-9 | PL-1, DO-7 | Lane 12 claimed the leftover carry-over while 132 open rows were in no lane | fixed `edaca6cf`: every open CO row is in a lane, and `check-plan-ids.mjs` fails one that is not (watched). Corrects V2-51; the map's iteration-2 entry is corrected by the iteration-3 entry |
| V3-10 | PL-2 | The gate's closing words disagreed with the workspace reader | fixed `edaca6cf`: a status column is read by its header with the workspace's prefix rule ("closed … by", "shipped on", "done in PR" watched). Corrects V2-45 |
| V3-11 | PL-3, DO-6 | P-02, Now and the handoff were stale | fixed: P-02, Now/Next, the handoff (twelve lanes, 73 migrations, exit codes) |
| V3-12 | PL-4 | "From the final main" was not enforced; the handoff released before landing | fixed: `release-mac.mjs` refuses unless HEAD is the fetched `origin/main`; the handoff and runbook land first |
| V3-13 | PL-5, ER-3, DO-13 | The release gate trusted a typed sentence | fixed: the verdict is computed from the rows (one heading per iteration, reports linked, every row disposed, the exit line last and alone), both files read from the commit, the ledger confined to `docs/` (`release-gate.test.mjs`, watched). Corrects V2-53 |
| V3-14 | PL-6 | The board could not show several lanes; 13 ids showed `unknown` | fixed the 13 (their work cards now lead with a status); AD packets, MEM-P and L3c ruled CO-189. Corrects V2-52 in part |
| V3-15 | PL-7 | 0.3.0 ships the draft form before AD02's acceptance | ruled CO-187 — stated in P-03; FR-A waits for it |
| V3-16 | PL-8 | CO-118 was stale | fixed: closed by `node scripts/test-stack.mjs run -- node apps/desktop/test/chain.test.mjs` exit 0; the test's comment corrected |
| V3-17 | PL-9 | Entry rules did not match their registers | fixed: lanes 3, 4, 6 |
| V3-18 | PL-10 | Smaller plan drift | fixed: ADR-0101 numbering, AGENTS.md in-lane order, the strategy's next-task note, the M199 parent row, lane 5's date. Corrects V2-49, V2-50 |
| V3-19 | PL-11 | Knowledge-base pages at landing | ruled: the fabric-workspace PR is part of landing, before the release (P-03) |
| V3-20 | DO-1 | A repository whose inspection timed out vanished uncounted | fixed `af9e1359` (counted in `unreadable`). Corrects V1-25, V2-28 |
| V3-21 | DO-2 | A failed save of the kept scan was never said | fixed `f13b7c4c` (`kept` on the scan) and the renderer says it and re-marks only from a kept list of the same folder (watched). Corrects V2-15 |
| V3-22 | DO-3 | The interface still said "runner" | fixed: English and Russian strings; terminology's wrong forms are literal. Corrects V2-13 |
| V3-23 | DO-4 | The fast tier's database step and its README | fixed `e3dcbcc1` (both runners run; NOT_RUN said and allowed in the fast tier only) |
| V3-24 | DO-5 | REQ-07 marked met with only the planned state designed | ruled CO-188 — REQ-07 corrected to partly met |
| V3-25 | DO-8 | Region markers off target or missing | fixed: 61 markers, each at its specifying text. Corrects V2-37, V2-43 |
| V3-26 | DO-9 | The chain launch bound was specified nowhere | fixed: `harness-r0/checks.md#chain-launch-bound`, the region points there |
| V3-27 | DO-10 | Main did not refuse a repository another project holds | fixed `f8b4c4ed` (`repo-path-refused:held-by-other`) |
| V3-28 | DO-11 | Residue counts quoted as totals | fixed: CO-181 and the comments distinguish totals from residue |
| V3-29 | DO-12, UX-12 | UX documents trailed the code | fixed: symlinks, kept-unreadable, not-kept, no-match, left-on-disk states; SCR-27, SCR-74, SCN-130 wording. Corrects V2-22 |
| V3-30 | DO-14 | ADR-0101 numbering and wording | fixed |
| V3-31 | DO-15 | "Connected" read as measured; README on `handshake-e2e`; "RANKED" | fixed: CONTEXT and ADR-0100 say it is the catalogue's flag; README and `search.ts` corrected |
| V3-32 | ER-1 | A submodule's own filter driver ran on `git status` | fixed `362514c4` (`--ignore-submodules=all` and the config switches; watched). Corrects V2-27 |
| V3-33 | ER-2 | A kept candidate swapped for a link to `/` admitted the disk root | fixed `08941419` (candidates pinned to the walk's path under its root; `/` and the home folder refused). Corrects V2-10 |
| V3-34 | ER-4 | One hung suite erased the full tier's verdicts | fixed `6249b686` (a per-suite limit; the summary always prints). Corrects V2-2 |
| V3-35 | ER-5 | Slow repositories starved healthy ones | fixed `af9e1359` (walk first, inspect four at a time on the remaining budget) |
| V3-36 | ER-6 | `git init` followed an inherited `GIT_DIR` | fixed `8704e357` |
| V3-37 | ER-7 | A `required` filter made the repo panel show a clean tree | fixed `0314bd9b` |
| V3-38 | ER-8 | Detection used synchronous fs calls | fixed `c0ca46ce` |
| V3-39 | ER-9, UX-11 | Refusals reached the Russian window as English | fixed `a9f73d3d` and the renderer: `folder-refused`, `project-name-refused`, `agent-name-refused`, every `repo-path-refused` code translated (tests) |
| V3-40 | ER-10 | Names from disk skipped the name rule | fixed `f8b4c4ed` (bidi and control characters refused) |
| V3-41 | ER-11 | Two ways past the test-stack guard for psql probes | fixed `887ed3ee` |
| V3-42 | UX-1 | "Add N as projects" was not sticky; the window could scroll past the tab bar | fixed `b655128c` (one scroller; the walk asserts it on a list taller than the window). Corrects V1-9 |
| V3-43 | UX-2 | The agent form offered the login shell as a coding agent | fixed: only coding agents offered, `readSpec` refuses the shell (tests) |
| V3-44 | UX-3 | The primary pill covered the path | fixed: rows wrap long paths |
| V3-45 | UX-4 | The deep notice claimed a missing repository | fixed: the copy says most are folders inside repositories |
| V3-46 | UX-5 | Russian «агент» alone | fixed |
| V3-47 | UX-6 | An empty name greyed Add with no reason; the first-run hint unbound | fixed (tests) |
| V3-48 | UX-7 | A search with no match said nothing; "Clear" cleared ticks | fixed: a no-match line; "Untick all" (tests) |
| V3-49 | UX-8 | "Project" casing | fixed. Corrects V2-19 |
| V3-50 | UX-9 | Cancel did not say a made folder stays | fixed: the discard confirm says so. Corrects V2-26 |
| V3-51 | UX-10 | A noisy summary | fixed: parts named only when there are some |
| V3-52 | UX-13 | The weaker coding-agent state looked stronger | fixed: Ready strongest, Installed neutral, rows say the version only |
| V3-53 | UX-14 | The rail widened; "Create an agent" looked like text | fixed: the rail reserves its scrollbar (`scrollbar-gutter: stable`); the button is a primary button |
| V3-54 | UX-15 | Back during an import lost the per-row results | fixed: Back waits (tests) |
| V3-55 | UX-16 | "reaches Fabric only" overclaimed | fixed: "no MCP servers beyond Fabric" |
| V3-56 | UX-17 | The estate-folder question: raw table names, "a persistent workspace" | fixed the workspace wording; raw table names ruled CO-190 |
| V3-57 | UX (harness) | The app was killed after 10 s of SIGTERM at the end of each walk | ruled CO-191 — the quit waits for the scoped runtime shutdown; measured before P-03 |
| V3-58 | DO (method) | A reviewer's helper ran `scripts/residue-report.mjs` against the live stack (read-only session, rolled-back transaction), breaking the brief | not a defect of the product: a process breach of the reviewer brief, recorded; nothing was written |
| V3-59 | confirmation 1 | A session or project id written without hyphens or braced passed the door while the projector stored it | fixed `a6177696` (migration 74: `identity_uuid` is the projector's own cast; `append_event` refuses non-canonical id text; watched: 5 failures with 74 skipped) and `30a462f8` (command ingress refuses non-canonical ids). Corrects V3-1 |
| V3-60 | confirmation 5 | An attached repository later swapped for a link to `/` became a root on refresh; `/Users` passed as not too broad | fixed: `FileRoots.addRepo` skips a path that became a link or resolves too broad; `isTooBroad` covers any folder holding home (`file-roots.test.mjs`, `start-paths-main.test.mjs`, watched). Corrects V3-33 |
| V3-61 | confirmation 2 | The plan gate passed a missing or headerless ledger, a bold id, an indented row, escaped pipes | fixed: each fails (`plan-ids.test.mjs`, watched). Corrects V3-9, V3-10 |
| V3-62 | confirmation 3 | The release gate missed finding rows written `\|V3-41\|`, bold or indented, and took "fixed?" as a disposition | fixed (`release-gate.test.mjs`, watched). Corrects V3-13 |
| V3-63 | confirmation 3 | The DMG could be built from a working tree hiding skip-worktree or assume-unchanged edits | fixed: `release-mac.mjs` refuses any such flag and takes the version from the commit |
| V3-64 | confirmation 6 | The database trimmed only spaces from agent names, the form all whitespace | fixed `a6177696` (`agent_name_trim`, the same 25 characters as `String#trim`) |
| V3-65 | confirmation | Confirmation pass after iteration 3 ([report](2026-10-03-verification/iteration-3/2026-10-03-confirmation.md)): gitRun, the release gate's HEAD reads and origin/main check, and the renderer fixes confirmed | not a defect: the confirmed items; the defects it found are V3-59…V3-64 |
| V3-66 | re-verification 1 | `apply_releases` and `apply_question_deferrals` were executable by PUBLIC (since migrations 68/69), and `decide_proposal`, `release_grant_reservation`, `import_declared_snapshot` by `authenticated` | fixed `a3e33ee3` (migration 75 revokes every `apply_*` from API roles and the three commands from public, anon, authenticated; `function-privileges-db.test.mjs` in the fast tier sweeps `has_function_privilege`; watched: the anon probes and the sweep fail with 75 skipped). Corrects V3-1 / V2-6 in scope ([report](2026-10-03-verification/iteration-3/2026-10-03-reverification.md)) |
| V3-67 | re-verification 2 | A parent folder swapped for a link, or a stored path in another spelling, still made a root on refresh | fixed `95800f4a`: a stored path grants only while it is its own native canonical spelling; too-broad compared by device and inode as well; every recorded path is native-canonical (watched). Corrects V3-60 |
| V3-68 | re-verification | Migration 74's spelling rule and window admission confirmed | not a defect: the confirmed items |
| V3-69 | operator, 2026-10-03 | Twenty Fabric copies were left in the Dock: the walk ended the `node_modules/.bin/electron` wrapper, whose child is the real Electron, so every walk orphaned the app (the walk's 10/10 never checked the app had gone) | fixed: the walk spawns the app in its own process group and `endApp` ends the group (`walk-cleanup.test.mjs`: a grandchild that ignores SIGTERM is ended, watched failing); the 20 orphans were ended; after walk ×3, 0 copies remain. The app's own slow quit on SIGTERM stays CO-191 |

Exit for iteration 3: every finding above is fixed or ruled with a register id. Blocking findings open: none.
