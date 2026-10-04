---
report:
  id: fabric/2026-10-04-unified-owner-reconciliation-recheck
  title: "Independent owner input/output repair recheck"
  kind: review
  project: fabric
  domains: [correctness, architecture, audit]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-11-04
  summary: >-
    ACCEPT for exact cf16bc85 source-only input/output and cold-pin repair.
    Independent production-parser replay matches 157/157 expectations; candidate suite38/38.
    Before537 reproduces directory and grandfathered-output bypasses.
    Proposal basis2e is stale; owner publication, pointer and parent acceptance remain pending.
  sources:
    - name: "Exact repaired source"
      url: "https://github.com/passioncode-ai/fabric/tree/cf16bc851d14e42b9df683b16928acba38d9b589"
      read_at: 2026-10-04
    - name: "Immutable initial rejection"
      url: "https://github.com/passioncode-ai/fabric/blob/9a1a07fc5d993ffcf53c891681fa4b04746b1d3c/docs/reports/2026-10-04-unified-owner-reconciliation-review/README.md"
      read_at: 2026-10-04
    - name: "Pinned production canonical parser"
      url: "https://github.com/passioncode-ai/fabric-workspace/blob/898a3cb4af9bd9dfa8b507fce28bdb008295596c/lib/backlog.mjs"
      read_at: 2026-10-04
    - name: "Repair handoff and unactivated proposal"
      url: "https://github.com/passioncode-ai/fabric/blob/cf16bc851d14e42b9df683b16928acba38d9b589/docs/handoffs/2026-10-04-unified-owner-scope-repair.md"
      read_at: 2026-10-04
  produced_by:
    agent: "contract_adoption_review"
    task: "Independent repair replay, bounded source authority only"
  supersedes: [fabric/2026-10-04-unified-owner-reconciliation-review]
  consumers: []
---

<sub>ssheleg skills — working-in-passioncode · task-pipeline · project-reports</sub>

# Independent owner input/output repair recheck

## Verdict and source boundary

**ACCEPT**, narrowly, for `cf16bc851d14e42b9df683b16928acba38d9b589`. The original changed-descendant bypass is closed; existing directory input scope now requires a complete bounded inventory and same-basis contracts. Explicit new outputs cannot grandfather existing source. Cold readers receive all validated packet references, including descendants, standing authority, source dependencies, phase decisions and typed acceptance receipts.

The original [REJECTED cut9a1a07](https://github.com/passioncode-ai/fabric/blob/9a1a07fc5d993ffcf53c891681fa4b04746b1d3c/docs/reports/2026-10-04-unified-owner-reconciliation-review/README.md) stays unchanged. This new cut supersedes its repair-pending conclusion for the new source; it does not relabel `537ca82d90e7bb814a907209cb303bbed8633e1e` as accepted. Prior compiler rejection and parity recheck cuts also remain intact.

Only this report and its neutral fixtures are changed. The reviewed checkout has neither `docs/evidence/plans/unified-current-reconciliation.json` nor `docs/unified-plan-current.json`. Fixed owner inputs are created only inside disposable synthetic repositories. No canonical backlog, UX, map, shared register, wiki or native host was edited. [Exact versions, source hashes and scope](raw/checks.json) bind the execution to the source and parser.

## Independent execution

Each helper creates a neutral `example-agent` Git repository, copies the actual compiler/CLI/collector and initializes the exact production workspace parser gitlink `898a3cb4af9bd9dfa8b507fce28bdb008295596c`. Synthetic sources include canonical P-01,14 COM rows and a second source-owned COM-01 collision. No private consumer contents, parser stub or author proof substitutes for the independent observations.

| Executed replay | Result | Evidence |
|---|---:|---|
| Original owner discovery/parity/typed receipts, positive packet adapted to mandatory output scope | 53/53 | [helper](raw/owner-probes.mjs), [observations](raw/owner-probes.json) |
| Directory, output and cold-pin controls | 36/36 | [helper](raw/filesystem-probes.mjs), [observations](raw/filesystem-probes.json) |
| Phase applicability, typed receipt and cold propagation | 51/51 | [helper](raw/phase-pins-probes.mjs), [observations](raw/phase-pins-probes.json) |
| Unchanged prior independent compiler controls | 17/17 | [helper](raw/prior-17-probes.mjs), [observations](raw/prior-17-probes.json) |
| Existing candidate test suite, independently executed | 38/38, zero skips | [log](raw/author-suite-replay.log) |
| Same filesystem intent with rejected compiler537 | 13/36 matched;23 failed expectations, meaningful RED | [observations](raw/before-537-probes.json) |

The 157 independent expectations are observations rather than157 separate unit tests. Helpers emit all observations with process exit0; [assert-results](raw/assert-results.mjs) exits1 for the rejected control and0 for each repaired replay. The before control substitutes only the committed compiler537 and translates the positive new-output declaration to its old schema. It does not invent a repair in the old compiler.

The owner replay changes only the positive packet's required input/output schema and records the final direct CLI refusal even when compilation refuses. Derived owner suppression/removal, parent completion, release authority and Tasks capability fields remain refused by all four verbs before stdout. Null, NOT_RUN and FAIL prerequisites hold the bounded leaf; an exact typed PASS admits only that candidate. Forged repository, subject, basis, scope and proof tier are refused. The unchanged17 helper retains its previously disclosed malformed-pointer masking on its final dirty-source check; the separate owner replay supplies isolated dirty/deleted-owner refusals.

## Directory and explicit-output boundary

The original counterexample now exits1 with `Reconciliation basis does not cover canonical/context/current scoped files` and writes no new plan. Its existing directory has a changed committed descendant omitted from the basis refs. The rejected compiler exits0 for the same intent; the original rejection separately proved that the actual `next` CLI then exposes the leaf as ready.

Independent sibling cases refuse changed, added and deleted committed descendants, untracked and ignored descendants, a symlink child, a FIFO, a file changed into a directory, hidden entries and omitted basis refs. The immutable257-file inventory exceeds its bound;1025 live entries exceed the traversal bound. Complete two-file directory inputs compile successfully with both descendants pinned in the CLI packet and cold inputs. Diagnostics in [the raw observations](raw/filesystem-probes.json) distinguish byte drift, inventory drift, nonregular entries and bounds.

New output checks refuse a missing mandatory `output_scope`, an undeclared missing input, a deleted historical source repurposed as output, an already existing live output, input/output and output/output overlaps, symlink or regular-file parents, globs, traversal and workspace paths. A historical regular file deleted at the selected revision and replaced by a live directory still cannot parent a new output. The repaired source checks immutable parents at both basis and selected revisions. These cases are separately reset; fixture cleanup explicitly removes FIFO entries that Git clean leaves behind.

The new schema is deliberately incompatible with the former implicit-missing-output shape. Root must publish a packet with existing `context.scope` inputs and explicit, genuinely absent `output_scope` targets. A new directory declaration does not widen a prior existing source directory.

## Phase and cold-reader controls

An undecided open blocking impact holds the leaf. An exact same-basis `parent-acceptance-only` decision permits one qualification candidate while the parent remains held. A newly added unreviewed impact blocks again with its own ID. Unknown phase IDs, global clearing, bounded-design exemptions and changed phase bytes are refused. Unknown severity/disposition can be serialized by compilation, but all four production CLI verbs reject the invalid state before stdout; compilation alone is not the dispatch gate.

The positive phase packet carries a separate typed focused PASS receipt and a source-input dependency, both omitted from the hand-written context source list. The CLI packet and cold inputs nevertheless contain every exact selected-revision pin and digest: both directory files, AGENTS standing authority, source dependency, phase input, scoped receipt and fixed owner input. Explicit `input_targets` and `new_output_targets` remain distinct in the cold scope. No parent is marked done. Forged derived removal of the phase source, clearing all impacts or parent done is refused by check/next/packet/impacts before stdout.

Typed receipt matching proves committed bytes and declared scope. It does not independently authenticate that the named execution happened, establish MCP Tasks negotiation or grant release authority. Those remain separate evidence obligations.

## Proposal, replay and handoff

The author's unactivated [proposal](https://github.com/passioncode-ai/fabric/blob/cf16bc851d14e42b9df683b16928acba38d9b589/docs/handoffs/unified-owner-reconciliation-20261004/proposed-root-input.json) still uses basis `2e06e5013595ec96b52b85cae2c486050632565b`. Root has subsequent native test-host changes. This source acceptance does not accept that stale proposal as current authority. Root must freeze its final source, refresh all subject/authority/dependency/phase refs and explicit outputs, then validate before separately publishing the guarded owner JSON, recompiling and activating a pointer.

Replay from this report checkout, whose compiler bytes match the exact reviewed source, with `workspace` initialized at its committed gitlink:

```sh
node docs/reports/2026-10-04-unified-owner-reconciliation-recheck/raw/owner-probes.mjs
node docs/reports/2026-10-04-unified-owner-reconciliation-recheck/raw/filesystem-probes.mjs
node docs/reports/2026-10-04-unified-owner-reconciliation-recheck/raw/phase-pins-probes.mjs
node docs/reports/2026-10-04-unified-owner-reconciliation-recheck/raw/prior-17-probes.mjs
COMPILER_CONTROL_REVISION=537ca82d90e7bb814a907209cb303bbed8633e1e node docs/reports/2026-10-04-unified-owner-reconciliation-recheck/raw/filesystem-probes.mjs
node --test scripts/test/unified-plan.test.mjs scripts/test/build-unified-plan.test.mjs
```

The independent host used Node `v26.8.2`, matching the source-declared `darwin-arm64-node26-local` profile, and Python3.14.7. No dependency install was required. Tracked receipts normalize temporary/runtime paths and terminal blank lines only; originals remain ignored locally. The report metadata and whitespace gates run before handoff. Cold remote access and artifact byte equality were verified at the pushed report commit; [delivery receipt](raw/delivery.json). The author reports a fast-tier root map refusal; this reviewer did not run that broad tier. Native/full/parent acceptance, hosted dispatch, release, actual owner activation, current pointer activation and MCP client negotiation are **NOT_RUN** here. The wiki index remains root-owned.

**Exact next task:** root integrates the accepted compiler source under its normal policy, refreshes the proposal to the final committed root basis, validates that packet and each prerequisite at its declared proof scope, and only then decides owner publication and pointer activation. One ready bounded candidate is not canonical completion or release.

## Route actually used

Toolkit measured584 callable host skills. `working-in-passioncode` supplied source ownership boundaries; `task-pipeline` supplied isolated replay and delivery; `project-reports` supplied the new immutable cut and raw receipts. No make-skill or UI route was needed for this ordinary internal compiler review.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- `working-in-passioncode` — bounded source ownership — not a skill this family ships
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — isolated review delivery
- `project-reports` — immutable report cut — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
