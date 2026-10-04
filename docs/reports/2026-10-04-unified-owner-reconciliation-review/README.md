---
report:
  id: fabric/2026-10-04-unified-owner-reconciliation-review
  title: "Independent current-owner reconciliation review"
  kind: review
  project: fabric
  domains: [correctness, architecture, audit]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-11-04
  summary: >-
    CHANGES for exact 537ca82d: changed files inside an existing scoped directory
    bypass basis contracts and the production CLI still emits the owner leaf ready.
    Independent replay matched 51/53 expectations; the candidate suite passed34/34.
    Fixed owner publication, current pointer, native/full/release acceptance remain inactive.
  sources:
    - name: "Exact reviewed owner compiler"
      url: "https://github.com/passioncode-ai/fabric/tree/537ca82d90e7bb814a907209cb303bbed8633e1e"
      read_at: 2026-10-04
    - name: "Author handoff and proposal boundary"
      url: "https://github.com/passioncode-ai/fabric/blob/537ca82d90e7bb814a907209cb303bbed8633e1e/docs/handoffs/2026-10-04-unified-owner-reconciliation.md"
      read_at: 2026-10-04
    - name: "Pinned production canonical parser"
      url: "https://github.com/passioncode-ai/fabric-workspace/blob/898a3cb4af9bd9dfa8b507fce28bdb008295596c/lib/backlog.mjs"
      read_at: 2026-10-04
  produced_by:
    agent: "contract_adoption_review"
    task: "Independent source-only owner reconciliation review"
  supersedes: []
  consumers: []
---

<sub>ssheleg skills — working-in-passioncode · task-pipeline · project-reports</sub>

# Independent current-owner reconciliation review

## Verdict and untouched authorities

**CHANGES / REJECTED** for `537ca82d90e7bb814a907209cb303bbed8633e1e`. A directory write scope can hide changed subject bytes from its declared prior basis and still produce a ready bounded owner leaf. Root and author were informed immediately; the author acknowledged reproduction and is preparing a separate repair. No repair is acceptance-graded by this cut.

This isolated review changes no canonical source, UX, map, published owner input, current pointer or wiki index. The real fixed owner input and pointer are absent in this source checkout; [source-scope receipt](raw/source-scope.json) records that state. Fixed-path inputs were exercised only inside disposable synthetic repositories. The receipt-only followup `93c2d6abccde04d844af5b11bf09528dc577abbe` leaves the three compiler source files unchanged and does not repair this rejection.

Prior [compiler rejection](https://github.com/passioncode-ai/fabric/blob/5847458132614dc41feaf19ac8459c2b4c8f4b8e/docs/reports/2026-10-04-unified-compiler-review/README.md) and [parity repair recheck](https://github.com/passioncode-ai/fabric/blob/e4244c3505e60b824aeed8890c19c19bceeb3c8e/docs/reports/2026-10-04-unified-compiler-recheck/README.md) remain immutable. This owner-schema extension is a new boundary; it does not rewrite those verdicts or establish full Hub, native, parent, release or installed acceptance.

## Blocking independent counterexample

[The neutral production-parser helper](raw/owner-probes.mjs) creates a committed `example-agent` repository, copies the actual production compiler/CLI/collector and uses the exact parser gitlink `898a3cb4af9bd9dfa8b507fce28bdb008295596c`. No author source fixture, private consumer content or parser stub supplies this counterexample:

1. Commit `docs/example-subject/model.js` with `revision = 1` at the packet's basis.
2. Change that file to `revision = 2` and commit it after the basis.
3. Commit a valid source-owner packet whose `context.scope` is the existing directory `docs/example-subject`, but whose `basis_sources` omits `model.js`.
4. Compile and invoke the actual production `next` CLI.

Both **exit `0`**. Compilation reports revision-bound inputs; `next` emits `P-01.qualify-source` in `ready`. This contradicts the required refusal of changed scoped subject bytes without deliberate basis reconciliation. The exact observations are [raw/owner-probes.json](raw/owner-probes.json), expectations `changed-descendant-in-existing-directory-scope-refused` and `changed-descendant-directory-not-ready`.

The initial replay had 52 expectations with one compilation counterexample. A direct CLI confirmation added the 53rd expectation: the final recorded cut is **51 matched / 2 failed**, two observations of the same blocking cause. At [build-unified-plan.py](https://github.com/passioncode-ai/fabric/blob/537ca82d90e7bb814a907209cb303bbed8633e1e/scripts/build-unified-plan.py#L113), `required_basis` includes scoped paths only when `is_file()` is true. Existing directory descendants are never enumerated. Full derived graph parity cannot reject this because the compiler itself deterministically grants the overly broad source authority.

## Controls that held

The 51 matching expectations in [the same replay](raw/owner-probes.json) cover fixed-path discovery; absence preserving inherited holds; one bounded candidate without parent `done`; owner input pinning; all four CLI verbs refusing derived source suppression, owner removal, historical parent completion, release-action grants and Tasks capability injection; dirty/deleted discovered owner source refusing frontier output; source-level forged identity, `done`, release actions, unknown proof tier, extra Tasks fields and cross-workspace scope refusing output; and typed scoped receipts.

Null, NOT_RUN and FAIL scoped prerequisites hold the leaf; exact PASS admits only that leaf. Foreign repository, wrong subject, old basis, rebound scope, focused-as-native tier and extra Tasks receipt fields are refused. Receipt truth remains source-owned experimental evidence: digest and matching schema attest bytes and declared scope, not independently authenticated execution or MCP capability negotiation. No Tasks support or release authority follows from this candidate.

The [unchanged earlier independent helper](raw/prior-probes.mjs) matches **17/17** [expectations](raw/prior-probes.json), preserving the original historical-proof refusal controls. Its final dirty-input refusal can be masked by its preceding malformed pointer, as already documented in the earlier recheck; it is not counted here as an isolated dirty-source proof.

Meaningful [before controls](raw/before-controls.mjs) substitute only the committed prior compiler `edad4f6b553d6dfa7c56466461fb0f6dd9df8cac` inside the neutral fixture. [Before](raw/before-controls.json): **1/6 matched**, with discovery/ready behavior absent and invalid done/release/Tasks source grants ignored. [Current](raw/current-controls.json): **6/6 matched**. The new source therefore supplies meaningful owner-discovery/schema protections while retaining the directory gap.

The independently replayed author suite passes **34/34**, **zero skips**, exit `0`; [raw/author-suite-replay.log](raw/author-suite-replay.log). It includes phase tests for new-impact default blocking and changed/forged impact applicability. Those are executed existing controls, not a claim that every phase/filetype shape received a new independent probe. No native/full acceptance is inferred from this green suite.

## Narrow repair and sibling hazards

Do not infer an output merely because a scoped input is absent. Separate explicit new outputs from current input/edit scope. An existing input directory needs a complete bounded inventory at its basis, selected revision and live filesystem, with same-basis byte contracts for every regular descendant. New, missing, changed or type-changed descendants must not inherit a prior basis; inspect ignored/untracked files as well as Git-tracked files, and refuse symlink/nonregular/hidden/glob traversal. Explicit outputs must be absent from basis/selected/live state and must not overlap grandfathered source or pass through non-directory parents.

This follows the observed directory failure and source inspection. Missing grandfathered files and directory-contained ignored/untracked/symlink/nonregular entries are same-class repair targets; they were **not independently executed before this initial rejection cut**. Root requested these sibling controls and the author reports implementing them. They must be replayed independently against the next immutable source rather than treated as passed now. The current proposed handoff directory must migrate to an explicit output contract under such a schema.

## Proposal basis, replay and next task

The unguarded proposal uses committed basis `2e06e5013595ec96b52b85cae2c486050632565b`. It is a proposal, **not published authority**. Root has subsequent native test-host inputs; root must choose the actual final committed basis and refresh every subject, authority, dependency and impact byte contract before owner publication. Copying the old basis after those subjects change is not current reconciliation. No fixed JSON or pointer was activated by this review.

Run from a disposable checkout of the reviewed source with its exact `workspace` submodule initialized:

```sh
node docs/reports/2026-10-04-unified-owner-reconciliation-review/raw/owner-probes.mjs
node docs/reports/2026-10-04-unified-owner-reconciliation-review/raw/prior-probes.mjs
node docs/reports/2026-10-04-unified-owner-reconciliation-review/raw/before-controls.mjs
COMPILER_CONTROL_REVISION=edad4f6b553d6dfa7c56466461fb0f6dd9df8cac node docs/reports/2026-10-04-unified-owner-reconciliation-review/raw/before-controls.mjs
node --test scripts/test/unified-plan.test.mjs scripts/test/build-unified-plan.test.mjs
```

Helpers delete their temporary repositories and never touch this checkout's fixed owner JSON or pointer. Node `v26.8.2` supplied the independent run. Tracked receipts normalize temporary/runtime paths and terminal blank lines only; original local receipts stay ignored. Report metadata/whitespace checks run before push; cold remote access is verified at handoff. No full fast tier, native app, hosted dispatch, release, MCP client negotiation or production service was run.

**Exact next task:** preserve this immutable rejection, review the repaired source in a new cut, adapt the positive neutral packet explicitly to the new input/output schema, replay the old failure's intent and sibling filesystem hazards, plus typed receipt and phase boundaries. Root alone refreshes the proposal basis and later decides guarded owner publication/recompile/current-pointer activation. Parent completion and release stay separate regardless of one ready bounded leaf.

## Route actually used

Toolkit measured. `working-in-passioncode` supplied source-owner/proposal boundaries, `task-pipeline` supplied independent authority probes and handoff, and `project-reports` supplied this immutable rejection and metadata. Shared source/register/wiki authority was not acquired or exercised here.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- `working-in-passioncode` — source owner and proposal boundaries — not a skill this family ships
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — independent authority probes
- `project-reports` — immutable rejection and raw evidence — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
