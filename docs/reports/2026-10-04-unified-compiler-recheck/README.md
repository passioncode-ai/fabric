---
report:
  id: fabric/2026-10-04-unified-compiler-recheck
  title: "Independent unified compiler repair recheck"
  kind: review
  project: fabric
  domains: [correctness, architecture, audit]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-11-04
  summary: >-
    ACCEPT for the three prior compiler authority blockers at exact a95bb287.
    Unchanged independent replay passed 17/17 and expanded replay passed 46/46.
    All four CLI verbs refuse forged graph authority before stdout; emit-plan is write-free.
    Current source-owned reconciliation remains planned and held, outside this closure.
  sources:
    - name: "Exact repaired compiler source"
      url: "https://github.com/passioncode-ai/fabric/tree/a95bb28746573af0f2007b4186e3d2a1f83fa764"
      read_at: 2026-10-04
    - name: "Preserved original rejection"
      url: "https://github.com/passioncode-ai/fabric/blob/5847458132614dc41feaf19ac8459c2b4c8f4b8e/docs/reports/2026-10-04-unified-compiler-review/README.md"
      read_at: 2026-10-04
    - name: "Exact production parser"
      url: "https://github.com/passioncode-ai/fabric-workspace/blob/898a3cb4af9bd9dfa8b507fce28bdb008295596c/lib/backlog.mjs"
      read_at: 2026-10-04
  produced_by:
    agent: "contract_adoption_review"
    task: "Independent exact-SHA repair recheck"
  supersedes: [fabric/2026-10-04-unified-compiler-review]
  consumers: []
---

<sub>ssheleg skills — working-in-passioncode · task-pipeline · project-reports</sub>

# Independent unified compiler repair recheck

## Verdict and closure boundary

**ACCEPT**, limited to closure of the three prior authority blockers at `a95bb28746573af0f2007b4186e3d2a1f83fa764`. This new cut supersedes the decision for the repaired source; the [original CHANGES cut](https://github.com/passioncode-ai/fabric/blob/5847458132614dc41feaf19ac8459c2b4c8f4b8e/docs/reports/2026-10-04-unified-compiler-review/README.md) remains immutable and rejected for `8babdd15`.

The current source-owned reconciliation contract is **planned, not implemented**. Inherited completion and candidates remain held. This review does not close the unified-queue goal, current owner dispatch, full Hub acceptance, merge, release, deployment, installed state or App changes. Root owns source import, further reconciliation, plan/maps/registers and the final index.

## Independent evidence

The [original helper](raw/probes.mjs) is unchanged byte-for-byte (SHA-256 `8463f0ba882fdc59434f081b9dcd6806eaa3374d94e50ed6d712432b06b496d5`). Its [17 expectations](raw/prior-probes.json) now all match. The prior historical completion promotion, receipt revision/scope rebinding and candidate suffix rename each return failure instead of accepted authority.

The separate [expanded helper](raw/recheck-probes.mjs) and [46-expectation replay](raw/recheck-probes.json) use the same independently authored neutral committed fixture and the actual production parser pinned at `898a3cb4af9bd9dfa8b507fce28bdb008295596c`. No parser stub, author proof log or private consumer data supplies this result. The expanded count includes the original 17 plus 29 added expectations; the two runs are not 63 distinct cases.

| Tested boundary | Observation |
|---|---|
| Original three forgeries; removal of historical markers; substitution of task ID, canonical identity, kind and dependencies | Each refused by `check`, `next`, `packet` and `impacts`; nonzero exit and **empty stdout** for all 20 combinations |
| `--emit-plan` with the old dated cut, existing generated cut, absent directory and absolute directory as output | Exact expected held graph emitted; before/after file digests under `docs/` and `scripts/` unchanged; absent/absolute output directories not created |
| Generation without privacy deny file | Refused before creating its requested output directory |
| Explicit missing privacy file on `next` | Refused before frontier stdout |
| Internal `inventory` without local deny input | Returns canonical source inventory, with no compiled dispatch/evidence, ready frontier or plan baseline authority; short source SHA refused with empty stdout |
| Existing coverage, pin, dirty-input and pointer negatives | All original expectations preserved; corrected isolated dirty-input rejection also proves the input-drift diagnostic |

Run from the repaired source checkout with its exact `workspace` submodule initialized:

```sh
node docs/reports/2026-10-04-unified-compiler-recheck/raw/probes.mjs
node docs/reports/2026-10-04-unified-compiler-recheck/raw/recheck-probes.mjs
node --test scripts/test/unified-plan.test.mjs scripts/test/build-unified-plan.test.mjs
```

The unchanged helper leaves a malformed pointer in place before its final dirty-input check; that refusal alone does not prove the dirty source gate. The expanded helper removes the pointer and additionally requires the committed-input drift diagnostic, independently confirming that gate.

The first two helpers remove temporary neutral repositories in `finally`. They exercise production compiler and CLI code copied from the checkout being reviewed, and record that exact candidate SHA in each JSON receipt. Local fixture repositories, dependency trees and private configuration stay local. Tracked receipts normalize only temporary fixture and Python runtime paths; unchanged local receipts are ignored.

## Source reasoning and remaining design work

The repaired [validator](https://github.com/passioncode-ai/fabric/blob/a95bb28746573af0f2007b4186e3d2a1f83fa764/scripts/unified-plan.mjs#L121) reconstructs the expected graph with the production compiler, then compares the entire graph before any dispatch-bearing CLI output. Removing historical fields or renaming a task cannot create authority because the expected graph comes from committed source inputs. The [compiler's emit route](https://github.com/passioncode-ai/fabric/blob/a95bb28746573af0f2007b4186e3d2a1f83fa764/scripts/build-unified-plan.py#L256) returns before output-directory creation. Its internal inventory route calls the pinned parser directly and therefore terminates reconstruction without recursive graph validation.

The source continues to verify selected inputs against the full immutable revision, and inherited states are deterministically held. `--emit-plan` may reconstruct without a local deny file; actual artifact generation requires one, and structured private metadata checks still apply in the source. This bounded review makes no claim of a complete privacy audit or every hostile runtime environment.

A future current-reconciliation input must explicitly bind full source SHA, original source-qualified task identity, historical receipt scope, current acceptance scope, dependencies and source-owner/reviewer authority. It must become a committed, pinned compiler input. Passing graph parity is not itself that reconciliation, and it must not be represented as current release or live acceptance.

## Handoff and actual checks

Completed: isolated exact source checkout, source diff inspection before independent replay, unchanged 17-case replay, expanded 46-case replay, report-only persistence. The candidate suite passed **27/27**, with **0 skipped**, exit `0`; recorded in [raw/candidate-tests.log](raw/candidate-tests.log); its result is supporting evidence separate from the independent probes. Report metadata and Git whitespace checks are run before push. Full application, hosted CI and live checks are **NOT_RUN**, with no acceptance inferred from those omissions.

**Exact next task:** root may integrate this narrow compiler repair according to repository policy, then specify and independently review the separately pinned owner-reconciliation input. Keep the current task frontier held until that authority exists. App working-set validation is a separate source commit and review. Preserve the original rejection and this recheck as distinct cuts. No source script, map, shared register or wiki index is modified by this report branch.

## Route actually used

Toolkit measured at this task boundary. `working-in-passioncode` supplied isolated source and authority boundaries, `task-pipeline` supplied immutable repair replay and bounded handoff, and `project-reports` supplied this new cut and metadata checks. Repository and knowledge rules previously read remain applicable.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- `working-in-passioncode` — isolated source and authority boundaries — not a skill this family ships
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — immutable repair replay
- `project-reports` — separate recheck cut preserving rejection — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
