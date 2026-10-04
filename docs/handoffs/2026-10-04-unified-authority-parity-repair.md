<sub>ssheleg skills — task-pipeline · evidence-docs · agent-sync</sub>

# Unified graph authority parity repair — 2026-10-04

The [independent review at 58474581](https://github.com/passioncode-ai/fabric/blob/5847458132614dc41feaf19ac8459c2b4c8f4b8e/docs/reports/2026-10-04-unified-compiler-review/README.md) rejected source `8babdd15`: its compiler held inherited records, but its validator accepted three edits that promoted historical proof or a renamed task into authority. The original review and its three RED results remain unchanged. This is an author repair packet requiring independent exact-SHA recheck, not an accepted queue or release.

## Deterministic production parity

Python `--emit-plan` now reconstructs the complete expected plan from the selected committed inputs and pinned production workspace parser. It performs the same immutable byte and privacy checks as generation. It emits only JSON on stdout, reports failures on stderr, and returns before any output directory or file operation. `--output` is irrelevant in this read-only mode; an existing cut or historical input directory cannot be overwritten.

Production `validatePlan` now reconstructs and compares the entire supplied graph with that deterministic expected graph. The CLI's `check`, `next`, `packet` and `impacts` all enforce parity before printing output or computing a frontier. The expected historical identity, kind, state, receipt scope/revision, context, dependency payload and source pin are computed from committed sources; deleting or renaming a marker does not create authority. A difference refuses with `compiled graph differs from committed inputs`.

Python invokes only the CLI `inventory` verb during reconstruction. That verb reads the pinned canonical catalog and bypasses graph reconstruction, preventing recursion. It grants no task dispatch. Public unit fixtures explicitly inject a synthetic parser response and disable expected-plan reconstruction for structural unit tests. The production CLI exposes no such bypass. Production integration regressions execute the actual Python compiler and exact pinned common parser.

The prior compile commands and single path pointer lifecycle remain in [the original source handoff](2026-10-04-unified-canonical-recompile.md#exact-recompile-and-one-current-entry). For a read-only reconstruction:

```sh
python3 scripts/build-unified-plan.py --emit-plan \
  --source-revision "$UNIFIED_SOURCE_REV" \
  --privacy-deny-file "$FABRIC_PUBLIC_PRIVACY_DENY_FILE"
```

Generation still requires the operator's local privacy deny file and a new output directory. Historical cuts, root registers/map, canonical task sources, pointer activation and the report wiki index were not edited here. No task-owned lease was needed or taken for these unguarded code/tests/handoff files.

## Current bounded owner reconciliation: planned contract

**Not implemented or activated in this repair.** Every inherited candidate/done record remains held. Root's canonical queue can independently authorize work; this graph does not invent that authorization. A subsequent bounded owner change must add a separately committed source input and implement its validation before any `P-08` or `CO-179.design` graph dispatch can become active.

Proposed source home: a fixed owning `docs/evidence/plans/unified-current-reconciliation.json` input, edited by the source owner under the appropriate lease and included in compiler input pins. It carries immutable reconciliation decisions, never a second editable task status table. The compiler must discover this source independently of editable fields in the generated plan; deleting its reference from a generated plan cannot disable validation.

Each record must bind:

- Source-qualified identity: repository, canonical path, stable canonical ID; a distinct bounded graph task ID cannot silently rename an inherited identity.
- Current basis: a full already-committed source SHA and canonical/code byte contracts verified unchanged at the eventual graph input revision. The packet does not claim its own future commit hash. Its actual inclusion commit and digest are derived from Git pins.
- Exact bounded scope, outcome, checks, stop/resume rules and rollback; allowed dispatch is bounded design/implementation only after its relevant prerequisites, not acceptance inferred from a status word.
- Dependency receipts: exact source revision/path/digest, delivered payload, proof tier and scope. An historical check satisfies only its actual scope. CO-179 native/full-state/visual acceptance and P-08 release prerequisites stay explicit.
- Original proof provenance when reused: original revision, path, digest, scope and NOT_RUN limits; current scope is a separate supported receipt, not an edited evidence label.
- Owner/reviewer/authority receipt references: exact committed sources showing approval for this subject and scope. Merely supplying names or a packet in a graph is not approval.

Required follow-on negative controls: unknown or colliding source identity, changed subject bytes, forged/unknown owner receipt, dropped dependency, historical proof relabelled current, excessive write scope, duplicate reconciliation, stale version/receipt, and packet removal from the derived graph. Positive controls must activate only the exact bounded reviewed leaf while preserving all other holds. Current completion requires a separate owner acceptance input and cannot be obtained from a preparation packet.

## Executed checks and exact next task

The unchanged independent replay helper matches **17/17** expectations on the repaired source worktree. The three formerly RED cases now exit **1** with empty success output. This is an author replay; the helper's reported Git HEAD is the rejected base before the repair commit. [Replay receipt and source hashes](unified-authority-parity-repair-20261004/author-replay.json) make that distinction explicit.

Node 24.10.0 combined suite: **27/27**, zero skipped. The new production authority test executes six mutants across all four CLI verbs: historical done, current scope/SHA rebound, renamed candidate, removed historical markers, dependency payload change and bounded scope change. All refuse before output. The read-only reconstruction test also compares repository file paths/digests before and after calls against existing, historical and absent output locations. Receipts are stored [beside this handoff](unified-authority-parity-repair-20261004/).

Python syntax, code-region references and staged whitespace checks are run for this packet. The [before-commit full fast check](unified-authority-parity-repair-20261004/fast-node24-excerpt.log) exits 1 at the root-owned design-map top-iteration gate; no hosted/application/native/live/workspace acceptance is claimed here. Source checks and independent exact-SHA review remain distinct.

Next task: root imports the repair source and requests the independent reviewer to replay all 17 probes against its immutable commit and run the new counter-regressions. Root then supplies the current bounded owner reconciliation packet and its validation implementation, commits converged canonical inputs, recompiles, checks and activates the single current pointer. Until then this graph honestly has no runnable inherited work.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — rejected-baseline repair and bounded source delivery
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — deterministic reconstruction and forgery receipts
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — guarded owner boundary
