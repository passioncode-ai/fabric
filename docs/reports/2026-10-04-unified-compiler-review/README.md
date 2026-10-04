---
report:
  id: fabric/2026-10-04-unified-compiler-review
  title: "Independent unified compiler review"
  kind: review
  project: fabric
  domains: []
  as_of: 2026-10-04
  status: active
  valid_until: 2026-11-04
  summary: >-
    CHANGES at 8babdd15: independently compiled neutral sources with the exact
    pinned production parser and reproduced three accepted authority forgeries.
    Manifest coverage and source pin controls passed the exercised cases.
    Historical receipts and held task identities need current source reconciliation.
  sources:
    - name: "Exact compiler candidate"
      url: "https://github.com/passioncode-ai/fabric/tree/8babdd15afca8afb04e1860eaa3db6abbd8a5341"
      read_at: 2026-10-04
    - name: "Exact production common-backlog parser"
      url: "https://github.com/passioncode-ai/fabric-workspace/blob/898a3cb4af9bd9dfa8b507fce28bdb008295596c/lib/backlog.mjs"
      read_at: 2026-10-04
  produced_by:
    agent: "contract_adoption_review"
    task: "Independent bounded queue compiler review"
  supersedes: []
  consumers: []
---

<sub>ssheleg skills — working-in-passioncode · task-pipeline · project-reports</sub>

# Independent unified compiler review

## Verdict and boundary

**CHANGES** for compiler candidate `8babdd15afca8afb04e1860eaa3db6abbd8a5341` (reviewed diff from `484600`). The generated graph correctly holds inherited completion and candidate states, but its production validator accepts edits that restore those states or misrepresent their authority. This is a compiler/validator review; it does not establish full Hub acceptance, merge, release, installed version, or any live service result.

Source inspection and the independent probes preceded reading author proof. No author handoff or proof output was needed for these findings. The root owns source repairs, integration, the current plan pointer, registry changes and the final wiki index. This report changes none of those authorities.

## Blocking counterexamples

The runnable [neutral fixture helper](raw/probes.mjs) copies the candidate's three production scripts into a temporary committed repository and checks out the actual production parser gitlink `898a3cb4af9bd9dfa8b507fce28bdb008295596c`. It uses synthetic `example-agent` rows and receipts, without a parser stub or private source content. Run it from a checkout of the candidate with its `workspace` submodule initialized:

```sh
node docs/reports/2026-10-04-unified-compiler-review/raw/probes.mjs
```

[The exact replay result](raw/initial-probes.json) contains 17 expectations: 14 matched, three failed. All three failures returned CLI exit `0` and `PASS` for the mutated plan:

| Replay name | Mutation to a valid compiled plan | Required result / actual result |
|---|---|---|
| `historical-proof-repromoted-done` | Change held `UP-01` to `done`; retain the unchanged historical lint receipt with `live_admission: NOT_RUN` | Refuse / accepts |
| `historical-proof-rebound-to-current` | Set that task to `done`, add current full fixture SHA and `Current release acceptance` to its evidence fields; receipt bytes remain historical | Refuse / accepts |
| `historical-proof-repromoted-candidate` | Rename held `UP-01` to `UP-01.prepare`, set kind `design-review` and dispatch `candidate` | Refuse / accepts |

At [unified-plan.mjs:43](https://github.com/passioncode-ai/fabric/blob/8babdd15afca8afb04e1860eaa3db6abbd8a5341/scripts/unified-plan.mjs#L43), candidate checks trust editable kind/ID fields and permit a `.prepare` suffix. At [lines 46–49](https://github.com/passioncode-ai/fabric/blob/8babdd15afca8afb04e1860eaa3db6abbd8a5341/scripts/unified-plan.mjs#L46), completion requires only a path, digest and matching live bytes. The validator does not bind evidence's claimed revision/scope to a current reconciliation input. The compiler's [hold at lines 203–207](https://github.com/passioncode-ai/fabric/blob/8babdd15afca8afb04e1860eaa3db6abbd8a5341/scripts/build-unified-plan.py#L203) therefore fails to survive derived graph edits.

## Exercised controls and limitations

The same production integration successfully compiled and validated the baseline; retained all 15 declared COM rows including two `COM-01` identities in different files; held inherited states; and produced an empty ready frontier. It rejected omission of `COM-14`, a source pin's substituted revision, a selected research packet's changed bytes, a pointer carrying status authority, pointer traversal, and dirty canonical source bytes before generating output. These observations are individually recorded in [raw/initial-probes.json](raw/initial-probes.json).

The production inventory is manifest-driven and source-qualified. The synthetic fixture tests compiler behavior when communication rows are declared; it does not claim that the candidate's actual manifest already declares every root-owned COM packet. Canonical data import remains a separate source-owner task. Parser code and its dependency `lib/snapshot.mjs` were inspected at the exact gitlink before probes; the candidate verifies both against that Git object.

The existing candidate tests passed **25/25**, with **0 skipped**, using `node --test scripts/test/unified-plan.test.mjs scripts/test/build-unified-plan.test.mjs`; see [raw/candidate-tests.log](raw/candidate-tests.log). Their green result does not cover the three authority mutations above. This bounded review does not independently claim every selected input drift shape, prepared-leaf shape, privacy case or CLI symlink case was replayed. Full application/hosted checks and live acceptance were **NOT_RUN**.

## Narrow repair and handoff

Reconstruct the expected graph from committed selected inputs through the pinned production parser, and reject authority-bearing differences (or compare the whole deterministic graph). An editable historical marker must not be the only guard: deleting it, relabelling scope, changing state, or renaming a task must not create current authority. A legitimate future reconciliation should be a separately committed and pinned source-owned input that binds current full SHA, original source-qualified task identity, original receipt scope, explicit current scope, dependencies and reviewer/owner authority. Until that input exists, inherited completion and dispatch remain held.

The root acknowledged these counterexamples and is responsible for repair. **Exact next task:** replay this helper against the next immutable compiler SHA, confirm all 17 expectations match, add regressions for removal of historical markers and altered dependencies, and append a new review cut preserving this rejection. Root then decides integration and current-queue publication. The raw helper is a review artifact, not an authored production fix.

Completed: source-first inspection, production parser integration, 17 independent probes, candidate tests, source-owned report. Open: current reconciliation authority repair and independent exact-SHA recheck. Decisions: `8babdd15` is a rejected repair baseline; no acceptance is inherited from green candidate tests. Prerequisites: initialized exact `workspace` gitlink and Node/Python/Git available. Local fixture repositories and dependencies stay local and are removed by the helper; none are committed.

## Route actually used

Read repository `AGENTS.md`, knowledge rules and org `CONTRIBUTING.md`; measured the toolkit. `working-in-passioncode` supplied owner/source boundaries, `task-pipeline` supplied bounded review and handoff sequencing, and `project-reports` supplied metadata and report checks. No shared register or wiki index was edited.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- `working-in-passioncode` — repository and source-only review boundaries — not a skill this family ships
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded queue compiler review
- `project-reports` — source-owned findings and metadata — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
