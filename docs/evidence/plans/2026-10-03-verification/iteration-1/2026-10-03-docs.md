# Iteration 1: code and documentation conformance

Range: `0ca25630..7eff2419`, previews excluded. Read-only review.

## Gates (run at HEAD, exit codes read directly)

| Command | Exit | Note |
|---|---|---|
| `bash scripts/check-docs.sh` | 0 | |
| `node scripts/check-registers.mjs` | 0 | |
| `node scripts/check-plan-ids.mjs` | 0 | |
| `node scripts/check-regions.mjs` | 0 | 15 markers |
| `python3 docs/ux/lint.py` | 0 | |
| `python3 docs/brand/lint.py` | 0 | 1578 warnings, up from 1468 at `0ca25630` (base taken with `git archive` into the scratchpad). That is +110 B022, all in `i18n/en.ts`, plus one date-driven B005 |
| `node scripts/check-vocabulary.mjs` | 0 | |

All the gates are green, but several of the findings below sit outside what they check.

## Findings (most severe first)

**1. ADR-0100 reverses ADR-0063 but does not say so.** Level: code-docs. Severity: blocking.
- ADR-0063 §3 says naming is "not [a] separate operator gate" and the directory supplies the name.
- ADR-0063 §1 requires a ready, checked executor before observation, and `first-release.md` FR02 says "No scan without ready executor".
- ADR-0100 §2 adds a name-confirm gate, and §1 makes the executor check information only.
- ADR-0100's "Amends" line lists SCN-095, ONB-01, single-entry, FLW-55 and SCN-015, but not ADR-0063 or `first-release.md`. `docs/adr/README.md:79` still reads "Accepted target".
- Fix: name ADR-0063 §1/§3 and FR02/FR04 as amended in ADR-0100, and add a superseded-in-part note to the ADR-0063 index row.

**2. The app-icon region points at a doc that never mentions the icon.** Level: code-docs. Severity: blocking.
- `scripts/build-app-icon.mjs:2` points to `ADR-0100#consequences`, but neither ADR-0100 nor ADR-0101 contains the word "icon" (grep).
- `assets/brand/app-icon/README.md` and `build-app-icon.mjs:3` cite "ADR-0100 D5". D5 exists only in the brief.
- Fix: point the region and README at `docs/evidence/plans/2026-10-03-onboarding-and-plan.md` (decision table, D5), or add an icon clause to ADR-0100.

**3. Some documented "built" claims are false.**
- **3a. False built citation.** Level: code-docs. Severity: blocking. In `product-model.json`, SCR-73 has `current_status` "Сделано (done) … StartPaths.tsx#NewProject". No `NewProject` exists there: `StartPaths.tsx:50` routes `new` away, and the form is `Onboarding.tsx`.
- **3b. Coverage disagrees with the scenario.** Level: code-docs. Severity: major. In `docs/launch/adoption/inventory.json`, SCN-129 coverage reads `StartPaths.tsx; startPaths.ts`, while `scenarios.md:3157` says `Onboarding.tsx; startPaths.ts`. The same row's runtime_description says "renderer/src/start/".
- **3c. Cross-links are inconsistent.** Level: code-docs. Severity: major. `task_ids` is `[]` for SCR-70..75 in both files, while `screens.md` lists P-01..05 and AR-7/AR-11. In the product model, `screen_refs` is `[]` for SCN-129..131.
- Fix: correct the citations and re-sync.

**4. REQ rows are unmet but not marked open.** Level: plan. Severity: blocking.
- REQ-02 requires "signed-in" executor detection. It is not built (ADR-0100 defers it), and it is not marked in the REQ table or the handoff.
- REQ-06 (the agent form tidied, with every state tested) is untouched: `ProjectHome.tsx` is not in the diff.
- REQ-11 (strings through the brand pack) is unmet: 110 new strings have no `strings.md` row, and `docs/brand/strings.md` is unchanged.
- REQ-02 also asks for "main IPC tests"; there are none for `start-paths-ipc`.
- The table is frozen, so these must be marked open or ruled with a CO id.

**5. The handoff is stale.** Level: plan. Severity: blocking for whoever picks it up next.
- `docs/handoffs/2026-10-03-onboarding-and-plan.md` says the branch is at `7697923c` and that the exact next task is "Merge origin/main". That merge already happened in `5e4d1ea5`, and HEAD is `7eff2419`.
- The handoff was last touched in `381c08b7` (`git log`).
- Fix: rewrite the "Open" section for HEAD.

**6. Deferrals have no ids.** Level: plan. Severity: major.
- ADR-0100 Consequences says sign-in verification and scheduled re-scan are "owned by the plan". The plan cites no id for either, and no CO row exists.
- That breaks ADR-0101 §2 ("ids, never prose promises"), AGENTS rule 2 and R-002.
- Fix: add P-* or CO rows.

**7. ADR-0100 §7's boundary claim is false for the last scan.** Level: boundary/code-docs. Severity: major.
- §7 says every folder read was chosen "in this window's picker".
- `IPC.startLastScan` (`main/index.ts`, `start-paths-ipc` region) re-grants `kept.root` from `last-scan.json` to any window, with no picker.
- The `FABRIC_WALK_PICK` seam (unpackaged builds only) is also undocumented in the ADR.
- Fix: amend §7 to state both, or require the picker before re-granting.

**8. The scan's depth limit stops silently.** Level: boundary/code-docs. Severity: major.
- `projectDiscovery.ts:172` (`depth >= maxDepth`, default 4) returns without setting `truncated`, so a repository at depth 5 vanishes while the UI shows no truncation notice.
- ADR-0100 §3 says "a walk stopped by its bound says so", and SCN-128 says "A walk stopped by its bound says the list is not the whole folder".
- Fix: flag depth cut-offs (for example `deepSkipped`), or document depth as a non-reported limit.

**9. The SCN-128 rationale is false.** Level: scenario/code-docs. Severity: major.
- It says "grouping keeps worktrees from becoming duplicate projects".
- In fact worktree candidates are individually tickable (`StartPaths.tsx:347-357`), and `importedBy` matches the exact path (`index.ts`, `importedIndex`). So after importing a repository, its worktree is still tickable as a second Project.
- Fix: correct the text, or disable worktree rows whose group is already imported.

**10. Code without tests, against R-003/R-006.** Level: code-docs. Severity: major.
- `main/startPaths.ts` has no test at all: `createProjectFolder` (its outside, exists, invalid-name and failed branches), `keepScan` and `validateScan`. Grep finds it only in `index.ts`.
- Fix `7eff2419` ("unrecorded truncation reads as truncated") landed with no test watched going red.
- SCN-128 cites `main/startPaths.ts` as coverage anyway.

**11. SCN-129's retry claim is false when `git init` fails.** Level: error/code-docs. Severity: major.
- SCN-129 says "A failure after the folder was made reuses that folder on retry".
- `createProjectFolder` runs `mkdirSync`, then `git init`. If git init fails, it returns `failed` and leaves the folder behind; a retry then hits `existsSync` and returns `exists`.
- A cancelled form also leaves an empty folder on disk.
- Fix: roll back the folder on failure, or accept an empty existing folder as its own.

**12. Living documents left stale.** Level: code-docs. Severity: major.
- `docs/ux/flows.md:1843` still says "FLW-55 welcome leads directly to executor connection; no personalisation form".
- SCN-095 step 4 (`scenarios.md:2431`) has the amendment note prepended, but the step still says "Related sources never silently become separate top-level Projects".
- SCN-015 has no "manual fallback" note.
- SCN-122 (conversion driven by Fabric) does not link to SCN-131, the second conversion model.

**13. Glossary gaps.** Level: code-docs. Severity: major.
- "Agent" means two things inside one first run: step 2 "Continue without an agent" means a coding CLI, while step 3 "New agent" means the CONTEXT Agent.
- The code calls the CLI an "executor" (`ExecutorRow`) and the UI calls it a "coding agent"; neither term is in `CONTEXT.md`. Persona name, start path and candidate are also undefined.
- "Convert an agent … a script, a service, an MCP server" is, by CONTEXT's definitions, creating a Provider.
- Fix: add CONTEXT entries and rename the step-2 string to "Continue without a coding agent". R-001 applies.

**14. The persona name is shown almost nowhere.** Level: code-docs. Severity: minor.
- It is used only inside `FirstRun.tsx` (grep). `PersonaScreen.tsx` cannot show or edit it, and SCR-36 was not updated.
- ADR §1 says the name "changes how Fabric looks".

**15. The plan-ids gate silently ignores ids outside its regex.** Level: plan. Severity: minor.
- `plan-ids.mjs` (the `ID` regex) never sees ids outside its pattern, so `F5`, `F5A`, `F7` or a typo like `AR7` pass unchecked. The brief names F5/F7 as open.
- Plan lane 1 lists P-04 (the provider re-pin), which is not Start work.
- The brief's D9 says "the rule in ADR-0100"; it is ADR-0101.

**16. The Claude Code install command is not the vendor's recommended one.** Level: code-docs. Severity: minor.
- `executorDetect.ts` shows `npm install -g @anthropic-ai/claude-code` as "the install path".
- `code.claude.com/docs/en/setup` (fetched 2026-10-03) marks the native install as Recommended: `curl -fsSL https://claude.ai/install.sh | bash`. npm is an "advanced" option that needs Node 22.

**17. Minor items.**
- `folderNameProblem` returns English text that is interpolated into the ru UI (`Onboarding.tsx` newFolder).
- The ADR index says ADR-0100/0101 were returned "for run `2026-10-03-onboarding-and-plan`"; the counter ref shows run `r-07dbb329a`.
- The `walk-start-paths` region points to the reviewer protocol, and the `repin-provider-builds` region points to a map changelog entry. Neither is a spec of the code.

## Checked and correct

- **Id counter:** `refs/agent-sync/ids/ADR` holds `next: 103` with rkey `pipeline-reservation-after-start-paths-20261003`. This matches the README ("Next free ID ADR-0103, ADR-0102 reserved") and the contract diff.
- **Regions:** every one resolves. The `executor-detect`, `project-discovery`, `start-paths`, `start-screens`, `first-run` and `new-project-folder` regions match ADR-0100 §1–5.
- **Cited lines:** `screens.md` and `scenarios.md` line numbers in `inventory.json` are exact.
- **Launcher:** the `@passioncode-ai/passioncode@0.1.21` launcher ships `fabric-agent-adapter` (`npm pack` inspected), so the convert screen's command is real.
- **Tests:** SCN-126/127/128/130/131 behaviours have renderer tests in `StartPaths.test.tsx`, and the plan-ids plant test exists.

## Not checked

- I did not check the live walk ("10/10"), because it needs a build and the local stack.
- I did not run `workspace.mjs check --require-child` (REQ-14) or `ci.sh`.

## Process note

My one write was an accidental `git fetch` that created `refs/tmp-review-adr`. I deleted it immediately with `git update-ref -d`, and nothing else was written.
